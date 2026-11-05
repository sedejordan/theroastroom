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
- **Stage 3 (next)**: share cards, suggestions form, branding and polish, deployment.

## Pages

| Page | Purpose |
| --- | --- |
| `index.html` | Public landing page. Hero, recent roast ticker, how it works, club picker. |
| `room.html?club=<id>` | Roast generator for one live club. Category filter, shuffle bag, roast card with receipts. |
| `tokens.html` | Developer preview of design tokens and theming. Not linked from public pages. |

## Files added in stage 2

```text
index.html                   Public landing page
room.html                    Roast generator page, opened as room.html?club=manutd
tokens.html                  Developer token preview, moved from stage 1
favicon.svg                  Inline SVG favicon, flame shape in club red and yellow
css/components.css           Shared component styles in Tailwind layers
js/pages/landing.js          Landing page logic
js/pages/room.js             Roast room logic
js/ui/roastCard.js           Roast card DOM builder
js/ui/categoryFilter.js      Category filter chip builder
js/ui/shuffleBag.js          Pure shuffle bag, no DOM
js/ui/reveal.js              Slot machine reel and fade in
js/utils/dom.js              Safe DOM helpers, no innerHTML with data
js/utils/links.js            roastUrl and parseRoastHash
tests/shuffleBag.test.mjs    node:test suite for the shuffle bag
```

## Requirements

- Node 18 or later
- npm

The only development dependency is Tailwind CSS, pinned to the 3.4 line.

## Run it locally

```bash
npm install
npm run css
npx serve .
```

Then open the URL that `serve` prints.

`fetch` needs an http origin, so opening the HTML files from the file system will not load
the registry. If you would rather not install `serve`, the Python standard library works:

```bash
python3 -m http.server 8000
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run css` | Compiles `src/input.css` to `dist/styles.css` once |
| `npm run watch` | Compiles the CSS and rebuilds on every change |
| `npm run validate` | Validates the registry and every club data file, exits 1 on any problem |
| `npm test` | Runs the schema and shuffle bag tests with the Node test runner |

## Folder structure

```text
index.html                 Public landing page
room.html                  Roast generator page
tokens.html                Developer token preview page
favicon.svg
package.json
tailwind.config.js
README.md
src/input.css
css/tokens.css
css/base.css
css/components.css
js/config.js
js/schema.js
js/registry.js
js/theme.js
js/pages/landing.js
js/pages/room.js
js/ui/roastCard.js
js/ui/categoryFilter.js
js/ui/shuffleBag.js
js/ui/reveal.js
js/utils/dom.js
js/utils/links.js
data/clubs.json
data/clubs/manutd.json
scripts/validate.mjs
tests/schema.test.mjs
tests/shuffleBag.test.mjs
tests/fixtures/
dist/
```

## Deep links

A roast has a stable hash based URL that points at the roast room for its club.

- Landing page: `/index.html`
- Roast room for Manchester United: `/room.html?club=manutd`
- A specific roast: `/room.html?club=manutd#trophies_last_league_title`

`js/utils/links.js` exports `roastUrl(clubId, roastId)` for building these URLs (this is
what share cards will use later) and `parseRoastHash(hash)` for reading them back. When a
visitor lands on `room.html` with a hash that matches a live roast, the roast is shown
immediately without the reveal animation.

When the visitor presses Roast them, the hash is updated with `history.replaceState` so
the URL always points at the visible roast, without pushing a new history entry and
without scrolling.

## Design tokens and theming

Every colour lives in `css/tokens.css` as a CSS custom property on `:root`. The default
values are the Manchester United theme. `tailwind.config.js` maps Tailwind colour keys such
as `background`, `surface` and `primary` onto those variables, so a club theme swap is a
CSS variable swap, not a rebuild.

`applyTheme(theme)` clears every theme property from the root first, then sets the keys you
pass, so a partial theme falls back to the defaults for the keys it does not set.
`clearTheme()` does the same reset without applying anything. Both keep the `theme-color`
meta tag in step.

## Club registry

