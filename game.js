// ============================================================
//  DEVICE DETECTION
// ============================================================
const isMobile = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry/i.test(navigator.userAgent);
if (!isMobile) document.body.classList.add('pc-mode');
if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
  const hideBar = () => { window.scrollTo(0, 1); window.scrollTo(0, 0); };
  document.addEventListener('touchstart', () => { hideBar(); }, { once: true, passive: true });
}

// ============================================================
//  PROGRESS — надёжное сохранение
// ============================================================
const PROGRESS_KEY = 'brigade_progress_v2';

const OLD_PROGRESS_KEY = 'brigade_progress';

function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    // Перенос прогресса из старой версии ({id: true})
    const oldRaw = localStorage.getItem(OLD_PROGRESS_KEY);
    if (oldRaw) {
      const old = JSON.parse(oldRaw) || {};
      for (const k of Object.keys(old)) if (old[k] && !data[k]) data[k] = { completed: true, time: Date.now() };
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
      localStorage.removeItem(OLD_PROGRESS_KEY);
    }
    return data;
  } catch(e) { console.error('loadProgress error', e); return {}; }
}
function saveProgress(missionId) {
  if (!missionId) { console.warn('saveProgress: no missionId'); return; }
  try {
    const p = loadProgress();
    p[missionId] = { completed: true, time: Date.now() };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
    console.log('[PROGRESS] Saved:', missionId, p);
  } catch(e) { console.error('saveProgress error', e); }
}
function hasCompleted(missionId) {
  const p = loadProgress();
  return !!(p[missionId] && p[missionId].completed === true);
}
function countCompleted() {
  const p = loadProgress();
  return Object.keys(p).filter(k => p[k] && p[k].completed).length;
}
function resetProgress() {
  try { localStorage.removeItem(PROGRESS_KEY); localStorage.removeItem(OLD_PROGRESS_KEY); console.log('[PROGRESS] Reset'); } catch(e){}
}

// ============================================================
//  SETTINGS — размеры джойстиков
// ============================================================
const SETTINGS_KEY = 'brigade_settings_v2';
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { moveSize: s.moveSize || 120, fireSize: s.fireSize || 120 };
  } catch(e) { return { moveSize: 120, fireSize: 120 }; }
}
function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch(e) {}
}
function applySettings(s) {
  document.documentElement.style.setProperty('--move-size', s.moveSize + 'px');
  document.documentElement.style.setProperty('--fire-size', s.fireSize + 'px');
  const sm = document.getElementById('slider-move');
  const sf = document.getElementById('slider-fire');
  const vm = document.getElementById('val-move');
  const vf = document.getElementById('val-fire');
  if (sm) sm.value = s.moveSize;
  if (sf) sf.value = s.fireSize;
  if (vm) vm.textContent = s.moveSize;
  if (vf) vf.textContent = s.fireSize;
}

// ============================================================
//  INTRO
// ============================================================
let introShown = false;
function playIntro() {
  const el = document.getElementById('intro');
  el.classList.add('visible');
  void el.offsetWidth;
  el.style.opacity = '1';
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    setTimeout(() => { el.style.display = 'none'; el.classList.remove('visible'); }, 1300);
  };
  // Заставка перекрывает меню 7 секунд — даём пропустить её тапом/кликом
  el.addEventListener('click', close);
  el.addEventListener('touchstart', e => { e.preventDefault(); close(); }, { passive:false });
  setTimeout(close, 6000);
}
function maybeShowIntro() {
  if (introShown) return;
  if (innerWidth > innerHeight) { introShown = true; setTimeout(playIntro, 350); }
}
window.addEventListener('resize', maybeShowIntro);
window.addEventListener('orientationchange', () => setTimeout(maybeShowIntro, 200));
maybeShowIntro();

// ============================================================
//  CHEAT CODES
// ============================================================
const CHEAT_CODES = {
  'AIR01': 'airstrike', 'MRT02': 'mortar', 'FDR03': 'firedrop', 'BLK04': 'blackout',
  'GAS05': 'gas', 'FOG06': 'fog', 'SNP07': 'sniper', 'SUP08': 'supply',
};

// ============================================================
//  AUDIO
// ============================================================
let audioCtx = null, noiseBuf = null;
function initAudio() {
  if (!audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; audioCtx = new AC(); }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
  if (!noiseBuf && audioCtx) {
    const size = audioCtx.sampleRate * 0.8;
    noiseBuf = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
  }
}
document.addEventListener('touchstart', initAudio, { once: true });
document.addEventListener('mousedown', initAudio, { once: true });
document.addEventListener('keydown', initAudio, { once: true });

let lastShotSound = 0;
function playShoot(w) {
  if (!audioCtx || !noiseBuf) return;
  const now = performance.now(); if (now - lastShotSound < 30) return; lastShotSound = now;
  const t = audioCtx.currentTime;
  const src = audioCtx.createBufferSource(); src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const bp = audioCtx.createBiquadFilter();
  bp.type = 'lowpass'; bp.frequency.value = w === 2 ? 3800 : (w === 1 ? 1600 : 2400); bp.Q.value = 1.2;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
  src.connect(bp); bp.connect(g); g.connect(audioCtx.destination);
  src.start(t); src.stop(t + 0.15);
  const osc = audioCtx.createOscillator(); osc.type = 'triangle';
  const f0 = w === 2 ? 90 : (w === 1 ? 70 : 110);
  osc.frequency.setValueAtTime(f0, t); osc.frequency.exponentialRampToValueAtTime(f0 * 0.4, t + 0.07);
  const og = audioCtx.createGain();
  og.gain.setValueAtTime(0.22, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  osc.connect(og); og.connect(audioCtx.destination);
  osc.start(t); osc.stop(t + 0.12);
}
let lastAllySound = 0;
function playAllyShoot() {
  if (!audioCtx || !noiseBuf) return;
  const now = performance.now(); if (now - lastAllySound < 40) return; lastAllySound = now;
  const t = audioCtx.currentTime;
  const src = audioCtx.createBufferSource(); src.buffer = noiseBuf;
  src.playbackRate.value = 1.5 + Math.random() * 0.3;
  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 1.5;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  src.connect(bp); bp.connect(g); g.connect(audioCtx.destination);
  src.start(t); src.stop(t + 0.12);
  const osc = audioCtx.createOscillator(); osc.type = 'square';
  osc.frequency.setValueAtTime(140, t); osc.frequency.exponentialRampToValueAtTime(60, t + 0.05);
  const og = audioCtx.createGain();
  og.gain.setValueAtTime(0.1, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  osc.connect(og); og.connect(audioCtx.destination);
  osc.start(t); osc.stop(t + 0.08);
}
function playEnemyShoot() {
  if (!audioCtx || !noiseBuf) return;
  const t = audioCtx.currentTime;
  const src = audioCtx.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = 1.1;
  const bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 0.9;
  const g = audioCtx.createGain(); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  src.connect(bp); bp.connect(g); g.connect(audioCtx.destination);
  src.start(t); src.stop(t + 0.11);
}
function playShotgunBlast() {
  if (!audioCtx || !noiseBuf) return;
  const t = audioCtx.currentTime;
  const src = audioCtx.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = 0.55;
  const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
  const g = audioCtx.createGain(); g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  src.connect(lp); lp.connect(g); g.connect(audioCtx.destination);
  src.start(t); src.stop(t + 0.32);
  const osc = audioCtx.createOscillator(); osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(65, t); osc.frequency.exponentialRampToValueAtTime(30, t + 0.18);
  const og = audioCtx.createGain(); og.gain.setValueAtTime(0.32, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  osc.connect(og); og.connect(audioCtx.destination); osc.start(t); osc.stop(t + 0.22);
}
function playExplosion() {
  if (!audioCtx || !noiseBuf) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator(); osc.type = 'sine';
  osc.frequency.setValueAtTime(120, t); osc.frequency.exponentialRampToValueAtTime(28, t + 0.9);
  const og = audioCtx.createGain(); og.gain.setValueAtTime(0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
  osc.connect(og); og.connect(audioCtx.destination); osc.start(t); osc.stop(t + 1.05);
  const src = audioCtx.createBufferSource(); src.buffer = noiseBuf;
  const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2500, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.6);
  const g = audioCtx.createGain(); g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
  src.connect(lp); lp.connect(g); g.connect(audioCtx.destination);
  src.start(t); src.stop(t + 0.8);
}
function playGlassBreak() {
  if (!audioCtx || !noiseBuf) return;
  const t = audioCtx.currentTime;
  const src = audioCtx.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = 2.2;
  const hp = audioCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
  const g = audioCtx.createGain(); g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  src.connect(hp); hp.connect(g); g.connect(audioCtx.destination);
  src.start(t); src.stop(t + 0.3);
}
function playMedkit() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = audioCtx.createOscillator(); osc.type = 'sine';
    osc.frequency.value = 660 * Math.pow(1.26, i);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, t + i*0.07);
    g.gain.linearRampToValueAtTime(0.14, t + i*0.07 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + i*0.07 + 0.18);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(t + i*0.07); osc.stop(t + i*0.07 + 0.2);
  }
}
function playCrash() {
  if (!audioCtx || !noiseBuf) return;
  const t = audioCtx.currentTime;
  const src = audioCtx.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = 1.8;
  const bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.9;
  const g = audioCtx.createGain(); g.gain.setValueAtTime(0.24, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  src.connect(bp); bp.connect(g); g.connect(audioCtx.destination);
  src.start(t); src.stop(t + 0.5);
}
function playHit() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator(); osc.type = 'square';
  osc.frequency.setValueAtTime(320, t); osc.frequency.exponentialRampToValueAtTime(80, t + 0.08);
  const g = audioCtx.createGain(); g.gain.setValueAtTime(0.14, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  osc.connect(g); g.connect(audioCtx.destination); osc.start(t); osc.stop(t + 0.1);
}
function playHurt() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator(); osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(180, t); osc.frequency.exponentialRampToValueAtTime(70, t + 0.35);
  const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
  const g = audioCtx.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  osc.connect(lp); lp.connect(g); g.connect(audioCtx.destination); osc.start(t); osc.stop(t + 0.45);
}
let lastVoice = 0;
function playEnemyVoice(pitchShift = 0) {
  if (!audioCtx) return;
  const now = performance.now(); if (now - lastVoice < 1100) return; lastVoice = now;
  const t = audioCtx.currentTime;
  const basePitch = 180 + Math.random() * 120 + pitchShift;
  const notes = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < notes; i++) {
    const start = t + i * (0.075 + Math.random() * 0.05);
    const dur = 0.05 + Math.random() * 0.05;
    const freq = basePitch + (Math.random() - 0.5) * 90;
    const osc = audioCtx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = freq;
    const bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq * 3.5; bp.Q.value = 6;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.055, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(bp); bp.connect(g); g.connect(audioCtx.destination);
    osc.start(start); osc.stop(start + dur + 0.02);
  }
}
let lastFireLoop = 0;
function playFireAmbient() {
  if (!audioCtx || !noiseBuf) return;
  const now = performance.now(); if (now - lastFireLoop < 220) return; lastFireLoop = now;
  const t = audioCtx.currentTime;
  const src = audioCtx.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = 0.6 + Math.random() * 0.3;
  const bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8;
  const g = audioCtx.createGain(); g.gain.setValueAtTime(0.045, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  src.connect(bp); bp.connect(g); g.connect(audioCtx.destination);
  src.start(t); src.stop(t + 0.25);
}
function playAlarm() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = audioCtx.createOscillator(); osc.type = 'sawtooth';
    const start = t + i * 0.25;
    osc.frequency.setValueAtTime(880, start);
    osc.frequency.linearRampToValueAtTime(440, start + 0.2);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.14, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(start); osc.stop(start + 0.24);
  }
}
function playPlaneEngine() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator(); osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(60, t);
  const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.12, t + 0.3);
  g.gain.setValueAtTime(0.12, t + 6.5);
  g.gain.exponentialRampToValueAtTime(0.001, t + 7.2);
  osc.connect(lp); lp.connect(g); g.connect(audioCtx.destination);
  osc.start(t); osc.stop(t + 7.3);
}
function playBombWhistle() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator(); osc.type = 'sine';
  osc.frequency.setValueAtTime(2200, t);
  osc.frequency.exponentialRampToValueAtTime(300, t + 1.2);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
  osc.connect(g); g.connect(audioCtx.destination);
  osc.start(t); osc.stop(t + 1.35);
}

// ============================================================
//  ENGINE
// ============================================================
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d', { alpha: false });
// Canvas рисуется в логических CSS-пикселях (VW×VH), а буфер — с учётом плотности экрана.
// renderScale стартует с devicePixelRatio (не выше 2) и сам снижается до 1, если устройство не тянет.
let VW = innerWidth, VH = innerHeight;
const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
let renderScale = isMobile ? Math.min(DPR, 1.5) : DPR;
let safeLeft = 0;
let vignetteGrad = null;
let needsRender = true;
const safeProbe = document.createElement('div');
safeProbe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-left:env(safe-area-inset-left);';
document.body.appendChild(safeProbe);
function resize() {
  VW = innerWidth; VH = innerHeight;
  canvas.width = Math.round(VW * renderScale); canvas.height = Math.round(VH * renderScale);
  canvas.style.width = VW + 'px'; canvas.style.height = VH + 'px';
  safeLeft = parseFloat(getComputedStyle(safeProbe).paddingLeft) || 0;
  vignetteGrad = null;
  needsRender = true;
}
resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));

// Адаптивное качество: если кадр стабильно дольше ~24 мс, уменьшаем разрешение буфера.
const perf = { ema: 16.7, samples: 0, lastDrop: 0 };
function trackFramePerf(frameMs) {
  perf.ema += (frameMs - perf.ema) * 0.05;
  perf.samples++;
  const now = performance.now();
  if (perf.samples > 120 && perf.ema > 24 && renderScale > 1 && now - perf.lastDrop > 3000) {
    renderScale = Math.max(1, Math.round((renderScale - 0.5) * 2) / 2);
    perf.lastDrop = now; perf.samples = 0; perf.ema = 16.7;
    resize();
  }
}

const UNIT = 48;
const WORLD_LIMIT = 4000;

const MIL = {
  wall: '#5a5a5e', wallDark: '#3a3a3e', wallEdge: '#6a6a6e',
  destruct: '#7a6a5a', destructDark: '#4a3a2a', blood: '#7a1e1e',
  player: '#3a5a9a', playerOutline: '#1a2a5a',
  ally: '#4a7a4a', allyOutline: '#1a3a1a',
  skin: '#d4a574',
  gruntBody: '#a04040', gruntOutline: '#601818',
  rusherBody: '#c06030', rusherOutline: '#6a2810',
  sniperBody: '#8a408a', sniperOutline: '#4a104a',
  heavyBody: '#8a2020', heavyOutline: '#4a0a0a',
  molotovBody: '#c08020', molotovOutline: '#6a4010',
  tankBody: '#602040', tankOutline: '#2a0818',
  orange: '#c07840', pink: '#c05070',
  guestBody: '#b06040', guestOutline: '#4a2018',
};

const player = {
  x: 0, y: 0, vx: 0, vy: 0,
  angle: -Math.PI/2,
  hp: 100, maxHp: 100,
  weapon: 0, ammo: 30, reserve: 120,
  reloading: false, lastShot: 0, firing: false,
  speed: 180, radius: 15, alive: true, burning: 0,
};

const WEAPONS = [
  { name:'АК-74',    dmg:28, fireRate:110, magSize:30, reserve:120, spread:0.07, auto:true,  reload:2200, range:900,  bulletSpeed:1400, color:'#d0b070' },
  { name:'ДРОБОВИК', dmg:22, fireRate:750, magSize:6,  reserve:24,  spread:0.30, auto:false, reload:2500, range:420,  bulletSpeed:1000, color:'#c07840', pellets:7 },
  { name:'СВД',      dmg:130,fireRate:1300,magSize:5,  reserve:20,  spread:0.012,auto:false, reload:3000, range:1600, bulletSpeed:2200, color:'#8ab8d0' },
];

const ENEMY_TYPES = {
  grunt:   { name:'ГРАНТ',     hp:80,  speed:130, fireRate:[550,850],   dmg:6,  idealRange:300, retrRange:140, advRange:420, shootRange:520, viewRange:720,  fov:0.66*Math.PI, body:MIL.gruntBody, outline:MIL.gruntOutline, size:15, voicePitch:0, skin:MIL.skin },
  rusher:  { name:'ШТУРМОВИК', hp:65,  speed:210, fireRate:[380,620],   dmg:9,  idealRange:130, retrRange:70,  advRange:200, shootRange:260, viewRange:640,  fov:0.72*Math.PI, body:MIL.rusherBody, outline:MIL.rusherOutline, size:15, voicePitch:40, aggro:true, skin:MIL.skin },
  sniper:  { name:'СНАЙПЕР',   hp:70,  speed:70,  fireRate:[1900,2600], dmg:34, idealRange:850, retrRange:450, advRange:1000,shootRange:1100,viewRange:1150, fov:0.48*Math.PI, body:MIL.sniperBody, outline:MIL.sniperOutline, size:15, voicePitch:-40, keepDist:true, skin:MIL.skin },
  heavy:   { name:'ТЯЖЁЛЫЙ',   hp:170, speed:95,  fireRate:[180,300],   dmg:5,  idealRange:340, retrRange:200, advRange:500, shootRange:520, viewRange:720,  fov:0.72*Math.PI, body:MIL.heavyBody, outline:MIL.heavyOutline, size:19, voicePitch:-70, burst:8, skin:MIL.skin },
  molotov: { name:'МОЛОТОВЩИК',hp:75,  speed:150, fireRate:[2400,3400], dmg:0,  idealRange:380, retrRange:220, advRange:550, shootRange:430, viewRange:720,  fov:0.66*Math.PI, body:MIL.molotovBody, outline:MIL.molotovOutline, size:15, voicePitch:60, thrower:true, skin:MIL.skin },
  tank:    { name:'ТАНК',      hp:340, speed:100, fireRate:[1500,2000], dmg:10, idealRange:170, retrRange:100, advRange:420, shootRange:280, viewRange:640,  fov:0.72*Math.PI, body:MIL.tankBody, outline:MIL.tankOutline, size:22, voicePitch:-90, shotgun:8, shotgunSpread:0.7, assault:true, skin:MIL.skin },
};

const WORLD = { walls: [], obstacles: [], destructibles: [], furniture: [] };
const enemies = [];
const squad = [];
const bullets = [];
const grenades = [];
const molotovs = [];
const fires = [];
const effects = [];
const bloodDecals = [];
const medkits = [];
const hazards = [];
const SQUAD_NAMES = ['АЛЬФА-2', 'АЛЬФА-3', 'АЛЬФА-4'];

let worldBounds = { minX: -1500, maxX: 1500, minY: -1500, maxY: 1500 };
let pendingEnemySpawns = [];
let scheduledEvent = null;
let pendingAirstrike = null;

const stats = { damageDealt: 0, damageTaken: 0, kills: 0, startRealTime: 0 };
function resetStats() {
  stats.damageDealt = 0; stats.damageTaken = 0; stats.kills = 0;
  stats.startRealTime = performance.now();
}
function getElapsedSeconds() { return (performance.now() - stats.startRealTime) / 1000; }

let waveMode = false;
let waveNumber = 0;
let waveKillsNeeded = 0;
let waveBetweenTimer = 0;
let waveInProgress = false;

let airMode = false;
let airModeTimer = 0;
let airPlane = { x: 0, y: 0, angle: -Math.PI/2, speed: 380 };
let airBombs = [];
let airBombsRemaining = 5;
let airDropCooldown = 0;

// ============================================================
//  TUTORIAL (separate mode)
// ============================================================
let tutorialMode = false;
let tutorialStep = 0;
let tutorialStartTime = 0;
let tutorialState = {};
let legendShown = false;

const TUTORIAL_STEPS = [
  { id:'move',    text:'ДВИЖЕНИЕ\nЛевый джойстик / WASD', hint:'Сдвинься на 300 пикселей', dur: 12 },
  { id:'aim',     text:'ПРИЦЕЛ\nПравый джойстик / Мышь', hint:'Поверни прицел вокруг себя', dur: 12 },
  { id:'shoot',   text:'ОГОНЬ\nУдерживай правый джойстик 0.4с / ЛКМ', hint:'Сделай выстрел', dur: 10 },
  { id:'reload',  text:'ПЕРЕЗАРЯДКА\nКнопка R / клавиша R', hint:'Перезарядись (R)', dur: 8 },
  { id:'weapon',  text:'СМЕНА ОРУЖИЯ\nКнопка 🔫 / Q / 1-3', hint:'Переключи оружие', dur: 8 },
  { id:'grenade', text:'ГРАНАТА\nКнопка 💣 / G', hint:'Брось гранату', dur: 12 },
  { id:'wall',    text:'РАЗРУШАЕМЫЕ СТЕНЫ\nЖёлто-коричневые стены ломаются гранатой\nОбычные серые — нет', hint:'Брось гранату в стену справа →', dur: 20 },
  { id:'medkit',  text:'АПТЕЧКИ\nЗелёные крестики восполняют +30 HP', hint:'Подбери аптечку слева ←', dur: 20 },
  { id:'squadhp', text:'ЛЕЧЕНИЕ ОТРЯДА\nАптечка лечит и тебя, и раненых союзников', hint:'Подбери ещё одну аптечку слева ←', dur: 20 },
  { id:'command', text:'ПРИКАЗЫ ОТРЯДУ\nКнопка ⚔ / E / Tab\n8 приказов: следуй, держись, атакуй и т.д.', hint:'Открой меню приказов', dur: 15 },
  { id:'minimap', text:'МИНИКАРТА\nСлева сверху — карта уровня.\nВсе обозначения — в легенде.', hint:'Прочитай легенду обозначений', dur: 15, showLegend: true },
  { id:'events',  text:'СОБЫТИЯ\nИногда случаются: авиаудар, миномёт, огненный дождь,\nтуман, газ, снайперы, отключение света. Следи за баннером!', hint:'Запомни — это спасёт жизнь', dur: 10 },
  { id:'combat',  text:'БОЙ!\nУбей 3 противника, чтобы завершить обучение', hint:'Ликвидируй всех врагов', dur: 90, spawnEnemies: true },
];

function showTutorialHint() {
  if (!tutorialMode) return;
  const el = document.getElementById('tutorial-hint');
  const stepEl = document.getElementById('tutorial-step-num');
  const textEl = document.getElementById('tutorial-text');
  if (tutorialStep >= TUTORIAL_STEPS.length) { hideTutorialHint(); return; }
  const s = TUTORIAL_STEPS[tutorialStep];
  stepEl.textContent = `ШАГ ${tutorialStep + 1} / ${TUTORIAL_STEPS.length}`;
  textEl.innerHTML = s.text.replace(/\n/g, '<br>') + (s.hint ? `<br><span style="font-size:11px;color:#a0a8b0;letter-spacing:1px;margin-top:6px;display:inline-block;">${s.hint}</span>` : '');
  el.classList.add('active');
  document.getElementById('tutorial-skip').classList.add('active');
  tutorialStartTime = performance.now();
  // Per-step setup
  const cur = TUTORIAL_STEPS[tutorialStep];
  if (cur.id === 'medkit') {
    // Damage player so medkit is useful
    player.hp = Math.max(40, player.hp - 30);
    updateHUD();
    // Spawn medkit to the left
    medkits.push({ x: player.x - 200, y: player.y, born: gameTime, radius: 15 });
  }
  if (cur.id === 'squadhp') {
    // Damage squad so healing is visible
    squad.forEach(s => { if (s.alive) s.hp = Math.max(30, s.hp - 40); });
    // Spawn medkit left
    medkits.push({ x: player.x - 200, y: player.y, born: gameTime, radius: 15 });
  }
  if (cur.id === 'minimap' && !legendShown) {
    // Show legend modal
    setTimeout(() => { showLegend(); }, 600);
  }
  if (cur.spawnEnemies && !cur._spawned) {
    cur._spawned = true;
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const p = findFreeSpotNear(player.x + Math.cos(a) * 400, player.y + Math.sin(a) * 400, 100, 200);
      enemies.push(createEnemy(p.x, p.y, 'grunt'));
    }
    updateHUD();
  }
}
function hideTutorialHint() {
  document.getElementById('tutorial-hint').classList.remove('active');
  document.getElementById('tutorial-skip').classList.remove('active');
}
function advanceTutorial() {
  tutorialStep++;
  if (tutorialStep >= TUTORIAL_STEPS.length) {
    endTutorial();
  } else {
    showTutorialHint();
  }
}
function endTutorial() {
  tutorialMode = false;
  hideTutorialHint();
  if (enemies.filter(e => e.alive).length === 0) {
    // All done
    log('✓ ОБУЧЕНИЕ ЗАВЕРШЕНО!', 'good');
    setTimeout(() => {
      gameOver(true, null, 'ОБУЧЕНИЕ ПРОЙДЕНО');
    }, 1500);
  }
}
function skipTutorial() {
  if (!tutorialMode) return;
  endTutorial();
}
function showLegend() {
  legendShown = true;
  document.getElementById('tutorial-legend').classList.add('active');
}
function closeLegend() {
  document.getElementById('tutorial-legend').classList.remove('active');
  if (tutorialMode && TUTORIAL_STEPS[tutorialStep] && TUTORIAL_STEPS[tutorialStep].id === 'minimap') {
    tutorialState.legendRead = true;
  }
}
function updateTutorial(dt) {
  if (!tutorialMode) return;
  const elapsed = (performance.now() - tutorialStartTime) / 1000;
  const cur = TUTORIAL_STEPS[tutorialStep];
  if (!cur) return;
  let done = false;
  if (cur.id === 'move') done = (tutorialState.moved || 0) > 300;
  else if (cur.id === 'aim') done = (tutorialState.turnAccum || 0) > 3.5;
  else if (cur.id === 'shoot') done = (tutorialState.shots || 0) > 0;
  else if (cur.id === 'reload') done = tutorialState.reloaded;
  else if (cur.id === 'weapon') done = tutorialState.switchedWeapon;
  else if (cur.id === 'grenade') done = tutorialState.threwGrenade;
  else if (cur.id === 'wall') done = tutorialState.brokeWall;
  else if (cur.id === 'medkit') done = tutorialState.medkitsTaken >= 1;
  else if (cur.id === 'squadhp') done = tutorialState.medkitsTaken >= 2;
  else if (cur.id === 'command') done = tutorialState.commanded;
  else if (cur.id === 'minimap') done = tutorialState.legendRead;
  else if (cur.id === 'events') done = elapsed > cur.dur;
  else if (cur.id === 'combat') done = enemies.filter(e => e.alive).length === 0 && (tutorialState.combatStarted);
  if (cur.id === 'combat' && !tutorialState.combatStarted) tutorialState.combatStarted = true;
  if (done || elapsed > cur.dur + 6) advanceTutorial();
}
function startTutorialMode() {
  initAudio();
  tutorialMode = true;
  tutorialStep = 0;
  tutorialState = {};
  tutorialStartTime = performance.now();
  legendShown = false;
  TUTORIAL_STEPS.forEach(s => { s._spawned = false; });
  currentMission = { id:'tutorial', type:'tutorial', name:'ОБУЧЕНИЕ', level:0, theme:'industrial', desc:'Все механики игры', enemies:3 };
  waveMode = false;
  airMode = false;
  scheduledEvent = null;
  pendingAirstrike = null;
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('end-screen').style.display = 'none';
  document.getElementById('mission').textContent = '🎓 ОБУЧЕНИЕ';
  document.getElementById('objective').textContent = 'Выполняй подсказки';
  buildTutorialMap();
  showTutorialHint();
  log('★ РЕЖИМ ОБУЧЕНИЯ', 'good');
  log('Выполняй подсказки по центру', 'warn');
}
function buildTutorialMap() {
  clearWorld();
  tutorialMode = true;
  currentTheme = 'industrial';
  player.x = -12 * UNIT; player.y = 0;
  player.hp = player.maxHp;
  player.alive = true;
  player.reloading = false;
  player.weapon = 0;
  player.ammo = WEAPONS[0].magSize;
  player.reserve = WEAPONS[0].reserve;
  player.angle = 0;
  player.vx = 0; player.vy = 0;
  player.burning = 0;
  resetStats();

  // Large open arena 30x20
  addWallRect(-15,-10,15,-9.5);
  addWallRect(-15,9.5,15,10);
  addWallRect(-15,-10,-14.5,10);
  addWallRect(14.5,-10,15,10);

  // Some obstacles for cover
  addObstacleRect(-5,-5,2,2);
  addObstacleRect(-5,5,2,2);
  addObstacleRect(0,0,2,2);

  // Destructible wall on the right side
  addDestructible(8,-2,10,2);

  // No medkits initially (they spawn during steps)
  // No enemies initially (they spawn on combat step)

  let safety = 0;
  while (collides(player.x, player.y, player.radius + 4) && safety++ < 50) player.x += 20;
  computeWorldBounds();
  spawnSquadSafely();
  updateHUD();
  updateWeaponSelector();
}

