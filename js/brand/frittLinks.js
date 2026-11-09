/**
 * Pure URL helper for Fritt campaign links. No DOM, no side effects.
 */

/**
 * Add the Fritt campaign parameters (utm_source, utm_medium, utm_campaign)
 * to a URL. Existing query parameters and the hash are preserved. Non http
 * links (mailto, tel, javascript, data) and anything that cannot be parsed
 * are returned unchanged.
 *
 * @param {string} baseUrl Base URL from frittConfig.
 * @param {string} placement Short placement label such as landingCta.
 * @returns {string}
 */
export function frittLink(baseUrl, placement) {
  if (typeof baseUrl !== 'string' || baseUrl.length === 0) return baseUrl;
  if (!/^https?:\/\//i.test(baseUrl)) return baseUrl;

  try {
    const url = new URL(baseUrl);
    url.searchParams.set('utm_source', 'roastroom');
    url.searchParams.set('utm_medium', 'site');
    url.searchParams.set(
      'utm_campaign',
      typeof placement === 'string' && placement.length > 0 ? placement : 'site'
    );
    return url.toString();
  } catch {
    return baseUrl;
  }
}