'use strict';

import { CARDS, CAT_TYPES } from '../game-engine.js';

const CARD_SOUND_DEFS = {
  ATTACK: (tone, noise) => { tone(90, .16, 'sawtooth', .3, 0, -40); noise(.14, .34, 'lowpass', 900, .02); tone(660, .08, 'square', .16, .13); },
  SKIP: (tone, noise) => { noise(.3, .18, 'highpass', 1400, 0); tone(1200, .22, 'sine', .12, 0, -800); },
  FAVOR: (tone, noise) => { tone(430, .3, 'sine', .16, 0, 260); tone(560, .22, 'sine', .12, .16, 180); },
  SHUFFLE: (tone, noise) => { for (let i = 0; i < 11; i++) noise(.035, .16, 'bandpass', 1500 + i * 130, i * .032, 3); },
  FUTURE: (tone, noise, melody) => { melody([523, 659, 784, 1047, 988], .075, 'sine', .13, .16); tone(1760, .5, 'sine', .05, .2); },
  NOPE: (tone) => { tone(300, .1, 'sawtooth', .18); tone(180, .18, 'sawtooth', .18, .09); },
  DEFUSE: (tone, noise) => { tone(760, .05, 'square', .15); tone(1080, .07, 'square', .15, .06); noise(.12, .1, 'highpass', 3000, .02); },
  CAT_SAMOSA: (noise) => { noise(.09, .4, 'bandpass', 2600, 0, 1.6); noise(.07, .3, 'bandpass', 3400, .09, 1.6); noise(.06, .22, 'bandpass', 2100, .16, 1.6); },
  CAT_DISCO: (tone, noise, melody) => { melody([440, 523, 659, 880], .085, 'sawtooth', .11, .1); [0, .085, .17, .255].forEach(t => noise(.03, .13, 'highpass', 7000, t)); tone(110, .1, 'sine', .24, 0); tone(110, .1, 'sine', .24, .17); },
  CAT_PICKLE: (tone, noise) => { tone(180, .16, 'sine', .2, 0, 520); tone(700, .14, 'sine', .16, .14, -480); noise(.06, .12, 'bandpass', 900, .26, 2); },
  CAT_MELON: (tone, melody) => { melody([784, 784, 880, 784, 1047, 988], .115, 'triangle', .15, .14); },
  CAT_TACHE: (tone, noise) => { tone(70, .34, 'sawtooth', .26, 0, 26); noise(.3, .16, 'lowpass', 420, 0, .7); tone(520, .14, 'sine', .13, .3, 420); },
  CAT_JALEBI: (tone, noise, melody) => { noise(.26, .2, 'highpass', 5200, 0); melody([659, 784, 1047, 1318], .07, 'sine', .12, .12); },
  CAT_LUNGI: (tone, noise) => { noise(.22, .2, 'bandpass', 700, 0, .8); tone(120, .13, 'sine', .28, .06); tone(95, .16, 'sine', .26, .2); tone(150, .1, 'sine', .2, .34); },
  CAT_CHAI: (tone, noise) => { noise(.34, .17, 'bandpass', 1100, 0, .9); tone(1500, .05, 'sine', .1, .3); tone(2100, .06, 'sine', .09, .36); noise(.16, .13, 'lowpass', 600, .44); },
  CAT_RICKSHAW: (tone, noise) => { [0, .16].forEach(t => { tone(1980, .13, 'sine', .13, t); tone(2640, .11, 'sine', .1, t + .02); }); noise(.2, .09, 'bandpass', 2800, .3, 4); },
  CAT_UNCLE: (tone, noise) => { tone(392, .15, 'square', .2, 0); tone(330, .19, 'square', .2, .15); for (let i = 0; i < 6; i++) noise(.05, .13, 'lowpass', 260, .34 + i * .055); },
};

const ACTION_SOUND_DEFS = {
  sDeal: (noise) => { for (let i = 0; i < 7; i++) noise(.05, .16, 'bandpass', 1200 + i * 90, i * .07, 3); },
  sYourTurn: (tone) => { tone(660, .1, 'sine', .13); tone(880, .15, 'sine', .13, .1); tone(1180, .18, 'sine', .1, .22); },
  sTheirTurn: (tone) => { tone(430, .09, 'sine', .06); },
  sAttacked: (tone, noise) => { tone(160, .14, 'sawtooth', .26, 0, -60); tone(120, .2, 'sawtooth', .24, .13, -40); noise(.22, .2, 'lowpass', 700, .02); },
  sJoin: (tone) => { tone(523, .1, 'triangle', .13); tone(784, .14, 'triangle', .13, .1); },
  sChat: (tone) => { tone(1320, .06, 'sine', .1); tone(1760, .08, 'sine', .08, .06); },
  sLose: (tone) => { [440, 392, 330, 262].forEach((f, i) => tone(f, .22, 'triangle', .16, i * .16)); },
  sSteal: (tone, noise) => { tone(880, .07, 'triangle', .13, 0, -260); tone(1180, .06, 'triangle', .11, .07); noise(.08, .1, 'highpass', 4000, .02); },
  sPop: (tone) => { tone(520, .09, 'square', .14, 0, 220); },
  sSwish: (tone) => { tone(880, .12, 'sine', .1, 0, -500); },
  sNope: (tone) => { tone(300, .1, 'sawtooth', .16); tone(180, .16, 'sawtooth', .16, .09); },
  sUhoh: (tone) => { tone(392, .14, 'triangle', .18); tone(311, .24, 'triangle', .18, .16); },
  sBoom: (tone, noise, createBufferSource) => { if (!createBufferSource) return; const c = createBufferSource(); const t = c.currentTime; const b = c.createBuffer(1, c.sampleRate * .6, c.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2); const s = c.createBufferSource(); const g = c.createGain(); s.buffer = b; g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.001, t + .6); s.connect(g); g.connect(c.destination); s.start(t); tone(70, .5, 'sine', .3, 0, -40); },
  sWin: (tone) => { [523, 659, 784, 1047].forEach((f, i) => tone(f, .18, 'triangle', .16, i * .13)); },
  sDefuse: (tone) => { tone(700, .06, 'square', .14); tone(1000, .09, 'square', .14, .07); },
};

