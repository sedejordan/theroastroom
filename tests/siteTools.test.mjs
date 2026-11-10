/**
 * Tests for the pure build and branding helpers. Node test runner only, no
 * extra dependencies.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildHeaders,
  buildRobots,
  buildSitemap,
  normaliseSiteUrl,
  originOf,
  replaceSiteUrl,
} from '../scripts/lib/siteTools.mjs';
import { frittLink } from '../js/brand/frittLinks.js';

test('normaliseSiteUrl accepts https and strips a trailing slash', () => {
  assert.equal(normaliseSiteUrl('https://example.com/'), 'https://example.com');
  assert.equal(normaliseSiteUrl('https://example.com'), 'https://example.com');
});

test('normaliseSiteUrl accepts http on localhost only', () => {
  assert.equal(normaliseSiteUrl('http://localhost:3000'), 'http://localhost:3000');
  assert.equal(normaliseSiteUrl('http://127.0.0.1:8000'), 'http://127.0.0.1:8000');
  assert.equal(normaliseSiteUrl('http://example.com'), '');
});

test('normaliseSiteUrl rejects garbage', () => {
  assert.equal(normaliseSiteUrl(''), '');
  assert.equal(normaliseSiteUrl('not a url'), '');
  assert.equal(normaliseSiteUrl(null), '');
  assert.equal(normaliseSiteUrl('ftp://example.com'), '');
});

test('replaceSiteUrl replaces every occurrence and leaves other text alone', () => {
  const html = '<a href="__SITE_URL__/about.html">__SITE_URL__</a>';
  assert.equal(
    replaceSiteUrl(html, 'https://example.com'),
    '<a href="https://example.com/about.html">https://example.com</a>'
  );
});

test('replaceSiteUrl uses an empty replacement when no site URL is known', () => {
  assert.equal(replaceSiteUrl('a __SITE_URL__ b', ''), 'a  b');
});

test('originOf returns the origin or an empty string', () => {
  assert.equal(originOf('https://example.com/path'), 'https://example.com');
  assert.equal(originOf('https://example.com'), 'https://example.com');
  assert.equal(originOf('not a url'), '');
  assert.equal(originOf(''), '');
});

test('buildSitemap produces a valid structure with one url per path', () => {
  const xml = buildSitemap({
    siteUrl: 'https://example.com',
    paths: ['/', '/about.html', '/room.html?club=manutd'],
  });
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /<loc>https:\/\/example\.com\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/example\.com\/about\.html<\/loc>/);
  assert.match(xml, /<loc>https:\/\/example\.com\/room\.html\?club=manutd<\/loc>/);
  const urlCount = (xml.match(/<url>/g) || []).length;
  assert.equal(urlCount, 3);
});

test('buildSitemap escapes XML metacharacters in the loc value', () => {
  const xml = buildSitemap({
    siteUrl: 'https://example.com',
    paths: ['/room.html?club=manutd&ref=foo'],
  });
  assert.match(xml, /&amp;ref=foo/);
  assert.ok(!xml.includes('&ref=foo'));
});

test('buildRobots includes a Sitemap line only when the site URL is known', () => {
  const withUrl = buildRobots('https://example.com');
  assert.match(withUrl, /^User-agent: \*$/m);
  assert.match(withUrl, /^Allow: \/$/m);
  assert.match(withUrl, /^Sitemap: https:\/\/example\.com\/sitemap\.xml$/m);

  const withoutUrl = buildRobots('');
  assert.match(withoutUrl, /^User-agent: \*$/m);
  assert.ok(!withoutUrl.includes('Sitemap:'));
});

test('buildHeaders adds the worker origin to connect-src when given', () => {
  const headers = buildHeaders({ workerOrigin: 'https://worker.example.com' });
  assert.match(headers, /connect-src 'self' https:\/\/worker\.example\.com/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /Referrer-Policy: strict-origin-when-cross-origin/);
  assert.match(headers, /X-Frame-Options: DENY/);
  assert.match(headers, /\/dist\/\*/);
  assert.match(headers, /Cache-Control: public, max-age=300/);
});

test('buildHeaders omits the worker origin when none is given', () => {
  const headers = buildHeaders({ workerOrigin: '' });
  assert.match(headers, /connect-src 'self';/);
  assert.ok(!headers.includes('https://worker.example.com'));
});

test('buildHeaders never contains unsafe-eval', () => {
  assert.ok(!buildHeaders({ workerOrigin: '' }).includes('unsafe-eval'));
  assert.ok(!buildHeaders({ workerOrigin: 'https://w.example.com' }).includes('unsafe-eval'));
});

test('frittLink adds the three utm parameters', () => {
  const href = frittLink('https://fritt.org', 'landingCta');
  assert.match(href, /utm_source=roastroom/);
  assert.match(href, /utm_medium=site/);
  assert.match(href, /utm_campaign=landingCta/);
});

test('frittLink preserves an existing query string and hash', () => {
  const withQuery = frittLink('https://fritt.org/?ref=foo', 'landingCta');
  assert.match(withQuery, /ref=foo/);
  assert.match(withQuery, /utm_source=roastroom/);

  const withHash = frittLink('https://fritt.org/#contact', 'landingCta');
  assert.match(withHash, /#contact$/);
  assert.match(withHash, /utm_source=roastroom/);
});

test('frittLink leaves mailto and other non http links unchanged', () => {
  assert.equal(frittLink('mailto:hello@fritt.org', 'x'), 'mailto:hello@fritt.org');
  assert.equal(frittLink('tel:+1234567890', 'x'), 'tel:+1234567890');
});

test('frittLink returns invalid input unchanged', () => {
  assert.equal(frittLink('', 'x'), '');
  assert.equal(frittLink('not a url', 'x'), 'not a url');
});