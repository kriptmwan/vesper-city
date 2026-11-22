// Vesper City — canvas rendering: the city, the cars, the people, the effects
// and the whole HUD (wanted stars, health, cash, minimap with GPS, mission
// banner, weapon wheel, radio, clock). Day/night and rain are lighting passes
// over the same scene. Everything is drawn, never loaded: zero assets.
import { WORLD, DISTRICTS, WEAPONS, CREW, RADIO, RESPECT_RANKS } from './config.js';
import { districtAt } from './city.js';
import { clamp, lerp } from './random.js';
import { respectRank, garageTier, missionObjective, playerCar } from './world.js';

function timeOfDay(state) {
  const h = state.time / 3600;
  if (h < 6 || h >= 21) return 'night';
  if (h < 8) return 'dawn';
  if (h < 17) return 'day';
  if (h < 19.5) return 'dusk';
  return 'night';
}

function skyTint(state) {
  const t = timeOfDay(state);
  if (t === 'day') return { overlay: 'rgba(255,244,214,0.05)', sun: 1 };
  if (t === 'dawn') return { overlay: 'rgba(255,170,90,0.10)', sun: 0.85 };
  if (t === 'dusk') return { overlay: 'rgba(255,110,60,0.16)', sun: 0.7 };
  return { overlay: 'rgba(8,12,40,0.42)', sun: 0.25 };
}

function drawCar(ctx, car, t) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-22 + 3, -10 + 4, 46, 22);
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-23, -11, 46, 22, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,44,0.85)';
  ctx.beginPath();
  ctx.roundRect(-8, -9, 16, 18, 3);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(20, -8, 3, 5); ctx.fillRect(20, 3, 3, 5);
  ctx.fillStyle = '#ff5a4a';
  ctx.fillRect(-24, -8, 3, 5); ctx.fillRect(-24, 3, 3, 5);
  if (car.kind === 'police') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-14, -11, 28, 4);
    ctx.fillStyle = '#204080';
    ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('VCPD', 0, -13);
  }
  if (car.kind === 'swat') {
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('SWAT', 0, -13);
  }
  if (car.kind === 'van') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('PRISON', 0, -13);
  }
  if (car.onFire) {
    ctx.fillStyle = `rgba(255,${120 + Math.floor(Math.random() * 80)},20,0.9)`;
    ctx.beginPath();
    ctx.arc(-6, 0, 10 + Math.random() * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Health bar for damaged cars.
  if (car.hp < car.maxHp && !car.dead) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(car.x - 20, car.y - 30, 40, 5);
    ctx.fillStyle = car.hp > car.maxHp * 0.5 ? '#5ad06a' : '#e05050';
    ctx.fillRect(car.x - 19, car.y - 29, 38 * (car.hp / car.maxHp), 3);
  }
}

