// Mission Island — main game loop, UI and state.
import * as THREE from 'three';
import { physicsHTML } from './physics.js';
import { MISSIONS, USER_SEGMENT, REAL_CASES, CML, closestMissions } from './nasa.js';
import { ROLES, ROLE_SPLIT, DIFFICULTY, SCENARIOS, ORBITS, LAUNCHERS, PARTS, INSTRUMENTS, catsFor, FACTS } from './data.js';
import { evaluate, newDesign, fmt, relevance, orbitFit, analyze, clamp } from './model.js';
import { World, STATIONS, mulberry } from './world.js';
import { SpaceView } from './space.js';
import { Sim, scoreResult } from './sim.js';

const $ = s => document.querySelector(s);
const PCOLORS = ['#f97316', '#3b82f6', '#a855f7', '#22c55e'];

// ── Renderer & scenes ─────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const world = new World();
const space = new SpaceView();
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  for (const c of [world.camera, space.camera]) { c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix(); }
});

// ── Game state ────────────────────────────────────────────
const G = {
  mode: 'menu', design: newDesign(), m: null, players: [], active: 0, signoffs: {}, panel: null,
  sim: null, speed: 3, paused: false, launchT: 0, dayAcc: 0, menu: { scenario: 'wildfire', difficulty: 'engineer', n: 1, names: ['Player 1', 'Player 2', 'Player 3', 'Player 4'] },
  shared: null, lastLv: undefined, uiT: 0, tokensFound: 0,
};
const team = () => G.players.length > 1;
const activeP = () => G.players[G.active];
const ownerOf = role => G.players.find(p => p.roles.includes(role));
const canEdit = role => activeP()?.roles.includes(role);

// shared design from URL
try {
  const h = location.hash.match(/#d=([^&]+)/);
  if (h) { G.shared = JSON.parse(decodeURIComponent(atob(h[1]))); if (SCENARIOS[G.shared.scenario]) { G.menu.scenario = G.shared.scenario; G.menu.difficulty = G.shared.difficulty || 'engineer'; } }
} catch { G.shared = null; }

// ── Input ─────────────────────────────────────────────────
const keys = {};
const input = { get f() { return keys.KeyW || keys.ArrowUp; }, get b() { return keys.KeyS || keys.ArrowDown; }, get l() { return keys.KeyA || keys.ArrowLeft; },
  get r() { return keys.KeyD || keys.ArrowRight; }, get run() { return keys.ShiftLeft || keys.ShiftRight; }, get jump() { return keys.Space; } };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (e.code === 'Space' && G.mode === 'world') e.preventDefault();
  if (G.mode === 'world' && !G.panel && e.code === 'KeyE') { const st = world.nearestStation(); if (st) openPanel(st.id); }
  else if (G.panel && (e.code === 'Escape' || e.code === 'KeyE')) closePanel();
  if (e.code === 'Tab' && (G.mode === 'world') && team()) { e.preventDefault(); switchPlayer(); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
let drag = null;
$('#gl').addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointerup', () => { drag = null; });
addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
  if (G.mode === 'sim') { space.camYaw -= dx * 0.005; space.camPitch = clamp(space.camPitch + dy * 0.004, -1.2, 1.2); }
  else { world.cam.yaw -= dx * 0.005; world.cam.pitch = clamp(world.cam.pitch + dy * 0.004, 0.05, 1.25); }
});
$('#gl').addEventListener('wheel', e => {
  if (G.mode === 'sim') space.camDist = clamp(space.camDist * (1 + e.deltaY * 0.001), 0.6, 80);
  else world.cam.dist = clamp(world.cam.dist + e.deltaY * 0.02, 5, 45);
}, { passive: true });

// ── Helpers ───────────────────────────────────────────────
function toast(html, ms = 4500) {
  const d = document.createElement('div'); d.innerHTML = html; $('#toast').appendChild(d);
  setTimeout(() => d.remove(), ms);
}
const stars = v => '★'.repeat(Math.round(v * 3)) + '☆'.repeat(3 - Math.round(v * 3));
const pct = v => Math.round(v * 100) + '%';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const roleTag = role => `<span class="roletag" style="background:${ROLES[role].color}">${ROLES[role].icon} ${ROLES[role].name}</span>`;

function recompute() {
  G.m = evaluate(G.design);
  world.setSpacecraft(G.design);
  if (G.lastLv !== G.design.lv) { world.setRocket(G.design.lv); G.lastLv = G.design.lv; }
  const q = questSteps();
  for (const s of q) if (s.station) world.stationStatus(s.station, s.done);
  renderHUD();
  if (G.panel) renderPanel();
}
function setDesign(ch) {
  Object.assign(G.design, ch);
  G.trades = (G.trades || 0) + 1;
  if (Object.keys(G.signoffs).length) toast('Design changed — the team must sign off again.', 2500);
  G.signoffs = {};
  recompute();
}

