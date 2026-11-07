/**
 * Cloudflare Worker entry point for The Roast Room suggestions API.
 * Routing and KV access only. All decisions live in logic.js.
 */

import {
  BODY_LIMIT_BYTES,
  BOARD_KEY,
  RATE_LIMIT_HASH_LENGTH,
  RATE_LIMIT_TTL_SECONDS,
  adminView,
  applySuggestion,
  applyVote,
  constantTimeEquals,
  normaliseBoard,
  pickOrigin,
  publicView,
} from './logic.js';

/**
 * Build a JSON response with CORS headers only for allowed origins.
 * @param {unknown} body
 * @param {number} status
 * @param {string} origin Allowed origin, or empty string.
 * @param {Record<string, string>} [extraHeaders]
 * @returns {Response}
 */
function jsonResponse(body, status, origin, extraHeaders) {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json; charset=utf-8');
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      headers.set(key, value);
    }
  }
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Build an error response shaped { error, message } with no stack traces.
 * @param {string} code
 * @param {string} message
 * @param {number} status
 * @param {string} origin
 * @returns {Response}
 */
function errorResponse(code, message, status, origin) {
  return jsonResponse({ error: code, message }, status, origin);
}

/**
 * Handle a CORS preflight.
 * @param {Request} request
 * @param {string} allowedOrigins
 * @returns {Response}
 */
function handleOptions(request, allowedOrigins) {
  const origin = pickOrigin(request.headers.get('Origin') || '', allowedOrigins);
  const headers = new Headers();
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Max-Age', '600');
  }
  return new Response(null, { status: 204, headers });
}

/**
 * Hash a client identifier with the salt and truncate to 32 hex characters.
 * @param {string} clientIp
 * @param {string} salt
 * @returns {Promise<string>}
 */