const REACT_SOUND_DEFS = {
  '\u{1F639}': (tone, melody) => { melody([659, 784, 659, 1047], .07, 'square', .12, .08); },
  '\u{1F631}': (tone, noise) => { tone(880, .35, 'sine', .16, 0, -560); noise(.2, .12, 'highpass', 2200, .05); },
  '\u{1F63E}': (tone, noise) => { tone(150, .26, 'sawtooth', .2, 0, -50); noise(.22, .13, 'lowpass', 500, 0); },
  '\u{1F44F}': (noise) => { [0, .11, .22].forEach(t => noise(.06, .3, 'bandpass', 1900, t, 1.4)); },
  '\u{1F525}': (noise) => { noise(.45, .22, 'highpass', 3400, 0); },
  '\u{1F4A3}': (tone, noise) => { tone(700, .5, 'sine', .1, 0, -620); noise(.12, .3, 'lowpass', 300, .5); },
  '\u{1F640}': (tone) => { tone(520, .14, 'triangle', .16); tone(760, .2, 'triangle', .16, .12); },
  '\u{1F63C}': (tone) => { tone(330, .12, 'sine', .13, 0, 180); tone(500, .16, 'sine', .11, .12, 120); },
};

/**
 * @typedef {Object} AudioContext
 * @property {AudioContext | null} context
 * @property {boolean} enabled
 */

/**
 * @param {() => AudioContext | null} audioContextCtor
 * @returns {AudioContext}
 */
export function createAudioService(audioContextCtor) {
  let ac = null;
  let enabled = true;

  function getContext() {
    if (!ac) {
      try { ac = audioContextCtor(); } catch (e) { return null; }
    }
    if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }

  function setEnabled(v) { enabled = v; }
  function isEnabled() { return enabled; }

  function unlockOnFirstGesture() {
    const c = getContext();
    if (c && c.state !== 'running') return;
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
      document.removeEventListener(ev, unlockOnFirstGesture, true));
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
    document.addEventListener(ev, unlockOnFirstGesture, true));

  /** @type {(f: number, dur: number, type?: string, vol?: number, when?: number, slide?: number) => void} */
  function tone(f, dur, type = 'square', vol = .16, when = 0, slide = 0) {
    if (!enabled) return;
    const c = getContext(); if (!c) return;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + .02);
  }

  /** @type {(dur: number, vol: number, type: string, freq: number, when?: number, q?: number) => void} */
  function noise(dur, vol, type, freq, when = 0, q = 1) {
    if (!enabled) return;
    const c = getContext(); if (!c) return;
    const t = c.currentTime + when;
    const n = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.4);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t); src.stop(t + dur);
  }

  const N = { C: 523, D: 587, E: 659, F: 698, G: 784, A: 880, B: 988, C2: 1047, G_: 392, E_: 330, A_: 440 };

  /** @type {(notes: number[], step?: number, type?: string, vol?: number, dur?: number) => void} */
  function melody(notes, step = .11, type = 'triangle', vol = .15, dur = .13) {
    notes.forEach((f, i) => { if (f) tone(f, dur, type, vol, i * step); });
  }

  function playCardSound(type) {
    const def = CARD_SOUND_DEFS[type];
    if (def) def(tone, noise, melody);
    else ACTION_SOUND_DEFS.sPop(tone);
  }

  const actions = {
    sDeal: () => ACTION_SOUND_DEFS.sDeal(noise),
    sYourTurn: () => ACTION_SOUND_DEFS.sYourTurn(tone),
    sTheirTurn: () => ACTION_SOUND_DEFS.sTheirTurn(tone),
    sAttacked: () => ACTION_SOUND_DEFS.sAttacked(tone, noise),
    sJoin: () => ACTION_SOUND_DEFS.sJoin(tone),
    sChat: () => ACTION_SOUND_DEFS.sChat(tone),
    sLose: () => ACTION_SOUND_DEFS.sLose(tone),
    sSteal: () => ACTION_SOUND_DEFS.sSteal(tone, noise),
    sPop: () => ACTION_SOUND_DEFS.sPop(tone),
    sSwish: () => ACTION_SOUND_DEFS.sSwish(tone),
    sNope: () => ACTION_SOUND_DEFS.sNope(tone),
    sUhoh: () => ACTION_SOUND_DEFS.sUhoh(tone),
    sBoom: () => {
      if (!enabled) return;
      const c = getContext(); if (!c) return;
      const t = c.currentTime;
      const b = c.createBuffer(1, c.sampleRate * .6, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
      const s = c.createBufferSource(); const g = c.createGain();
      s.buffer = b; g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.001, t + .6);
      s.connect(g); g.connect(c.destination); s.start(t);
      tone(70, .5, 'sine', .3, 0, -40);
    },
    sWin: () => ACTION_SOUND_DEFS.sWin(tone),
    sDefuse: () => ACTION_SOUND_DEFS.sDefuse(tone),
  };

  function playReactionSound(emoji) {
    const def = REACT_SOUND_DEFS[emoji];
    if (def) def(tone, noise, melody);
    else tone(880, .1, 'sine', .1, 0, 200);
  }

  return { getContext, setEnabled, isEnabled, playCardSound, playReactionSound, ...actions };
}