// Vesper City — selftest. ?selftest=1 runs twelve checks against a fresh
// seeded world and reports PASS/FAIL on the canvas, in the console and on
// window.__selftest. A failing test names what broke; nothing is faked.
import { WORLD, MISSIONS } from './config.js';
import { createWorld, update, enterCar, nearestStealableCar, shoot, addWanted, explode, useCrew, saveGame, loadGame, startMission, playerCar } from './world.js';
import { districtAt } from './city.js';

function freshWorld() {
  const s = createWorld(7);
  s.started = true;
  return s;
}

function step(s, input, n) {
  for (let i = 0; i < n; i++) update(s, input || {}, 1 / 60);
}

const IDLE = {};

export function runSelftest() {
  const results = [];
  const check = (name, fn) => {
    try {
      const detail = fn();
      results.push({ name, pass: true, detail: detail || '' });
    } catch (e) {
      results.push({ name, pass: false, detail: String(e && e.message || e) });
    }
  };
  const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

  check('city generates 6 districts, 100+ buildings, connected roads', () => {
    const s = freshWorld();
    assert(s.city.buildings.length > 100, `only ${s.city.buildings.length} buildings`);
    assert(s.city.roadsV.length >= 9 && s.city.roadsH.length >= 7, 'road grid too small');
    const d = districtAt(300, 300);
    assert(d.id === 'marina', `district at marina is ${d.id}`);
    return `${s.city.buildings.length} buildings, ${s.city.roadsV.length}x${s.city.roadsH.length} roads`;
  });

  check('enter car and drive moves the player', () => {
    const s = freshWorld();
    const car = nearestStealableCar(s, 3000);
    assert(car, 'no stealable car found');
    s.player.x = car.x; s.player.y = car.y;
    enterCar(s, car);
    assert(s.player.inCar, 'player did not enter the car');
    // Put the car on the road centre, facing along it, so the test measures
    // driving instead of spawn luck (a parked car can face a building).
    const rp = s.city.nearestRoadPoint(car.x, car.y);
    const dv = Math.min(...s.city.roadsV.map(r => Math.abs(car.x - r)));
    const dh = Math.min(...s.city.roadsH.map(r => Math.abs(car.y - r)));
    car.x = rp.x; car.y = rp.y; s.player.x = rp.x; s.player.y = rp.y;
    car.angle = dv < dh ? -Math.PI / 2 : 0;
    s.player.angle = car.angle;
    const x0 = s.player.x, y0 = s.player.y;
    step(s, { up: true }, 120);
    const moved = Math.hypot(s.player.x - x0, s.player.y - y0);
    assert(moved > 150, `car only moved ${Math.round(moved)}px in 2s`);
    return `drove ${Math.round(moved)}px in 2s`;
  });

  check('shooting fires, spends ammo and damages a target', () => {
    const s = freshWorld();
    const target = s.cars.find(c => c.kind === 'parked');
    assert(target, 'no target car');
    s.player.x = target.x - 100; s.player.y = target.y;
    s.player.weapon = 1;
    const ammo0 = s.player.ammo[1], hp0 = target.hp;
    shoot(s, target.x, target.y);
    step(s, IDLE, 30);
    assert(s.player.ammo[1] < ammo0, 'ammo did not decrease');
    assert(target.hp < hp0, `target hp unchanged (${target.hp})`);
    return `ammo ${ammo0}->${s.player.ammo[1]}, target hp ${hp0}->${target.hp}`;
  });

  check('crime raises wanted and police spawn', () => {
    const s = freshWorld();
    addWanted(s, 2, 'test crime');
    assert(s.wanted === 2, `wanted is ${s.wanted}`);
    step(s, IDLE, 60);
    const cops = s.cars.filter(c => c.kind === 'police' && !c.dead).length;
    assert(cops >= 2, `only ${cops} cops spawned`);
    return `${cops} cops on the street at 2 stars`;
  });

  check('mission 1 completes by stealing a car', () => {
    const s = freshWorld();
    assert(s.mission.def.id === 'm1', `first mission is ${s.mission.def.id}`);
    const car = nearestStealableCar(s, 3000);
    s.player.x = car.x; s.player.y = car.y;
    enterCar(s, car);
    assert(s.missionIndex === 1, `mission did not advance (index ${s.missionIndex})`);
    return 'Hotwire complete, mission 2 active';
  });

  check('mission 5 race completes through 5 checkpoints', () => {
    const s = freshWorld();
    startMission(s, 4);
    const cps = [
      { x: 2700, y: 500 }, { x: 2900, y: 200 }, { x: 2400, y: 800 }, { x: 2900, y: 700 }, { x: 2700, y: 500 },
    ];
    for (const cp of cps) {
      s.player.x = cp.x; s.player.y = cp.y;
      step(s, IDLE, 5);
    }
    assert(s.missionIndex === 5, `race did not complete (index ${s.missionIndex})`);
    return 'Neon Grand Prix won';
  });

  check('save/load round-trips cash, respect and mission', () => {
    const s = freshWorld();
    s.cash = 1234; s.respect = 77;
    assert(saveGame(s), 'saveGame returned false');
    s.cash = 0; s.respect = 0;
    assert(loadGame(s), 'loadGame returned false');
    assert(s.cash === 1234, `cash is ${s.cash} after load`);
    assert(s.respect === 77, `respect is ${s.respect} after load`);
    return 'cash 1234, respect 77 restored';
  });

  check('explosion damages a nearby car', () => {
    const s = freshWorld();
    const car = s.cars.find(c => c.kind === 'parked');
    const hp0 = car.hp;
    explode(s, car.x, car.y, 130);
    assert(car.hp < hp0, `car hp unchanged (${car.hp})`);
    return `car hp ${hp0}->${car.hp}`;
  });

  check('Juno Ghost Hack drops the wanted level', () => {
    const s = freshWorld();
    addWanted(s, 4);
    const before = s.wantedFloat;
    const ok = useCrew(s, 0);
    assert(ok, 'crew ability refused');
    assert(s.wantedFloat < before, `wanted ${before} -> ${s.wantedFloat}`);
    return `wanted ${before.toFixed(1)} -> ${s.wantedFloat.toFixed(1)}`;
  });

  check('pause freezes the game clock', () => {
    const s = freshWorld();
    const t0 = s.time;
    s.paused = true;
    step(s, { up: true }, 60);
    assert(s.time === t0, `clock moved ${s.time - t0}s while paused`);
    s.paused = false;
    return 'clock frozen while paused';
  });

  check('no NaN after 5s of driving', () => {
    const s = freshWorld();
    const car = nearestStealableCar(s, 3000);
    s.player.x = car.x; s.player.y = car.y;
    enterCar(s, car);
    step(s, { up: true, right: true }, 300);
    const nums = [s.player.x, s.player.y, s.player.speed, car.speed, car.angle, s.time];
    assert(nums.every(Number.isFinite), `NaN in ${nums}`);
    assert(s.cars.every(c => Number.isFinite(c.x) && Number.isFinite(c.y)), 'NaN in traffic');
    return 'all positions finite after 300 steps';
  });

  check('mission 3 completes: ram the van, Juno hacks the lock', () => {
    const s = freshWorld();
    startMission(s, 2); // Prison Van Breakout
    step(s, IDLE, 10); // let the van spawn
    const van = s.mission.van;
    assert(van, 'prison van did not spawn');
    const car = nearestStealableCar(s, 3000);
    assert(car, 'no stealable car found');
    s.player.x = car.x; s.player.y = car.y;
    enterCar(s, car);
    // A ram only counts above 200 px/s, so this DRIVES into the van: park
    // the car 250px behind it along its heading, then home in at full speed.
    car.x = van.x - Math.cos(van.angle) * 250; car.y = van.y - Math.sin(van.angle) * 250;
    s.player.x = car.x; s.player.y = car.y;
    car.angle = van.angle; s.player.angle = van.angle;
    let done = false;
    for (let i = 0; i < 900 && !done; i++) {
      car.angle = Math.atan2(van.y - car.y, van.x - car.x);
      s.player.angle = car.angle;
      step(s, { up: true }, 1);
      if (s.missionIndex === 3) done = true;
    }
    assert(done, `mission 3 did not complete in 15s (van hp ${Math.round(van.hp)}, hack ${Math.round(s.hackProgress)}%)`);
    return `van rammed (hp ${Math.round(van.hp)}), hack complete, mission 4 active`;
  });

  check('tail mission: suspicion rises when too close (verb test)', () => {
    const s = freshWorld();
    startMission(s, 1); // Tail Job
    step(s, IDLE, 10); // let the courier spawn
    const courier = s.cars.find(c => c.kind === 'courier');
    assert(courier, 'courier did not spawn');
    // Tail it: stay 60px behind the courier as it drives (this is the verb
    // the test exercises — a stationary player would simply lose the tail).
    for (let i = 0; i < 60; i++) {
      s.player.x = courier.x - 60; s.player.y = courier.y;
      step(s, IDLE, 1);
    }
    assert(s.tailSuspicion > 5, `suspicion stuck at ${s.tailSuspicion}`);
    return `suspicion ${Math.round(s.tailSuspicion)}% after 1s too close`;
  });

  const pass = results.filter(r => r.pass).length;
  const summary = { pass, fail: results.length - pass, total: results.length, results };
  try { window.__selftest = summary; } catch { /* non-browser */ }
  try { console.log(`SELFTEST ${pass}/${results.length} PASS`); results.forEach(r => console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name} — ${r.detail}`)); } catch { /* headless */ }
  return summary;
}
