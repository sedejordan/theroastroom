/**
 * Logic for the developer only suggestions admin page.
 * The admin token lives in memory only and is never stored or logged.
 * Every network call is wrapped with an 8 second timeout and returns a
 * friendly result. Never throws.
 */

import { SUGGEST_API_BASE } from '../suggest/suggestConfig.js';

const formEl = document.getElementById('adminForm');
const tokenEl = document.getElementById('adminToken');
const statusEl = document.getElementById('adminStatus');
const bodyEl = document.getElementById('adminBody');

let adminToken = '';

/**
 * Set the live status message.
 * @param {string} message
 * @returns {void}
 */
function setStatus(message) {
  if (statusEl) statusEl.textContent = message || '';
}

/**
 * Fetch a Worker admin endpoint with a bearer token and an 8 second timeout.
 * @param {string} path
 * @param {RequestInit} options
 * @returns {Promise<{ ok: boolean, response: Response | null }>}
 */
async function adminFetch(path, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${SUGGEST_API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options && options.headers ? options.headers : {}),
        Authorization: `Bearer ${adminToken}`,
      },
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
 * Load every suggestion from the Worker.
 * @returns {Promise<void>}
 */
async function loadSuggestions() {
  setStatus('Loading.');
  const result = await adminFetch('/api/admin/suggestions', { method: 'GET' });
  if (!result.ok || !result.response || !result.response.ok) {
    setStatus('Could not load. Check the token and try again.');
    return;
  }
  let data = null;
  try {
    data = await result.response.json();
  } catch {
    data = null;
  }
  if (!data || !Array.isArray(data.suggestions)) {
    setStatus('Could not load. The response was not what we expected.');
    return;
  }
  renderTable(data.suggestions);
  setStatus(`${data.suggestions.length} suggestions loaded.`);
}

/**
 * Approve or hide one suggestion.
 * @param {string} slug
 * @param {boolean} approved
 * @returns {Promise<void>}
 */
async function setApproved(slug, approved) {
  const result = await adminFetch('/api/admin/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, approved }),
  });
  if (!result.ok || !result.response || !result.response.ok) {
    setStatus('Could not update that suggestion.');
    return;
  }
  await loadSuggestions();
  setStatus(approved ? 'Approved.' : 'Hidden.');
}

/**
 * Remove one suggestion.
 * @param {string} slug
 * @returns {Promise<void>}
 */
async function removeSuggestion(slug) {
  const result = await adminFetch('/api/admin/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug }),
  });
  if (!result.ok || !result.response || !result.response.ok) {
    setStatus('Could not remove that suggestion.');
    return;
  }
  await loadSuggestions();
  setStatus('Removed.');
}

/**
 * Render the suggestion table.
 * @param {Array<{
 *   slug: string, name: string, votes: number, approved: boolean,
 *   createdAt: string, updatedAt: string
 * }>} suggestions
 * @returns {void}
 */
function renderTable(suggestions) {
  if (!bodyEl) return;
  bodyEl.textContent = '';

  for (const suggestion of suggestions) {
    const row = document.createElement('tr');

    const cell = (value) => {
      const td = document.createElement('td');
      td.className = 'border border-line p-2 text-sm';
      td.textContent = value;
      return td;
    };

    row.append(
      cell(suggestion.name),
      cell(suggestion.slug),
      cell(String(suggestion.votes)),
      cell(suggestion.approved ? 'Yes' : 'No'),
      cell(suggestion.createdAt),
      cell(suggestion.updatedAt)
    );

    const actions = document.createElement('td');
    actions.className = 'border border-line p-2';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.textContent = suggestion.approved ? 'Hide' : 'Approve';
    toggle.className =
      'mr-2 rounded-sharp border border-primary bg-primary px-2 py-1 text-xs text-primaryContrast';
    toggle.addEventListener('click', () => {
      setApproved(suggestion.slug, !suggestion.approved);
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.className = 'rounded-sharp border border-line bg-surface px-2 py-1 text-xs text-text';
    remove.addEventListener('click', () => {
      if (window.confirm(`Remove ${suggestion.name}?`)) {
        removeSuggestion(suggestion.slug);
      }
    });

    actions.append(toggle, remove);
    row.append(actions);
    bodyEl.append(row);
  }
}

if (formEl) {
  formEl.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!SUGGEST_API_BASE) {
      setStatus('SUGGEST_API_BASE is empty. Set it to the deployed Worker URL first.');
      return;
    }
    adminToken = tokenEl && typeof tokenEl.value === 'string' ? tokenEl.value : '';
    if (!adminToken) {
      setStatus('Enter the admin token first.');
      return;
    }
    loadSuggestions();
  });
}