// ── Menu ──────────────────────────────────────────────────
function showMenu() {
  G.mode = 'menu'; $('#hud').classList.add('hidden'); $('#simui').classList.add('hidden'); closePanel(true);
  const mn = G.menu;
  const split = ROLE_SPLIT[mn.n];
  $('#screen').innerHTML = `<div class="screenbg"><div class="wrap">
    <p class="small" style="margin:0">NASA Space Apps 2026 · Space Mission Design Game</p>
    <h1 class="title">Mission Island</h1>
    <p style="font-size:16px;max-width:720px">Explore an island spaceport. Walk between the <b>Launch Complex</b>, <b>Assembly Hangar</b>, <b>Science Lab</b>, <b>Ground Station</b> and <b>Mission Control</b> to design a complete space mission — then launch it and fly it, day by day, through whatever space throws at you.</p>
    ${G.shared ? `<div class="info">🔗 A shared mission design was loaded from the link. It will be pre-installed when you start.</div>` : ''}
    <h3 style="margin-top:22px">1 · Choose a mission</h3>
    <div class="grid" id="scns">${Object.values(SCENARIOS).map(s => `
      <button class="scn ${mn.scenario === s.id ? 'sel' : ''}" data-s="${s.id}"><div class="ic">${s.icon}</div><b>${s.name}</b>
      <div class="small">${s.diff} · $${s.budget}M · ${s.years} yr</div><div class="small" style="margin-top:6px">${s.brief}</div></button>`).join('')}</div>
    <div class="cols" style="margin-top:22px">
      <div><h3>2 · Difficulty</h3><div class="seg" id="diffs">${Object.entries(DIFFICULTY).map(([k, d]) => `<button data-d="${k}" class="${mn.difficulty === k ? 'sel' : ''}">${d.name}</button>`).join('')}</div>
        <p class="small">${DIFFICULTY[mn.difficulty].desc} Budget ×${DIFFICULTY[mn.difficulty].budget}, ${DIFFICULTY[mn.difficulty].events} in-flight events.</p></div>
      <div><h3>3 · Crew (hot-seat team play)</h3><div class="seg" id="ns">${[1, 2, 3, 4].map(n => `<button data-n="${n}" class="${mn.n === n ? 'sel' : ''}">${n === 1 ? 'Solo' : n + ' players'}</button>`).join('')}</div>
        <div class="names" style="margin-top:10px">${split.map((roles, i) => `<div class="row" style="margin:6px 0">
          <span style="width:12px;height:12px;border-radius:50%;background:${PCOLORS[i]}"></span>
          <input data-name="${i}" value="${esc(mn.names[i])}" maxlength="16">
          <span class="small">${roles.map(r => ROLES[r].icon + ' ' + ROLES[r].name).join(', ')}</span></div>`).join('')}</div>
        ${mn.n > 1 ? '<p class="small">Each player owns the stations of their roles. Pass the keyboard with <kbd>Tab</kbd>. Everyone signs off at Mission Control before launch, and each role has its own goal — negotiate!</p>' : ''}
      </div>
    </div>
    <div style="margin-top:26px"><button class="btn big go" id="start">🚀 Start mission</button></div>
    <p class="small" style="margin-top:18px">Controls: WASD to walk, drag to look, E to use a station. Every choice has consequences for mass, power, data, budget and time — there is no single right answer.</p>
  </div></div>`;
  $('#scns').onclick = e => { const b = e.target.closest('[data-s]'); if (b) { mn.scenario = b.dataset.s; showMenu(); } };
  $('#diffs').onclick = e => { const b = e.target.closest('[data-d]'); if (b) { mn.difficulty = b.dataset.d; showMenu(); } };
  $('#ns').onclick = e => { const b = e.target.closest('[data-n]'); if (b) { mn.n = +b.dataset.n; showMenu(); } };
  document.querySelectorAll('[data-name]').forEach(inp => inp.oninput = () => { mn.names[+inp.dataset.name] = inp.value || `Player ${+inp.dataset.name + 1}`; });
  $('#start').onclick = startGame;
}

function startGame() {
  const mn = G.menu;
  G.players = ROLE_SPLIT[mn.n].map((roles, i) => ({ name: mn.names[i], roles, color: PCOLORS[i] }));
  G.active = 0; G.signoffs = {}; G.trades = 0; G.briefed = false;
  G.design = newDesign(mn.scenario, mn.difficulty);
  if (G.shared) { const keep = ['orbit', 'lv', 'bus', 'power', 'battery', 'computer', 'adcs', 'prop', 'comms', 'gs', 'instruments', 'duty']; for (const k of keep) if (G.shared[k] !== undefined) G.design[k] = G.shared[k]; G.shared = null; }
  $('#screen').innerHTML = '';
  G.mode = 'world';
  $('#hud').classList.remove('hidden');
  world.focus = null;
  world.setPlayerColor(activeP().color);
  recompute();
  const sc = SCENARIOS[G.design.scenario];
  toast(`<b>${sc.icon} ${sc.name}</b><br>${sc.brief}<br><span class="small">Start at <b>Mission Control</b> (north) for the briefing, or explore. Gold crystals hidden around the island are research grants (+$3M).</span>`, 9000);
}

function switchPlayer() {
  G.active = (G.active + 1) % G.players.length;
  world.setPlayerColor(activeP().color);
  toast(`🎮 <b>${esc(activeP().name)}</b> has the controls (${activeP().roles.map(r => ROLES[r].name).join(', ')})`, 2200);
  renderHUD(); if (G.panel) renderPanel();
}

// ── HUD ───────────────────────────────────────────────────
function questSteps() {
  const d = G.design, m = G.m;
  return [
    { cml: 1, t: 'Read the objective (Mission Control)', done: !!G.briefed, station: null },
    { cml: 2, t: 'Feasibility: orbit + a rocket that reaches it (Launch Complex)', done: !!(d.orbit && d.lv && m && m.mass.lvCap > 0), station: 'launch' },
    { cml: 3, t: 'Trade space: build the spacecraft (Hangar)', done: catsFor('hangar', d.scenario).every(k => d[k]), station: 'hangar' },
    { cml: 3, t: 'Trade space: choose instruments (Science Lab)', done: d.instruments.length > 0, station: 'lab' },
    { cml: 3, t: 'Trade space: set up comms (Ground Station)', done: catsFor('ground', d.scenario).every(k => d[k]), station: 'ground' },
    { cml: 4, t: `Point design: pass review${team() ? ' + sign-off' : ''} (Mission Control)`, done: !!(m && m.blocking.length === 0 && allSigned() && G.briefed), station: 'control' },
    { cml: 5, t: 'Launch from the Launch Complex!', done: false, station: null },
  ];
}
function cmlLevel() {
  const q = questSteps(); let lvl = 0;
  for (const n of [1, 2, 3, 4]) { if (q.filter(s => s.cml === n).every(s => s.done)) lvl = n; else break; }
  return lvl;
}
const allSigned = () => !team() || G.players.every((_, i) => G.signoffs[i]);

