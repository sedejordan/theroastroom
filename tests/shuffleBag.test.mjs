/**
 * Tests for the shuffle bag. Node test runner only, no extra dependencies.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createShuffleBag } from '../js/ui/shuffleBag.js';

/**
 * Deterministic linear congruential generator used for the boundary tests.
 * @param {number} seed
 * @returns {() => number}
 */
function seededRng(seed) {
  let state = seed;
  return function next() {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

test('empty list returns null', () => {
  const bag = createShuffleBag([]);
  assert.equal(bag.next(), null);
  assert.equal(bag.next(), null);
  assert.equal(bag.size(), 0);
  assert.equal(bag.remaining(), 0);
});

test('single item returns that item every time', () => {
  const bag = createShuffleBag(['only']);
  assert.equal(bag.next(), 'only');
  assert.equal(bag.next(), 'only');
  assert.equal(bag.next(), 'only');
  assert.equal(bag.size(), 1);
});

test('every item is served exactly once per cycle', () => {
  const items = ['a', 'b', 'c', 'd', 'e'];
  const bag = createShuffleBag(items);

  const served = [];
  for (let i = 0; i < items.length; i += 1) {
    served.push(bag.next());
  }

  assert.equal(served.length, items.length);
  const unique = new Set(served);
  assert.equal(unique.size, items.length);
  for (const item of items) {
    assert.ok(served.includes(item), `item ${item} was not served in the cycle`);
  }
});

test('remaining counts down and starts over on the next cycle', () => {
  const items = ['a', 'b', 'c'];
  const bag = createShuffleBag(items);

  assert.equal(bag.remaining(), 3);
  bag.next();
  assert.equal(bag.remaining(), 2);
  bag.next();
  assert.equal(bag.remaining(), 1);
  bag.next();
  assert.equal(bag.remaining(), 0);
  bag.next();
  assert.equal(bag.remaining(), 2);
});

test('a new cycle does not start with the last item served', () => {
  const items = ['a', 'b'];

  for (let seed = 1; seed < 100; seed += 1) {
    const bag = createShuffleBag(items, seededRng(seed));

    const first = bag.next();
    const second = bag.next();
    const firstOfSecondCycle = bag.next();

    assert.notEqual(
      firstOfSecondCycle,
      second,
      `seed ${seed}: new cycle started with the last served item`
    );
    assert.equal(bag.size(), 2);
    assert.equal(typeof first, 'string');
  }
});

test('a new cycle does not start with the last item served even when the bag contains duplicates by value', () => {
  const items = ['a', 'b', 'c'];
  for (let seed = 1; seed < 50; seed += 1) {
    const bag = createShuffleBag(items, seededRng(seed));
    const firstCycle = [bag.next(), bag.next(), bag.next()];
    const firstOfSecondCycle = bag.next();
    assert.notEqual(
      firstOfSecondCycle,
      firstCycle[firstCycle.length - 1],
      `seed ${seed}: new cycle started with the last served item`
    );
  }
});

test('reset swaps the items and starts a fresh cycle', () => {
  const bag = createShuffleBag(['a', 'b']);
  bag.next();
  bag.next();

  bag.reset(['x', 'y', 'z']);
  assert.equal(bag.size(), 3);
  assert.equal(bag.remaining(), 3);

  const served = [bag.next(), bag.next(), bag.next()];
  const unique = new Set(served);
  assert.equal(unique.size, 3);
});

test('reset to an empty list turns next into null', () => {
  const bag = createShuffleBag(['a']);
  bag.next();
  bag.reset([]);
  assert.equal(bag.size(), 0);
  assert.equal(bag.next(), null);
});

test('rng is injectable and is called during the shuffle', () => {
  let calls = 0;
  const rng = () => {
    calls += 1;
    return 0.5;
  };
  const bag = createShuffleBag(['a', 'b', 'c', 'd'], rng);
  bag.next();
  assert.ok(calls > 0, 'rng should be called during the shuffle');
});

test('serving many times across many cycles still serves every item once per cycle', () => {
  const items = ['a', 'b', 'c', 'd'];
  const bag = createShuffleBag(items);

  for (let cycle = 0; cycle < 5; cycle += 1) {
    const served = [];
    for (let i = 0; i < items.length; i += 1) {
      served.push(bag.next());
    }
    const unique = new Set(served);
    assert.equal(unique.size, items.length, `cycle ${cycle} did not serve every item once`);
  }
});