// ============================================================
//  EVENTS
// ============================================================
const EVENTS = [
  { id:'airstrike', icon:'🚨', title:'АВИАУДАР!', desc:'3 СЕКУНДЫ ДО УДАРА!', color:'#c05050', glow:'rgba(180,40,40,0.6)' },
  { id:'mortar',    icon:'💥', title:'МИНОМЁТНЫЙ ОБСТРЕЛ!', desc:'Держитесь подальше от открытых зон!', color:'#c07840', glow:'rgba(180,100,40,0.6)' },
  { id:'firedrop',  icon:'🔥', title:'ОГНЕННЫЙ ДОЖДЬ!', desc:'Молотовы падают с неба — двигайтесь!', color:'#ff8040', glow:'rgba(255,120,40,0.6)' },
  { id:'blackout',  icon:'🌑', title:'ОТКЛЮЧЕНИЕ СВЕТА!', desc:'Видимость снижена', color:'#8080c0', glow:'rgba(60,60,140,0.6)' },
  { id:'gas',       icon:'☠',  title:'ГАЗОВАЯ АТАКА!', desc:'Токсичные облака — не вдыхайте!', color:'#8ab87a', glow:'rgba(80,160,60,0.5)' },
  { id:'fog',       icon:'🌫', title:'ТУМАН!', desc:'Плохая видимость', color:'#b0b0b0', glow:'rgba(140,140,140,0.5)' },
  { id:'sniper',    icon:'🎯', title:'ВРАЖЕСКИЙ СНАЙПЕР!', desc:'Снайпер на позиции — не высовывайтесь!', color:'#a060a0', glow:'rgba(120,60,140,0.5)' },
  { id:'supply',    icon:'📦', title:'ГУМАННЫЙ КОНВОЙ!', desc:'+30 HP', color:'#8ab87a', glow:'rgba(80,180,80,0.4)' },
];

let eventCooldown = 0;
let activeEventId = null;
let activeEventTimer = 0;
let eventBannerTimer = 0;

function triggerRandomEvent() {
  if (activeEventId) return;
  const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
  fireEvent(ev.id);
}
function fireEvent(eventId) {
  const ev = EVENTS.find(e => e.id === eventId);
  if (!ev) return;
  activeEventId = ev.id;
  activeEventTimer = 4000;
  showEventBanner(ev);
  playAlarm();
  log(`⚠ ${ev.title}`, 'warn');
  if (ev.id === 'airstrike') {
    pendingAirstrike = { time: gameTime + 3000 };
    document.getElementById('want-plane-btn').classList.add('active');
  } else {
    executeEvent(ev.id);
  }
}
function showEventBanner(ev) {
  const banner = document.getElementById('event-banner');
  banner.style.setProperty('--ev-color', ev.color);
  banner.style.setProperty('--ev-color-glow', ev.glow);
  document.getElementById('event-icon').textContent = ev.icon;
  document.getElementById('event-title').textContent = ev.title;
  document.getElementById('event-title').style.color = ev.color;
  document.getElementById('event-desc').textContent = ev.desc;
  banner.classList.add('active');
  eventBannerTimer = 3.2;
  const btn = document.getElementById('want-plane-btn');
  if (ev.id === 'airstrike') btn.classList.add('active');
  else btn.classList.remove('active');
}
function clampToBounds(x, y, pad = 60) {
  return { x: Math.max(worldBounds.minX + pad, Math.min(worldBounds.maxX - pad, x)),
           y: Math.max(worldBounds.minY + pad, Math.min(worldBounds.maxY - pad, y)) };
}
function executeEvent(id) {
  switch (id) {
    case 'airstrike': {
      const count = 6 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 100 + Math.random() * 250;
        const p = clampToBounds(player.x + Math.cos(angle) * radius, player.y + Math.sin(angle) * radius, 130);
        hazards.push({ type:'marker', x:p.x, y:p.y, radius:130, born:gameTime, warnDur:900, isExploded:false, damage:120 });
      }
      break;
    }
    case 'mortar': {
      const count = 8 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) {
        const delay = i * 500;
        const angle = Math.random() * Math.PI * 2;
        const radius = 80 + Math.random() * 300;
        const p = clampToBounds(player.x + Math.cos(angle) * radius, player.y + Math.sin(angle) * radius, 110);
        hazards.push({ type:'marker', x:p.x, y:p.y, radius:110, born:gameTime + delay, warnDur:600, isExploded:false, damage:90 });
      }
      break;
    }
    case 'firedrop': {
      const count = 10 + Math.floor(Math.random() * 5);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 80 + Math.random() * 380;
        const p = clampToBounds(player.x + Math.cos(angle) * radius, player.y + Math.sin(angle) * radius, 60);
        molotovs.push({ x: p.x, y: p.y, vx: 0, vy: 0, h: 600, vh: 0, spawnTime: gameTime + i * 200, owner: 'enemy', waiting: true });
      }
      log('🔥 ОГНЕННЫЙ ДОЖДЬ!', 'warn');
      break;
    }
    case 'blackout': hazards.push({ type:'darkness', born:gameTime, duration:15000 }); break;
    case 'gas': {
      const count = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 150 + Math.random() * 350;
        const p = clampToBounds(player.x + Math.cos(angle) * dist, player.y + Math.sin(angle) * dist, 100);
        hazards.push({ type:'gas', x:p.x, y:p.y, radius:120, born:gameTime + i*300, duration:8000 });
      }
      break;
    }
    case 'fog': hazards.push({ type:'fog', born:gameTime, duration:12000 }); break;
    case 'sniper': {
      const count = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 900 + Math.random() * 400;
        const clamped = clampToBounds(player.x + Math.cos(angle) * dist, player.y + Math.sin(angle) * dist, 120);
        const p = findFreeSpotNear(clamped.x, clamped.y, 80, 200);
        enemies.push(createEnemy(p.x, p.y, 'sniper'));
      }
      break;
    }
    case 'supply': {
      player.hp = Math.min(player.maxHp, player.hp + 30);
      updateHUD();
      log('+30 HP', 'good');
      break;
    }
  }
}
function updateEvents(dt) {
  if (eventBannerTimer > 0) {
    eventBannerTimer -= dt;
    if (eventBannerTimer <= 0) {
      document.getElementById('event-banner').classList.remove('active');
      document.getElementById('want-plane-btn').classList.remove('active');
    }
  }
  if (activeEventId) {
    activeEventTimer -= dt * 1000;
    if (activeEventTimer <= 0) { activeEventId = null; activeEventTimer = 0; }
  }
  if (pendingAirstrike && gameTime >= pendingAirstrike.time) {
    pendingAirstrike = null;
    executeEvent('airstrike');
  }
  if (scheduledEvent && gameTime >= scheduledEvent.time && !activeEventId) {
    fireEvent(scheduledEvent.id);
    scheduledEvent = null;
  }
  eventCooldown -= dt;
  if (!tutorialMode && !scheduledEvent && !waveMode && eventCooldown <= 0 && !gameOverFlag && !activeEventId && currentMission && player.alive && !airMode) {
    eventCooldown = 25 + Math.random() * 25;
    triggerRandomEvent();
  }
  if (!tutorialMode && !scheduledEvent && waveMode && eventCooldown <= 0 && !gameOverFlag && !activeEventId && player.alive && !airMode) {
    eventCooldown = 20 + Math.random() * 20;
    triggerRandomEvent();
  }
  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i];
    if (h.type === 'marker') {
      if (!h.isExploded && gameTime - h.born > h.warnDur) { h.isExploded = true; explodeHazard(h.x, h.y, h.radius, h.damage); }
      if (gameTime - h.born > h.warnDur + 400) hazards.splice(i, 1);
    } else if (h.type === 'darkness' || h.type === 'fog') {
      if (gameTime - h.born > h.duration) hazards.splice(i, 1);
    } else if (h.type === 'gas') {
      if (gameTime - h.born > h.duration) { hazards.splice(i, 1); continue; }
      if (gameTime < h.born) continue;
      const tickDamage = 26 * dt;
      if (player.alive && Math.hypot(player.x - h.x, player.y - h.y) < h.radius) {
        player.hp -= tickDamage; stats.damageTaken += tickDamage;
        player.burning = 0.3;
        if (Math.random() < dt * 4) showDamage();
        updateHUD();
        if (player.hp <= 0) { player.hp = 0; player.alive = false; gameOver(false, 'Отравлен газом'); }
      }
      for (const s of squad) if (s.alive) {
        if (Math.hypot(s.x - h.x, s.y - h.y) < h.radius) {
          s.hp -= tickDamage * 0.8;
          if (s.hp <= 0) { s.alive = false; log(`${s.name} погиб от газа`, 'warn'); }
        }
      }
      for (const e of enemies) if (e.alive) {
        if (Math.hypot(e.x - h.x, e.y - h.y) < h.radius) {
          e.hp -= tickDamage * 0.7;
          if (e.hp <= 0) { e.alive = false; onEnemyKilled(e); checkMissionComplete(); }
        }
      }
    }
  }
}
function explodeHazard(x, y, radius, dmg) {
  playExplosion();
  if (player.alive && Math.hypot(player.x - x, player.y - y) < radius) {
    player.hp -= dmg; stats.damageTaken += dmg;
    showDamage(); playHurt(); updateHUD();
    if (player.hp <= 0) { player.hp = 0; player.alive = false; gameOver(false, 'Погиб под бомбёжкой'); }
  }
  for (const s of squad) if (s.alive) {
    if (Math.hypot(s.x - x, s.y - y) < radius) {
      s.hp -= dmg * 0.85;
      if (s.hp <= 0) { s.alive = false; log(`${s.name} погиб!`, 'warn'); }
    }
  }
  for (const e of enemies) if (e.alive) {
    if (Math.hypot(e.x - x, e.y - y) < radius) {
      e.hp -= dmg;
      if (e.hp <= 0) { e.alive = false; onEnemyKilled(e); checkMissionComplete(); }
    }
  }
  damageFurnitureArea(x, y, radius);
  if (window.hostage && Math.hypot(window.hostage.x - x, window.hostage.y - y) < radius * 0.8) {
    window.hostage = null; gameOver(false, 'Заложник погиб'); return;
  }
  if (window.bomb && Math.hypot(window.bomb.x - x, window.bomb.y - y) < radius * 0.9) {
    const bx = window.bomb.x, by = window.bomb.y;
    window.bomb = null;
    setTimeout(() => explode(bx, by, 320), 100);
    setTimeout(() => gameOver(false, 'Бомба взорвана'), 400);
    return;
  }
  damageDestructibles(x, y, radius);
  effects.push({ type:'explosion', x, y, life:400, maxLife:400, maxR:radius });
}

// ============================================================
//  MISSIONS
// ============================================================
const MISSIONS = [
  { id:'clear_1',   type:'eliminate', name:'ЗАЧИСТКА',  level:1, theme:'industrial', desc:'Разминочный уровень — 4 противника',   enemies:4 },
  { id:'clear_2',   type:'eliminate', name:'ЗАЧИСТКА',  level:2, theme:'industrial', desc:'Кольцевое здание с внутренним блоком',  enemies:14 },
  { id:'clear_3',   type:'eliminate', name:'ЗАЧИСТКА',  level:3, theme:'industrial', desc:'Крестообразный бункер с 4 крыльями',    enemies:17 },
  { id:'clear_4',   type:'eliminate', name:'ЗАЧИСТКА',  level:4, theme:'industrial', desc:'Лабиринт из коридоров и комнат',        enemies:20 },
  { id:'clear_5',   type:'eliminate', name:'ЗАЧИСТКА',  level:5, theme:'industrial', desc:'Многоуровневый укрепрайон',             enemies:24 },
  { id:'hostage_1', type:'rescue',    name:'ЗАЛОЖНИК',  level:1, theme:'office',     desc:'Открытый офис — лёгкая операция',       enemies:7 },
  { id:'hostage_2', type:'rescue',    name:'ЗАЛОЖНИК',  level:2, theme:'office',     desc:'Здание с множеством комнат',            enemies:12 },
  { id:'hostage_3', type:'rescue',    name:'ЗАЛОЖНИК',  level:3, theme:'office',     desc:'Офисный комплекс с переговорными',      enemies:15 },
  { id:'hostage_4', type:'rescue',    name:'ЗАЛОЖНИК',  level:4, theme:'hotel',      desc:'Отель с длинными коридорами',           enemies:18 },
  { id:'hostage_5', type:'rescue',    name:'ЗАЛОЖНИК',  level:5, theme:'hotel',      desc:'Подземный бункер с камерами',           enemies:22 },
  { id:'bomb_1',    type:'defuse',    name:'БОМБА',     level:1, theme:'concrete',   desc:'Промзона — первая серьёзная операция',  enemies:8 },
  { id:'bomb_2',    type:'defuse',    name:'БОМБА',     level:2, theme:'concrete',   desc:'Склад с колоннами',                     enemies:14 },
  { id:'bomb_3',    type:'defuse',    name:'БОМБА',     level:3, theme:'concrete',   desc:'Завод с конвейерами',                   enemies:17 },
  { id:'bomb_4',    type:'defuse',    name:'БОМБА',     level:4, theme:'concrete',   desc:'Химический комбинат',                   enemies:20 },
  { id:'bomb_5',    type:'defuse',    name:'БОМБА',     level:5, theme:'concrete',   desc:'Ядерный объект — реакторный зал',       enemies:24 },
  { id:'assault_1', type:'assault',   name:'ШТУРМ',     level:1, theme:'dirt',       desc:'Крепость — разминка перед битвой',      enemies:9 },
  { id:'assault_2', type:'assault',   name:'ШТУРМ',     level:2, theme:'dirt',       desc:'Двухъярусная оборона',                  enemies:16 },
  { id:'assault_3', type:'assault',   name:'ШТУРМ',     level:3, theme:'dirt',       desc:'Окопы и доты',                          enemies:19 },
  { id:'assault_4', type:'assault',   name:'ШТУРМ',     level:4, theme:'dirt',       desc:'Городской квартал',                     enemies:22 },
  { id:'assault_5', type:'assault',   name:'ШТУРМ',     level:5, theme:'dirt',       desc:'Цитадель — последний рубеж',            enemies:26 },
];

let currentMission = null;
let gameTime = 0;
let timeScale = 1;
let gameOverFlag = false;
let commandMenuOpen = false;
let paused = false;
let currentTheme = 'industrial';

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI*2;
  while (d < -Math.PI) d += Math.PI*2;
  return d;
}
function circleRect(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx, dy = cy - ny;
  return dx*dx + dy*dy < r*r;
}
function collides(x, y, r) {
  for (const w of WORLD.walls) if (circleRect(x, y, r, w)) return true;
  for (const o of WORLD.obstacles) if (circleRect(x, y, r, o)) return true;
  for (const d of WORLD.destructibles) if (d.state < 2 && circleRect(x, y, r, d)) return true;
  for (const f of WORLD.furniture) if (!f.destroyed && circleRect(x, y, r, f)) return true;
  return false;
}
function pointInWalls(x, y) {
  for (const w of WORLD.walls) if (x >= w.x && x <= w.x+w.w && y >= w.y && y <= w.y+w.h) return true;
  for (const o of WORLD.obstacles) if (x >= o.x && x <= o.x+o.w && y >= o.y && y <= o.y+o.h) return true;
  for (const d of WORLD.destructibles) if (d.state < 2 && x >= d.x && x <= d.x+d.w && y >= d.y && y <= d.y+d.h) return true;
  for (const f of WORLD.furniture) if (!f.destroyed && x >= f.x && x <= f.x+f.w && y >= f.y && y <= f.y+f.h) return true;
  return false;
}
function lineOfSight(x1, y1, x2, y2) {
  const dist = Math.hypot(x2-x1, y2-y1);
  const steps = Math.max(2, Math.ceil(dist / 26));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointInWalls(x1 + (x2-x1)*t, y1 + (y2-y1)*t)) return false;
  }
  return true;
}
function findFreeSpotNear(cx, cy, minR, maxR) {
  const c = clampToBounds(cx, cy, 30);
  if (!collides(c.x, c.y, 18)) return c;
  for (let i = 0; i < 60; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = minR + Math.random() * (maxR - minR);
    const p = clampToBounds(c.x + Math.cos(ang) * r, c.y + Math.sin(ang) * r, 30);
    if (!collides(p.x, p.y, 18)) return p;
  }
  return c;
}

function addWallRect(uMinX, uMinY, uMaxX, uMaxY) {
  WORLD.walls.push({ x: uMinX*UNIT, y: uMinY*UNIT, w: (uMaxX-uMinX)*UNIT, h: (uMaxY-uMinY)*UNIT });
}
function addObstacleRect(uCx, uCy, uW, uH) {
  WORLD.obstacles.push({ x:(uCx-uW/2)*UNIT, y:(uCy-uH/2)*UNIT, w:uW*UNIT, h:uH*UNIT });
}
function addDestructible(uminX, uminY, umaxX, umaxY) {
  WORLD.destructibles.push({ x: uminX*UNIT, y: uminY*UNIT, w: (umaxX-uminX)*UNIT, h: (umaxY-uminY)*UNIT, state: 0 });
}
function addFurniture(ux, uy, type, rot = 0) {
  const defs = {
    bed:    { w: 1.2, h: 2.0, hp: 40,  color: '#5a4a4a', accent: '#7a6a6a' },
    desk:   { w: 1.6, h: 0.8, hp: 30,  color: '#5a4a3a', accent: '#7a6a5a' },
    chair:  { w: 0.6, h: 0.6, hp: 15,  color: '#3a3028', accent: '#5a4a3a' },
    locker: { w: 1.0, h: 0.6, hp: 55,  color: '#4a4a52', accent: '#6a6a72' },
    shelf:  { w: 1.2, h: 0.5, hp: 45,  color: '#5a4030', accent: '#7a6040' },
    sofa:   { w: 2.0, h: 1.0, hp: 35,  color: '#5a4a5a', accent: '#8a7a8a' },
    tv:     { w: 1.0, h: 0.3, hp: 20,  color: '#1a1a1e', accent: '#4a4a5a' },
    table:  { w: 1.4, h: 0.9, hp: 35,  color: '#5a4030', accent: '#7a6040' },
    crate:  { w: 1.0, h: 1.0, hp: 50,  color: '#5a4a2a', accent: '#7a6a3a' },
    barrel: { w: 0.9, h: 0.9, hp: 60,  color: '#5a3a2a', accent: '#8a5030' },
  };
  const d = defs[type] || defs.crate;
  const w = d.w * UNIT, h = d.h * UNIT;
  WORLD.furniture.push({
    x: ux*UNIT - w/2, y: uy*UNIT - h/2,
    w, h, type, hp: d.hp, maxHp: d.hp,
    color: d.color, accent: d.accent,
    destroyed: false, rot, seed: Math.random(),
  });
}
function damageFurnitureArea(x, y, radius) {
  for (const f of WORLD.furniture) {
    if (f.destroyed) continue;
    const cx = f.x + f.w/2, cy = f.y + f.h/2;
    const d = Math.hypot(cx - x, cy - y);
    if (d < radius) {
      f.hp -= 100 * (1 - d/radius);
      if (f.hp <= 0) destroyFurniture(f);
    }
  }
}
function damageFurnitureAt(x, y, dmg) {
  for (const f of WORLD.furniture) {
    if (f.destroyed) continue;
    if (x >= f.x && x <= f.x+f.w && y >= f.y && y <= f.y+f.h) {
      f.hp -= dmg;
      if (f.hp <= 0) { destroyFurniture(f); return true; }
      return false;
    }
  }
  return false;
}
function destroyFurniture(f) {
  f.destroyed = true;
  playCrash();
  const n = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 150;
    effects.push({
      type: 'fragment',
      x: f.x + Math.random() * f.w, y: f.y + Math.random() * f.h,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 10,
      size: 3 + Math.random() * 5,
      life: 600 + Math.random() * 300, maxLife: 900,
      color: f.color,
    });
  }
}
function addWallIfFree(uminX, uminY, umaxX, umaxY) {
  const tx = uminX * UNIT, ty = uminY * UNIT;
  const tw = (umaxX - uminX) * UNIT, th = (umaxY - uminY) * UNIT;
  for (const w of WORLD.walls) if (w.x < tx + tw && w.x + w.w > tx && w.y < ty + th && w.y + w.h > ty) return;
  for (const o of WORLD.obstacles) if (o.x < tx + tw && o.x + o.w > tx && o.y < ty + th && o.y + o.h > ty) return;
  addWallRect(uminX, uminY, umaxX, umaxY);
}
function clearWorld() {
  WORLD.walls.length = 0;
  WORLD.obstacles.length = 0;
  WORLD.destructibles.length = 0;
  WORLD.furniture.length = 0;
  enemies.length = 0;
  squad.length = 0;
  bullets.length = 0;
  grenades.length = 0;
  molotovs.length = 0;
  fires.length = 0;
  effects.length = 0;
  bloodDecals.length = 0;
  medkits.length = 0;
  hazards.length = 0;
  pendingEnemySpawns = [];
  pendingAirstrike = null;
  window.bomb = null;
  window.hostage = null;
  window.bombDefused = false;
  window.hostageRescued = false;
  gameOverFlag = false;
  paused = false;
  timeScale = 1;
  commandMenuOpen = false;
  activeEventId = null;
  activeEventTimer = 0;
  eventCooldown = 15;
  eventBannerTimer = 0;
  airMode = false;
  airBombs = [];
  document.getElementById('air-hud').classList.remove('active');
  document.getElementById('want-plane-btn').classList.remove('active');
  document.getElementById('command-menu').classList.remove('active');
  document.getElementById('pause-menu').classList.remove('active');
  document.getElementById('event-banner').classList.remove('active');
}
function computeWorldBounds() {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const consider = (x, y) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; };
  for (const w of WORLD.walls) { consider(w.x, w.y); consider(w.x + w.w, w.y + w.h); }
  for (const o of WORLD.obstacles) { consider(o.x, o.y); consider(o.x + o.w, o.y + o.h); }
  if (minX === Infinity) { worldBounds = { minX: -1500, maxX: 1500, minY: -1500, maxY: 1500 }; return; }
  const padX = Math.max(60, (maxX - minX) * 0.03);
  const padY = Math.max(60, (maxY - minY) * 0.03);
  worldBounds = { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
}
function addSpawnRoom() {
  const ux = player.x / UNIT;
  const uy = player.y / UNIT;
  const halfW = 3; const depth = 4;
  addWallIfFree(ux - halfW, uy - 0.5, ux - halfW + 0.5, uy + depth);
  addWallIfFree(ux + halfW - 0.5, uy - 0.5, ux + halfW, uy + depth);
  addWallIfFree(ux - halfW, uy + depth - 0.5, ux + halfW, uy + depth);
  addWallIfFree(ux - halfW, uy - 0.5, ux - halfW + 1.5, uy);
  addWallIfFree(ux + halfW - 1.5, uy - 0.5, ux + halfW, uy);
}

function createEnemy(x, y, type) {
  const t = ENEMY_TYPES[type] || ENEMY_TYPES.grunt;
  return {
    x, y, type,
    angle: Math.random() * Math.PI * 2,
    hp: t.hp, maxHp: t.hp, radius: t.size, alive: true,
    patrolCenter: { x, y }, patrolAngle: Math.random() * Math.PI * 2,
    patrolRadius: 80 + Math.random() * 100, patrolTimer: 0, alertLevel: 0,
    lastSeen: null, lastSeenTime: 0, lastShot: 0,
    fireRate: t.fireRate[0] + Math.random() * (t.fireRate[1] - t.fireRate[0]),
    speed: t.speed, viewRange: t.viewRange, fov: t.fov, shootRange: t.shootRange,
    idealRange: t.idealRange, retrRange: t.retrRange, advRange: t.advRange,
    strafeDir: Math.random() < 0.5 ? 1 : -1, strafeTimer: 0,
    reactionDelay: 140 + Math.random() * 220, firstSeenAt: 0,
    flankDir: Math.random() < 0.5 ? 1 : -1, burstLeft: 0, burstTimer: 0,
    burning: 0, coverTarget: null, losCache: false,
  };
}
function spawnEnemies(list) {
  if (tutorialMode) return;
  for (const e of list) pendingEnemySpawns.push(e);
}
function flushEnemySpawns() {
  for (const e of pendingEnemySpawns) {
    let x = e.x * UNIT, y = e.y * UNIT;
    const c = clampToBounds(x, y, 40);
    x = c.x; y = c.y;
    if (collides(x, y, 20)) {
      const s = findFreeSpotNear(x, y, 60, 200);
      x = s.x; y = s.y;
    }
    enemies.push(createEnemy(x, y, e.type || 'grunt'));
  }
  pendingEnemySpawns = [];
}
function createSquadMember(idx, x, y) {
  return {
    x, y, angle: -Math.PI/2,
    hp: 100, maxHp: 100, radius: 15, alive: true,
    name: SQUAD_NAMES[idx], state: 'follow',
    holdPos: { x, y }, targetEnemy: null,
    lastShot: 0, fireRate: 500, speed: 220, idx, burning: 0,
  };
}
function spawnSquadSafely() {
  for (let i = 0; i < 3; i++) {
    const baseAngle = player.angle + Math.PI + (i - 1) * 0.7;
    const x = player.x + Math.cos(baseAngle) * 70;
    const y = player.y + Math.sin(baseAngle) * 70;
    const s = findFreeSpotNear(x, y, 60, 180);
    squad.push(createSquadMember(i, s.x, s.y));
  }
}
function fillRoomWithFurniture(minX, minY, maxX, maxY, density = 0.3, types = ['desk','chair','shelf']) {
  const areaW = maxX - minX, areaH = maxY - minY;
  const cellSize = 3.5;
  const cols = Math.floor(areaW / cellSize);
  const rows = Math.floor(areaH / cellSize);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (Math.random() > density) continue;
      const ux = minX + cellSize * (c + 0.5);
      const uy = minY + cellSize * (r + 0.5);
      if (ux < minX + 1 || ux > maxX - 1 || uy < minY + 1 || uy > maxY - 1) continue;
      const t = types[Math.floor(Math.random() * types.length)];
      addFurniture(ux, uy, t);
    }
  }
}

