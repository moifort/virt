# Journal of the weekly review

Newest first. Each run adds an entry: date, week, kind (and theme), sector; what it found; what
it changed (commits); what it saw but left for later, and why; what the user turned down.

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