function resBar(label, valTxt, frac, cls) {
  return `<div class="res"><div class="top"><span>${label}</span><b>${valTxt}</b></div><div class="bar"><i class="${cls}" style="width:${clamp(frac) * 100}%"></i></div></div>`;
}
function renderHUD() {
  const m = G.m, d = G.design; if (!m) return;
  const massLim = m.mass.lvCap || 0;
  const massBad = (d.bus && m.mass.payload > m.mass.busCap) || (massLim && m.mass.total > massLim);
  const powBad = m.power.cons > m.power.genAvg;
  const costBad = m.cost.total > m.cost.budget;
  const dataBad = m.data.gen > m.data.down + 1e-6;
  const sci = m.science;
  $('#resources').innerHTML = `<h3>${m.sc.icon} ${m.sc.name} · Resources</h3>
    ${resBar('⚖️ Mass', `${fmt(m.mass.total)} / ${massLim ? fmt(massLim) : '—'} kg`, massLim ? m.mass.total / massLim : 0, massBad ? 'bad' : m.mass.margin < 0.1 && massLim ? 'warn' : '')}
    ${resBar('⚡ Power', `${fmt(m.power.cons)} used / ${fmt(m.power.genAvg)} W avg`, m.power.genAvg ? m.power.cons / m.power.genAvg : (m.power.cons ? 1 : 0), powBad ? 'bad' : m.power.margin < 0.2 ? 'warn' : '')}
    ${resBar('💰 Budget', `$${fmt(m.cost.total)}M / $${fmt(m.cost.budget)}M`, m.cost.total / m.cost.budget, costBad ? 'bad' : m.cost.reserveFrac < 0.1 ? 'warn' : '')}
    ${resBar('💾 Data', `${fmt(m.data.gen)} Gb/day made`, m.data.gen ? 1 : 0, dataBad ? 'warn' : 'good')}
    ${resBar('📡 Comms', `${fmt(m.data.downCap)} Gb/day downlink`, m.data.gen ? m.data.down / m.data.gen : (m.data.downCap ? 1 : 0), dataBad ? 'bad' : 'good')}
    ${resBar('⏱️ Time', `${m.time.years} yr ops${m.time.transitDays ? ` + ${m.time.transitDays} d cruise` : ''}`, m.time.lifeYears / m.time.years, m.time.dragLimited ? 'bad' : 'good')}
    ${resBar('🔬 Science (est.)', `${fmt(sci.est)} / ${sci.goal}`, sci.est / sci.goal, sci.est >= sci.goal ? 'good' : 'warn')}
    ${m.blocking.length ? `<div class="small" style="color:var(--bad)">⛔ ${m.blocking.length} launch-blocking issue${m.blocking.length > 1 ? 's' : ''} — see Mission Control</div>` : '<div class="small" style="color:var(--good)">✅ Design is launchable</div>'}`;
  const lvl = cmlLevel();
  $('#quest').innerHTML = `<h3>Concept maturity</h3><div class="cml"><b>CML ${lvl}</b> ${lvl ? CML[lvl - 1].name : 'Not started'}<div class="cmlbar">${[1, 2, 3, 4].map(n => `<i class="${n <= lvl ? 'on' : ''}"></i>`).join('')}</div></div>`
    + questSteps().map(s => `<div class="step ${s.done ? 'done' : ''}"><span class="dot">${s.done ? '✓' : s.cml <= 4 ? s.cml : '🚀'}</span>${s.t}</div>`).join('')
    + `<div class="small" style="margin-top:6px">CML = NASA/JPL Concept Maturity Level</div>`;
  $('#players').innerHTML = G.players.map((p, i) => `<div class="pchip ${i === G.active ? 'active' : ''}" style="border-color:${i === G.active ? p.color : 'transparent'}">
    <b style="color:${p.color}">${esc(p.name)}</b> ${p.roles.map(r => ROLES[r].icon).join('')}${team() && i === G.active ? ' <span class="small">(Tab ⇄)</span>' : ''}</div>`).join('');
}

// ── Station panels ────────────────────────────────────────
function openPanel(id) {
  G.panel = id; world.focusOn(id);
  if (innerWidth > 900) world.camera.setViewOffset(innerWidth, innerHeight, Math.min(520, innerWidth) / 2, 0, innerWidth, innerHeight);
  if (id === 'control') G.briefed = true;
  $('#panel').classList.remove('hidden'); $('#prompt').classList.add('hidden');
  renderHUD(); renderPanel();
}
function closePanel(silent) {
  G.panel = null; world.focus = null; $('#panel').classList.add('hidden');
  world.camera.clearViewOffset();
  if (!silent) renderHUD();
}

function optChips(cat, o) {
  const d = G.design, orb = d.orbit ? ORBITS[d.orbit] : null, c = [];
  const ch = (t, k = '') => c.push(`<span class="chip ${k}">${t}</span>`);
  if (o.mass !== undefined && o.mass > 0) ch(`${o.mass} kg`);
  if (o.cost !== undefined) ch(`$${o.cost}M`);
  switch (cat) {
    case 'bus': ch(`carries ${o.maxPayload} kg`); ch(`${o.base} W housekeeping`); break;
    case 'power': { const here = o.rtg ? o.gen : orb ? o.gen * orb.sun * (1 - orb.eclipse) : o.gen; ch(`+${o.gen} W peak`, 'g'); if (orb) ch(`≈${fmt(here)} W avg in ${d.orbit}`, here >= G.m.power.cons ? 'g' : 'b'); break; }
    case 'battery': ch(`${o.wh} Wh`); if (orb && orb.eclH) ch(`need ≈${fmt(G.m.power.needWh / 0.8)} Wh`, o.wh * 0.8 >= G.m.power.needWh ? 'g' : 'w'); break;
    case 'computer': ch(`${o.power} W`); ch(`${o.storage} Gb storage`); ch(`faults ×${o.fault}`, o.fault < 0.5 ? 'g' : o.fault >= 1 ? 'w' : ''); if (o.compress) ch('data ÷2', 'g'); break;
    case 'adcs': ch(`${o.power} W`); ch(`pointing ${pct(o.pointing)}`); if (o.magnetic && orb && !orb.magOk) ch(`useless in ${d.orbit}`, 'b'); break;
    case 'prop': ch(`Δv ${o.dv} m/s`, orb ? (o.dv >= orb.dv ? 'g' : orb.insertion ? 'b' : 'w') : ''); if (o.ion) ch('needs 300 W', 'w'); break;
    case 'comms': ch(`${o.power} W`); if (orb) ch(`${fmt(o.rate[d.orbit])} Mbps at ${d.orbit}`, o.rate[d.orbit] > 0 ? '' : 'b'); break;
    case 'rover': ch(`${o.battWh} Wh battery`); ch(`${o.panelW} W solar`); ch(`${o.speed} m/h`); break;
    case 'gs': ch(`$${o.costYr}M / yr`); if (orb) { ch(`${o.hours[d.orbit]} h/day contact`); ch(`signal ×${o.gain[d.orbit]}`, o.gain[d.orbit] >= 1 ? 'g' : o.gain[d.orbit] < 0.2 ? 'b' : 'w'); } break;
  }
  return c.join('');
}

