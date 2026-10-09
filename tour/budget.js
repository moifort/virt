// What the island costs to draw, sector by sector: the triangles and the objects (meshes and
// instances) in each part of the island, and in all. Each weekly review writes the figures of
// its sector in tour/JOURNAL.md, so that the map grows richer without growing slow.
//
//   bun --preload ./test/setup.js tour/budget.js            every sector
//   bun --preload ./test/setup.js tour/budget.js port       one
//
// A baked mesh spans a whole zone: it is counted in the sector its middle stands in.
import * as THREE from 'three';
import { SECTORS, stops } from '../src/tour.js';
import { island } from '../test/world.js';

const REACH = 25; // metres round each of a sector's stops

/** The triangles of a mesh, every instance counted. */
function triangles(mesh) {
  const g = mesh.geometry;
  const per = (g.index ? g.index.count : g.attributes.position.count) / 3;
  return per * (mesh.isInstancedMesh ? mesh.count : 1);
}

/** The whole island's figures: the world lint holds them under a ceiling (test/budget). */
export function totals() {
  const { scene } = island();
  let tris = 0;
  let meshes = 0;
  let instances = 0;
  scene.traverse((obj) => {
    if (!obj.isMesh) return;
    tris += triangles(obj);
    if (obj.isInstancedMesh) instances += obj.count;
    else meshes++;
  });
  return { triangles: Math.round(tris), meshes, instances };
}

/** One sector's figures: what stands within its bounds. */
export function sector(name) {
  const { scene } = island();
  const points = stops(name);
  const inside = (v) => points.some((s) => (s.x - v.x) ** 2 + (s.z - v.z) ** 2 < REACH * REACH);
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  let tris = 0;
  let objects = 0;
  scene.updateMatrixWorld(true);
  scene.traverse((obj) => {
    if (!obj.isMesh) return;
    const g = obj.geometry;
    const per = (g.index ? g.index.count : g.attributes.position.count) / 3;
    if (obj.isInstancedMesh) {
      for (let i = 0; i < obj.count; i++) {
        obj.getMatrixAt(i, m);
        p.setFromMatrixPosition(m.premultiply(obj.matrixWorld));
        if (inside(p)) {
          tris += per;
          objects++;
        }
      }
    } else {
      if (!g.boundingSphere) g.computeBoundingSphere();
      if (inside(g.boundingSphere.center.clone().applyMatrix4(obj.matrixWorld))) {
        tris += per;
        objects++;
      }
    }
  });
  return { sector: name, triangles: Math.round(tris), objects };
}

if (import.meta.main) {
  const names = process.argv[2] ? [process.argv[2]] : SECTORS;
  console.log(JSON.stringify({ island: totals(), sectors: names.map(sector) }, null, 2));
}
