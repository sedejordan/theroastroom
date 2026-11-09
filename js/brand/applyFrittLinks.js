/**
 * Applies Fritt contact and portfolio links to anchors that carry
 * data-fritt-target and data-fritt-placement. Every anchor already has a
 * working static href in the markup, so the page works without JavaScript;
 * this module only adds the campaign parameters.
 */

import { FRITT_URL, FRITT_CONTACT_URL } from './frittConfig.js';
import { frittLink } from './frittLinks.js';

/**
 * Walk the document and rewrite the href of every Fritt link placeholder.
 * Never throws. Safe to call on any page, including pages without any
 * placeholders.
 *
 * @returns {void}
 */
export function applyFrittLinks() {
  if (typeof document === 'undefined') return;

  const elements = document.querySelectorAll('[data-fritt-target]');

  for (const element of elements) {
    if (!(element instanceof HTMLAnchorElement)) continue;

    const target = element.getAttribute('data-fritt-target');
    const placement = element.getAttribute('data-fritt-placement') || 'site';

    let base = '';
    if (target === 'portfolio') base = FRITT_URL;
    else if (target === 'contact') base = FRITT_CONTACT_URL;
    else continue;

    const href = frittLink(base, placement);
    if (href) element.setAttribute('href', href);
  }
}