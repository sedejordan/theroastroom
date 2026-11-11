/**
 * Tests for the pure background configuration helpers.
 * Node test runner only, no extra dependencies.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CLUB_BACKGROUNDS,
  HOME_BACKGROUNDS,
  clubBackgroundFor,
  collectBackgroundImagePaths,
  collectClubBackgrounds,
  collectHomeBackgrounds,
  homeBackgroundFor,
} from '../js/background/backgroundConfig.js';

test('homeBackgroundFor returns the hero image', () => {
  const hero = homeBackgroundFor('hero');
  assert.ok(hero);
  assert.equal(hero.src, '/images/backgrounds/home/home-hero.webp');
});

test('homeBackgroundFor returns null for an unknown key', () => {
  assert.equal(homeBackgroundFor('nope'), null);
  assert.equal(homeBackgroundFor(''), null);
  assert.equal(homeBackgroundFor(null), null);
});

test('clubBackgroundFor returns the category image', () => {
  const image = clubBackgroundFor('manutd', 'trophyDroughts');
  assert.ok(image);
  assert.equal(image.src, '/images/backgrounds/manutd/mu-trophy-droughts.webp');
});

test('clubBackgroundFor treats all as the club default', () => {
  const image = clubBackgroundFor('manutd', 'all');
  assert.ok(image);
  assert.equal(image.src, CLUB_BACKGROUNDS.manutd.default.src);
});

test('clubBackgroundFor returns null for an unknown club', () => {
  assert.equal(clubBackgroundFor('nope', 'trophyDroughts'), null);
  assert.equal(clubBackgroundFor('', 'all'), null);
});

test('clubBackgroundFor returns null for an unknown category', () => {
  assert.equal(clubBackgroundFor('manutd', 'nope'), null);
});

test('clubBackgroundFor never throws on odd input', () => {
  const values = [undefined, null, 0, 'text', [], {}];
  for (const value of values) {
    assert.doesNotThrow(() => clubBackgroundFor(value, value));
    assert.doesNotThrow(() => homeBackgroundFor(value));
  }
});

test('every configured path starts with the images folder', () => {
  const paths = collectBackgroundImagePaths();
  assert.ok(paths.length > 0);
  for (const path of paths) {
    assert.ok(path.startsWith('/images/backgrounds/'), `${path} is not under images/backgrounds`);
  }
});

test('collectHomeBackgrounds and collectClubBackgrounds return entries', () => {
  assert.equal(collectHomeBackgrounds().length, Object.keys(HOME_BACKGROUNDS).length);
  const club = collectClubBackgrounds('manutd');
  assert.ok(club.length >= 6);
  assert.deepEqual(collectClubBackgrounds('nope'), []);
});