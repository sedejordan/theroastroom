/**
 * Builds the suggestion section on the landing page.
 * Renders the form, the leaderboard and the status line. Remembers voted
 * slugs in localStorage so a reload keeps the Voted state. When
 * SUGGEST_API_BASE is empty, does nothing: the section stays hidden and no
 * network calls are made.
 */

import { SUGGEST_API_BASE } from './suggestConfig.js';
import { fetchSuggestions, submitSuggestion, submitVote } from './suggestClient.js';
import { clear, createElement } from '../utils/dom.js';

const VOTED_STORAGE_KEY = 'roastroom_voted';

/**
 * Read the voted slugs from localStorage. Always inside try and catch.
 * @returns {string[]}
 */
function readVotedSlugs() {
  try {
    const raw = window.localStorage.getItem(VOTED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Write the voted slugs to localStorage. Always inside try and catch.
 * @param {string[]} slugs
 * @returns {void}
 */
function writeVotedSlugs(slugs) {
  try {
    window.localStorage.setItem(VOTED_STORAGE_KEY, JSON.stringify(slugs));
  } catch {
    // localStorage is best effort only.
  }
}

/**
 * Initialise the suggestion section. Does nothing when SUGGEST_API_BASE is
 * empty. Safe to call on any page.
 * @returns {void}
 */
export function initSuggestSection() {
  if (!SUGGEST_API_BASE) return;

  const section = document.getElementById('suggestSection');
  if (!section) return;

  section.classList.remove('hidden');

  const formEl = document.getElementById('suggestForm');
  const inputEl = document.getElementById('suggestName');
  const honeypotEl = document.getElementById('suggestWebsite');
  const submitButton = document.getElementById('suggestSubmit');
  const statusEl = document.getElementById('suggestStatus');
  const boardEl = document.getElementById('suggestBoard');
  const loadingEl = document.getElementById('suggestLoading');
  const emptyEl = document.getElementById('suggestEmpty');
  const errorEl = document.getElementById('suggestError');

  let votedSlugs = readVotedSlugs();

  /**
   * Set the live status message.
   * @param {string} message
   * @returns {void}
   */
  function setStatus(message) {
    if (statusEl) statusEl.textContent = message || '';
  }

  /**
   * Show the loading state.
   * @returns {void}
   */
  function showLoading() {
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');
    if (errorEl) errorEl.classList.add('hidden');
    if (boardEl) clear(boardEl);
  }

  /**
   * Show the empty state.
   * @returns {void}
   */
  function showEmpty() {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (emptyEl) emptyEl.classList.remove('hidden');
    if (errorEl) errorEl.classList.add('hidden');
    if (boardEl) clear(boardEl);
  }

  /**
   * Show the error state.
   * @returns {void}
   */
  function showError() {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');
    if (errorEl) errorEl.classList.remove('hidden');
    if (boardEl) clear(boardEl);
  }

  /**
   * Render one row.
   * @param {{ slug: string, name: string, votes: number }} suggestion
   * @returns {HTMLLIElement}
   */
  function renderRow(suggestion) {
    const row = createElement('li', {
      className:
        'flex flex-wrap items-center gap-3 rounded-sharp border border-line bg-surface p-4',
    });
    const name = createElement('p', {
      className: 'font-display text-lg uppercase text-text',
      text: suggestion.name,
    });
    const votes = createElement('p', {
      className: 'text-sm text-textMuted',
      text: suggestion.votes === 1 ? '1 vote' : `${suggestion.votes} votes`,
    });

    const alreadyVoted = votedSlugs.includes(suggestion.slug);
    const voteButton = createElement('button', {
      className:
        'rounded-sharp border-2 border-primary bg-primary px-4 py-2 font-display text-base uppercase tracking-wide text-primaryContrast transition-colors duration-fast ease-standard hover:bg-accent hover:text-background disabled:opacity-60',
      text: alreadyVoted ? 'Voted' : 'Vote',
      attrs: {
        type: 'button',
        'aria-label': alreadyVoted
          ? `Voted for ${suggestion.name}`
          : `Vote for ${suggestion.name}`,
      },
    });

    if (alreadyVoted) {
      voteButton.disabled = true;
    } else {
      voteButton.addEventListener('click', async () => {
        voteButton.disabled = true;
        const result = await submitVote(suggestion.slug);
        if (result.ok) {
          votedSlugs = votedSlugs.concat(suggestion.slug);
          writeVotedSlugs(votedSlugs);
          voteButton.textContent = 'Voted';
          voteButton.setAttribute('aria-label', `Voted for ${suggestion.name}`);
          setStatus(result.message || 'Your vote was added.');
          await load();
        } else {
          voteButton.disabled = false;
          setStatus(result.message || 'Suggestions are unavailable right now.');
        }
      });
    }

    row.append(name, votes, voteButton);
    return row;
  }

  /**
   * Load the leaderboard.
   * @returns {Promise<void>}
   */
  async function load() {
    showLoading();
    const result = await fetchSuggestions();
    if (!result.ok) {
      showError();
      return;
    }
    if (result.suggestions.length === 0) {
      showEmpty();
      return;
    }
    if (loadingEl) loadingEl.classList.add('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');
    if (errorEl) errorEl.classList.add('hidden');
    if (boardEl) {
      clear(boardEl);
      for (const suggestion of result.suggestions) {
        boardEl.append(renderRow(suggestion));
      }
    }
  }

  if (formEl) {
    formEl.addEventListener('submit', async (event) => {
      event.preventDefault();

      // Honeypot: pretend success and send nothing.
      const honeypotValue =
        honeypotEl && typeof honeypotEl.value === 'string' ? honeypotEl.value : '';
      if (honeypotValue.trim().length > 0) {
        if (inputEl) inputEl.value = '';
        setStatus('Thanks, your suggestion will appear after review.');
        return;
      }

      if (submitButton) submitButton.disabled = true;
      setStatus('');

      const name = inputEl ? inputEl.value : '';
      const result = await submitSuggestion(name, '');

      if (submitButton) submitButton.disabled = false;

      if (!result.ok) {
        setStatus(result.message || 'Suggestions are unavailable right now.');
        return;
      }

      setStatus(result.message || 'Thanks, your suggestion will appear after review.');
      if (inputEl) inputEl.value = '';
      await load();
    });
  }

  load();
}