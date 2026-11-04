/**
 * Validation for The Roast Room data files.
 * Every exported validator returns { valid, errors } and never throws.
 */

import {
  CATEGORY_IDS,
  CLUB_STATUS,
  LIMITS,
  REGISTRY_VERSION,
  ROAST_ID_PATTERN,
  THEME_KEYS,
} from './config.js';

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid True when no problems were found.
 * @property {string[]} errors Human readable problem descriptions.
 */

/**
 * @typedef {Object} Theme
 * @property {string} primary Hex colour used for club identity and primary fills.
 * @property {string} primaryContrast Hex colour that reads well on top of primary.
 * @property {string} accent Hex colour used for highlights.
 * @property {string} background Page background colour.
 * @property {string} surface Card background colour.
 * @property {string} surfaceRaised Raised panel background colour.
 * @property {string} line Border and divider colour.
 * @property {string} text Default text colour.
 * @property {string} textMuted Secondary text colour.
 */

/**
 * @typedef {Object} Evidence
 * @property {string} claim Precise factual statement.
 * @property {string} period Season or date the claim refers to, such as 2013/14 or 2021/09/11.
 * @property {string} sourceName Name of the publication or record.
 * @property {string} sourceUrl Absolute URL starting with https.
 * @property {string} accessedOn Date the source was read, formatted YYYY/MM/DD.
 */

/**
 * @typedef {Object} Roast
 * @property {string} id Lowercase identifier, unique inside the club.
 * @property {string} clubId Club the roast belongs to.
 * @property {string} category Category id taken from the club categories.
 * @property {string} headline The joke, 90 characters or fewer.
 * @property {string} explanation Factual context, 280 characters or fewer.
 * @property {Evidence[]} evidence One or more sourced facts.
 * @property {boolean} verified True when a human has checked every claim.
 * @property {string} [verifiedOn] Date of verification, formatted YYYY/MM/DD.
 * @property {string[]} [tags] Optional labels.
 */

/**
 * @typedef {Object} ClubCategory
 * @property {string} id Category id from the canonical list.
 * @property {string} displayLabel Label shown in the interface.
 * @property {string} description Short neutral description.
 * @property {string} emoji Single emoji used by the picker.
 */

/**
 * @typedef {Object} Club
 * @property {string} id Club identifier.
 * @property {string} name Full club name.
 * @property {string} shortName Short club name.
 * @property {'live' | 'comingSoon'} status Publication status.
 * @property {string} themeKey Key used to tie the club to a theme.
 * @property {string} [dataFile] Path to the club data file, required when live.
 * @property {Theme} [theme] Theme overrides, full in a data file, partial in the registry.
 * @property {ClubCategory[]} [categories] Categories available to the club.
 * @property {Roast[]} [roasts] Roasts belonging to the club.
 */

const DATE_PATTERN = /^(\d{4})\/(\d{2})\/(\d{2})$/;
const SEASON_PATTERN = /^\d{4}\/\d{2}$/;
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * True for a value that is a plain object and not an array.
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * True for a string that contains something other than whitespace.
 * @param {unknown} value
 * @returns {boolean}
 */
function isFilledString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * True for a calendar date written as YYYY/MM/DD. The date must actually exist,
 * so 2024/02/31 and 2023/02/29 are rejected while 2024/02/29 is accepted. The
 * check builds a UTC date and confirms the year, month and day round trip
 * unchanged.
 * @param {unknown} value
 * @returns {boolean}
 */
function isDateString(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * True for a season string such as 2013/14 or a full date.
 * @param {unknown} value
 * @returns {boolean}
 */
function isPeriodString(value) {
  if (typeof value !== 'string') return false;
  if (SEASON_PATTERN.test(value)) return true;
  return isDateString(value);
}

/**
 * True for an absolute URL that uses the https scheme.
 * @param {unknown} value
 * @returns {boolean}
 */
function isHttpsUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('https://')) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate a theme object. Unknown keys and non hex colours are reported.
 * @param {unknown} theme
 * @param {{ path?: string, requireAll?: boolean }} [options]
 * @returns {ValidationResult}
 */
