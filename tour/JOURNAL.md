# Journal of the weekly review

Newest first. Each run adds an entry: date, week, kind (and theme), sector; what it found; what
it changed (commits); what it saw but left for later, and why; what the user turned down.

## 2026-10-23 — week 43 (kind: details; sector: port) — scheduled run, not run

- `bun test` green at the start (26 pass); budget of the port: 220 544 triangles / 5 549
  objects (island 3 153 390 triangles, 584 meshes, 98 631 instances), unchanged.
- Stopped before the pictures: starting the `jardins` dev server from the Browser pane was
  declined again, and nothing was listening on port 8742, so the tour
  (`?tour=port&out=port-details&yaws=0,1&zoom=26`) could not be taken. No change was made
  without pictures.
- Second scheduled run in a row stopped at the server (see week 42): the automated runs
  cannot start it without someone approving the pane. This week's port details review is
  still to do, by hand or with the server approved for the scheduled run.

## 2026-10-16 — week 42 (kind: defects; sector: shore) — scheduled run, not run

- `bun test` green at the start (26 pass); budget of the shore: 521.3 k triangles / 17 932
  objects (island 3 153 390 triangles, 584 meshes, 98 631 instances), unchanged since the
  run of 2026-10-14.
- Stopped before the pictures: starting the `jardins` dev server from the Browser pane was
  declined, so no tour could be taken. As the routine says, no change was made without
  pictures.
- Nothing lost: this week's shore defects review was already run by hand on 2026-10-14
  (entry below). The items it left for a details review (rocks of the shallows reading as
  floating from high up) still stand.

## 2026-10-14 — week 42 (kind: defects; sector: shore)

- Run by hand on the Tuesday at the user's request (the Saturday run had been stopped at the
  server). Twenty-five pictures of the tour, eight close-ups and three retakes.
- Found: the first stop of the shore tour fifty metres off the map, a picture of sky; a
  street lamp on the planks of the lighthouse keeper's landing stage, the very fault fixed on
  the harbour piers on 2026-10-09, unseen because the lighthouse rock and the stage were never
  handed to the lint; a rock of the shallows standing through a block of the lighthouse's
  jetty (seen by the lint once the rock was inspected); the ivory towels under the blue
  parasols invisible on the white sand, only their shadows showing.
- Changed: 8615d92 (shore stops kept on the map, test/tour), 9f931e6 (no shallows rock within
  24 m of the lighthouse rock), 0eed247 (the lighthouse rock and the landing stage inspected
  by every work-zone rule; the lamp on the shore at the stage's root), 808dfe5 (towel colours
  kept apart from the sand, test/palette).
- Budget of the shore: 524.4 k triangles / 18 048 objects before, 521.3 k / 17 932 after;
  island 3 153 270 → 3 153 390 triangles, 588 → 584 meshes, 98 638 → 98 631 instances.
- Checked and found sound: the keeper's gozzo clears the jetty by 0.4 m (it only looked
  moored over it); the beach bar's deck stands on a stone plinth on the slope; the belvedere
  stair above the cove lands on a round terrace with a bench.
- Seen, left alone: the round cutaway hole on a roof in the shore-90 picture is the hidden
  avatar carried to the stop, a tour artefact, not a fault; the lamp at the stage's root is
  hidden by a maple from the sea side; the rocks in the shallows read as floating from high
  up, as their white swell is faint at that zoom, a matter for a details review.

## 2026-10-10 — week 41 (kind: walk; sector: mountain)

- The first attempt that morning stopped before any picture: starting the `jardins` server
  was declined (fd268f4). Run again by hand the same day at the user's request.
- Found: the flock standing on boulders and half inside them on the pasture beside the summit
  (8 of 9 sheep walk into a stone within two minutes); the stone stair up the back wall of the
  astronomers' house laid across five of its windows; the trail from the observatory ending
  two metres short of the station's blind back wall (no door, no window on that face).
- Changed: bd7ec2a (sheep keep to free ground, test/life), e836679 (back windows laid out
  clear of the stair, test/facade), 0735668 (a back door, steps and upstairs windows where the
  trail reaches the station, test/station).
- Budget of the mountain: 249.0 k triangles / 6 199 objects before, 248.7 k / 6 199 after;
  island 3 153 150 → 3 153 270 triangles, 588 meshes, 98 638 instances (unchanged).
- Pictures: the 40 of the tour plus about a dozen close-ups and retakes (pasture, back of the
  house, back of the station), a little over the budget.
- Seen, left alone: from the pasture the station's tile roof reads as a flat orange slab over
  the crest, which is the building seen from above, not a fault; the steps between the
  observatory's two terraces are steep (0.32 m up for 0.34 m along) but within the avatar's
  stride; sheep may still graze inside a maquis bush, which only boulders are marked against.
  The station's back door is on the railway sector's building but serves the mountain trail;
  the railway review should look at its yard.

## 2026-10-09 — the reviews widened (set up by hand)

- Added the `walk` kind (the island at the avatar's height), the `life` and `views` themes of
  the macro review, and the drawing budget: `tour/budget.js` gives each sector's triangles and
  objects, and test/budget holds the island under a ceiling (3.6 M triangles, 680 meshes,
  115 k instances; 3.15 M, 588 and 98.6 k today).
- Budget of the sectors today (triangles / objects within 25 m of their stops): port 220 k /
  5.5 k; lower village 642 k / 14.4 k; upper village 506 k / 16.0 k; hamlet 179 k / 5.7 k;
  agora 825 k / 28.5 k; railway 313 k / 9.5 k; mountain 249 k / 6.2 k; shore 524 k / 18.0 k.

## 2026-10-09 — set up by hand (kind: defects; sectors: port, lower and upper village)

- Found on the harbour, from the user's annotated screenshot: the left pier stopping short of
  its lantern and cat; a boat hauled up over a bollard; fish stalls facing the sea; hollow steps
  down to the piers and onto the mole; a street lamp on the planks.
- Found by the lint and the tour: the well square five metres above the lane through it; a
  stair whose flights met at a corner at different heights; furniture in the middle of lanes;
  a roof through a lane; 104 boulders and outcrops hanging over the slope.
- Changed: b25af66, 95e09e0, a9f0e21 (all fixed, each with its lint rule).
- Left for later: where a stair lands on a lane the two cuts into the hillside do not blend
  (28 edges off by more than half a metre, 2 axis points, 2 parts across a way: the ratchets
  in test/ground and test/clearance). The hamlet's upper flight is very steep (ratchet). The
  avatar cannot walk on the piers or the mole, so two benches there are out of reach.
