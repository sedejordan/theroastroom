/**
 * Production build for The Roast Room.
 *
 * 1. Compiles the Tailwind CSS into dist/styles.css via npm run css.
 * 2. Copies the public pages, the javascript, the json data, the compiled
 *    styles, the favicon and (when present) the social preview images into
 *    a fresh site/ folder.
 * 3. Excludes the developer pages from the deploy.
 * 4. Replaces every __SITE_URL__ token with the detected site URL.
 * 5. Writes sitemap.xml, robots.txt and _headers.
 * 6. Prints a summary and clear WARNINGS (no failures) for a missing site
 *    URL, a missing og.png or apple_touch_icon.png, or an empty
 *    SUGGEST_API_BASE.
 */

import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SUGGEST_API_BASE } from '../js/suggest/suggestConfig.js';
import {
  buildHeaders,
  buildRobots,
  buildSitemap,
  hashDirectory,
  normaliseSiteUrl,
  originOf,
  replaceSiteUrl,
} from './lib/siteTools.mjs';

const excludedPages = new Set(['tokens.html', 'cardlab.html', 'adminlab.html', 'ogimage.html']);

const rootDirectory = resolve(fileURLToPath(new URL('..', import.meta.url)));
const siteDirectory = join(rootDirectory, 'site');

/**
 * Run the Tailwind CSS build.
 * @returns {void}
 */
function buildCss() {
  console.log('[build] running npm run css');
  execSync('npm run css', { cwd: rootDirectory, stdio: 'inherit' });
}

/**
 * Copy a folder recursively, skipping the given file names.
 * @param {string} source
 * @param {string} destination
 * @param {Set<string>} skip
 * @returns {Promise<void>}
 */
async function copyFolder(source, destination, skip, skipDirs) {
  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const from = join(source, entry.name);
    const to = join(destination, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs && skipDirs.has(entry.name)) continue;
      await copyFolder(from, to, skip, skipDirs);
    } else if (!skip.has(entry.name)) {
      await copyFile(from, to);
    }
  }
}

/**
 * Check whether a file exists.
 * @param {string} path
 * @returns {Promise<boolean>}
 */
async function fileExists(path) {
  try {
    const info = await stat(path);
    return info.isFile();
  } catch {
    return false;
  }
}

/**
 * Recursively list files ending in .html inside a folder.
 * @param {string} directory
 * @returns {Promise<string[]>}
 */