function catSection(cat, editable) {
  const P = PARTS[cat];
  return `<div class="cat"><h3>${P.label}</h3><div class="why">${P.why}</div><div class="opts">${P.options.map(o => `
    <button class="opt ${G.design[cat] === o.id ? 'sel' : ''}" data-cat="${cat}" data-id="${o.id}" ${editable ? '' : 'disabled'}>
      <div class="n">${o.name}</div><div class="d">${o.desc}</div><div class="chips">${optChips(cat, o)}</div></button>`).join('')}</div></div>`;
}

function panelHeader(st) {
  const role = st.role, owner = ownerOf(role), editable = canEdit(role);
  return { editable, html: `<div class="head"><div><h2>${st.name}</h2>${roleTag(role)} ${team() ? `<span class="small">owned by <b style="color:${owner.color}">${esc(owner.name)}</b></span>` : ''}</div>
    <button class="close" data-act="close">✕ Esc</button></div>
    ${editable ? '' : `<div class="locked">🔒 View only. This station belongs to the <b>${ROLES[role].name}</b>. Press <kbd>Tab</kbd> to hand the keyboard to <b>${esc(owner.name)}</b>, or talk them into the change!</div>`}` };
}

function renderPanel() {
  const id = G.panel, st = STATIONS.find(s => s.id === id), d = G.design, m = G.m;
  const { editable, html } = panelHeader(st);
  let body = '';
  if (id === 'hangar') {
    body = `<div class="info">Your spacecraft is on the display stand outside. Every part adds mass, cost and usually power draw. Bus load: <b>${fmt(m.mass.payload)} / ${fmt(m.mass.busCap)} kg</b> · Power: <b>${fmt(m.power.cons)} W used / ${fmt(m.power.genAvg)} W avg</b>${m.orbit ? '' : ' · <i>pick an orbit first to see orbit-specific numbers</i>'}</div>`
      + catsFor('hangar', d.scenario).map(c => catSection(c, editable)).join('');
  } else if (id === 'lab') {
    const sc = m.sc;
    body = `<div class="info"><b>Objective:</b> ${sc.brief}<br><span class="small">💡 ${sc.tip}</span></div>
      <div class="info">Science estimate <b>${fmt(m.science.est)} / ${sc.goal}</b> · Instruments draw <b>${fmt(m.power.instPower)} W</b> · produce <b>${fmt(m.data.gen)} Gb/day</b> · pointing available <b>${pct(m.pointing)}</b></div>
      <div class="cat"><h3>Instruments (pick any)</h3><div class="why">★ = how useful it is for <i>this</i> objective. Precise instruments need precise pointing (Hangar). Data-hungry instruments need a strong downlink (Ground Station).</div>
      <div class="opts">${INSTRUMENTS.map(i => { const on = d.instruments.includes(i.id), rel = relevance(sc, i.id);
        return `<button class="opt ${on ? 'sel' : ''}" data-inst="${i.id}" ${editable ? '' : 'disabled'}><div class="n">${i.icon} ${i.name}</div>
        <div class="d">${i.desc}</div><div class="chips"><span class="chip ${rel >= 0.7 ? 'g' : rel < 0.3 ? 'b' : 'w'}">${stars(rel)} fit</span>
        <span class="chip">${i.mass} kg</span><span class="chip">${i.power} W</span><span class="chip">$${i.cost}M</span><span class="chip">${i.data} Gb/day</span>
        <span class="chip ${i.point > m.pointing && d.adcs ? 'b' : ''}">needs ${pct(i.point)} pointing</span></div></button>`; }).join('')}</div></div>`;
  } else if (id === 'ground') {
    const g = m.data.gen, dn = m.data.down, cap = m.data.downCap;
    body = `<div class="info">Daily data budget: instruments make <b>${fmt(g)} Gb</b>, you can send <b>${fmt(cap)} Gb</b> home.
      <div class="meter" style="margin-top:8px"><div style="width:${g ? clamp(dn / g) * 100 : 100}%;background:#16a34a">${g ? pct(dn / g) + ' delivered' : ''}</div><div style="flex:1;background:${g > dn ? '#7f1d1d' : 'transparent'}">${g > dn ? 'lost' : ''}</div></div>
      <div class="small" style="margin-top:6px">Downlink = radio rate (${fmt(m.data.rate)} Mbps) × signal quality (×${m.data.gain}) × contact time (${m.data.hours} h/day). Data that doesn't fit is lost; the most valuable data is sent first.</div></div>`
      + catsFor('ground', d.scenario).map(c => catSection(c, editable)).join('')
      + `<div class="cat"><h3>Instrument duty cycle: ${d.duty}%</h3><div class="why">How much of the time instruments observe. Lower = less power and data, but less science.</div>
        <input type="range" min="20" max="100" step="5" value="${d.duty}" data-duty ${editable ? '' : 'disabled'}></div>`;
  } else if (id === 'launch') {
    const sc = m.sc;
    body = `<div class="cat"><h3>Destination orbit</h3><div class="why">Where you fly decides what you can see, how much sunlight you get, how long eclipses last and how far your radio must reach.</div><div class="opts">
      ${Object.entries(ORBITS).map(([k, o]) => { const f = orbitFit(sc, k); return `<button class="opt ${d.orbit === k ? 'sel' : ''}" data-orbit="${k}" ${editable ? '' : 'disabled'}>
        <div class="n">${o.name}</div><div class="d">${o.desc}</div><div class="chips"><span class="chip ${f >= 0.7 ? 'g' : f < 0.3 ? 'b' : 'w'}">${stars(f)} fit</span>
        <span class="chip">${o.alt}</span><span class="chip">period ${o.period}</span><span class="chip">shadow ${pct(o.eclipse)}</span>${o.sun < 1 ? `<span class="chip w">sunlight ${pct(o.sun)}</span>` : ''}
        ${o.dv ? `<span class="chip">needs Δv ${o.dv} m/s</span>` : ''}${o.transit ? `<span class="chip">${o.transit} d cruise</span>` : ''}</div></button>`; }).join('')}</div></div>
      ${d.orbit ? `<div class="info">🧮 <b>The physics</b><br>${physicsHTML(d.orbit)}</div>` : ''}
      <div class="cat"><h3>Launch vehicle</h3><div class="why">Rockets can lift much less mass to far destinations than to low orbit. Spacecraft mass now: <b>${fmt(m.mass.total)} kg</b>.</div><div class="opts">
      ${Object.entries(LAUNCHERS).map(([k, l]) => { const cap = d.orbit ? l.cap[d.orbit] : null; const ok = cap !== null && cap >= m.mass.total && cap > 0;
        return `<button class="opt ${d.lv === k ? 'sel' : ''}" data-lv="${k}" ${editable ? '' : 'disabled'}><div class="n">${l.name} <span class="small">${l.cls}</span></div><div class="d">${l.desc}</div>
        <div class="chips"><span class="chip">$${l.cost}M</span><span class="chip">${pct(l.rel)} reliable</span>
        ${cap !== null ? `<span class="chip ${ok ? 'g' : 'b'}">${cap ? fmt(cap) + ' kg to ' + d.orbit : 'cannot reach ' + d.orbit}</span>` : `<span class="chip">${fmt(l.cap.LEO)} kg to LEO</span>`}</div></button>`; }).join('')}</div></div>
      <div class="cat">${launchBox()}</div>`;
  } else if (id === 'control') {
    const sc = m.sc;
    const goalsMet = m.roleGoals;
    body = `<div class="info"><b>${sc.icon} ${sc.name}</b> — ${sc.diff}<br>${sc.brief}<br><br>💡 <i>${sc.tip}</i><br><br>
      🎯 Science goal <b>${sc.goal}</b> · 💰 Budget <b>$${fmt(m.cost.budget)}M</b>${d.grants ? ` (incl. $${d.grants}M grants)` : ''} · ⏱️ Lifetime <b>${sc.years} years</b> · Difficulty <b>${DIFFICULTY[d.difficulty].name}</b></div>
      <div class="cat"><h3>Real NASA missions with this kind of goal</h3><div class="why">Study what flew before you — NASA's Mission Design Lab starts the same way.</div>${realMissionsHTML(sc.id)}</div>
      <div class="cat"><h3>Concept maturity (JPL CML ladder)</h3>${CML.map(c => `<div class="check"><span class="ic">${cmlLevel() >= c.n ? '✅' : '◻️'}</span><div><b>CML ${c.n} · ${c.name}</b><div class="why">${c.desc}</div></div></div>`).join('')}</div>
      <div class="cat"><h3>Design review</h3>${m.checks.map(c => `<div class="check"><span class="ic">${c.ok ? '✅' : c.level === 'block' ? '⛔' : c.level === 'danger' ? '🟥' : '⚠️'}</span><div>${c.label}${c.ok ? '' : `<div class="why">${c.why}</div>`}</div></div>`).join('')}
      <p class="small">⛔ blocks launch · ⚠️ allowed, but will hurt the mission</p></div>
      <div class="cat"><h3>Cost breakdown</h3><div class="small">Hardware $${fmt(m.cost.hw)}M + integration & test $${fmt(m.cost.integration)}M + launch $${fmt(m.cost.launch)}M + operations $${fmt(m.cost.ops)}M = <b>$${fmt(m.cost.total)}M</b>. Reserve: <b style="color:${m.cost.reserve < 0 ? 'var(--bad)' : 'inherit'}">$${fmt(m.cost.reserve)}M (${pct(m.cost.reserveFrac)})</b>. Real projects often overrun — keep a reserve!</div></div>
      <div class="cat"><h3>Role goals ${team() ? '(each player\'s priority)' : ''}</h3>${Object.entries(ROLES).map(([k, r]) => `<div class="check"><span class="ic">${goalsMet[k] ? '✅' : '◻️'}</span><div>${r.icon} <b>${r.name}</b>${team() ? ` <span class="small">(${esc(ownerOf(k).name)})</span>` : ''}<div class="why">${r.goal}</div></div></div>`).join('')}
      <p class="small">These goals pull against each other — science wants more instruments, the engineer wants margins, the lead wants money left over. Each goal met earns bonus points.</p></div>
      ${team() ? `<div class="cat"><h3>Team sign-off</h3><div class="why">Everyone must approve the final design. Any change resets the sign-offs.</div><div class="row">${G.players.map((p, i) => `<button class="btn ${G.signoffs[i] ? '' : 'ghost'}" data-sign="${i}" style="${G.signoffs[i] ? `background:${p.color}` : ''}">${G.signoffs[i] ? '✔ ' : ''}${esc(p.name)}</button>`).join('')}</div></div>` : ''}
      <div class="cat"><h3>Mission segments</h3><div class="small">🚀 <b>Launch</b>: Launch Complex · 🛰️ <b>Space</b>: Hangar + Science Lab · 📡 <b>Ground</b>: Ground Station + Mission Control · 👥 <b>User</b>: ${USER_SEGMENT[sc.id]}</div></div>
      <div class="cat"><h3>Share & compare</h3><div class="row"><button class="btn ghost" data-act="share">🔗 Copy link to this design</button></div></div>
      <div class="cat"><h3>Leaderboard — ${sc.name}</h3>${leaderboardHTML(sc.id)}</div>`;
  }
  $('#panel').innerHTML = html + body;
}

