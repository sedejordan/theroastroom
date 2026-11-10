/**
 * Pure logic for the fan roast submission Worker routes.
 * No Cloudflare APIs, no fetch, no KV. Runs unchanged in the Worker and in
 * the Node test runner.
 */

import { CATEGORY_IDS, LIMITS } from '../../js/config.js';
import { RATE_LIMIT_ACTIONS_PER_DAY, normaliseRateRecord } from './logic.js';

/** @type {string} */
export const ROASTS_KEY = 'roastboard';
/** @type {number} */
export const ROASTS_VERSION = 1;
/** @type {number} */
export const MAX_ROAST_SUBMISSIONS = 200;
/** @type {number} */
export const ROAST_SUBMISSIONS_PER_DAY = 2;
/** @type {number} */
export const HEADLINE_MAX_LENGTH = LIMITS.headlineMaxLength;
/** @type {number} */
export const EXPLANATION_MAX_LENGTH = LIMITS.explanationMaxLength;
/** @type {number} */
export const CLAIM_MAX_LENGTH = 300;
/** @type {number} */
export const SOURCE_NAME_MIN_LENGTH = 2;
/** @type {number} */
export const SOURCE_NAME_MAX_LENGTH = 80;
/** @type {number} */
export const SOURCE_URL_MAX_LENGTH = 300;
/** @type {number} */
export const ROAST_BODY_LIMIT_BYTES = 4096;

const SEASON_PATTERN = /^\d{4}\/\d{2}$/;
const DATE_PATTERN = /^(\d{4})\/(\d{2})\/(\d{2})$/;
const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const BASE36_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Strip control characters, replace them with a single space, collapse runs of
 * whitespace to one space and trim. Anything that is not a string becomes an
 * empty string.
 * @param {unknown} raw
 * @returns {string}
 */
export function normaliseText(raw) {
  if (typeof raw !== 'string') return '';
  let out = '';
  for (const char of raw) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    if (code < 0x20 || code === 0x7f) {
      out += ' ';
      continue;
    }
    out += char;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * True for a season such as 2013/14 or a real calendar date such as 2021/09/11.
 * @param {unknown} value
 * @returns {boolean}
 */
export function validateRoastPeriod(value) {
  if (typeof value !== 'string') return false;
  if (SEASON_PATTERN.test(value)) return true;
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
 * True for a public https URL with a dotted hostname, no credentials and no
 * IP address. Rejects anything longer than SOURCE_URL_MAX_LENGTH.
 * @param {unknown} value
 * @returns {boolean}
 */
export function validatePublicSourceUrl(value) {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > SOURCE_URL_MAX_LENGTH) return false;
  if (!value.startsWith('https://')) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.username.length > 0 || url.password.length > 0) return false;
  const host = url.hostname.toLowerCase();
  if (host.length === 0) return false;
  if (host === 'localhost') return false;
  if (host.startsWith('[') && host.endsWith(']')) return false;
  if (IPV4_PATTERN.test(host)) return false;
  if (!host.includes('.')) return false;
  return true;
}

/**
 * @typedef {Object} RoastSubmissionFields
 * @property {string} clubId
 * @property {string} category
 * @property {string} headline
 * @property {string} explanation
 * @property {string} claim
 * @property {string} period
 * @property {string} sourceName
 * @property {string} sourceUrl
 */

/**
 * Validate the text fields of one roast submission.
 * @param {unknown} raw
 * @param {string[]} liveClubIds
 * @returns {{ valid: boolean, errors: string[], value: RoastSubmissionFields }}
 */