// ============================================================
//  LEVELS
// ============================================================
function buildClear1() {
  currentTheme = 'industrial';
  player.x = -10 * UNIT; player.y = -10 * UNIT;
  addWallRect(-15,-15,15,-14.5); addWallRect(-15,14.5,15,15);
  addWallRect(-15,-15,-14.5,15); addWallRect(14.5,-15,15,15);
  addWallRect(-0.5,-14,0.5,-5); addWallRect(-0.5,5,0.5,14);
  addWallRect(-14,-0.5,-9,0.5); addDestructible(-9,-0.5,-5,0.5); addWallRect(-5,-0.5,-2,0.5);
  addWallRect(2,-0.5,5,0.5); addDestructible(5,-0.5,9,0.5); addWallRect(9,-0.5,14,0.5);
  fillRoomWithFurniture(-13, -13, -2, -3, 0.35, ['crate','barrel','shelf']);
  fillRoomWithFurniture(2, -13, 13, -3, 0.3, ['crate','shelf']);
  fillRoomWithFurniture(-13, 3, -2, 13, 0.3, ['crate','barrel']);
  fillRoomWithFurniture(2, 3, 13, 13, 0.35, ['crate','shelf','barrel']);
  spawnEnemies([
    {x:-8,y:8,type:'grunt'},{x:8,y:-8,type:'grunt'},
    {x:8,y:8,type:'grunt'},{x:-3,y:-8,type:'grunt'}
  ]);
}
function buildClear2() {
  currentTheme = 'industrial';
  player.x = -8 * UNIT; player.y = -13 * UNIT;
  addWallRect(-15,-15,15,-14.5); addWallRect(-15,14.5,15,15);
  addWallRect(-15,-15,-14.5,15); addWallRect(14.5,-15,15,15);
  addWallRect(-9,-9,-5,-8.5); addDestructible(-5,-9,0,-8.5); addWallRect(0,-9,9,-8.5);
  addWallRect(-9,8.5,-2,9); addWallRect(2,8.5,9,9);
  addWallRect(-9,-8.5,-8.5,-2); addWallRect(-9,2,-8.5,8.5);
  addWallRect(8.5,-8.5,9,-2); addWallRect(8.5,2,9,8.5);
  addWallRect(-3,-3,3,-2.5); addWallRect(-3,2.5,3,3);
  addWallRect(-3,-2.5,-2.5,2.5); addWallRect(2.5,-2.5,3,2.5);
  fillRoomWithFurniture(-14, -14, -10, 14, 0.35, ['crate','barrel']);
  fillRoomWithFurniture(10, -14, 14, 14, 0.35, ['crate','shelf']);
  spawnEnemies([
    {x:-12,y:-12,type:'grunt'},{x:12,y:-12,type:'rusher'},{x:-12,y:12,type:'heavy'},
    {x:12,y:12,type:'rusher'},{x:2,y:-12,type:'grunt'},{x:-2,y:12,type:'grunt'},
    {x:-12,y:-5,type:'grunt'},{x:12,y:5,type:'molotov'},
    {x:-5,y:-5,type:'rusher'},{x:5,y:5,type:'grunt'},
    {x:-5,y:5,type:'grunt'},{x:5,y:-5,type:'grunt'},
    {x:-8,y:2,type:'tank'},{x:2,y:6,type:'grunt'}
  ]);
}
function buildClear3() {
  currentTheme = 'industrial';
  player.x = 0; player.y = -16 * UNIT;
  addWallRect(-18,-18,18,-17.5); addWallRect(-18,18,18,18.5);
  addWallRect(-18,-18,-17.5,18.5); addWallRect(17.5,-18,18,18.5);
  addWallRect(-6,-12,-5.5,-3); addWallRect(5.5,-12,6,-3);
  addWallRect(-6,3,-5.5,12); addWallRect(5.5,3,6,12);
  addWallRect(-12,-6,-3,-5.5); addWallRect(3,-6,12,-5.5);
  addWallRect(-12,5.5,-3,6); addWallRect(3,5.5,12,6);
  addDestructible(-6,-9,-5.5,-7); addDestructible(5.5,-9,6,-7);
  addDestructible(-6,7,-5.5,9); addDestructible(5.5,7,6,9);
  addDestructible(-9,-6,-7,-5.5); addDestructible(7,-6,9,-5.5);
  addDestructible(-9,5.5,-7,6); addDestructible(7,5.5,9,6);
  addWallRect(-3,-3,3,-2.5); addWallRect(-3,2.5,3,3);
  addWallRect(-3,-2.5,-2.5,2.5); addWallRect(2.5,-2.5,3,2.5);
  addDestructible(-1.5,-2.5,-1,2.5);
  fillRoomWithFurniture(-17, -17, -7, -7, 0.3, ['crate','barrel']);
  fillRoomWithFurniture(7, -17, 17, -7, 0.3, ['crate','shelf']);
  fillRoomWithFurniture(-17, 7, -7, 17, 0.3, ['crate','barrel']);
  fillRoomWithFurniture(7, 7, 17, 17, 0.3, ['crate','shelf']);
  spawnEnemies([
    {x:-14,y:-14,type:'grunt'},{x:14,y:-14,type:'rusher'},{x:-14,y:14,type:'heavy'},
    {x:14,y:14,type:'rusher'},{x:2,y:-14,type:'sniper'},{x:-2,y:14,type:'sniper'},
    {x:-14,y:0,type:'molotov'},{x:14,y:0,type:'tank'},
    {x:-8,y:-8,type:'grunt'},{x:8,y:8,type:'grunt'},
    {x:-8,y:8,type:'rusher'},{x:8,y:-8,type:'rusher'},
    {x:-2,y:-6,type:'grunt'},{x:2,y:6,type:'grunt'},
    {x:-6,y:0,type:'grunt'},{x:6,y:0,type:'grunt'},
    {x:2,y:2,type:'tank'}
  ]);
}
function buildClear4() {
  currentTheme = 'industrial';
  player.x = -20 * UNIT; player.y = -20 * UNIT;
  addWallRect(-22,-22,22,-21.5); addWallRect(-22,22,22,22.5);
  addWallRect(-22,-22,-21.5,22.5); addWallRect(21.5,-22,22,22.5);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const x0 = -18 + c * 10, y0 = -18 + r * 10;
      const x1 = x0 + 8, y1 = y0 + 8;
      if (r === 0) addWallRect(x0, y0, x1, y0 + 0.5);
      else { addWallRect(x0, y0, x0 + 3, y0 + 0.5); addWallRect(x0 + 5, y0, x1, y0 + 0.5); }
      if (c === 0) addWallRect(x0, y0, x0 + 0.5, y1);
      else { addWallRect(x0, y0, x0 + 0.5, y0 + 3); addWallRect(x0, y0 + 5, x0 + 0.5, y1); }
      if (c === 3) addWallRect(x1 - 0.5, y0, x1, y1);
      if (r === 3) addWallRect(x0, y1 - 0.5, x1, y1);
      if (Math.random() < 0.25) addDestructible(x0 + 5, y0 + 0.5, x0 + 7, y0 + 1);
      fillRoomWithFurniture(x0 + 1, y0 + 1, x1 - 1, y1 - 1, 0.22, ['crate','barrel','shelf']);
    }
  }
  spawnEnemies([
    {x:-15,y:-15,type:'grunt'},{x:15,y:-15,type:'rusher'},{x:-15,y:15,type:'heavy'},
    {x:15,y:15,type:'rusher'},{x:0,y:-15,type:'grunt'},{x:0,y:15,type:'grunt'},
    {x:-15,y:0,type:'grunt'},{x:15,y:0,type:'molotov'},
    {x:-5,y:-5,type:'rusher'},{x:5,y:5,type:'grunt'},
    {x:-5,y:5,type:'grunt'},{x:5,y:-5,type:'grunt'},
    {x:-15,y:-5,type:'sniper'},{x:15,y:5,type:'sniper'},
    {x:-5,y:-15,type:'tank'},{x:5,y:15,type:'tank'},
    {x:0,y:0,type:'heavy'},{x:-10,y:0,type:'grunt'},
    {x:10,y:0,type:'grunt'},{x:0,y:-10,type:'rusher'}
  ]);
}
function buildClear5() {
  currentTheme = 'industrial';
  player.x = 0; player.y = -22 * UNIT;
  addWallRect(-24,-24,24,-23.5); addWallRect(-24,24,24,24.5);
  addWallRect(-24,-24,-23.5,24.5); addWallRect(23.5,-24,24,24.5);
  addWallRect(-15,-10,15,-9.5); addWallRect(-15,10,15,10.5);
  addWallRect(-15,-10,-14.5,10); addWallRect(14.5,-10,15,10);
  addDestructible(-4,-10,4,-9.5); addDestructible(-4,10,4,10.5);
  addDestructible(-15,-3,-14.5,3); addDestructible(14.5,-3,15,3);
  addWallRect(-8,-5,-7.5,5); addWallRect(7.5,-5,8,5);
  addWallRect(-7.5,-2,7.5,-1.5); addWallRect(-7.5,1.5,7.5,2);
  addDestructible(-3,-2,3,-1.5); addDestructible(-3,1.5,3,2);
  fillRoomWithFurniture(-23, -23, -16, -11, 0.3, ['crate','barrel']);
  fillRoomWithFurniture(16, -23, 23, -11, 0.3, ['crate','shelf']);
  fillRoomWithFurniture(-23, 11, -16, 23, 0.3, ['crate','barrel']);
  fillRoomWithFurniture(16, 11, 23, 23, 0.3, ['crate','shelf']);
  spawnEnemies([
    {x:-20,y:-20,type:'sniper'},{x:20,y:-20,type:'sniper'},{x:-20,y:20,type:'sniper'},
    {x:20,y:20,type:'sniper'},{x:0,y:-20,type:'tank'},{x:0,y:20,type:'tank'},
    {x:-20,y:0,type:'heavy'},{x:20,y:0,type:'heavy'},
    {x:-10,y:-15,type:'rusher'},{x:10,y:-15,type:'rusher'},
    {x:-10,y:15,type:'rusher'},{x:10,y:15,type:'rusher'},
    {x:-15,y:-15,type:'molotov'},{x:15,y:-15,type:'molotov'},
    {x:-15,y:15,type:'molotov'},{x:15,y:15,type:'molotov'},
    {x:-5,y:-7,type:'grunt'},{x:5,y:-7,type:'grunt'},
    {x:-5,y:7,type:'grunt'},{x:5,y:7,type:'grunt'},
    {x:0,y:-5,type:'tank'},{x:0,y:5,type:'tank'},
    {x:-12,y:0,type:'grunt'},{x:12,y:0,type:'grunt'}
  ]);
}
function buildHostage1() {
  currentTheme = 'office';
  player.x = -12 * UNIT; player.y = -12 * UNIT;
  addWallRect(-15,-15,15,-14.5); addWallRect(-15,14.5,15,15);
  addWallRect(-15,-15,-14.5,15); addWallRect(14.5,-15,15,15);
  addWallRect(-8,-8,-7.5,-2); addWallRect(-8,-2,-4,-1.5);
  addWallRect(2,3,2.5,10); addWallRect(3,8,10,8.5);
  addWallRect(-10,5,-3,5.5);
  fillRoomWithFurniture(-13, -13, -9, -3, 0.4, ['desk','chair','shelf']);
  fillRoomWithFurniture(-6, -13, 13, -3, 0.3, ['desk','chair','shelf']);
  fillRoomWithFurniture(-13, 3, 0, 13, 0.3, ['desk','chair','sofa']);
  fillRoomWithFurniture(4, 3, 13, 13, 0.3, ['desk','chair','shelf']);
  window.hostage = { x: 11 * UNIT, y: 11 * UNIT, radius: 14 };
  spawnEnemies([
    {x:-8,y:8,type:'grunt'},{x:5,y:-8,type:'rusher'},{x:10,y:-10,type:'grunt'},
    {x:-3,y:-3,type:'grunt'},{x:8,y:3,type:'grunt'},{x:-10,y:10,type:'rusher'},
    {x:2,y:-12,type:'grunt'}
  ]);
}
function buildHostage2() {
  currentTheme = 'office';
  player.x = -13 * UNIT; player.y = 0;
  addWallRect(-15,-15,15,-14.5); addWallRect(-15,14.5,15,15);
  addWallRect(-15,-15,-14.5,15); addWallRect(14.5,-15,15,15);
  addWallRect(-10,-10,10,-9.5); addWallRect(-10,9.5,10,10);
  addWallRect(-10,-10,-9.5,-3); addDestructible(-10,-3,-9.5,3); addWallRect(-10,3,-9.5,10);
  addWallRect(9.5,-10,10,10);
  addWallRect(-10,-0.5,-2,0.5); addWallRect(2,-0.5,10,0.5);
  addWallRect(2.5,-9.5,3,-5); addWallRect(2.5,5,3,9.5);
  addWallRect(-3,2.5,-2.5,9.5);
  fillRoomWithFurniture(-8, -9, -3, -1, 0.4, ['desk','chair']);
  fillRoomWithFurniture(1, -9, 8, -1, 0.4, ['desk','chair','tv']);
  fillRoomWithFurniture(-8, 1, -4, 8, 0.4, ['shelf','chair']);
  fillRoomWithFurniture(1, 5, 8, 9, 0.4, ['sofa','tv']);
  window.hostage = { x: 6 * UNIT, y: 6 * UNIT, radius: 14 };
  spawnEnemies([
    {x:-12,y:-12,type:'heavy'},{x:12,y:-12,type:'grunt'},{x:-12,y:12,type:'rusher'},
    {x:12,y:12,type:'grunt'},{x:-5,y:-5,type:'grunt'},{x:6,y:-6,type:'molotov'},
    {x:-5,y:5,type:'rusher'},{x:-6,y:-8,type:'grunt'},
    {x:-13,y:0,type:'tank'},{x:13,y:0,type:'sniper'},
    {x:0,y:-13,type:'grunt'},{x:0,y:13,type:'grunt'}
  ]);
}
function buildHostage3() {
  currentTheme = 'office';
  player.x = -16 * UNIT; player.y = -16 * UNIT;
  addWallRect(-18,-18,18,-17.5); addWallRect(-18,18,18,18.5);
  addWallRect(-18,-18,-17.5,18.5); addWallRect(17.5,-18,18,18.5);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const x0 = -13 + c * 9, y0 = -13 + r * 9;
      const x1 = x0 + 7, y1 = y0 + 7;
      if (r === 0) addWallRect(x0, y0, x1, y0 + 0.5);
      else { addWallRect(x0, y0, x0 + 2.5, y0 + 0.5); addWallRect(x0 + 4.5, y0, x1, y0 + 0.5); }
      if (c === 0) addWallRect(x0, y0, x0 + 0.5, y1);
      else { addWallRect(x0, y0, x0 + 0.5, y0 + 2.5); addWallRect(x0, y0 + 4.5, x0 + 0.5, y1); }
      if (c === 2) addWallRect(x1 - 0.5, y0, x1, y1);
      if (r === 2) addWallRect(x0, y1 - 0.5, x1, y1);
      fillRoomWithFurniture(x0 + 1, y0 + 1, x1 - 1, y1 - 1, 0.3, ['desk','chair','shelf']);
    }
  }
  window.hostage = { x: 12 * UNIT, y: 12 * UNIT, radius: 14 };
  spawnEnemies([
    {x:-15,y:-15,type:'grunt'},{x:15,y:-15,type:'rusher'},{x:-15,y:15,type:'heavy'},
    {x:15,y:15,type:'rusher'},{x:0,y:-15,type:'grunt'},{x:0,y:15,type:'grunt'},
    {x:-15,y:0,type:'grunt'},{x:15,y:0,type:'molotov'},
    {x:-5,y:-5,type:'rusher'},{x:5,y:5,type:'grunt'},
    {x:-5,y:5,type:'grunt'},{x:5,y:-5,type:'grunt'},
    {x:-10,y:10,type:'sniper'},{x:10,y:-10,type:'tank'},
    {x:0,y:0,type:'heavy'}
  ]);
}
function buildHostage4() {
  currentTheme = 'hotel';
  player.x = -20 * UNIT; player.y = 0;
  addWallRect(-22,-16,22,-15.5); addWallRect(-22,16,22,16.5);
  addWallRect(-22,-16,-21.5,16.5); addWallRect(21.5,-16,22,16.5);
  addWallRect(-21.5,-5,-10,-4.5); addWallRect(-8,-5,8,-4.5); addWallRect(10,-5,21.5,-4.5);
  addWallRect(-21.5,4.5,-10,5); addWallRect(-8,4.5,8,5); addWallRect(10,4.5,21.5,5);
  for (let x = -20; x < 20; x += 8) {
    if (Math.random() < 0.7) { addWallRect(x, -14, x + 0.5, -10); addWallRect(x, -8, x + 0.5, -5); }
    if (Math.random() < 0.7) { addWallRect(x, 5, x + 0.5, 9); addWallRect(x, 11, x + 0.5, 14); }
    addFurniture(x + 2.5, -12, 'bed'); addFurniture(x + 5.5, -12, 'bed');
    addFurniture(x + 2.5, -8.5, 'table');
    addFurniture(x + 2.5, 7.5, 'bed'); addFurniture(x + 5.5, 7.5, 'bed');
    addFurniture(x + 2.5, 11.5, 'table');
  }
  addDestructible(-2,-14,2,-13.5); addDestructible(-2,13.5,2,14);
  window.hostage = { x: 18 * UNIT, y: 12 * UNIT, radius: 14 };
  spawnEnemies([
    {x:-18,y:-12,type:'grunt'},{x:-10,y:-12,type:'rusher'},{x:-2,y:-12,type:'heavy'},
    {x:6,y:-12,type:'grunt'},{x:14,y:-12,type:'rusher'},
    {x:-18,y:0,type:'grunt'},{x:18,y:0,type:'sniper'},
    {x:-18,y:12,type:'rusher'},{x:-10,y:12,type:'grunt'},{x:0,y:12,type:'heavy'},
    {x:8,y:12,type:'rusher'},{x:14,y:12,type:'grunt'},
    {x:-5,y:-3,type:'molotov'},{x:5,y:3,type:'molotov'},
    {x:0,y:-3,type:'tank'},{x:0,y:3,type:'tank'},
    {x:-15,y:3,type:'grunt'},{x:15,y:-3,type:'grunt'}
  ]);
}
function buildHostage5() {
  currentTheme = 'hotel';
  player.x = 0; player.y = -20 * UNIT;
  addWallRect(-22,-22,22,-21.5); addWallRect(-22,22,22,22.5);
  addWallRect(-22,-22,-21.5,22.5); addWallRect(21.5,-22,22,22.5);
  for (let x = -20; x <= 16; x += 8) {
    addWallRect(x, -18, x + 0.5, -14); addWallRect(x, -12, x + 0.5, -8);
    addWallRect(x, 8, x + 0.5, 12); addWallRect(x, 14, x + 0.5, 18);
    addFurniture(x + 2.5, -16, 'bed'); addFurniture(x + 5.5, -16, 'bed');
    addFurniture(x + 2.5, -10, 'bed');
    addFurniture(x + 2.5, 10, 'bed'); addFurniture(x + 5.5, 10, 'bed');
    addFurniture(x + 2.5, 16, 'bed');
  }
  addWallRect(-18,-8,18,-7.5); addWallRect(-18,7.5,18,8);
  addDestructible(-4,-8,4,-7.5); addDestructible(-4,7.5,4,8);
  addWallRect(-6,-3,-5.5,3); addWallRect(5.5,-3,6,3);
  addWallRect(-5.5,-0.5,5.5,0); addDestructible(-5.5,0,5.5,0.5);
  window.hostage = { x: 15 * UNIT, y: 15 * UNIT, radius: 14 };
  spawnEnemies([
    {x:-19,y:-15,type:'grunt'},{x:-11,y:-15,type:'rusher'},{x:-3,y:-15,type:'heavy'},
    {x:5,y:-15,type:'grunt'},{x:13,y:-15,type:'rusher'},
    {x:-19,y:-3,type:'grunt'},{x:19,y:-3,type:'sniper'},
    {x:-19,y:5,type:'rusher'},{x:19,y:5,type:'sniper'},
    {x:-19,y:15,type:'grunt'},{x:-11,y:15,type:'heavy'},{x:-3,y:15,type:'rusher'},
    {x:5,y:15,type:'grunt'},{x:13,y:15,type:'rusher'},
    {x:0,y:-12,type:'tank'},{x:0,y:12,type:'tank'},
    {x:-8,y:0,type:'grunt'},{x:8,y:0,type:'grunt'},
    {x:0,y:-5,type:'molotov'},{x:0,y:5,type:'molotov'},
    {x:-15,y:0,type:'rusher'},{x:15,y:-8,type:'heavy'}
  ]);
}
function buildBomb1() {
  currentTheme = 'concrete';
  player.x = -15 * UNIT; player.y = -15 * UNIT;
  addWallRect(-20,-20,20,-19.5); addWallRect(-20,19.5,20,20);
  addWallRect(-20,-20,-19.5,20); addWallRect(19.5,-20,20,20);
  addWallRect(-10,-15,-9.5,0); addWallRect(10,-15,10.5,0);
  addWallRect(-9.5,-5,-3,-4.5); addDestructible(-3,-5,3,-4.5); addWallRect(3,-5,10,-4.5);
  addWallRect(-15,5,-5,5.5); addWallRect(5,5,15,5.5);
  addWallRect(-0.5,10,0.5,18);
  addWallRect(-15,10,-10,10.5); addWallRect(10,10,15,10.5);
  fillRoomWithFurniture(-19, -19, -11, -1, 0.35, ['crate','barrel']);
  fillRoomWithFurniture(11, -19, 19, -1, 0.35, ['crate','barrel']);
  fillRoomWithFurniture(-19, 1, -11, 19, 0.35, ['crate','barrel']);
  fillRoomWithFurniture(11, 6, 19, 19, 0.35, ['crate','barrel']);
  window.bomb = { x: 15 * UNIT, y: 15 * UNIT, radius: 15 };
  spawnEnemies([
    {x:-15,y:-5,type:'grunt'},{x:15,y:-5,type:'grunt'},{x:0,y:-10,type:'rusher'},
    {x:-15,y:15,type:'rusher'},{x:0,y:15,type:'grunt'},
    {x:-5,y:10,type:'grunt'},{x:5,y:-10,type:'grunt'},
    {x:-10,y:-8,type:'grunt'}
  ]);
}
function buildBomb2() {
  currentTheme = 'concrete';
  player.x = -17 * UNIT; player.y = -17 * UNIT;
  addWallRect(-20,-20,20,-19.5); addWallRect(-20,19.5,20,20);
  addWallRect(-20,-20,-19.5,20); addWallRect(19.5,-20,20,20);
  const pillars = [[-15,-15],[-5,-15],[5,-15],[15,-15],[-15,-5],[5,-5],[15,-5],[-15,5],[-5,5],[5,5],[15,5],[-15,15],[-5,15],[5,15]];
  for (const [px,py] of pillars) addObstacleRect(px,py,2,2);
  addWallRect(-15,-10,-5,-9.5); addWallRect(5,-10,15,-9.5);
  addWallRect(-15,10,-5,10.5); addWallRect(5,10,15,10.5);
  addWallRect(10,10,15,10.5); addDestructible(15,10,18,10.5);
  addWallRect(10,17.5,15,18);
  addWallRect(10,10,10.5,15); addDestructible(10,15,10.5,17.5); addWallRect(17.5,10,18,18);
  fillRoomWithFurniture(-19, -19, -16, 19, 0.3, ['crate','barrel']);
  fillRoomWithFurniture(16, -19, 19, 0, 0.3, ['crate','barrel']);
  window.bomb = { x: 14 * UNIT, y: 14 * UNIT, radius: 15 };
  spawnEnemies([
    {x:-17,y:-17,type:'grunt'},{x:17,y:-17,type:'sniper'},{x:-17,y:17,type:'rusher'},
    {x:-17,y:0,type:'heavy'},{x:0,y:-17,type:'grunt'},{x:0,y:0,type:'heavy'},
    {x:10,y:-15,type:'grunt'},{x:-10,y:-15,type:'molotov'},{x:15,y:0,type:'grunt'},
    {x:-8,y:8,type:'rusher'},{x:8,y:-8,type:'grunt'},{x:-15,y:15,type:'tank'},
    {x:0,y:15,type:'grunt'},{x:15,y:15,type:'rusher'}
  ]);
}
function buildBomb3() {
  currentTheme = 'concrete';
  player.x = -20 * UNIT; player.y = 0;
  addWallRect(-22,-18,22,-17.5); addWallRect(-22,18,22,18.5);
  addWallRect(-22,-18,-21.5,18.5); addWallRect(21.5,-18,22,18.5);
  for (let x = -20; x < 20; x += 6) { addObstacleRect(x, -10, 3, 1); addObstacleRect(x, 10, 3, 1); addObstacleRect(x, 0, 3, 1); }
  addWallRect(-19,-17,-10,-16.5); addWallRect(-10,-17,-9.5,-15); addWallRect(-10,-11,-9.5,-8);
  addWallRect(10,-17,19,-16.5); addWallRect(9.5,-17,10,-15); addWallRect(9.5,-11,10,-8);
  addWallRect(-19,16.5,-10,17); addWallRect(-10,8,-9.5,10); addWallRect(-10,14,-9.5,17);
  addWallRect(10,16.5,19,17); addWallRect(9.5,8,10,10); addWallRect(9.5,14,10,17);
  addDestructible(-1,-17,1,-16.5);
  fillRoomWithFurniture(-19, -14, -11, 14, 0.3, ['crate','barrel']);
  fillRoomWithFurniture(11, -14, 19, 14, 0.3, ['crate','barrel']);
  window.bomb = { x: 18 * UNIT, y: 14 * UNIT, radius: 15 };
  spawnEnemies([
    {x:-19,y:-15,type:'sniper'},{x:-19,y:0,type:'heavy'},{x:-19,y:15,type:'sniper'},
    {x:19,y:-15,type:'tank'},{x:19,y:0,type:'grunt'},{x:19,y:15,type:'tank'},
    {x:-14,y:-8,type:'grunt'},{x:14,y:-8,type:'rusher'},
    {x:-14,y:8,type:'rusher'},{x:14,y:8,type:'grunt'},
    {x:-8,y:0,type:'molotov'},{x:8,y:0,type:'molotov'},
    {x:-5,y:-14,type:'grunt'},{x:5,y:-14,type:'rusher'},
    {x:-5,y:14,type:'heavy'},{x:5,y:14,type:'grunt'},
    {x:0,y:0,type:'heavy'}
  ]);
}
function buildBomb4() {
  currentTheme = 'concrete';
  player.x = -20 * UNIT; player.y = -20 * UNIT;
  addWallRect(-24,-24,24,-23.5); addWallRect(-24,24,24,24.5);
  addWallRect(-24,-24,-23.5,24.5); addWallRect(23.5,-24,24,24.5);
  const tanks = [[-18,-18],[-18,0],[-18,18],[0,-18],[0,0],[0,18],[18,-18],[18,0],[18,18]];
  for (const [tx,ty] of tanks) addObstacleRect(tx,ty,4,4);
  addWallRect(-22,-22,-12,-21.5); addWallRect(-6,-22,6,-21.5); addWallRect(12,-22,22,-21.5);
  addWallRect(-22,21.5,-12,22); addWallRect(-6,21.5,6,22); addWallRect(12,21.5,22,22);
  addWallRect(-22,-22,-21.5,-12); addWallRect(-22,-6,-21.5,6); addWallRect(-22,12,-21.5,22);
  addWallRect(21.5,-22,22,-12); addWallRect(21.5,-6,22,6); addWallRect(21.5,12,22,22);
  addDestructible(-10,-10,-9.5,-6); addDestructible(9.5,-10,10,-6);
  addDestructible(-10,6,-9.5,10); addDestructible(9.5,6,10,10);
  fillRoomWithFurniture(-22, -22, -12, -6, 0.3, ['barrel','crate']);
  fillRoomWithFurniture(12, -22, 22, -6, 0.3, ['barrel','crate']);
  fillRoomWithFurniture(-22, 6, -12, 22, 0.3, ['barrel','crate']);
  fillRoomWithFurniture(12, 6, 22, 22, 0.3, ['barrel','crate']);
  window.bomb = { x: 0, y: 0, radius: 15 };
  spawnEnemies([
    {x:-22,y:-14,type:'grunt'},{x:-14,y:-22,type:'sniper'},{x:-22,y:14,type:'heavy'},
    {x:-14,y:22,type:'rusher'},{x:14,y:-22,type:'tank'},{x:22,y:-14,type:'grunt'},
    {x:14,y:22,type:'heavy'},{x:22,y:14,type:'sniper'},
    {x:-8,y:0,type:'molotov'},{x:8,y:0,type:'molotov'},
    {x:0,y:-8,type:'rusher'},{x:0,y:8,type:'rusher'},
    {x:-10,y:-10,type:'tank'},{x:10,y:10,type:'tank'},
    {x:-10,y:10,type:'grunt'},{x:10,y:-10,type:'grunt'},
    {x:-3,y:0,type:'heavy'},{x:3,y:0,type:'heavy'},
    {x:0,y:-3,type:'grunt'},{x:0,y:3,type:'grunt'}
  ]);
}
function buildBomb5() {
  currentTheme = 'concrete';
  player.x = 0; player.y = -24 * UNIT;
  addWallRect(-26,-26,26,-25.5); addWallRect(-26,26,26,26.5);
  addWallRect(-26,-26,-25.5,26.5); addWallRect(25.5,-26,26,26.5);
  addWallRect(-8,-8,8,-7.5); addWallRect(-8,7.5,8,8);
  addWallRect(-8,-7.5,-7.5,7.5); addWallRect(7.5,-7.5,8,7.5);
  addDestructible(-2,-8,2,-7.5); addDestructible(-2,7.5,2,8);
  addDestructible(-8,-2,-7.5,2); addDestructible(7.5,-2,8,2);
  addObstacleRect(0,0,4,4);
  addWallRect(-20,-20,-19.5,-10); addWallRect(-20,10,-19.5,20);
  addWallRect(19.5,-20,20,-10); addWallRect(19.5,10,20,20);
  addWallRect(-20,-20,-10,-19.5); addWallRect(10,-20,20,-19.5);
  addWallRect(-20,19.5,-10,20); addWallRect(10,19.5,20,20);
  addWallRect(-25,-10,-15,-9.5); addWallRect(15,-10,25,-9.5);
  addWallRect(-25,9.5,-15,10); addWallRect(15,9.5,25,10);
  addDestructible(-15,-10,-10,-9.5); addDestructible(10,-10,15,-9.5);
  addDestructible(-15,9.5,-10,10); addDestructible(10,9.5,15,10);
  fillRoomWithFurniture(-25, -25, -21, 25, 0.25, ['barrel','crate']);
  fillRoomWithFurniture(21, -25, 25, 25, 0.25, ['barrel','crate']);
  window.bomb = { x: 0, y: 0, radius: 15 };
  spawnEnemies([
    {x:-23,y:-23,type:'sniper'},{x:23,y:-23,type:'tank'},{x:-23,y:23,type:'tank'},
    {x:23,y:23,type:'sniper'},{x:0,y:-22,type:'heavy'},{x:0,y:22,type:'heavy'},
    {x:-22,y:0,type:'heavy'},{x:22,y:0,type:'heavy'},
    {x:-15,y:-15,type:'molotov'},{x:15,y:-15,type:'molotov'},
    {x:-15,y:15,type:'molotov'},{x:15,y:15,type:'molotov'},
    {x:-12,y:0,type:'rusher'},{x:12,y:0,type:'rusher'},
    {x:0,y:-12,type:'grunt'},{x:0,y:12,type:'grunt'},
    {x:-5,y:-5,type:'grunt'},{x:5,y:5,type:'grunt'},
    {x:-5,y:5,type:'rusher'},{x:5,y:-5,type:'rusher'},
    {x:-3,y:0,type:'tank'},{x:3,y:0,type:'tank'},
    {x:0,y:-5,type:'heavy'},{x:0,y:5,type:'heavy'}
  ]);
}
function buildAssault1() {
  currentTheme = 'dirt';
  player.x = 0; player.y = -18 * UNIT;
  addWallRect(-20,-18,20,-17.5); addWallRect(-20,16,20,16.5);
  addWallRect(-20,-18,-19.5,16); addWallRect(19.5,-18,20,16);
  addWallRect(-15,-5,-3,-4.5); addWallRect(3,-5,15,-4.5);
  addWallRect(-15,5,-10,5.5); addWallRect(10,5,15,5.5);
  addWallRect(-8,10,-5,10.5); addWallRect(5,10,8,10.5);
  addWallRect(-15,-12,-13,-3); addWallRect(13,-12,15,-3);
  fillRoomWithFurniture(-19, -17, -1, -1, 0.3, ['crate','barrel']);
  fillRoomWithFurniture(1, -17, 19, -1, 0.3, ['crate','barrel']);
  fillRoomWithFurniture(-19, 1, -1, 15, 0.3, ['crate','barrel']);
  fillRoomWithFurniture(1, 1, 19, 15, 0.3, ['crate','barrel']);
  spawnEnemies([
    {x:-12,y:-2,type:'grunt'},{x:12,y:2,type:'rusher'},{x:-8,y:2,type:'heavy'},
    {x:8,y:2,type:'grunt'},{x:2,y:2,type:'grunt'},{x:-12,y:8,type:'grunt'},
    {x:12,y:8,type:'rusher'},{x:-5,y:-8,type:'grunt'},{x:5,y:-8,type:'grunt'}
  ]);
}
function buildAssault2() {
  currentTheme = 'dirt';
  player.x = 0; player.y = -20 * UNIT;
  addWallRect(-22,-20,22,-19.5); addWallRect(-22,19.5,22,20);
  addWallRect(-22,-20,-21.5,20); addWallRect(21.5,-20,22,20);
  addWallRect(-14,-14,-10,-13.5); addDestructible(-10,-14,-4,-13.5); addWallRect(4,-14,10,-13.5);
  addDestructible(10,-14,14,-13.5);
  addWallRect(-12,-4,-2,-3.5); addWallRect(2,-4,12,-3.5);
  addObstacleRect(-17,-14,3,3); addObstacleRect(17,-14,3,3);
  addObstacleRect(-17,-4,3,3); addObstacleRect(17,-4,3,3);
  addWallRect(-8,6,-3,6.5); addWallRect(3,6,8,6.5);
  addWallRect(-8,6,-7.5,14); addWallRect(7.5,6,8,14);
  addWallRect(-8,14,-3,14.5); addWallRect(3,14,8,14.5);
  fillRoomWithFurniture(-20, -18, -8, -6, 0.3, ['crate','barrel']);
  fillRoomWithFurniture(8, -18, 20, -6, 0.3, ['crate','barrel']);
  fillRoomWithFurniture(-20, 6, -10, 18, 0.3, ['crate','barrel']);
  fillRoomWithFurniture(10, 6, 20, 18, 0.3, ['crate','barrel']);
  spawnEnemies([
    {x:-17,y:-10,type:'rusher'},{x:17,y:-10,type:'rusher'},{x:-10,y:-18,type:'grunt'},
    {x:10,y:-18,type:'grunt'},{x:-16,y:0,type:'sniper'},{x:16,y:0,type:'sniper'},
    {x:2,y:-10,type:'tank'},{x:2,y:2,type:'heavy'},{x:-12,y:3,type:'molotov'},
    {x:12,y:3,type:'grunt'},{x:0,y:10,type:'grunt'},{x:0,y:17,type:'rusher'},
    {x:-20,y:10,type:'grunt'},{x:20,y:10,type:'rusher'},
    {x:-5,y:-8,type:'tank'},{x:5,y:-8,type:'grunt'}
  ]);
}
function buildAssault3() {
  currentTheme = 'dirt';
  player.x = -20 * UNIT; player.y = 0;
  addWallRect(-24,-14,24,-13.5); addWallRect(-24,14,24,14.5);
  addWallRect(-24,-14,-23.5,14.5); addWallRect(23.5,-14,24,14.5);
  for (let x = -20; x < 20; x += 8) {
    addWallRect(x, -13.5, x+0.5, -6); addWallRect(x+4, 6, x+4.5, 13.5);
    addObstacleRect(x+2, -3, 3, 2); addObstacleRect(x+2, 3, 3, 2);
  }
  addObstacleRect(-19,-8,3,3); addObstacleRect(-19,8,3,3);
  addObstacleRect(19,-8,3,3); addObstacleRect(19,8,3,3);
  addDestructible(0,-13.5,0.5,-10); addDestructible(0,10,0.5,13.5);
  fillRoomWithFurniture(-22, -12, 22, -6, 0.25, ['crate','barrel']);
  fillRoomWithFurniture(-22, 6, 22, 12, 0.25, ['crate','barrel']);
  spawnEnemies([
    {x:-22,y:-10,type:'sniper'},{x:-22,y:10,type:'sniper'},
    {x:22,y:-10,type:'sniper'},{x:22,y:10,type:'sniper'},
    {x:-18,y:-4,type:'rusher'},{x:-18,y:4,type:'rusher'},
    {x:-10,y:-4,type:'grunt'},{x:-10,y:4,type:'grunt'},
    {x:-2,y:-4,type:'heavy'},{x:-2,y:4,type:'heavy'},
    {x:6,y:-4,type:'grunt'},{x:6,y:4,type:'grunt'},
    {x:14,y:-4,type:'rusher'},{x:14,y:4,type:'rusher'},
    {x:18,y:-4,type:'tank'},{x:18,y:4,type:'tank'},
    {x:2,y:2,type:'molotov'},{x:-12,y:2,type:'molotov'},{x:12,y:2,type:'molotov'}
  ]);
}
function buildAssault4() {
  currentTheme = 'dirt';
  player.x = 0; player.y = -20 * UNIT;
  addWallRect(-24,-22,24,-21.5); addWallRect(-24,22,24,22.5);
  addWallRect(-24,-22,-23.5,22.5); addWallRect(23.5,-22,24,22.5);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const x0 = -18 + c * 12, y0 = -14 + r * 14;
      const x1 = x0 + 8, y1 = y0 + 8;
      if (r === 0) addWallRect(x0, y0, x1, y0 + 0.5);
      else { addWallRect(x0, y0, x0 + 3, y0 + 0.5); addWallRect(x0 + 5, y0, x1, y0 + 0.5); }
      if (c === 0) addWallRect(x0, y0, x0 + 0.5, y1);
      else { addWallRect(x0, y0, x0 + 0.5, y0 + 3); addWallRect(x0, y0 + 5, x0 + 0.5, y1); }
      if (c === 2) addWallRect(x1 - 0.5, y0, x1, y1);
      if (r === 2) addWallRect(x0, y1 - 0.5, x1, y1);
      if (Math.random() < 0.25) addDestructible(x0 + 5, y0 + 0.5, x0 + 7, y0 + 1);
      fillRoomWithFurniture(x0 + 1, y0 + 1, x1 - 1, y1 - 1, 0.25, ['crate','chair']);
    }
  }
  spawnEnemies([
    {x:-15,y:-10,type:'grunt'},{x:-3,y:-10,type:'heavy'},{x:9,y:-10,type:'sniper'},
    {x:-15,y:5,type:'rusher'},{x:-3,y:5,type:'tank'},{x:9,y:5,type:'rusher'},
    {x:-15,y:20,type:'heavy'},{x:-3,y:20,type:'grunt'},{x:9,y:20,type:'sniper'},
    {x:18,y:-8,type:'molotov'},{x:18,y:8,type:'molotov'},
    {x:-22,y:-15,type:'grunt'},{x:-22,y:0,type:'rusher'},{x:-22,y:15,type:'grunt'},
    {x:2,y:-15,type:'tank'},{x:2,y:2,type:'heavy'},
    {x:2,y:15,type:'tank'},{x:-8,y:2,type:'grunt'},
    {x:8,y:2,type:'rusher'},{x:2,y:-5,type:'grunt'},
    {x:-15,y:-5,type:'molotov'},{x:15,y:-10,type:'grunt'}
  ]);
}
function buildAssault5() {
  currentTheme = 'dirt';
  player.x = 0; player.y = -24 * UNIT;
  addWallRect(-28,-26,28,-25.5); addWallRect(-28,26,28,26.5);
  addWallRect(-28,-26,-27.5,26.5); addWallRect(27.5,-26,28,26.5);
  addWallRect(-20,-20,20,-19.5); addWallRect(-20,20,20,20.5);
  addWallRect(-20,-20,-19.5,20); addWallRect(19.5,-20,20,20);
  addDestructible(-4,-20,4,-19.5); addDestructible(-4,20,4,20.5);
  addDestructible(-20,-4,-19.5,4); addDestructible(19.5,-4,20,4);
  addWallRect(-12,-12,12,-11.5); addWallRect(-12,12,12,12.5);
  addWallRect(-12,-12,-11.5,12); addWallRect(11.5,-12,12,12);
  addDestructible(-3,-12,3,-11.5); addDestructible(-3,12,3,12.5);
  addDestructible(-12,-3,-11.5,3); addDestructible(11.5,-3,12,3);
  addWallRect(-5,-5,-2,-4.5); addWallRect(2,-5,5,-4.5);
  addWallRect(-5,4.5,-2,5); addWallRect(2,4.5,5,5);
  addWallRect(-5,-4.5,-4.5,-2); addWallRect(-5,2,-4.5,4.5);
  addWallRect(4.5,-4.5,5,-2); addWallRect(4.5,2,5,4.5);
  addObstacleRect(0,0,3,3);
  addObstacleRect(-24,-24,4,4); addObstacleRect(24,-24,4,4);
  addObstacleRect(-24,24,4,4); addObstacleRect(24,24,4,4);
  addObstacleRect(0,-24,4,4); addObstacleRect(0,24,4,4);
  addObstacleRect(-24,0,4,4); addObstacleRect(24,0,4,4);
  fillRoomWithFurniture(-27, -25, -21, -21, 0.3, ['crate','barrel']);
  fillRoomWithFurniture(21, -25, 27, -21, 0.3, ['crate','barrel']);
  fillRoomWithFurniture(-27, 21, -21, 25, 0.3, ['crate','barrel']);
  fillRoomWithFurniture(21, 21, 27, 25, 0.3, ['crate','barrel']);
  spawnEnemies([
    {x:-24,y:-24,type:'sniper'},{x:24,y:-24,type:'sniper'},
    {x:-24,y:24,type:'sniper'},{x:24,y:24,type:'sniper'},
    {x:2,y:-22,type:'tank'},{x:2,y:22,type:'tank'},
    {x:-22,y:2,type:'heavy'},{x:22,y:2,type:'heavy'},
    {x:-15,y:-15,type:'rusher'},{x:15,y:-15,type:'rusher'},
    {x:-15,y:15,type:'rusher'},{x:15,y:15,type:'rusher'},
    {x:-8,y:-8,type:'molotov'},{x:8,y:-8,type:'molotov'},
    {x:-8,y:8,type:'molotov'},{x:8,y:8,type:'molotov'},
    {x:-16,y:2,type:'grunt'},{x:16,y:2,type:'grunt'},
    {x:2,y:-16,type:'grunt'},{x:2,y:16,type:'grunt'},
    {x:-3,y:-3,type:'tank'},{x:3,y:3,type:'tank'},
    {x:3,y:-3,type:'heavy'},{x:-3,y:3,type:'heavy'},
    {x:-25,y:-15,type:'grunt'},{x:25,y:15,type:'grunt'}
  ]);
}
function buildWaveMap() {
  currentTheme = 'industrial';
  player.x = 0; player.y = 0;
  addWallRect(-30,-30,30,-29.5); addWallRect(-30,29.5,30,30);
  addWallRect(-30,-30,-29.5,30); addWallRect(29.5,-30,30,30);
  addWallRect(-8,-8,8,-7.5); addWallRect(-8,7.5,8,8);
  addWallRect(-8,-7.5,-7.5,7.5); addWallRect(7.5,-7.5,8,7.5);
  addDestructible(-2,-8,2,-7.5); addDestructible(-2,7.5,2,8);
  addDestructible(-8,-2,-7.5,2); addDestructible(7.5,-2,8,2);
  addWallRect(-28,-28,-20,-27.5); addWallRect(-28,-20,-20,-19.5);
  addWallRect(-28,-28,-27.5,-19.5); addWallRect(-20.5,-28,-20,-20);
  addWallRect(20,-28,28,-27.5); addWallRect(20,-20,28,-19.5);
  addWallRect(20,-28,20.5,-19.5); addWallRect(27.5,-28,28,-20);
  addWallRect(-28,20,-20,20.5); addWallRect(-28,27.5,-20,28);
  addWallRect(-28,20,-27.5,28); addWallRect(-20.5,20,-20,28);
  addWallRect(20,20,28,20.5); addWallRect(20,27.5,28,28);
  addWallRect(20,20,20.5,28); addWallRect(27.5,20,28,28);
  const cols = [[-24,-12],[-24,12],[24,-12],[24,12],[-12,-24],[12,-24],[-12,24],[12,24],[-16,-16],[16,-16],[-16,16],[16,16]];
  for (const [cx,cy] of cols) addObstacleRect(cx,cy,2.5,2.5);
  addWallRect(-16,0,-9,0.5); addDestructible(-9,0,-3,0.5);
  addWallRect(3,0,9,0.5); addDestructible(9,0,16,0.5);
  addWallRect(0,-16,-0.5,-9); addDestructible(0,-9,-0.5,-3);
  addWallRect(0,3,0.5,9); addDestructible(0,9,0.5,16);
  fillRoomWithFurniture(-25, -25, -5, -5, 0.2, ['crate','barrel','chair']);
  fillRoomWithFurniture(5, -25, 25, -5, 0.2, ['crate','barrel','chair']);
  fillRoomWithFurniture(-25, 5, -5, 25, 0.2, ['crate','barrel','chair']);
  fillRoomWithFurniture(5, 5, 25, 25, 0.2, ['crate','barrel','chair']);
}

