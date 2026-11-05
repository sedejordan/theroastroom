/**
 * Tests for pure share text and text layout logic.
 * Node test runner only, no extra dependencies.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { fitText, truncateToWidth, wrapText } from '../js/share/textLayout.js';
import {
  absoluteRoastUrl,
  buildFileName,
  buildShareText,
  hostLabel,
} from '../js/share/shareText.js';

/**
 * Fake measure for single font text.
 * @param {string} text
 * @returns {number}
 */
function fakeMeasure(text) {
  return String(text).length * 10;
}

/**
 * Fake measure for fit text.
 * @param {string} text
 * @param {number} fontSize
 * @returns {number}
 */
function fakeFitMeasure(text, fontSize) {
  return String(text).length * fontSize;
}

test('wrapText wraps within maxWidth', () => {
  const lines = wrapText('one two three four', 100, fakeMeasure);

  assert.ok(lines.length > 1);
  for (const line of lines) {
    assert.ok(fakeMeasure(line) <= 100, `line "${line}" is too wide`);
  }
  assert.equal(lines.join(' '), 'one two three four');
});

test('wrapText returns an empty array for empty text', () => {
  assert.deepEqual(wrapText('', 100, fakeMeasure), []);
  assert.deepEqual(wrapText('   ', 100, fakeMeasure), []);
});

test('wrapText breaks a single very long word by character', () => {
  const lines = wrapText('abcdefghij', 30, fakeMeasure);

  assert.ok(lines.length > 1);
  for (const line of lines) {
    assert.ok(fakeMeasure(line) <= 30, `line "${line}" is too wide`);
  }
  assert.equal(lines.join(''), 'abcdefghij');
});

test('truncateToWidth adds an ellipsis and never exceeds maxWidth', () => {
  const result = truncateToWidth('abcdefghij', 50, fakeMeasure);

  assert.ok(result.endsWith('…'));
  assert.ok(fakeMeasure(result) <= 50);
});

test('fitText picks the largest font size that fits', () => {
  const result = fitText({
    text: 'abcd',
    maxWidth: 80,
    maxHeight: 200,
    maxLines: 1,
    minFontSize: 10,
    maxFontSize: 20,
    step: 10,
    lineHeightRatio: 1,
    measure: fakeFitMeasure,
  });

  assert.equal(result.fontSize, 20);
  assert.equal(result.truncated, false);
  assert.deepEqual(result.lines, ['abcd']);
});

test('fitText sets truncated true only when the minimum size still does not fit', () => {
  const result = fitText({
    text: 'abcdefghij',
    maxWidth: 20,
    maxHeight: 100,
    maxLines: 1,
    minFontSize: 10,
    maxFontSize: 20,
    step: 10,
    lineHeightRatio: 1,
    measure: fakeFitMeasure,
  });

  assert.equal(result.fontSize, 10);
  assert.equal(result.truncated, true);
  assert.equal(result.lines.length, 1);
  assert.ok(fakeFitMeasure(result.lines[0], result.fontSize) <= 20);
});

test('fitText respects maxLines', () => {
  const result = fitText({
    text: 'one two three four five six',
    maxWidth: 100,
    maxHeight: 1000,
    maxLines: 2,
    minFontSize: 10,
    maxFontSize: 10,
    step: 10,
    lineHeightRatio: 1,
    measure: fakeFitMeasure,
  });

  assert.ok(result.lines.length <= 2);
  assert.equal(result.truncated, true);
});

test('buildFileName matches the pattern and never contains a hyphen', () => {
  const name = buildFileName('Man-Utd', 'Roast-One', 'Post');

  assert.match(name, /^[a-z0-9_]+\.png$/);
  assert.ok(!name.includes('-'));
});

test('absoluteRoastUrl produces the correct absolute URL including query and hash', () => {
  const url = absoluteRoastUrl(
    'https://example.com/site/room.html?club=old#old',
    'manutd',
    'roast_one'
  );

  assert.equal(url, 'https://example.com/site/room.html?club=manutd#roast_one');
});

test('hostLabel uses the override when given and the host otherwise', () => {
  assert.equal(hostLabel('example.com', 'roastroom.example'), 'roastroom.example');
  assert.equal(hostLabel('example.com', ''), 'example.com');
  assert.equal(hostLabel('example.com', '   '), 'example.com');
});

test('buildShareText contains the headline and the url and no hyphen', () => {
  const roast = { headline: 'A friendly roast headline' };
  const url = 'https://example.com/room.html?club=manutd#roast_one';
  const text = buildShareText(roast, url);

  assert.ok(text.includes(roast.headline));
  assert.ok(text.includes(url));
  assert.ok(!text.includes('-'));
});