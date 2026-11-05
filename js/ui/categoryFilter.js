/**
 * Builds the category filter chips and reports selection changes.
 * Chips whose category has zero roasts are hidden so the user only sees
 * categories that will actually produce a roast.
 */

import { clear, createElement } from '../utils/dom.js';

/**
 * Build the filter into a container.
 *
 * @param {{
 *   container: HTMLElement,
 *   categories: Array<{ id: string, displayLabel: string, emoji: string }>,
 *   roasts: Array<{ category: string }>,
 *   selectedId: string,
 *   onChange: (id: string) => void
 * }} options
 * @returns {void}
 */
export function buildCategoryFilter(options) {
  const { container, categories, roasts, selectedId, onChange } = options;

  if (!container) return;

  clear(container);

  const list = Array.isArray(roasts) ? roasts : [];

  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const roast of list) {
    const key = String(roast.category);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const group = createElement('div', {
    className: 'flex flex-wrap gap-2',
    attrs: {
      role: 'group',
      'aria-label': 'Roast category filter',
    },
  });

  if (list.length > 0) {
    group.append(
      createChip({
        id: 'all',
        label: 'All',
        count: list.length,
        selected: selectedId === 'all',
        onClick: () => onChange('all'),
      })
    );
  }

  if (Array.isArray(categories)) {
    for (const category of categories) {
      const count = counts.get(category.id) || 0;
      if (count === 0) continue;
      group.append(
        createChip({
          id: category.id,
          label: category.displayLabel,
          emoji: category.emoji,
          count,
          selected: selectedId === category.id,
          onClick: () => onChange(category.id),
        })
      );
    }
  }

  container.append(group);
}

/**
 * Build a single filter chip.
 *
 * @param {{
 *   id: string,
 *   label: string,
 *   emoji?: string,
 *   count: number,
 *   selected: boolean,
 *   onClick: () => void
 * }} options
 * @returns {HTMLButtonElement}
 */
function createChip(options) {
  const { id, label, emoji, count, selected, onClick } = options;

  const button = createElement('button', {
    className: 'categoryChip',
    attrs: {
      type: 'button',
      'aria-pressed': selected ? 'true' : 'false',
      'data-category-id': id,
    },
  });

  if (emoji) {
    button.append(
      createElement('span', {
        className: 'mr-1',
        text: emoji,
        attrs: { 'aria-hidden': 'true' },
      })
    );
  }

  button.append(createElement('span', { text: label }));
  button.append(
    createElement('span', {
      className: 'categoryChipCount',
      text: `(${count})`,
    })
  );

  button.addEventListener('click', onClick);

  return button;
}