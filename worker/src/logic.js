/**
 * Pure logic for The Roast Room suggestions Worker.
 * No Cloudflare APIs, no fetch, no KV. Everything here runs unchanged in the
 * Worker and in the Node test runner.
 */

export const BOARD_KEY = 'board';
export const BOARD_VERSION = 1;
export const MAX_SUGGESTIONS = 300;
export const RATE_LIMIT_ACTIONS_PER_DAY = 6;
export const RATE_LIMIT_TTL_SECONDS = 172800;
export const RATE_LIMIT_HASH_LENGTH = 32;
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 40;
export const BODY_LIMIT_BYTES = 2048;

/**
 * Normalise a raw club name. Trim and collapse runs of whitespace to a single
 * space. Anything that is not a string becomes an empty string.
 * @param {unknown} raw
 * @returns {string}
 */
export function normaliseName(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\s+/g, ' ');
}

/**
 * Validate a club name against the published rules.
 * Allowed characters are letters in any language, digits, spaces, apostrophe,
 * full stop and ampersand. Urls, the at sign and digits only are rejected.
 * @param {unknown} raw
 * @returns {{ valid: boolean, errors: string[], name: string }}
 */
export function validateName(raw) {
  const name = normaliseName(raw);
  const errors = [];

  if (name.length < NAME_MIN_LENGTH) {
    errors.push(`name must be at least ${NAME_MIN_LENGTH} characters`);
  }
  if (name.length > NAME_MAX_LENGTH) {
    errors.push(`name must be ${NAME_MAX_LENGTH} characters or fewer`);
  }

  const lower = name.toLowerCase();
  if (lower.includes('http')) errors.push('name cannot contain a url');
  if (lower.includes('www')) errors.push('name cannot contain a url');
  if (name.includes('@')) errors.push('name cannot contain an at sign');
  if (name.length > 0 && /^[0-9]+$/.test(name)) {
    errors.push('name cannot be digits only');
  }
  if (name.length > 0 && !/^[\p{L}0-9 .'&]+$/u.test(name)) {
    errors.push('name contains disallowed characters');
  }

  return { valid: errors.length === 0, errors, name };
}

/**
 * Slugify a normalised name. Output is lowercase a to z, digits and
 * underscores only. Accented letters are stripped of diacritics first so
 * Atlético becomes atletico. Anything that cannot be turned into a slug
 * becomes an empty string, which the caller treats as a validation error.
 * @param {unknown} name
 * @returns {string}
 */
export function slugify(name) {
  return String(name === undefined || name === null ? '' : name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Read a rate record safely. Missing or malformed records become empty.
 * @param {unknown} record
 * @returns {{ actions: number, voted: string[] }}
 */
export function normaliseRateRecord(record) {
  if (!record || typeof record !== 'object') {
    return { actions: 0, voted: [] };
  }
  const actions = Number.isInteger(record.actions) && record.actions >= 0 ? record.actions : 0;
  const voted = Array.isArray(record.voted)
    ? record.voted.filter((entry) => typeof entry === 'string')
    : [];
  return { actions, voted };
}

/**
 * Read a board safely. Missing or malformed boards become empty boards.
 * @param {unknown} board
 * @returns {{ version: number, suggestions: Record<string, Record<string, unknown>> }}
 */
export function normaliseBoard(board) {
  if (
    !board ||
    typeof board !== 'object' ||
    !board.suggestions ||
    typeof board.suggestions !== 'object' ||
    Array.isArray(board.suggestions)
  ) {
    return { version: BOARD_VERSION, suggestions: {} };
  }
  return { version: BOARD_VERSION, suggestions: board.suggestions };
}

/**
 * Count the suggestions in a board.
 * @param {unknown} board
 * @returns {number}
 */
export function countSuggestions(board) {
  return Object.keys(normaliseBoard(board).suggestions).length;
}

/**
 * Decide whether a client can perform another action today.
 * @param {{ actions: number }} record
 * @returns {{ allowed: boolean, reason: string }}
 */
export function canAct(record) {
  const safe = normaliseRateRecord(record);
  if (safe.actions >= RATE_LIMIT_ACTIONS_PER_DAY) {
    return { allowed: false, reason: 'rateLimited' };
  }
  return { allowed: true, reason: 'ok' };
}

/**
 * Decide whether a client can vote for a slug today.
 * @param {{ voted: string[] }} record
 * @param {string} slug
 * @returns {{ allowed: boolean, reason: string }}
 */
export function canVote(record, slug) {
  const safe = normaliseRateRecord(record);
  if (safe.voted.includes(slug)) {
    return { allowed: false, reason: 'alreadyVoted' };
  }
  return { allowed: true, reason: 'ok' };
}

/**
 * Apply a suggestion. A slug that already exists merges into a vote on the
 * existing record. A brand new slug creates a pending suggestion and counts
 * the submitter as the first vote. Returns the new board and rate record so
 * the caller can perform exactly two KV writes when the outcome is accepted.
 * @param {{
 *   board: unknown,
 *   name: unknown,
 *   rateRecord: unknown,
 *   now: string
 * }} options
 * @returns {{
 *   outcome: 'voted' | 'pending' | 'full' | 'invalid' | 'rateLimited',
 *   board: { version: number, suggestions: Record<string, Record<string, unknown>> },
 *   rateRecord: { actions: number, voted: string[] },
 *   slug: string,
 *   errors: string[]
 * }}
 */
export function applySuggestion(options) {
  const { board, name, rateRecord, now } = options || {};
  const safeBoard = normaliseBoard(board);
  const safeRate = normaliseRateRecord(rateRecord);

  const validation = validateName(name);
  if (!validation.valid) {
    return {
      outcome: 'invalid',
      board: safeBoard,
      rateRecord: safeRate,
      slug: '',
      errors: validation.errors,
    };
  }

  const slug = slugify(validation.name);
  if (!slug) {
    return {
      outcome: 'invalid',
      board: safeBoard,
      rateRecord: safeRate,
      slug: '',
      errors: ['name cannot be turned into a slug'],
    };
  }

  if (!canAct(safeRate).allowed) {
    return {
      outcome: 'rateLimited',
      board: safeBoard,
      rateRecord: safeRate,
      slug,
      errors: ['You have reached the daily limit. Try again tomorrow.'],
    };
  }

  // Vote path: the slug already exists.
  const existing = safeBoard.suggestions[slug];
  if (existing) {
    if (!canVote(safeRate, slug).allowed) {
      return {
        outcome: 'rateLimited',
        board: safeBoard,
        rateRecord: safeRate,
        slug,
        errors: ['You have already voted for this club today.'],
      };
    }
    const nextBoard = {
      version: safeBoard.version,
      suggestions: {
        ...safeBoard.suggestions,
        [slug]: {
          ...existing,
          votes: (Number.isInteger(existing.votes) ? existing.votes : 0) + 1,
          updatedAt: now,
        },
      },
    };
    const nextRate = {
      actions: safeRate.actions + 1,
      voted: safeRate.voted.concat(slug),
    };
    return { outcome: 'voted', board: nextBoard, rateRecord: nextRate, slug, errors: [] };
  }

  // New suggestion path.
  if (countSuggestions(safeBoard) >= MAX_SUGGESTIONS) {
    return {
      outcome: 'full',
      board: safeBoard,
      rateRecord: safeRate,
      slug,
      errors: ['The suggestion list is full right now.'],
    };
  }

  const nextBoard = {
    version: safeBoard.version,
    suggestions: {
      ...safeBoard.suggestions,
      [slug]: {
        name: validation.name,
        votes: 1,
        approved: false,
        createdAt: now,
        updatedAt: now,
      },
    },
  };
  const nextRate = {
    actions: safeRate.actions + 1,
    voted: safeRate.voted.concat(slug),
  };
  return { outcome: 'pending', board: nextBoard, rateRecord: nextRate, slug, errors: [] };
}

/**
 * Apply a vote to an existing approved suggestion.
 * @param {{
 *   board: unknown,
 *   slug: unknown,
 *   rateRecord: unknown,
 *   now: string
 * }} options
 * @returns {{
 *   outcome: 'voted' | 'notFound' | 'notApproved' | 'rateLimited',
 *   board: { version: number, suggestions: Record<string, Record<string, unknown>> },
 *   rateRecord: { actions: number, voted: string[] },
 *   errors: string[]
 * }}
 */
export function applyVote(options) {
  const { board, slug, rateRecord, now } = options || {};
  const safeBoard = normaliseBoard(board);
  const safeRate = normaliseRateRecord(rateRecord);
  const safeSlug = typeof slug === 'string' ? slug : '';

  if (!safeSlug || !safeBoard.suggestions[safeSlug]) {
    return {
      outcome: 'notFound',
      board: safeBoard,
      rateRecord: safeRate,
      errors: ['That suggestion is not available.'],
    };
  }

  const existing = safeBoard.suggestions[safeSlug];
  if (!existing.approved) {
    return {
      outcome: 'notApproved',
      board: safeBoard,
      rateRecord: safeRate,
      errors: ['That suggestion is not approved yet.'],
    };
  }

  if (!canAct(safeRate).allowed) {
    return {
      outcome: 'rateLimited',
      board: safeBoard,
      rateRecord: safeRate,
      errors: ['You have reached the daily limit. Try again tomorrow.'],
    };
  }

  if (!canVote(safeRate, safeSlug).allowed) {
    return {
      outcome: 'rateLimited',
      board: safeBoard,
      rateRecord: safeRate,
      errors: ['You have already voted for this club today.'],
    };
  }

  const nextBoard = {
    version: safeBoard.version,
    suggestions: {
      ...safeBoard.suggestions,
      [safeSlug]: {
        ...existing,
        votes: (Number.isInteger(existing.votes) ? existing.votes : 0) + 1,
        updatedAt: now,
      },
    },
  };
  const nextRate = {
    actions: safeRate.actions + 1,
    voted: safeRate.voted.concat(safeSlug),
  };
  return { outcome: 'voted', board: nextBoard, rateRecord: nextRate, errors: [] };
}

/**
 * Build the public leaderboard. Approved suggestions only, sorted by votes
 * descending then name ascending. Timestamps are stripped.
 * @param {unknown} board
 * @returns {{ suggestions: Array<{ slug: string, name: string, votes: number }> }}
 */
export function publicView(board) {
  const safe = normaliseBoard(board);
  const suggestions = Object.entries(safe.suggestions)
    .filter(([, value]) => value && value.approved === true)
    .map(([slug, value]) => ({
      slug,
      name: String(value.name || ''),
      votes: Number.isInteger(value.votes) ? value.votes : 0,
    }));
  suggestions.sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    return a.name.localeCompare(b.name);
  });
  return { suggestions };
}

/**
 * Build the admin view. Every suggestion with timestamps, sorted by votes
 * descending then name ascending.
 * @param {unknown} board
 * @returns {{ suggestions: Array<{
 *   slug: string, name: string, votes: number, approved: boolean,
 *   createdAt: string, updatedAt: string
 * }> }}
 */
export function adminView(board) {
  const safe = normaliseBoard(board);
  const suggestions = Object.entries(safe.suggestions).map(([slug, value]) => ({
    slug,
    name: String(value.name || ''),
    votes: Number.isInteger(value.votes) ? value.votes : 0,
    approved: value.approved === true,
    createdAt: String(value.createdAt || ''),
    updatedAt: String(value.updatedAt || ''),
  }));
  suggestions.sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    return a.name.localeCompare(b.name);
  });
  return { suggestions };
}

/**
 * Return the origin when it is in the allowed list, otherwise an empty string.
 * Comparison is case sensitive and exact, so trailing slashes matter.
 * @param {string} origin
 * @param {string} allowedList Comma separated list of allowed origins.
 * @returns {string}
 */
export function pickOrigin(origin, allowedList) {
  if (typeof origin !== 'string' || origin.length === 0) return '';
  if (typeof allowedList !== 'string' || allowedList.length === 0) return '';
  const allowed = allowedList
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return allowed.includes(origin) ? origin : '';
}

/**
 * Compare two strings in constant time. Returns false when either is not a
 * string. Differing lengths return false early, which leaks only the length
 * of the admin token, not its content.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function constantTimeEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}