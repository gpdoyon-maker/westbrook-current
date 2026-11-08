# Westbrook Currents Site

## Accessibility is a standing requirement
Every change to this site must meet **WCAG 2.1 Level AA**. This applies to pages, components, styles and new content, and an accessibility failure is a bug to fix before merging, not a later cleanup. Gerald wants this as a real commitment and an honest selling point.

### Before every pull request
A GitHub check named "Accessibility check" (`.github/workflows/accessibility.yml`, script `site/scripts/a11y-check.mjs`) scans every built page with axe at desktop and phone widths on each pull request, and fails on any violation. Run it locally with `npm run build && node scripts/a11y-check.mjs` from `site/` (first `npm install --no-save playwright@1.47.2 @axe-core/playwright@4.10.0` and `npx playwright install chromium`). It doesn't replace the steps below.

1. Run axe-core against each changed page and each page type it affects, including its open or expanded states.
2. Check any new interaction with the keyboard alone.
3. Fix all errors. If one can't be fixed, say so in the pull request and tell Gerald.

### After every deploy that changes a page
Run the changed pages through WAVE (`https://wave.webaim.org/report#/<page URL>`). Fix any errors or contrast errors, and review its alerts, which need judgment rather than automatic fixes.

### Building it right
- **Contrast:** at least 4.5:1 for text and 3:1 for large text and meaningful graphics. Reuse the color tokens in `global.css` instead of adding new colors, and check the tokens on every background they sit on.
- **Text size:** don't use type below 11px.
- **Headings:** use real heading tags in order. Don't style a paragraph to look like a heading.
- **Images:** give meaningful images alt text, and meaningful SVGs `role="img"` with an `aria-label`. Give decorative SVGs `aria-hidden="true"`.
- **Controls:** every control needs a visible label or an accessible name. Don't nest a link or button inside another interactive element, such as a `<summary>`.
- **Color:** never use color alone to convey meaning.
- **Keyboard:** everything must work by keyboard, with visible focus. Keep the skip link working.
- **Layout:** pages must work at phone width and at 200% zoom, and new layouts need checking at both.
- **Print:** new TL;DW! features must still work with Save or print.
- **PDFs:** don't add a public PDF unless it is tagged for accessibility or the same content is on an accessible web page.

### How to describe this publicly
Automated tools check only part of WCAG. Accurate wording today is "passes automated WCAG 2.1 AA scans." Don't say "WCAG compliant" or "ADA compliant" until screen reader, zoom and full keyboard testing are done and the untagged guide PDFs are resolved.

## TL;DW! summaries
Each meeting's JSON file in `site/src/data/tldw-summaries/` is the master copy. There are no meeting PDFs. The workflow is in `PROCESS.md` in the Westbrook City Council Meetings folder.
