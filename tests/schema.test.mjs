/**
 * Schema tests for The Roast Room. Run with node --test.
 * Every fixture used here is FAKE and lives in tests/fixtures.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { validateClub, validateEvidence, validateRegistry, validateRoast } from '../js/schema.js';
import { fakeClubData, fakeRegistry, fakeRoast } from './fixtures/fakeData.mjs';

/**
 * Deep clone a fixture and apply a patch, so no test mutates shared data.
 * @param {Record<string, unknown>} patch
 * @returns {Record<string, unknown>}
 */
function roastWith(patch) {
  return { ...structuredClone(fakeRoast), ...patch };
}

test('a valid roast passes validation', () => {
  const result = validateRoast(structuredClone(fakeRoast));
  assert.equal(result.valid, true, result.errors.join(', '));
  assert.deepEqual(result.errors, []);
});

test('a valid evidence array passes validation', () => {
  const result = validateEvidence(structuredClone(fakeRoast).evidence);
  assert.equal(result.valid, true);
});

test('a roast without an id fails', () => {
  const roast = structuredClone(fakeRoast);
  delete roast.id;
  const result = validateRoast(roast);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('id')));
});

test('a roast id with uppercase letters fails', () => {
  const result = validateRoast(roastWith({ id: 'Fake_Roast' }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('lowercase')));
});

test('a roast without a clubId fails', () => {
  const roast = structuredClone(fakeRoast);
  delete roast.clubId;
  const result = validateRoast(roast);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('clubId')));
});

test('a roast whose clubId does not match the club fails', () => {
  const result = validateRoast(structuredClone(fakeRoast), { clubId: 'otherclub' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('must match the club')));
});

test('a roast with a headline longer than 90 characters fails', () => {
  const result = validateRoast(roastWith({ headline: 'x'.repeat(91) }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('headline')));
});

test('a roast with an explanation longer than 280 characters fails', () => {
  const result = validateRoast(roastWith({ explanation: 'x'.repeat(281) }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('explanation')));
});

test('a roast with no evidence fails', () => {
  const result = validateRoast(roastWith({ evidence: [] }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('must contain at least')));
});

test('an evidence item without a period fails', () => {
  const roast = roastWith({ evidence: [{ ...structuredClone(fakeRoast).evidence[0] }] });
  delete roast.evidence[0].period;
  const result = validateRoast(roast);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('period')));
});

test('an evidence item without a sourceName fails', () => {
  const roast = roastWith({ evidence: [{ ...structuredClone(fakeRoast).evidence[0] }] });
  delete roast.evidence[0].sourceName;
  const result = validateRoast(roast);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('sourceName')));
});

test('an http source url is rejected', () => {
  const roast = roastWith({
    evidence: [{ ...structuredClone(fakeRoast).evidence[0], sourceUrl: 'http://example.com/fakeSource' }],
  });
  const result = validateRoast(roast);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('https')));
});

test('an accessedOn value in the wrong format fails', () => {
  const roast = roastWith({
    evidence: [{ ...structuredClone(fakeRoast).evidence[0], accessedOn: '15/01/2024' }],
  });
  const result = validateRoast(roast);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('accessedOn')));
});

test('an accessedOn value that does not exist on the calendar is rejected', () => {
  const roast = roastWith({
    evidence: [{ ...structuredClone(fakeRoast).evidence[0], accessedOn: '2024/02/31' }],
  });
  const result = validateRoast(roast);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('accessedOn')));
});

test('February 29 in a non leap year is rejected', () => {
  const roast = roastWith({
    evidence: [{ ...structuredClone(fakeRoast).evidence[0], accessedOn: '2023/02/29' }],
  });
  const result = validateRoast(roast);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('accessedOn')));
});

test('February 29 in a leap year is accepted', () => {
  const roast = roastWith({
    evidence: [{ ...structuredClone(fakeRoast).evidence[0], accessedOn: '2024/02/29' }],
  });
  const result = validateRoast(roast);
  assert.equal(result.valid, true, result.errors.join(', '));
});

test('an unverified roast is rejected', () => {
  const result = validateRoast(roastWith({ verified: false, verifiedOn: undefined }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('verified')));
});

test('a verified roast without verifiedOn fails', () => {
  const roast = roastWith({});
  delete roast.verifiedOn;
  const result = validateRoast(roast);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('verifiedOn')));
});

test('a roast in an unknown category is caught against the club categories', () => {
  const result = validateRoast(structuredClone(fakeRoast), {
    categoryIds: ['painfulStats'],
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('not one of the club categories')));
});

test('a roast in a category the club does not expose is caught by the club validator', () => {
  const data = structuredClone(fakeClubData);
  data.categories = data.categories.filter((category) => category.id !== 'trophyDroughts');
  const result = validateClub(data, { mode: 'data' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('not one of the club categories')));
});

test('a valid club data file passes validation', () => {
  const result = validateClub(structuredClone(fakeClubData), { mode: 'data' });
  assert.equal(result.valid, true, result.errors.join(', '));
});

test('duplicate roast ids are caught', () => {
  const data = structuredClone(fakeClubData);
  data.roasts = [
    structuredClone(fakeClubData.roasts[0]),
    { ...structuredClone(fakeClubData.roasts[0]), headline: 'FAKE second headline for the duplicate check.' },
  ];
  const result = validateClub(data, { mode: 'data' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('already used')));
});

test('a club data file with a mismatched club id is caught', () => {
  const result = validateClub(structuredClone(fakeClubData), {
    mode: 'data',
    clubId: 'otherclub',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('must match the registry club')));
});

test('a valid registry passes validation', () => {
  const result = validateRegistry(structuredClone(fakeRegistry));
  assert.equal(result.valid, true, result.errors.join(', '));
});

test('registry validation catches a live club without a data file', () => {
  const registry = structuredClone(fakeRegistry);
  delete registry.clubs[0].dataFile;
  const result = validateRegistry(registry);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('dataFile')));
});

test('registry validation catches duplicate club ids', () => {
  const registry = structuredClone(fakeRegistry);
  registry.clubs.push(structuredClone(registry.clubs[0]));
  const result = validateRegistry(registry);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('duplicate club id')));
});

test('registry validation catches a registry with no live club', () => {
  const registry = structuredClone(fakeRegistry);
  registry.clubs[0].status = 'comingSoon';
  registry.clubs[0].dataFile = 'tests/fixtures/fakeclub.json';
  const result = validateRegistry(registry);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('at least one live club')));
});

test('validators never throw on unexpected input', () => {
  const values = [undefined, null, 0, 'text', [], true];

  for (const value of values) {
    assert.doesNotThrow(() => validateRoast(value));
    assert.doesNotThrow(() => validateEvidence(value));
    assert.doesNotThrow(() => validateClub(value));
    assert.doesNotThrow(() => validateRegistry(value));
    assert.equal(validateRoast(value).valid, false);
    assert.equal(validateRegistry(value).valid, false);
  }
});