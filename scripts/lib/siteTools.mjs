/**
 * Pure helpers for the site build. No file system, no process access, no
 * fetch. Everything here is deterministic and testable in isolation.
 */

/**
 * Escape a value for use as XML text.
 * @param {unknown} value
 * @returns {string}
 */
function escapeXml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Trim and normalise a site URL. Only https URLs and http URLs on localhost
 * or 127.0.0.1 are accepted, so the production build can never publish an
 * insecure origin. A trailing slash is stripped. Invalid input becomes an
 * empty string.
 * @param {string} raw
 * @returns {string}
 */
export function normaliseSiteUrl(raw) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (trimmed.length === 0) return '';

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return '';
  }

  const isHttps = parsed.protocol === 'https:';
  const isLocalhost =
    parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');

  if (!isHttps && !isLocalhost) return '';

  return parsed.href.replace(/\/+$/, '');
}

/**
 * Replace every __SITE_URL__ token in a string. When siteUrl is empty the
 * token is replaced with an empty string, so the placeholder can never
 * survive to production. The build is expected to warn in that case.
 * @param {string} html
 * @param {string} siteUrl
 * @returns {string}
 */
export function replaceSiteUrl(html, siteUrl) {
  if (typeof html !== 'string') return '';
  const replacement = typeof siteUrl === 'string' ? siteUrl : '';
  return html.split('__SITE_URL__').join(replacement);
}

/**
 * Return the origin of a URL, or an empty string. Never throws.
 * @param {string} url
 * @returns {string}
 */
export function originOf(url) {
  if (typeof url !== 'string' || url.length === 0) return '';
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

/**
 * Build a sitemap.xml body.
 * @param {{ siteUrl: string, paths: string[] }} options
 * @returns {string}
 */
export function buildSitemap(options) {
  const { siteUrl, paths } = options || {};
  const safeSite = typeof siteUrl === 'string' ? siteUrl : '';
  const list = Array.isArray(paths) ? paths : [];

  const entries = list
    .map((path) => `  <url>\n    <loc>${escapeXml(`${safeSite}${path}`)}</loc>\n  </url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

/**
 * Build a robots.txt body. The Sitemap line is included only when siteUrl is
 * known.
 * @param {string} siteUrl
 * @returns {string}
 */
export function buildRobots(siteUrl) {
  const safeSite = typeof siteUrl === 'string' ? siteUrl : '';
  const lines = ['User-agent: *', 'Allow: /'];
  if (safeSite.length > 0) {
    lines.push('');
    lines.push(`Sitemap: ${safeSite}/sitemap.xml`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Build the contents of a _headers file. The format is shared by Netlify and
 * Cloudflare Pages.
 *
 * style-src carries 'unsafe-inline' because the markup uses inline style
 * attributes (for example the hero card and the honeypot wrapper). No
 * inline scripts are used and no eval is used, so script-src stays at
 * 'self' with no 'unsafe-eval'.
 *
 * @param {{ workerOrigin: string }} options
 * @returns {string}
 */
export function buildHeaders(options) {
  const { workerOrigin } = options || {};
  const safeWorker = typeof workerOrigin === 'string' ? workerOrigin.trim() : '';

  const connectSrc = safeWorker.length > 0
    ? `connect-src 'self' ${safeWorker}`
    : `connect-src 'self'`;

  const csp =
    `default-src 'self'; ` +
    `script-src 'self'; ` +
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; ` +
    `font-src https://fonts.gstatic.com; ` +
    `img-src 'self' data:; ` +
    `${connectSrc}; ` +
    `frame-ancestors 'none'; ` +
    `base-uri 'self'; ` +
    `form-action 'self'; ` +
    `object-src 'none'`;

  return [
    '/*',
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
    '  X-Frame-Options: DENY',
    `  Content-Security-Policy: ${csp}`,
    '',
    '/dist/*',
    '  Cache-Control: public, max-age=300',
    '',
    '/js/*',
    '  Cache-Control: public, max-age=300',
    '',
    '/data/*',
    '  Cache-Control: public, max-age=300',
    '',
    '/favicon.svg',
    '  Cache-Control: public, max-age=86400',
    '',
    '/og.png',
    '  Cache-Control: public, max-age=86400',
    '',
    '/apple_touch_icon.png',
    '  Cache-Control: public, max-age=86400',
    '',
  ].join('\n');
}