const MISSION_BUILDERS = {
  'clear_1': buildClear1, 'clear_2': buildClear2, 'clear_3': buildClear3, 'clear_4': buildClear4, 'clear_5': buildClear5,
  'hostage_1': buildHostage1, 'hostage_2': buildHostage2, 'hostage_3': buildHostage3, 'hostage_4': buildHostage4, 'hostage_5': buildHostage5,
  'bomb_1': buildBomb1, 'bomb_2': buildBomb2, 'bomb_3': buildBomb3, 'bomb_4': buildBomb4, 'bomb_5': buildBomb5,
  'assault_1': buildAssault1, 'assault_2': buildAssault2, 'assault_3': buildAssault3, 'assault_4': buildAssault4, 'assault_5': buildAssault5,
  'wave': buildWaveMap,
};

function buildMission(missionId) {
  clearWorld();
  player.hp = player.maxHp;
  player.alive = true;
  player.reloading = false;
  player.weapon = 0;
  player.ammo = WEAPONS[0].magSize;
  player.reserve = WEAPONS[0].reserve;
  player.angle = -Math.PI / 2;
  player.vx = 0; player.vy = 0;
  player.burning = 0;
  resetStats();

  const builder = MISSION_BUILDERS[missionId];
  if (builder) builder();

  let safety = 0;
  while (collides(player.x, player.y, player.radius + 4) && safety++ < 50) player.x += 20;
  addSpawnRoom();
  computeWorldBounds();
  flushEnemySpawns();
  spawnSquadSafely();
  updateHUD();
  updateWeaponSelector();
}
function buildMissionForGuest(missionId) {
  clearWorld();
  player.hp = player.maxHp; player.alive = true; player.reloading = false;
  player.weapon = 0; player.ammo = WEAPONS[0].magSize; player.reserve = WEAPONS[0].reserve;
  player.angle = -Math.PI / 2; player.vx = 0; player.vy = 0; player.burning = 0;
  const builder = MISSION_BUILDERS[missionId];
  if (builder) builder();
  enemies.length = 0; squad.length = 0; pendingEnemySpawns = [];
  computeWorldBounds();
  updateHUD(); updateWeaponSelector();
}

// ============================================================
//  INPUT
// ============================================================
const keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

const moveInput = { x:0, y:0, active:false };
(function setupMoveJoystick() {
  const el = document.getElementById('joystick-move');
  const knob = el.querySelector('.joystick-knob');
  let maxDist = 40;
  let touchId = null;
  const update = (t) => {
    const rect = el.getBoundingClientRect();
    maxDist = rect.width / 3;
    const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
    let dx = t.clientX - cx, dy = t.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxDist) { dx = dx/dist*maxDist; dy = dy/dist*maxDist; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    moveInput.x = dx/maxDist; moveInput.y = dy/maxDist;
  };
  el.addEventListener('touchstart', e => { e.preventDefault(); if (touchId !== null) return; touchId = e.changedTouches[0].identifier; moveInput.active = true; update(e.changedTouches[0]); }, { passive:false });
  el.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === touchId) update(t); }, { passive:false });
  const end = e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === touchId) { touchId = null; moveInput.active = false; moveInput.x = 0; moveInput.y = 0; knob.style.transform = 'translate(-50%,-50%)'; } };
  el.addEventListener('touchend', end, { passive:false });
  el.addEventListener('touchcancel', end, { passive:false });
})();

const FIRE_CHARGE_MS = 400;
const AIM_DEADZONE = 0.22;
const FIRE_THRESHOLD = 0.42;
const fireJoy = { active:false, touchId:null, x:0, y:0, mag:0, holdStart:0, charged:false };

(function setupFireJoystick() {
  const el = document.getElementById('fire-joystick');
  const knob = el.querySelector('.fire-knob');
  let maxDist = 40;
  const update = (t) => {
    const rect = el.getBoundingClientRect();
    maxDist = rect.width / 3;
    const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
    let dx = t.clientX - cx, dy = t.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxDist) { dx = dx/dist*maxDist; dy = dy/dist*maxDist; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    fireJoy.x = dx/maxDist; fireJoy.y = dy/maxDist;
    fireJoy.mag = Math.min(1, Math.hypot(fireJoy.x, fireJoy.y));
    if (fireJoy.mag > AIM_DEADZONE) player.angle = Math.atan2(fireJoy.y, fireJoy.x);
  };
  el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); if (fireJoy.touchId !== null) return; fireJoy.touchId = e.changedTouches[0].identifier; fireJoy.active = true; fireJoy.holdStart = performance.now(); fireJoy.charged = false; el.classList.add('charging'); update(e.changedTouches[0]); }, { passive:false });
  el.addEventListener('touchmove', e => { e.preventDefault(); e.stopPropagation(); for (const t of e.changedTouches) if (t.identifier === fireJoy.touchId) update(t); }, { passive:false });
  const end = e => { e.preventDefault(); e.stopPropagation(); for (const t of e.changedTouches) if (t.identifier === fireJoy.touchId) { fireJoy.touchId = null; fireJoy.active = false; fireJoy.charged = false; fireJoy.mag = 0; player.firing = false; el.classList.remove('charging', 'charged'); el.style.setProperty('--charge', '0%'); knob.style.transform = 'translate(-50%,-50%)'; } };
  el.addEventListener('touchend', end, { passive:false });
  el.addEventListener('touchcancel', end, { passive:false });
  el.addEventListener('mousedown', e => { e.preventDefault(); fireJoy.active = true; fireJoy.holdStart = performance.now(); fireJoy.charged = false; el.classList.add('charging'); });
  window.addEventListener('mouseup', () => { if (fireJoy.active) { fireJoy.active = false; fireJoy.charged = false; player.firing = false; el.classList.remove('charging', 'charged'); el.style.setProperty('--charge', '0%'); } });
})();
function updateFireCharge() {
  const el = document.getElementById('fire-joystick');
  if (!fireJoy.active) return;
  const elapsed = performance.now() - fireJoy.holdStart;
  const progress = Math.min(1, elapsed / FIRE_CHARGE_MS);
  if (!fireJoy.charged && progress >= 1) { fireJoy.charged = true; el.classList.remove('charging'); el.classList.add('charged'); }
  if (!fireJoy.charged) el.style.setProperty('--charge', (progress * 100) + '%');
  player.firing = fireJoy.charged && fireJoy.mag >= FIRE_THRESHOLD;
}
canvas.addEventListener('mousemove', e => { if (player.firing || fireJoy.active || airMode) return; const dx = e.clientX - VW/2; const dy = e.clientY - VH/2; if (Math.hypot(dx, dy) > 15) player.angle = Math.atan2(dy, dx); });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', e => { if (e.button === 0 && !paused && !gameOverFlag && !airMode) player.firing = true; });
window.addEventListener('mouseup', e => { if (e.button === 0 && !fireJoy.active) player.firing = false; });

function bindTap(id, action) {
  const el = document.getElementById(id);
  if (!el) return;
  let tid = null;
  el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); if (tid !== null) return; tid = e.changedTouches[0].identifier; action(); }, { passive:false });
  const end = e => { for (const t of e.changedTouches) if (t.identifier === tid) tid = null; };
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);
  el.addEventListener('click', e => { e.preventDefault(); action(); });
}
bindTap('btn-reload', () => { if (!paused && !airMode) reload(); });
bindTap('btn-grenade', () => { if (!paused && !airMode) throwGrenade(); });
bindTap('btn-commands', () => { if (!paused && !gameOverFlag && !airMode) toggleCommandMenu(); });
bindTap('btn-weapon', () => { if (!paused && !airMode) cycleWeapon(); });
bindTap('btn-pause', () => togglePause());
bindTap('cmd-close', () => toggleCommandMenu());
bindTap('btn-resume', () => togglePause());
bindTap('btn-restart', () => restartMission());
bindTap('btn-to-menu', () => toMenu());
bindTap('code-cancel', () => closeCodeModal());
bindTap('code-submit', () => submitCode());
bindTap('tutorial-skip', () => skipTutorial());
bindTap('want-plane-btn', () => activateAirMode());

(function setupAirControls() {
  const el = document.getElementById('air-move-joy');
  const knob = el.querySelector('.knob');
  const maxDist = 45;
  let touchId = null;
  const update = (t) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
    let dx = t.clientX - cx, dy = t.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxDist) { dx = dx/dist*maxDist; dy = dy/dist*maxDist; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    moveInput.x = dx/maxDist; moveInput.y = dy/maxDist; moveInput.active = true;
  };
  el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); if (touchId !== null) return; touchId = e.changedTouches[0].identifier; update(e.changedTouches[0]); }, { passive:false });
  el.addEventListener('touchmove', e => { e.preventDefault(); e.stopPropagation(); for (const t of e.changedTouches) if (t.identifier === touchId) update(t); }, { passive:false });
  const end = e => { e.preventDefault(); e.stopPropagation(); for (const t of e.changedTouches) if (t.identifier === touchId) { touchId = null; moveInput.x = 0; moveInput.y = 0; moveInput.active = false; knob.style.transform = 'translate(-50%,-50%)'; } };
  el.addEventListener('touchend', end, { passive:false });
  el.addEventListener('touchcancel', end, { passive:false });
})();
(function setupAirDrop() {
  const btn = document.getElementById('air-drop-btn');
  let tid = null;
  btn.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); if (tid !== null) return; tid = e.changedTouches[0].identifier; dropBomb(); }, { passive:false });
  const end = e => { for (const t of e.changedTouches) if (t.identifier === tid) tid = null; };
  btn.addEventListener('touchend', end);
  btn.addEventListener('touchcancel', end);
  btn.addEventListener('click', e => { e.preventDefault(); dropBomb(); });
})();

document.querySelectorAll('.wslot').forEach(slot => {
  const id = 'wslot-' + slot.dataset.idx;
  if (!slot.id) slot.id = id;
  bindTap(id, () => { if (!paused && !airMode) switchWeapon(parseInt(slot.dataset.idx)); });
});
document.querySelectorAll('.cmd-btn').forEach(btn => {
  btn.addEventListener('click', e => { e.preventDefault(); issueCommand(btn.dataset.cmd); });
});
window.addEventListener('keydown', e => {
  if (e.code === 'KeyR' && !airMode) reload();
  if (e.code === 'KeyG' && !airMode) throwGrenade();
  if (e.code === 'KeyQ' && !airMode) cycleWeapon();
  if (e.code === 'Digit1' && !airMode) switchWeapon(0);
  if (e.code === 'Digit2' && !airMode) switchWeapon(1);
  if (e.code === 'Digit3' && !airMode) switchWeapon(2);
  if (e.code === 'KeyF') toggleFullscreen();
  if (e.code === 'KeyE' || e.code === 'Tab') { e.preventDefault(); if (!airMode) toggleCommandMenu(); }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'Space' && airMode) { e.preventDefault(); dropBomb(); }
  if (e.code === 'Enter' && document.getElementById('code-modal').classList.contains('active')) { e.preventDefault(); submitCode(); }
});
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(()=>{});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(()=>{});
  } else if (document.exitFullscreen) document.exitFullscreen();
}

(function setupEasterEgg() {
  const br = document.getElementById('easter-br');
  const progress = document.getElementById('easter-progress');
  const hint = document.getElementById('easter-hint');
  let holdStart = 0; let active = false; let progressRaf = null;
  function tick() {
    if (!active) return;
    const elapsed = performance.now() - holdStart;
    const pct = Math.min(100, (elapsed / 9000) * 100);
    progress.style.width = pct + '%';
    if (pct >= 100) {
      active = false; progress.style.width = '0%';
      br.classList.remove('charging'); hint.classList.remove('show');
      openCodeModal(); return;
    }
    progressRaf = requestAnimationFrame(tick);
  }
  function startHold() { if (active) return; active = true; holdStart = performance.now(); br.classList.add('charging'); hint.classList.add('show'); tick(); }
  function endHold() { if (!active) return; active = false; progress.style.width = '0%'; br.classList.remove('charging'); hint.classList.remove('show'); cancelAnimationFrame(progressRaf); }
  br.addEventListener('touchstart', e => { e.preventDefault(); startHold(); }, { passive:false });
  br.addEventListener('touchend', e => { e.preventDefault(); endHold(); });
  br.addEventListener('touchcancel', endHold);
  br.addEventListener('mousedown', e => { e.preventDefault(); startHold(); });
  window.addEventListener('mouseup', endHold);
})();

function openCodeModal() {
  document.getElementById('code-modal').classList.add('active');
  document.getElementById('code-error').textContent = '';
  const inp = document.getElementById('code-input');
  inp.value = '';
  setTimeout(() => inp.focus(), 100);
  playMedkit();
}
function closeCodeModal() {
  document.getElementById('code-modal').classList.remove('active');
  document.getElementById('code-input').value = '';
  document.getElementById('code-error').textContent = '';
}
document.getElementById('code-input').addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});
function submitCode() {
  const code = document.getElementById('code-input').value.trim().toUpperCase();
  const evId = CHEAT_CODES[code];
  if (!evId) {
    document.getElementById('code-error').textContent = '✖ НЕВЕРНЫЙ КОД';
    document.getElementById('code-input').value = '';
    return;
  }
  closeCodeModal();
  startCheatMission(evId);
}
function startCheatMission(eventId) {
  tutorialMode = false;
  currentMission = MISSIONS.find(m => m.id === 'clear_1');
  waveMode = false; airMode = false;
  initAudio();
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('end-screen').style.display = 'none';
  document.getElementById('mission').textContent = `★ ТЕСТ СОБЫТИЯ ★`;
  document.getElementById('objective').textContent = `Событие через 6 секунд`;
  buildMission('clear_1');
  while (enemies.length > 2) enemies.pop();
  updateHUD();
  log(`★ Активирован тест: ${eventId}`, 'good');
  log('Событие через 6 секунд...', 'warn');
  scheduledEvent = { id: eventId, time: gameTime + 6000 };
  eventCooldown = 999999;
}

