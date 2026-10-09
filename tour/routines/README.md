# The weekly review of the island

A scheduled Claude session runs this once a week. Each run looks at **one part of the island**
with **one kind of review**, fixes or improves what it can, and leaves the map a little better
than it found it. Over the weeks every kind of review meets every part of the island.

The repository is a hobby project: commit and **push straight to `main`**, no branch, no pull
request. Every commit message says in detail what was wrong or missing, what changed, and how
it was checked.

## Procedure

1. **Start clean.** In `/Users/thibaut/Code/game`: `git pull --rebase`, `bun install`,
   `bun test`. If the lint fails before you change anything, fixing that is this week's work.
2. **This week's plan.** `bun --preload ./test/setup.js tour/plan.js` prints the kind
   (`defects`, `details` or `macro`, with a theme), the sector and the tour URLs to open.
3. **Read before you look.** The routine of the kind (`tour/routines/<kind>.md`); the last
   entries of `tour/JOURNAL.md` (what earlier runs did, left for later, or were told not to
   do); the art direction in the auto-memory, `art-direction-realistic-cinque-terre.md`.
   What the user decided there is not to be undone.
4. **Take the pictures.** Start the dev server with the Browser pane's `preview_start`
   (name `jardins`, port 8742; check with `lsof -a -p <pid> -d cwd` that it serves this
   repository). Open each tour URL in the pane and wait for `tour/shots/<out>/manifest.json`.
   A hidden pane draws nothing by itself; the tour drives its own frames.
5. **Look at every picture** with the Read tool. For anything doubtful take a close-up:
   `?tour=spots&spots=x,z;x,z` (the manifest gives each stop's x, z). Measure before you
   believe: sample the ground and the objects headless (test/world.js builds the island
   under bun) rather than trusting a picture alone.
6. **Act, at most five changes in a run.** One logical change at a time:
   - if the fault can be stated as a rule, write the lint rule first (test/, see the existing
     tests), see it fail, then fix the generator; if a rule cannot pass yet, make it a ratchet
     (`expectAtMost`) with the reason in a comment;
   - fix at the source, in the generator (src/), never by moving one object by hand;
   - `bun test` green, then take the same stops again and compare before and after;
   - commit (`type(scope): description`, body in detail, the attribution line), push to main.
7. **Write the journal.** Add an entry at the top of `tour/JOURNAL.md`: the date, week, kind,
   theme and sector; what was found; what was changed (commits); what was seen but left for
   later, and why. Commit and push it.
8. **Report** in French, in a few lines: what changed, with one before and one after picture
   sent to the user (SendUserFile), and what is left.

## Limits

- About forty pictures and five changes per run; stop well before that if the run grows long.
- Keep to the sector of the week. Note anything seen elsewhere in the journal instead.
- Nothing that slows the game: no new per-frame work, no thousands of new meshes (instance
  them as the existing code does). The figures are in the auto-memory, `performance-budget.md`.
- Nothing the art direction forbids (pink blossom, a yellow wash, drifting shadows,
  anything fantastical, set pieces foreign to a Ligurian fishing village), and nothing the
  user asked to remove.
- No change to the camera, the controls, the avatar or the UI.
- If the dev server or the pane cannot be reached, or the Mac is locked (no frame is drawn),
  write that in the journal and stop.
