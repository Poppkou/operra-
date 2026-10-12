// ============================================================
//  PROGRESS — надёжное сохранение
// ============================================================
const PROGRESS_KEY = 'brigade_progress_v2';

function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    console.log('[PROGRESS] Loaded:', data);
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
  return p[missionId] && p[missionId].completed === true;
}
function countCompleted() {
  const p = loadProgress();
  return Object.keys(p).filter(k => p[k] && p[k].completed).length;
}
function resetProgress() {
  try { localStorage.removeItem(PROGRESS_KEY); console.log('[PROGRESS] Reset'); } catch(e){}
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
//  TUTORIAL — рисует табличку подсказок вместо миникарты
// ============================================================
function drawTutorialHintsPanel() {
  const x = 10, y = 20, w = 230, h = 156;
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
  const mmSize = 136, mmX = 10, mmY = 20;
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
  grenades.push({
    x: player.x + Math.cos(player.angle) * (player.radius + 6),
    y: player.y + Math.sin(player.angle) * (player.radius + 6),
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
