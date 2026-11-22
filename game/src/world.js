// Vesper City — simulation: the player, cars, traffic, pedestrians, police,
// the wanted system, the ten-mission story engine, territory, economy and save.
// Missions are data-driven steps (see config.js): each step is one verb the
// player performs, and the engine below is generic over step types.
import { WORLD, DISTRICTS, MISSIONS, WEAPONS, CREW, GARAGE_TIERS, RESPECT_RANKS, TUNING } from './config.js';
import { buildCity, districtAt } from './city.js';
import { makeRng, clamp, dist, angleTo, angleDiff } from './random.js';
import { createAudio } from './audio.js';

let uid = 1;

export function createWorld(seed) {
  const rng = makeRng(seed);
  const city = buildCity(seed);
  const audio = createAudio();
  const state = {
    seed, city, rng, audio,
    time: 9.5 * 3600, // 09:30, bright morning
    weather: 0, rain: 0, rainTimer: 40,
    wanted: 0, wantedFloat: 0,
    cash: 250, respect: 0, missionIndex: 0, missionStep: 0,
    garageTier: 1, upgrades: { armor: 0, engine: 0 },
    territory: { marina: 'voss', oldtown: 'voss', strip: 'voss', downtown: 'voss', heights: 'voss', harbor: 'voss' },
    incomeTimer: TUNING.dayLength,
    player: {
      x: city.spawn.x, y: city.spawn.y, angle: 0, hp: 100, speed: 0,
      inCar: false, carId: null, weapon: 1, ammo: [Infinity, 60, 120, 24, 90, 4],
      onFoot: true, dead: false, aim: 0,
    },
    cars: [], peds: [], bullets: [], effects: [], decals: [],
    heli: { x: 0, y: 0, angle: 0, active: false, spotlight: 0 },
    roadblocks: [],
    mission: null, banner: null, bannerT: 0,
    crewCooldown: { juno: 0, bishop: 0, sable: 0 },
    activeCrew: 0,
    stats: { kills: 0, carsStolen: 0, distance: 0, missionsDone: 0 },
    paused: false, gameOver: false, started: false, won: false,
    message: null, messageT: 0,
    tailSuspicion: 0, hackProgress: 0, holdTimer: 0, raceCheckpoint: 0,
    rivalCars: [],
  };
  spawnTraffic(state);
  spawnPeds(state);
  spawnParked(state);
  startMission(state, 0);
  return state;
}

export function respectRank(respect) {
  let r = RESPECT_RANKS[0];
  for (const rank of RESPECT_RANKS) if (respect >= rank.at) r = rank;
  return r;
}

export function garageTier(state) { return GARAGE_TIERS[state.garageTier - 1]; }

function makeCar(state, kind, x, y, angle, color) {
  const car = {
    id: uid++, kind, x, y, angle, speed: 0, color,
    hp: kind === 'police' ? 90 : kind === 'swat' ? 160 : kind === 'van' ? 130 : 70,
    maxHp: kind === 'police' ? 90 : kind === 'swat' ? 160 : kind === 'van' ? 130 : 70,
    w: 46, h: 22, onFire: false, fireT: 0, dead: false, target: null,
    roadDir: angle, cruise: 120 + state.rng.range(0, 90),
  };
  state.cars.push(car);
  return car;
}

function spawnTraffic(state) {
  for (let i = 0; i < TUNING.trafficCount; i++) {
    const p = state.city.nearestRoadPoint(state.rng.range(100, WORLD.w - 100), state.rng.range(100, WORLD.h - 100));
    const angle = state.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    makeCar(state, 'traffic', p.x + state.rng.range(-30, 30), p.y + state.rng.range(-30, 30), angle,
      state.rng.pick(['#c8b060', '#7fa8c8', '#c87f7f', '#8fc87f', '#b0b0b8', '#d8a0c0']));
  }
}

function spawnPeds(state) {
  for (let i = 0; i < TUNING.pedCount; i++) {
    state.peds.push({
      x: state.rng.range(100, WORLD.w - 100), y: state.rng.range(100, WORLD.h - 100),
      angle: state.rng.angle(), speed: state.rng.range(28, 55),
      state: 'walk', fleeT: 0, color: state.rng.pick(['#e8c8a0', '#a0c8e8', '#e8a0a0', '#c8e8a0', '#d8d8d8']),
    });
  }
}

