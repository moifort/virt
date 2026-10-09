# Defects: what is physically or logically wrong

Look for what a level designer checks before shipping a map, and correct it:

- things in the air: over the water off a pier, over a drop, on air beside a wall;
- things buried, or standing through one another (a boat over a bollard, a cat in a stall, a
  lamp in a wall, a tree through a roof or a path);
- ways that cannot be walked: stairs hollow underneath, stairs to nowhere, a step up or down
  where a stair meets a lane, a wall or a bench across a way, a square that is not level;
- things turned the wrong way (a stall to the sea, a bench to a wall, a door onto a drop);
- materials that do not belong (a street lamp on planks, stone treads on a wooden pier);
- seams and holes: gaps between ground and paving, z-fighting, a wall that stops short.

Every fault found becomes a lint rule before it is fixed, so that it cannot come back
anywhere on the island. The existing rules are in test/ (support, ground, walk, clearance,
harbour, geometry); extend them rather than adding near-copies.
