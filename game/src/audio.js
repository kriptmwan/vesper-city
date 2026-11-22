// Vesper City — procedural audio. No audio files: every sound is synthesized
// with WebAudio (engine hum, gunshots, sirens, explosions, UI blips) and the
// three radio stations are tiny step sequencers. Everything is guarded so the
// game runs silently headless when no AudioContext exists.
import { RADIO } from './config.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let station = 0;
  let radioTimer = null;
  let step = 0;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    } catch { return false; }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch { /* audio is cosmetic */ }
  }

  function noise(dur, vol, lowpass) {
    if (!ensure() || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
      const g = ctx.createGain(); g.gain.value = vol || 0.3;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    } catch { /* audio is cosmetic */ }
  }

  function radioTick() {
    const st = RADIO[station];
    if (!st || st.bpm === 0) return; // talk radio: silence between blips
    const beat = 60 / st.bpm / 2;
    const bass = st.bass[step % st.bass.length];
    if (bass > 0) tone(bass, beat * 1.8, st.wave, 0.10);
    if (step % 4 === 2) tone(bass * 2, beat, 'square', 0.03);
    if (step % 8 === 6) tone(880 + (step % 3) * 110, beat * 0.5, 'sine', 0.04);
    step++;
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
    setStation(i) {
      station = ((i % RADIO.length) + RADIO.length) % RADIO.length;
      step = 0;
      if (radioTimer) { clearInterval(radioTimer); radioTimer = null; }
      const st = RADIO[station];
      if (st && st.bpm > 0) radioTimer = setInterval(radioTick, (60 / st.bpm / 2) * 1000);
      return RADIO[station];
    },
    station() { return RADIO[station]; },
    shoot(weaponId) {
      if (weaponId === 'rocket') { noise(0.5, 0.4, 500); tone(90, 0.4, 'sawtooth', 0.25, 40); }
      else if (weaponId === 'shotgun') { noise(0.25, 0.5, 900); }
      else if (weaponId === 'smg' || weaponId === 'rifle') { noise(0.08, 0.25, 2400); tone(220, 0.06, 'square', 0.08, 90); }
      else if (weaponId === 'pistol') { noise(0.12, 0.3, 1800); }
      else { noise(0.05, 0.15, 600); }
    },
    explosion() { noise(0.9, 0.6, 300); tone(70, 0.8, 'sine', 0.4, 28); },
    siren() { tone(700, 0.5, 'sine', 0.05, 950); },
    crash() { noise(0.2, 0.35, 700); },
    pickup() { tone(660, 0.09, 'sine', 0.15); tone(990, 0.14, 'sine', 0.15); },
    missionDone() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.18), i * 110)); },
    click() { tone(1200, 0.04, 'square', 0.08); },
    engine(speed01) {
      if (!ensure() || muted) return;
      // A single reusable oscillator is overkill for a demo; a soft putter
      // on a short interval keeps the headless path silent and cheap.
      if (Math.random() < 0.3) tone(50 + speed01 * 90, 0.08, 'sawtooth', 0.02);
    },
  };
}