function launchBox() {
  const m = G.m;
  const ready = m.blocking.length === 0 && allSigned();
  return `<h3>Launch</h3>${m.blocking.length ? `<div class="locked">⛔ ${m.blocking.length} issue(s) block launch:<br>${m.blocking.map(c => '• ' + c.label).join('<br>')}</div>` : ''}
    ${!allSigned() && m.blocking.length === 0 ? '<div class="locked">✍️ Waiting for every player to sign off at Mission Control.</div>' : ''}
    <button class="btn big go" data-act="launch" ${ready && canEdit('lead') ? '' : 'disabled'}>🚀 LAUNCH MISSION</button>
    ${!canEdit('lead') ? '<p class="small">Only the Mission Lead can give the GO.</p>' : ''}`;
}

$('#panel').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t || t.disabled) return;
  const ds = t.dataset;
  if (ds.act === 'close') return closePanel();
  if (ds.act === 'launch') return beginLaunch();
  if (ds.act === 'share') return shareDesign();
  if (ds.cat) return setDesign({ [ds.cat]: ds.id });
  if (ds.orbit) return setDesign({ orbit: ds.orbit });
  if (ds.lv) return setDesign({ lv: ds.lv });
  if (ds.inst) { const s = new Set(G.design.instruments); s.has(ds.inst) ? s.delete(ds.inst) : s.add(ds.inst); return setDesign({ instruments: [...s] }); }
  if (ds.sign !== undefined) {
    const i = +ds.sign;
    if (G.m.blocking.length) return toast('Fix the launch-blocking issues before signing off.', 2500);
    G.signoffs[i] = !G.signoffs[i]; recompute();
  }
});
$('#panel').addEventListener('input', e => { if (e.target.dataset.duty !== undefined) { G.design.duty = +e.target.value; G.signoffs = {}; G.m = evaluate(G.design); renderHUD(); e.target.closest('.cat').querySelector('h3').textContent = `Instrument duty cycle: ${G.design.duty}%`; } });
$('#panel').addEventListener('change', e => { if (e.target.dataset.duty !== undefined) recompute(); });

