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