export function validateRoastFields(raw, liveClubIds) {
  const errors = [];
  const value = {
    clubId: '',
    category: '',
    headline: '',
    explanation: '',
    claim: '',
    period: '',
    sourceName: '',
    sourceUrl: '',
  };

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['fields must be an object'], value };
  }

  const clubId = normaliseText(raw.clubId);
  if (clubId.length === 0) {
    errors.push('clubId must be a non empty string');
  } else if (!Array.isArray(liveClubIds) || !liveClubIds.includes(clubId)) {
    errors.push('clubId is not a live club');
  } else {
    value.clubId = clubId;
  }

  const category = normaliseText(raw.category);
  if (category.length === 0) {
    errors.push('category must be a non empty string');
  } else if (!CATEGORY_IDS.includes(category)) {
    errors.push('category is not a known category');
  } else {
    value.category = category;
  }

  const headline = normaliseText(raw.headline);
  if (headline.length === 0) {
    errors.push('headline must be a non empty string');
  } else if (headline.length > HEADLINE_MAX_LENGTH) {
    errors.push(`headline must be ${HEADLINE_MAX_LENGTH} characters or fewer`);
  } else {
    value.headline = headline;
  }

  const explanation = normaliseText(raw.explanation);
  if (explanation.length === 0) {
    errors.push('explanation must be a non empty string');
  } else if (explanation.length > EXPLANATION_MAX_LENGTH) {
    errors.push(`explanation must be ${EXPLANATION_MAX_LENGTH} characters or fewer`);
  } else {
    value.explanation = explanation;
  }

  const claim = normaliseText(raw.claim);
  if (claim.length === 0) {
    errors.push('claim must be a non empty string');
  } else if (claim.length > CLAIM_MAX_LENGTH) {
    errors.push(`claim must be ${CLAIM_MAX_LENGTH} characters or fewer`);
  } else {
    value.claim = claim;
  }

  const period = normaliseText(raw.period);
  if (!validateRoastPeriod(period)) {
    errors.push('period must be a season such as 2013/14 or a real date such as 2021/09/11');
  } else {
    value.period = period;
  }

  const sourceName = normaliseText(raw.sourceName);
  if (sourceName.length < SOURCE_NAME_MIN_LENGTH) {
    errors.push(`sourceName must be at least ${SOURCE_NAME_MIN_LENGTH} characters`);
  } else if (sourceName.length > SOURCE_NAME_MAX_LENGTH) {
    errors.push(`sourceName must be ${SOURCE_NAME_MAX_LENGTH} characters or fewer`);
  } else {
    value.sourceName = sourceName;
  }

  const sourceUrlRaw = typeof raw.sourceUrl === 'string' ? raw.sourceUrl.trim() : '';
  if (!validatePublicSourceUrl(sourceUrlRaw)) {
    errors.push('sourceUrl must be a public https url with a hostname');
  } else {
    value.sourceUrl = sourceUrlRaw;
  }

  return { valid: errors.length === 0, errors, value };
}

/**
 * Read a roast board safely. Missing or malformed boards become empty boards.
 * @param {unknown} board
 * @returns {{ version: number, submissions: Record<string, Record<string, unknown>> }}
 */
export function normaliseRoastBoard(board) {
  if (
    !board ||
    typeof board !== 'object' ||
    !board.submissions ||
    typeof board.submissions !== 'object' ||
    Array.isArray(board.submissions)
  ) {
    return { version: ROASTS_VERSION, submissions: {} };
  }
  return { version: ROASTS_VERSION, submissions: board.submissions };
}

/**
 * Count the submissions in a roast board.
 * @param {unknown} board
 * @returns {number}
 */
export function countRoastSubmissions(board) {
  return Object.keys(normaliseRoastBoard(board).submissions).length;
}

/**
 * Read the roast rate record, adding the roast submission count.
 * @param {unknown} record
 * @returns {{ actions: number, voted: string[], roasts: number }}
 */
export function normaliseRoastRate(record) {
  const base = normaliseRateRecord(record);
  const roasts = Number.isInteger(base.roasts) && base.roasts >= 0 ? base.roasts : 0;
  return { actions: base.actions, voted: base.voted.slice(), roasts };
}

/**
 * Build a lowercase base 36 string of the given length from an injected
 * random source.
 * @param {() => number} rng
 * @param {number} length
 * @returns {string}
 */
function randomBase36(rng, length) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    const n = rng();
    const safe = Number.isFinite(n) ? n : 0;
    const index = Math.floor(safe * BASE36_ALPHABET.length);
    const bounded = Math.max(0, Math.min(BASE36_ALPHABET.length - 1, index));
    out += BASE36_ALPHABET[bounded];
  }
  return out;
}

