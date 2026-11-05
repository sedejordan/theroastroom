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