async function listHtmlFiles(directory) {
  const results = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await listHtmlFiles(full)));
    } else if (entry.name.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Main build.
 * @returns {Promise<number>} Exit code.
 */
async function main() {
  const warnings = [];

  // 1. CSS build.
  buildCss();

  // 2. Site URL from environment.
  const rawSiteUrl =
    process.env.SITE_URL || process.env.URL || process.env.CF_PAGES_URL || '';
  const siteUrl = normaliseSiteUrl(rawSiteUrl);
  if (siteUrl.length === 0) {
    warnings.push(
      'No site URL found (checked SITE_URL, URL and CF_PAGES_URL). Absolute URLs will be empty and sitemap.xml will be skipped.'
    );
  } else {
    console.log(`[build] site URL: ${siteUrl}`);
  }

  // 3. Fresh site folder.
  await rm(siteDirectory, { recursive: true, force: true });
  await mkdir(siteDirectory, { recursive: true });

  // 4. Copy the compiled styles, the scripts, the data.
  await copyFolder(join(rootDirectory, 'dist'), join(siteDirectory, 'dist'), new Set());
  await copyFolder(
    join(rootDirectory, 'js'),
    join(siteDirectory, 'js'),
    new Set(),
    new Set(['dev'])
  );
  await copyFolder(join(rootDirectory, 'data'), join(siteDirectory, 'data'), new Set());

  // 5. Copy the public pages, skipping the developer pages.
  const rootEntries = await readdir(rootDirectory, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.html')) continue;
    if (excludedPages.has(entry.name)) continue;
    await copyFile(join(rootDirectory, entry.name), join(siteDirectory, entry.name));
  }

  // 6. Copy the static assets.
  const faviconSource = join(rootDirectory, 'favicon.svg');
  if (await fileExists(faviconSource)) {
    await copyFile(faviconSource, join(siteDirectory, 'favicon.svg'));
  }

  const ogSource = join(rootDirectory, 'og.png');
  if (await fileExists(ogSource)) {
    await copyFile(ogSource, join(siteDirectory, 'og.png'));
  } else {
    warnings.push('og.png not found in the repository root. Social previews will 404.');
  }

  const iconSource = join(rootDirectory, 'apple_touch_icon.png');
  if (await fileExists(iconSource)) {
    await copyFile(iconSource, join(siteDirectory, 'apple_touch_icon.png'));
  } else {
    warnings.push(
      'apple_touch_icon.png not found in the repository root. The apple-touch-icon link will 404.'
    );
  }

  // 6b. Hash the JS and CSS directories and rename them. Any change to a
  // file inside produces a new directory name, so browsers treat the files
  // as new assets and fetch them fresh.
  const jsHash = await hashDirectory(join(siteDirectory, 'js'));
  const distHash = await hashDirectory(join(siteDirectory, 'dist'));

  await rename(join(siteDirectory, 'js'), join(siteDirectory, `js.${jsHash}`));
  await rename(join(siteDirectory, 'dist'), join(siteDirectory, `dist.${distHash}`));

  console.log(`[build] js hash: ${jsHash}`);
  console.log(`[build] dist hash: ${distHash}`);

  // 7. Replace the __SITE_URL__ token in every HTML file in site/.
  const htmlFiles = await listHtmlFiles(siteDirectory);
  let survivingTokens = 0;
  for (const file of htmlFiles) {
    let html = await readFile(file, 'utf8');
    html = replaceSiteUrl(html, siteUrl);
    html = html.split('js/pages/').join(`js.${jsHash}/pages/`);
    html = html.split('dist/styles.css').join(`dist.${distHash}/styles.css`);
    await writeFile(file, html, 'utf8');
    if (html.includes('__SITE_URL__')) {
      survivingTokens += 1;
    }
  }

  // 8. Read the registry so sitemap.xml lists one room URL per live club.
  let liveClubs = [];
  try {
    const registry = JSON.parse(
      await readFile(join(rootDirectory, 'data/clubs.json'), 'utf8')
    );
    liveClubs = Array.isArray(registry.clubs)
      ? registry.clubs.filter((club) => club && club.status === 'live')
      : [];
  } catch (error) {
    warnings.push(`Could not read data/clubs.json for the sitemap: ${String(error.message)}`);
  }

  // 9. Write sitemap.xml (only when a site URL is known), robots.txt and _headers.
  if (siteUrl.length > 0) {
    const paths = ['/', '/about.html'];
    for (const club of liveClubs) {
      if (typeof club.id === 'string' && club.id.length > 0) {
        paths.push(`/room.html?club=${encodeURIComponent(club.id)}`);
      }
    }
    const sitemap = buildSitemap({ siteUrl, paths });
    await writeFile(join(siteDirectory, 'sitemap.xml'), sitemap, 'utf8');
  }

  const robots = buildRobots(siteUrl);
  await writeFile(join(siteDirectory, 'robots.txt'), robots, 'utf8');

  const workerOrigin = SUGGEST_API_BASE ? originOf(SUGGEST_API_BASE) : '';
  if (!SUGGEST_API_BASE) {
    warnings.push(
      'SUGGEST_API_BASE is empty, so the suggestion section is hidden and the Worker origin is not added to connect-src.'
    );
  }

  const headers = buildHeaders({ workerOrigin });
  await writeFile(join(siteDirectory, '_headers'), headers, 'utf8');

  // 10. Fail loudly if any token survived.
  if (survivingTokens > 0) {
    console.error(
      `[build] ${survivingTokens} html file(s) still contain the __SITE_URL__ token. This should not happen.`
    );
    return 1;
  }

  // 11. Summary and warnings.
  console.log('');
  console.log(`[build] site/ written with ${htmlFiles.length} html file(s).`);
  if (siteUrl.length > 0) {
    console.log(`[build] sitemap.xml, robots.txt and _headers written for ${siteUrl}`);
  } else {
    console.log('[build] robots.txt and _headers written, sitemap.xml skipped.');
  }

  if (warnings.length > 0) {
    console.log('');
    console.log('[build] WARNINGS:');
    for (const warning of warnings) {
      console.log(`  - ${warning}`);
    }
  }

  return 0;
}

const exitCode = await main();
process.exitCode = exitCode;