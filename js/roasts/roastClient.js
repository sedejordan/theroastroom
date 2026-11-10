/**
 * Network client for roast submissions. Every call has an 8 second timeout and
 * returns a friendly result. Never throws. Never logs tokens, salts or
 * submitted text.
 */

import { SUGGEST_API_BASE } from '../suggest/suggestConfig.js';

const REQUEST_TIMEOUT_MS = 8000;

/**
 * Read a response body as JSON without throwing.
 * @param {Response} response
 * @returns {Promise<unknown>}
 */
async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Fetch with an 8 second timeout. Returns a friendly result on any failure.
 * @param {string} path
 * @param {RequestInit} options
 * @returns {Promise<{ ok: boolean, response: Response | null }>}
 */
async function fetchWithTimeout(path, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${SUGGEST_API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
    });
    return { ok: true, response };
  } catch {
    return { ok: false, response: null };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Submit a fan roast to the Worker.
 * @param {{
 *   clubId: string,
 *   category: string,
 *   headline: string,
 *   explanation: string,
 *   claim: string,
 *   period: string,
 *   sourceName: string,
 *   sourceUrl: string,
 *   website?: string
 * }} fields
 * @returns {Promise<{ ok: boolean, status: string, message: string }>}
 */
export async function submitRoast(fields) {
  if (!SUGGEST_API_BASE) return { ok: false, status: '', message: '' };
  const result = await fetchWithTimeout('/api/roast_submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields || {}),
  });
  if (!result.ok || !result.response) {
    return {
      ok: false,
      status: '',
      message: 'We could not send that. Try again in a moment.',
    };
  }
  const data = await readJson(result.response);
  if (!result.response.ok || !data || typeof data !== 'object') {
    const message =
      data && typeof data.message === 'string'
        ? data.message
        : 'We could not send that. Try again in a moment.';
    return { ok: false, status: '', message };
  }
  return {
    ok: true,
    status: typeof data.status === 'string' ? data.status : 'pending',
    message:
      typeof data.message === 'string'
        ? data.message
        : 'Thanks, your roast will appear after review.',
  };
}

/**
 * Load approved fan roasts for one club.
 * @param {string} clubId
 * @returns {Promise<{ ok: boolean, roasts: Array<Record<string, unknown>> }>}
 */
export async function fetchApprovedRoasts(clubId) {
  if (!SUGGEST_API_BASE) return { ok: false, roasts: [] };
  const path = `/api/roasts?club=${encodeURIComponent(String(clubId || ''))}`;
  const result = await fetchWithTimeout(path, { method: 'GET', cache: 'reload' });
  if (!result.ok || !result.response || !result.response.ok) {
    return { ok: false, roasts: [] };
  }
  const data = await readJson(result.response);
  if (!data || !Array.isArray(data.roasts)) {
    return { ok: false, roasts: [] };
  }
  return { ok: true, roasts: data.roasts };
}