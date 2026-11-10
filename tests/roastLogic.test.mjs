/**
 * Tests for the roast submission logic. Node test runner only, no extra
 * dependencies. Imports the same logic the Worker uses plus validateRoast from
 * js/schema.js.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { validateRoast } from '../js/schema.js';
import {
  CLAIM_MAX_LENGTH,
  EXPLANATION_MAX_LENGTH,
  HEADLINE_MAX_LENGTH,
  MAX_ROAST_SUBMISSIONS,
  ROAST_SUBMISSIONS_PER_DAY,
  SOURCE_NAME_MAX_LENGTH,
  SOURCE_NAME_MIN_LENGTH,
  applyRoastApprove,
  applyRoastEdit,
  applyRoastReject,
  applyRoastRemove,
  applyRoastSubmission,
  countRoastSubmissions,
  generateRoastId,
  adminRoastsView,
  normaliseRoastBoard,
  normaliseText,
  publicRoastsView,
  validatePublicSourceUrl,
  validateRoastFields,
  validateRoastPeriod,
} from '../worker/src/roastLogic.js';

const NOW = '2026-11-03T12:00:00.000Z';
const LIVE_CLUB_IDS = ['manutd'];
const CATEGORY_IDS = [
  'trophyDroughts',
  'historicalDefeats',
  'embarrassingRecords',
  'failedTransfers',
  'painfulStats',
];

/**
 * Build a valid field set with optional overrides.
 * @param {Record<string, unknown>} [overrides]
 * @returns {Record<string, unknown>}
 */
function validFields(overrides = {}) {
  return {
    clubId: 'manutd',
    category: 'trophyDroughts',
    headline: 'A valid fan roast headline.',
    explanation: 'A valid fan roast explanation.',
    claim: 'A precise sourced claim.',
    period: '2013/14',
    sourceName: 'BBC Sport',
    sourceUrl: 'https://www.bbc.co.uk/sport/football',
    ...overrides,
  };
}

/**
 * Build an empty roast board.
 * @returns {{ version: number, submissions: Record<string, unknown> }}
 */
function emptyBoard() {
  return { version: 1, submissions: {} };
}

/**
 * Build an empty rate record with the roasts counter.
 * @returns {{ actions: number, voted: string[], roasts: number }}
 */
function emptyRate() {
  return { actions: 0, voted: [], roasts: 0 };
}

// --- normalisation and field validation ---

test('normaliseText trims and collapses whitespace', () => {
  assert.equal(normaliseText('  hello   world  '), 'hello world');
  assert.equal(normaliseText('a\nb\tc'), 'a b c');
  assert.equal(normaliseText(null), '');
});

test('normaliseText strips control characters', () => {
  assert.equal(normaliseText('a\u0007b'), 'a b');
});

test('validateRoastPeriod accepts a season', () => {
  assert.equal(validateRoastPeriod('2013/14'), true);
});

test('validateRoastPeriod accepts a real date', () => {
  assert.equal(validateRoastPeriod('2021/09/11'), true);
});

test('validateRoastPeriod rejects impossible dates', () => {
  assert.equal(validateRoastPeriod('2023/02/29'), false);
  assert.equal(validateRoastPeriod('2024/13/01'), false);
  assert.equal(validateRoastPeriod('2024/04/31'), false);
});

test('validatePublicSourceUrl accepts a public https url', () => {
  assert.equal(validatePublicSourceUrl('https://www.bbc.co.uk/sport/football'), true);
  assert.equal(validatePublicSourceUrl('https://example.com/a/b'), true);
});

test('validatePublicSourceUrl rejects unsafe forms', () => {
  assert.equal(validatePublicSourceUrl('http://example.com'), false);
  assert.equal(validatePublicSourceUrl('javascript:alert(1)'), false);
  assert.equal(validatePublicSourceUrl('https://localhost/x'), false);
  assert.equal(validatePublicSourceUrl('https://192.168.1.1/x'), false);
  assert.equal(validatePublicSourceUrl('https://user:pass@example.com/x'), false);
  assert.equal(validatePublicSourceUrl('https://example/x'), false);
});

