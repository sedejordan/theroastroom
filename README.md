# The Roast Room

The Roast Room is an interactive football banter site. Supporters pick a rival club and
read funny, embarrassing and painful facts about it. Every published roast is backed by
dated evidence that a human has checked.

The site launches with Manchester United live. Arsenal, Liverpool, Manchester City,
Chelsea and Tottenham Hotspur are listed as coming soon.

It is built by the solo web agency Fritt and doubles as a portfolio piece, so the code is
kept small, readable and easy to extend.

## Project status

- **Stage 1 (foundations)**: done. Design tokens, theming, club registry, roast schema,
  validation, developer token preview, documentation.
- **Stage 2 (public pages)**: done. Landing page, club picker, roast generator, shuffle
  bag, reveal animation, deep links, category filter, share ready roast URL helper.
- **Stage 3 (share cards)**: done. Branded roast cards, Post and Story formats, canvas
  rendering, system Share, Download image, Copy link, copy fallback, Card lab QA page,
  tests.
- **Stage 4 (next)**: suggestions form and Worker.
- **Stage 5**: branding polish and deployment.

## Pages

| Page | Purpose |
| --- | --- |
| `index.html` | Public landing page. Hero, recent roast ticker, how it works, club picker. |
| `room.html?club=<id>` | Roast generator for one live club. Category filter, shuffle bag, roast card with receipts, share panel. |
| `tokens.html` | Developer preview of design tokens and theming. Not linked from public pages. |
| `cardlab.html` | Developer only QA page for share cards. Not linked from public pages. |

## Files added in stage 3

```text
js/share/shareConfig.js      Share host override
js/share/cardFormats.js      Post and Story card dimensions
js/share/textLayout.js       Pure wrap, truncate and fit logic
js/share/shareText.js        Share text, file name and absolute URL helpers
js/share/renderCard.js       Canvas 2D roast card renderer
js/share/actions.js          Blob, download, share and clipboard actions
js/share/sharePanel.js       Share panel controller
js/dev/cardLab.js            Card lab logic
cardlab.html                 Developer only QA page
tests/shareText.test.mjs     Tests for pure share logic
## Project status (stage 5)

- **Stage 5 (launch polish)**: done. Fritt branding and call to action, about and privacy page, 404 page, share card ticket notch fix, social previews, sitemap and robots, `_headers` with a strict CSP, production build pipeline.

The site is now ready to deploy on a custom domain.

## Files added in stage 5

```text
js/brand/frittConfig.js       Fritt URLs
js/brand/frittLinks.js        Pure utm tagging helper
js/brand/applyFrittLinks.js   Wires up data-fritt-target anchors
js/pages/about.js             About page entry point
js/dev/ogImage.js             Developer page that draws og.png and apple_touch_icon.png
scripts/lib/siteTools.mjs     Pure build helpers
tests/siteTools.test.mjs      Tests for the build helpers and frittLink
about.html                    About and privacy page
404.html                      Not found page
ogimage.html                  Developer page for generating the social images
```

## Launch checklist

Before the site goes live:

1. Generate the two social images with `ogimage.html`. Open it in a browser, click **Download og.png** and **Download apple_touch_icon.png**, and save both files into the repository root. Commit them.
2. Update `ALLOWED_ORIGINS` in `worker/wrangler.toml` with your production site origin and any preview origins. Run `npx wrangler deploy` from the `worker` folder.
3. Set `SHARE_HOST_OVERRIDE` in `js/share/shareConfig.js` to the production host without a protocol, for example `roastroom.fritt.org`, so shared card footers show the right host before the domain exists.
4. Keep `about.html` accurate. If you ever add analytics, cookieless or otherwise, update the privacy section on that page before the analytics goes live.
5. Run `npm run validate` and `npm test` and confirm they pass.
6. Run `SITE_URL=https://your.domain npm run build` and confirm the summary has no surviving `__SITE_URL__` tokens and no unexpected warnings.
7. Deploy the `site/` folder.

## Hosting

The build is fully static: it compiles the CSS, copies the public pages, the javascript, the json data, the images, then writes `sitemap.xml`, `robots.txt` and `_headers` into `site/`. Both hosting platforms below are configured the same way.

### Netlify

Build settings:

- Build command: `npm run build`
- Publish directory: `site`
- Environment variable: `SITE_URL` set to the public URL of the site, for example `https://roastroom.fritt.org`. Netlify also sets `URL`, which the build script falls back to.

Custom domain on a subdomain such as `roastroom.fritt.org`:

1. In Netlify, open **Domain management** and add `roastroom.fritt.org` as a custom domain for the site.
2. In the DNS provider for `fritt.org`, create a `CNAME` record named `roastroom` pointing to the Netlify site address, for example `<yoursite>.netlify.app`.
3. Wait for DNS to propagate and for Netlify to provision the TLS certificate.

### Cloudflare Pages

Build settings:

- Framework preset: none
- Build command: `npm run build`
- Build output directory: `site`
- Environment variable: `SITE_URL` set to the public URL of the site. Cloudflare also sets `CF_PAGES_URL`, which the build script falls back to.

Custom domain:

1. In the Cloudflare Pages project, open **Custom domains** and add `roastroom.fritt.org`.
2. Because `fritt.org` is already on Cloudflare, the CNAME record is created automatically. If the zone is not on Cloudflare, add a `CNAME` record named `roastroom` pointing to `<project>.pages.dev`.

### After changing the Worker URL

Every time the Worker URL changes:

1. Paste the new URL into `js/suggest/suggestConfig.js` as `SUGGEST_API_BASE`.
2. Run `npm run build` so the CSP `connect-src` picks up the new origin.
3. Redeploy the `site/` folder.

### Final QA before launch

- Run the site locally with `npx serve site` and walk through the manual QA checklist.
- Open `index.html`, `room.html` and `about.html` and confirm there are no console errors, especially CSP violations.
- Share a roast URL in a chat app and confirm the social preview renders.
- Submit a suggestion and vote; approve it in `adminlab.html` and reload the landing page.
- Run a Lighthouse audit on a phone viewport with mobile throttling. Accessibility, best practices and SEO should each score 90 or above.