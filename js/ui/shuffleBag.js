/**
 * Shuffle bag used by the roast room.
 * Pure logic, no DOM. rng is injectable so tests stay deterministic.
 *
 * Rules:
 * 1. Every item is served exactly once per cycle before any repeat.
 * 2. When a new cycle starts, the first item differs from the last item
 *    served, whenever the bag holds more than one item.
 * 3. An empty list returns null.
 * 4. A single item returns that item every time.
 */

/**
 * @typedef {Object} ShuffleBag
 * @property {() => (T | null)} next Return the next item or null when empty.
 * @property {() => number} remaining Items left before the cycle resets.
 * @property {() => number} size Total items in the bag.
 * @property {(items: T[]) => void} reset Replace the items and reset the cycle.
 * @template T
 */

/**
 * Create a shuffle bag.
 * @template T
 * @param {T[]} items Items to serve.
 * @param {() => number} [rng] Random function returning a number in [0, 1).
 * @returns {ShuffleBag<T>}
 */
export function createShuffleBag(items, rng = Math.random) {
  const random = typeof rng === 'function' ? rng : Math.random;

  /** @type {T[]} */
  let allItems = [];
  /** @type {T[]} */
  let pool = [];
  /** @type {T | null} */
  let lastServed = null;
  let sizeValue = 0;
  let remainingValue = 0;

  /**
   * Fisher-Yates shuffle that leaves the input untouched.
   * @param {T[]} list
   * @returns {T[]}
   */
  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  /**
   * Refill the pool from the current items, avoiding a repeat of the last
   * served item when there is more than one item.
   * @returns {void}
   */
  function refill() {
    if (sizeValue === 0) {
      pool = [];
      remainingValue = 0;
      return;
    }

    const shuffled = shuffle(allItems);

    if (sizeValue > 1 && lastServed !== null && shuffled[0] === lastServed) {
      for (let i = 1; i < shuffled.length; i += 1) {
        if (shuffled[i] !== lastServed) {
          const temp = shuffled[0];
          shuffled[0] = shuffled[i];
          shuffled[i] = temp;
          break;
        }
      }
    }

    pool = shuffled;
    remainingValue = pool.length;
  }

  /**
   * Replace the items and start a fresh cycle.
   * @param {T[]} newItems
   * @returns {void}
   */
  function reset(newItems) {
    allItems = Array.isArray(newItems) ? newItems.slice() : [];
    sizeValue = allItems.length;
    pool = [];
    lastServed = null;
    remainingValue = sizeValue;
  }

  /**
   * Serve the next item.
   * @returns {T | null}
   */
  function next() {
    if (sizeValue === 0) return null;

    if (pool.length === 0) {
      refill();
    }

    const item = pool.shift();
    remainingValue = pool.length;
    lastServed = item === undefined ? null : item;
    return item === undefined ? null : item;
  }

  /**
   * How many items are left in the current cycle.
   * @returns {number}
   */
  function remaining() {
    return remainingValue;
  }

  /**
   * Total number of items in the bag.
   * @returns {number}
   */
  function size() {
    return sizeValue;
  }

  reset(items);

  return { next, remaining, size, reset };
}