function spawnWave(n) {
  const count = 4 + n * 2;
  const allTypes = ['grunt', 'rusher'];
  if (n >= 2) allTypes.push('molotov');
  if (n >= 3) allTypes.push('heavy');
  if (n >= 4) allTypes.push('tank');
  if (n >= 5) allTypes.push('sniper');
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 800 + Math.random() * 700;
    const clamped = clampToBounds(player.x + Math.cos(angle) * dist, player.y + Math.sin(angle) * dist, 150);
    const p = findFreeSpotNear(clamped.x, clamped.y, 200, 500);
    const type = allTypes[Math.floor(Math.random() * allTypes.length)];
    enemies.push(createEnemy(p.x, p.y, type));
  }
  waveKillsNeeded = count; waveInProgress = true;
  log(`ВОЛНА ${n} — ${count} врагов`, 'warn');
  playAlarm();
  showEventBanner({ icon:'⚔', title:`ВОЛНА ${n}`, desc:`${count} противников наступают!`, color:'#c8a850', glow:'rgba(180,150,60,0.5)' });
}
function updateWaveMode(dt) {
  if (!waveMode || gameOverFlag || !player.alive) return;
  if (waveBetweenTimer > 0) { waveBetweenTimer -= dt * 1000; if (waveBetweenTimer <= 0) { waveNumber++; spawnWave(waveNumber); } return; }
  if (waveInProgress) {
    const alive = enemies.filter(e => e.alive).length;
    if (alive === 0) {
      waveInProgress = false; waveBetweenTimer = 3000;
      log(`Волна ${waveNumber} отбита!`, 'good');
      player.hp = Math.min(player.maxHp, player.hp + 15);
      updateHUD();
    }
  }
}
function startWaveMode() {
  waveMode = true;
  waveNumber = 0; waveInProgress = false; waveBetweenTimer = 1500;
  currentMission = { id:'wave', type:'wave', name:'ВОЛНЫ', level:0, theme:'industrial', desc:'Бесконечные волны врагов', enemies:0 };
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('end-screen').style.display = 'none';
  document.getElementById('mission').textContent = '★ СЕКРЕТНЫЙ РЕЖИМ: ВОЛНЫ ★';
  document.getElementById('objective').textContent = 'Выживайте как можно дольше';
  buildMission('wave');
  log('Волны начнутся через мгновение...', 'warn');
}

function switchWeapon(idx) {
  if (idx === player.weapon || player.reloading) return;
  if (idx < 0 || idx >= WEAPONS.length) return;
  player.weapon = idx;
  player.ammo = WEAPONS[idx].magSize;
  player.reserve = WEAPONS[idx].reserve;
  updateHUD(); updateWeaponSelector();
  log(`Оружие: ${WEAPONS[idx].name}`, 'good');
  if (tutorialMode && TUTORIAL_STEPS[tutorialStep] && TUTORIAL_STEPS[tutorialStep].id === 'weapon') tutorialState.switchedWeapon = true;
}
function cycleWeapon() { switchWeapon((player.weapon + 1) % WEAPONS.length); }
function reload() {
  const w = WEAPONS[player.weapon];
  if (player.reloading || player.ammo >= w.magSize || player.reserve === 0) return;
  player.reloading = true;
  document.getElementById('reload-indicator').style.display = 'block';
  log('Перезарядка...', 'warn');
  if (tutorialMode && TUTORIAL_STEPS[tutorialStep] && TUTORIAL_STEPS[tutorialStep].id === 'reload') tutorialState.reloaded = true;
  const start = gameTime;
  const tick = () => {
    if (paused) { requestAnimationFrame(tick); return; }
    if (gameTime - start >= w.reload) {
      const needed = w.magSize - player.ammo;
      const avail = Math.min(needed, player.reserve);
      player.ammo += avail; player.reserve -= avail;
      player.reloading = false;
      document.getElementById('reload-indicator').style.display = 'none';
      updateHUD();
    } else if (!gameOverFlag) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function shoot() {
  const w = WEAPONS[player.weapon];
  if (player.reloading) return;
  if (gameTime - player.lastShot < w.fireRate) return;
  if (player.ammo <= 0) { reload(); return; }
  player.lastShot = gameTime; player.ammo--;
  playShoot(player.weapon);
  if (tutorialMode && TUTORIAL_STEPS[tutorialStep] && TUTORIAL_STEPS[tutorialStep].id === 'shoot') tutorialState.shots = (tutorialState.shots || 0) + 1;
  const pellets = w.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    const a = player.angle + (Math.random() - 0.5) * w.spread * 2;
    bullets.push({
      x: player.x + Math.cos(player.angle) * (player.radius + 4),
      y: player.y + Math.sin(player.angle) * (player.radius + 4),
      vx: Math.cos(a) * w.bulletSpeed, vy: Math.sin(a) * w.bulletSpeed,
      dmg: w.dmg, owner: 'player', color: w.color, traveled: 0, maxDist: w.range,
    });
  }
  effects.push({ type:'flash', x: player.x + Math.cos(player.angle)*(player.radius+8), y: player.y + Math.sin(player.angle)*(player.radius+8), life: 60, maxLife: 60 });
  alertEnemiesAround(player.x, player.y, 620, player.x, player.y);
  updateHUD();
}

function damageDestructibles(x, y, radius) {
  for (const d of WORLD.destructibles) {
    if (d.state >= 2) continue;
    const nearX = Math.max(d.x, Math.min(x, d.x + d.w));
    const nearY = Math.max(d.y, Math.min(y, d.y + d.h));
    const nearestDist = Math.hypot(nearX - x, nearY - y);
    if (nearestDist < radius * 0.85) {
      d.state++;
      playCrash();
      if (d.state === 2) {
        spawnWallFragments(d);
        if (tutorialMode) tutorialState.brokeWall = true;
      } else log('Стена треснула!', 'warn');
    }
  }
}
function spawnWallFragments(w) {
  const fragCount = Math.max(6, Math.floor((w.w * w.h) / 1500));
  for (let i = 0; i < fragCount; i++) {
    const px = w.x + Math.random() * w.w, py = w.y + Math.random() * w.h;
    const a = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 220;
    effects.push({ type: 'fragment', x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 10, size: 4 + Math.random() * 6, life: 700 + Math.random() * 300, maxLife: 1000, color: MIL.destruct });
  }
  effects.push({ type:'explosion', x: w.x + w.w/2, y: w.y + w.h/2, life:280, maxLife:280, maxR:55 });
  log('СТЕНА РАЗРУШЕНА!', 'good');
}
function explode(x, y, radius = 200) {
  playExplosion();
  for (const e of enemies) { if (!e.alive) continue; const d = Math.hypot(e.x - x, e.y - y); if (d < radius && lineOfSight(x, y, e.x, e.y)) { const dealt = 170 * (1 - d/radius); e.hp -= dealt; stats.damageDealt += dealt; e.alertLevel = 100; e.lastSeen = { x: player.x, y: player.y }; if (e.hp <= 0) { e.alive = false; stats.kills++; onEnemyKilled(e); checkMissionComplete(); } } }
  for (const s of squad) { if (!s.alive) continue; const d = Math.hypot(s.x - x, s.y - y); if (d < radius && lineOfSight(x, y, s.x, s.y)) { s.hp -= 120 * (1 - d/radius); if (s.hp <= 0) { s.alive = false; log(`${s.name} погиб от гранаты!`, 'warn'); } } }
  if (player.alive) { const d = Math.hypot(player.x - x, player.y - y); if (d < radius && lineOfSight(x, y, player.x, player.y)) { const dmg = 90 * (1 - d/radius); player.hp -= dmg; stats.damageTaken += dmg; showDamage(); playHurt(); updateHUD(); if (player.hp <= 0) { player.hp = 0; player.alive = false; gameOver(false, 'Подорвался на гранате'); } } }
  if (mpRemotePlayer && mpMode === 'host') { const d = Math.hypot(mpRemotePlayer.x - x, mpRemotePlayer.y - y); if (d < radius) { mpRemotePlayer.hp -= 90 * (1 - d/radius); if (mpRemotePlayer.hp <= 0) mpRemotePlayer.hp = 0; } }
  damageFurnitureArea(x, y, radius);
  if (window.hostage) { const d = Math.hypot(window.hostage.x - x, window.hostage.y - y); if (d < radius * 0.85) { log('ЗАЛОЖНИК ПОГИБ!', 'warn'); window.hostage = null; gameOver(false, 'Заложник погиб'); return; } }
  if (window.bomb) { const d = Math.hypot(window.bomb.x - x, window.bomb.y - y); if (d < radius * 1.1) { log('БОМБА ДЕТОНИРОВАЛА!', 'warn'); const bx = window.bomb.x, by = window.bomb.y; window.bomb = null; setTimeout(() => explode(bx, by, 320), 100); setTimeout(() => gameOver(false, 'Бомба взорвана'), 400); return; } }
  damageDestructibles(x, y, radius);
  effects.push({ type:'explosion', x, y, life:400, maxLife:400, maxR:radius });
  alertEnemiesAround(x, y, 900, x, y);
  log('ВЗРЫВ!', 'warn');
}

function throwMolotov(e) {
  const dx = player.x - e.x, dy = player.y - e.y;
  const dist = Math.hypot(dx, dy);
  const flightTime = Math.max(0.6, Math.min(1.3, dist / 500));
  const tx = player.x + player.vx * flightTime * 0.5;
  const ty = player.y + player.vy * flightTime * 0.5;
  const tdx = tx - e.x, tdy = ty - e.y;
  const tdist = Math.hypot(tdx, tdy);
  const landX = e.x + (tdx / Math.max(tdist, 1)) * Math.min(tdist + 30, e.shootRange * 0.9);
  const landY = e.y + (tdy / Math.max(tdist, 1)) * Math.min(tdist + 30, e.shootRange * 0.9);
  const vx = (landX - e.x) / flightTime;
  const vy = (landY - e.y) / flightTime;
  molotovs.push({ x: e.x + Math.cos(e.angle) * (e.radius + 8), y: e.y + Math.sin(e.angle) * (e.radius + 8), vx, vy, h: 30, vh: 320, spawnTime: gameTime, owner: 'enemy' });
  log('🔥 Молотов!', 'warn');
  playEnemyVoice(50);
}
function ignite(x, y, radius = 90) {
  const existing = fires.find(f => Math.hypot(f.x - x, f.y - y) < radius * 0.8);
  if (existing) { existing.born = gameTime; existing.radius = Math.max(existing.radius, radius); return; }
  fires.push({ x, y, radius, born: gameTime, duration: 9000 });
  playGlassBreak();
  for (const m of molotovs) { if (Math.hypot(m.x - x, m.y - y) < radius * 0.7) m.h = 0.1; }
}
function updateMolotovs(dt) {
  for (let i = molotovs.length - 1; i >= 0; i--) {
    const m = molotovs[i];
    if (m.waiting) {
      if (gameTime >= m.spawnTime) { m.waiting = false; m.vh = -200; } else continue;
    }
    m.x += m.vx * dt; m.y += m.vy * dt;
    m.vh -= 900 * dt; m.h += m.vh * dt;
    if (pointInWalls(m.x, m.y) && m.h < 30) { const bx = m.x, by = m.y; molotovs.splice(i, 1); ignite(bx, by, 90); continue; }
    if (m.h <= 0) { molotovs.splice(i, 1); ignite(m.x, m.y, 95); }
    if (Math.abs(m.x) > WORLD_LIMIT || Math.abs(m.y) > WORLD_LIMIT) molotovs.splice(i, 1);
  }
}
function updateFires(dt) {
  for (let i = fires.length - 1; i >= 0; i--) {
    const f = fires[i];
    const age = gameTime - f.born;
    if (age > f.duration) { fires.splice(i, 1); continue; }
    const burnDps = 42;
    if (player.alive) { const d = Math.hypot(player.x - f.x, player.y - f.y); if (d < f.radius) { const dmg = burnDps * dt * (1 - d / f.radius * 0.5); player.hp -= dmg; stats.damageTaken += dmg; player.burning = 0.4; if (Math.random() < dt * 6) showDamage(); if (player.hp <= 0) { player.hp = 0; player.alive = false; gameOver(false, 'Сгорел заживо'); } } }
    for (const s of squad) { if (!s.alive) continue; const d = Math.hypot(s.x - f.x, s.y - f.y); if (d < f.radius) { s.hp -= burnDps * dt * 0.9; s.burning = 0.4; if (s.hp <= 0) { s.alive = false; log(`${s.name} сгорел!`, 'warn'); } } }
    for (const e of enemies) { if (!e.alive) continue; const d = Math.hypot(e.x - f.x, e.y - f.y); if (d < f.radius) { e.hp -= burnDps * dt * 0.85; e.burning = 0.4; if (e.hp <= 0) { e.alive = false; onEnemyKilled(e); checkMissionComplete(); } } }
    if (window.hostage) { const d = Math.hypot(window.hostage.x - f.x, window.hostage.y - f.y); if (d < f.radius) { log('ЗАЛОЖНИК В ОГНЕ!', 'warn'); window.hostage = null; gameOver(false, 'Заложник сгорел'); return; } }
    if (window.bomb) { const d = Math.hypot(window.bomb.x - f.x, window.bomb.y - f.y); if (d < f.radius * 0.7) { log('ОГОНЬ ДОБРАЛСЯ ДО БОМБЫ!', 'warn'); const bx = window.bomb.x, by = window.bomb.y; window.bomb = null; setTimeout(() => explode(bx, by, 320), 150); setTimeout(() => gameOver(false, 'Бомба взорвана'), 500); return; } }
    if (Math.random() < dt * 2) playFireAmbient();
  }
  if (player.burning > 0) player.burning -= dt;
  for (const s of squad) if (s.burning > 0) s.burning -= dt;
  for (const e of enemies) if (e.burning > 0) e.burning -= dt;
}

function alertEnemiesAround(x, y, radius, srcX, srcY) {
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < radius) {
      const intensity = 70 * (1 - d/radius);
      const wasAlerted = e.alertLevel > 35;
      e.alertLevel = Math.min(100, e.alertLevel + intensity);
      if (!e.lastSeen) e.lastSeen = { x: srcX, y: srcY };
      const ang = Math.atan2(srcY - e.y, srcX - e.x);
      e.angle += angleDiff(ang, e.angle) * 0.5;
      if (!wasAlerted && e.alertLevel > 35) playEnemyVoice(ENEMY_TYPES[e.type].voicePitch);
    }
  }
}
function onEnemyKilled(e) {
  const n = 8 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 140;
    effects.push({ type: 'blood', x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 350 + Math.random() * 250, maxLife: 600 });
  }
  addBloodDecal(e.x, e.y);
  if (Math.random() < 0.18) medkits.push({ x: e.x, y: e.y, born: gameTime, radius: 15 });
}
// FIX: medkit heals player AND nearby allies in 300px radius
function updateMedkits(dt) {
  for (let i = medkits.length - 1; i >= 0; i--) {
    const m = medkits[i];
    if (gameTime - m.born > 25000) { medkits.splice(i, 1); continue; }
    // Check if player is in pickup range
    if (player.alive) {
      const d = Math.hypot(player.x - m.x, player.y - m.y);
      if (d < player.radius + m.radius + 6) {
        // Heal player
        const before = player.hp;
        player.hp = Math.min(player.maxHp, player.hp + 30);
        const healed = player.hp - before;
        // Heal nearby squadmates too (radius 300px)
        let healedAllies = 0;
        for (const s of squad) {
          if (!s.alive) continue;
          if (s.hp >= s.maxHp) continue;
          const dd = Math.hypot(s.x - m.x, s.y - m.y);
          if (dd < 300) {
            const sb = s.hp;
            s.hp = Math.min(s.maxHp, s.hp + 30);
            if (s.hp > sb) healedAllies++;
          }
        }
        updateHUD();
        if (healed > 0 && healedAllies > 0) log(`+${healed} HP (и ${healedAllies} союзникам)`, 'good');
        else if (healed > 0) log(`+${healed} HP`, 'good');
        else if (healedAllies > 0) log(`+30 HP ${healedAllies} союзникам`, 'good');
        playMedkit();
        effects.push({ type:'explosion', x: m.x, y: m.y, life:350, maxLife:350, maxR:40 });
        if (tutorialMode) tutorialState.medkitsTaken = (tutorialState.medkitsTaken || 0) + 1;
        medkits.splice(i, 1);
        continue;
      }
    }
    // Squad auto-pickup only when player not near (fallback)
    for (const s of squad) {
      if (!s.alive) continue;
      if (s.hp >= s.maxHp) continue;
      const d = Math.hypot(s.x - m.x, s.y - m.y);
      if (d < s.radius + m.radius + 6) {
        s.hp = Math.min(s.maxHp, s.hp + 30);
        updateHUD();
        log(`${s.name} +30 HP`, 'good');
        playMedkit();
        effects.push({ type:'explosion', x: m.x, y: m.y, life:350, maxLife:350, maxR:40 });
        medkits.splice(i, 1);
        break;
      }
    }
  }
}
function addBloodDecal(x, y) {
  const splats = [];
  const n = 5 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * 30;
    splats.push({ dx: Math.cos(a)*d, dy: Math.sin(a)*d, r: 4 + Math.random() * 7 });
  }
  bloodDecals.push({ x, y, splats, born: gameTime });
  if (bloodDecals.length > 30) bloodDecals.shift();
}
function pushOutOfWalls(e) {
  if (!collides(e.x, e.y, e.radius)) return;
  for (let r = 5; r < 160; r += 6) {
    for (let a = 0; a < Math.PI*2; a += Math.PI/6) {
      const nx = e.x + Math.cos(a) * r;
      const ny = e.y + Math.sin(a) * r;
      if (!collides(nx, ny, e.radius)) { e.x = nx; e.y = ny; return; }
    }
  }
  e.x = 0; e.y = 0;
}
function moveEntity(e, dx, dy) {
  const nx = e.x + dx, ny = e.y + dy;
  if (!collides(nx, ny, e.radius)) { e.x = nx; e.y = ny; return true; }
  if (!collides(e.x + dx, e.y, e.radius)) { e.x += dx; return true; }
  if (!collides(e.x, e.y + dy, e.radius)) { e.y += dy; return true; }
  return false;
}

function updatePlayer(dt) {
  const prevX = player.x, prevY = player.y;
  const prevAngle = player.angle;
  let mx = 0, my = 0;
  if (moveInput.active) { mx += moveInput.x; my += moveInput.y; }
  if (keys['KeyD'] || keys['ArrowRight']) mx += 1;
  if (keys['KeyA'] || keys['ArrowLeft'])  mx -= 1;
  if (keys['KeyS'] || keys['ArrowDown'])  my += 1;
  if (keys['KeyW'] || keys['ArrowUp'])    my -= 1;
  const len = Math.hypot(mx, my);
  if (len > 0.08) {
    const nx = mx/len, ny = my/len;
    const step = player.speed * dt;
    if (!collides(player.x + nx*step, player.y, player.radius)) player.x += nx*step;
    if (!collides(player.x, player.y + ny*step, player.radius)) player.y += ny*step;
  }
  player.x = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, player.x));
  player.y = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, player.y));
  if (dt > 0) { player.vx = (player.x - prevX)/dt; player.vy = (player.y - prevY)/dt; }
  updateFireCharge();
  if (player.firing) shoot();
  if (tutorialMode) {
    const moved = Math.hypot(player.x - prevX, player.y - prevY);
    tutorialState.moved = (tutorialState.moved || 0) + moved;
    tutorialState.turnAccum = (tutorialState.turnAccum || 0) + Math.abs(angleDiff(player.angle, prevAngle));
  }
}

function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const f = effects[i];
    if (f.type === 'blood') { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= Math.pow(0.02, dt); f.vy *= Math.pow(0.02, dt); }
    else if (f.type === 'fragment') { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= Math.pow(0.15, dt); f.vy *= Math.pow(0.15, dt); f.rot += f.vr * dt; f.vr *= Math.pow(0.3, dt); }
    f.life -= dt * 1000;
    if (f.life <= 0) effects.splice(i, 1);
  }
  for (let i = bloodDecals.length - 1; i >= 0; i--) if (gameTime - bloodDecals[i].born > 22000) bloodDecals.splice(i, 1);
}

function findCoverSpot(e) {
  const awayAng = Math.atan2(e.y - player.y, e.x - player.x);
  for (let r = 60; r < 220; r += 50) {
    for (let off = 0; off < Math.PI; off += 0.7) {
      for (const sign of [1, -1]) {
        const a = awayAng + off * sign;
        const nx = e.x + Math.cos(a) * 30;
        const ny = e.y + Math.sin(a) * 30;
        if (collides(nx, ny, e.radius)) continue;
        if (!lineOfSight(nx, ny, player.x, player.y)) return { x: nx, y: ny };
      }
    }
  }
  return null;
}
let losFrameCount = 0;
function updateEnemies(dt) {
  const now = gameTime;
  losFrameCount++;
  const updateLOS = (losFrameCount % 3) === 0;
  for (const e of enemies) {
    if (!e.alive) continue;
    pushOutOfWalls(e);
    const tdef = ENEMY_TYPES[e.type];
    const dx = player.x - e.x, dy = player.y - e.y;
    const distToPlayer = Math.hypot(dx, dy);
    const angToPlayer = Math.atan2(dy, dx);
    const angDiff = Math.abs(angleDiff(angToPlayer, e.angle));
    const inFov = angDiff < e.fov / 2;
    let hasLos = e.losCache;
    if (updateLOS && distToPlayer < e.viewRange) { hasLos = lineOfSight(e.x, e.y, player.x, player.y); e.losCache = hasLos; }
    const seesPlayer = player.alive && distToPlayer < e.viewRange && inFov && hasLos;
    if (seesPlayer) {
      if (e.firstSeenAt === 0) e.firstSeenAt = now;
      if (now - e.firstSeenAt > e.reactionDelay) e.alertLevel = Math.min(100, e.alertLevel + dt * 320);
      e.lastSeen = { x: player.x, y: player.y };
      e.lastSeenTime = now;
      if (e.alertLevel > 50) {
        for (const other of enemies) {
          if (other === e || !other.alive) continue;
          if (Math.hypot(other.x - e.x, other.y - e.y) < 340) {
            other.alertLevel = Math.min(100, other.alertLevel + dt * 140);
            if (!other.lastSeen) other.lastSeen = { x: player.x, y: player.y };
          }
        }
      }
    } else { e.firstSeenAt = 0; e.alertLevel = Math.max(0, e.alertLevel - dt * 25); }
    const alerted = e.alertLevel > 35;
    const lowHp = e.hp / e.maxHp < 0.4;
    if (alerted) {
      const target = seesPlayer ? { x: player.x, y: player.y } : e.lastSeen;
      if (target) {
        const targetAng = Math.atan2(target.y - e.y, target.x - e.x);
        const turnSpeed = seesPlayer ? 12 : 4;
        e.angle += angleDiff(targetAng, e.angle) * Math.min(1, dt * turnSpeed);
        let mvx = 0, mvy = 0;
        if (seesPlayer) {
          const tooClose = distToPlayer < tdef.retrRange;
          const tooFar = distToPlayer > tdef.advRange;
          const canRetreat = lowHp && !tdef.keepDist && !tdef.assault;
          if (canRetreat && Math.random() < 0.015) { const cover = findCoverSpot(e); if (cover) e.coverTarget = cover; }
          if (e.coverTarget && canRetreat) {
            const cdx = e.coverTarget.x - e.x, cdy = e.coverTarget.y - e.y;
            const cd = Math.hypot(cdx, cdy);
            if (cd > 12) { const cang = Math.atan2(cdy, cdx); mvx = Math.cos(cang) * e.speed * dt; mvy = Math.sin(cang) * e.speed * dt; }
            else e.coverTarget = null;
          } else if (tooClose && !tdef.assault) { const away = angToPlayer + Math.PI; mvx = Math.cos(away) * e.speed * 0.85 * dt; mvy = Math.sin(away) * e.speed * 0.85 * dt; }
          else if (tooFar || (tdef.keepDist && distToPlayer < tdef.idealRange * 0.8)) {
            if (tdef.keepDist && distToPlayer < tdef.idealRange * 0.8) { const away = angToPlayer + Math.PI; mvx = Math.cos(away) * e.speed * 0.7 * dt; mvy = Math.sin(away) * e.speed * 0.7 * dt; }
            else { mvx = Math.cos(angToPlayer) * e.speed * dt; mvy = Math.sin(angToPlayer) * e.speed * dt; }
          } else {
            e.strafeTimer -= dt;
            if (e.strafeTimer <= 0) { e.strafeTimer = 0.6 + Math.random() * 1.2; if (Math.random() < 0.4) e.strafeDir *= -1; }
            const strafeAng = angToPlayer + Math.PI/2 * e.strafeDir + e.flankDir * 0.25;
            mvx = Math.cos(strafeAng) * e.speed * 0.7 * dt;
            mvy = Math.sin(strafeAng) * e.speed * 0.7 * dt;
          }
          if (!moveEntity(e, mvx, mvy)) { e.strafeDir *= -1; e.flankDir *= -1; e.coverTarget = null; }
          if (tdef.thrower) {
            if (distToPlayer < e.shootRange && now - e.lastShot > e.fireRate) { e.lastShot = now; throwMolotov(e); }
          } else if (tdef.shotgun) {
            if (distToPlayer < e.shootRange && now - e.lastShot > e.fireRate) {
              e.lastShot = now; playShotgunBlast();
              const predAng = angToPlayer;
              const pellets = tdef.shotgun;
              const spread = tdef.shotgunSpread;
              for (let p = 0; p < pellets; p++) {
                const a = predAng + (Math.random() - 0.5) * spread;
                bullets.push({ x: e.x + Math.cos(predAng) * (e.radius + 4), y: e.y + Math.sin(predAng) * (e.radius + 4), vx: Math.cos(a) * 800, vy: Math.sin(a) * 800, dmg: tdef.dmg, owner: 'enemy', color: MIL.orange, traveled: 0, maxDist: e.shootRange + 80 });
              }
            }
          } else if (distToPlayer < e.shootRange) {
            if (tdef.burst) {
              if (e.burstLeft > 0) { e.burstTimer -= dt; if (e.burstTimer <= 0) { e.burstTimer = 0.05; e.burstLeft--; fireEnemyBullet(e, angToPlayer, tdef); } }
              else if (now - e.lastShot > e.fireRate) { e.lastShot = now; e.burstLeft = tdef.burst; e.burstTimer = 0; }
            } else { if (now - e.lastShot > e.fireRate) { e.lastShot = now; fireEnemyBullet(e, angToPlayer, tdef); } }
          }
        } else {
          const d = Math.hypot(target.x - e.x, target.y - e.y);
          if (d > 30) { const step = e.speed * 0.9 * dt; moveEntity(e, Math.cos(targetAng)*step, Math.sin(targetAng)*step); }
          else e.angle += dt * 1.6 * e.strafeDir;
        }
      }
    } else {
      e.patrolTimer -= dt;
      if (e.patrolTimer <= 0) { e.patrolTimer = 1.5 + Math.random()*2.5; e.patrolAngle = Math.random()*Math.PI*2; }
      const px = e.patrolCenter.x + Math.cos(e.patrolAngle) * e.patrolRadius;
      const py = e.patrolCenter.y + Math.sin(e.patrolAngle) * e.patrolRadius;
      const ang = Math.atan2(py - e.y, px - e.x);
      e.angle += angleDiff(ang, e.angle) * Math.min(1, dt * 2.5);
      const step = e.speed * 0.4 * dt;
      moveEntity(e, Math.cos(ang)*step, Math.sin(ang)*step);
    }
  }
}
function fireEnemyBullet(e, baseAng, tdef) {
  playEnemyShoot();
  const bulletSpeed = tdef.name === 'СНАЙПЕР' ? 1600 : (tdef.name === 'ТЯЖЁЛЫЙ' ? 900 : 850);
  const distToPlayer = Math.hypot(player.x - e.x, player.y - e.y);
  const tHit = distToPlayer / bulletSpeed;
  const px = player.x + player.vx * tHit * 0.7;
  const py = player.y + player.vy * tHit * 0.7;
  const predAng = Math.atan2(py - e.y, px - e.x);
  const baseSpread = tdef.name === 'СНАЙПЕР' ? 0.05 : (tdef.name === 'ТЯЖЁЛЫЙ' ? 0.16 : 0.13);
  const distFactor = Math.max(0.35, distToPlayer / 500);
  const spread = baseSpread * distFactor;
  const a = predAng + (Math.random() - 0.5) * spread * 2;
  bullets.push({ x: e.x + Math.cos(predAng) * (e.radius + 4), y: e.y + Math.sin(predAng) * (e.radius + 4), vx: Math.cos(a) * bulletSpeed, vy: Math.sin(a) * bulletSpeed, dmg: tdef.dmg, owner: 'enemy', color: tdef.name === 'СНАЙПЕР' ? MIL.sniperBody : MIL.pink, traveled: 0, maxDist: e.shootRange + 100 });
}