function spawnParked(state) {
  for (let i = 0; i < TUNING.parkedCount; i++) {
    const p = state.city.nearestRoadPoint(state.rng.range(100, WORLD.w - 100), state.rng.range(100, WORLD.h - 100));
    const angle = state.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    makeCar(state, 'parked', p.x + state.rng.range(-24, 24), p.y + state.rng.range(-24, 24), angle,
      state.rng.pick(['#b09030', '#6090b0', '#b06060', '#70a070', '#9090a0']));
  }
}

export function playerCar(state) {
  if (!state.player.inCar) return null;
  return state.cars.find(c => c.id === state.player.carId) || null;
}

export function addWanted(state, n, reason) {
  state.wantedFloat = clamp(state.wantedFloat + n, 0, TUNING.maxWanted);
  state.wanted = Math.floor(state.wantedFloat);
  if (reason) showMessage(state, reason);
}

export function showMessage(state, text, dur) {
  state.message = text; state.messageT = dur || 3;
}

export function showBanner(state, title, sub) {
  state.banner = { title, sub: sub || '' }; state.bannerT = 4;
}

export function startMission(state, index) {
  const m = MISSIONS[index];
  if (!m) { state.won = true; showBanner(state, 'KINGPIN OF VESPER', 'Vesper City is yours, Rook.'); return; }
  state.missionIndex = index; state.missionStep = 0;
  state.mission = { def: m, step: 0, done: false };
  state.tailSuspicion = 0; state.hackProgress = 0; state.holdTimer = 0; state.raceCheckpoint = 0;
  state.rivalCars = [];
  showBanner(state, `MISSION ${index + 1}: ${m.name.toUpperCase()}`, m.text);
  state.audio.click();
}

export function missionObjective(state) {
  if (!state.mission) return 'Vesper City is yours.';
  const m = state.mission.def;
  return `${m.name}: ${m.text}`;
}

function completeMission(state) {
  const m = state.mission.def;
  state.cash += m.reward;
  state.respect += m.respect;
  state.stats.missionsDone++;
  showBanner(state, 'MISSION COMPLETE', `${m.name}  +$${m.reward}  +${m.respect} respect`);
  state.audio.missionDone();
  addWanted(state, -1);
  startMission(state, state.missionIndex + 1);
}

// --- damage / explosions ---------------------------------------------------
export function damageCar(state, car, dmg, fromX, fromY) {
  if (car.dead) return;
  car.hp -= dmg;
  if (car.hp <= 0) {
    car.dead = true; car.onFire = true; car.fireT = 0;
    // Ambient traffic just burns out — if every plowed-through sedan
    // exploded, ramming the mission van through traffic would be suicide
    // (each blast is 60 damage to everything nearby, including the player).
    // Mission/combat cars (police, SWAT, van, player, courier) still blow up.
    if (car.kind !== 'traffic' && car.kind !== 'parked') {
      explode(state, car.x, car.y, 130);
      state.audio.explosion();
    }
    if (car.kind === 'police' || car.kind === 'swat') addWanted(state, 0.5);
  }
}

export function explode(state, x, y, radius) {
  state.effects.push({ type: 'explosion', x, y, t: 0, life: 0.7, radius });
  state.decals.push({ type: 'scorch', x, y, r: radius * 0.7 });
  for (const car of state.cars) {
    if (!car.dead && dist(x, y, car.x, car.y) < radius + 30) damageCar(state, car, 60, x, y);
  }
  for (const p of state.peds) {
    if (dist(x, y, p.x, p.y) < radius) { p.state = 'flee'; p.fleeT = 4; }
  }
  if (dist(x, y, state.player.x, state.player.y) < radius) {
    state.player.hp -= 25;
    if (state.player.hp <= 0) killPlayer(state);
  }
}

export function killPlayer(state) {
  if (state.player.dead) return;
  state.player.dead = true; state.gameOver = true;
  showBanner(state, 'WASTED', 'Vera is not happy. Press R to restart.');
}

