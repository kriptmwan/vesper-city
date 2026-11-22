// Vesper City — boot, input, game loop and state machine.
// Title -> playing -> paused / wasted. ?selftest=1 runs the twelve checks;
// ?shot=world|verb|chase|combat stages one frozen frame for screenshots.
import { createWorld, update, enterCar, exitCar, nearestStealableCar, useCrew, saveGame, loadGame, hasSave, startMission, showBanner, showMessage, playerCar } from './world.js';
import { render } from './render.js';
import { runSelftest } from './selftest.js';
import { applyShot } from './shots.js';
import { RADIO } from './config.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const state = createWorld(7);
let camX = state.player.x, camY = state.player.y;
const zoom = 1;

const keys = {};
const input = { up: false, down: false, left: false, right: false, handbrake: false, run: false, shoot: false, aimX: 0, aimY: 0 };
let mouse = { x: canvas.width / 2, y: canvas.height / 2, down: false };
let wheelOpen = false;
let shotView = null;

function screenToWorld(sx, sy) {
  return { x: camX + (sx - canvas.width / 2) / zoom, y: camY + (sy - canvas.height / 2) / zoom };
}

function refreshInput() {
  input.up = !!(keys['KeyW'] || keys['ArrowUp']);
  input.down = !!(keys['KeyS'] || keys['ArrowDown']);
  input.left = !!(keys['KeyA'] || keys['ArrowLeft']);
  input.right = !!(keys['KeyD'] || keys['ArrowRight']);
  input.handbrake = !!keys['Space'];
  input.run = !!keys['ShiftLeft'] || !!keys['ShiftRight'];
  input.shoot = mouse.down && !wheelOpen;
  const w = screenToWorld(mouse.x, mouse.y);
  input.aimX = w.x; input.aimY = w.y;
  state.player.aim = Math.atan2(w.y - state.player.y, w.x - state.player.x);
}

addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  state.audio.unlock();
  if (e.code === 'Enter' && !state.started) {
    state.started = true;
    showBanner(state, 'VESPER CITY', 'Rook is back. Vera is waiting.');
    return;
  }
  if (e.code === 'KeyM') { const m = state.audio.toggleMute(); showMessage(state, m ? 'Muted' : 'Sound on'); return; }
  if (!state.started) {
    if (e.code === 'KeyL' && hasSave()) { loadGame(state); state.started = true; }
    return;
  }
  if (e.code === 'KeyP') { state.paused = !state.paused; return; }
  if (state.gameOver && e.code === 'KeyR') { location.reload(); return; }
  if (state.paused) return;
  if (e.code === 'KeyE') {
    if (state.player.inCar) exitCar(state);
    else {
      const car = nearestStealableCar(state, 60);
      if (car) enterCar(state, car);
      else showMessage(state, 'No car close enough — walk to one');
    }
    return;
  }
  if (e.code === 'KeyQ') { wheelOpen = true; return; }
  if (e.code === 'KeyN') { showBanner(state, `MISSION ${state.missionIndex + 1}: ${state.mission ? state.mission.def.name.toUpperCase() : 'DONE'}`, state.mission ? state.mission.def.text : 'Vesper City is yours.'); return; }
  if (e.code === 'KeyR') {
    const st = state.audio.setStation(state.audio.station() ? (RADIO.indexOf(state.audio.station()) + 1) % RADIO.length : 0);
    showMessage(state, `♪ ${st.name} — ${st.genre}`);
    return;
  }
  if (e.code === 'KeyL') { saveGame(state); return; }
  if (e.code >= 'Digit1' && e.code <= 'Digit6') { state.player.weapon = Number(e.code.slice(-1)) - 1; return; }
  if (e.code === 'Digit7') useCrew(state, 0);
  if (e.code === 'Digit8') useCrew(state, 1);
  if (e.code === 'Digit9') useCrew(state, 2);
  if (e.code === 'KeyC') useCrew(state, state.activeCrew);
});

addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'KeyQ') wheelOpen = false;
});

canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
  mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
});
canvas.addEventListener('mousedown', (e) => { mouse.down = true; state.audio.unlock(); });
addEventListener('mouseup', () => { mouse.down = false; });

// --- modes ---
if (params.get('selftest') === '1') {
  const summary = runSelftest();
  document.title = `SELFTEST ${summary.pass}/${summary.total}`;
  ctx.fillStyle = '#0a0e16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = summary.fail === 0 ? '#5ad06a' : '#e05050';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(`SELFTEST ${summary.pass}/${summary.total} PASS`, 40, 60);
  ctx.font = '16px sans-serif';
  summary.results.forEach((r, i) => {
    ctx.fillStyle = r.pass ? '#5ad06a' : '#ff5a4a';
    ctx.fillText(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}`, 40, 100 + i * 30);
    ctx.fillStyle = '#c8c8d0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`     ${r.detail}`, 40, 100 + i * 30 + 15);
    ctx.font = '16px sans-serif';
  });
} else if (params.get('shot')) {
  const name = params.get('shot');
  const seed = Number(params.get('seed') || 7);
  state.seed = seed;
  shotView = applyShot(state, name);
  document.title = `SHOT ${name} READY`;
  // Frozen frame, re-rendered so any capture timing sees it.
  const draw = () => {
    camX = shotView.camX; camY = shotView.camY;
    render(state, canvas, { zoom: shotView.zoom, camX, camY, wheelOpen: shotView.wheelOpen });
    requestAnimationFrame(draw);
  };
  draw();
} else {
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    refreshInput();
    update(state, input, dt);
    // Camera follows the player, clamped to the world.
    const tx = state.player.x, ty = state.player.y;
    camX += (tx - camX) * Math.min(1, dt * 6);
    camY += (ty - camY) * Math.min(1, dt * 6);
    camX = Math.max(canvas.width / 2 / zoom, Math.min(3400 - canvas.width / 2 / zoom, camX));
    camY = Math.max(canvas.height / 2 / zoom, Math.min(2600 - canvas.height / 2 / zoom, camY));
    render(state, canvas, { zoom, camX, camY, wheelOpen });
    requestAnimationFrame(loop);
  };
  render(state, canvas, { zoom, camX, camY, wheelOpen });
  requestAnimationFrame(loop);
}
