# Project Guide

## Layout

- `public/` contains static assets copied unchanged to the built site.
- `src/data/events.json` is the source of truth for event records.
- `src/data/notices.json` holds notices and alerts; see the notices section of `DATA-FORMAT.md`.
- `src/layouts/` contains shared page chrome.
- `src/components/` contains shared components, such as `NoticeList.astro` for notices and alerts.
- `src/lib/` contains shared helpers.
- `src/pages/` contains Astro routes: `index.astro` for the front door (two tiles and the next three events), `events.astro` for the full Events calendar, `about.astro` for About, and `help/` for the Get Help pages (`help/index.astro` is the topic list, `help/heating.astro` is the first topic).
- `src/data/help-*.json` holds the content for each Get Help page, one file per topic. Page layout stays in `src/pages/help/`; shared pieces are `ProgramCard.astro` and `HelpDisclaimer.astro`.
- `src/styles/` contains shared site styles.
- `DATA-FORMAT.md` documents the event JSON contract.

## Working Rules

- Never put secrets in files, source control, or generated artifacts.
- Work on branches; do not make project changes directly on the default branch.
- Ask before installing dependencies or deleting files, directories, or data.
- Keep event records in `src/data/events.json`, one record per event, and follow `DATA-FORMAT.md`.
- Compute the `TODAY` marker in the visitor's browser; never hard-code it into event data or page markup.
- Every notice or alert needs an official source link and an expiry date; decide whether it is showing in the visitor's browser.
- Get Help pages: every program shows its official source link and a "Last checked" date. Do not add a program, phone number, dollar amount or date unless Gerry has verified it in the Community Resources tracker (Review State = Verified, Publish? = Yes). Every Get Help page ends with `HelpDisclaimer.astro`.
- Do not put street addresses for agencies on Get Help pages. Residents call first and are told where to go.
- **Every new Factual Perceptions page needs its own social share image before Gerry posts it anywhere.** `SiteLayout.astro` defaults `og:image`/`twitter:image` to the sitewide logo (`public/logo-desktop.png`, 2600x560, ~4.6:1). Facebook and LinkedIn crop shared-link images to roughly 1.91:1, so that wide logo gets cut down to an unreadable sliver — confirmed on Facebook's Sharing Debugger when this happened on `/perceptions/water-rate`. Fix: build a page-specific 1200x630 image and pass it via the optional `image` prop on `<SiteLayout ... image="/og-your-page-slug.png">`. Other page types (Get Help, events, etc.) can keep using the default logo; this only matters for pages Gerry is actively going to share as a link.
  - **How to build the image** (no design tool needed): write a plain HTML file styled to 1200x630 using the site's palette (`--navy: #00243d` background, `--cyan: #42bfe8` / `--blue: #087ca7` accents) with the page's eyebrow tag, headline, one-line dek, and 1-2 key stat callouts (see `public/og-pwd-water-rate-2027.png` as the reference example). Local `file://` pages hit a CSP that blocks Google Fonts and can't be screenshotted reliably, so copy the HTML into `site/public/` temporarily, run `npm run dev`, and load it from `http://localhost:<port>/that-file.html` in the browser pane. Set the viewport to 1200x630 and screenshot — the browser pane's screenshot tool caps out around 800px wide, so upscale the result back to exactly 1200x630 with `sips --resampleHeightWidth 630 1200 in.jpg --out out.png -s format png` before saving it into `public/` and deleting the temporary HTML file from `public/`.
