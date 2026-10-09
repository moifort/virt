# Details: richer, truer, more coherent

Nothing here is broken. The question is what would make this corner richer and more true to an
old Ligurian fishing village, in the map's own style, and what does not hang together.

Improve the detail:
- what people leave about: crates and nets on the quay, laundry, pots of basil on a sill, a
  chair by a door, a bicycle, a cat asleep on a step;
- the wear of real places: worn treads, a patched wall, moss in the joints, a faded shutter;
- what is too empty, too regular or too new: a blank wall, a row of identical houses, a square
  with nothing in it.

Correct the incoherences:
- scale: a door the avatar could not pass, a bench for a giant, a window too small;
- placement: a well in a lane, a lamp where no one walks, a garden on rock;
- variety: the same object repeated in the same pose, colours that clash.

At most three additions in a run, each subtle and in scale with the houses (village parts are
drawn at SCALE 2, see src/village.js). Prefer adding a variant to an existing generator over a
one-off object. Where a coherence rule can be stated (a door opens onto a way, a bench faces
something), make it a lint rule.