function updateSquad(dt) {
  const now = gameTime;
  for (const s of squad) {
    if (!s.alive) continue;
    pushOutOfWalls(s);
    let target = null, speed = s.speed;
    if (s.state === 'follow') {
      const backAng = player.angle + Math.PI + (s.idx - 1) * 0.6;
      target = { x: player.x + Math.cos(backAng)*65, y: player.y + Math.sin(backAng)*65 };
    } else if (s.state === 'hold') { target = s.holdPos; speed = 180; }
    else if (s.state === 'attack' && s.targetEnemy) {
      if (!s.targetEnemy.alive) { s.state = 'follow'; s.targetEnemy = null; }
      else { const d = Math.hypot(s.targetEnemy.x - s.x, s.targetEnemy.y - s.y); if (d > 260) target = { x: s.targetEnemy.x, y: s.targetEnemy.y }; }
    } else if (s.state === 'cover') { target = { x: player.x + Math.cos(s.idx*2.1)*85, y: player.y + Math.sin(s.idx*2.1)*85 }; }
    if (target) {
      const ddx = target.x - s.x, ddy = target.y - s.y;
      const d = Math.hypot(ddx, ddy);
      if (d > 14) { const ang = Math.atan2(ddy, ddx); const step = Math.min(speed*dt, d); moveEntity(s, Math.cos(ang)*step, Math.sin(ang)*step); }
    }
    let combatTarget = s.targetEnemy;
    if (!combatTarget || !combatTarget.alive) {
      let best = null, bestD = 550;
      for (const e of enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x - s.x, e.y - s.y);
        if (d < bestD && lineOfSight(s.x, s.y, e.x, e.y)) { bestD = d; best = e; }
      }
      combatTarget = best;
      if (s.state !== 'attack') s.targetEnemy = best;
    }
    if (combatTarget && combatTarget.alive) {
      const d = Math.hypot(combatTarget.x - s.x, combatTarget.y - s.y);
      if (d < 620 && lineOfSight(s.x, s.y, combatTarget.x, combatTarget.y)) {
        s.angle = Math.atan2(combatTarget.y - s.y, combatTarget.x - s.x);
        const myRate = s.fireRate + (s.idx * 90) + Math.random() * 200;
        if (now - s.lastShot > myRate) {
          s.lastShot = now;
          playAllyShoot();
          const a = s.angle + (Math.random() - 0.5) * 0.13;
          bullets.push({ x: s.x + Math.cos(s.angle)*(s.radius+4), y: s.y + Math.sin(s.angle)*(s.radius+4), vx: Math.cos(a)*1250, vy: Math.sin(a)*1250, dmg: 14, owner: 'squad', color: MIL.ally, traveled: 0, maxDist: 900 });
        }
      }
    } else {
      if (target) { const ang = Math.atan2(target.y - s.y, target.x - s.x); s.angle += angleDiff(ang, s.angle) * Math.min(1, dt * 5); }
      else s.angle += angleDiff(player.angle, s.angle) * Math.min(1, dt * 3);
    }
  }
}

// ============================================================
//  MULTIPLAYER
// ============================================================
let mpMode = 'single';
let mpPeer = null;
let mpConn = null;
let mpRoomCode = '';
let mpRemotePlayer = null;
let mpRemoteInput = { x: 0, y: 0, angle: 0, firing: false, weapon: 0 };
let mpSnapInterval = null;
let mpInputInterval = null;
let mpGuestWorldReady = false;

function openMpLobby() {
  document.getElementById('mp-lobby').classList.add('active');
  document.getElementById('mp-status').textContent = 'Создай игру или присоединись';
  document.getElementById('mp-status').className = 'mp-status';
  document.getElementById('mp-host-btn').style.display = '';
  document.getElementById('mp-join-btn').style.display = '';
  document.getElementById('mp-code-display').style.display = 'none';
  document.getElementById('mp-join-input').style.display = 'none';
}
function closeMpLobby() { document.getElementById('mp-lobby').classList.remove('active'); }
function setMpStatus(text, cls) {
  const el = document.getElementById('mp-status');
  el.textContent = text;
  el.className = 'mp-status' + (cls ? ' ' + cls : '');
}
function initMpRemotePlayer(x, y) {
  mpRemotePlayer = { x: x||0, y: y||0, angle: -Math.PI/2, hp: 100, maxHp: 100, weapon: 0, radius: 15, alive: true, burning: 0, lastShot: 0, _tx: x||0, _ty: y||0, _tangle: -Math.PI/2 };
}
function startHosting() {
  mpRoomCode = 'BRG' + Math.random().toString(36).slice(2, 5).toUpperCase();
  setMpStatus('Создание комнаты...');
  try { mpPeer = new Peer(mpRoomCode, { debug: 0 }); } catch(e) { setMpStatus('Ошибка: ' + e.message, 'err'); return; }
  mpPeer.on('open', id => {
    mpRoomCode = id;
    document.getElementById('mp-code-display').textContent = mpRoomCode;
    document.getElementById('mp-code-display').style.display = 'block';
    document.getElementById('mp-host-btn').style.display = 'none';
    document.getElementById('mp-join-btn').style.display = 'none';
    setMpStatus('Ожидание игрока...', 'ok');
  });
  mpPeer.on('connection', conn => {
    if (mpConn) { try { conn.close(); } catch(e){} return; }
    mpConn = conn; mpMode = 'host';
    conn.on('open', () => {
      setMpStatus('✓ Игрок подключился! Выбирайте миссию', 'ok');
      initMpRemotePlayer(player.x + 60, player.y);
      document.getElementById('p2-panel').classList.add('active');
      document.getElementById('mp-badge').classList.add('active');
      document.getElementById('mp-badge-code').textContent = mpRoomCode;
      setTimeout(() => { closeMpLobby(); }, 800);
      mpSnapInterval = setInterval(sendSnapshot, 50);
      if (currentMission) { try { mpConn.send({ t: 'start', m: currentMission.id }); } catch(e){} }
    });
    conn.on('data', data => {
      if (data && data.t === 'in') {
        mpRemoteInput.x = data.x; mpRemoteInput.y = data.y;
        mpRemoteInput.angle = data.a; mpRemoteInput.firing = data.f; mpRemoteInput.weapon = data.w;
      }
    });
    conn.on('close', () => {
      log('Игрок 2 отключился', 'warn');
      mpRemotePlayer = null; mpConn = null;
      if (mpSnapInterval) { clearInterval(mpSnapInterval); mpSnapInterval = null; }
      document.getElementById('p2-panel').classList.remove('active');
      document.getElementById('mp-badge').classList.remove('active');
    });
    conn.on('error', () => log('Ошибка соединения', 'warn'));
  });
  mpPeer.on('error', err => { setMpStatus('Ошибка: ' + err.type, 'err'); });
}
function startJoining() {
  document.getElementById('mp-join-input').style.display = 'flex';
  document.getElementById('mp-host-btn').style.display = 'none';
  document.getElementById('mp-join-btn').style.display = 'none';
  document.getElementById('mp-code-input').focus();
  setMpStatus('Введите код комнаты');
}
function connectToHost() {
  const code = document.getElementById('mp-code-input').value.trim().toUpperCase();
  if (code.length < 4) { setMpStatus('Код слишком короткий', 'err'); return; }
  setMpStatus('Подключение...');
  try { mpPeer = new Peer({ debug: 0 }); } catch(e) { setMpStatus('Ошибка: ' + e.message, 'err'); return; }
  mpPeer.on('open', () => {
    mpConn = mpPeer.connect(code, { reliable: true });
    mpConn.on('open', () => {
      mpMode = 'guest';
      setMpStatus('✓ Подключено! Ждём хоста...', 'ok');
      document.getElementById('mp-badge').classList.add('active');
      document.getElementById('mp-badge-code').textContent = code;
      document.getElementById('p2-panel').classList.add('active');
      initMpRemotePlayer(0, 0);
      setTimeout(() => { closeMpLobby(); }, 800);
      mpInputInterval = setInterval(sendInput, 33);
      mpGuestWorldReady = false;
    });
    mpConn.on('data', data => {
      if (!data) return;
      if (data.t === 'start' && !mpGuestWorldReady) {
        const mission = MISSIONS.find(m => m.id === data.m);
        if (mission) {
          currentMission = mission;
          document.getElementById('mission').textContent = `${mission.name} — ЧАСТЬ ${mission.level}`;
          document.getElementById('start-screen').style.display = 'none';
          document.getElementById('end-screen').style.display = 'none';
          buildMissionForGuest(data.m);
          mpGuestWorldReady = true;
          resetStats();
        }
      } else if (data.t === 's') {
        applySnapshot(data);
      }
    });
    mpConn.on('close', () => {
      log('Хост отключился', 'warn');
      if (!gameOverFlag) gameOver(false, 'Хост отключился');
    });
    mpConn.on('error', () => setMpStatus('Ошибка соединения', 'err'));
  });
  mpPeer.on('error', err => {
    if (err.type === 'peer-unavailable') setMpStatus('Комната не найдена', 'err');
    else setMpStatus('Ошибка: ' + err.type, 'err');
  });
}
function sendSnapshot() {
  if (!mpConn || !mpConn.open || mpMode !== 'host') return;
  const snap = {
    t: 's',
    p: [Math.round(player.x), Math.round(player.y), +player.angle.toFixed(2), Math.round(player.hp), player.weapon],
    rp: mpRemotePlayer ? [Math.round(mpRemotePlayer.x), Math.round(mpRemotePlayer.y), +mpRemotePlayer.angle.toFixed(2), Math.round(mpRemotePlayer.hp)] : null,
    en: enemies.filter(e => e.alive).map(e => [Math.round(e.x), Math.round(e.y), +e.angle.toFixed(2), Math.round(e.hp), e.type, e.alertLevel > 40 ? 1 : 0]),
    bu: bullets.map(b => [Math.round(b.x), Math.round(b.y), Math.round(b.vx), Math.round(b.vy), b.owner[0]]),
    fi: fires.map(f => [Math.round(f.x), Math.round(f.y), f.radius]),
    hz: hazards.map(h => {
      if (h.type === 'darkness' || h.type === 'fog') return [h.type, 0, 0, 0, 0, h.duration, 0];
      if (h.type === 'marker') return ['m', Math.round(h.x), Math.round(h.y), h.radius, 0, 0, h.isExploded ? 1 : 0];
      if (h.type === 'gas') return ['g', Math.round(h.x), Math.round(h.y), h.radius, 0, h.duration, 0];
      return [h.type, 0, 0, 0, 0, 0, 0];
    }),
    k: stats.kills, el: enemies.filter(e => e.alive).length,
    wm: waveMode ? 1 : 0, wn: waveNumber, wi: waveInProgress ? 1 : 0, wt: Math.round(waveBetweenTimer),
    mt: currentMission ? currentMission.id : null,
    wp: (window.bomb) ? [Math.round(window.bomb.x), Math.round(window.bomb.y)] : null,
    hs: (window.hostage) ? [Math.round(window.hostage.x), Math.round(window.hostage.y)] : null,
    go: gameOverFlag ? 1 : 0,
  };
  try { mpConn.send(snap); } catch(e) {}
}
function sendInput() {
  if (!mpConn || !mpConn.open || mpMode !== 'guest') return;
  let ix = 0, iy = 0;
  if (moveInput.active) { ix += moveInput.x; iy += moveInput.y; }
  if (keys['KeyD'] || keys['ArrowRight']) ix += 1;
  if (keys['KeyA'] || keys['ArrowLeft'])  ix -= 1;
  if (keys['KeyS'] || keys['ArrowDown'])  iy += 1;
  if (keys['KeyW'] || keys['ArrowUp'])    iy -= 1;
  try { mpConn.send({ t: 'in', x: +ix.toFixed(2), y: +iy.toFixed(2), a: +player.angle.toFixed(2), f: player.firing, w: player.weapon }); } catch(e) {}
}
function applySnapshot(snap) {
  if (!snap) return;
  if (snap.go && !gameOverFlag) { gameOver(false, 'Хост погиб'); return; }
  if (mpRemotePlayer && snap.p) {
    mpRemotePlayer._tx = snap.p[0]; mpRemotePlayer._ty = snap.p[1];
    mpRemotePlayer._tangle = snap.p[2]; mpRemotePlayer.hp = snap.p[3];
    mpRemotePlayer.maxHp = player.maxHp; mpRemotePlayer.weapon = snap.p[4];
  }
  if (snap.rp) {
    const dx = snap.rp[0] - player.x, dy = snap.rp[1] - player.y;
    const distSq = dx*dx + dy*dy;
    if (distSq > 6400) { player.x = snap.rp[0]; player.y = snap.rp[1]; }
    else if (distSq > 144) { player.x += dx * 0.25; player.y += dy * 0.25; }
    player.hp = snap.rp[3];
  }
  enemies.length = 0;
  for (const e of (snap.en || [])) {
    const type = e[4]; const tdef = ENEMY_TYPES[type] || ENEMY_TYPES.grunt;
    enemies.push({ x: e[0], y: e[1], angle: e[2], hp: e[3], maxHp: tdef.hp, type, alive: true, radius: tdef.size, body: tdef.body, outline: tdef.outline, skin: tdef.skin, alertLevel: e[5] ? 60 : 0, burning: 0, losCache: false, patrolCenter: { x: e[0], y: e[1] } });
  }
  bullets.length = 0;
  for (const b of (snap.bu || [])) {
    const oc = b[4];
    const owner = oc === 'p' ? 'player' : (oc === 'g' ? 'guest' : (oc === 'e' ? 'enemy' : 'squad'));
    const col = owner === 'player' ? '#d0b070' : (owner === 'guest' ? '#b06040' : (owner === 'enemy' ? '#c05070' : '#4a7a4a'));
    bullets.push({ x: b[0], y: b[1], vx: b[2], vy: b[3], color: col, owner });
  }
  fires.length = 0;
  for (const f of (snap.fi || [])) fires.push({ x: f[0], y: f[1], radius: f[2], born: gameTime, duration: 9000 });
  hazards.length = 0;
  for (const h of (snap.hz || [])) {
    if (h[0] === 'm') hazards.push({ type:'marker', x: h[1], y: h[2], radius: h[3], born: gameTime, warnDur: 900, isExploded: !!h[6] });
    else if (h[0] === 'g') hazards.push({ type:'gas', x: h[1], y: h[2], radius: h[3], born: gameTime, duration: h[5] });
    else if (h[0] === 'darkness') hazards.push({ type:'darkness', born: gameTime, duration: h[5] });
    else if (h[0] === 'fog') hazards.push({ type:'fog', born: gameTime, duration: h[5] });
  }
  if (snap.wp) window.bomb = { x: snap.wp[0], y: snap.wp[1], radius: 15 }; else window.bomb = null;
  if (snap.hs) window.hostage = { x: snap.hs[0], y: snap.hs[1], radius: 14 }; else window.hostage = null;
  stats.kills = snap.k;
  document.getElementById('enemies-left').textContent = snap.el;
  waveMode = !!snap.wm; waveNumber = snap.wn; waveInProgress = !!snap.wi; waveBetweenTimer = snap.wt || 0;
  updateHUD();
}
function updateMpRemotePlayerOnHost(dt) {
  if (!mpRemotePlayer || mpMode !== 'host') return;
  const rp = mpRemotePlayer;
  let mx = mpRemoteInput.x, my = mpRemoteInput.y;
  const len = Math.hypot(mx, my);
  if (len > 0.08) {
    const nx = mx / len, ny = my / len;
    const step = player.speed * dt;
    if (!collides(rp.x + nx*step, rp.y, rp.radius)) rp.x += nx*step;
    if (!collides(rp.x, rp.y + ny*step, rp.radius)) rp.y += ny*step;
  }
  rp.x = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, rp.x));
  rp.y = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, rp.y));
  rp.angle = mpRemoteInput.angle; rp.weapon = mpRemoteInput.weapon || 0;
  if (mpRemoteInput.firing && rp.hp > 0) {
    const w = WEAPONS[rp.weapon] || WEAPONS[0];
    const now = gameTime;
    if (now - rp.lastShot >= w.fireRate) {
      rp.lastShot = now;
      const pellets = w.pellets || 1;
      for (let i = 0; i < pellets; i++) {
        const a = rp.angle + (Math.random() - 0.5) * w.spread * 2;
        bullets.push({ x: rp.x + Math.cos(rp.angle) * (rp.radius + 4), y: rp.y + Math.sin(rp.angle) * (rp.radius + 4), vx: Math.cos(a) * w.bulletSpeed, vy: Math.sin(a) * w.bulletSpeed, dmg: w.dmg, owner: 'guest', color: '#b06040', traveled: 0, maxDist: w.range });
      }
      alertEnemiesAround(rp.x, rp.y, 620, rp.x, rp.y);
    }
  }
}
function updateMpRemotePlayerOnGuest(dt) {
  if (!mpRemotePlayer || mpMode !== 'guest') return;
  const k = 1 - Math.pow(0.0001, dt);
  mpRemotePlayer.x += (mpRemotePlayer._tx - mpRemotePlayer.x) * k;
  mpRemotePlayer.y += (mpRemotePlayer._ty - mpRemotePlayer.y) * k;
  mpRemotePlayer.angle += angleDiff(mpRemotePlayer._tangle, mpRemotePlayer.angle) * k;
}
document.getElementById('mp-host-btn').addEventListener('click', startHosting);
document.getElementById('mp-join-btn').addEventListener('click', startJoining);
document.getElementById('mp-connect-btn').addEventListener('click', connectToHost);
document.getElementById('mp-back-btn').addEventListener('click', () => {
  closeMpLobby();
  if (mpPeer) { try { mpPeer.destroy(); } catch(e){} mpPeer = null; mpConn = null; mpMode = 'single'; }
});
document.getElementById('mp-code-input').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''); });
document.getElementById('mp-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') connectToHost(); });

// ============================================================
//  AIR MODE
// ============================================================
function activateAirMode() {
  if (airMode) return;
  pendingAirstrike = null;
  document.getElementById('want-plane-btn').classList.remove('active');
  airMode = true;
  airModeTimer = 7000;
  airPlane.x = player.x; airPlane.y = player.y - 200;
  airPlane.angle = -Math.PI/2; airPlane.speed = 380;
  airBombs = []; airBombsRemaining = 5; airDropCooldown = 0;
  document.getElementById('air-hud').classList.add('active');
  document.getElementById('air-bombs-count').textContent = airBombsRemaining;
  document.getElementById('event-banner').classList.remove('active');
  playPlaneEngine();
  log('✈ ВЫ УПРАВЛЯЕТЕ САМОЛЁТОМ!', 'good');
}
function dropBomb() {
  if (!airMode || airBombsRemaining <= 0 || airDropCooldown > 0) return;
  airDropCooldown = 300;
  airBombsRemaining--;
  document.getElementById('air-bombs-count').textContent = airBombsRemaining;
  const dropX = airPlane.x + Math.cos(airPlane.angle) * 60;
  const dropY = airPlane.y + Math.sin(airPlane.angle) * 60;
  airBombs.push({ x: dropX, y: dropY, born: performance.now() });
  log('💣 Бомба сброшена!', 'warn');
  playBombWhistle();
}
function updateAirMode(dt) {
  if (!airMode) return;
  airModeTimer -= dt * 1000;
  airDropCooldown -= dt * 1000;
  const steer = moveInput.active ? moveInput.x : 0;
  const throttle = moveInput.active ? moveInput.y : 0;
  airPlane.angle += steer * 2.2 * dt;
  airPlane.speed = Math.max(180, Math.min(500, 300 + throttle * 180));
  airPlane.x += Math.cos(airPlane.angle) * airPlane.speed * dt;
  airPlane.y += Math.sin(airPlane.angle) * airPlane.speed * dt;
  const wb = worldBounds; const margin = 150;
  if (airPlane.x < wb.minX + margin) { airPlane.x = wb.minX + margin; airPlane.angle = -airPlane.angle + Math.PI; }
  if (airPlane.x > wb.maxX - margin) { airPlane.x = wb.maxX - margin; airPlane.angle = -airPlane.angle + Math.PI; }
  if (airPlane.y < wb.minY + margin) { airPlane.y = wb.minY + margin; airPlane.angle = -airPlane.angle; }
  if (airPlane.y > wb.maxY - margin) { airPlane.y = wb.maxY - margin; airPlane.angle = -airPlane.angle; }
  document.getElementById('air-timer').textContent = `✈ ${Math.max(0, (airModeTimer/1000)).toFixed(1)}`;
  if (airModeTimer <= 0) endAirMode();
}
function endAirMode() {
  airMode = false;
  document.getElementById('air-hud').classList.remove('active');
  for (let i = 0; i < airBombs.length; i++) {
    const b = airBombs[i];
    hazards.push({ type:'marker', x: b.x, y: b.y, radius: 180, born: gameTime + i * 250, warnDur: 1400, isExploded: false, damage: 200 });
  }
  log(`✈ ВЫПОЛНЕНО: ${airBombs.length} бомб летят к цели!`, 'good');
  airBombs = [];
}

