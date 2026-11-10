/**
 * Builds the DOM for one roast card. Never uses innerHTML with data, so every
 * piece of evidence is inserted as text or as a safe attribute value.
 */

import { createElement } from '../utils/dom.js';

/**
 * Build a roast card element.
 *
 * The headline is left empty on purpose. The caller decides whether to run the
 * reel and set the final headline, or to set it immediately for a deep link.
 * The facts block, the receipts block and the verified line start hidden and
 * are revealed by the reveal helper.
 *
 * @param {import('../schema.js').Roast} roast Roast data.
 * @param {import('../schema.js').ClubCategory | null} category Category the roast belongs to.
 * @returns {{
 *   element: HTMLElement,
 *   headlineElement: HTMLElement,
 *   hiddenElements: HTMLElement[]
 * }}
 */
export function createRoastCard(roast, category) {
  const card = createElement('article', {
    className: 'roastCard ticketStub',
    attrs: {
      'data-roast-id': roast.id,
      'aria-label': 'Roast',
    },
  });

  const categoryLine = createElement('p', {
    className: 'tokenLabel',
  });
  categoryLine.textContent = category
    ? `${category.emoji}  ${category.displayLabel}`
    : 'Roast';
  const isFan = Array.isArray(roast.tags) && roast.tags.includes('fan');
  if (isFan) {
    categoryLine.append(
      document.createTextNode(' '),
      createElement('span', {
        className:
          'ml-2 inline-block rounded-sharp border border-primary px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-primary',
        text: 'Fan roast',
      })
    );
  }

  const jokeLabel = createElement('p', {
    className: 'tokenLabel mt-4',
    text: 'The joke',
  });

  const headlineElement = createElement('h2', {
    className: 'roastHeadline mt-2 text-displaySm text-text',
  });

  const factsGroup = createElement('div', {
    className: 'revealTarget mt-6',
    attrs: { 'data-reveal-group': 'facts' },
  });
  const factsLabel = createElement('p', { className: 'tokenLabel', text: 'The facts' });
  const factsText = createElement('p', {
    className: 'mt-2 text-base text-text',
    text: roast.explanation,
  });
  factsGroup.append(factsLabel, factsText);

  const receiptsGroup = createElement('div', {
    className: 'revealTarget mt-6',
    attrs: { 'data-reveal-group': 'receipts' },
  });
  const receiptsLabel = createElement('p', { className: 'tokenLabel', text: 'The receipts' });
  const receiptsList = createElement('ul', { className: 'mt-3 space-y-3' });

  for (const evidence of roast.evidence) {
    const item = createElement('li', {
      className: 'rounded-sharp border border-line bg-surfaceRaised p-3',
    });

    const claimEl = createElement('p', {
      className: 'text-sm text-text',
      text: evidence.claim,
    });

    const metaEl = createElement('p', {
      className: 'mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-textMuted',
    });

    const periodSpan = createElement('span', { text: `Period ${evidence.period}` });

    const sourceLink = createElement('a', {
      className: 'text-accent',
      text: evidence.sourceName,
      attrs: {
        href: evidence.sourceUrl,
        target: '_blank',
        rel: 'noopener noreferrer nofollow ugc',
      },
    });

    const accessedSpan = createElement('span', {
      text: `Accessed ${evidence.accessedOn}`,
    });

    metaEl.append(periodSpan, sourceLink, accessedSpan);
    item.append(claimEl, metaEl);
    receiptsList.append(item);
  }

  receiptsGroup.append(receiptsLabel, receiptsList);

    const mistakeLink = createElement('p', {
    className: 'revealTarget mt-3 text-xs',
    children: [
      createElement('a', {
        className: 'text-textMuted underline hover:text-accent',
        text: 'Spot a mistake?',
        attrs: { href: './about.html#corrections' },
      }),
    ],
  });

  const verifiedEl = createElement('p', {
    className: 'revealTarget mt-4 text-xs text-textMuted',
    text: `Checked on ${roast.verifiedOn}`,
  });

  card.append(
    categoryLine,
    jokeLabel,
    headlineElement,
    factsGroup,
    receiptsGroup,
    mistakeLink,
    verifiedEl
  );

  return {
    element: card,
    headlineElement,
    hiddenElements: [factsGroup, receiptsGroup, mistakeLink, verifiedEl],
  };
}