test('validateRoastFields accepts a valid set', () => {
  const result = validateRoastFields(validFields(), LIVE_CLUB_IDS);
  assert.equal(result.valid, true, result.errors.join(', '));
});

test('validateRoastFields rejects a headline over the limit', () => {
  const fields = validFields({ headline: 'x'.repeat(HEADLINE_MAX_LENGTH + 1) });
  const result = validateRoastFields(fields, LIVE_CLUB_IDS);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('headline')));
});

test('validateRoastFields rejects an explanation over the limit', () => {
  const fields = validFields({ explanation: 'x'.repeat(EXPLANATION_MAX_LENGTH + 1) });
  const result = validateRoastFields(fields, LIVE_CLUB_IDS);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('explanation')));
});

test('validateRoastFields rejects a claim over the limit', () => {
  const fields = validFields({ claim: 'x'.repeat(CLAIM_MAX_LENGTH + 1) });
  const result = validateRoastFields(fields, LIVE_CLUB_IDS);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('claim')));
});

test('validateRoastFields rejects a source name that is too short or long', () => {
  const short = validateRoastFields(
    validFields({ sourceName: 'x'.repeat(SOURCE_NAME_MIN_LENGTH - 1) }),
    LIVE_CLUB_IDS
  );
  assert.equal(short.valid, false);
  const long = validateRoastFields(
    validFields({ sourceName: 'x'.repeat(SOURCE_NAME_MAX_LENGTH + 1) }),
    LIVE_CLUB_IDS
  );
  assert.equal(long.valid, false);
});

test('validateRoastFields rejects an unknown category', () => {
  const result = validateRoastFields(validFields({ category: 'madeUp' }), LIVE_CLUB_IDS);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('category')));
});

test('validateRoastFields rejects a club that is not live', () => {
  const result = validateRoastFields(validFields({ clubId: 'other' }), LIVE_CLUB_IDS);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('live club')));
});

// --- id generation ---

test('generateRoastId matches the roast id pattern and is unique', () => {
  const board = emptyBoard();
  const seen = new Set();
  for (let i = 0; i < 20; i += 1) {
    const id = generateRoastId(board, Math.random);
    assert.match(id, /^[a-z0-9_]+$/);
    assert.ok(id.length <= 64);
    assert.ok(id.startsWith('fan_'));
    seen.add(id);
    board.submissions[id] = {};
  }
  assert.equal(seen.size, 20);
});

test('generateRoastId is deterministic with a constant random source', () => {
  const board = emptyBoard();
  const id1 = generateRoastId(board, () => 0.5);
  board.submissions[id1] = {};
  const id2 = generateRoastId(board, () => 0.5);
  assert.notEqual(id1, id2);
  assert.match(id2, /^[a-z0-9_]+$/);
});

// --- applyRoastSubmission ---

test('applyRoastSubmission creates a pending submission', () => {
  const result = applyRoastSubmission({
    board: emptyBoard(),
    rateRecord: emptyRate(),
    fields: validFields(),
    now: NOW,
    liveClubIds: LIVE_CLUB_IDS,
    random: () => 0.5,
  });
  assert.equal(result.outcome, 'pending');
  const ids = Object.keys(result.board.submissions);
  assert.equal(ids.length, 1);
  assert.equal(result.board.submissions[ids[0]].status, 'pending');
  assert.equal(result.rateRecord.roasts, 1);
  assert.equal(result.rateRecord.actions, 1);
});

test('applyRoastSubmission rejects a duplicate headline', () => {
  const first = applyRoastSubmission({
    board: emptyBoard(),
    rateRecord: emptyRate(),
    fields: validFields(),
    now: NOW,
    liveClubIds: LIVE_CLUB_IDS,
    random: () => 0.5,
  });
  const second = applyRoastSubmission({
    board: first.board,
    rateRecord: emptyRate(),
    fields: validFields({ explanation: 'A different explanation.' }),
    now: NOW,
    liveClubIds: LIVE_CLUB_IDS,
    random: () => 0.6,
  });
  assert.equal(second.outcome, 'duplicate');
});