`data/clubs.json` is the single source of truth for which clubs exist. `status` is either
`live` or `comingSoon`. A live club must have a `dataFile`. A coming soon club may omit
`dataFile` or declare one that does not exist yet, but the file is validated the moment it
exists.

## Roast schema

Every roast must satisfy all of the following:

| Field | Rule |
| --- | --- |
| `id` | Lowercase letters, digits and underscores, unique inside the club |
| `clubId` | Must match the club that owns the data file |
| `category` | Must exist in that club categories array |
| `headline` | The joke, 90 characters or fewer |
| `explanation` | Plain factual context, 280 characters or fewer |
| `evidence` | At least one item |
| `evidence[].claim` | A precise factual statement |
| `evidence[].period` | A season such as `2013/14` or a date such as `2021/09/11` |
| `evidence[].sourceName` | The publication or record the claim came from |
| `evidence[].sourceUrl` | Absolute URL starting with `https` |
| `evidence[].accessedOn` | Real calendar date the source was read, formatted `YYYY/MM/DD` |
| `verified` | Boolean, and it must be `true` for the roast to be published |
| `verifiedOn` | Required when `verified` is true, formatted `YYYY/MM/DD` |
| `tags` | Optional array of strings |

Dates are validated against the real calendar, so `2024/02/31` and `2023/02/29` are
rejected while `2024/02/29` is accepted.

**FAKE example. This is placeholder data that exists only to show the shape.**

```json
{
  "id": "fake_example_roast",
  "clubId": "fakeclub",
  "category": "trophyDroughts",
  "headline": "FAKE headline used to show the schema shape.",
  "explanation": "FAKE explanation used to show the schema shape.",
  "evidence": [
    {
      "claim": "FAKE claim used to show the evidence shape.",
      "period": "2013/14",
      "sourceName": "FAKE Source Name",
      "sourceUrl": "https://example.com/fakeSource",
      "accessedOn": "2024/01/15"
    }
  ],
  "verified": true,
  "verifiedOn": "2024/01/16",
  "tags": ["fake"]
}
```

## Content accuracy rules

1. Never invent a fact, a score, a statistic, a date or a URL.
2. Every claim needs a named source and a live `https` URL.
3. Every claim records the period it refers to.
4. A roast is published only when a human has set `verified` to `true` and dated it.
5. If a fact cannot be sourced, the roast is cut. It is not softened or hedged.
6. Sample and test data is labelled FAKE and is never loaded by the site.

The browser drops invalid roasts and logs a console warning with the roast id and the
reasons. The data gate is strict and fails the build.

## Adding a new club

1. Add the club to `data/clubs.json` with `id`, `name`, `shortName`, `status` set to
   `comingSoon`, `themeKey` and an optional `dataFile`.
2. Create `data/clubs/<clubid>.json` with club metadata, the full theme object, the
   categories array and an empty `roasts` array. The file is validated exactly like a live
   club file.
3. Run `npm run validate` and `npm test`. When both pass, change the registry status from
   `comingSoon` to `live` and run `npm run validate` again.

The orphan rule is strict: every file in `data/clubs` must be referenced by a `dataFile`
path on some registry entry, whatever the status of that entry.

## Accessibility and performance

- Semantic landmarks, a skip link, a `lang` attribute and one `h1` per page
- Visible focus rings driven by tokens, never colour alone
- Colour contrast checked against WCAG AA
- All motion runs through duration tokens and collapses under `prefers-reduced-motion`
- The roast reveal animation checks `prefers-reduced-motion` in JavaScript as well as
  CSS, so the reel is skipped entirely for users who ask for less motion
- The intermediate reel text is `aria hidden`; only the final roast is announced through
  a polite live region
- Fonts load with `preconnect` and `display=swap`, and every stack has a system fallback
- No frameworks, no bundlers and one development dependency

## Validation and tests

```bash
npm run validate
npm test
```

`npm run validate` fails on an invalid roast, a duplicate roast id, an unknown category,
an unknown club, a live club with no data file, an unreadable live data file, an invalid
data file on a coming soon club that declares one, an orphaned data file that no registry
entry references, or a malformed registry. `npm test` runs both the schema tests and the
shuffle bag tests with FAKE fixtures in `tests/fixtures/`.