// ============================================================
//  RENDER
// ============================================================
function renderFloor(camX, camY) {
  const themes = {
    industrial: { bg:'#1e2024', grid:'rgba(90,100,110,0.14)', accent:'rgba(120,110,80,0.10)' },
    office:     { bg:'#20222a', grid:'rgba(100,110,130,0.14)', accent:'rgba(140,110,80,0.10)' },
    concrete:   { bg:'#1a1c1e', grid:'rgba(100,100,110,0.14)', accent:'rgba(140,110,90,0.10)' },
    dirt:       { bg:'#221e18', grid:'rgba(120,100,80,0.14)',  accent:'rgba(160,120,80,0.10)' },
    hotel:      { bg:'#22201e', grid:'rgba(120,100,90,0.14)',  accent:'rgba(150,110,90,0.10)' },
  };
  const t = themes[currentTheme] || themes.industrial;
  ctx.fillStyle = t.bg; ctx.fillRect(0, 0, VW, VH);
  const g = UNIT;
  const cx = VW/2, cy = VH/2;
  const startI = Math.floor((camX - cx)/g) - 1;
  const startJ = Math.floor((camY - cy)/g) - 1;
  const endI = startI + Math.ceil(VW/g) + 3;
  const endJ = startJ + Math.ceil(VH/g) + 3;
  ctx.strokeStyle = t.grid; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = startI; i <= endI; i++) { const sx = i*g - camX + cx; ctx.moveTo(sx, 0); ctx.lineTo(sx, VH); }
  for (let j = startJ; j <= endJ; j++) { const sy = j*g - camY + cy; ctx.moveTo(0, sy); ctx.lineTo(VW, sy); }
  ctx.stroke();
  ctx.strokeStyle = t.accent; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = startI; i <= endI; i += 4) { const sx = i*g - camX + cx; ctx.moveTo(sx, 0); ctx.lineTo(sx, VH); }
  for (let j = startJ; j <= endJ; j += 4) { const sy = j*g - camY + cy; ctx.moveTo(0, sy); ctx.lineTo(VW, sy); }
  ctx.stroke();
}
function drawWall(w, camX, camY) {
  const cx = VW/2, cy = VH/2;
  const sx = w.x - camX + cx, sy = w.y - camY + cy;
  if (sx + w.w < -20 || sx > VW + 20 || sy + w.h < -20 || sy > VH + 20) return;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(sx + 4, sy + 4, w.w, w.h);
  ctx.fillStyle = MIL.wall; ctx.fillRect(sx, sy, w.w, w.h);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  const brickH = 12;
  for (let y = sy + brickH; y < sy + w.h; y += brickH) ctx.fillRect(sx, y, w.w, 1);
  ctx.fillStyle = MIL.wallEdge; ctx.fillRect(sx, sy, w.w, 1.5);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(sx, sy + w.h - 1.5, w.w, 1.5);
  ctx.strokeStyle = MIL.wallDark; ctx.lineWidth = 1;
  ctx.strokeRect(sx + 0.5, sy + 0.5, w.w - 1, w.h - 1);
}
function drawDestructible(d, camX, camY) {
  if (d.state >= 2) return;
  const cx = VW/2, cy = VH/2;
  const sx = d.x - camX + cx, sy = d.y - camY + cy;
  if (sx + d.w < -20 || sx > VW + 20 || sy + d.h < -20 || sy > VH + 20) return;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(sx + 4, sy + 4, d.w, d.h);
  ctx.fillStyle = d.state === 0 ? MIL.destruct : '#5a4a3a'; ctx.fillRect(sx, sy, d.w, d.h);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  const brickH = 12;
  for (let y = sy + brickH; y < sy + d.h; y += brickH) ctx.fillRect(sx, y, d.w, 1);
  const seed = Math.abs(d.x * 13 + d.y * 71 + d.w * 3) | 0;
  const rand = mulberry32(seed);
  const crackCount = d.state === 0 ? 3 : 7;
  ctx.strokeStyle = d.state === 0 ? 'rgba(20,10,0,0.6)' : 'rgba(0,0,0,0.9)';
  ctx.lineWidth = d.state === 0 ? 2 : 3.5;
  ctx.beginPath();
  for (let i = 0; i < crackCount; i++) {
    let px = sx + rand() * d.w, py = sy + rand() * d.h;
    ctx.moveTo(px, py);
    const segs = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < segs; j++) { px += (rand() - 0.5) * 28; py += (rand() - 0.5) * 28; ctx.lineTo(px, py); }
  }
  ctx.stroke();
  ctx.strokeStyle = d.state === 0 ? 'rgba(200,100,40,0.35)' : 'rgba(220,120,50,0.65)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const rand2 = mulberry32(seed + 7);
  for (let i = 0; i < crackCount; i++) {
    let px = sx + rand2() * d.w - 1, py = sy + rand2() * d.h - 1;
    ctx.moveTo(px, py);
    const segs = 3 + Math.floor(rand2() * 3);
    for (let j = 0; j < segs; j++) { px += (rand2() - 0.5) * 28; py += (rand2() - 0.5) * 28; ctx.lineTo(px, py); }
  }
  ctx.stroke();
  if (d.state === 1) {
    ctx.strokeStyle = 'rgba(200,120,40,0.55)'; ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]); ctx.strokeRect(sx + 3, sy + 3, d.w - 6, d.h - 6); ctx.setLineDash([]);
  }
  ctx.fillStyle = d.state === 0 ? 'rgba(200,170,120,0.4)' : 'rgba(220,140,70,0.6)';
  ctx.fillRect(sx, sy, d.w, 1.5);
  ctx.strokeStyle = d.state === 0 ? '#8a7a5a' : '#a07040';
  ctx.lineWidth = d.state === 0 ? 1.5 : 2;
  ctx.strokeRect(sx + 0.5, sy + 0.5, d.w - 1, d.h - 1);
}
function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function drawObstacle(o, camX, camY) {
  const cx = VW/2, cy = VH/2;
  const sx = o.x - camX + cx, sy = o.y - camY + cy;
  if (sx + o.w < -20 || sx > VW + 20 || sy + o.h < -20 || sy > VH + 20) return;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(sx + 3, sy + 3, o.w, o.h);
  ctx.fillStyle = '#3a4048'; ctx.fillRect(sx, sy, o.w, o.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(sx + 2, sy + 2, o.w - 4, o.h - 4);
  ctx.fillStyle = 'rgba(160,170,180,0.25)'; ctx.fillRect(sx, sy, o.w, 1.5);
  ctx.strokeStyle = '#5a6068'; ctx.lineWidth = 1.5; ctx.strokeRect(sx + 0.5, sy + 0.5, o.w - 1, o.h - 1);
}
function drawFurniture(f, camX, camY) {
  if (f.destroyed) return;
  const cx = VW/2, cy = VH/2;
  const sx = f.x - camX + cx, sy = f.y - camY + cy;
  if (sx + f.w < -30 || sx > VW + 30 || sy + f.h < -30 || sy > VH + 30) return;
  const hpRatio = f.hp / f.maxHp;
  const damaged = hpRatio < 0.99;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(sx + 2, sy + 3, f.w, f.h);
  ctx.fillStyle = f.color; ctx.fillRect(sx, sy, f.w, f.h);
  if (f.type === 'bed') {
    ctx.fillStyle = '#e8e0d0'; ctx.fillRect(sx + f.w * 0.15, sy + f.h * 0.05, f.w * 0.7, f.h * 0.15);
    ctx.fillStyle = f.accent; ctx.fillRect(sx + 2, sy + f.h * 0.25, f.w - 4, f.h * 0.7);
  } else if (f.type === 'desk' || f.type === 'table') {
    ctx.fillStyle = f.accent; ctx.fillRect(sx + 3, sy + 3, f.w - 6, f.h - 6);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(sx + 3, sy + f.h/2 - 1, f.w - 6, 2);
  } else if (f.type === 'chair') { ctx.fillStyle = f.accent; ctx.fillRect(sx + 3, sy + 3, f.w - 6, f.h - 6); }
  else if (f.type === 'shelf' || f.type === 'locker') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    for (let i = 1; i < 4; i++) { const y = sy + (f.h / 4) * i; ctx.fillRect(sx + 2, y, f.w - 4, 1.5); }
    ctx.strokeStyle = f.accent; ctx.lineWidth = 1; ctx.strokeRect(sx + 1.5, sy + 1.5, f.w - 3, f.h - 3);
  } else if (f.type === 'sofa') {
    ctx.fillStyle = f.accent;
    const seg = f.w / 3;
    for (let i = 1; i < 3; i++) ctx.fillRect(sx + seg * i - 1, sy + 2, 2, f.h - 4);
  } else if (f.type === 'tv') {
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(sx + 3, sy + 3, f.w - 6, f.h - 6);
    ctx.fillStyle = f.accent; ctx.fillRect(sx + 5, sy + 5, f.w - 10, f.h - 10);
  } else if (f.type === 'crate') {
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx + 2, sy + 2); ctx.lineTo(sx + f.w - 2, sy + f.h - 2);
    ctx.moveTo(sx + f.w - 2, sy + 2); ctx.lineTo(sx + 2, sy + f.h - 2);
    ctx.stroke();
  } else if (f.type === 'barrel') {
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(sx + f.w/2, sy + f.h/2, f.w*0.35, 0, Math.PI*2); ctx.stroke();
  }
  if (damaged) { ctx.fillStyle = `rgba(120,20,20,${(1 - hpRatio) * 0.35})`; ctx.fillRect(sx, sy, f.w, f.h); }
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(sx + 0.5, sy + 0.5, f.w - 1, f.h - 1);
}
function drawPerson(sx, sy, radius, angle, bodyColor, outlineColor, skinColor, isPlayer) {
  const ax = Math.cos(angle), ay = Math.sin(angle);
  const px = -ay, py = ax;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.ellipse(sx, sy + 4, radius * 1.15, radius * 0.55, 0, 0, Math.PI*2); ctx.fill();
  const legOffset = radius * 0.5;
  ctx.fillStyle = '#1a1a20';
  ctx.beginPath(); ctx.ellipse(sx - ax * radius * 0.3 + px * legOffset, sy - ay * radius * 0.3 + py * legOffset, radius * 0.28, radius * 0.38, angle, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(sx - ax * radius * 0.3 - px * legOffset, sy - ay * radius * 0.3 - py * legOffset, radius * 0.28, radius * 0.38, angle, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = bodyColor;
  ctx.beginPath(); ctx.ellipse(sx, sy, radius * 0.9, radius * 0.75, angle, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = outlineColor; ctx.lineWidth = 2; ctx.stroke();
  const armOffset = radius * 0.85, armFwd = radius * 0.35;
  ctx.fillStyle = bodyColor; ctx.strokeStyle = outlineColor; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(sx + ax * armFwd + px * armOffset, sy + ay * armFwd + py * armOffset, radius * 0.22, radius * 0.4, angle, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(sx + ax * armFwd - px * armOffset, sy + ay * armFwd - py * armOffset, radius * 0.22, radius * 0.4, angle, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = skinColor;
  ctx.beginPath(); ctx.arc(sx, sy - ax * radius * 0.15, radius * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = outlineColor; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = '#1a1a20'; ctx.lineWidth = radius * 0.32; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx + ax * radius * 0.3, sy + ay * radius * 0.3);
  ctx.lineTo(sx + ax * (radius * 0.4 + 12), sy + ay * (radius * 0.4 + 12));
  ctx.stroke();
  ctx.lineCap = 'butt';
}
function drawEntity(e, camX, camY, bodyColor, outlineColor, skinColor, isPlayer) {
  const cx = VW/2, cy = VH/2;
  const sx = e.x - camX + cx, sy = e.y - camY + cy;
  if (sx < -50 || sx > VW + 50 || sy < -50 || sy > VH + 50) return;
  if (e.burning > 0) {
    const t = gameTime * 0.01;
    for (let i = 0; i < 4; i++) {
      const a = i * 1.57 + t;
      const r = e.radius * 1.15;
      ctx.fillStyle = `rgba(255, 140, 40, 0.55)`;
      ctx.beginPath(); ctx.arc(sx + Math.cos(a)*r*0.7, sy + Math.sin(a)*r*0.7 - 3, 5, 0, Math.PI*2); ctx.fill();
    }
  }
  drawPerson(sx, sy, e.radius, e.angle, bodyColor, outlineColor, skinColor, isPlayer);
  if (!isPlayer && e.hp < e.maxHp) {
    const bw = 28, bh = 3;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(sx - bw/2, sy - e.radius - 14, bw, bh);
    const ratio = e.hp/e.maxHp;
    ctx.fillStyle = ratio > 0.5 ? '#5a9a4a' : (ratio > 0.25 ? '#c8a850' : '#c05050');
    ctx.fillRect(sx - bw/2, sy - e.radius - 14, bw*ratio, bh);
  }
  if (!isPlayer && ENEMY_TYPES[e.type]) {
    ctx.fillStyle = ENEMY_TYPES[e.type].body; ctx.font = 'bold 8px Arial'; ctx.textAlign = 'center';
    const label = ENEMY_TYPES[e.type].name.substring(0, 2);
    ctx.fillText(label, sx, sy - e.radius - 18);
  }
  if (!isPlayer && e.alertLevel !== undefined && e.alertLevel > 40) {
    ctx.fillStyle = e.alertLevel > 75 ? '#c05050' : '#c8a850';
    ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
    ctx.fillText('!', sx + e.radius + 6, sy - e.radius - 2);
  }
}
function drawMarker(x, y, camX, camY, color, label) {
  const cx = VW/2, cy = VH/2;
  const sx = x - camX + cx, sy = y - camY + cy;
  if (sx < -80 || sx > VW + 80 || sy < -80 || sy > VH + 80) return;
  const pulse = 1 + Math.sin(gameTime * 0.005) * 0.15;
  ctx.fillStyle = color + '30';
  ctx.beginPath(); ctx.arc(sx, sy, 26*pulse, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(sx, sy, 17*pulse, 0, Math.PI*2); ctx.stroke();
  ctx.fillStyle = color; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
  ctx.fillText(label, sx, sy - 30);
}
function drawMolotov(m, camX, camY) {
  const cx = VW/2, cy = VH/2;
  const sx = m.x - camX + cx, sy = m.y - camY + cy;
  const screenY = sy - m.h;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.ellipse(sx, sy, 5, 3, 0, 0, Math.PI*2); ctx.fill();
  if (m.waiting || m.vh < -50) {
    ctx.strokeStyle = `rgba(255, 180, 80, ${m.waiting ? 0.5 : 0.9})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx, screenY); ctx.lineTo(sx, screenY - 40); ctx.stroke();
  }
  for (let i = 1; i <= 3; i++) {
    ctx.fillStyle = `rgba(255, ${180 - i*20}, 60, ${0.6 - i*0.15})`;
    ctx.beginPath(); ctx.arc(sx - m.vx * 0.008 * i, screenY - m.vy * 0.008 * i + m.vh * 0.005 * i, 5 - i, 0, Math.PI*2); ctx.fill();
  }
  ctx.fillStyle = '#8a3818';
  ctx.beginPath(); ctx.arc(sx, screenY, 6, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ffd060';
  ctx.beginPath(); ctx.arc(sx, screenY - 5, 4, 0, Math.PI*2); ctx.fill();
}
function drawFire(f, camX, camY) {
  const cx = VW/2, cy = VH/2;
  const sx = f.x - camX + cx, sy = f.y - camY + cy;
  if (sx < -200 || sx > VW + 200 || sy < -200 || sy > VH + 200) return;
  const age = (gameTime - f.born) / f.duration;
  const intensity = age < 0.85 ? 1 : Math.max(0, 1 - (age - 0.85) / 0.15);
  const t = gameTime * 0.008;
  const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, f.radius);
  grad.addColorStop(0, `rgba(255, 180, 60, ${0.45 * intensity})`);
  grad.addColorStop(0.5, `rgba(220, 90, 20, ${0.3 * intensity})`);
  grad.addColorStop(1, 'rgba(60, 20, 0, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(sx, sy, f.radius, 0, Math.PI*2); ctx.fill();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + t * 0.6;
    const r = f.radius * 0.5 + Math.sin(t + i) * 4;
    const px = sx + Math.cos(a) * r, py = sy + Math.sin(a) * r;
    const flick = 1 + Math.sin(t * 3 + i * 1.7) * 0.3;
    const size = 7 * flick;
    ctx.fillStyle = `rgba(255, 100, 20, ${0.7 * intensity})`;
    ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = `rgba(255, 210, 80, ${0.9 * intensity})`;
    ctx.beginPath(); ctx.arc(px, py - 2, size * 0.45, 0, Math.PI*2); ctx.fill();
  }
}
function drawMedkit(m, camX, camY) {
  const cx = VW/2, cy = VH/2;
  const sx = m.x - camX + cx, sy = m.y - camY + cy;
  if (sx < -40 || sx > VW + 40 || sy < -40 || sy > VH + 40) return;
  const bob = Math.sin(gameTime * 0.005) * 2;
  ctx.fillStyle = 'rgba(100, 200, 120, 0.2)';
  ctx.beginPath(); ctx.arc(sx, sy + bob, 18, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#f0f0f0'; ctx.fillRect(sx - 12, sy - 12 + bob, 24, 24);
  ctx.strokeStyle = '#808080'; ctx.lineWidth = 1.5; ctx.strokeRect(sx - 12, sy - 12 + bob, 24, 24);
  ctx.fillStyle = '#c04040';
  ctx.fillRect(sx - 2, sy - 8 + bob, 4, 16);
  ctx.fillRect(sx - 8, sy - 2 + bob, 16, 4);
}
function drawHazards(camX, camY) {
  const cx = VW/2, cy = VH/2;
  for (const h of hazards) {
    if (h.type === 'marker') {
      const sx = h.x - camX + cx, sy = h.y - camY + cy;
      const t = (gameTime - h.born) / h.warnDur;
      if (t < 0) continue;
      if (!h.isExploded) {
        const flash = Math.sin(gameTime * 0.02) > 0 ? 1 : 0.4;
        ctx.strokeStyle = `rgba(200, 60, 60, ${flash})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(sx, sy, h.radius, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle = `rgba(200, 40, 40, ${0.12 * flash})`;
        ctx.beginPath(); ctx.arc(sx, sy, h.radius, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = `rgba(220, 180, 90, ${flash})`; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx - 18, sy); ctx.lineTo(sx + 18, sy);
        ctx.moveTo(sx, sy - 18); ctx.lineTo(sx, sy + 18);
        ctx.stroke();
      }
    } else if (h.type === 'gas') {
      if (gameTime < h.born) continue;
      const sx = h.x - camX + cx, sy = h.y - camY + cy;
      const age = gameTime - h.born;
      const fade = Math.min(1, age / 800) * Math.max(0, 1 - (age - (h.duration - 1500)) / 1500);
      if (fade <= 0) continue;
      const t = gameTime * 0.003;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t;
        const r = h.radius * 0.6;
        ctx.fillStyle = `rgba(120, 180, 80, ${0.3 * fade})`;
        ctx.beginPath(); ctx.arc(sx + Math.cos(a) * r, sy + Math.sin(a) * r, 35, 0, Math.PI*2); ctx.fill();
      }
    }
  }
}
function renderAirMode() {
  const wb = worldBounds;
  const viewW = wb.maxX - wb.minX, viewH = wb.maxY - wb.minY;
  const scale = Math.min(VW / viewW, VH / viewH);
  const offX = (VW - viewW * scale) / 2 - wb.minX * scale;
  const offY = (VH - viewH * scale) / 2 - wb.minY * scale;
  const toScreen = (x, y) => ({ x: x * scale + offX, y: y * scale + offY });
  ctx.fillStyle = '#0a0c10'; ctx.fillRect(0, 0, VW, VH);
  ctx.strokeStyle = 'rgba(80,100,120,0.15)'; ctx.lineWidth = 1;
  ctx.beginPath();
  const gs = 240;
  for (let x = Math.floor(wb.minX/gs)*gs; x < wb.maxX; x += gs) { const p = toScreen(x, 0); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, VH); }
  for (let y = Math.floor(wb.minY/gs)*gs; y < wb.maxY; y += gs) { const p = toScreen(0, y); ctx.moveTo(0, p.y); ctx.lineTo(VW, p.y); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(90,90,100,0.6)';
  for (const w of WORLD.walls) { const p = toScreen(w.x, w.y); ctx.fillRect(p.x, p.y, Math.max(w.w * scale, 1), Math.max(w.h * scale, 1)); }
  ctx.fillStyle = 'rgba(180,120,60,0.5)';
  for (const d of WORLD.destructibles) { if (d.state >= 2) continue; const p = toScreen(d.x, d.y); ctx.fillRect(p.x, p.y, Math.max(d.w * scale, 1), Math.max(d.h * scale, 1)); }
  ctx.fillStyle = 'rgba(140,100,70,0.5)';
  for (const f of WORLD.furniture) { if (f.destroyed) continue; const p = toScreen(f.x, f.y); ctx.fillRect(p.x, p.y, Math.max(f.w * scale, 1), Math.max(f.h * scale, 1)); }
  for (const e of enemies) if (e.alive) { const p = toScreen(e.x, e.y); ctx.fillStyle = ENEMY_TYPES[e.type].body; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill(); }
  for (const s of squad) if (s.alive) { const p = toScreen(s.x, s.y); ctx.fillStyle = MIL.ally; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill(); }
  const pp = toScreen(player.x, player.y);
  ctx.strokeStyle = MIL.player; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(pp.x, pp.y, 8, 0, Math.PI*2); ctx.stroke();
  ctx.fillStyle = MIL.player; ctx.beginPath(); ctx.arc(pp.x, pp.y, 3, 0, Math.PI*2); ctx.fill();
  for (const b of airBombs) {
    const p = toScreen(b.x, b.y);
    const t = (performance.now() - b.born) / 1000;
    const pulse = 1 + Math.sin(t * 12) * 0.3;
    ctx.strokeStyle = '#c8a850'; ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(p.x, p.y, 20 * pulse, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#c8a850';
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
  }
  const ap = toScreen(airPlane.x, airPlane.y);
  ctx.save();
  ctx.translate(ap.x, ap.y);
  ctx.rotate(airPlane.angle + Math.PI/2);
  ctx.fillStyle = '#9a9aa0';
  ctx.strokeStyle = '#606068'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -20); ctx.lineTo(6, -8); ctx.lineTo(20, 4); ctx.lineTo(20, 9); ctx.lineTo(6, 6); ctx.lineTo(6, 15);
  ctx.lineTo(12, 21); ctx.lineTo(12, 24); ctx.lineTo(-12, 24); ctx.lineTo(-12, 21); ctx.lineTo(-6, 15); ctx.lineTo(-6, 6);
  ctx.lineTo(-20, 9); ctx.lineTo(-20, 4); ctx.lineTo(-6, -8);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8ab8d0';
  ctx.beginPath(); ctx.ellipse(0, -8, 4, 7, 0, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  const targetX = airPlane.x + Math.cos(airPlane.angle) * 60;
  const targetY = airPlane.y + Math.sin(airPlane.angle) * 60;
  const tp = toScreen(targetX, targetY);
  ctx.strokeStyle = '#c05050'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tp.x - 12, tp.y); ctx.lineTo(tp.x - 4, tp.y);
  ctx.moveTo(tp.x + 4, tp.y); ctx.lineTo(tp.x + 12, tp.y);
  ctx.moveTo(tp.x, tp.y - 12); ctx.lineTo(tp.x, tp.y - 4);
  ctx.moveTo(tp.x, tp.y + 4); ctx.lineTo(tp.x, tp.y + 12);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(tp.x, tp.y, 6, 0, Math.PI*2); ctx.stroke();
}
function render() {
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  needsRender = false;
  if (airMode) { renderAirMode(); return; }
  const camX = player.x, camY = player.y;
  const cx = VW/2, cy = VH/2;
  renderFloor(camX, camY);
  for (const bd of bloodDecals) {
    const age = (gameTime - bd.born) / 22000;
    const alpha = Math.max(0, 0.6 * (1 - age * 0.5));
    const sx = bd.x - camX + cx, sy = bd.y - camY + cy;
    ctx.fillStyle = `rgba(100, 15, 15, ${alpha})`;
    for (const s of bd.splats) { ctx.beginPath(); ctx.arc(sx + s.dx, sy + s.dy, s.r, 0, Math.PI*2); ctx.fill(); }
  }
  for (const f of fires) drawFire(f, camX, camY);
  for (const m of medkits) drawMedkit(m, camX, camY);
  for (const o of WORLD.obstacles) drawObstacle(o, camX, camY);
  for (const f of WORLD.furniture) drawFurniture(f, camX, camY);
  for (const w of WORLD.walls) drawWall(w, camX, camY);
  for (const d of WORLD.destructibles) drawDestructible(d, camX, camY);
  if (window.bomb) drawMarker(window.bomb.x, window.bomb.y, camX, camY, '#c05050', 'БОМБА');
  if (window.hostage) drawMarker(window.hostage.x, window.hostage.y, camX, camY, '#c8a850', 'ЗАЛОЖНИК');
  for (const g of grenades) {
    const sx = g.x - camX + cx, sy = g.y - camY + cy;
    const blink = Math.sin(gameTime * 0.02) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(200, ${80 + blink*140}, 60, 1)`;
    ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  for (const b of bullets) {
    const sx = b.x - camX + cx, sy = b.y - camY + cy;
    const tx = sx - b.vx * 0.016, ty = sy - b.vy * 0.016;
    ctx.strokeStyle = b.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
  }
  for (const e of enemies) if (e.alive) {
    const tdef = ENEMY_TYPES[e.type] || ENEMY_TYPES.grunt;
    drawEntity(e, camX, camY, tdef.body, tdef.outline, tdef.skin, false);
  }
  for (const s of squad) if (s.alive) drawEntity(s, camX, camY, MIL.ally, MIL.allyOutline, MIL.skin, false);
  if (mpRemotePlayer) drawEntity(mpRemotePlayer, camX, camY, MIL.guestBody, MIL.guestOutline, MIL.skin, false);
  if (player.alive) {
    const px = player.x - camX + cx, py = player.y - camY + cy;
    const aimLen = 130;
    const grad = ctx.createLinearGradient(px, py, px + Math.cos(player.angle)*aimLen, py + Math.sin(player.angle)*aimLen);
    grad.addColorStop(0, 'rgba(140, 180, 220, 0.65)');
    grad.addColorStop(1, 'rgba(140, 180, 220, 0)');
    ctx.strokeStyle = grad; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(px + Math.cos(player.angle)*(player.radius+6), py + Math.sin(player.angle)*(player.radius+6));
    ctx.lineTo(px + Math.cos(player.angle)*aimLen, py + Math.sin(player.angle)*aimLen);
    ctx.stroke(); ctx.setLineDash([]);
    drawEntity(player, camX, camY, MIL.player, MIL.playerOutline, MIL.skin, true);
  }
  for (const m of molotovs) drawMolotov(m, camX, camY);
  drawHazards(camX, camY);
  for (const f of effects) {
    const sx = f.x - camX + cx, sy = f.y - camY + cy;
    if (f.type === 'flash') { const k = f.life / f.maxLife; ctx.fillStyle = `rgba(255, 220, 120, ${k})`; ctx.beginPath(); ctx.arc(sx, sy, 12*k, 0, Math.PI*2); ctx.fill(); }
    else if (f.type === 'impact') { const k = f.life / f.maxLife; ctx.fillStyle = `rgba(220, 180, 100, ${k})`; ctx.beginPath(); ctx.arc(sx, sy, 5*k, 0, Math.PI*2); ctx.fill(); }
    else if (f.type === 'explosion') { const k = f.life / f.maxLife; const r = f.maxR * (1 - k); ctx.fillStyle = `rgba(220, 100, 30, ${k * 0.5})`; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = `rgba(255, 200, 80, ${k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.stroke(); }
    else if (f.type === 'blood') { const k = f.life / f.maxLife; ctx.fillStyle = `rgba(140, 20, 20, ${k})`; ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI*2); ctx.fill(); }
    else if (f.type === 'fragment') { const k = Math.min(1, f.life / f.maxLife); ctx.save(); ctx.translate(sx, sy); ctx.rotate(f.rot); ctx.globalAlpha = k; ctx.fillStyle = f.color; ctx.fillRect(-f.size/2, -f.size/2, f.size, f.size); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(-f.size/2, -f.size/2, f.size, f.size); ctx.restore(); }
  }
  if (!vignetteGrad) {
    vignetteGrad = ctx.createRadialGradient(cx, cy, Math.min(VW, VH) * 0.4, cx, cy, Math.max(VW, VH) * 0.75);
    vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)'); vignetteGrad.addColorStop(1, 'rgba(0,0,0,0.55)');
  }
  ctx.fillStyle = vignetteGrad; ctx.fillRect(0, 0, VW, VH);
  const darkHaz = hazards.find(h => h.type === 'darkness');
  if (darkHaz) {
    const age = gameTime - darkHaz.born;
    const fade = Math.min(1, age / 500) * Math.max(0, 1 - (age - (darkHaz.duration - 1500)) / 1500);
    ctx.fillStyle = `rgba(0,0,10,${0.6 * fade})`; ctx.fillRect(0, 0, VW, VH);
  }
  const fogHaz = hazards.find(h => h.type === 'fog');
  if (fogHaz) {
    const age = gameTime - fogHaz.born;
    const fade = Math.min(1, age / 800) * Math.max(0, 1 - (age - (fogHaz.duration - 2000)) / 2000);
    ctx.fillStyle = `rgba(140,150,160,${0.4 * fade})`; ctx.fillRect(0, 0, VW, VH);
  }
  if (player.burning > 0) { ctx.fillStyle = `rgba(255, 100, 20, ${0.12 + Math.random() * 0.06})`; ctx.fillRect(0, 0, VW, VH); }
  if (timeScale < 1 && !paused && !airMode) { ctx.fillStyle = `rgba(30, 50, 90, ${0.15 * (1 - timeScale)})`; ctx.fillRect(0, 0, VW, VH); }
  drawMinimap();
  if (waveMode) drawWaveHUD();
}
function drawWaveHUD() {
  const cx = VW/2;
  ctx.fillStyle = 'rgba(15,18,20,0.9)'; ctx.fillRect(cx - 100, 8, 200, 30);
  ctx.strokeStyle = '#c8a850'; ctx.lineWidth = 2; ctx.strokeRect(cx - 100, 8, 200, 30);
  ctx.fillStyle = '#c8a850'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
  const alive = enemies.filter(e => e.alive).length;
  if (waveInProgress) ctx.fillText(`ВОЛНА ${waveNumber}: ${alive} осталось`, cx, 28);
  else if (waveBetweenTimer > 0) ctx.fillText(`ВОЛНА ${waveNumber + 1} через ${Math.ceil(waveBetweenTimer/1000)}с`, cx, 28);
}
function updateHUD() {
  document.getElementById('hp-value').textContent = Math.max(0, Math.floor(player.hp));
  document.getElementById('hp-bar').style.width = Math.max(0, player.hp) + '%';
  document.getElementById('enemies-left').textContent = enemies.filter(e => e.alive).length;
  for (let i = 0; i < WEAPONS.length; i++) {
    const el = document.getElementById('w-ammo-' + i);
    if (el) {
      if (i === player.weapon) el.textContent = `${player.ammo}/${player.reserve}`;
      else el.textContent = `${WEAPONS[i].magSize}/${WEAPONS[i].reserve}`;
    }
  }
  if (mpRemotePlayer) {
    document.getElementById('p2-hp').textContent = Math.max(0, Math.round(mpRemotePlayer.hp));
    document.getElementById('p2-hp-bar').style.width = Math.max(0, mpRemotePlayer.hp) + '%';
  }
}
function updateWeaponSelector() {
  document.querySelectorAll('.wslot').forEach((slot, i) => slot.classList.toggle('active', i === player.weapon));
}
function showHitMarker() { const hm = document.getElementById('hit-marker'); hm.classList.remove('show'); void hm.offsetWidth; hm.classList.add('show'); }
function showDamage() { const d = document.getElementById('damage-overlay'); d.classList.add('show'); clearTimeout(window._dmgTimer); window._dmgTimer = setTimeout(() => d.classList.remove('show'), 200); }
function log(msg, type='') {
  const logDiv = document.getElementById('log');
  const entry = document.createElement('div');
  entry.className = 'entry ' + type;
  entry.textContent = msg;
  logDiv.insertBefore(entry, logDiv.firstChild);
  while (logDiv.children.length > 5) logDiv.removeChild(logDiv.lastChild);
}

function toggleCommandMenu() {
  if (paused || gameOverFlag || airMode) return;
  commandMenuOpen = !commandMenuOpen;
  document.getElementById('command-menu').classList.toggle('active', commandMenuOpen);
  timeScale = commandMenuOpen ? 0.18 : 1;
  if (commandMenuOpen) {
    log('⏱ Время замедлено', 'warn');
    player.firing = false;
    if (tutorialMode && TUTORIAL_STEPS[tutorialStep] && TUTORIAL_STEPS[tutorialStep].id === 'command') tutorialState.commanded = true;
  }
}
function issueCommand(cmd) {
  const alive = squad.filter(s => s.alive);
  if (alive.length === 0) { log('Отряд уничтожен!', 'warn'); toggleCommandMenu(); return; }
  switch (cmd) {
    case 'follow': alive.forEach(s => { s.state = 'follow'; s.targetEnemy = null; }); log('Приказ: Следовать', 'good'); break;
    case 'hold': alive.forEach(s => { s.state = 'hold'; s.holdPos = { x: s.x, y: s.y }; }); log('Приказ: Удерживать', 'good'); break;
    case 'attack': {
      let best = null, bestScore = Infinity;
      for (const e of enemies) {
        if (!e.alive) continue;
        const ddx = e.x - player.x, ddy = e.y - player.y;
        const d = Math.hypot(ddx, ddy);
        if (d > 800) continue;
        const ang = Math.atan2(ddy, ddx);
        const diff = Math.abs(angleDiff(ang, player.angle));
        if (diff < 0.7 && d < bestScore) { bestScore = d; best = e; }
      }
      if (best) { alive.forEach(s => { s.state = 'attack'; s.targetEnemy = best; }); log('Приказ: Атаковать!', 'good'); }
      else log('Цель не найдена', 'warn');
      break;
    }
    case 'cover': alive.forEach(s => { s.state = 'cover'; s.targetEnemy = null; }); log('Приказ: Прикрытие', 'good'); break;
    case 'breach':
      alive.forEach(s => { s.state = 'follow'; s.speed = 420; });
      log('ШТУРМ!', 'good');
      setTimeout(() => alive.forEach(s => s.speed = 220), 2500);
      break;
    case 'defuse':
      if (window.bomb) { const d = Math.hypot(player.x - window.bomb.x, player.y - window.bomb.y); if (d < 100) { log('Бомба обезврежена!', 'good'); window.bomb = null; window.bombDefused = true; checkMissionComplete(); } else log('Подойдите ближе к бомбе', 'warn'); } else log('Бомбы нет', 'warn');
      break;
    case 'rescue':
      if (window.hostage) {
        const d = Math.hypot(player.x - window.hostage.x, player.y - window.hostage.y);
        if (d < 100 && enemies.filter(e => e.alive).length === 0) { log('Заложник спасён!', 'good'); window.hostage = null; window.hostageRescued = true; checkMissionComplete(); }
        else if (d >= 100) log('Подойдите к заложнику', 'warn');
        else log('Сначала устраните врагов!', 'warn');
      } else log('Заложника нет', 'warn');
      break;
    case 'regroup':
      alive.forEach(s => {
        s.state = 'follow';
        const backAng = player.angle + Math.PI + (s.idx - 1) * 0.6;
        const s2 = findFreeSpotNear(player.x + Math.cos(backAng)*65, player.y + Math.sin(backAng)*65, 30, 150);
        s.x = s2.x; s.y = s2.y;
      });
      log('Перегруппировка!', 'good'); break;
  }
  toggleCommandMenu();
}

function updatePauseInfo() {
  const elapsed = getElapsedSeconds();
  const mm = Math.floor(elapsed / 60);
  const ss = Math.floor(elapsed % 60).toString().padStart(2, '0');
  const alive = enemies.filter(e => e.alive).length;
  let html = '';
  if (tutorialMode) html = `<span class="hl-title">🎓 Обучение</span>Шаг: <span class="hl">${tutorialStep + 1} / ${TUTORIAL_STEPS.length}</span><br>Время: <span class="hl">${mm}:${ss}</span>`;
  else if (waveMode) html = `<span class="hl-title">★ Секретный режим: Волны</span>Волна: <span class="hl">${waveNumber}</span> · Врагов: <span class="hl-red">${alive}</span><br>Убийств: <span class="hl">${stats.kills}</span> · Время: <span class="hl">${mm}:${ss}</span>`;
  else if (currentMission) html = `<span class="hl-title">${currentMission.name} — Часть ${currentMission.level}</span>Врагов: <span class="hl-red">${alive}</span> · Убийств: <span class="hl">${stats.kills}</span><br>Время: <span class="hl">${mm}:${ss}</span>`;
  else html = 'Миссия не выбрана';
  document.getElementById('pause-info').innerHTML = html;
}
function restartMission() {
  if (!currentMission) { toMenu(); return; }
  const m = currentMission;
  paused = false; gameOverFlag = false; timeScale = 1; scheduledEvent = null; pendingAirstrike = null;
  document.getElementById('pause-menu').classList.remove('active');
  document.getElementById('log').innerHTML = '';
  if (m.type === 'tutorial') startTutorialMode();
  else if (m.type === 'wave') startWaveMode();
  else startMission(m);
}

function checkMissionComplete() {
  if (!currentMission) return;
  if (currentMission.type === 'wave') return;
  if (tutorialMode) return;
  const alive = enemies.filter(e => e.alive).length;
  if (alive > 0) return;
  if (currentMission.type === 'eliminate') gameOver(true);
  else if (currentMission.type === 'rescue' && window.hostageRescued) gameOver(true);
  else if (currentMission.type === 'defuse' && window.bombDefused) gameOver(true);
  else if (currentMission.type === 'assault') gameOver(true);
  else if (currentMission.type === 'rescue' && window.hostage) log('Все враги устранены — спасите заложника!', 'warn');
  else if (currentMission.type === 'defuse' && window.bomb) log('Все враги устранены — обезвредьте бомбу!', 'warn');
}


function startMission(m) {
  currentMission = m;
  waveMode = false; airMode = false; scheduledEvent = null; pendingAirstrike = null;
  tutorialMode = false;
  initAudio();
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('end-screen').style.display = 'none';
  document.getElementById('mission').textContent = `${m.name} — ЧАСТЬ ${m.level}`;
  const objectives = {
    eliminate: 'Цель: Устранить всех противников',
    rescue: 'Цель: Спасти заложника (не убить!)',
    defuse: 'Цель: Обезвредить бомбу',
    assault: 'Цель: Зачистить все укрепления',
  };
  document.getElementById('objective').textContent = objectives[m.type];
  buildMission(m.id);
  log(`Миссия: ${m.name} — часть ${m.level}`, 'good');
  if (mpMode === 'host' && mpConn && mpConn.open) {
    try { mpConn.send({ t: 'start', m: m.id }); } catch(e){}
  }
}

const UI_EL = {
  start: document.getElementById('start-screen'),
  end: document.getElementById('end-screen'),
  lobby: document.getElementById('mp-lobby'),
};
let lastTime = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const realDt = Math.min((now - lastTime)/1000, 0.05);
  lastTime = now;
  if (airMode) { updateAirMode(realDt); render(); trackFramePerf(realDt * 1000); return; }
  const dt = realDt * timeScale;
  gameTime += dt * 1000;
  const inMenu = UI_EL.start.style.display !== 'none' ||
                 UI_EL.end.style.display === 'flex' ||
                 UI_EL.lobby.classList.contains('active');
  // Под меню, лобби и паузой сцена не меняется: не перерисовываем её 60 раз в секунду (экономия батареи)
  if (inMenu || paused) { if (needsRender) render(); return; }
  trackFramePerf(realDt * 1000);
  if (player.alive && !gameOverFlag) {
    if (mpMode === 'guest') {
      updatePlayer(dt);
      updateMpRemotePlayerOnGuest(dt);
      updateEffects(dt);
    } else {
      updatePlayer(dt);
      if (tutorialMode) updateTutorial(dt);
      if (mpMode === 'host') updateMpRemotePlayerOnHost(dt);
      updateEnemies(dt);
      updateSquad(dt);
      updateBullets(dt);
      updateGrenades(dt);
      updateMolotovs(dt);
      updateFires(dt);
      updateMedkits(dt);
      updateEvents(dt);
      updateEffects(dt);
      updateWaveMode(dt);
      if (player.ammo === 0 && !player.reloading && player.reserve > 0) reload();
    }
  }
  render();
}
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive:false });
document.addEventListener('gesturestart', e => e.preventDefault());

