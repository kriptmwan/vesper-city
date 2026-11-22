// Vesper City — procedural city generation.
// Builds one connected city from a seed: a road grid, six districts with their
// own palettes, buildings that never block a road, parks, the harbor water with
// docks and boats, and spawn points. Roads are the graph everything drives on.
import { WORLD, DISTRICTS } from './config.js';
import { makeRng, clamp } from './random.js';

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[DISTRICTS.length - 1];
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const { w, h, roadGap } = WORLD;
  const roadsV = []; // vertical road center x positions
  const roadsH = []; // horizontal road center y positions
  for (let x = roadGap; x < w; x += roadGap) roadsV.push(x);
  for (let y = roadGap; y < h; y += roadGap) roadsH.push(y);

  const buildings = [];
  const parks = [];
  const docks = [];
  const boats = [];
  const roadSet = new Set();
  const isRoad = (x, y) => {
    const near = (v, list) => list.some(r => Math.abs(v - r) < 42);
    return near(x, roadsV) || near(y, roadsH);
  };
  // Block grid: each block gets buildings or a park, never on a road.
  for (let bx = 0; bx < Math.floor(w / roadGap); bx++) {
    for (let by = 0; by < Math.floor(h / roadGap); by++) {
      const x0 = bx * roadGap + 52, y0 = by * roadGap + 52;
      const x1 = (bx + 1) * roadGap - 52, y1 = (by + 1) * roadGap - 52;
      if (x1 <= x0 || y1 <= y0) continue;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const d = districtAt(cx, cy);
      if (d.id === 'harbor') {
        // Harbor: water on the south half, docks on the north edge.
        if (by >= 5 && rng.chance(0.5)) {
          docks.push({ x: x0, y: y0, w: x1 - x0, h: 26, id: `dock-${bx}-${by}` });
        }
        continue;
      }
      if (rng.chance(0.10)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, trees: rng.int(3, 9) });
        continue;
      }
      const n = rng.int(2, 4);
      for (let i = 0; i < n; i++) {
        const bw = rng.range(70, 130), bh = rng.range(60, 110);
        const bx2 = rng.range(x0, Math.max(x0 + 1, x1 - bw));
        const by2 = rng.range(y0, Math.max(y0 + 1, y1 - bh));
        if (isRoad(bx2 + bw / 2, by2 + bh / 2)) continue;
        buildings.push({
          x: bx2, y: by2, w: bw, h: bh,
          height: d.id === 'downtown' ? rng.int(3, 9) : d.id === 'strip' ? rng.int(2, 4) : rng.int(1, 3),
          color: d.color, district: d.id, id: `b-${bx}-${by}-${i}`,
        });
      }
    }
  }
  // Boats drifting on the harbor water.
  for (let i = 0; i < 9; i++) {
    boats.push({ x: rng.range(200, w - 200), y: rng.range(1950, h - 120), angle: rng.angle(), speed: rng.range(8, 26), len: rng.range(46, 90) });
  }
  // Named landmarks the story and the HUD point at.
  const landmarks = [
    { name: 'Vesper Bank', x: 800, y: 1150, icon: '$' },
    { name: 'Vera\u2019s Garage', x: 620, y: 700, icon: 'G' },
    { name: 'Neon Grand Prix', x: 2700, y: 500, icon: 'R' },
    { name: 'The Kingpin\u2019s Villa', x: 2500, y: 1200, icon: 'K' },
    { name: 'Harbor Dead Drop', x: 2900, y: 2100, icon: 'D' },
  ];
  const spawn = { x: 620, y: 640, angle: 0 }; // outside Vera's Garage
  return {
    seed, roadsV, roadsH, buildings, parks, docks, boats, landmarks, spawn,
    roadWidth: 84,
    // Nearest point on any road to (x, y): used by traffic, GPS and spawns.
    nearestRoadPoint(x, y) {
      let best = null, bd = Infinity;
      for (const rx of roadsV) {
        const cy = clamp(y, 0, h);
        const d = (x - rx) * (x - rx) + (y - cy) * (y - cy);
        if (d < bd) { bd = d; best = { x: rx, y: cy }; }
      }
      for (const ry of roadsH) {
        const cx = clamp(x, 0, w);
        const d = (x - cx) * (x - cx) + (y - ry) * (y - ry);
        if (d < bd) { bd = d; best = { x: cx, y: ry }; }
      }
      return best;
    },
    // True when the circle (x, y, r) overlaps any building.
    hitsBuilding(x, y, r) {
      for (const b of buildings) {
        if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
      }
      return null;
    },
  };
}