// --- crew abilities ---------------------------------------------------------
export function useCrew(state, i) {
  const crew = CREW[i];
  if (!crew || state.crewCooldown[crew.id] > 0) return false;
  state.crewCooldown[crew.id] = crew.cooldown;
  state.activeCrew = i;
  if (crew.id === 'juno') {
    addWanted(state, -2, 'JUNO: Ghost Hack — heat is off you');
    state.hackProgress = 100; // instant-breach if a hack is running
  } else if (crew.id === 'bishop') {
    state.roadblocks = [];
    showMessage(state, 'BISHOP: Ram Truck cleared the roadblock');
    // A truck smashes the nearest cop car.
    const pc = state.cars.find(c => c.kind === 'police' && !c.dead);
    if (pc) damageCar(state, pc, 200, state.player.x, state.player.y);
  } else if (crew.id === 'sable') {
    const pc = playerCar(state);
    if (pc) { pc.hp = pc.maxHp; showMessage(state, 'SABLE: Ghost Ride — your car is fixed up'); }
    else {
      const p = state.city.nearestRoadPoint(state.player.x, state.player.y);
      const car = makeCar(state, 'player', p.x, p.y, 0, '#e0b030');
      state.player.inCar = true; state.player.carId = car.id;
      showMessage(state, 'SABLE: Ghost Ride delivered — get in');
    }
  }
  state.audio.pickup();
  return true;
}

