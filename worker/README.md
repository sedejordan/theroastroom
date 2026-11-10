# Roast Room Suggestions Worker

Cloudflare Worker that backs the audience participation section on the
landing page: suggestions and voting. Built with plain JavaScript ES modules
and Workers KV. No frameworks.

## Layout

```text
worker/
  package.json
  wrangler.toml
  src/
    index.js    routing and KV access
    logic.js    pure logic, no Cloudflare APIs
  README.md
```

## Endpoints

All responses are JSON encoded as UTF 8. Errors are shaped `{ error, message }`
with no stack traces.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | /api/suggestions | none | Public leaderboard. Approved only, sorted by votes then name, cached for 30 seconds. |
| POST | /api/suggestions | origin | Submit a suggestion or merge into a vote. Body `{ name, website }`. |
| POST | /api/votes | origin | Vote for an approved suggestion. Body `{ slug }`. |
| GET | /api/admin/suggestions | Bearer | Every suggestion with timestamps. |
| POST | /api/admin/approve | Bearer | Body `{ slug, approved }`. |
| POST | /api/admin/remove | Bearer | Body `{ slug }`. |
| OPTIONS | any route | none | CORS preflight, 204. |

`Bearer` means the `Authorization` header must equal `Bearer <ADMIN_TOKEN>` and
the token is compared in constant time. A failed comparison returns 401 with
no detail. An unset `ADMIN_TOKEN` rejects every admin request.

An unknown route returns 404 JSON.

## Storage

Two kinds of key in the `SUGGESTIONS` namespace.

- `board` holds
  `{ version: 1, suggestions: { [slug]: { name, votes, approved, createdAt, updatedAt } } }`.
  The board is capped at 300 suggestions. A full board returns a friendly
  message and writes nothing.
- `rl:<hash>:<YYYYMMDD>` holds `{ actions, voted: [slug] }` for one client per
  UTC day, expiring after 172800 seconds (two days). `hash` is the first 32
  hex characters of `SHA-256(HASH_SALT + CF-Connecting-IP)`. The raw IP
  address is never stored and never logged.

Limits:

- 6 actions per day per client. Suggestions and votes both count as actions.
- One vote per slug per day per client.
- An accepted action performs exactly two KV writes: the rate record and the
  board. A rejected action performs no writes.

The Workers KV free plan allows about 1000 writes per day. Because every
accepted action is two writes, that is about 500 accepted actions per day on
the free plan. Plan accordingly.

## Roast submissions

Fan roast submissions use a second KV key, `roastboard`, holding
`{ version: 1, submissions: { [id]: { ... } } }`. Ids are `fan_` plus a short
lowercase base 36 string. The board is capped at 200 submissions.

Each submission records `status` as `pending`, `approved` or `rejected`. Only
approved submissions are returned by `GET /api/roasts`, and only after the
admin ticked the source check. Approved submissions become roasts that pass
`validateRoast` from `js/schema.js` on the client.

Endpoints:

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | /api/roast_submissions | origin | Submit a roast. Body `{ clubId, category, headline, explanation, claim, period, sourceName, sourceUrl, website }`. |
| GET | /api/roasts?club=<id> | none | Approved roasts for one club, cached for 60 seconds. |
| GET | /api/admin/roast_submissions | Bearer | Every submission, pending first. |
| POST | /api/admin/roast_submissions/update | Bearer | Edit the text fields of one submission. |
| POST | /api/admin/roast_submissions/approve | Bearer | Body `{ id, checkedSource: true }`. |
| POST | /api/admin/roast_submissions/reject | Bearer | Body `{ id }`. |
| POST | /api/admin/roast_submissions/remove | Bearer | Body `{ id }`. |

Rate limit: at most 2 roast submissions per client per UTC day, and roast
submissions also count toward the existing 6 actions per day limit. An accepted
submission performs exactly two KV writes (rate record and `roastboard`).

`LIVE_CLUB_IDS` in `wrangler.toml` is a comma separated list of club ids that
accept submissions. It defaults to `manutd` when unset.

## Consistency

KV is eventually consistent. Two simultaneous writes can lose a vote. This is
accepted for stage 4. If exact counts ever matter, replace KV with Durable
Objects. Nothing in this Worker depends on exact counts for correctness.

## Origin allow list

`ALLOWED_ORIGINS` in `wrangler.toml` is a comma separated string of allowed
origins. A request that carries an `Origin` header not on the list is rejected
with 403 on POST routes and receives no CORS headers on any route. Requests
without an `Origin` header, such as `curl`, are allowed; CSRF protection comes
from the browser sending an `Origin` header on cross origin POSTs.

## Name and slug rules

- Trim and collapse runs of whitespace to one space.
- 2 to 40 characters.
- Allowed characters are letters in any language, digits, spaces, apostrophe,
  full stop and ampersand.
- Reject anything containing `http`, `www` or an at sign.
- Reject digits only.
- The slug is lowercase a to z, digits and underscores. Accented letters are
  stripped of diacritics first, so `Atlético` becomes `atletico`.

## Local development

```bash
cd worker
npm install
npx wrangler login
npx wrangler dev
```

`wrangler dev` runs the Worker locally against a development KV namespace.
Replace the `id` placeholder in `wrangler.toml` after you create the real
namespace.

## Deployment

1. `cd worker`
2. `npm install`
3. `npx wrangler login`
4. `npx wrangler kv namespace create SUGGESTIONS`
   Copy the `id` from the output and paste it over the placeholder in
   `wrangler.toml`.
5. `npx wrangler secret put ADMIN_TOKEN`
   Paste a long random value, for example the output of
   `openssl rand -hex 32`. This is the password you type on `adminlab.html`.
6. `npx wrangler secret put HASH_SALT`
   Paste another long random value, for example the output of
   `openssl rand -hex 32`. This salts the client hash used for rate limiting.
   Rotate it only if you accept that rate limits reset for everyone.
7. `npx wrangler deploy`
   The output prints the deployed URL, for example
   `https://roastroomsuggest.yourname.workers.dev`.
8. Paste that URL into `js/suggest/suggestConfig.js` as `SUGGEST_API_BASE`.
9. Update `ALLOWED_ORIGINS` in `wrangler.toml` with your real site origins,
   replacing the Netlify placeholder, and run `npx wrangler deploy` again.

## Manual smoke test

```bash
# Public leaderboard
curl -s https://roastroomsuggest.yourname.workers.dev/api/suggestions

# Submit a suggestion
curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"name":"Arsenal","website":""}' \
  https://roastroomsuggest.yourname.workers.dev/api/suggestions

# Vote
curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"slug":"arsenal"}' \
  https://roastroomsuggest.yourname.workers.dev/api/votes

# Admin list
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://roastroomsuggest.yourname.workers.dev/api/admin/suggestions

# Admin approve
curl -s -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slug":"arsenal","approved":true}' \
  https://roastroomsuggest.yourname.workers.dev/api/admin/approve

# Wrong origin is blocked
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: https://evil.example" \
  -d '{"name":"Arsenal","website":""}' \
  https://roastroomsuggest.yourname.workers.dev/api/suggestions
# Expect 403
```