/**
 * Generate a unique id of the shape fan_ followed by a short lowercase base 36
 * string. The id matches the roast id pattern in js/schema.js and is at most
 * 64 characters. The random source is injected so tests stay deterministic.
 * @param {unknown} board
 * @param {() => number} [random]
 * @returns {string}
 */
export function generateRoastId(board, random) {
  const safe = normaliseRoastBoard(board);
  const rng = typeof random === 'function' ? random : Math.random;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const suffix = attempt > 0 ? attempt.toString(36) : '';
    const id = `fan_${randomBase36(rng, 8)}${suffix}`;
    if (!safe.submissions[id]) return id;
  }
  return `fan_${randomBase36(rng, 8)}${Date.now().toString(36).slice(-4)}`;
}

/**
 * Format an ISO timestamp as a UTC date string in YYYY/MM/DD shape. Returns an
 * empty string when the input cannot be parsed.
 * @param {string} isoString
 * @returns {string}
 */
function utcDateString(isoString) {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

/**
 * True when the board already holds a pending or approved submission with the
 * same club and normalised headline.
 * @param {{ version: number, submissions: Record<string, Record<string, unknown>> }} board
 * @param {string} clubId
 * @param {string} headline
 * @returns {boolean}
 */
function hasDuplicateHeadline(board, clubId, headline) {
  for (const entry of Object.values(board.submissions)) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.status !== 'pending' && entry.status !== 'approved') continue;
    if (entry.clubId === clubId && entry.headline === headline) return true;
  }
  return false;
}

/**
 * Build a pending submission object.
 * @param {{ id: string, fields: RoastSubmissionFields, now: string }} options
 * @returns {Record<string, unknown>}
 */
function buildPendingSubmission(options) {
  const { id, fields, now } = options;
  return {
    id,
    clubId: fields.clubId,
    category: fields.category,
    headline: fields.headline,
    explanation: fields.explanation,
    claim: fields.claim,
    period: fields.period,
    sourceName: fields.sourceName,
    sourceUrl: fields.sourceUrl,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    verifiedOn: '',
  };
}

/**
 * Apply a roast submission. On success performs exactly two KV writes (rate
 * record and roast board). Rejected submissions perform none.
 * @param {{
 *   board: unknown,
 *   rateRecord: unknown,
 *   fields: unknown,
 *   now: string,
 *   liveClubIds: string[],
 *   random?: () => number
 * }} options
 * @returns {{
 *   outcome: 'pending' | 'invalid' | 'rateLimited' | 'full' | 'duplicate',
 *   board: { version: number, submissions: Record<string, Record<string, unknown>> },
 *   rateRecord: { actions: number, voted: string[], roasts: number },
 *   value: RoastSubmissionFields,
 *   errors: string[]
 * }}
 */
export function applyRoastSubmission(options) {
  const { board, rateRecord, fields, now, liveClubIds, random } = options || {};
  const safeBoard = normaliseRoastBoard(board);
  const safeRate = normaliseRoastRate(rateRecord);

  const validation = validateRoastFields(fields, liveClubIds);
  if (!validation.valid) {
    return {
      outcome: 'invalid',
      board: safeBoard,
      rateRecord: safeRate,
      value: validation.value,
      errors: validation.errors,
    };
  }

  if (safeRate.actions >= RATE_LIMIT_ACTIONS_PER_DAY) {
    return {
      outcome: 'rateLimited',
      board: safeBoard,
      rateRecord: safeRate,
      value: validation.value,
      errors: ['You have reached the daily limit. Try again tomorrow.'],
    };
  }
  if (safeRate.roasts >= ROAST_SUBMISSIONS_PER_DAY) {
    return {
      outcome: 'rateLimited',
      board: safeBoard,
      rateRecord: safeRate,
      value: validation.value,
      errors: ['You have reached the daily roast submission limit. Try again tomorrow.'],
    };
  }

  if (hasDuplicateHeadline(safeBoard, validation.value.clubId, validation.value.headline)) {
    return {
      outcome: 'duplicate',
      board: safeBoard,
      rateRecord: safeRate,
      value: validation.value,
      errors: ['That headline is already on the list.'],
    };
  }

  if (countRoastSubmissions(safeBoard) >= MAX_ROAST_SUBMISSIONS) {
    return {
      outcome: 'full',
      board: safeBoard,
      rateRecord: safeRate,
      value: validation.value,
      errors: ['The submission list is full right now.'],
    };
  }

  const id = generateRoastId(safeBoard, random);
  const submission = buildPendingSubmission({ id, fields: validation.value, now });
  const nextBoard = {
    version: safeBoard.version,
    submissions: { ...safeBoard.submissions, [id]: submission },
  };
  const nextRate = {
    actions: safeRate.actions + 1,
    voted: safeRate.voted.slice(),
    roasts: safeRate.roasts + 1,
  };
  return {
    outcome: 'pending',
    board: nextBoard,
    rateRecord: nextRate,
    value: validation.value,
    errors: [],
  };
}