// --- entering / stealing cars ------------------------------------------------
export function nearestStealableCar(state, maxDist) {
  let best = null, bd = maxDist;
  for (const car of state.cars) {
    if (car.dead || car.kind === 'player') continue;
    // Only parked/traffic cars can be stolen — never the mission van, a
    // police car, or the courier (entering the van would break mission 3).
    if (car.kind !== 'parked' && car.kind !== 'traffic') continue;
    const d = dist(state.player.x, state.player.y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

export function enterCar(state, car) {
  state.player.inCar = true; state.player.carId = car.id;
  state.player.x = car.x; state.player.y = car.y; state.player.angle = car.angle;
  if (car.kind === 'parked' || car.kind === 'traffic') {
    car.kind = 'player';
    state.stats.carsStolen++;
    addWanted(state, 1, 'Car stolen — the law noticed');
    state.audio.pickup();
  }
  if (state.mission && state.mission.def.id === 'm1' && state.missionStep === 0) {
    state.missionStep = 1; completeMission(state);
  }
}

export function exitCar(state) {
  const car = playerCar(state);
  if (!car) return;
  state.player.inCar = false; state.player.carId = null;
  state.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  state.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  state.player.angle = car.angle;
  car.speed = 0;
}

// --- shooting ----------------------------------------------------------------
export function shoot(state, tx, ty) {
  const p = state.player;
  const w = WEAPONS[p.weapon];
  if (p.ammo[p.weapon] <= 0 && p.weapon !== 0) { showMessage(state, 'Out of ammo — find a gun shop'); return; }
  if (p.ammo[p.weapon] !== Infinity) p.ammo[p.weapon]--;
  const ox = p.inCar ? (playerCar(state) || p).x : p.x;
  const oy = p.inCar ? (playerCar(state) || p).y : p.y;
  const base = Math.atan2(ty - oy, tx - ox);
  const shots = w.id === 'shotgun' ? 5 : 1;
  for (let i = 0; i < shots; i++) {
    const a = base + (shots > 1 ? (i - 2) * 0.09 : 0);
    state.bullets.push({ x: ox, y: oy, angle: a, speed: TUNING.bulletSpeed, dmg: w.dmg, life: w.range / TUNING.bulletSpeed, from: 'player' });
  }
  state.effects.push({ type: 'muzzle', x: ox + Math.cos(base) * 26, y: oy + Math.sin(base) * 26, t: 0, life: 0.08 });
  state.audio.shoot(w.id);
  addWanted(state, 0.15);
}

// --- police ------------------------------------------------------------------
function ensureCops(state) {
  const want = state.wanted;
  const target = want === 0 ? 0 : want === 1 ? 2 : want === 2 ? 3 : want === 3 ? 5 : want === 4 ? 6 : 8;
  let have = state.cars.filter(c => (c.kind === 'police' || c.kind === 'swat') && !c.dead).length;
  while (have < target) {
    const ang = state.rng.angle();
    const x = clamp(state.player.x + Math.cos(ang) * 700, 60, WORLD.w - 60);
    const y = clamp(state.player.y + Math.sin(ang) * 700, 60, WORLD.h - 60);
    makeCar(state, want >= 5 && have % 3 === 0 ? 'swat' : 'police', x, y, ang, want >= 5 && have % 3 === 0 ? '#20242e' : '#204080');
    have++;
  }
  // Heli at 4+.
  state.heli.active = want >= 4;
  if (state.heli.active) {
    state.heli.x += (state.player.x - state.heli.x) * 0.02;
    state.heli.y += (state.player.y - state.heli.y) * 0.02;
  }
  // Roadblocks at 3+: police cars parked across the road ahead of the player.
  if (want >= 3 && state.roadblocks.length === 0 && state.player.inCar) {
    const pc = playerCar(state);
    const ahead = 520;
    const bx = pc.x + Math.cos(pc.angle) * ahead, by = pc.y + Math.sin(pc.angle) * ahead;
    const p = state.city.nearestRoadPoint(bx, by);
    for (let i = -1; i <= 1; i++) {
      const off = i * 40;
      const rx = p.x + Math.cos(pc.angle + Math.PI / 2) * off;
      const ry = p.y + Math.sin(pc.angle + Math.PI / 2) * off;
      const rb = makeCar(state, 'police', rx, ry, pc.angle + Math.PI / 2, '#204080');
      rb.speed = 0; rb.roadblock = true;
      state.roadblocks.push(rb.id);
    }
    showMessage(state, 'ROADBLOCK AHEAD');
    state.audio.siren();
  }
  if (want < 3) state.roadblocks = [];
}

// --- traffic / peds ------------------------------------------------------------
// Shared road-following: steer to the nearest road, then along it,
// sometimes turning at intersections. Used by traffic and by the mission van.
function steerOnRoads(state, car, dt, turnChance) {
  const p = state.city.nearestRoadPoint(car.x, car.y);
  const onRoad = dist(car.x, car.y, p.x, p.y) < 30;
  if (!onRoad) {
    car.angle += angleDiff(car.angle, angleTo(car.x, car.y, p.x, p.y)) * 2 * dt;
    car.speed = Math.min(car.speed + 200 * dt, car.cruise * 0.7);
  } else {
    const nearV = state.city.roadsV.some(r => Math.abs(car.x - r) < 26);
    const nearH = state.city.roadsH.some(r => Math.abs(car.y - r) < 26);
    if (nearV && nearH && state.rng.chance(turnChance)) car.angle += (state.rng.chance(0.5) ? 1 : -1) * Math.PI / 2;
    car.speed = Math.min(car.speed + 160 * dt, car.cruise);
  }
}

function updateTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.kind !== 'traffic') continue;
    if (car.dead) continue;
    steerOnRoads(state, car, dt, 0.004);
    // Don't rear-end the player.
    const pc = playerCar(state);
    if (pc && dist(car.x, car.y, pc.x, pc.y) < 90) car.speed = Math.max(0, car.speed - 500 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 40, WORLD.w - 40); car.y = clamp(car.y, 40, WORLD.h - 40);
  }
}

function updatePeds(state, dt) {
  for (const p of state.peds) {
    if (p.state === 'flee') {
      p.fleeT -= dt;
      const a = angleTo(state.player.x, state.player.y, p.x, p.y);
      p.angle = a;
      p.x += Math.cos(a) * 130 * dt; p.y += Math.sin(a) * 130 * dt;
      if (p.fleeT <= 0) p.state = 'walk';
    } else {
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      if (state.rng.chance(0.002)) p.angle = state.rng.angle();
      if (state.city.hitsBuilding(p.x, p.y, 6)) p.angle += Math.PI / 2;
      p.x = clamp(p.x, 40, WORLD.w - 40); p.y = clamp(p.y, 40, WORLD.h - 40);
    }
  }
}

