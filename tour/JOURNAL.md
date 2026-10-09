# Journal of the weekly review

Newest first. Each run adds an entry: date, week, kind (and theme), sector; what it found; what
it changed (commits); what it saw but left for later, and why; what the user turned down.

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