function validateTheme(theme, options = {}) {
  const path = options.path || 'theme';
  const errors = [];

  if (!isPlainObject(theme)) {
    return { valid: false, errors: [`${path} must be an object`] };
  }

  Object.keys(theme).forEach((key) => {
    if (!THEME_KEYS.includes(key)) {
      errors.push(`${path}.${key} is not a known theme token`);
      return;
    }
    if (!HEX_COLOR_PATTERN.test(String(theme[key]))) {
      errors.push(`${path}.${key} must be a hex colour such as #1C1C1C`);
    }
  });

  if (options.requireAll === true) {
    THEME_KEYS.forEach((key) => {
      if (theme[key] === undefined) {
        errors.push(`${path}.${key} is required`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate the evidence array attached to a roast.
 * @param {unknown} evidence
 * @param {{ path?: string }} [options]
 * @returns {ValidationResult}
 */
export function validateEvidence(evidence, options = {}) {
  const path = options.path || 'evidence';
  const errors = [];

  try {
    if (!Array.isArray(evidence)) {
      return { valid: false, errors: [`${path} must be an array`] };
    }

    if (evidence.length < LIMITS.evidenceMinItems) {
      errors.push(`${path} must contain at least ${LIMITS.evidenceMinItems} item`);
    }

    evidence.forEach((item, index) => {
      const itemPath = `${path}[${index}]`;

      if (!isPlainObject(item)) {
        errors.push(`${itemPath} must be an object`);
        return;
      }
      if (!isFilledString(item.claim)) {
        errors.push(`${itemPath}.claim must be a non empty string`);
      }
      if (!isPeriodString(item.period)) {
        errors.push(`${itemPath}.period must be a season such as 2013/14 or a date such as 2021/09/11`);
      }
      if (!isFilledString(item.sourceName)) {
        errors.push(`${itemPath}.sourceName must be a non empty string`);
      }
      if (!isHttpsUrl(item.sourceUrl)) {
        errors.push(`${itemPath}.sourceUrl must be an absolute URL starting with https`);
      }
      if (!isDateString(item.accessedOn)) {
        errors.push(`${itemPath}.accessedOn must use the format YYYY/MM/DD and be a real calendar date`);
      }
    });
  } catch {
    errors.push(`${path} could not be validated`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a single roast. A roast that is unverified is reported as invalid
 * on purpose, because an unverified roast must never reach the page.
 * @param {unknown} roast
 * @param {Object} [options]
 * @param {string} [options.path] Prefix used in error messages.
 * @param {string} [options.clubId] Club the roast is expected to belong to.
 * @param {string[]} [options.categoryIds] Categories the club exposes.
 * @param {string[]} [options.seenIds] Roast ids already used inside the club.
 * @returns {ValidationResult}
 */
export function validateRoast(roast, options = {}) {
  const path = options.path || 'roast';
  const errors = [];

  try {
    if (!isPlainObject(roast)) {
      return { valid: false, errors: [`${path} must be an object`] };
    }

    if (typeof roast.id !== 'string' || !ROAST_ID_PATTERN.test(roast.id)) {
      errors.push(`${path}.id must use lowercase letters, digits and underscores only`);
    } else if (roast.id.length < LIMITS.roastIdMinLength || roast.id.length > LIMITS.roastIdMaxLength) {
      errors.push(`${path}.id must be between ${LIMITS.roastIdMinLength} and ${LIMITS.roastIdMaxLength} characters`);
    } else if (Array.isArray(options.seenIds) && options.seenIds.includes(roast.id)) {
      errors.push(`${path}.id "${roast.id}" is already used in this club`);
    }

    if (!isFilledString(roast.clubId)) {
      errors.push(`${path}.clubId must be a non empty string`);
    } else if (isFilledString(options.clubId) && roast.clubId !== options.clubId) {
      errors.push(`${path}.clubId must match the club "${options.clubId}"`);
    }

    if (!isFilledString(roast.category)) {
      errors.push(`${path}.category must be a non empty string`);
    } else if (Array.isArray(options.categoryIds) && !options.categoryIds.includes(roast.category)) {
      errors.push(`${path}.category "${roast.category}" is not one of the club categories`);
    }

    if (!isFilledString(roast.headline)) {
      errors.push(`${path}.headline must be a non empty string`);
    } else if (roast.headline.trim().length > LIMITS.headlineMaxLength) {
      errors.push(`${path}.headline must be ${LIMITS.headlineMaxLength} characters or fewer`);
    }

    if (!isFilledString(roast.explanation)) {
      errors.push(`${path}.explanation must be a non empty string`);
    } else if (roast.explanation.trim().length > LIMITS.explanationMaxLength) {
      errors.push(`${path}.explanation must be ${LIMITS.explanationMaxLength} characters or fewer`);
    }

    const evidenceResult = validateEvidence(roast.evidence, { path: `${path}.evidence` });
    errors.push(...evidenceResult.errors);

    if (roast.verified !== true) {
      errors.push(`${path}.verified must be true before a roast can be published`);
    } else if (!isDateString(roast.verifiedOn)) {
      errors.push(`${path}.verifiedOn must use the format YYYY/MM/DD when verified is true`);
    }

    if (roast.tags !== undefined) {
      if (!Array.isArray(roast.tags)) {
        errors.push(`${path}.tags must be an array when present`);
      } else {
        roast.tags.forEach((tag, index) => {
          if (!isFilledString(tag)) {
            errors.push(`${path}.tags[${index}] must be a non empty string`);
          } else if (tag.length > LIMITS.tagMaxLength) {
            errors.push(`${path}.tags[${index}] must be ${LIMITS.tagMaxLength} characters or fewer`);
          }
        });
      }
    }
  } catch {
    errors.push(`${path} could not be validated`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a club record. The same function covers two shapes:
 * a registry entry, which must carry a dataFile when live, and a club data
 * file, which must carry theme, categories and roasts.
 * @param {unknown} club
 * @param {Object} [options]
 * @param {string} [options.path] Prefix used in error messages.
 * @param {'auto' | 'registry' | 'data'} [options.mode] Shape to expect.
 * @param {string} [options.clubId] Club id the record must match.
 * @returns {ValidationResult}
 */
export function validateClub(club, options = {}) {
  const path = options.path || 'club';
  const mode = options.mode || 'auto';
  const errors = [];

  try {
    if (!isPlainObject(club)) {
      return { valid: false, errors: [`${path} must be an object`] };
    }

    const looksLikeDataFile =
      isPlainObject(club.theme) || Array.isArray(club.categories) || Array.isArray(club.roasts);
    const isDataFile = mode === 'data' || (mode === 'auto' && looksLikeDataFile);

    if (!isFilledString(club.id)) {
      errors.push(`${path}.id must be a non empty string`);
    } else if (club.id.length > LIMITS.clubIdMaxLength) {
      errors.push(`${path}.id must be ${LIMITS.clubIdMaxLength} characters or fewer`);
    } else if (isFilledString(options.clubId) && club.id !== options.clubId) {
      errors.push(`${path}.id must match the registry club "${options.clubId}"`);
    }

    if (!isFilledString(club.name)) {
      errors.push(`${path}.name must be a non empty string`);
    }
    if (!isFilledString(club.shortName)) {
      errors.push(`${path}.shortName must be a non empty string`);
    }
    if (!isFilledString(club.themeKey)) {
      errors.push(`${path}.themeKey must be a non empty string`);
    }

    if (club.status !== CLUB_STATUS.LIVE && club.status !== CLUB_STATUS.COMING_SOON) {
      errors.push(`${path}.status must be "live" or "comingSoon"`);
    }

    if (mode !== 'data' && club.status === CLUB_STATUS.LIVE) {
      if (!isFilledString(club.dataFile)) {
        errors.push(`${path}.dataFile is required when status is live`);
      } else if (!club.dataFile.endsWith('.json')) {
        errors.push(`${path}.dataFile must point at a json file`);
      }
    }

    if (isPlainObject(club.theme)) {
      const themeResult = validateTheme(club.theme, {
        path: `${path}.theme`,
        requireAll: isDataFile,
      });
      errors.push(...themeResult.errors);
    } else if (isDataFile) {
      errors.push(`${path}.theme is required in a club data file`);
    }

    if (isDataFile) {
      const categoryIds = [];

      if (!Array.isArray(club.categories)) {
        errors.push(`${path}.categories must be an array`);
      } else if (club.categories.length === 0) {
        errors.push(`${path}.categories must contain at least one category`);
      } else {
        club.categories.forEach((category, index) => {
          const categoryPath = `${path}.categories[${index}]`;

          if (!isPlainObject(category)) {
            errors.push(`${categoryPath} must be an object`);
            return;
          }
          if (!isFilledString(category.id)) {
            errors.push(`${categoryPath}.id must be a non empty string`);
          } else if (!CATEGORY_IDS.includes(category.id)) {
            errors.push(`${categoryPath}.id "${category.id}" is not a known category`);
          } else if (categoryIds.includes(category.id)) {
            errors.push(`${categoryPath}.id "${category.id}" is a duplicate category`);
          } else {
            categoryIds.push(category.id);
          }
          if (!isFilledString(category.displayLabel)) {
            errors.push(`${categoryPath}.displayLabel must be a non empty string`);
          }
          if (!isFilledString(category.description)) {
            errors.push(`${categoryPath}.description must be a non empty string`);
          }
          if (!isFilledString(category.emoji)) {
            errors.push(`${categoryPath}.emoji must be a non empty string`);
          }
        });
      }

      if (!Array.isArray(club.roasts)) {
        errors.push(`${path}.roasts must be an array`);
      } else {
        const seenIds = [];
        club.roasts.forEach((roast, index) => {
          const roastResult = validateRoast(roast, {
            path: `${path}.roasts[${index}]`,
            clubId: club.id,
            categoryIds,
            seenIds,
          });
          errors.push(...roastResult.errors);
          if (isPlainObject(roast) && typeof roast.id === 'string') {
            seenIds.push(roast.id);
          }
        });
      }
    }
  } catch {
    errors.push(`${path} could not be validated`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate the whole club registry.
 * @param {unknown} registry
 * @returns {ValidationResult}
 */
export function validateRegistry(registry) {
  const errors = [];

  try {
    if (!isPlainObject(registry)) {
      return { valid: false, errors: ['registry must be an object'] };
    }

    if (registry.version !== REGISTRY_VERSION) {
      errors.push(`registry.version must be ${REGISTRY_VERSION}`);
    }

    if (!Array.isArray(registry.clubs)) {
      return { valid: false, errors: [...errors, 'registry.clubs must be an array'] };
    }

    if (registry.clubs.length === 0) {
      errors.push('registry.clubs must contain at least one club');
    }

    const seenIds = [];
    let liveCount = 0;

    registry.clubs.forEach((club, index) => {
      const clubResult = validateClub(club, {
        path: `registry.clubs[${index}]`,
        mode: 'registry',
      });
      errors.push(...clubResult.errors);

      if (!isPlainObject(club)) return;

      if (club.status === CLUB_STATUS.LIVE) {
        liveCount += 1;
      }
      if (typeof club.id === 'string') {
        if (seenIds.includes(club.id)) {
          errors.push(`registry.clubs[${index}].id "${club.id}" is a duplicate club id`);
        }
        seenIds.push(club.id);
      }
    });

    if (liveCount === 0) {
      errors.push('registry.clubs must contain at least one live club');
    }
  } catch {
    errors.push('registry could not be validated');
  }

  return { valid: errors.length === 0, errors };
}