async function hashClient(clientIp, salt) {
  const data = new TextEncoder().encode(`${salt}${clientIp}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex.slice(0, RATE_LIMIT_HASH_LENGTH);
}

/**
 * Build a UTC day string in the YYYYMMDD shape used in the rate key.
 * @param {Date} date
 * @returns {string}
 */
function utcDay(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Read the request body as a JSON object, enforcing the size limit and the
 * content type. The body check uses byte length, not character count.
 * @param {Request} request
 * @returns {Promise<{ ok: true, data: Record<string, unknown> } | { ok: false, error: string, status: number }>}
 */
async function readJsonBody(request) {
  const contentType = (request.headers.get('Content-Type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return { ok: false, error: 'unsupportedMediaType', status: 415 };
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > BODY_LIMIT_BYTES) {
    return { ok: false, error: 'bodyTooLarge', status: 400 };
  }
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, error: 'invalidBody', status: 400 };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'invalidBody', status: 400 };
  }
}

/**
 * Check the admin bearer token against the configured secret in constant time.
 * An unset ADMIN_TOKEN rejects every admin request.
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @returns {boolean}
 */
function checkAdmin(request, env) {
  const configured = env && typeof env.ADMIN_TOKEN === 'string' ? env.ADMIN_TOKEN : '';
  if (configured.length === 0) return false;
  const auth = request.headers.get('Authorization') || '';
  return constantTimeEquals(auth, `Bearer ${configured}`);
}

/**
 * Read the rate record for a request client.
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @returns {Promise<{ key: string, record: unknown }>}
 */
async function readRate(request, env) {
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  const salt = typeof env.HASH_SALT === 'string' ? env.HASH_SALT : '';
  const hash = await hashClient(clientIp, salt);
  const key = `rl:${hash}:${utcDay(new Date())}`;
  const record = await env.SUGGESTIONS.get(key, 'json');
  return { key, record };
}

/**
 * Persist an accepted action. Exactly two writes: rate record then board.
 * @param {Record<string, unknown>} env
 * @param {string} rateKey
 * @param {unknown} rateRecord
 * @param {unknown} board
 * @returns {Promise<void>}
 */
async function persist(env, rateKey, rateRecord, board) {
  await env.SUGGESTIONS.put(rateKey, JSON.stringify(rateRecord), {
    expirationTtl: RATE_LIMIT_TTL_SECONDS,
  });
  await env.SUGGESTIONS.put(BOARD_KEY, JSON.stringify(board));
}

/**
 * GET /api/suggestions.
 * @param {Record<string, unknown>} env
 * @param {string} origin
 * @returns {Promise<Response>}
 */
async function handleListSuggestions(env, origin) {
  const board = await env.SUGGESTIONS.get(BOARD_KEY, 'json');
  return jsonResponse(publicView(board), 200, origin, {
    'Cache-Control': 'public, max-age=30',
  });
}

/**
 * POST /api/suggestions.
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @param {string} origin
 * @returns {Promise<Response>}
 */
async function handlePostSuggestion(request, env, origin) {
  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    return errorResponse(bodyResult.error, 'That request could not be read.', bodyResult.status, origin);
  }
  const { name, website } = bodyResult.data;

  // Honeypot: pretend success and write nothing.
  if (typeof website === 'string' && website.trim().length > 0) {
    return jsonResponse(
      { status: 'pending', message: 'Thanks, your suggestion will appear after review.' },
      200,
      origin
    );
  }

  const { key: rateKey, record: rateRecord } = await readRate(request, env);
  const board = await env.SUGGESTIONS.get(BOARD_KEY, 'json');
  const now = new Date().toISOString();
  const result = applySuggestion({ board, name, rateRecord, now });

  if (result.outcome === 'invalid') {
    return errorResponse('invalidName', result.errors.join('; '), 400, origin);
  }
  if (result.outcome === 'rateLimited') {
    return errorResponse('rateLimited', result.errors.join('; '), 429, origin);
  }
  if (result.outcome === 'full') {
    return jsonResponse(
      {
        status: 'pending',
        message: 'The suggestion list is full right now. Try again later.',
      },
      200,
      origin
    );
  }

  await persist(env, rateKey, result.rateRecord, result.board);

  if (result.outcome === 'voted') {
    return jsonResponse(
      { status: 'voted', message: 'That club is already on the list. Your vote was added.' },
      200,
      origin
    );
  }
  return jsonResponse(
    { status: 'pending', message: 'Thanks, your suggestion will appear after review.' },
    200,
    origin
  );
}

/**
 * POST /api/votes.
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @param {string} origin
 * @returns {Promise<Response>}
 */
async function handlePostVote(request, env, origin) {
  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    return errorResponse(bodyResult.error, 'That request could not be read.', bodyResult.status, origin);
  }
  const { slug } = bodyResult.data;

  const { key: rateKey, record: rateRecord } = await readRate(request, env);
  const board = await env.SUGGESTIONS.get(BOARD_KEY, 'json');
  const now = new Date().toISOString();
  const result = applyVote({ board, slug, rateRecord, now });

  if (result.outcome === 'notFound' || result.outcome === 'notApproved') {
    return errorResponse('notFound', 'That suggestion is not available.', 404, origin);
  }
  if (result.outcome === 'rateLimited') {
    return errorResponse('rateLimited', result.errors.join('; '), 429, origin);
  }

  await persist(env, rateKey, result.rateRecord, result.board);
  return jsonResponse({ status: 'voted', message: 'Your vote was added.' }, 200, origin);
}

/**
 * GET /api/admin/suggestions.
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @param {string} origin
 * @returns {Promise<Response>}
 */
async function handleAdminList(request, env, origin) {
  if (!checkAdmin(request, env)) {
    return errorResponse('unauthorized', 'Not authorized.', 401, origin);
  }
  const board = await env.SUGGESTIONS.get(BOARD_KEY, 'json');
  return jsonResponse(adminView(board), 200, origin);
}

/**
 * POST /api/admin/approve.
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @param {string} origin
 * @returns {Promise<Response>}
 */
async function handleAdminApprove(request, env, origin) {
  if (!checkAdmin(request, env)) {
    return errorResponse('unauthorized', 'Not authorized.', 401, origin);
  }
  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    return errorResponse(bodyResult.error, 'That request could not be read.', bodyResult.status, origin);
  }
  const { slug, approved } = bodyResult.data;
  if (typeof slug !== 'string' || typeof approved !== 'boolean') {
    return errorResponse('invalidBody', 'slug and approved are required.', 400, origin);
  }
  const board = normaliseBoard(await env.SUGGESTIONS.get(BOARD_KEY, 'json'));
  const existing = board.suggestions[slug];
  if (!existing) {
    return errorResponse('notFound', 'That suggestion is not in the board.', 404, origin);
  }
  const next = {
    version: board.version,
    suggestions: {
      ...board.suggestions,
      [slug]: { ...existing, approved, updatedAt: new Date().toISOString() },
    },
  };
  await env.SUGGESTIONS.put(BOARD_KEY, JSON.stringify(next));
  return jsonResponse({ slug, approved }, 200, origin);
}

/**
 * POST /api/admin/remove.
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @param {string} origin
 * @returns {Promise<Response>}
 */
async function handleAdminRemove(request, env, origin) {
  if (!checkAdmin(request, env)) {
    return errorResponse('unauthorized', 'Not authorized.', 401, origin);
  }
  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    return errorResponse(bodyResult.error, 'That request could not be read.', bodyResult.status, origin);
  }
  const { slug } = bodyResult.data;
  if (typeof slug !== 'string') {
    return errorResponse('invalidBody', 'slug is required.', 400, origin);
  }
  const board = normaliseBoard(await env.SUGGESTIONS.get(BOARD_KEY, 'json'));
  if (!board.suggestions[slug]) {
    return errorResponse('notFound', 'That suggestion is not in the board.', 404, origin);
  }
  const next = {
    version: board.version,
    suggestions: { ...board.suggestions },
  };
  delete next.suggestions[slug];
  await env.SUGGESTIONS.put(BOARD_KEY, JSON.stringify(next));
  return jsonResponse({ slug, removed: true }, 200, origin);
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch {
      return errorResponse('serverError', 'Something went wrong. Please try again.', 500, '');
    }
  },
};

async function handleRequest(request, env) {
    const url = new URL(request.url);
    const allowedOrigins = typeof env.ALLOWED_ORIGINS === 'string' ? env.ALLOWED_ORIGINS : '';
    const origin = pickOrigin(request.headers.get('Origin') || '', allowedOrigins);

    if (request.method === 'OPTIONS') {
      return handleOptions(request, allowedOrigins);
    }

    const isPost = request.method === 'POST';
    const hasOriginHeader = request.headers.get('Origin') !== null;
    if (isPost && hasOriginHeader && !origin) {
      return errorResponse('originNotAllowed', 'This origin is not allowed.', 403, '');
    }

    const path = url.pathname;

    if (path === '/api/suggestions' && request.method === 'GET') {
      return handleListSuggestions(env, origin);
    }
    if (path === '/api/suggestions' && request.method === 'POST') {
      return handlePostSuggestion(request, env, origin);
    }
    if (path === '/api/votes' && request.method === 'POST') {
      return handlePostVote(request, env, origin);
    }
    if (path === '/api/admin/suggestions' && request.method === 'GET') {
      return handleAdminList(request, env, origin);
    }
    if (path === '/api/admin/approve' && request.method === 'POST') {
      return handleAdminApprove(request, env, origin);
    }
    if (path === '/api/admin/remove' && request.method === 'POST') {
      return handleAdminRemove(request, env, origin);
    }

    return errorResponse('notFound', 'That route does not exist.', 404, origin);
}