test('applyRoastSubmission returns rateLimited after 2 submissions per day', () => {
  let board = emptyBoard();
  let rate = emptyRate();
  for (let i = 0; i < ROAST_SUBMISSIONS_PER_DAY; i += 1) {
    const res = applyRoastSubmission({
      board,
      rateRecord: rate,
      fields: validFields({ headline: `Headline ${i}.` }),
      now: NOW,
      liveClubIds: LIVE_CLUB_IDS,
      random: () => 0.5 + i * 0.05,
    });
    assert.equal(res.outcome, 'pending');
    board = res.board;
    rate = res.rateRecord;
  }
  const over = applyRoastSubmission({
    board,
    rateRecord: rate,
    fields: validFields({ headline: 'One more.' }),
    now: NOW,
    liveClubIds: LIVE_CLUB_IDS,
    random: () => 0.99,
  });
  assert.equal(over.outcome, 'rateLimited');
});

test('applyRoastSubmission returns rateLimited when the total action limit is reached', () => {
  const result = applyRoastSubmission({
    board: emptyBoard(),
    rateRecord: { actions: 6, voted: [], roasts: 0 },
    fields: validFields(),
    now: NOW,
    liveClubIds: LIVE_CLUB_IDS,
    random: () => 0.5,
  });
  assert.equal(result.outcome, 'rateLimited');
});

test('applyRoastSubmission returns full at the submission cap', () => {
  const board = emptyBoard();
  for (let i = 0; i < MAX_ROAST_SUBMISSIONS; i += 1) {
    board.submissions[`fan_${i.toString(36)}`] = {
      id: `fan_${i.toString(36)}`,
      clubId: 'manutd',
      headline: `Existing ${i}`,
      status: 'approved',
    };
  }
  assert.equal(countRoastSubmissions(board), MAX_ROAST_SUBMISSIONS);
  const result = applyRoastSubmission({
    board,
    rateRecord: emptyRate(),
    fields: validFields(),
    now: NOW,
    liveClubIds: LIVE_CLUB_IDS,
    random: () => 0.5,
  });
  assert.equal(result.outcome, 'full');
});

// --- approve / reject / remove / edit ---

test('applyRoastApprove requires checkedSource to be exactly true', () => {
  const submitted = applyRoastSubmission({
    board: emptyBoard(),
    rateRecord: emptyRate(),
    fields: validFields(),
    now: NOW,
    liveClubIds: LIVE_CLUB_IDS,
    random: () => 0.5,
  });
  const id = Object.keys(submitted.board.submissions)[0];
  const notApproved = applyRoastApprove({
    board: submitted.board,
    id,
    checkedSource: false,
    now: NOW,
  });
  assert.equal(notApproved.outcome, 'notChecked');
  const approved = applyRoastApprove({
    board: submitted.board,
    id,
    checkedSource: true,
    now: NOW,
  });
  assert.equal(approved.outcome, 'approved');
  assert.equal(approved.board.submissions[id].status, 'approved');
  assert.equal(approved.board.submissions[id].verifiedOn, '2026/11/03');
});

test('applyRoastReject marks a submission as rejected', () => {
  const submitted = applyRoastSubmission({
    board: emptyBoard(),
    rateRecord: emptyRate(),
    fields: validFields(),
    now: NOW,
    liveClubIds: LIVE_CLUB_IDS,
    random: () => 0.5,
  });
  const id = Object.keys(submitted.board.submissions)[0];
  const rejected = applyRoastReject({ board: submitted.board, id, now: NOW });
  assert.equal(rejected.outcome, 'rejected');
  assert.equal(rejected.board.submissions[id].status, 'rejected');
});

test('applyRoastRemove deletes the submission', () => {
  const submitted = applyRoastSubmission({
    board: emptyBoard(),
    rateRecord: emptyRate(),
    fields: validFields(),
    now: NOW,
    liveClubIds: LIVE_CLUB_IDS,
    random: () => 0.5,
  });
  const id = Object.keys(submitted.board.submissions)[0];
  const removed = applyRoastRemove({ board: submitted.board, id });
  assert.equal(removed.outcome, 'removed');
  assert.equal(removed.board.submissions[id], undefined);
});

