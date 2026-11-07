/**
 * Network client for the suggestions Worker.
 * Every call is wrapped with an 8 second timeout and returns a friendly
 * result. Never throws. Never logs secrets, tokens or IP addresses.
 */

import { SUGGEST_API_BASE } from './suggestConfig.js';

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
 * Load the public leaderboard from the Worker.
 * @returns {Promise<{
 *   ok: boolean,
 *   suggestions: Array<{ slug: string, name: string, votes: number }>
 * }>}
 */
export async function fetchSuggestions() {
  if (!SUGGEST_API_BASE) return { ok: false, suggestions: [] };
  const result = await fetchWithTimeout('/api/suggestions', { method: 'GET', cache: 'reload' });
  if (!result.ok || !result.response.ok) return { ok: false, suggestions: [] };
  const data = await readJson(result.response);
  if (!data || !Array.isArray(data.suggestions)) {
    return { ok: false, suggestions: [] };
  }
  return { ok: true, suggestions: data.suggestions };
}

/**
 * Submit a suggestion. The website field is the honeypot; the UI already
 * short circuits a filled honeypot, and the Worker does the same.
 * @param {string} name
 * @param {string} website
 * @returns {Promise<{ ok: boolean, status: string, message: string }>}
 */
export async function submitSuggestion(name, website) {
  if (!SUGGEST_API_BASE) return { ok: false, status: '', message: '' };
  const result = await fetchWithTimeout('/api/suggestions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, website: website || '' }),
  });
  if (!result.ok || !result.response) {
    return { ok: false, status: '', message: 'Suggestions are unavailable right now.' };
  }
  const data = await readJson(result.response);
  if (!result.response.ok || !data || typeof data !== 'object') {
    const message = data && typeof data.message === 'string' ? data.message : 'Suggestions are unavailable right now.';
    return { ok: false, status: '', message };
  }
  return {
    ok: true,
    status: typeof data.status === 'string' ? data.status : '',
    message: typeof data.message === 'string' ? data.message : '',
  };
}

/**
 * Vote for an approved suggestion.
 * @param {string} slug
 * @returns {Promise<{ ok: boolean, status: string, message: string }>}
 */
export async function submitVote(slug) {
  if (!SUGGEST_API_BASE) return { ok: false, status: '', message: '' };
  const result = await fetchWithTimeout('/api/votes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug }),
  });
  if (!result.ok || !result.response) {
    return { ok: false, status: '', message: 'Suggestions are unavailable right now.' };
  }
  const data = await readJson(result.response);
  if (!result.response.ok || !data || typeof data !== 'object') {
    const message = data && typeof data.message === 'string' ? data.message : 'Suggestions are unavailable right now.';
    return { ok: false, status: '', message };
  }
  return {
    ok: true,
    status: typeof data.status === 'string' ? data.status : '',
    message: typeof data.message === 'string' ? data.message : '',
  };
}