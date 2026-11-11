/**
 * Background image configuration for The Roast Room.
 *
 * Pure data and pure helpers. No DOM, no fetch, no side effects, so this
 * module runs unchanged in the browser, in Node build scripts and in tests.
 *
 * Paths are site-root relative, matching how the pages reference ./js and
 * ./dist. Adding a future club means adding one entry here and dropping the
 * files into images/backgrounds/<clubId>/.
 */

/**
 * @typedef {Object} BackgroundImage
 * @property {string} src Site-root relative image path.
 * @property {{ desktop: string, mobile: string }} focal CSS object-position values.
 */

/**
 * Build a frozen background image entry.
 * @param {string} src
 * @param {string} [desktop]
 * @param {string} [mobile]
 * @returns {BackgroundImage}
 */
function entry(src, desktop = '50% 50%', mobile = '50% 50%') {
  return Object.freeze({
    src,
    focal: Object.freeze({ desktop, mobile }),
  });
}

/** @type {Readonly<Record<string, BackgroundImage>>} */
export const HOME_BACKGROUNDS = Object.freeze({
  hero: entry('/images/backgrounds/home/home-hero.webp', '50% 45%', '50% 40%'),
  experience: entry('/images/backgrounds/home/home-experience.webp', '50% 50%', '50% 50%'),
  picker: entry('/images/backgrounds/home/home-club-picker.webp', '50% 50%', '50% 50%'),
  closing: entry('/images/backgrounds/home/home-closing.webp', '50% 55%', '50% 60%'),
});

/** @type {Readonly<Record<string, { default: BackgroundImage, categories: Readonly<Record<string, BackgroundImage>> }>>} */
export const CLUB_BACKGROUNDS = Object.freeze({
  manutd: Object.freeze({
    default: entry('/images/backgrounds/manutd/mu-room-default.webp', '50% 45%', '50% 40%'),
    categories: Object.freeze({
      trophyDroughts: entry('/images/backgrounds/manutd/mu-trophy-droughts.webp'),
      historicalDefeats: entry('/images/backgrounds/manutd/mu-historical-defeats.webp'),
      embarrassingRecords: entry('/images/backgrounds/manutd/mu-embarrassing-records.webp'),
      failedTransfers: entry('/images/backgrounds/manutd/mu-failed-transfers.webp'),
      painfulStats: entry('/images/backgrounds/manutd/mu-painful-stats.webp'),
    }),
  }),
});

/**
 * Return the landing page image for a section key, or null when unknown.
 * @param {string} sectionKey
 * @returns {BackgroundImage | null}
 */
export function homeBackgroundFor(sectionKey) {
  if (typeof sectionKey !== 'string' || sectionKey.length === 0) return null;
  return HOME_BACKGROUNDS[sectionKey] || null;
}

/**
 * Return the category image, else the club default, else null.
 * 'all' always resolves to the club default. Unknown clubs and unknown
 * categories return null so the SVG layers can show instead.
 * @param {string} clubId
 * @param {string} [categoryId]
 * @returns {BackgroundImage | null}
 */
export function clubBackgroundFor(clubId, categoryId) {
  if (typeof clubId !== 'string' || clubId.length === 0) return null;
  const club = CLUB_BACKGROUNDS[clubId];
  if (!club) return null;

  if (typeof categoryId === 'string' && categoryId.length > 0 && categoryId !== 'all') {
    const category = club.categories[categoryId];
    return category || null;
  }

  return club.default || null;
}

/**
 * Every landing page image, for idle preloading.
 * @returns {BackgroundImage[]}
 */
export function collectHomeBackgrounds() {
  return Object.values(HOME_BACKGROUNDS);
}

/**
 * Every image for one club, for idle preloading.
 * @param {string} clubId
 * @returns {BackgroundImage[]}
 */
export function collectClubBackgrounds(clubId) {
  const club = CLUB_BACKGROUNDS[clubId];
  if (!club) return [];
  const list = [club.default, ...Object.values(club.categories)];
  return list.filter(Boolean);
}

/**
 * Every configured image path across the whole site. Used by the build and
 * data gate to warn about missing files.
 * @returns {string[]}
 */
export function collectBackgroundImagePaths() {
  const paths = new Set();

  for (const image of Object.values(HOME_BACKGROUNDS)) {
    if (image && typeof image.src === 'string') paths.add(image.src);
  }

  for (const club of Object.values(CLUB_BACKGROUNDS)) {
    if (!club) continue;
    if (club.default && typeof club.default.src === 'string') paths.add(club.default.src);
    for (const image of Object.values(club.categories || {})) {
      if (image && typeof image.src === 'string') paths.add(image.src);
    }
  }

  return Array.from(paths);
}