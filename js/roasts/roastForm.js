/**
 * Builds the fan roast submission form on the room page.
 * The form stays hidden and makes no network calls when SUGGEST_API_BASE is
 * empty. All submitted text is rendered with textContent or safe DOM APIs.
 */

import { submitRoast } from './roastClient.js';
import { SUGGEST_API_BASE } from '../suggest/suggestConfig.js';
import { validateEvidence } from '../schema.js';
import { LIMITS } from '../config.js';
import { clear, createElement } from '../utils/dom.js';

const CLAIM_MAX_LENGTH = 300;
const SOURCE_NAME_MIN_LENGTH = 2;
const SOURCE_NAME_MAX_LENGTH = 80;
const SOURCE_URL_MAX_LENGTH = 300;

/**
 * Return the current UTC date as YYYY/MM/DD. Used only to build a temp
 * evidence item for validateEvidence.
 * @returns {string}
 */
function todayDateString() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

/**
 * True for a season such as 2013/14 or a real calendar date.
 * @param {string} value
 * @returns {boolean}
 */
function isValidPeriod(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (/^\d{4}\/\d{2}$/.test(value)) return true;
  const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(value);
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
 * True for a public https URL with a dotted hostname, no credentials and no IP.
 * @param {string} value
 * @returns {boolean}
 */
function isPublicHttpsUrl(value) {
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
  if (host === 'localhost') return false;
  if (host.startsWith('[') && host.endsWith(']')) return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;
  if (!host.includes('.')) return false;
  return true;
}

/**
 * Build one text field with an optional character counter and an inline error
 * message.
 * @param {{
 *   id: string,
 *   name: string,
 *   label: string,
 *   helpText?: string,
 *   maxLength?: number,
 *   minLength?: number,
 *   multiline?: boolean,
 *   type?: string
 * }} options
 * @returns {{
 *   group: HTMLElement,
 *   input: HTMLInputElement | HTMLTextAreaElement,
 *   countSpan: HTMLElement | null,
 *   errorEl: HTMLElement
 * }}
 */
function buildTextField(options) {
  const { id, name, label, helpText, maxLength, minLength, multiline, type } = options;

  const group = createElement('div');
  group.append(
    createElement('label', { className: 'tokenLabel block', text: label, attrs: { for: id } })
  );
  if (helpText) {
    group.append(createElement('p', { className: 'mt-1 text-xs text-textMuted', text: helpText }));
  }

  const inputAttrs = { id, name };
  if (multiline) {
    inputAttrs.rows = '3';
  } else {
    inputAttrs.type = type || 'text';
  }
  if (Number.isFinite(maxLength) && maxLength > 0) {
    inputAttrs.maxlength = String(maxLength);
  }
  if (Number.isFinite(minLength) && minLength > 0) {
    inputAttrs.minlength = String(minLength);
  }

  const input = createElement(multiline ? 'textarea' : 'input', {
    className:
      'mt-1 w-full rounded-sharp border border-line bg-surface px-3 py-2 text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
    attrs: inputAttrs,
  });
  group.append(input);

  let countSpan = null;
  if (Number.isFinite(maxLength) && maxLength > 0) {
    const counter = createElement('p', {
      className: 'mt-1 text-xs text-textMuted',
      attrs: { 'aria-live': 'polite' },
    });
    countSpan = createElement('span', { text: '0' });
    counter.append(countSpan, ` / ${maxLength}`);
    group.append(counter);
  }

  const errorEl = createElement('p', {
    className: 'mt-1 text-sm text-accent hidden',
    attrs: { 'data-error-for': id, role: 'alert' },
  });
  group.append(errorEl);

  return { group, input, countSpan, errorEl };
}

/**
 * Wire an input's value length to a character counter.
 * @param {HTMLElement} input
 * @param {HTMLElement | null} countSpan
 * @returns {void}
 */
function wireCounter(input, countSpan) {
  if (!input || !countSpan) return;
  const update = () => {
    const value = input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement
      ? input.value
      : '';
    countSpan.textContent = String(value.length);
  };
  input.addEventListener('input', update);
  update();
}

/**
 * Validate the submission fields locally before sending. Returns field specific
 * messages so the form can highlight individual inputs.
 * @param {{
 *   category: string,
 *   headline: string,
 *   explanation: string,
 *   claim: string,
 *   period: string,
 *   sourceName: string,
 *   sourceUrl: string
 * }} fields
 * @param {Array<Record<string, unknown>>} categories
 * @returns {Array<{ field: string, message: string }>}
 */
function validateLocal(fields, categories) {
  const errors = [];

  const categoryIds = categories
    .map((category) => (category && typeof category.id === 'string' ? category.id : ''))
    .filter((id) => id.length > 0);
  if (!fields.category || !categoryIds.includes(fields.category)) {
    errors.push({ field: 'roastCategory', message: 'Pick a category.' });
  }

  const headline = fields.headline.trim();
  if (headline.length === 0) {
    errors.push({ field: 'roastHeadline', message: 'Add the joke.' });
  } else if (headline.length > LIMITS.headlineMaxLength) {
    errors.push({
      field: 'roastHeadline',
      message: `The joke must be ${LIMITS.headlineMaxLength} characters or fewer.`,
    });
  }

  const explanation = fields.explanation.trim();
  if (explanation.length === 0) {
    errors.push({ field: 'roastExplanation', message: 'Add the facts.' });
  } else if (explanation.length > LIMITS.explanationMaxLength) {
    errors.push({
      field: 'roastExplanation',
      message: `The facts must be ${LIMITS.explanationMaxLength} characters or fewer.`,
    });
  }

  const claim = fields.claim.trim();
  if (claim.length === 0) {
    errors.push({ field: 'roastClaim', message: 'Add the claim.' });
  } else if (claim.length > CLAIM_MAX_LENGTH) {
    errors.push({
      field: 'roastClaim',
      message: `The claim must be ${CLAIM_MAX_LENGTH} characters or fewer.`,
    });
  }

  if (!isValidPeriod(fields.period.trim())) {
    errors.push({
      field: 'roastPeriod',
      message: 'Use a season like 2013/14 or a real date like 2021/09/11.',
    });
  }

  const sourceName = fields.sourceName.trim();
  if (sourceName.length < SOURCE_NAME_MIN_LENGTH) {
    errors.push({
      field: 'roastSourceName',
      message: `The source name must be at least ${SOURCE_NAME_MIN_LENGTH} characters.`,
    });
  } else if (sourceName.length > SOURCE_NAME_MAX_LENGTH) {
    errors.push({
      field: 'roastSourceName',
      message: `The source name must be ${SOURCE_NAME_MAX_LENGTH} characters or fewer.`,
    });
  }

  if (!isPublicHttpsUrl(fields.sourceUrl.trim())) {
    errors.push({
      field: 'roastSourceUrl',
      message: 'Use a public https link to the source.',
    });
  }

  if (errors.length > 0) return errors;

  // Last line of defence: reuse the site's evidence validator.
  const evidenceCheck = validateEvidence([
    {
      claim: fields.claim.trim(),
      period: fields.period.trim(),
      sourceName: fields.sourceName.trim(),
      sourceUrl: fields.sourceUrl.trim(),
      accessedOn: todayDateString(),
    },
  ]);
  if (!evidenceCheck.valid) {
    errors.push({
      field: 'roastClaim',
      message: 'The claim, period or source could not be validated.',
    });
  }

  return errors;
}

/**
 * Create the fan roast submission form. Does nothing when SUGGEST_API_BASE is
 * empty. Safe to call on any page and never throws.
 * @param {{
 *   section: HTMLElement,
 *   container: HTMLElement,
 *   clubId: string,
 *   categories: Array<Record<string, unknown>>
 * }} options
 * @returns {void}
 */
export function createRoastForm(options) {
  if (!SUGGEST_API_BASE) return;
  const section = options && options.section;
  const container = options && options.container;
  const clubId = options && typeof options.clubId === 'string' ? options.clubId : '';
  const categories =
    options && Array.isArray(options.categories) ? options.categories : [];
  if (!section || !container || clubId.length === 0 || categories.length === 0) return;

  section.classList.remove('hidden');
  clear(container);

  const form = createElement('form', {
    className: 'space-y-4',
    attrs: { novalidate: 'novalidate' },
  });

  // Category
  const categoryId = 'roastCategory';
  const categoryGroup = createElement('div');
  categoryGroup.append(
    createElement('label', {
      className: 'tokenLabel block',
      text: 'Category',
      attrs: { for: categoryId },
    })
  );
  const categorySelect = createElement('select', {
    className:
      'mt-1 w-full rounded-sharp border border-line bg-surface px-3 py-2 text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
    attrs: { id: categoryId, name: 'category', required: 'required' },
  });
  for (const category of categories) {
    if (!category || typeof category.id !== 'string') continue;
    categorySelect.append(
      createElement('option', {
        text: category.displayLabel || category.id,
        attrs: { value: category.id },
      })
    );
  }
  categoryGroup.append(categorySelect);

  const headline = buildTextField({
    id: 'roastHeadline',
    name: 'headline',
    label: 'The joke',
    helpText: 'The one liner. Keep it about the club and its results.',
    maxLength: LIMITS.headlineMaxLength,
  });

  const explanation = buildTextField({
    id: 'roastExplanation',
    name: 'explanation',
    label: 'The facts',
    helpText: 'A short, factual context that explains the joke.',
    maxLength: LIMITS.explanationMaxLength,
    multiline: true,
  });

  const claim = buildTextField({
    id: 'roastClaim',
    name: 'claim',
    label: 'The claim',
    helpText: 'One precise statement your source actually supports.',
    maxLength: CLAIM_MAX_LENGTH,
    multiline: true,
  });

  const period = buildTextField({
    id: 'roastPeriod',
    name: 'period',
    label: 'Period',
    helpText: 'A season like 2013/14 or a real date like 2021/09/11.',
  });

  const sourceName = buildTextField({
    id: 'roastSourceName',
    name: 'sourceName',
    label: 'Source name',
    helpText: 'For example BBC Sport.',
    maxLength: SOURCE_NAME_MAX_LENGTH,
    minLength: SOURCE_NAME_MIN_LENGTH,
  });

  const sourceUrl = buildTextField({
    id: 'roastSourceUrl',
    name: 'sourceUrl',
    label: 'Source link',
    helpText: 'A public https link to the page that proves the claim.',
    maxLength: SOURCE_URL_MAX_LENGTH,
    type: 'url',
  });

  // Honeypot
  const honeypot = createElement('div', {
    attrs: {
      'aria-hidden': 'true',
      style: 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden',
    },
  });
  honeypot.append(
    createElement('label', { text: 'Website', attrs: { for: 'roastWebsite' } }),
    createElement('input', {
      attrs: {
        id: 'roastWebsite',
        name: 'website',
        type: 'text',
        tabindex: '-1',
        autocomplete: 'off',
      },
    })
  );

  const submitButton = createElement('button', {
    className:
      'rounded-sharp bg-primary px-6 py-3 font-display text-lg uppercase tracking-wide text-primaryContrast transition-colors duration-fast ease-standard hover:bg-accent hover:text-background disabled:opacity-60',
    text: 'Submit roast',
    attrs: { type: 'submit' },
  });

  const status = createElement('p', {
    className: 'mt-3 text-sm text-accent',
    attrs: { role: 'status', 'aria-live': 'polite' },
  });

  form.append(
    categoryGroup,
    headline.group,
    explanation.group,
    claim.group,
    period.group,
    sourceName.group,
    sourceUrl.group,
    honeypot,
    submitButton,
    status
  );

  container.append(form);

  wireCounter(headline.input, headline.countSpan);
  wireCounter(explanation.input, explanation.countSpan);
  wireCounter(claim.input, claim.countSpan);
  wireCounter(sourceName.input, sourceName.countSpan);

  /**
   * Remove every field error.
   * @returns {void}
   */
  function clearErrors() {
    for (const node of form.querySelectorAll('[data-error-for]')) {
      node.textContent = '';
      node.classList.add('hidden');
    }
  }

  /**
   * Show one field error.
   * @param {string} fieldId
   * @param {string} message
   * @returns {void}
   */
  function showError(fieldId, message) {
    const el = form.querySelector(`[data-error-for="${fieldId}"]`);
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const honeypotInput = honeypot.querySelector('input');
    if (honeypotInput && typeof honeypotInput.value === 'string' && honeypotInput.value.trim().length > 0) {
      status.textContent = 'Thanks, your roast will appear after review.';
      return;
    }

    clearErrors();

    const fields = {
      category: categorySelect.value,
      headline: headline.input.value,
      explanation: explanation.input.value,
      claim: claim.input.value,
      period: period.input.value,
      sourceName: sourceName.input.value,
      sourceUrl: sourceUrl.input.value,
    };

    const localErrors = validateLocal(fields, categories);
    if (localErrors.length > 0) {
      for (const error of localErrors) showError(error.field, error.message);
      status.textContent = 'Check the highlighted fields.';
      return;
    }

    submitButton.disabled = true;
    status.textContent = 'Sending.';

    const result = await submitRoast({ clubId, ...fields, website: '' });

    submitButton.disabled = false;

    if (result.ok) {
      status.textContent = result.message || 'Thanks, your roast will appear after review.';
      form.reset();
      for (const counter of [
        headline.countSpan,
        explanation.countSpan,
        claim.countSpan,
        sourceName.countSpan,
      ]) {
        if (counter) counter.textContent = '0';
      }
    } else {
      status.textContent = result.message || 'We could not send that. Try again in a moment.';
    }
  });
}