/**
 * Approve one roast submission. checkedSource must be exactly true.
 * @param {{ board: unknown, id: string, checkedSource: boolean, now: string }} options
 * @returns {{ outcome: 'approved' | 'notFound' | 'notChecked', board: { version: number, submissions: Record<string, Record<string, unknown>> } }}
 */
export function applyRoastApprove(options) {
  const { board, id, checkedSource, now } = options || {};
  const safeBoard = normaliseRoastBoard(board);
  const safeId = typeof id === 'string' ? id : '';
  if (!safeId || !safeBoard.submissions[safeId]) {
    return { outcome: 'notFound', board: safeBoard };
  }
  if (checkedSource !== true) {
    return { outcome: 'notChecked', board: safeBoard };
  }
  const existing = safeBoard.submissions[safeId];
  const nextBoard = {
    version: safeBoard.version,
    submissions: {
      ...safeBoard.submissions,
      [safeId]: {
        ...existing,
        status: 'approved',
        updatedAt: now,
        verifiedOn: utcDateString(now),
      },
    },
  };
  return { outcome: 'approved', board: nextBoard };
}

/**
 * Reject one roast submission.
 * @param {{ board: unknown, id: string, now: string }} options
 * @returns {{ outcome: 'rejected' | 'notFound', board: { version: number, submissions: Record<string, Record<string, unknown>> } }}
 */
export function applyRoastReject(options) {
  const { board, id, now } = options || {};
  const safeBoard = normaliseRoastBoard(board);
  const safeId = typeof id === 'string' ? id : '';
  if (!safeId || !safeBoard.submissions[safeId]) {
    return { outcome: 'notFound', board: safeBoard };
  }
  const existing = safeBoard.submissions[safeId];
  const nextBoard = {
    version: safeBoard.version,
    submissions: {
      ...safeBoard.submissions,
      [safeId]: { ...existing, status: 'rejected', updatedAt: now, verifiedOn: '' },
    },
  };
  return { outcome: 'rejected', board: nextBoard };
}

/**
 * Remove one roast submission.
 * @param {{ board: unknown, id: string }} options
 * @returns {{ outcome: 'removed' | 'notFound', board: { version: number, submissions: Record<string, Record<string, unknown>> } }}
 */
export function applyRoastRemove(options) {
  const { board, id } = options || {};
  const safeBoard = normaliseRoastBoard(board);
  const safeId = typeof id === 'string' ? id : '';
  if (!safeId || !safeBoard.submissions[safeId]) {
    return { outcome: 'notFound', board: safeBoard };
  }
  const next = { ...safeBoard.submissions };
  delete next[safeId];
  return { outcome: 'removed', board: { version: safeBoard.version, submissions: next } };
}

/**
 * Edit the text fields of one submission with the same validation rules.
 * @param {{ board: unknown, id: string, fields: unknown, now: string, liveClubIds: string[] }} options
 * @returns {{ outcome: 'updated' | 'notFound' | 'invalid', board: { version: number, submissions: Record<string, Record<string, unknown>> }, errors: string[] }}
 */
