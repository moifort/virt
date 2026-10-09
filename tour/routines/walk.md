# Walk: the island at the avatar's height

The pictures are taken close and low, from every corner, as a player sees the island while
he walks it. Look for what spoils a walk, and fix it:

- places a player would want to reach and cannot: a pier, the mole, a beach, a terrace, a
  bench, the end of a lane; places he can reach but should not (into a wall, onto a roof);
- passages too narrow for him, steps too high for his stride, a lane that ends at a drop with
  no wall to lean on;
- the camera: a wall or a roof that hides him and does not open its round window, a tree that
  hides a whole square, a turn of the view that leaves him behind something;
- what he walks past: a door that cannot be a door (too small, onto nothing), a seat he cannot
  sit on, a sign of life missing where people would be.

The avatar's rules are in src/player.js (a tile of 1.25 m, a step up of 2.6 m at most, never
into the sea or through a house); test/walk holds the reachability of the ways, squares, zones
and seats. A place found out of reach becomes a check there before it is fixed. Making the
piers, the jetty and the mole walkable (the decks stand over the water, where the ground is
the sea bed) is known work left for later: see the journal.