function updateCops(state, dt) {
  for (const car of state.cars) {
    if ((car.kind !== 'police' && car.kind !== 'swat') || car.dead || car.roadblock) continue;
    const target = state.player;
    const d = dist(car.x, car.y, target.x, target.y);
    const wantAngle = angleTo(car.x, car.y, target.x, target.y);
    car.angle += clamp(angleDiff(car.angle, wantAngle), -2.4 * dt, 2.4 * dt);
    const want = car.kind === 'swat' ? 460 : TUNING.copSpeed;
    car.speed = Math.min(car.speed + 420 * dt, d < 120 ? want * 0.6 : want);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (d < 46) {
      // Ram the player.
      const pc = playerCar(state);
      if (pc) { damageCar(state, pc, 14 * dt, car.x, car.y); }
      else { state.player.hp -= 8 * dt; if (state.player.hp <= 0) killPlayer(state); }
      if (state.rng.chance(0.02)) state.audio.crash();
    }
    if (state.city.hitsBuilding(car.x, car.y, 20)) {
      car.angle += Math.PI * 0.75; car.speed *= 0.5;
    }
  }
}

// --- missions ------------------------------------------------------------------
function missionTargetPos(state) {
  const m = state.mission.def;
  return m.target;
}

function updateMission(state, dt) {
  const m = state.mission;
  if (!m || m.done) return;
  const p = state.player;
  const t = missionTargetPos(state);
  const dTarget = dist(p.x, p.y, t.x, t.y);
  switch (m.def.id) {
    case 'm1': // steal a car (completed by enterCar)
      break;
    case 'm2': { // tail the courier
      const courier = state.cars.find(c => c.kind === 'courier');
      if (!courier) {
        // Spawn on the nearest road so the tail is drivable, not through blocks.
        const rp = state.city.nearestRoadPoint(t.x, t.y);
        const c = makeCar(state, 'courier', rp.x, rp.y, 0, '#d8c040');
        const onV = state.city.roadsV.some(r => Math.abs(rp.x - r) < 30);
        c.angle = onV ? Math.PI / 2 : 0;
        c.cruise = 120;
        state.mission.courier = c;
        state.mission.startTime = state.time; // tail clock starts when the courier spawns
      } else {
        // Courier drives the road grid (gentle weave via intersection turns).
        steerOnRoads(state, courier, dt, 0.004);
        courier.x += Math.cos(courier.angle) * courier.speed * dt;
        courier.y += Math.sin(courier.angle) * courier.speed * dt;
        courier.x = clamp(courier.x, 40, WORLD.w - 40); courier.y = clamp(courier.y, 40, WORLD.h - 40);
        const d = dist(p.x, p.y, courier.x, courier.y);
        if (d < 110) state.tailSuspicion += 30 * dt;
        else if (d > 520) state.tailSuspicion += 8 * dt; // lost him
        else state.tailSuspicion -= 4 * dt;
        state.tailSuspicion = clamp(state.tailSuspicion, 0, 100);
        if (state.tailSuspicion >= 100) { showMessage(state, 'SPOTTED — the courier made you'); state.tailSuspicion = 0; addWanted(state, 1); }
        if (state.time > state.mission.startTime + 240) completeMission(state);
      }
      break;
    }
    case 'm3': { // breach the prison van
      let van = state.cars.find(c => c.kind === 'van');
      if (!van) {
        // Spawn on the nearest road, not the raw target (which sits in a block).
        const rp = state.city.nearestRoadPoint(t.x, t.y);
        van = makeCar(state, 'van', rp.x, rp.y, 0, '#c8c8c8');
        // Start along the road it spawns on (south on a vertical road,
        // east on a horizontal one) so it drives the grid, not through blocks.
        const onV = state.city.roadsV.some(r => Math.abs(rp.x - r) < 30);
        van.angle = onV ? Math.PI / 2 : 0;
        van.roadDir = van.angle;
        van.cruise = 130; state.mission.van = van;
        showMessage(state, 'Ram the van, then stay close while Juno hacks it');
      } else {
        if (!van.dead) { // a burning wreck stays put while Juno hacks it
          steerOnRoads(state, van, dt, 0.004);
          van.x += Math.cos(van.angle) * van.speed * dt;
          van.y += Math.sin(van.angle) * van.speed * dt;
          van.x = clamp(van.x, 40, WORLD.w - 40); van.y = clamp(van.y, 40, WORLD.h - 40);
        }
        const d = dist(p.x, p.y, van.x, van.y);
        const pc = playerCar(state);
        if (pc && d < 70 && pc.speed > 200) { damageCar(state, van, 30, p.x, p.y); state.audio.crash(); }
        if (van.hp < van.maxHp * 0.55) {
          if (d < 200) {
            state.hackProgress += 34 * dt;
            if (state.hackProgress >= 100) { showMessage(state, 'JUNO: lock open — grab the prisoner'); completeMission(state); }
          }
        }
      }
      break;
    }
    case 'm4': { // bank heist
      if (dTarget < 90) {
        if (state.mission.step === 0) {
          state.mission.step = 1;
          showMessage(state, 'Inside the bank — grab the cash (loud) or slip to the vault (quiet)');
          state.cash += 0;
        } else if (state.mission.step === 1) {
          // Grab cash over 4 seconds inside the bank zone.
          state.holdTimer += dt;
          if (state.holdTimer > 4) completeMission(state);
        }
      }
      break;
    }
    case 'm5': { // street race: 5 checkpoints
      const cps = state.mission.checkpoints || (state.mission.checkpoints = [
        { x: 2700, y: 500 }, { x: 2900, y: 200 }, { x: 2400, y: 800 }, { x: 2900, y: 700 }, { x: 2700, y: 500 },
      ]);
      const cp = cps[state.raceCheckpoint];
      if (cp && dist(p.x, p.y, cp.x, cp.y) < 90) {
        state.raceCheckpoint++;
        showMessage(state, `Checkpoint ${state.raceCheckpoint}/5`);
        state.audio.pickup();
        if (state.raceCheckpoint >= 5) completeMission(state);
      }
      break;
    }
    case 'm6': { // boat chase: reach the dead drop on the water
      if (state.player.inCar && dist(p.x, p.y, t.x, t.y) < 110) completeMission(state);
      break;
    }
    case 'm7': { // rescue Juno
      if (state.mission.step === 0 && dTarget < 90) {
        state.mission.step = 1;
        showMessage(state, 'Juno is with you — get her to Vera\u2019s Garage');
      } else if (state.mission.step === 1 && dist(p.x, p.y, 620, 700) < 110) {
        completeMission(state);
      }
      break;
    }
    case 'm8': { // takeover: hold the Strip
      if (districtAt(p.x, p.y).id === 'strip') {
        state.holdTimer += dt;
        if (state.holdTimer > 10) {
          state.territory.strip = 'player';
          showMessage(state, 'THE STRIP IS YOURS — income +$150/day');
          completeMission(state);
        }
      } else state.holdTimer = Math.max(0, state.holdTimer - dt);
      break;
    }
    case 'm9': { // smuggle: reach the drop with heat under control
      if (dTarget < 110 && state.wanted <= 2) completeMission(state);
      else if (dTarget < 110) showMessage(state, 'Too hot — lose the heat before the drop');
      break;
    }
    case 'm10': { // finale: take down Voss
      if (state.mission.step === 0 && dTarget < 200) {
        state.mission.step = 1;
        showMessage(state, 'Voss is here — take him down');
        const boss = makeCar(state, 'police', t.x + 60, t.y, 0, '#101018');
        boss.hp = 300; boss.maxHp = 300; state.mission.boss = boss;
      } else if (state.mission.step === 1 && state.mission.boss && state.mission.boss.dead) {
        completeMission(state);
      }
      break;
    }
    default: break;
  }
}

