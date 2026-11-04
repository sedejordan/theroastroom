/**
 * Loads and caches the club registry and club data files.
 * Fetch based loading is for the browser. Node scripts read the same files with
 * fs instead, so the schema and loaders stay browser oriented while the build
 * gate validates files directly.
 */

import { CLUB_STATUS, REGISTRY_PATH } from './config.js';
import { validateClub, validateRegistry, validateRoast } from './schema.js';

/**
 * Error raised when a data file cannot be fetched, parsed or validated.
 */
export class DataLoadError extends Error {
  /**
   * @param {string} message Human readable summary.
   * @param {{ code?: string, path?: string, errors?: string[] }} [details]
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'DataLoadError';
    this.code = details.code || 'dataLoadFailed';
    this.path = details.path || '';
    this.errors = Array.isArray(details.errors) ? details.errors : [];
  }
}

const registryCache = new Map();
const clubCache = new Map();

/**
 * Resolve a site relative path against the site root. js/ sits one level below
 * the root, so ../<path> from this module lands on the path at the root, which
 * means the request no longer depends on the URL of the page that loaded it.
 * @param {string} sitePath Path relative to the site root, such as data/clubs.json.
 * @returns {string} Absolute URL string for fetch.
 */
function resolveSitePath(sitePath) {
  return new URL(`../${sitePath}`, import.meta.url).href;
}

/**
 * Fetch a json document and translate every failure into a DataLoadError.
 * @param {string} url Absolute URL to fetch.
 * @param {string} sitePath Logical path used in error messages.
 * @returns {Promise<unknown>}
 */
async function fetchJson(url, sitePath) {
  let response;

  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (error) {
    throw new DataLoadError(`Could not reach ${sitePath}`, {
      code: 'networkError',
      path: sitePath,
      errors: [describe(error)],
    });
  }

  if (!response.ok) {
    throw new DataLoadError(`Request for ${sitePath} failed with status ${response.status}`, {
      code: 'httpError',
      path: sitePath,
      errors: [`status ${response.status}`],
    });
  }

  try {
    return await response.json();
  } catch (error) {
    throw new DataLoadError(`${sitePath} is not valid JSON`, {
      code: 'parseError',
      path: sitePath,
      errors: [describe(error)],
    });
  }
}

/**
 * Turn an unknown thrown value into a readable string.
 * @param {unknown} error
 * @returns {string}
 */
function describe(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Warn about roasts that were dropped by the loader.
 * @param {Array<{ id: string, reasons: string[] }>} dropped
 * @returns {void}
 */
function warnAboutDroppedRoasts(dropped) {
  if (dropped.length === 0) return;
  if (typeof console === 'undefined' || typeof console.warn !== 'function') return;

  dropped.forEach((entry) => {
    console.warn(`[roastRoom] dropped roast "${entry.id}": ${entry.reasons.join('; ')}`);
  });
}

/**
 * Load and cache the club registry.
 * @param {{ path?: string, reload?: boolean }} [options]
 * @returns {Promise<{ version: number, clubs: Array<Record<string, unknown>> }>}
 * @throws {DataLoadError} When the registry cannot be fetched, parsed or validated.
 */
export async function loadRegistry(options = {}) {
  const path = options.path || REGISTRY_PATH;

  if (options.reload !== true && registryCache.has(path)) {
    return registryCache.get(path);
  }

  const data = await fetchJson(resolveSitePath(path), path);
  const result = validateRegistry(data);

  if (!result.valid) {
    throw new DataLoadError(`The club registry at ${path} is not valid`, {
      code: 'invalidRegistry',
      path,
      errors: result.errors,
    });
  }

  registryCache.set(path, data);
  return data;
}

/**
 * Load and cache one club data file. Roasts that fail validation, or that are
 * not verified, are dropped with a console warning instead of failing the page.
 * @param {string} clubId Club identifier from the registry.
 * @param {{ path?: string, reload?: boolean }} [options]
 * @returns {Promise<Record<string, unknown>>} The club data with only publishable roasts.
 * @throws {DataLoadError} When the club is unknown, not live, or its data file is broken.
 */
export async function loadClub(clubId, options = {}) {
  const registry = await loadRegistry(options);
  const entry = registry.clubs.find((club) => club && club.id === clubId);

  if (!entry) {
    throw new DataLoadError(`Club "${clubId}" is not in the registry`, {
      code: 'unknownClub',
      errors: [`unknown club id "${clubId}"`],
    });
  }

  if (entry.status !== CLUB_STATUS.LIVE) {
    throw new DataLoadError(`Club "${clubId}" is not live yet`, {
      code: 'clubNotLive',
      errors: [`status is ${entry.status}`],
    });
  }

  if (typeof entry.dataFile !== 'string' || entry.dataFile.length === 0) {
    throw new DataLoadError(`Club "${clubId}" has no data file`, {
      code: 'missingDataFile',
      errors: ['dataFile is missing from the registry entry'],
    });
  }

  if (options.reload !== true && clubCache.has(entry.id)) {
    return clubCache.get(entry.id);
  }

  const data = await fetchJson(resolveSitePath(entry.dataFile), entry.dataFile);

  // Validate the club shell first. Roasts are checked one by one below so that
  // a single bad roast cannot take the whole club offline.
  const shell = typeof data === 'object' && data !== null ? { ...data, roasts: [] } : data;
  const shellResult = validateClub(shell, {
    path: entry.dataFile,
    mode: 'data',
    clubId: entry.id,
  });

  if (!shellResult.valid) {
    throw new DataLoadError(`${entry.dataFile} is not a valid club data file`, {
      code: 'invalidClubData',
      path: entry.dataFile,
      errors: shellResult.errors,
    });
  }

  const categoryIds = Array.isArray(data.categories) ? data.categories.map((category) => category.id) : [];
  const roasts = Array.isArray(data.roasts) ? data.roasts : [];
  const published = [];
  const dropped = [];
  const seenIds = [];

  roasts.forEach((roast, index) => {
    const roastResult = validateRoast(roast, {
      path: `roasts[${index}]`,
      clubId: data.id,
      categoryIds,
      seenIds,
    });

    const roastId =
      roast && typeof roast === 'object' && typeof roast.id === 'string'
        ? roast.id
        : `roasts[${index}]`;

    if (roastResult.valid) {
      published.push(roast);
    } else {
      dropped.push({ id: roastId, reasons: roastResult.errors });
    }

    if (roast && typeof roast === 'object' && typeof roast.id === 'string') {
      seenIds.push(roast.id);
    }
  });

  warnAboutDroppedRoasts(dropped);

  const club = { ...data, roasts: published };
  clubCache.set(entry.id, club);
  return club;
}

/**
 * Filter a registry down to the clubs that are live.
 * @param {{ clubs?: Array<Record<string, unknown>> }} registry
 * @returns {Array<Record<string, unknown>>}
 */
export function getLiveClubs(registry) {
  return getClubsByStatus(registry, CLUB_STATUS.LIVE);
}

/**
 * Filter a registry down to the clubs that are coming soon.
 * @param {{ clubs?: Array<Record<string, unknown>> }} registry
 * @returns {Array<Record<string, unknown>>}
 */
export function getComingSoonClubs(registry) {
  return getClubsByStatus(registry, CLUB_STATUS.COMING_SOON).sort((a, b) =>
    String(a.name).localeCompare(String(b.name))
  );
}

/**
 * Shared status filter used by the two exported helpers.
 * @param {{ clubs?: Array<Record<string, unknown>> }} registry
 * @param {string} status
 * @returns {Array<Record<string, unknown>>}
 */
function getClubsByStatus(registry, status) {
  if (!registry || !Array.isArray(registry.clubs)) return [];
  return registry.clubs.filter((club) => club && club.status === status);
}