// ============================================================
//  TUTORIAL — рисует табличку подсказок вместо миникарты
// ============================================================
function drawTutorialHintsPanel() {
  const x = 10 + safeLeft, y = 20, w = 230, h = 156;
  ctx.fillStyle = 'rgba(10,12,16,0.93)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#c8a850';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  // Заголовок
  ctx.fillStyle = '#c8a850';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('🗺 ПОДСКАЗКИ', x + 8, y + 16);

  // Разделитель
  ctx.strokeStyle = 'rgba(200,168,80,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 22); ctx.lineTo(x + w - 6, y + 22);
  ctx.stroke();

  // Строки
  const hints = [
    { color: '#3a5a9a', text: 'Вы (синий)' },
    { color: '#4a7a4a', text: 'Союзники (зелёные)' },
    { color: '#a04040', text: 'Враги (красные)' },
    { color: '#5a5a5e', text: 'Стены (неразруш.)' },
    { color: '#7a6a5a', text: 'Разрушаемые стены' },
    { color: '#c87000', text: 'Огонь' },
    { color: '#8ab88a', text: 'Аптечки +30 HP' },
    { color: '#c8a850', text: 'Заложник / Бомба' },
  ];
  let yy = y + 36;
  for (const hint of hints) {
    ctx.fillStyle = hint.color;
    ctx.beginPath();
    ctx.arc(x + 14, yy - 3, 5, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#d0d0d5';
    ctx.font = '10px Arial';
    ctx.fillText(hint.text, x + 26, yy);
    yy += 15;
  }
}

// Заменить старую drawMinimap() — эту функцию целиком
function drawMinimap() {
  // В обучении показываем табличку подсказок
  if (tutorialMode) {
    drawTutorialHintsPanel();
    return;
  }

  // Обычная миникарта
  // На низких экранах (телефон в landscape) миникарта налезала на панель HP
  const mmSize = Math.round(Math.min(136, VH * 0.26)), mmX = 10 + safeLeft, mmY = 20;
  ctx.fillStyle = 'rgba(10, 12, 16, 0.9)';
  ctx.fillRect(mmX, mmY, mmSize, mmSize);
  ctx.strokeStyle = '#6a6a72'; ctx.lineWidth = 2;
  ctx.strokeRect(mmX, mmY, mmSize, mmSize);
  ctx.save();
  ctx.beginPath(); ctx.rect(mmX + 1, mmY + 1, mmSize - 2, mmSize - 2); ctx.clip();
  const wb = worldBounds;
  const worldW = wb.maxX - wb.minX, worldH = wb.maxY - wb.minY;
  const scale = Math.min((mmSize - 6) / worldW, (mmSize - 6) / worldH);
  const padX = (mmSize - worldW * scale) / 2;
  const padY = (mmSize - worldH * scale) / 2;
  const toMM = (wx, wy) => ({ x: mmX + padX + (wx - wb.minX) * scale, y: mmY + padY + (wy - wb.minY) * scale });
  ctx.fillStyle = 'rgba(90,90,100,0.7)';
  for (const w of WORLD.walls) { const p = toMM(w.x, w.y); ctx.fillRect(p.x, p.y, Math.max(w.w * scale, 0.6), Math.max(w.h * scale, 0.6)); }
  for (const d of WORLD.destructibles) {
    if (d.state >= 2) continue;
    const p = toMM(d.x, d.y);
    ctx.fillStyle = d.state === 0 ? 'rgba(180,150,100,0.55)' : 'rgba(200,120,60,0.85)';
    ctx.fillRect(p.x, p.y, Math.max(d.w * scale, 0.6), Math.max(d.h * scale, 0.6));
  }
  for (const f of fires) { const p = toMM(f.x, f.y); ctx.fillStyle = 'rgba(220, 100, 30, 0.75)'; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.5, f.radius * scale * 0.6), 0, Math.PI*2); ctx.fill(); }
  for (const m of medkits) { const p = toMM(m.x, m.y); ctx.fillStyle = '#8ab88a'; ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }
  for (const e of enemies) if (e.alive) { const p = toMM(e.x, e.y); ctx.fillStyle = (ENEMY_TYPES[e.type] || ENEMY_TYPES.grunt).body; ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI*2); ctx.fill(); }
  ctx.fillStyle = MIL.ally;
  for (const s of squad) if (s.alive) { const p = toMM(s.x, s.y); ctx.beginPath(); ctx.arc(p.x, p.y, 1.4, 0, Math.PI*2); ctx.fill(); }
  if (mpRemotePlayer) { const p = toMM(mpRemotePlayer.x, mpRemotePlayer.y); ctx.fillStyle = MIL.guestBody; ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, Math.PI*2); ctx.fill(); }
  if (window.bomb) { const p = toMM(window.bomb.x, window.bomb.y); ctx.fillStyle = '#c05050'; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); }
  if (window.hostage) { const p = toMM(window.hostage.x, window.hostage.y); ctx.fillStyle = '#c8a850'; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); }
  const pp = toMM(player.x, player.y);
  ctx.fillStyle = MIL.player;
  ctx.beginPath(); ctx.arc(pp.x, pp.y, 2.2, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = MIL.player; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pp.x, pp.y);
  ctx.lineTo(pp.x + Math.cos(player.angle) * 6, pp.y + Math.sin(player.angle) * 6);
  ctx.stroke();
  ctx.restore();
}

// ============================================================
//  ГРАНАТА — дальше и с отскоком
// ============================================================
function throwGrenade() {
  if (!player.alive || gameOverFlag) return;
  let gx = player.x + Math.cos(player.angle) * (player.radius + 6);
  let gy = player.y + Math.sin(player.angle) * (player.radius + 6);
  // Если игрок упёрся в стену — граната не должна появиться внутри неё
  if (pointInWalls(gx, gy)) { gx = player.x; gy = player.y; }
  grenades.push({
    x: gx,
    y: gy,
    vx: Math.cos(player.angle) * 720,
    vy: Math.sin(player.angle) * 720,
    fuse: 2200,
    spawnTime: gameTime,
    bounces: 0,
  });
  log('Граната брошена!', 'warn');
  if (tutorialMode && TUTORIAL_STEPS[tutorialStep] && TUTORIAL_STEPS[tutorialStep].id === 'grenade') tutorialState.threwGrenade = true;
}

function updateGrenades(dt) {
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    const nx = g.x + g.vx * dt;
    const ny = g.y + g.vy * dt;

    // Отскок от стен по X
    if (pointInWalls(nx, g.y)) {
      g.vx = -g.vx * 0.65;
      g.vy *= 0.85;
      g.bounces = (g.bounces || 0) + 1;
    } else {
      g.x = nx;
    }
    // Отскок по Y
    if (pointInWalls(g.x, ny)) {
      g.vy = -g.vy * 0.65;
      g.vx *= 0.85;
      g.bounces = (g.bounces || 0) + 1;
    } else {
      g.y = ny;
    }

    // Меньше трение — граната летит дальше
    const damp = Math.pow(0.5, dt);
    g.vx *= damp;
    g.vy *= damp;

    // Стоп если очень медленно
    if (Math.hypot(g.vx, g.vy) < 30) { g.vx *= 0.9; g.vy *= 0.9; }

    if (gameTime - g.spawnTime > g.fuse) {
      explode(g.x, g.y, 200);
      grenades.splice(i, 1);
    }
  }
}

// ============================================================
//  ПУЛИ — лёгкое самонаведение для игрока
// ============================================================
function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];

    // === Самонаведение для пуль игрока ===
    if (b.owner === 'player') {
      const bulletAng = Math.atan2(b.vy, b.vx);
      const speed = Math.hypot(b.vx, b.vy);
      let target = null, bestD = 450;
      for (const e of enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x - b.x, e.y - b.y);
        if (d > bestD) continue;
        const angToE = Math.atan2(e.y - b.y, e.x - b.x);
        if (Math.abs(angleDiff(angToE, bulletAng)) > 0.6) continue;
        bestD = d;
        target = e;
      }
      if (target) {
        const targetAng = Math.atan2(target.y - b.y, target.x - b.x);
        const newAng = bulletAng + angleDiff(targetAng, bulletAng) * Math.min(1, dt * 3.5);
        b.vx = Math.cos(newAng) * speed;
        b.vy = Math.sin(newAng) * speed;
      }
    }

    const stepDist = Math.hypot(b.vx, b.vy) * dt;
    const steps = Math.max(1, Math.ceil(stepDist / 18));
    const subDt = dt / steps;
    let removed = false;
    for (let s = 0; s < steps && !removed; s++) {
      b.x += b.vx * subDt; b.y += b.vy * subDt;
      b.traveled += Math.hypot(b.vx*subDt, b.vy*subDt);
      if (b.traveled > b.maxDist) { bullets.splice(i,1); removed = true; break; }
      if (pointInWalls(b.x, b.y)) {
        damageFurnitureAt(b.x, b.y, b.dmg);
        effects.push({ type:'impact', x:b.x, y:b.y, life:150, maxLife:150 });
        bullets.splice(i,1); removed = true; break;
      }
      if (window.hostage) {
        if (Math.hypot(window.hostage.x - b.x, window.hostage.y - b.y) < window.hostage.radius + 3) {
          log('ЗАЛОЖНИК УБИТ ВЫСТРЕЛОМ!', 'warn');
          window.hostage = null;
          effects.push({ type:'impact', x:b.x, y:b.y, life:150, maxLife:150 });
          bullets.splice(i,1); removed = true;
          gameOver(false, 'Заложник убит');
          return;
        }
      }
      if (b.owner === 'player' || b.owner === 'guest') {
        for (const e of enemies) {
          if (!e.alive) continue;
          if (Math.hypot(e.x-b.x, e.y-b.y) < e.radius + 3) {
            e.hp -= b.dmg; stats.damageDealt += b.dmg;
            e.alertLevel = 100; e.lastSeen = { x: player.x, y: player.y };
            effects.push({ type:'impact', x:b.x, y:b.y, life:150, maxLife:150 });
            if (b.owner === 'player') { showHitMarker(); playHit(); }
            alertEnemiesAround(e.x, e.y, 400, player.x, player.y);
            if (e.hp <= 0) { e.alive = false; stats.kills++; onEnemyKilled(e); log('Противник ликвидирован', 'good'); checkMissionComplete(); }
            bullets.splice(i,1); removed = true; break;
          }
        }
      } else if (b.owner === 'enemy') {
        if (player.alive && Math.hypot(player.x-b.x, player.y-b.y) < player.radius + 3) {
          player.hp -= b.dmg; stats.damageTaken += b.dmg;
          showDamage(); playHurt(); updateHUD();
          if (player.hp <= 0) { player.hp = 0; player.alive = false; gameOver(false, 'Убит в бою'); }
          bullets.splice(i,1); removed = true; break;
        }
        if (!removed && mpMode === 'host' && mpRemotePlayer && mpRemotePlayer.hp > 0) {
          if (Math.hypot(mpRemotePlayer.x-b.x, mpRemotePlayer.y-b.y) < mpRemotePlayer.radius + 3) {
            mpRemotePlayer.hp -= b.dmg;
            if (mpRemotePlayer.hp <= 0) mpRemotePlayer.hp = 0;
            bullets.splice(i,1); removed = true; break;
          }
        }
        if (!removed) {
          for (const sq of squad) {
            if (!sq.alive) continue;
            if (Math.hypot(sq.x-b.x, sq.y-b.y) < sq.radius + 3) {
              sq.hp -= b.dmg;
              if (sq.hp <= 0) { sq.alive = false; log(`${sq.name} погиб`, 'warn'); }
              bullets.splice(i,1); removed = true; break;
            }
          }
        }
      } else if (b.owner === 'squad') {
        for (const e of enemies) {
          if (!e.alive) continue;
          if (Math.hypot(e.x-b.x, e.y-b.y) < e.radius + 3) {
            e.hp -= b.dmg;
            if (e.hp <= 0) { e.alive = false; stats.kills++; onEnemyKilled(e); checkMissionComplete(); }
            bullets.splice(i,1); removed = true; break;
          }
        }
      }
    }
  }
}

// ============================================================
//  GAME OVER — надёжное сохранение
// ============================================================
function gameOver(success, reason, customTitle) {
  if (gameOverFlag) return;
  // Сохраняем id ДО изменения состояния
  const savedMissionId = currentMission ? currentMission.id : null;
  const savedMissionType = currentMission ? currentMission.type : null;

  gameOverFlag = true; timeScale = 1; player.firing = false;
  airMode = false; scheduledEvent = null; pendingAirstrike = null;
  tutorialMode = false;
  hideTutorialHint();
  document.getElementById('air-hud').classList.remove('active');
  fireJoy.charged = false; fireJoy.active = false;
  document.getElementById('fire-joystick').classList.remove('charging', 'charged');

  // СОХРАНЯЕМ ПРОГРЕСС — с явной проверкой
  if (success && savedMissionId && savedMissionType !== 'tutorial' && savedMissionType !== 'wave' && !waveMode) {
    saveProgress(savedMissionId);
  }

  const elapsed = getElapsedSeconds();
  const mm = Math.floor(elapsed / 60);
  const ss = Math.floor(elapsed % 60);
  const timeStr = `${mm}:${ss.toString().padStart(2,'0')}`;
  const endScreen = document.getElementById('end-screen');
  const endTitle = document.getElementById('end-title');
  const endSub = document.getElementById('end-sub');
  const endStats = document.getElementById('end-stats');
  if (success) {
    endTitle.textContent = customTitle ? `🎓 ${customTitle}` : '✓ МИССИЯ ВЫПОЛНЕНА';
    endTitle.style.color = '#8ab88a';
    endSub.textContent = currentMission ? `${currentMission.name}${currentMission.level ? ' — часть ' + currentMission.level : ''}` : '';
  } else {
    if (currentMission && currentMission.type === 'wave') {
      endTitle.textContent = `★ ВОЛНЫ — ДОСТИГНУТА ВОЛНА ${waveNumber} ★`;
      endTitle.style.color = '#c8a850';
      endSub.textContent = 'Вы пали в бою с превосходящими силами';
    } else {
      endTitle.textContent = '✖ МИССИЯ ПРОВАЛЕНА';
      endTitle.style.color = '#c05050';
      endSub.textContent = reason || 'Операция отменена.';
    }
  }
  endStats.innerHTML = `
    <div class="stat-row big"><span class="stat-lbl">⏱ Время</span><span class="stat-val">${timeStr}</span></div>
    <div class="stat-row"><span class="stat-lbl">☠ Убийств</span><span class="stat-val">${stats.kills}</span></div>
    <div class="stat-row"><span class="stat-lbl">🎯 Урон нанесён</span><span class="stat-val">${Math.floor(stats.damageDealt)}</span></div>
    <div class="stat-row"><span class="stat-lbl">💢 Урон получен</span><span class="stat-val">${Math.floor(stats.damageTaken)}</span></div>
    ${waveMode ? `<div class="stat-row"><span class="stat-lbl">🌊 Волна</span><span class="stat-val">${waveNumber}</span></div>` : ''}
  `;
  endScreen.style.display = 'flex';
}

// ============================================================
//  НОВОЕ МЕНЮ — рендер без вкладок (ФИКС КНОПОК)
// ============================================================
const MISSION_GROUPS = [
  { type:'eliminate', icon:'🎯', title:'ЗАЧИСТКА' },
  { type:'rescue',    icon:'🛡', title:'ЗАЛОЖНИК' },
  { type:'defuse',    icon:'💣', title:'БОМБА' },
  { type:'assault',   icon:'⚔', title:'ШТУРМ' },
];

function initMissionSelect() {
  const container = document.getElementById('missions-container');
  if (!container) { console.error('[MENU] missions-container not found'); return; }
  container.innerHTML = '';

  MISSION_GROUPS.forEach(g => {
    const groupMissions = MISSIONS.filter(m => m.type === g.type);
    const wrap = document.createElement('div');
    wrap.className = 'mission-group';

    const header = document.createElement('div');
    header.className = 'group-header';
    header.innerHTML = `<span>${g.icon} ${g.title}</span><span class="gh-count" data-count="${g.type}">0/${groupMissions.length}</span>`;
    wrap.appendChild(header);

    const cardsWrap = document.createElement('div');
    cardsWrap.className = 'group-cards';
    groupMissions.forEach(m => {
      const card = document.createElement('div');
      card.className = 'mc-compact';
      card.dataset.mission = m.id;
      card.innerHTML = `
        <div class="mc-num">${m.level}</div>
        <div class="mc-lbl">ЧАСТЬ ${m.level}</div>
        <div class="mc-enemies">👤 ${m.enemies}</div>
      `;
      card.addEventListener('click', () => startMission(m));
      cardsWrap.appendChild(card);
    });
    wrap.appendChild(cardsWrap);
    container.appendChild(wrap);
  });

  refreshMenuProgress();
}

function refreshMenuProgress() {
  const total = MISSIONS.length;
  const done = countCompleted();
  const progressEl = document.getElementById('menu-progress');
  if (progressEl) progressEl.textContent = `ПРОЙДЕНО: ${done} / ${total}`;

  MISSIONS.forEach(m => {
    const card = document.querySelector(`.mc-compact[data-mission="${m.id}"]`);
    if (!card) return;
    const isDone = hasCompleted(m.id);
    card.classList.toggle('completed', isDone);
    let check = card.querySelector('.mc-check');
    if (isDone && !check) {
      check = document.createElement('span');
      check.className = 'mc-check';
      check.textContent = '✓';
      card.appendChild(check);
    } else if (!isDone && check) {
      check.remove();
    }
  });

  MISSION_GROUPS.forEach(g => {
    const groupMissions = MISSIONS.filter(m => m.type === g.type);
    const doneInGroup = groupMissions.filter(m => hasCompleted(m.id)).length;
    const counter = document.querySelector(`.gh-count[data-count="${g.type}"]`);
    if (counter) counter.textContent = `${doneInGroup}/${groupMissions.length}`;
  });
}

// ============================================================
//  PAUSE MENU — настройки с слайдерами
// ============================================================
function toggleSettingsPanel(open) {
  const pm = document.getElementById('pause-main');
  const ps = document.getElementById('pause-settings');
  if (pm) pm.style.display = open ? 'none' : 'flex';
  if (ps) ps.style.display = open ? 'flex' : 'none';
}

function togglePause() {
  if (gameOverFlag || currentMission === null || airMode) return;
  paused = !paused;
  document.getElementById('pause-menu').classList.toggle('active', paused);
  if (paused) {
    player.firing = false;
    fireJoy.charged = false; fireJoy.active = false;
    document.getElementById('fire-joystick').classList.remove('charging', 'charged');
    document.getElementById('fire-joystick').style.setProperty('--charge', '0%');
    if (commandMenuOpen) { commandMenuOpen = false; document.getElementById('command-menu').classList.remove('active'); timeScale = 1; }
    updatePauseInfo();
    // Показать главную панель по умолчанию
    toggleSettingsPanel(false);
  }
}

// Свернули приложение / пришёл звонок — ставим бой на паузу, при возврате будим звук
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    const inMenu = UI_EL.start.style.display !== 'none' || UI_EL.end.style.display === 'flex';
    if (!paused && !inMenu) togglePause();
    moveInput.x = 0; moveInput.y = 0; moveInput.active = false;
    player.firing = false;
  } else if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
});

// ============================================================
//  ОБРАБОТЧИКИ UI — ФИКС КНОПОК (делегирование, не зависит от DOM-ready)
// ============================================================
const UI_CLICK_ACTIONS = {
  'menu-btn-tutorial':   () => startTutorialMode(),
  'menu-btn-coop':       () => openMpLobby(),
  'menu-btn-fullscreen': () => toggleFullscreen(),
  'btn-reset-progress':  () => {
    if (confirm('Сбросить весь прогресс прохождения?')) {
      resetProgress();
      refreshMenuProgress();
    }
  },
  'legend-close':        () => closeLegend(),
  'btn-end-menu':        () => toMenu(),
  'btn-settings':        () => toggleSettingsPanel(true),
  'btn-settings-back':   () => toggleSettingsPanel(false),
};

let uiBound = false;
function bindUI() {
  if (uiBound) return;
  uiBound = true;

  // Один делегированный обработчик на все кнопки (фаза capture).
  // Ищет ближайшего родителя с нужным id — работает даже если
  // кнопки пересозданы или скрипт выполнился раньше DOM.
  document.addEventListener('click', (e) => {
    let el = e.target;
    while (el && el.nodeType === 1) {
      const action = UI_CLICK_ACTIONS[el.id];
      if (action) {
        e.preventDefault();
        e.stopPropagation();
        try { action(); }
        catch (err) { console.error('[UI] Ошибка кнопки #' + el.id, err); }
        return;
      }
      el = el.parentElement;
    }
  }, true);

  // Слайдеры настроек (событие input, делегированием нельзя)
  const bindSlider = (id, valId, key, cssVar) => {
    const el = document.getElementById(id);
    if (!el) { console.warn('[UI] Слайдер не найден: #' + id); return; }
    el.addEventListener('input', () => {
      const v = parseInt(el.value, 10) || 120;
      const valEl = document.getElementById(valId);
      if (valEl) valEl.textContent = v;
      const s = loadSettings();
      s[key] = v;
      saveSettings(s);
      document.documentElement.style.setProperty(cssVar, v + 'px');
    });
  };
  bindSlider('slider-move', 'val-move', 'moveSize', '--move-size');
  bindSlider('slider-fire', 'val-fire', 'fireSize', '--fire-size');
}

// Диагностика: в консоли вызвать diagUI() — покажет, какие id реально есть в HTML
window.diagUI = function () {
  Object.keys(UI_CLICK_ACTIONS).concat([
    'missions-container', 'menu-progress', 'start-screen',
    'slider-move', 'slider-fire', 'pause-menu', 'end-screen',
  ]).forEach(id => {
    console.log((document.getElementById(id) ? '✅ #' : '❌ НЕТ В HTML #' ) + id);
  });
};

// ============================================================
//  TO MENU — обновляем прогресс при возврате
// ============================================================
function toMenu() {
  currentMission = null; paused = false; gameOverFlag = false; timeScale = 1; commandMenuOpen = false;
  waveMode = false; airMode = false; airBombs = []; scheduledEvent = null; pendingAirstrike = null;
  tutorialMode = false;
  document.getElementById('pause-menu').classList.remove('active');
  document.getElementById('command-menu').classList.remove('active');
  document.getElementById('air-hud').classList.remove('active');
  document.getElementById('code-modal').classList.remove('active');
  document.getElementById('tutorial-legend').classList.remove('active');
  document.getElementById('end-screen').style.display = 'none';
  document.getElementById('start-screen').style.display = 'flex';
  document.getElementById('log').innerHTML = '';
  hideTutorialHint();
  clearWorld();
  refreshMenuProgress(); // обновить галочки
}

// ============================================================
//  INIT — строго после готовности DOM
// ============================================================
function initGame() {
  bindUI();
  applySettings(loadSettings());
  initMissionSelect();
  animate();
  console.log('[INIT] БРИГАДА — Тактический HUD v2 готова к бою');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}
