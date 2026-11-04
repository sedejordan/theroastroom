/**
 * FAKE sample data. Used only by tests/schema.test.mjs.
 * Nothing here is loaded by the site and nothing here is a real football fact.
 * The club, the claim, the source name and the URL are all placeholders.
 */

export const fakeTheme = {
  primary: '#FF00FF',
  primaryContrast: '#FFFFFF',
  accent: '#00FFFF',
  background: '#000000',
  surface: '#111111',
  surfaceRaised: '#222222',
  line: '#333333',
  text: '#EEEEEE',
  textMuted: '#BBBBBB',
};

export const fakeCategories = [
  {
    id: 'trophyDroughts',
    displayLabel: 'FAKE Trophy Droughts',
    description: 'FAKE category used only by the test suite.',
    emoji: '🏆',
  },
  {
    id: 'painfulStats',
    displayLabel: 'FAKE Painful Stats',
    description: 'FAKE category used only by the test suite.',
    emoji: '📊',
  },
];

export const fakeEvidence = {
  claim: 'FAKE claim that exists only to exercise the validator.',
  period: '2013/14',
  sourceName: 'FAKE Source Name',
  sourceUrl: 'https://example.com/fakeSource',
  accessedOn: '2024/01/15',
};

export const fakeRoast = {
  id: 'fake_roast_one',
  clubId: 'fakeclub',
  category: 'trophyDroughts',
  headline: 'FAKE headline used only by the test suite.',
  explanation: 'FAKE explanation used only by the test suite.',
  evidence: [{ ...fakeEvidence }],
  verified: true,
  verifiedOn: '2024/01/16',
  tags: ['fake'],
};

export const fakeClubEntry = {
  id: 'fakeclub',
  name: 'FAKE Club',
  shortName: 'FAKE',
  status: 'live',
  dataFile: 'tests/fixtures/fakeclub.json',
  themeKey: 'fakeclub',
};

export const fakeClubData = {
  id: 'fakeclub',
  name: 'FAKE Club',
  shortName: 'FAKE',
  status: 'live',
  themeKey: 'fakeclub',
  theme: { ...fakeTheme },
  categories: fakeCategories.map((category) => ({ ...category })),
  roasts: [{ ...fakeRoast, evidence: [{ ...fakeEvidence }], tags: ['fake'] }],
};

export const fakeRegistry = {
  version: 1,
  clubs: [{ ...fakeClubEntry }],
};