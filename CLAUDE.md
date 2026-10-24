# Westbrook Currents (westbrookcurrents.com)

This is the live site's code repo (`gpdoyon-maker/westbrook-current`, Astro 5 static site in
`site/`, deploys to GitHub Pages on push to `main`). **Read `site/AGENTS.md` (working rules)
and `site/DATA-FORMAT.md` (events/notices JSON contract) before touching anything in `site/`.**
This file covers what those two don't: who Gerry is, how he wants to work, and where the rest
of this project lives outside this one repo.

## This is one of three places for Westbrook Currents work

Gerry Doyon runs this site alongside two related projects, each in its own folder with its own
`CLAUDE.md` — read the relevant one before working there, don't assume this file's rules carry
over:
- **This repo** — the site's actual code and deploy pipeline.
- **`~/Documents/Claude Work Folder/Westbrook Currents/`** — working materials *about* this
  site: architecture notes, research (Housing, budget-data analysis), content templates, a
  git-backed README. Not the site code — a backup of the knowledge behind it.
- **`~/Documents/Claude Work Folder/Westbrook City Council Meetings/`** — a separate pipeline
  producing City Council meeting summaries, which feeds the site's planned "TL;DW!" pillar page.
  Its own `CLAUDE.md`/`PROCESS.md` are the standing rules there.

If a question or task clearly belongs to one of the other two, say so and point there rather
than guessing at missing context.

## Who Gerry is, how he wants to work

- Gerry Doyon, Westbrook, ME. IT background, not a programmer; visual learner. He merges
  everything himself on GitHub — **never push to `main`, branch first, one branch at a time**
  (he merges branches himself, usually within a minute or two of asking).
- Brief, direct answers. Flag risks and mistakes in his plans rather than just complying.
  Plain language (about 7th-grade reading level) on anything public-facing.
- Ask before installing dependencies or deleting anything.
- **For any Apps Script change, give him the ENTIRE file**, not a snippet — he pastes whole
  files into the Apps Script editor, so a diff or partial snippet isn't usable.
- Secrets only in Script Properties, never in chat or files.
- `gh pr create` is blocked in this environment (GraphQL); open PRs with
  `gh api repos/gpdoyon-maker/westbrook-current/pulls -f title=... -f head=... -f base=main`.
  Pushing a merged branch name again does not reopen its old PR — open a new one.
  The session-stop hook can say "unpushed commits, no remote branch" even when everything is
  pushed; verify with `git ls-remote --heads origin <branch>` instead of trusting the hook.

## Where things live beyond this repo

- **Google Drive** (all Sheets/Docs for the site stay in Gerry's website folder — standing
  rule): the events Sheet ("Currents"), the Partnerships & Outreach Log, the private Feedback
  Sheet, and the Community Resources Tracker (Programs/Change Log — the source of truth for
  every phone number, dollar amount, and date that appears on a Get Help page: nothing goes
  live until its row is Review State = Verified, Publish? = Yes). Exact Drive folder/Sheet IDs
  are in Claude's project memory (`project_westbrook_currents`) — ask Claude to recall it, or
  check `../Westbrook Currents/claude-memory/project_westbrook_currents.md` for a periodic
  backup copy, rather than re-deriving them from scratch.
- **Currents Event Manager** — a self-contained HTML page published as a private, pinned
  claude.ai artifact (phone app), not stored in this repo at all. It drives the live events
  Sheet directly through the Google Sheets MCP connector. To change it: read it with the
  Artifact tool by URL (in memory), edit, republish to the same URL. See memory for the
  current URL/version and the mechanics (fingerprint-guarded writes, publish-trigger flow).
- **Architecture (how submit → review → publish actually flows), the Get Help "Gold Standard"
  page format, and current open items/status** are intentionally NOT duplicated into this
  file — they change often enough that a static file goes stale fast (that's exactly what
  happened to the old hand-pasted resume prompt this file replaces). They live in Claude's
  project memory instead, which updates as work happens and persists across sessions
  automatically. Ask Claude to recall project memory for `westbrookcurrents.com` at the start
  of a session if picking up open work.

## To resume work here

1. `git log origin/main -5` and check open PRs/branches — don't assume local state matches.
2. Read `site/AGENTS.md` and `site/DATA-FORMAT.md`.
3. Ask Claude to recall its memory for this project for current architecture notes and open
   items, rather than assuming this file has them.
4. Do not merge anything yourself — branch, push, and let Gerry merge.

---
Superseded the hand-pasted "resume prompt" workflow (see
`../Westbrook Currents/resume-prompt_10-16-2026.md`, now marked historical) — this file is
auto-loaded at the start of every session here, so nothing needs to be pasted in by hand.
