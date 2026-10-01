# Valorea — Maintenance Regression Suite (ESM)

Playwright suite for `https://www.trailborn.com`, meant to be run after a
plugin update to confirm nothing on the pages broke.

It covers two things:

1. **Visual regression** — full-page screenshot diff for each page, on
   desktop (1440×900) and mobile (iPhone 15 Pro, forced to Chromium).

It does **not** re-test the pages' functional correctness (that's assumed
correct already) — it's purely a "did the last plugin update change
anything" trip-wire.

This project uses native ES modules (`import`/`export`) — `package.json` has
`"type": "module"` set, so no bundler or transpiler is needed.

## Setup (one-time)

```bash
nvm install 22.0
nvm use 22.0
npm install

npx playwright install           # macOS / Windows
npx playwright install --with-deps chromium   # Linux (CI)
```


## Create baselines

Before the first real run — or any time a visual/content change is
intentional and you want to accept it as the new baseline:

```bash
npm run test:update-baselines
```

This saves screenshots under
`tests/1-visual-regression/visual-regression.spec.js-snapshots/`. Commit that
folder to source control so the whole team diffs against the same baseline.

Linux baselines are what CI diffs against; `darwin` baselines let macOS devs
run locally. Baselines for other platforms aren't committed — if you run on
one, use `--update-snapshots` once.

## Run the suite (after a plugin update)

```bash
npm test
```

- Pass → nothing visually or functionally regressed on the pages covered.
- Fail on **visual regression** → open the HTML report (`npm run report`)
  and check the generated diff image. If the change is expected (e.g. the
  plugin update intentionally changed something), re-run
  `npm run test:update-baselines` to accept the new baseline.
- Fail on **contact form** → the plugin update likely changed Contact Form
  7's markup, validation messages, or broke its JS — check the shared
  selectors in `utils/selectors.js` and the helpers in `utils/wp-admin.js`
  before assuming it's a real bug.

## How the recipient swap works

The contact-form spec swaps the CF7 "To:" recipient to
`WP_TEST_RECIPIENT_EMAIL` in `test.beforeAll` and restores the original value
in `test.afterAll` (using a throwaway admin context). State lives in memory
only — there's no shared state file and no cross-file ordering, so the suite
is safe to run with multiple workers or to run just one spec file alone. If
the swap never happened (e.g. a failed login), the restore is skipped so the
live form is never clobbered.

## Happy path (optional)

By default the suite only exercises client-side validation and never submits
a fully valid entry. To also verify a successful submission (which sends a
real message to `WP_TEST_RECIPIENT_EMAIL`):

```bash
npm run test:happy-path
```

or set `RUN_HAPPY_PATH=1` in `.env`.

## Upgrading Playwright

Screenshots are sensitive to the browser version, so bump the pinned
`@playwright/test` version deliberately, not casually:

```bash
npm install --save-dev @playwright/test@<new-version>
npx playwright install chromium
npm run test:update-baselines   # regenerates every baseline
```

Then review the diffs (open the HTML report) — if the only changes are
browser rendering differences, commit the new baselines and the dependency
bump together.

## Notes on the flaky bits this suite accounts for

- **Lazy-loaded images**: `utils/lazy-load.js` simulates a real visitor
  before screenshotting — scrolls down in small increments to the bottom,
  pauses, scrolls back up to the top the same gradual way, pauses again —
  so every `loading="lazy"` image has actually fired, then confirms every
  `<img>` reports `complete` with real dimensions.
- **Leadspace video**: the homepage has an autoplaying, looping Vimeo
  background video. On video pages the Vimeo player is **blocked entirely**
  via `page.route`, paused via postMessage as belt-and-braces, and masked out
  of the screenshot diff in `utils/flaky-elements.js` — pixel-diffing a video
  that never holds still would fail on every single run.
- **Contact form**: tests only exercise client-side validation (empty
  fields, malformed email). The happy path, which completes a real
  submission, is off by default.

## Adding a page

Add an entry to `pages.config.js`:

```js
{ name: 'new-page', path: '/new-page/', hasLeadspaceVideo: false }
```

The visual spec picks it up automatically. Set `hasLeadspaceVideo: true` if
the page copies the homepage's Vimeo leadspace. Run
`npm run test:update-baselines` once to generate its initial screenshot
baseline.

## Troubleshooting

- If Playwright hangs in "loading" state, you likely have a Node/Playwright
  version mismatch — this repo pins Node 22 (`.nvmrc`) and Playwright
  `1.48.2`. Run `nvm install 22.0 && nvm use 22.0` and
  `npm ci` before running tests.