function shareDesign() {
  const url = location.href.split('#')[0] + '#d=' + btoa(encodeURIComponent(JSON.stringify(G.design)));
  try { navigator.clipboard.writeText(url).then(() => toast('🔗 Link copied! Send it to another team so they can fly your design.'), () => prompt('Copy this link:', url)); }
  catch { prompt('Copy this link:', url); }
}

// ── Real NASA mission references ──────────────────────────
function missionCard(ms, extra = '') {
  return `<div class="mcard"><div class="row" style="justify-content:space-between"><b>${ms.name}${ms.failed ? ' <span class="chip b">lost</span>' : ''}</b><span class="small">${ms.agency} · ${ms.year}</span></div>
    <div class="small">${ms.orbitText} · ${ms.rocket}${ms.mass ? ` · ~${ms.mass.toLocaleString()} kg` : ''}</div>
    <div class="small">🔭 ${ms.instText}</div><div style="margin-top:4px">${ms.fact}</div>${extra}</div>`;
}
function realMissionsHTML(sc) {
  const list = MISSIONS.filter(ms => ms.tags.includes(sc));
  return list.length ? list.map(ms => missionCard(ms, `<div class="small" style="margin-top:4px">💡 ${ms.lesson}</div>`)).join('') : '<p class="small">Sandbox: compare with any mission in the archive after you fly.</p>';
}
function compareHTML(d, m) {
  const INST = Object.fromEntries(INSTRUMENTS.map(i => [i.id, i]));
  return closestMissions(d, m.mass.total).map(({ ms, shared }, i) => {
    const rows = [
      ['Destination', `${m.orbit.name}`, ms.orbitText],
      ['Rocket class', `${m.lv.name}`, `${ms.rocket}`],
      ['Launch mass', `${fmt(m.mass.total)} kg`, ms.mass ? `~${ms.mass.toLocaleString()} kg` : '—'],
      ['Shared instrument types', shared.length ? shared.map(x => INST[x].icon + ' ' + INST[x].name).join(', ') : 'none', ''],
    ];
    return `<div class="mcard"><div class="small">${i === 0 ? 'Closest match' : 'Also similar'}</div>${missionCard(ms)}
      <table class="lb" style="margin-top:6px"><tr><th></th><th>Your mission</th><th>${ms.name}</th></tr>${rows.map(r => `<tr><td class="small">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</table>
      <div style="margin-top:6px">💡 <b>Lesson:</b> ${ms.lesson}</div></div>`;
  }).join('');
}

// ── Leaderboard (per-browser) ─────────────────────────────
function lbLoad() { try { return JSON.parse(localStorage.getItem('mission-island-lb') || '[]'); } catch { return []; } }
function lbSave(e) { try { const a = lbLoad(); a.push(e); localStorage.setItem('mission-island-lb', JSON.stringify(a.slice(-200))); } catch { /* storage unavailable */ } }
function leaderboardHTML(sc) {
  const rows = lbLoad().filter(r => r.sc === sc).sort((a, b) => b.score - a.score).slice(0, 8);
  if (!rows.length) return '<p class="small">No missions flown yet. Be the first!</p>';
  return `<table class="lb"><tr><th>#</th><th>Crew</th><th>Grade</th><th>Score</th><th>Result</th></tr>${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${r.grade}</td><td>${r.score}</td><td class="small">${r.status}</td></tr>`).join('')}</table>`;
}

// ── Launch & simulation ───────────────────────────────────
function beginLaunch() {
  closePanel(true);
  G.mode = 'launch'; G.launchT = 0;
  $('#hud').classList.add('hidden');
  world.resetLaunch(G.design.lv);
  const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  G.sim = new Sim(structuredClone(G.design), G.m, mulberry(seed));
  toast(`T-minus 3… 2… 1… <b>Liftoff</b> of the ${G.m.lv.name}!`, 4000);
}

function startSim() {
  G.mode = 'sim'; G.paused = false; G.dayAcc = 0;
  space.setup(G.design, G.m.orbit);
  space.camera.position.set(0, 3, 30);
  $('#simui').classList.remove('hidden');
  renderSimCtl(); renderSimUI();
}

const SPEEDS = { 1: 15, 3: 45, 10: 150 };
function renderSimCtl() {
  $('#simctl').innerHTML = `<div class="row">${[1, 3, 10].map(s => `<button data-speed="${s}" class="${G.speed === s && !G.paused ? 'sel' : ''}">${s}×</button>`).join('')}
    <button data-pause class="${G.paused ? 'sel' : ''}">${G.paused ? '▶ Resume' : '⏸ Pause'}</button></div><button data-skip>⏭ Skip to end</button>`;
}
$('#simctl').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.speed) { G.speed = +t.dataset.speed; G.paused = false; }
  if (t.dataset.pause !== undefined) G.paused = !G.paused;
  if (t.dataset.skip !== undefined) { G.speed = 10000; G.paused = false; }
  renderSimCtl();
});