export function applyRoastEdit(options) {
  const { board, id, fields, now, liveClubIds } = options || {};
  const safeBoard = normaliseRoastBoard(board);
  const safeId = typeof id === 'string' ? id : '';
  if (!safeId || !safeBoard.submissions[safeId]) {
    return { outcome: 'notFound', board: safeBoard, errors: [] };
  }
  const validation = validateRoastFields(fields, liveClubIds);
  if (!validation.valid) {
    return { outcome: 'invalid', board: safeBoard, errors: validation.errors };
  }
  const existing = safeBoard.submissions[safeId];
  const nextBoard = {
    version: safeBoard.version,
    submissions: {
      ...safeBoard.submissions,
      [safeId]: {
        ...existing,
        clubId: validation.value.clubId,
        category: validation.value.category,
        headline: validation.value.headline,
        explanation: validation.value.explanation,
        claim: validation.value.claim,
        period: validation.value.period,
        sourceName: validation.value.sourceName,
        sourceUrl: validation.value.sourceUrl,
        updatedAt: now,
      },
    },
  };
  return { outcome: 'updated', board: nextBoard, errors: [] };
}

/**
 * Map an approved submission to the site's roast schema. Returns null when the
 * submission is not approved or has no verifiedOn date.
 * @param {Record<string, unknown>} submission
 * @returns {Record<string, unknown> | null}
 */
export function toRoastSchema(submission) {
  if (!submission || typeof submission !== 'object') return null;
  if (submission.status !== 'approved') return null;
  const verifiedOn =
    typeof submission.verifiedOn === 'string' && submission.verifiedOn.length > 0
      ? submission.verifiedOn
      : '';
  if (verifiedOn.length === 0) return null;
  return {
    id: submission.id,
    clubId: submission.clubId,
    category: submission.category,
    headline: submission.headline,
    explanation: submission.explanation,
    evidence: [
      {
        claim: submission.claim,
        period: submission.period,
        sourceName: submission.sourceName,
        sourceUrl: submission.sourceUrl,
        accessedOn: verifiedOn,
      },
    ],
    verified: true,
    verifiedOn,
    tags: ['fan'],
  };
}

/**
 * Build the public roast view. Approved submissions only, mapped to the roast
 * schema. Never includes pending or rejected items or timestamps beyond
 * verifiedOn.
 * @param {unknown} board
 * @param {string} clubId
 * @returns {{ roasts: Array<Record<string, unknown>> }}
 */
export function publicRoastsView(board, clubId) {
  const safe = normaliseRoastBoard(board);
  const safeClub = typeof clubId === 'string' ? clubId : '';
  if (safeClub.length === 0) return { roasts: [] };
  const roasts = [];
  for (const entry of Object.values(safe.submissions)) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.status !== 'approved') continue;
    if (entry.clubId !== safeClub) continue;
    const roast = toRoastSchema(entry);
    if (roast) roasts.push(roast);
  }
  return { roasts };
}

/**
 * Build the admin roast view. Every submission, pending first, then newest
 * first by createdAt.
 * @param {unknown} board
 * @returns {{ submissions: Array<Record<string, string>> }}
 */
export function adminRoastsView(board) {
  const safe = normaliseRoastBoard(board);
  const submissions = Object.values(safe.submissions)
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      id: String(entry.id || ''),
      clubId: String(entry.clubId || ''),
      category: String(entry.category || ''),
      headline: String(entry.headline || ''),
      explanation: String(entry.explanation || ''),
      claim: String(entry.claim || ''),
      period: String(entry.period || ''),
      sourceName: String(entry.sourceName || ''),
      sourceUrl: String(entry.sourceUrl || ''),
      status: String(entry.status || ''),
      createdAt: String(entry.createdAt || ''),
      updatedAt: String(entry.updatedAt || ''),
      verifiedOn: String(entry.verifiedOn || ''),
    }));
  submissions.sort((a, b) => {
    const rankA = a.status === 'pending' ? 0 : 1;
    const rankB = b.status === 'pending' ? 0 : 1;
    if (rankA !== rankB) return rankA - rankB;
    if (a.createdAt > b.createdAt) return -1;
    if (a.createdAt < b.createdAt) return 1;
    return a.id.localeCompare(b.id);
  });
  return { submissions };
}