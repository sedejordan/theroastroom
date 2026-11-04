/**
 * Data gate for The Roast Room.
 * Validates the registry and every club data file, then exits with code 1 when
 * anything is wrong. Run it before every deploy.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CLUB_STATUS, CLUBS_DIRECTORY, REGISTRY_PATH } from '../js/config.js';
import { validateClub, validateRegistry } from '../js/schema.js';

const rootDirectory = resolve(fileURLToPath(new URL('..', import.meta.url)));

/**
 * Turn an unknown thrown value into a readable string.
 * @param {unknown} error
 * @returns {string}
 */
function describeError(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Read and parse a json file relative to the project root.
 * @param {string} relativePath
 * @returns {Promise<unknown>}
 */
async function readJsonFile(relativePath) {
  const absolutePath = join(rootDirectory, relativePath);
  const text = await readFile(absolutePath, 'utf8');
  return JSON.parse(text);
}

/**
 * Run every check and collect problems. The process exit code is set by the caller.
 * @returns {Promise<number>} Number of problems found.
 */
async function main() {
  const problems = [];

  let registry;
  try {
    registry = await readJsonFile(REGISTRY_PATH);
  } catch (error) {
    console.error(`Could not read ${REGISTRY_PATH}: ${describeError(error)}`);
    return 1;
  }

  const registryResult = validateRegistry(registry);
  problems.push(...registryResult.errors);

  const clubs = registry && Array.isArray(registry.clubs) ? registry.clubs : [];
  const referencedFiles = new Set();

  // Collect every data file that ANY registry club references, whatever its
  // status. A live club must have a readable, valid file. A coming soon club
  // may declare a file that does not exist yet, but the file is validated in
  // exactly the same way as a live club file when it does exist.
  for (const club of clubs) {
    if (!club) continue;
    if (typeof club.dataFile !== 'string' || club.dataFile.length === 0) continue;

    referencedFiles.add(club.dataFile);

    let data;
    try {
      data = await readJsonFile(club.dataFile);
    } catch (error) {
        const fileIsMissing = error && error.code === 'ENOENT';
        if (club.status === CLUB_STATUS.LIVE || !fileIsMissing) {
          problems.push(`${club.dataFile} could not be read: ${describeError(error)}`);
        }
        continue;
      }

    const clubResult = validateClub(data, {
      path: club.dataFile,
      mode: 'data',
      clubId: club.id,
    });
    problems.push(...clubResult.errors);

    if (data && typeof data === 'object' && data.themeKey !== club.themeKey) {
      problems.push(`${club.dataFile}.themeKey must match the registry themeKey "${club.themeKey}"`);
    }
  }

  let files = [];
  try {
    files = await readdir(join(rootDirectory, CLUBS_DIRECTORY));
  } catch (error) {
    problems.push(`${CLUBS_DIRECTORY} could not be read: ${describeError(error)}`);
  }

  // Orphan check. Every file in the clubs folder must be referenced by at
  // least one registry entry, whatever the status of that entry.
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const relativePath = `${CLUBS_DIRECTORY}/${file}`;
    if (!referencedFiles.has(relativePath)) {
      problems.push(`${relativePath} is not referenced by any club in the registry`);
    }
  }

  if (problems.length > 0) {
    console.error(`Data validation failed with ${problems.length} problem(s):`);
    for (const problem of problems) {
      console.error(`  ${problem}`);
    }
    return problems.length;
  }

  console.log(
    `Data validation passed. ${clubs.length} club(s) and ${referencedFiles.size} data file reference(s) checked.`
  );
  return 0;
}

const problemCount = await main();

if (problemCount > 0) {
  process.exitCode = 1;
}