function renderSimUI() {
  const s = G.sim, m = s.m, t = s.today;
  const elapsed = s.opsElapsed, prog = clamp(s.day / s.endDay);
  $('#simtop').innerHTML = `<div class="small">${m.sc.icon} ${m.sc.name} · ${m.orbit.name}</div>
    <div class="clock">Day ${s.day}</div><div class="small">${s.phase === 'cruise' ? `🚀 Cruise to destination — ${s.transit - s.day} days to arrival` : `🛰️ Science operations — year ${fmt(elapsed / 365)} of ${m.time.years}`}${!s.alive ? ' · <b style="color:var(--bad)">CONTACT LOST</b>' : ''}</div>
    <div class="bar" style="margin-top:6px"><i style="width:${prog * 100}%"></i></div>`;
  const spent = m.cost.total + s.overrun + s.extraCost;
  const pace = elapsed > 0 ? s.sci / elapsed : 0;
  $('#simleft').innerHTML = `<h3>Live telemetry</h3>
    ${resBar('⚡ Power', `${fmt(t.powerGen || m.power.genAvg)} W avail · ${fmt(m.power.cons)} W load`, (t.powerGen || m.power.genAvg) ? m.power.cons / (t.powerGen || m.power.genAvg) : 1, m.power.cons > (t.powerGen || m.power.genAvg) ? 'bad' : '')}
    ${resBar('🔭 Instruments active', pct(t.active ?? 1), t.active ?? 1, (t.active ?? 1) < 0.7 ? 'warn' : 'good')}
    ${resBar('📡 Downlink today', `${fmt(t.down)} / ${fmt(t.gen)} Gb`, t.gen ? t.down / t.gen : 1, t.gen && t.down < t.gen * 0.99 ? 'warn' : 'good')}
    ${resBar('💾 Onboard buffer', `${fmt(s.buffer)} / ${m.data.storage} Gb`, s.buffer / Math.max(1, m.data.storage), '')}
    ${resBar('🔬 Science index', `${fmt(s.scienceIndex)} / ${m.sc.goal}`, s.scienceIndex / m.sc.goal, s.scienceIndex >= m.sc.goal ? 'good' : '')}
    ${resBar('💰 Spent', `$${fmt(spent)}M / $${fmt(m.cost.budget)}M`, spent / m.cost.budget, spent > m.cost.budget ? 'bad' : '')}
    <div class="small">Pace: ${fmt(pace)} science/day (need ${fmt(m.sc.goal)} avg) · data lost: ${fmt(s.lost)} Gb</div>`;
  $('#simlog').innerHTML = s.log.slice(0, 30).map(l => `<div class="${l.cls}"><span class="small">Day ${l.day}</span> ${esc(l.t)}</div>`).join('');
  drawChart();
}

function drawChart() {
  const c = $('#simchart'), x = c.getContext('2d'), s = G.sim, W = c.width, H = c.height, goal = s.m.sc.goal;
  x.clearRect(0, 0, W, H);
  const maxY = Math.max(goal * 1.3, s.scienceIndex * 1.1);
  const X = d => 30 + (d / s.endDay) * (W - 40), Y = v => H - 18 - (v / maxY) * (H - 30);
  x.strokeStyle = 'rgba(255,255,255,.15)'; x.beginPath(); x.moveTo(30, H - 18); x.lineTo(W - 10, H - 18); x.stroke();
  // on-track line
  x.setLineDash([4, 4]); x.strokeStyle = '#fbbf24'; x.beginPath(); x.moveTo(X(s.transit), Y(0)); x.lineTo(X(s.endDay), Y(goal)); x.stroke(); x.setLineDash([]);
  x.fillStyle = '#fbbf24'; x.font = '11px system-ui'; x.fillText(`goal ${goal}`, X(s.endDay) - 50, Y(goal) - 5);
  if (s.transit) { x.fillStyle = 'rgba(90,209,255,.08)'; x.fillRect(30, 8, X(s.transit) - 30, H - 26); x.fillStyle = '#9aa6c8'; x.fillText('cruise', 34, 20); }
  x.strokeStyle = '#5ad1ff'; x.lineWidth = 2; x.beginPath();
  s.series.forEach((p, i) => i ? x.lineTo(X(p.day), Y(p.sci)) : x.moveTo(X(p.day), Y(p.sci))); x.stroke(); x.lineWidth = 1;
  x.fillStyle = '#9aa6c8'; x.fillText('Science returned', 34, H - 4);
}

