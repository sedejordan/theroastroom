/**
 * Tests for the pure suggestion logic. Node test runner only, no extra
 * dependencies. Imports the same logic the Worker uses.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_SUGGESTIONS,
  applySuggestion,
  applyVote,
  canAct,
  canVote,
  constantTimeEquals,
  normaliseName,
  pickOrigin,
  publicView,
  slugify,
  validateName,
} from '../worker/src/logic.js';

const NOW = '2026-11-03T12:00:00.000Z';

/**
 * Build an empty board.
 * @returns {{ version: number, suggestions: Record<string, unknown> }}
 */
function emptyBoard() {
  return { version: 1, suggestions: {} };
}

/**
 * Build an empty rate record.
 * @returns {{ actions: number, voted: string[] }}
 */
function emptyRate() {
  return { actions: 0, voted: [] };
}

test('normaliseName trims and collapses whitespace', () => {
  assert.equal(normaliseName('  Arsenal  '), 'Arsenal');
  assert.equal(normaliseName('Manchester   United'), 'Manchester United');
  assert.equal(normaliseName(''), '');
  assert.equal(normaliseName(null), '');
});

test('validateName accepts an ordinary name', () => {
  const result = validateName('Arsenal');
  assert.equal(result.valid, true);
  assert.equal(result.name, 'Arsenal');
});

test('validateName accepts accented names', () => {
  assert.equal(validateName('Atlético').valid, true);
});

test('validateName accepts an apostrophe', () => {
  assert.equal(validateName("St Patrick's").valid, true);
});

test('validateName accepts an ampersand', () => {
  assert.equal(validateName('Brighton & Hove').valid, true);
});

test('validateName rejects a url', () => {
  assert.equal(validateName('https://evil.example').valid, false);
  assert.equal(validateName('www.evil.example').valid, false);
});

test('validateName rejects an at sign', () => {
  assert.equal(validateName('user@example').valid, false);
});

test('validateName rejects digits only', () => {
  assert.equal(validateName('12345').valid, false);
});

test('validateName rejects a name that is too short', () => {
  assert.equal(validateName('A').valid, false);
});

test('validateName rejects a name that is too long', () => {
  assert.equal(validateName('A'.repeat(41)).valid, false);
});

test('slugify uses lowercase and underscores only', () => {
  assert.equal(slugify('Manchester United'), 'manchester_united');
  assert.equal(slugify('Arsenal'), 'arsenal');
  assert.equal(slugify('Atlético'), 'atletico');
});

test('slugify never produces a hyphen', () => {
  const value = slugify('Manchester United & Brighton');
  assert.ok(!value.includes('-'));
  assert.match(value, /^[a-z0-9_]+$/);
});

test('a repeated suggestion merges into a vote', () => {
  const first = applySuggestion({
    board: emptyBoard(),
    name: 'Arsenal',
    rateRecord: emptyRate(),
    now: NOW,
  });
  assert.equal(first.outcome, 'pending');
  assert.ok(first.board.suggestions.arsenal);

  const second = applySuggestion({
    board: first.board,
    name: 'Arsenal',
    rateRecord: emptyRate(),
    now: NOW,
  });
  assert.equal(second.outcome, 'voted');
  assert.equal(second.board.suggestions.arsenal.votes, 2);
});

test('the board has a 300 suggestion cap', () => {
  const board = { version: 1, suggestions: {} };
  for (let i = 0; i < MAX_SUGGESTIONS; i += 1) {
    board.suggestions[`club_${i}`] = {
      name: `Club ${i}`,
      votes: 1,
      approved: true,
      createdAt: NOW,
      updatedAt: NOW,
    };
  }
  const result = applySuggestion({
    board,
    name: 'New Club',
    rateRecord: emptyRate(),
    now: NOW,
  });
  assert.equal(result.outcome, 'full');
});

test('canAct allows fewer than 6 actions', () => {
  assert.equal(canAct({ actions: 5, voted: [] }).allowed, true);
});

test('canAct blocks at 6 actions', () => {
  assert.equal(canAct({ actions: 6, voted: [] }).allowed, false);
});

test('canVote allows a slug the client has not voted for today', () => {
  assert.equal(canVote({ actions: 0, voted: [] }, 'arsenal').allowed, true);
});

test('canVote blocks a slug the client has already voted for today', () => {
  assert.equal(canVote({ actions: 1, voted: ['arsenal'] }, 'arsenal').allowed, false);
});

test('applyVote rejects a missing slug', () => {
  const result = applyVote({
    board: emptyBoard(),
    slug: 'missing',
    rateRecord: emptyRate(),
    now: NOW,
  });
  assert.equal(result.outcome, 'notFound');
});

test('applyVote rejects an unapproved suggestion', () => {
  const board = {
    version: 1,
    suggestions: {
      arsenal: {
        name: 'Arsenal',
        votes: 1,
        approved: false,
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  };
  const result = applyVote({ board, slug: 'arsenal', rateRecord: emptyRate(), now: NOW });
  assert.equal(result.outcome, 'notApproved');
});

test('publicView shows approved only, sorted by votes then name, no timestamps', () => {
  const board = {
    version: 1,
    suggestions: {
      a: { name: 'Alpha', votes: 3, approved: true, createdAt: NOW, updatedAt: NOW },
      b: { name: 'Bravo', votes: 5, approved: true, createdAt: NOW, updatedAt: NOW },
      c: { name: 'Charlie', votes: 3, approved: true, createdAt: NOW, updatedAt: NOW },
      d: { name: 'Delta', votes: 10, approved: false, createdAt: NOW, updatedAt: NOW },
    },
  };
  const view = publicView(board);
  assert.equal(view.suggestions.length, 3);
  assert.deepEqual(view.suggestions.map((s) => s.slug), ['b', 'a', 'c']);
  for (const suggestion of view.suggestions) {
    assert.equal(suggestion.createdAt, undefined);
    assert.equal(suggestion.updatedAt, undefined);
  }
});

test('pickOrigin returns the origin when listed', () => {
  assert.equal(
    pickOrigin('https://roastroom.fritt.org', 'https://roastroom.fritt.org,http://localhost:3000'),
    'https://roastroom.fritt.org'
  );
});

test('pickOrigin returns an empty string when not listed', () => {
  assert.equal(pickOrigin('https://evil.example', 'https://roastroom.fritt.org'), '');
  assert.equal(pickOrigin('', 'https://roastroom.fritt.org'), '');
});

test('constantTimeEquals compares strings', () => {
  assert.equal(constantTimeEquals('abc', 'abc'), true);
  assert.equal(constantTimeEquals('abc', 'abd'), false);
  assert.equal(constantTimeEquals('abc', 'abcd'), false);
  assert.equal(constantTimeEquals('', ''), true);
  assert.equal(constantTimeEquals(null, 'abc'), false);
});

test('applySuggestion rejects an invalid name', () => {
  const result = applySuggestion({
    board: emptyBoard(),
    name: 'https://evil.example',
    rateRecord: emptyRate(),
    now: NOW,
  });
  assert.equal(result.outcome, 'invalid');
});

test('applySuggestion rejects when the daily rate limit is reached', () => {
  const result = applySuggestion({
    board: emptyBoard(),
    name: 'Arsenal',
    rateRecord: { actions: 6, voted: [] },
    now: NOW,
  });
  assert.equal(result.outcome, 'rateLimited');
});