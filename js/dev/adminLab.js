/**
 * Logic for the developer only suggestions admin page.
 * The admin token lives in memory only and is never stored or logged.
 * Every network call is wrapped with an 8 second timeout and returns a
 * friendly result. Never throws.
 */

import { SUGGEST_API_BASE } from '../suggest/suggestConfig.js';
import { clear, createElement } from '../utils/dom.js';

const formEl = document.getElementById('adminForm');
const tokenEl = document.getElementById('adminToken');
const statusEl = document.getElementById('adminStatus');
const bodyEl = document.getElementById('adminBody');
const roastBodyEl = document.getElementById('roastAdminBody');
const roastStatusEl = document.getElementById('roastAdminStatus');
const roastPendingCountEl = document.getElementById('roastPendingCount');

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

/**
 * Set the live status message for the roast panel.
 * @param {string} message
 * @returns {void}
 */
function setRoastStatus(message) {
  if (roastStatusEl) roastStatusEl.textContent = message || '';
}

/**
 * Build one editable roast submission item.
 * @param {Record<string, string>} submission
 * @returns {HTMLElement}
 */
function buildRoastItem(submission) {
  const wrap = createElement('article', {
    className: 'mt-4 rounded-sharp border border-line bg-surfaceRaised p-4',
  });

  const heading = createElement('div', { className: 'flex flex-wrap items-center gap-2' });
  heading.append(
    createElement('p', {
      className: 'font-display text-lg uppercase text-text',
      text: submission.headline || '(no headline)',
    }),
    createElement('span', {
      className:
        'rounded-pill border border-line px-2 py-0.5 text-xs text-textMuted',
      text: submission.status || 'unknown',
    })
  );
  wrap.append(heading);

  /** @type {Record<string, HTMLInputElement | HTMLTextAreaElement>} */
  const fieldInputs = {};
  const fieldDefs = [
    ['clubId', 'Club'],
    ['category', 'Category'],
    ['headline', 'The joke'],
    ['explanation', 'The facts'],
    ['claim', 'The claim'],
    ['period', 'Period'],
    ['sourceName', 'Source name'],
    ['sourceUrl', 'Source link'],
  ];

  for (const [key, label] of fieldDefs) {
    const fieldId = `roastField_${submission.id}_${key}`;
    const group = createElement('div', { className: 'mt-2' });
    group.append(
      createElement('label', {
        className: 'tokenLabel block',
        text: label,
        attrs: { for: fieldId },
      })
    );
    const isMultiline = key === 'explanation' || key === 'claim';
    const input = createElement(isMultiline ? 'textarea' : 'input', {
      className:
        'mt-1 w-full rounded-sharp border border-line bg-surface px-2 py-1 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
      attrs: isMultiline
        ? { id: fieldId, rows: '3' }
        : { id: fieldId, type: 'text' },
    });
    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      input.value = submission[key] || '';
    }
    fieldInputs[key] = input;
    group.append(input);
    wrap.append(group);
  }

  const sourceLinkRow = createElement('p', { className: 'mt-2 text-xs' });
  sourceLinkRow.append(
    createElement('span', { text: 'Open source: ' }),
    createElement('a', {
      className: 'text-accent underline',
      text: submission.sourceUrl || '(none)',
      attrs: {
        href: submission.sourceUrl || '#',
        target: '_blank',
        rel: 'noopener noreferrer nofollow ugc',
      },
    })
  );
  wrap.append(sourceLinkRow);

  wrap.append(
    createElement('p', {
      className: 'mt-2 text-xs text-textMuted',
      text: `Created ${submission.createdAt || ''} · Updated ${submission.updatedAt || ''}`,
    })
  );
  if (submission.verifiedOn) {
    wrap.append(
      createElement('p', {
        className: 'text-xs text-textMuted',
        text: `Verified ${submission.verifiedOn}`,
      })
    );
  }

  const checkboxId = `roastChecked_${submission.id}`;
  const checkboxRow = createElement('div', { className: 'mt-3 flex items-center gap-2' });
  const checkbox = createElement('input', {
    attrs: { id: checkboxId, type: 'checkbox' },
  });
  const checkboxLabel = createElement('label', {
    text: 'I checked the source',
    attrs: { for: checkboxId },
  });
  checkboxRow.append(checkbox, checkboxLabel);
  wrap.append(checkboxRow);

  const actions = createElement('div', { className: 'mt-3 flex flex-wrap gap-2' });
  const saveBtn = createElement('button', {
    className: 'rounded-sharp border border-line bg-surface px-3 py-1 text-sm',
    text: 'Save edits',
    attrs: { type: 'button' },
  });
  const approveBtn = createElement('button', {
    className:
      'rounded-sharp border border-primary bg-primary px-3 py-1 text-sm text-primaryContrast disabled:opacity-60',
    text: 'Approve',
    attrs: { type: 'button' },
  });
  const rejectBtn = createElement('button', {
    className: 'rounded-sharp border border-line bg-surface px-3 py-1 text-sm',
    text: 'Reject',
    attrs: { type: 'button' },
  });
  const removeBtn = createElement('button', {
    className: 'rounded-sharp border border-line bg-surface px-3 py-1 text-sm',
    text: 'Remove',
    attrs: { type: 'button' },
  });

  approveBtn.disabled = true;
  checkbox.addEventListener('change', () => {
    if (checkbox instanceof HTMLInputElement) {
      approveBtn.disabled = !checkbox.checked;
    }
  });

  const localStatus = createElement('p', {
    className: 'mt-2 text-xs text-accent',
    attrs: { role: 'status', 'aria-live': 'polite' },
  });

  /**
   * @param {string} msg
   * @returns {void}
   */
  const setLocalStatus = (msg) => {
    localStatus.textContent = msg || '';
  };

  saveBtn.addEventListener('click', async () => {
    setLocalStatus('Saving.');
    const body = {
      id: submission.id,
      clubId: fieldInputs.clubId ? fieldInputs.clubId.value : '',
      category: fieldInputs.category ? fieldInputs.category.value : '',
      headline: fieldInputs.headline ? fieldInputs.headline.value : '',
      explanation: fieldInputs.explanation ? fieldInputs.explanation.value : '',
      claim: fieldInputs.claim ? fieldInputs.claim.value : '',
      period: fieldInputs.period ? fieldInputs.period.value : '',
      sourceName: fieldInputs.sourceName ? fieldInputs.sourceName.value : '',
      sourceUrl: fieldInputs.sourceUrl ? fieldInputs.sourceUrl.value : '',
    };
    const result = await adminFetch('/api/admin/roast_submissions/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!result.ok || !result.response || !result.response.ok) {
      setLocalStatus('Could not save.');
      return;
    }
    setLocalStatus('Saved.');
    await loadRoastSubmissions();
  });

  approveBtn.addEventListener('click', async () => {
    setLocalStatus('Approving.');
    const result = await adminFetch('/api/admin/roast_submissions/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: submission.id, checkedSource: true }),
    });
    if (!result.ok || !result.response || !result.response.ok) {
      setLocalStatus('Could not approve.');
      return;
    }
    setLocalStatus('Approved.');
    await loadRoastSubmissions();
  });

  rejectBtn.addEventListener('click', async () => {
    setLocalStatus('Rejecting.');
    const result = await adminFetch('/api/admin/roast_submissions/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: submission.id }),
    });
    if (!result.ok || !result.response || !result.response.ok) {
      setLocalStatus('Could not reject.');
      return;
    }
    setLocalStatus('Rejected.');
    await loadRoastSubmissions();
  });

  removeBtn.addEventListener('click', async () => {
    if (!window.confirm(`Remove ${submission.headline || submission.id}?`)) return;
    setLocalStatus('Removing.');
    const result = await adminFetch('/api/admin/roast_submissions/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: submission.id }),
    });
    if (!result.ok || !result.response || !result.response.ok) {
      setLocalStatus('Could not remove.');
      return;
    }
    setLocalStatus('Removed.');
    await loadRoastSubmissions();
  });

  actions.append(saveBtn, approveBtn, rejectBtn, removeBtn);
  wrap.append(actions, localStatus);

  return wrap;
}

/**
 * Load every roast submission from the Worker and render the roast panel.
 * @returns {Promise<void>}
 */
async function loadRoastSubmissions() {
  if (!roastBodyEl) return;
  setRoastStatus('Loading roast submissions.');
  const result = await adminFetch('/api/admin/roast_submissions', { method: 'GET' });
  if (!result.ok || !result.response || !result.response.ok) {
    setRoastStatus('Could not load roast submissions. Check the token and try again.');
    return;
  }
  let data = null;
  try {
    data = await result.response.json();
  } catch {
    data = null;
  }
  if (!data || !Array.isArray(data.submissions)) {
    setRoastStatus('Could not load roast submissions.');
    return;
  }
  clear(roastBodyEl);
  let pending = 0;
  for (const submission of data.submissions) {
    if (submission.status === 'pending') pending += 1;
    roastBodyEl.append(buildRoastItem(submission));
  }
  if (roastPendingCountEl) roastPendingCountEl.textContent = String(pending);
  setRoastStatus(`${data.submissions.length} roast submissions loaded. ${pending} pending.`);
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
    loadRoastSubmissions();
  });
}