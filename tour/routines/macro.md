# Macro: the island as a living whole

One theme at a time (tour/plan.js gives it). Look at the whole sector and at how things behave,
not at one object; compare the runs of the week with each other.

## nature
How the vegetation sits on the land, as it would on a real Ligurian coast: holm oaks, pines and
maquis on the wild slopes, olives and vines on the terraces, cypresses by houses and chapels,
reeds and figs in the damp hollows, little or nothing on bare rock and cliffs; species by
height, exposure and slope; density that thins toward the summit and the rock; clearings,
undergrowth and the edges of woods; nothing growing on a path, a roof or in the sea; trees
upright, not leaning out of the slope; roots and trunks that meet the ground. Fix it in
src/nature.js (where each species grows, how dense, how bedded), and make a rule of it when it
can be measured (a tree on a way, a trunk in the air, a species where it cannot live).

## wind-and-foliage
The `calm` and `windy` runs take each stop four times, half a second apart. Compare the frames:
does everything that the wind moves move with it (crowns, grass, reeds, laundry, sails, flags,
smoke, falling leaves, the sea), all the same way, by amounts that suit their size? Nothing
should sway in the calm that would not, nothing should stand stiff in the wind, and no two
things should disagree on where the wind comes from. The wind lives in src/climate.js and the
shaders in src/style.js.

## seasons
The same stops in spring, summer, autumn and winter. The Indian summer (each broadleaf tree
turning red in its own time, never yellow or gold), bare trees in winter, buds in March, snow
only in the heart of winter and on the peaks, evergreens that stay green; the season reads at
a glance in each picture. Calendar in src/climate.js (`leafYear`), colours in src/style.js.

## light
Dawn, noon, sunset and night. Shadows fall away from the sun and do not drift; the low sun
warms the faces turned to it; at night the street lamps are lit, windows light up house by
house, the harbour and the lanes are cosy and safe, and nothing that should glow stays dark
(or glows by day). Lights: src/kit.js (`lamplight`), world.js (`lampMap`), src/style.js.

## weather
Cloudy, rain, snow and mist. Delicate always: a light rain and snow that never hide the view;
the world carries the weather (puddles, gutters running, snow on roofs, trees and walls, wet
paving that shines); mist that softens the distance without greying the near. src/climate.js,
src/weather.js, src/style.js.