function drawPed(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.arc(2, 2, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.color;
  ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a2118';
  ctx.beginPath(); ctx.arc(3, 0, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (p.state === 'flee') {
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('!', p.x, p.y - 14);
  }
}

function drawMinimap(ctx, state, x, y, w, h) {
  const sx = w / WORLD.w, sy = h / WORLD.h;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,22,0.85)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.strokeRect(x, y, w, h);
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.color;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x + d.x * sx, y + d.y * sy, d.w * sx, d.h * sy);
  }
  ctx.globalAlpha = 1;
  // Roads.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (const rx of state.city.roadsV) { ctx.beginPath(); ctx.moveTo(x + rx * sx, y); ctx.lineTo(x + rx * sx, y + h); ctx.stroke(); }
  for (const ry of state.city.roadsH) { ctx.beginPath(); ctx.moveTo(x, y + ry * sy); ctx.lineTo(x + w, y + ry * sy); ctx.stroke(); }
  // GPS route: straight line to the mission target (the city grid is the route).
  if (state.mission) {
    const t = state.mission.def.target;
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(x + state.player.x * sx, y + state.player.y * sy);
    ctx.lineTo(x + t.x * sx, y + t.y * sy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(x + t.x * sx, y + t.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  }
  // Cops.
  ctx.fillStyle = '#5a8cff';
  for (const c of state.cars) {
    if ((c.kind === 'police' || c.kind === 'swat') && !c.dead) {
      ctx.fillRect(x + c.x * sx - 2, y + c.y * sy - 2, 4, 4);
    }
  }
  // Player arrow.
  ctx.save();
  ctx.translate(x + state.player.x * sx, y + state.player.y * sy);
  ctx.rotate(state.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
  // North + district label.
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('N', x + 6, y + 12);
  ctx.restore();
}

function drawWheel(ctx, state, cx, cy) {
  const p = state.player;
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  ctx.beginPath(); ctx.arc(cx, cy, 150, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  WEAPONS.forEach((w, i) => {
    const a = -Math.PI / 2 + i * (Math.PI * 2 / WEAPONS.length);
    const wx = cx + Math.cos(a) * 100, wy = cy + Math.sin(a) * 100;
    ctx.fillStyle = i === p.weapon ? '#ffd23f' : 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.arc(wx, wy, 34, 0, Math.PI * 2); ctx.fill();
    if (i === p.weapon) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.fillStyle = i === p.weapon ? '#111' : '#fff';
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(w.name, wx, wy - 2);
    ctx.font = '9px sans-serif';
    ctx.fillText(p.ammo[i] === Infinity ? '∞' : String(p.ammo[i]), wx, wy + 12);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '9px sans-serif';
    ctx.fillText(String(i + 1), wx, wy - 40);
  });
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('WEAPONS  [Q]', cx, cy + 190);
  ctx.restore();
}

export function render(state, canvas, opts) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const zoom = (opts && opts.zoom) || 1;
  const camX = (opts && opts.camX !== undefined) ? opts.camX : state.player.x;
  const camY = (opts && opts.camY !== undefined) ? opts.camY : state.player.y;
  const tint = skyTint(state);
  // --- world pass ---
  ctx.save();
  ctx.fillStyle = '#1a2a1e';
  ctx.fillRect(0, 0, W, H);
  ctx.translate(W / 2, H / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-camX, -camY);
  // District ground.
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.fillRect(d.x, d.y, d.w, d.h);
    if (d.id === 'harbor') {
      // Water.
      ctx.fillStyle = '#14425e';
      ctx.fillRect(d.x, d.y + 260, d.w, d.h - 260);
      ctx.strokeStyle = 'rgba(120,200,230,0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const wy = d.y + 320 + i * 60;
        ctx.beginPath();
        ctx.moveTo(d.x + 40 + ((state.time * 8 + i * 173) % 300), wy);
        ctx.lineTo(d.x + 140 + ((state.time * 8 + i * 173) % 300), wy);
        ctx.stroke();
      }
    }
  }
  // Parks.
  for (const pk of state.city.parks) {
    ctx.fillStyle = '#2e6b34';
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
    ctx.fillStyle = '#3f8a44';
    for (let i = 0; i < pk.trees; i++) {
      const tx = pk.x + 14 + (i * 37) % pk.w, ty = pk.y + 14 + (i * 53) % pk.h;
      ctx.beginPath(); ctx.arc(tx, ty, 9, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Roads.
  ctx.fillStyle = '#33333c';
  for (const rx of state.city.roadsV) ctx.fillRect(rx - 42, 0, 84, WORLD.h);
  for (const ry of state.city.roadsH) ctx.fillRect(0, ry - 42, WORLD.w, 84);
  ctx.strokeStyle = 'rgba(255,210,63,0.75)';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  for (const rx of state.city.roadsV) { ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, WORLD.h); ctx.stroke(); }
  for (const ry of state.city.roadsH) { ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(WORLD.w, ry); ctx.stroke(); }
  ctx.setLineDash([]);
  // Docks.
  for (const d of state.city.docks) {
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = '#8a6a44';
    for (let x = d.x + 8; x < d.x + d.w - 8; x += 26) ctx.fillRect(x, d.y + 4, 14, 18);
  }
  // Boats.
  for (const b of state.city.boats) {
    ctx.save();
    ctx.translate(b.x, b.y); ctx.rotate(b.angle);
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath(); ctx.roundRect(-b.len / 2, -10, b.len, 20, 8); ctx.fill();
    ctx.fillStyle = '#c22e3a';
    ctx.fillRect(-b.len / 4, -7, b.len / 2, 14);
    ctx.restore();
  }
  // Buildings with fake height shadows.
  for (const b of state.city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(b.x, b.y, b.w, 6);
    if (b.height >= 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    }
    // Windows at night/dusk.
    if (timeOfDay(state) === 'night' || timeOfDay(state) === 'dusk') {
      ctx.fillStyle = 'rgba(255,220,120,0.85)';
      const cols = Math.max(1, Math.floor(b.w / 22)), rows = Math.max(1, Math.floor(b.h / 20));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 3 + b.x) % 3 === 0) ctx.fillRect(b.x + 6 + i * 22, b.y + 6 + j * 20, 8, 10);
      }
    }
  }
  // Scorch decals + bullet marks.
  for (const d of state.decals) {
    ctx.fillStyle = d.type === 'scorch' ? 'rgba(10,10,10,0.55)' : 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
  }
  // Mission target marker.
  if (state.mission) {
    const t = state.mission.def.target;
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(t.x, t.y, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(t.x, t.y, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Landmark labels.
  ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
  for (const lm of state.city.landmarks) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(lm.name, lm.x + 1, lm.y - 24);
    ctx.fillStyle = '#fff';
    ctx.fillText(lm.name, lm.x, lm.y - 25);
  }
  // District labels (big, only when zoomed out or always, faint).
  ctx.font = 'bold 44px sans-serif';
  for (const d of DISTRICTS) {
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.fillText(d.label, d.x + d.w / 2, d.y + d.h / 2);
  }
  // Cars, peds, player.
  const pc = playerCar(state);
  for (const car of state.cars) {
    if (car.dead && !car.onFire) continue;
    if (car === pc) continue;
    drawCar(ctx, car, state.time);
  }
  for (const p of state.peds) drawPed(ctx, p);
  if (pc) drawCar(ctx, pc, state.time);
  if (!state.player.inCar && !state.player.dead) {
    // Player on foot.
    ctx.save();
    ctx.translate(state.player.x, state.player.y);
    ctx.rotate(state.player.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.arc(2, 3, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b13f';
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(4, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // Bullets.
  ctx.fillStyle = '#ffe9a8';
  for (const b of state.bullets) {
    ctx.fillRect(b.x - 3, b.y - 1, 7, 2);
  }
  // Effects.
  for (const e of state.effects) {
    const k = 1 - e.t / e.life;
    if (e.type === 'smoke') {
      ctx.fillStyle = `rgba(200,200,200,${0.5 * k})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, 8 + (1 - k) * 22, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'explosion') {
      ctx.fillStyle = `rgba(255,${Math.floor(140 * k)},30,${0.9 * k})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.radius * (1 - k * 0.4), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,240,160,${k})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.radius * 0.45 * k, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'muzzle') {
      ctx.fillStyle = `rgba(255,230,120,${k})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, 12 * k + 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Helicopter + spotlight.
  if (state.heli.active) {
    ctx.save();
    ctx.translate(state.heli.x, state.heli.y);
    ctx.fillStyle = 'rgba(255,240,180,0.10)';
    ctx.beginPath(); ctx.arc(0, 0, 260, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c8ccd8';
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c22e3a';
    ctx.fillRect(-16, -3, 32, 6);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('AIR-1', 0, -20);
    ctx.restore();
  }
  // Rain.
  if (state.raining) {
    ctx.strokeStyle = 'rgba(180,200,230,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 90; i++) {
      const rx = camX + ((i * 97 + state.time * 900) % (W / zoom)) - W / zoom / 2;
      const ry = camY + ((i * 61 + state.time * 1400) % (H / zoom)) - H / zoom / 2;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 6, ry + 18); ctx.stroke();
    }
  }
  ctx.restore();
  // --- lighting pass ---
  ctx.fillStyle = tint.overlay;
  ctx.fillRect(0, 0, W, H);
  // Headlight cone at night when driving.
  if (timeOfDay(state) === 'night' && pc) {
    const gx = W / 2, gy = H / 2;
    const grad = ctx.createRadialGradient(gx, gy, 20, gx, gy, 260);
    grad.addColorStop(0, 'rgba(255,240,180,0.20)');
    grad.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(gx, gy, 260, 0, Math.PI * 2); ctx.fill();
  }
  if (opts && opts.noHud) return;
  // --- HUD ---
  // Top-left: wanted stars + cash + respect.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  ctx.beginPath(); ctx.roundRect(14, 12, 300, 86, 10); ctx.fill();
  ctx.font = 'bold 26px sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < state.wanted ? '#ffd23f' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', 24 + i * 30, 44);
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`$${state.cash.toLocaleString()}`, 24, 74);
  ctx.fillStyle = '#9fe8a8';
  ctx.font = '15px sans-serif';
  ctx.fillText(`${respectRank(state.respect).name}  •  ${state.respect} respect`, 150, 74);
  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(24, 84, 120, 8);
  ctx.fillStyle = state.player.hp > 40 ? '#5ad06a' : '#e05050';
  ctx.fillRect(24, 84, 120 * clamp(state.player.hp / 100, 0, 1), 8);
  // Top-right: minimap.
  drawMinimap(ctx, state, W - 244, 12, 230, 158);
  // Radio + clock under the minimap.
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  ctx.beginPath(); ctx.roundRect(W - 244, 178, 230, 34, 8); ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left';
  const hh = Math.floor(state.time / 3600), mm = Math.floor((state.time % 3600) / 60);
  ctx.fillText(`♪ ${state.audio.station().name}`, W - 232, 200);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'right';
  ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}${state.raining ? '  🌧' : ''}`, W - 20, 200);
  ctx.textAlign = 'left';
  // Bottom-left: weapon + crew.
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  ctx.beginPath(); ctx.roundRect(14, H - 96, 330, 82, 10); ctx.fill();
  const w = WEAPONS[state.player.weapon];
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(`${state.player.weapon + 1} · ${w.name}`, 26, H - 66);
  ctx.fillStyle = '#c8c8d0';
  ctx.font = '14px sans-serif';
  ctx.fillText(`ammo ${state.player.ammo[state.player.weapon] === Infinity ? '∞' : state.player.ammo[state.player.weapon]}   [Q] wheel`, 26, H - 44);
  ctx.fillStyle = '#9fc8ff';
  ctx.font = '13px sans-serif';
  const crew = CREW[state.activeCrew];
  const cd = Math.ceil(state.crewCooldown[crew.id]);
  ctx.fillText(`Crew: ${crew.name} — ${crew.ability}${cd > 0 ? ` (${cd}s)` : ' [7/8/9]'}`, 26, H - 24);
  // Bottom-center: mission objective.
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  const obj = missionObjective(state);
  ctx.font = 'bold 16px sans-serif';
  const ow = ctx.measureText(obj).width + 36;
  ctx.beginPath(); ctx.roundRect((W - ow) / 2, H - 52, ow, 38, 10); ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.textAlign = 'center';
  ctx.fillText(obj, W / 2, H - 27);
  ctx.textAlign = 'left';
  // Tail suspicion / hack progress bars.
  if (state.mission && state.mission.def.id === 'm2') {
    ctx.fillStyle = 'rgba(8,10,18,0.72)';
    ctx.beginPath(); ctx.roundRect(W / 2 - 140, 14, 280, 30, 8); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`SUSPICION ${Math.floor(state.tailSuspicion)}%`, W / 2, 33);
    ctx.fillStyle = '#e05050';
    ctx.fillRect(W / 2 - 130, 38, 260 * (state.tailSuspicion / 100), 4);
    ctx.textAlign = 'left';
  }
  if (state.mission && state.mission.def.id === 'm3' && state.hackProgress > 0) {
    ctx.fillStyle = 'rgba(8,10,18,0.72)';
    ctx.beginPath(); ctx.roundRect(W / 2 - 140, 14, 280, 30, 8); ctx.fill();
    ctx.fillStyle = '#5ad06a';
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`JUNO HACKING ${Math.floor(state.hackProgress)}%`, W / 2, 33);
    ctx.fillRect(W / 2 - 130, 38, 260 * (state.hackProgress / 100), 4);
    ctx.textAlign = 'left';
  }
  // Banner.
  if (state.bannerT > 0 && state.banner) {
    ctx.save();
    ctx.globalAlpha = clamp(state.bannerT, 0, 1);
    ctx.fillStyle = 'rgba(8,10,18,0.8)';
    ctx.beginPath(); ctx.roundRect(W / 2 - 260, H / 2 - 110, 520, 92, 12); ctx.fill();
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(state.banner.title, W / 2, H / 2 - 72);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText(state.banner.sub, W / 2, H / 2 - 44);
    ctx.restore();
    ctx.textAlign = 'left';
  }
  // Message toast.
  if (state.messageT > 0 && state.message) {
    ctx.fillStyle = 'rgba(8,10,18,0.8)';
    ctx.font = '15px sans-serif';
    const mw = ctx.measureText(state.message).width + 28;
    ctx.beginPath(); ctx.roundRect((W - mw) / 2, 60, mw, 30, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText(state.message, W / 2, 80);
    ctx.textAlign = 'left';
  }
  // Weapon wheel.
  if (opts && opts.wheelOpen) drawWheel(ctx, state, W / 2, H / 2);
  // Title / pause / game over overlays.
  if (!state.started) {
    ctx.fillStyle = 'rgba(6,8,16,0.78)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('VESPER CITY', W / 2, H / 2 - 150);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('An open-world crime story — Rook Calloway takes back his city', W / 2, H / 2 - 110);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#c8c8d0';
    const lines = [
      'WASD / Arrows — drive or walk    •    E — steal / enter car    •    Space — handbrake drift',
      'Mouse — aim, Click — shoot    •    Q — weapon wheel    •    1-6 weapons    •    7/8/9 crew abilities',
      'N — start mission    •    R — radio    •    P — pause    •    L — save    •    M — mute',
      '',
      'Five districts. Ten missions. One kingpin to take down.',
      '',
      'Press ENTER to start —  [H] how to play',
    ];
    lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 - 60 + i * 26));
    ctx.textAlign = 'left';
  }
  if (state.paused) {
    ctx.fillStyle = 'rgba(6,8,16,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('PAUSED', W / 2, H / 2);
    ctx.font = '16px sans-serif';
    ctx.fillText('P — resume    •    L — save    •    R — restart', W / 2, H / 2 + 40);
    ctx.textAlign = 'left';
  }
  if (state.gameOver) {
    ctx.fillStyle = 'rgba(20,4,4,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff5a4a';
    ctx.font = 'bold 56px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('WASTED', W / 2, H / 2 - 20);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('Vera is not happy. Press R to restart.', W / 2, H / 2 + 24);
    ctx.textAlign = 'left';
  }
}