// --- main update -----------------------------------------------------------------
export function update(state, input, dt) {
  dt = Math.min(dt, 0.05);
  if (state.paused || state.gameOver) return;
  if (!state.started) return;
  const p = state.player;
  state.time += dt * 12; // game clock runs 12x
  if (state.time >= 24 * 3600) state.time -= 24 * 3600;
  state.rainTimer -= dt;
  if (state.rainTimer <= 0) {
    state.rainTimer = state.rng.range(25, 70);
    state.raining = !state.raining;
    state.weather = state.raining ? 1 : 0;
  }
  // Income per controlled district, once a day-length.
  state.incomeTimer -= dt;
  if (state.incomeTimer <= 0) {
    state.incomeTimer = TUNING.dayLength;
    const owned = Object.values(state.territory).filter(t => t === 'player').length;
    if (owned > 0) { state.cash += owned * TUNING.incomePerDistrict; showMessage(state, `Territory income +$${owned * TUNING.incomePerDistrict}`); }
  }
  // Wanted decay when the law loses you.
  const copsNear = state.cars.some(c => (c.kind === 'police' || c.kind === 'swat') && !c.dead && dist(c.x, c.y, p.x, p.y) < 420);
  if (!copsNear && state.wantedFloat > 0) state.wantedFloat = Math.max(0, state.wantedFloat - TUNING.wantedDecay * dt);
  state.wanted = Math.floor(state.wantedFloat);
  for (const k of Object.keys(state.crewCooldown)) state.crewCooldown[k] = Math.max(0, state.crewCooldown[k] - dt);
  if (state.bannerT > 0) state.bannerT -= dt;
  if (state.messageT > 0) state.messageT -= dt;

  // --- player movement ---
  const pc = playerCar(state);
  if (p.inCar && pc && !pc.dead) {
    const fwd = (input.up ? 1 : 0) - (input.down ? 0.6 : 0);
    const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    const maxSpeed = (TUNING.carMaxBase + state.upgrades.engine * 60) * (pc.kind === 'player' ? 1 : 0.9);
    pc.speed += fwd * TUNING.carAccel * dt;
    if (input.handbrake) { pc.speed *= (1 - 2.2 * dt); spawnDriftSmoke(state, pc); }
    else pc.speed *= (1 - 0.5 * dt);
    if (!input.up && !input.down) pc.speed *= (1 - 1.2 * dt);
    pc.speed = clamp(pc.speed, -160, maxSpeed);
    const grip = TUNING.carGrip * (input.handbrake ? 0.5 : 1);
    pc.angle += steer * grip * dt * clamp(Math.abs(pc.speed) / 160, 0, 1.4) * Math.sign(pc.speed || 1);
    const nx = pc.x + Math.cos(pc.angle) * pc.speed * dt;
    const ny = pc.y + Math.sin(pc.angle) * pc.speed * dt;
    const hit = state.city.hitsBuilding(nx, ny, 20);
    if (hit) {
      // Slide along the wall instead of stopping dead.
      const nx2 = pc.x + Math.cos(pc.angle) * pc.speed * dt;
      const ny2 = pc.y + Math.sin(pc.angle) * pc.speed * dt;
      if (!state.city.hitsBuilding(nx2, pc.y, 20)) { pc.x = nx2; }
      else if (!state.city.hitsBuilding(pc.x, ny2, 20)) { pc.y = ny2; }
      else { pc.speed *= 0.4; if (Math.abs(pc.speed) > 240) { damageCar(state, pc, 8, pc.x, pc.y); state.audio.crash(); } }
    } else { pc.x = nx; pc.y = ny; }
    p.x = pc.x; p.y = pc.y; p.angle = pc.angle; p.speed = pc.speed;
    state.stats.distance += Math.abs(pc.speed) * dt;
    if (Math.abs(pc.speed) > 60) state.audio.engine(Math.abs(pc.speed) / maxSpeed);
    // Car vs car bumps.
    for (const other of state.cars) {
      if (other === pc || other.dead) continue;
      const d = dist(pc.x, pc.y, other.x, other.y);
      if (d < 44 && d > 0.01) {
        const push = (44 - d) / 2;
        const a = angleTo(other.x, other.y, pc.x, pc.y);
        pc.x += Math.cos(a) * push; pc.y += Math.sin(a) * push;
        other.x -= Math.cos(a) * push; other.y -= Math.sin(a) * push;
        if (Math.abs(pc.speed) > 200) { damageCar(state, other, 12, pc.x, pc.y); if (other.kind === 'traffic' || other.kind === 'parked') addWanted(state, 0.2); }
      }
    }
  } else if (!p.inCar) {
    const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const sp = (input.run ? TUNING.playerRun : TUNING.playerWalk);
    const len = Math.hypot(mx, my) || 1;
    const nx = p.x + (mx / len) * sp * dt * (mx || my ? 1 : 0);
    const ny = p.y + (my / len) * sp * dt * (mx || my ? 1 : 0);
    if (!state.city.hitsBuilding(nx, p.y, 12)) p.x = nx;
    if (!state.city.hitsBuilding(p.x, ny, 12)) p.y = ny;
    if (mx || my) p.angle = Math.atan2(my, mx);
    p.speed = (mx || my) ? sp : 0;
  }

  // Shooting (mouse aim stored by main.js in input.aimX/aimY, world coords).
  if (input.shoot && input.aimX !== undefined) {
    if (!state._shootT) state._shootT = 0;
    state._shootT -= dt;
    if (state._shootT <= 0) {
      shoot(state, input.aimX, input.aimY);
      state._shootT = WEAPONS[p.weapon].rate;
    }
  } else state._shootT = 0;

  // Bullets.
  for (const b of state.bullets) {
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    if (state.city.hitsBuilding(b.x, b.y, 2)) { b.life = 0; state.decals.push({ type: 'mark', x: b.x, y: b.y, r: 3 }); }
    for (const car of state.cars) {
      if (car.dead || car === pc) continue;
      if (dist(b.x, b.y, car.x, car.y) < 26) { damageCar(state, car, b.dmg, b.x, b.y); b.life = 0; break; }
    }
    for (const ped of state.peds) {
      if (dist(b.x, b.y, ped.x, ped.y) < 12) {
        ped.state = 'flee'; ped.fleeT = 5;
        state.stats.kills++;
        addWanted(state, 0.4, 'Pedestrian down');
        b.life = 0; break;
      }
    }
  }
  state.bullets = state.bullets.filter(b => b.life > 0);

  // Effects.
  for (const e of state.effects) e.t += dt;
  state.effects = state.effects.filter(e => e.t < e.life);
  for (const car of state.cars) {
    if (car.onFire) {
      car.fireT += dt;
      if (Math.random() < 0.3) state.effects.push({ type: 'smoke', x: car.x, y: car.y, t: 0, life: 1.2 });
      if (car.fireT > 1.2 && !car.dead) { car.dead = true; explode(state, car.x, car.y, 120); }
    }
  }

  updateTraffic(state, dt);
  updatePeds(state, dt);
  ensureCops(state);
  updateCops(state, dt);
  updateMission(state, dt);
  // Boats drift.
  for (const b of state.city.boats) {
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    if (b.x < 100 || b.x > WORLD.w - 100 || b.y < 1900 || b.y > WORLD.h - 100) b.angle += Math.PI;
  }
  if (state.player.hp <= 0 && !state.player.dead) killPlayer(state);
}

