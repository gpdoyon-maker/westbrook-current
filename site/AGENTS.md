# Project Guide

## Layout

- `public/` contains static assets copied unchanged to the built site.
- `src/data/events.json` is the source of truth for event records.
- `src/layouts/` contains shared page chrome.
- `src/pages/` contains Astro routes: `index.astro` for Events and `about.astro` for About.
- `src/styles/` contains shared site styles.
- `DATA-FORMAT.md` documents the event JSON contract.

## Working Rules

- Never put secrets in files, source control, or generated artifacts.
- Work on branches; do not make project changes directly on the default branch.
- Ask before installing dependencies or deleting files, directories, or data.
- Keep event records in `src/data/events.json`, one record per event, and follow `DATA-FORMAT.md`.
- Compute the `TODAY` marker in the visitor's browser; never hard-code it into event data or page markup.