test('applyRoastEdit updates text fields with validation', () => {
  const submitted = applyRoastSubmission({
    board: emptyBoard(),
    rateRecord: emptyRate(),
    fields: validFields(),
    now: NOW,
    liveClubIds: LIVE_CLUB_IDS,
    random: () => 0.5,
  });
  const id = Object.keys(submitted.board.submissions)[0];
  const bad = applyRoastEdit({
    board: submitted.board,
    id,
    fields: validFields({ sourceUrl: 'http://example.com' }),
    now: NOW,
    liveClubIds: LIVE_CLUB_IDS,
  });
  assert.equal(bad.outcome, 'invalid');
  const ok = applyRoastEdit({
    board: submitted.board,
    id,
    fields: validFields({ headline: 'A better headline.' }),
    now: NOW,
    liveClubIds: LIVE_CLUB_IDS,
  });
  assert.equal(ok.outcome, 'updated');
  assert.equal(ok.board.submissions[id].headline, 'A better headline.');
});

// --- public and admin views ---

test('publicRoastsView returns only approved submissions', () => {
  const board = {
    version: 1,
    submissions: {
      fan_a: {
        id: 'fan_a',
        clubId: 'manutd',
        category: 'trophyDroughts',
        headline: 'Approved one.',
        explanation: 'Explanation one.',
        claim: 'Claim one.',
        period: '2020/21',
        sourceName: 'BBC Sport',
        sourceUrl: 'https://www.bbc.co.uk/sport',
        status: 'approved',
        createdAt: NOW,
        updatedAt: NOW,
        verifiedOn: '2026/11/03',
      },
      fan_b: {
        id: 'fan_b',
        clubId: 'manutd',
        headline: 'Pending one.',
        status: 'pending',
      },
      fan_c: {
        id: 'fan_c',
        clubId: 'manutd',
        headline: 'Rejected one.',
        status: 'rejected',
      },
    },
  };
  const view = publicRoastsView(board, 'manutd');
  assert.equal(view.roasts.length, 1);
  assert.equal(view.roasts[0].id, 'fan_a');
  for (const roast of view.roasts) {
    assert.equal(roast.status, undefined);
    assert.equal(roast.createdAt, undefined);
    assert.equal(roast.updatedAt, undefined);
  }
});

test('publicRoastsView returns nothing when the club has no approved roasts', () => {
  const view = publicRoastsView(emptyBoard(), 'manutd');
  assert.equal(view.roasts.length, 0);
});

test('every public roast passes validateRoast', () => {
  const submitted = applyRoastSubmission({
    board: emptyBoard(),
    rateRecord: emptyRate(),
    fields: validFields(),
    now: NOW,
    liveClubIds: LIVE_CLUB_IDS,
    random: () => 0.5,
  });
  const id = Object.keys(submitted.board.submissions)[0];
  const approved = applyRoastApprove({
    board: submitted.board,
    id,
    checkedSource: true,
    now: NOW,
  });
  const view = publicRoastsView(approved.board, 'manutd');
  assert.equal(view.roasts.length, 1);
  for (const roast of view.roasts) {
    const check = validateRoast(roast, {
      clubId: 'manutd',
      categoryIds: CATEGORY_IDS,
    });
    assert.equal(check.valid, true, check.errors.join(', '));
  }
});

test('adminRoastsView lists pending first then newest first', () => {
  const board = {
    version: 1,
    submissions: {
      a: { id: 'a', status: 'approved', createdAt: '2026-01-01T00:00:00Z' },
      b: { id: 'b', status: 'pending', createdAt: '2026-02-01T00:00:00Z' },
      c: { id: 'c', status: 'pending', createdAt: '2026-03-01T00:00:00Z' },
    },
  };
  const view = adminRoastsView(board);
  assert.equal(view.submissions[0].status, 'pending');
  assert.equal(view.submissions[1].status, 'pending');
  assert.equal(view.submissions[2].status, 'approved');
});

test('normaliseRoastBoard tolerates malformed input', () => {
  const board = normaliseRoastBoard({ submissions: 'nope' });
  assert.equal(board.version, 1);
  assert.deepEqual(board.submissions, {});
});