function spawnDriftSmoke(state, car) {
  if (Math.random() < 0.5) {
    state.effects.push({ type: 'smoke', x: car.x - Math.cos(car.angle) * 20, y: car.y - Math.sin(car.angle) * 20, t: 0, life: 0.9 });
    if (Math.abs(car.speed) > 300) state.respect += 0.02;
  }
}

// --- save / load ---------------------------------------------------------------
export function saveGame(state) {
  try {
    const data = {
      cash: state.cash, respect: state.respect, missionIndex: state.missionIndex,
      garageTier: state.garageTier, upgrades: state.upgrades, territory: state.territory,
      x: state.player.x, y: state.player.y, time: state.time, stats: state.stats,
    };
    localStorage.setItem('vesper-city-save', JSON.stringify(data));
    showMessage(state, 'Game saved');
    return true;
  } catch { return false; }
}

export function loadGame(state) {
  try {
    const raw = localStorage.getItem('vesper-city-save');
    if (!raw) return false;
    const d = JSON.parse(raw);
    state.cash = d.cash; state.respect = d.respect; state.garageTier = d.garageTier;
    state.upgrades = d.upgrades; state.territory = d.territory; state.time = d.time;
    state.stats = d.stats || state.stats;
    state.player.x = d.x; state.player.y = d.y;
    if (state.player.inCar) exitCar(state);
    startMission(state, d.missionIndex);
    showMessage(state, 'Save loaded');
    return true;
  } catch { return false; }
}

export function hasSave() {
  try { return !!localStorage.getItem('vesper-city-save'); } catch { return false; }
}