function showEvent(ev) {
  G.paused = true; renderSimCtl();
  const owner = ownerOf(ev.role);
  $('#modal').innerHTML = `<div class="box"><div class="small">Day ${G.sim.day} · decision for the ${roleTag(ev.role)} ${team() ? `— <b style="color:${owner.color}">${esc(owner.name)}</b>, it's your call (discuss with the team!)` : ''}</div>
    <h2 style="margin-top:8px">${ev.title}</h2><p>${ev.text}</p>${REAL_CASES[ev.id] ? `<div class="info">📚 <b>Real-world case:</b> ${REAL_CASES[ev.id]}</div>` : ''}
    ${ev.choices.map((c, i) => { const ok = !c.need || c.need(G.sim); return `<button class="choice" data-c="${i}" ${ok ? '' : 'disabled'}>${c.label}${ok ? '' : ` <span class="small">— ${c.why}</span>`}</button>`; }).join('')}</div>`;
  $('#modal').classList.remove('hidden');
  $('#modal').onclick = e => {
    const b = e.target.closest('[data-c]'); if (!b || b.disabled) return;
    G.sim.resolve(ev, ev.choices[+b.dataset.c]);
    $('#modal').classList.add('hidden'); G.paused = false; if (G.speed > 10) G.speed = 10; renderSimCtl(); renderSimUI();
    toast(esc(G.sim.log[0].t), 5000);
  };
}

// ── Report ────────────────────────────────────────────────
function showReport() {
  G.mode = 'report';
  $('#simui').classList.add('hidden'); $('#modal').classList.add('hidden');
  const s = G.sim, m = s.m, r = s.result();
  const goals = { ...m.roleGoals, lead: r.finalReserve / m.cost.budget >= 0.10 };
  const sc = scoreResult(m, r, goals, team());
  const notes = analyze(s.d, m, r);
  const crew = G.players.map(p => p.name).join(' & ');
  lbSave({ sc: m.sc.id, name: crew, score: sc.total, grade: sc.grade, status: sc.status, t: Date.now() });
  const col = sc.status === 'MISSION SUCCESS' ? 'var(--good)' : sc.status === 'PARTIAL SUCCESS' ? 'var(--warn)' : 'var(--bad)';
  $('#screen').innerHTML = `<div class="screenbg"><div class="wrap">
    <p class="small" style="margin:0">Post-mission report · ${m.sc.icon} ${m.sc.name} · ${DIFFICULTY[s.d.difficulty].name}</p>
    <div class="row" style="gap:24px;margin:10px 0 18px"><div class="grade" style="color:${col}">${sc.grade}</div>
      <div><h2 style="color:${col};font-size:30px;margin:0">${sc.status}</h2><div style="font-size:20px">${sc.total} / 1000 points</div>
      <div class="small">${r.launchFailed ? 'The rocket was lost during ascent.' : `${fmt(r.science)} science index · ${pct(r.lifeFrac)} of lifetime · ${fmt(r.dataDown / 1000)} Tb sent home · $${fmt(r.spent)}M spent`}</div></div></div>
    <div class="cols">
      <div class="card"><h3>Score breakdown</h3>${sc.parts.map(p => `<div class="scorepart">${resBar(p.label, `${p.pts} / ${p.max}`, p.pts / p.max, p.pts / p.max > 0.7 ? 'good' : p.pts / p.max > 0.35 ? 'warn' : 'bad')}<div class="small" style="margin-top:-6px">${p.note}</div></div>`).join('') || '<p>No score — the mission never reached space.</p>'}
        <h3 style="margin-top:14px">Role goals</h3>${Object.entries(ROLES).map(([k, ro]) => `<div class="check"><span class="ic">${goals[k] ? '✅' : '❌'}</span><div>${ro.icon} ${ro.name}${team() ? ` <span class="small">(${esc(ownerOf(k).name)})</span>` : ''}<div class="why">${ro.goal}</div></div></div>`).join('')}</div>
      <div class="card"><h3>Why it went this way</h3><div class="bullets">${notes.map(n => `<div class="${n.type}">${n.type === 'good' ? '✅' : n.type === 'bad' ? '❌' : '💡'} ${n.text}</div>`).join('')}</div>
        <h3 style="margin-top:14px">Your design</h3><div class="small">${m.orbit.name} on a ${m.lv.name} · ${m.P.bus.name}, ${m.P.power.name}, ${m.P.battery.name}, ${m.P.computer.name}, ${m.P.adcs.name}, ${m.P.prop.name} · ${m.P.comms.name} + ${m.P.gs.name} · ${m.insts.map(i => i.icon + ' ' + i.name).join(', ')} · duty ${s.d.duty}%</div></div>
    </div>
    <div class="card" style="margin-top:16px"><h3>How your design compares with real NASA missions</h3>${compareHTML(s.d, m)}
      <p class="small" style="margin-top:8px">👥 <b>User segment:</b> ${USER_SEGMENT[m.sc.id]} · 🧭 You explored <b>${G.trades || 0}</b> design trades before reaching CML 4.</p></div>
    <div class="card" style="margin-top:16px"><h3>Mission log</h3><div style="max-height:200px;overflow:auto">${s.log.map(l => `<div class="small" style="padding:3px 0">Day ${l.day}: ${esc(l.t)}</div>`).join('')}</div></div>
    <div class="card" style="margin-top:16px"><h3>Leaderboard — ${m.sc.name}</h3>${leaderboardHTML(m.sc.id)}</div>
    <div class="row" style="margin-top:20px">
      <button class="btn" id="redesign">🔧 Back to the island to redesign</button>
      <button class="btn ghost" id="again">🎲 Fly the same design again</button>
      <button class="btn ghost" id="share">🔗 Share design</button>
      <button class="btn ghost" id="menu">🏠 New mission</button></div>
  </div></div>`;
  $('#redesign').onclick = () => { $('#screen').innerHTML = ''; G.mode = 'world'; G.signoffs = {}; world.resetLaunch(G.design.lv); world.focus = null; $('#hud').classList.remove('hidden'); recompute(); };
  $('#again').onclick = () => { $('#screen').innerHTML = ''; G.m = evaluate(G.design); beginLaunch(); };
  $('#share').onclick = shareDesign;
  $('#menu').onclick = () => { world.resetLaunch(null); showMenu(); };
}

// ── Main loop ─────────────────────────────────────────────
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (G.mode === 'sim') {
    const s = G.sim;
    if (!G.paused && !s.done) {
      G.dayAcc += dt * (SPEEDS[G.speed] || G.speed);
      let n = 0;
      while (G.dayAcc >= 1 && n < 5000) {
        G.dayAcc -= 1; n++;
        const ev = s.step();
        if (ev) { G.dayAcc = 0; showEvent(ev); break; }
        if (s.done) break;
      }
    }
    space.update(dt, { phase: s.phase, downlinking: s.today.down > 0 && s.alive, speed: G.paused ? 0 : Math.min(G.speed, 10), progress: s.transit ? s.day / s.transit : 1, dragging: !!drag });
    G.uiT += dt; if (G.uiT > 0.12) { G.uiT = 0; renderSimUI(); }
    if (s.done && !G.reportTimer) { G.reportTimer = setTimeout(() => { G.reportTimer = null; showReport(); }, 1800); renderSimUI(); }
    renderer.render(space.scene, space.camera);
  } else {
    if (G.mode === 'launch') {
      G.launchT += dt;
      if (world.launchStep(G.launchT)) {
        if (G.sim.launchFailed) { G.mode = 'report-wait'; toast('💥 <b>Launch failure!</b> The rocket broke apart during ascent.', 4000); setTimeout(showReportDirect, 1500); }
        else startSim();
      }
    }
    const frozen = G.mode !== 'world' || !!G.panel;
    world.update(dt, input, frozen);
    if (G.mode === 'world' && !G.panel) {
      const st = world.nearestStation();
      const pr = $('#prompt');
      if (st) { const o = ownerOf(st.role); pr.innerHTML = `Press <kbd>E</kbd> — <b>${st.name}</b> ${roleTag(st.role)}${team() ? ` <span class="small">${esc(o.name)}</span>` : ''}`; pr.classList.remove('hidden'); }
      else pr.classList.add('hidden');
      const tok = world.checkTokens();
      if (tok) { G.design.grants += 3; G.tokensFound++; recompute(); toast(`💎 <b>Research grant +$3M!</b> (${G.tokensFound}/${world.tokens.length})<br><span class="small">Did you know? ${FACTS[tok.idx % FACTS.length]}</span>`, 8000); }
    }
    if (G.mode === 'world') world.drawMinimap($('#minimap').getContext('2d'), 190, 190, true);
    renderer.render(world.scene, world.camera);
  }
  requestAnimationFrame(frame);
}
function showReportDirect() { G.sim.done = true; showReport(); }

// debug hook for testing in the console
window.MI = { G, setDesign, openPanel, beginLaunch, evaluate, world, showReport, showEvent };

showMenu();
recompute();
frame();
