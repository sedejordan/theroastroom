/**
 * Shared constants for The Roast Room.
 * This module has no side effects and no browser only globals, so it runs
 * unchanged in the browser, in Node scripts and in the test runner.
 */

/**
 * @typedef {'live' | 'comingSoon'} ClubStatus
 */

/**
 * Every value a club status may take.
 * @type {{ LIVE: ClubStatus, COMING_SOON: ClubStatus }}
 */
export const CLUB_STATUS = Object.freeze({
  LIVE: 'live',
  COMING_SOON: 'comingSoon',
});

/**
 * Path of the club registry, relative to the site root.
 * @type {string}
 */
export const REGISTRY_PATH = 'data/clubs.json';

/**
 * Folder that holds one data file per club.
 * @type {string}
 */
export const CLUBS_DIRECTORY = 'data/clubs';

/**
 * The club that is live for the first release.
 * @type {string}
 */
export const DEFAULT_CLUB_ID = 'manutd';

/**
 * Shape version of data/clubs.json that this build understands.
 * @type {number}
 */
export const REGISTRY_VERSION = 1;

/**
 * Categories a roast may use. A club data file must pick from this list.
 * @type {readonly string[]}
 */
export const CATEGORY_IDS = Object.freeze([
  'trophyDroughts',
  'historicalDefeats',
  'embarrassingRecords',
  'failedTransfers',
  'painfulStats',
]);

/**
 * Hard limits enforced by the validators.
 * @type {Readonly<Record<string, number>>}
 */
export const LIMITS = Object.freeze({
  headlineMaxLength: 90,
  explanationMaxLength: 280,
  roastIdMinLength: 3,
  roastIdMaxLength: 64,
  evidenceMinItems: 1,
  tagMaxLength: 32,
  clubIdMaxLength: 40,
});

/**
 * Theme keys, in the order they appear in css/tokens.css.
 * @type {readonly string[]}
 */
export const THEME_KEYS = Object.freeze([
  'primary',
  'primaryContrast',
  'accent',
  'background',
  'surface',
  'surfaceRaised',
  'line',
  'text',
  'textMuted',
]);

/**
 * Maps a theme key to the CSS custom property that carries it.
 * @type {Readonly<Record<string, string>>}
 */
export const THEME_VARIABLES = Object.freeze({
  primary: '--colorPrimary',
  primaryContrast: '--colorPrimaryContrast',
  accent: '--colorAccent',
  background: '--colorBackground',
  surface: '--colorSurface',
  surfaceRaised: '--colorSurfaceRaised',
  line: '--colorLine',
  text: '--colorText',
  textMuted: '--colorTextMuted',
});

/**
 * Pattern a roast id must match.
 * @type {RegExp}
 */
export const ROAST_ID_PATTERN = /^[a-z0-9_]+$/;