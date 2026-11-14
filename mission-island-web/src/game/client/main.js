// Mission Island — main game loop, UI and state.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { physicsHTML } from '../sim/physics.js';
import { MISSIONS, USER_SEGMENT, REAL_CASES, CML, closestMissions } from '../sim/nasa.js';
import { ROLES, ROLE_SPLIT, DIFFICULTY, SCENARIOS, ORBITS, LAUNCHERS, PARTS, INSTRUMENTS, catsFor, FACTS } from '../sim/data.js';
import { evaluate, newDesign, fmt, sciText, relevance, orbitFit, analyze, clamp } from '../sim/model.js';
import { World, STATIONS, mulberry } from './world.js';
import { SpaceView } from './space.js';
import { Sim, scoreResult } from '../sim/sim.js';
import { surfaceScore, surfaceAnalysis } from '../sim/surface.js';
import { Shadowline } from './shadowline.js';
import { illustration } from './illus.js';

const $ = s => document.querySelector(s);
const PCOLORS = ['#f97316', '#3b82f6', '#a855f7', '#22c55e'];

// ── Renderer & scenes ─────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const world = new World();
const space = new SpaceView();
world.initEnvironment(renderer);
const shadow = new Shadowline($('#gl'));
// Post-processing: bloom (glow on the Sun, engine flame, screens) + tone mapping in the output pass.
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(world.scene, world.camera);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.3, 0.6, 0.85);
composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(new OutputPass());
function draw(scene, camera, strength, exposure) {
  renderPass.scene = scene; renderPass.camera = camera; bloom.strength = strength;
  renderer.toneMappingExposure = exposure; composer.render();
}
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
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
  if (e.code === 'KeyC' && G.mode === 'world' && !G.panel) toggleChat();
  if (e.code === 'Escape' && chat.open) toggleChat(false);
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
let drag = null;
$('#capcomBtn').addEventListener('click', () => toggleChat());
$('#gl').addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointerup', () => { drag = null; });
addEventListener('pointermove', e => {
  if (!drag || G.mode === 'surface') return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
  if (G.mode === 'sim') { space.camYaw -= dx * 0.005; space.camPitch = clamp(space.camPitch + dy * 0.004, -1.2, 1.2); }
  else { world.cam.yaw -= dx * 0.005; world.cam.pitch = clamp(world.cam.pitch + dy * 0.004, 0.05, 1.25); }
});
$('#gl').addEventListener('wheel', e => {
  if (G.mode === 'surface') return;
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
// ── Icons ─────────────────────────────────────────────────
const ICONS = {
  bus: '<path d="M4 7l8-4 8 4v10l-8 4-8-4z"/><path d="M4 7l8 4 8-4M12 11v10"/>',
  power: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  battery: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10v4M7 10v4M11 10v4"/>',
  computer: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  adcs: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>',
  prop: '<path d="M12 2c3 4 5 7 5 11a5 5 0 0 1-10 0c0-4 2-7 5-11z"/><path d="M12 13c1 1.5 1.5 2.5 1.5 3.5a1.5 1.5 0 0 1-3 0c0-1 .5-2 1.5-3.5z"/>',
  rover: '<rect x="4" y="8" width="16" height="6" rx="1"/><circle cx="6" cy="17" r="2"/><circle cx="12" cy="17" r="2"/><circle cx="18" cy="17" r="2"/><path d="M14 8V4h3"/>',
  comms: '<path d="M4 18a8 8 0 0 1 0-12M20 6a8 8 0 0 1 0 12M7.5 15a4 4 0 0 1 0-6M16.5 9a4 4 0 0 1 0 6"/><circle cx="12" cy="12" r="1.5"/>',
  gs: '<path d="M4 14a8 8 0 0 0 12-8z"/><path d="M10 14l-2 7h8l-2-7M14 6l4-3"/>',
  relay: '<path d="M12 22V9M8 22h8M6 6a8 8 0 0 1 12 0M9 9a4 4 0 0 1 6 0"/>',
  instruments: '<rect x="3" y="7" width="18" height="12" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 7l2-3h4l2 3"/>',
  orbit: '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-25 12 12)"/>',
  lv: '<path d="M12 2c3 3 4 7 4 11l-4 3-4-3c0-4 1-8 4-11z"/><path d="M8 13l-3 4h4M16 13l3 4h-4M10 19l2 3 2-3"/>',
  duty: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  go: '<path d="M12 2c3 3 4 7 4 11l-4 3-4-3c0-4 1-8 4-11z"/><circle cx="12" cy="9" r="1.5"/><path d="M9 18l-2 4M15 18l2 4"/>',
  brief: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  review: '<path d="M5 12l4 4 10-10"/>',
  team: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c.5-4 3-6 6-6s5.5 2 6 6M15 14c3 0 5 2 5.5 5"/>',
  weight: '<path d="M6 8h12l2 12H4z"/><circle cx="12" cy="5" r="2.5"/>',
  money: '<circle cx="12" cy="12" r="9"/><path d="M15 9c-1-1.5-6-1.5-6 1s6 1 6 3.5-5 2.5-6 1M12 6v2M12 16v2"/>',
  data: '<path d="M4 6c0-2 16-2 16 0v12c0 2-16 2-16 0z"/><path d="M4 6c0 2 16 2 16 0M4 12c0 2 16 2 16 0"/>',
  time: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
  science: '<path d="M9 3h6M10 3v6L4 19a1.5 1.5 0 0 0 1.3 2h13.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/>',
};
const icon = (k, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[k] || ICONS.bus}</svg>`;
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const val = (v, u) => u === ' $M' ? `$${fmt(v)}M` : `${fmt(v)}${u}`;
const CAT_LABEL = { bus: 'Structure', power: 'Power', battery: 'Battery', computer: 'Computer', adcs: 'Pointing', prop: 'Engine', rover: 'Rover', comms: 'Antenna', gs: 'Ground stations', relay: 'Relay', instruments: 'Instruments', orbit: 'Orbit', lv: 'Rocket', duty: 'Observing time', go: 'Launch', brief: 'Briefing', review: 'Review', team: 'Team' };
const CAT_HINT = {
  bus: 'The frame everything bolts onto. Bigger frames carry more.',
  power: 'Makes electricity. Solar needs sunlight; nuclear works anywhere.',
  battery: "Keeps everything running in the planet's shadow.",
  computer: 'Tougher computers survive space radiation.',
  adcs: 'How precisely the spacecraft can aim its instruments.',
  prop: 'Engine power to enter orbit at the Moon, Mars, GEO or L1.',
  rover: 'Drives into dark craters to find ice.',
  comms: 'Sends your data home. Bigger dishes send faster.',
  gs: 'Antennas on Earth that listen for your spacecraft.',
  relay: 'Lets the rover talk home from inside a crater.',
  instruments: 'What your mission observes. Pick as many as you can afford.',
  orbit: 'Where you go decides what you can see.',
  lv: 'Your rocket must lift the whole spacecraft to that orbit.',
  duty: 'More observing time means more science, but more power and data.',
};
const GOOD_TAGS = new Set(['Best fit', 'Key for mission', 'Enough Δv', 'Recommended']);
const INFO_CATS = ['go', 'brief', 'review', 'team'];

// ── Resource panel (HUD) ──────────────────────────────────
const STATE_WORD = { none: 'Not set', good: 'Good', tight: 'Tight', over: 'Problem', info: 'Goal' };
function hudRow(ic, label, state, value, tip) {
  return `<div class="hr" title="${esc(tip)}">${icon(ic)}<span class="hl">${label}</span><span class="st2 ${state}">${STATE_WORD[state]}</span><span class="hv">${value}</span></div>`;
}
function phaseLine() {
  if (G.mode === 'sim' && G.sim) return `Flight · day ${G.sim.day} of ${G.sim.endDay}`;
  if (G.mode === 'surface') return 'Moon surface · rover phase';
  return 'Design phase · no clock running · launch when ready';
}
function nextStep() {
  const s = questSteps().find(q => !q.done);
  if (!s) return null;
  const st = s.station || (s.cml === 1 ? 'control' : 'launch');
  const where = { launch: 'Launch Complex', hangar: 'Assembly Hangar', lab: 'Science Lab', ground: 'Ground Station', control: 'Mission Control' }[st];
  const what = { control: s.cml === 1 ? 'Read your mission briefing' : 'Fix problems and pass the review', launch: 'Pick an orbit and a rocket', hangar: 'Build the spacecraft', lab: 'Choose your instruments', ground: 'Set up communications' }[st];
  return { what, where, station: st };
}
function renderHUD() {
  const m = G.m, d = G.design; if (!m) return;
  const lim = m.mass.lvCap;
  const weight = !d.lv || !d.orbit
    ? hudRow('weight', 'Weight', 'none', `${fmt(m.mass.total)} kg`, 'Pick an orbit and a rocket to see how much you can lift.')
    : hudRow('weight', 'Weight', (d.bus && m.mass.payload > m.mass.busCap) || m.mass.total > lim ? 'over' : m.mass.total > lim * 0.9 ? 'tight' : 'good', `${fmt(m.mass.total)} of ${fmt(lim)} kg`, `Your spacecraft weighs ${fmt(m.mass.total)} kg. Your rocket can lift ${fmt(lim)} kg to this orbit.`);
  const power = !d.power
    ? hudRow('power', 'Power', 'none', 'no power source', 'Add a power source in the Assembly Hangar.')
    : hudRow('power', 'Power', m.power.margin < 0 ? 'over' : m.power.margin < 0.2 ? 'tight' : 'good', `uses ${fmt(m.power.cons)} · makes ${fmt(m.power.genAvg)} W`, 'Everything on board needs this much electricity; your power source makes this much on average, including time in shadow.');
  const money = hudRow('money', 'Money', m.cost.total > m.cost.budget ? 'over' : m.cost.reserveFrac < 0.1 ? 'tight' : 'good', `$${fmt(m.cost.total)}M of $${fmt(m.cost.budget)}M`, `Parts, testing, the rocket and the flight team (about $2M a year). Keep some money spare: real projects go over budget.`);
  const data = !d.instruments.length
    ? hudRow('data', 'Data home', 'none', 'no instruments', 'Add instruments in the Science Lab, then an antenna at the Ground Station.')
    : hudRow('data', 'Data home', m.data.ratio >= 0.999 ? 'good' : m.data.ratio > 0.8 ? 'tight' : 'over', `${Math.round(m.data.ratio * 100)}% of ${fmt(m.data.gen)} Gb/day`, 'How much of the science data your antenna can send home each day. Data that does not fit is lost.');
  const survive = hudRow('time', 'Must survive', m.time.dragLimited ? 'over' : 'info', `${m.time.years} years${m.time.transitDays ? ` + ${m.time.transitDays} days travel` : ''}`, m.time.dragLimited ? 'In low orbit without thrusters, air drag pulls you down after about 2 years.' : 'Not a timer: your spacecraft must keep working this long once it arrives.');
  const sci = !d.instruments.length || !d.orbit
    ? hudRow('science', 'Science', 'none', `0 of ${m.science.goal} to win`, 'Pick an orbit and instruments to see your expected science.')
    : hudRow('science', 'Science', m.science.est >= m.science.goal ? 'good' : m.science.est >= m.science.goal * 0.8 ? 'tight' : 'over', `${fmt(m.science.est)} of ${m.science.goal} to win`, 'Expected science if everything works. You need the goal to win.');
  $('#resources').innerHTML = `<div class="hud-phase">${icon('time')}${phaseLine()}</div><div class="hud-title">${m.sc.icon} ${m.sc.name}</div>${weight}${power}${money}${data}${survive}${sci}`;
  const nx = nextStep() || { what: 'Launch your mission!', where: 'Launch Complex', station: 'launch' };
  G.guideStation = nx.station;
  // Quest tracker at the bottom centre: what to do, where, and an arrow + distance (updated every frame).
  $('#quest').innerHTML = `<div class="gd-arrow" id="gdArrow"><svg viewBox="0 0 24 24"><path d="M12 3l7 16-7-4-7 4z"/></svg></div>
    <div class="gd-text"><div class="gd-what">${esc(nx.what)}</div><div class="gd-where">${esc(nx.where)} · <span id="gdDist">…</span></div></div>`;
  $('#players').innerHTML = G.players.length > 1 ? G.players.map((p, i) => `<div class="pchip ${i === G.active ? 'active' : ''}" style="border-color:${i === G.active ? p.color : 'transparent'}">
    <b style="color:${p.color}">${esc(p.name)}</b> ${p.roles.map(r => ROLES[r].icon).join('')}${i === G.active ? ' <span class="small">(Tab ⇄)</span>' : ''}</div>`).join('') : '';
}

/** Point the guide arrow at the next building, relative to where the camera looks. 1 world unit ≈ 1 m. */
function updateGuide() {
  const st = STATIONS.find(s => s.id === G.guideStation), arrow = document.getElementById('gdArrow'), dist = document.getElementById('gdDist');
  if (!st || !arrow || !dist) return;
  const p = world.player.pos, dx = st.zx - p.x, dz = st.zz - p.z, d = Math.hypot(dx, dz);
  const fwdX = -Math.sin(world.cam.yaw), fwdZ = -Math.cos(world.cam.yaw);           // camera's forward on the ground
  const ang = Math.atan2(fwdX * dz - fwdZ * dx, fwdX * dx + fwdZ * dz);              // signed angle forward → target
  arrow.style.transform = `rotate(${(ang * 180 / Math.PI).toFixed(0)}deg)`;
  const txt = d < 6 ? 'you are here · press E' : `${Math.round(d)} m`;
  if (dist.textContent !== txt) dist.textContent = txt;
  $('#quest').classList.toggle('arrived', d < 6);
}

// ── Station menus (game-style loadout) ────────────────────
function openPanel(id, cat = null) {
  G.panel = id; G.panelCat = cat; G.panelSel = null; world.focusOn(id);
  if (id === 'control') G.briefed = true;
  $('#panel').classList.remove('hidden'); $('#prompt').classList.add('hidden');
  renderHUD(); renderPanel();
}
function closePanel(silent) {
  G.panel = null; world.focus = null; $('#panel').classList.add('hidden');
  if (!silent) renderHUD();
}
function stationCats(id) {
  const sc = G.design.scenario;
  if (id === 'hangar') return catsFor('hangar', sc);
  if (id === 'ground') return [...catsFor('ground', sc), 'duty'];
  if (id === 'lab') return ['instruments'];
  if (id === 'launch') return ['orbit', 'lv', 'go'];
  return ['brief', 'review', 'team'];
}
const isChosen = cat => cat === 'instruments' ? G.design.instruments.length > 0 : cat === 'duty' ? true : INFO_CATS.includes(cat) ? null : !!G.design[cat];

function optionsFor(cat) {
  const d = G.design, orb = d.orbit ? ORBITS[d.orbit] : null, sc = SCENARIOS[d.scenario];
  if (cat === 'orbit') return Object.entries(ORBITS).map(([id, o]) => {
    const f = orbitFit(sc, id);
    return { id, name: o.name, short: o.alt, desc: o.desc, tag: f >= 0.9 ? 'Best fit' : f < 0.3 ? 'Poor fit' : '',
      stats: [['Mission fit', Math.round(f * 100), '%', 'hi'], ['Time in shadow', Math.round(o.eclipse * 100), '%', 'lo'], ['Travel time', o.transit, ' days', 'lo'], ['Engine Δv needed', o.dv, ' m/s', 'lo']] };
  });
  if (cat === 'lv') return Object.entries(LAUNCHERS).map(([id, l]) => {
    const cap = d.orbit ? l.cap[d.orbit] : l.cap.LEO;
    return { id, name: l.name, short: l.cls, desc: l.desc,
      tag: d.orbit && cap === 0 ? "Can't reach" : d.orbit && cap < G.m.mass.total ? 'Too weak' : '',
      stats: [[d.orbit ? `Can lift to ${d.orbit}` : 'Can lift to low orbit', cap, ' kg', 'hi'], ['Reliability', Math.round(l.rel * 100), '%', 'hi'], ['Price', l.cost, ' $M', 'lo']] };
  });
  if (cat === 'instruments') return INSTRUMENTS.map(i => {
    const rel = relevance(sc, i.id);
    return { id: i.id, name: i.name, short: i.desc.split('.')[0], desc: i.desc, on: d.instruments.includes(i.id),
      tag: rel >= 0.9 ? 'Key for mission' : rel < 0.3 ? 'Low value here' : '',
      stats: [['Science for this mission', Math.round(i.sci * rel), '', 'hi'], ['Aiming needed', Math.round(i.point * 100), '%', 'lo'], ['Data per day', i.data, ' Gb', 'lo'], ['Power', i.power, ' W', 'lo'], ['Weight', i.mass, ' kg', 'lo'], ['Price', i.cost, ' $M', 'lo']] };
  });
  return PARTS[cat].options.map(o => {
    const st = [];
    switch (cat) {
      case 'bus': st.push(['Can carry', o.maxPayload, ' kg', 'hi'], ['Own power use', o.base, ' W', 'lo']); break;
      case 'power': { const here = o.rtg ? o.gen : orb ? o.gen * orb.sun * (1 - orb.eclipse) : o.gen * 0.62; st.push([orb ? `Power made at ${d.orbit}` : 'Power made (average)', Math.round(here), ' W', 'hi']); break; }
      case 'battery': st.push(['Stored energy', o.wh, ' Wh', 'hi']); break;
      case 'computer': st.push(['Radiation toughness', Math.round(100 / o.fault), '', 'hi'], ['Storage', o.storage, ' Gb', 'hi'], ['Power use', o.power, ' W', 'lo']); break;
      case 'adcs': st.push(['Aiming precision', Math.round((o.magnetic && orb && !orb.magOk ? 0.15 : o.pointing) * 100), '%', 'hi'], ['Power use', o.power, ' W', 'lo']); break;
      case 'prop': st.push(['Δv (speed change)', o.dv, ' m/s', 'hi']); break;
      case 'rover': st.push(['Battery', o.battWh, ' Wh', 'hi'], ['Speed', o.speed, ' m/h', 'hi']); break;
      case 'comms': st.push([orb ? `Data rate at ${d.orbit}` : 'Data rate near Earth', orb ? o.rate[d.orbit] : o.rate.LEO, ' Mbps', 'hi'], ['Power use', o.power, ' W', 'lo']); break;
      case 'gs': st.push(['Contact per day', orb ? o.hours[d.orbit] : o.hours.LEO, ' h', 'hi'], ['Signal strength', orb ? o.gain[d.orbit] : o.gain.LEO, '×', 'hi'], ['Price per year', o.costYr, ' $M', 'lo']); break;
    }
    if (o.mass !== undefined && o.mass > 0) st.push(['Weight', o.mass, ' kg', 'lo']);
    if (o.cost !== undefined) st.push(['Price', o.cost, ' $M', 'lo']);
    let tag = '';
    if (cat === 'prop' && orb?.insertion) tag = o.dv >= orb.dv ? 'Enough Δv' : 'Not enough Δv';
    if (cat === 'adcs' && o.magnetic && orb && !orb.magOk) tag = `No use at ${d.orbit}`;
    if (cat === 'comms' && orb && o.rate[d.orbit] === 0) tag = `No signal at ${d.orbit}`;
    return { id: o.id, name: o.name, short: o.desc.split('.')[0], desc: o.desc, tag, stats: st };
  });
}

function changeFor(cat, id) {
  if (cat === 'instruments') { const s = new Set(G.design.instruments); s.has(id) ? s.delete(id) : s.add(id); return { instruments: [...s] }; }
  return { [cat]: id };
}
const stem = c => c.label.split('(')[0].trim();
function impactHTML(change) {
  const a = G.m, b = evaluate({ ...G.design, ...change });
  const rows = [
    ['Weight', a.mass.total, b.mass.total, ' kg', 'lo'],
    ['Spare power', a.power.genAvg - a.power.cons, b.power.genAvg - b.power.cons, ' W', 'hi'],
    ['Money left', a.cost.reserve, b.cost.reserve, ' $M', 'hi'],
    ['Data sent home', Math.round(a.data.ratio * 100), Math.round(b.data.ratio * 100), '%', 'hi'],
    ['Science', a.science.est, b.science.est, '', 'hi'],
  ];
  const fixed = a.blocking.filter(c => !b.blocking.some(x => stem(x) === stem(c)));
  const added = b.blocking.filter(c => !a.blocking.some(x => stem(x) === stem(c)));
  return `<div class="imps">${rows.map(([n, x, y, u, dir]) => {
    const dl = y - x, flat = Math.abs(dl) < 0.05, cls = flat ? '' : (dl > 0) === (dir === 'hi') ? 'up' : 'down';
    return `<div class="imp"><span>${n}</span><b>${val(y, u)}</b><em class="${cls}">${flat ? '·' : (dl > 0 ? '+' : '−') + val(Math.abs(dl), u === ' $M' ? u : '')}</em></div>`;
  }).join('')}</div>${fixed.map(c => `<div class="fix ok">✓ Fixes: ${esc(stem(c))}</div>`).join('')}${added.map(c => `<div class="fix bad">✕ New problem: ${esc(stem(c))}</div>`).join('')}`;
}

function renderPanel() {
  const id = G.panel, st = STATIONS.find(s => s.id === id), cats = stationCats(id);
  if (!cats.includes(G.panelCat)) G.panelCat = cats.find(c => isChosen(c) === false) || cats[0];
  const cat = G.panelCat, editable = canEdit(st.role), owner = ownerOf(st.role);
  const tabs = cats.map(c => { const ch = isChosen(c); return `<button class="lo-tab ${c === cat ? 'on' : ''}" data-tab="${c}">${icon(c)}<span>${CAT_LABEL[c]}</span>${ch === true ? '<i class="ok">✓</i>' : ch === false ? '<i class="todo"></i>' : ''}</button>`; }).join('');
  const body = INFO_CATS.includes(cat) ? infoView(cat, editable) : cat === 'duty' ? dutyView(editable) : pickerView(cat, editable);
  $('#panel').innerHTML = `<div class="lo">
    <header class="lo-head">${icon(cats[0], 'big')}<div><h2>${st.name}</h2><div class="lo-sub">${roleTag(st.role)}${team() ? ` <span class="small">${esc(owner.name)}</span>` : ''}</div></div>
      <button class="lo-close" data-act="close" aria-label="Close">✕</button></header>
    ${editable ? '' : `<div class="lo-lock">🔒 View only: this belongs to the ${ROLES[st.role].name}. Press <kbd>Tab</kbd> to pass the keyboard to ${esc(owner.name)}.</div>`}
    <div class="lo-body"><nav class="lo-tabs">${tabs}</nav>${body}</div></div>`;
}

function pickerView(cat, editable) {
  const opts = optionsFor(cat), d = G.design, multi = cat === 'instruments';
  const isOn = o => multi ? o.on : d[cat] === o.id;
  const focus = opts.find(o => o.id === G.panelSel) || opts.find(isOn) || opts[0];
  const max = {}; opts.forEach(o => o.stats.forEach(([n, v]) => { max[n] = Math.max(max[n] || 0, v); }));
  const tiles = opts.map((o, i) => `<button class="lo-tile ${o.id === focus.id ? 'focus' : ''} ${isOn(o) ? 'equipped' : ''}" data-pick="${o.id}">
      ${multi || cat === 'orbit' ? '' : `<span class="tier">${ROMAN[i] || ''}</span>`}<div class="tile-art">${illustration(cat, o.id)}</div><b>${esc(o.name)}</b><small>${esc(o.short)}</small>
      ${o.tag ? `<span class="tg ${GOOD_TAGS.has(o.tag) ? 'g' : 'b'}">${o.tag}</span>` : ''}${isOn(o) ? `<span class="eq">${multi ? '✓ On board' : '✓ Equipped'}</span>` : ''}</button>`).join('');
  const on = isOn(focus);
  const action = multi ? (on ? 'Remove from spacecraft' : 'Add to spacecraft') : on ? 'Equipped' : `Equip ${focus.name}`;
  return `<section class="lo-main"><p class="lo-hint">${CAT_HINT[cat]}</p><div class="lo-grid">${tiles}</div></section>
    <aside class="lo-detail">
      <div class="detail-art">${illustration(cat, focus.id)}</div>
      <div class="lo-dhead"><div><h3>${esc(focus.name)}</h3>${focus.tag ? `<span class="tg ${GOOD_TAGS.has(focus.tag) ? 'g' : 'b'}">${focus.tag}</span>` : ''}</div></div>
      <p class="lo-desc">${esc(focus.desc)}</p>
      <div class="stats">${focus.stats.map(([n, v, u, dir]) => `<div class="stat"><span>${n}</span><div class="sbar"><i class="${dir}" style="width:${max[n] ? Math.max(4, v / max[n] * 100) : 0}%"></i></div><b>${val(v, u)}</b></div>`).join('')}</div>
      ${on && !multi ? '' : `<h4>${multi && on ? 'If you remove it' : 'If you pick it'}</h4>${impactHTML(changeFor(cat, focus.id))}`}
      <button class="btn big lo-equip ${on && !multi ? 'done' : ''}" data-equip="${focus.id}" ${editable && !(on && !multi) ? '' : 'disabled'}>${action}</button>
    </aside>`;
}

function dutyView(editable) {
  const d = G.design;
  return `<section class="lo-main"><p class="lo-hint">${CAT_HINT.duty}</p>
    <div class="duty"><div class="duty-val">${d.duty}%</div><input type="range" min="20" max="100" step="5" value="${d.duty}" data-duty ${editable ? '' : 'disabled'} aria-label="Observing time">
    <div class="duty-scale"><span>20% · saves power and data</span><span>100% · most science</span></div></div></section>
    <aside class="lo-detail"><h4>Right now</h4>${impactHTML({})}</aside>`;
}

// where to go to fix each check
function fixTarget(label) {
  const L = label.toLowerCase(), d = G.design;
  if (L.includes('subsystems')) { const h = catsFor('hangar', d.scenario).find(k => !d[k]); return h ? ['hangar', h] : ['ground', catsFor('ground', d.scenario).find(k => !d[k])]; }
  const map = [['orbit and launch', 'launch', 'orbit'], ['instrument', 'lab', 'instruments'], ['bus can carry', 'hangar', 'bus'], ['can reach', 'launch', 'lv'], ['rocket can lift', 'launch', 'lv'], ['δv', 'hangar', 'prop'], ['ion engine', 'hangar', 'power'],
    ['budget', 'launch', 'lv'], ['power positive', 'hangar', 'power'], ['battery', 'hangar', 'battery'], ['downlink', 'ground', 'comms'], ['pointing', 'hangar', 'adcs'], ['magnetorquers', 'hangar', 'adcs'], ['orbit suits', 'launch', 'orbit'], ['air drag', 'hangar', 'prop'], ['science estimate', 'lab', 'instruments']];
  const hit = map.find(([k]) => L.includes(k)); return hit ? [hit[1], hit[2]] : ['control', 'review'];
}
const fixBtn = c => { const [s, k] = fixTarget(c.label); return `<button class="btn small-btn" data-goto="${s}:${k}">Fix →</button>`; };

function infoView(cat, editable) {
  const m = G.m, d = G.design, sc = m.sc;
  if (cat === 'brief') {
    const ms = MISSIONS.filter(x => x.tags.includes(sc.id));
    return `<section class="lo-main wide"><div class="brief">
      <div class="brief-ic">${sc.icon}</div><div><div class="lo-eyebrow">${sc.diff} · ${DIFFICULTY[d.difficulty].name}</div><h3>${sc.name}</h3><p>${sc.brief}</p></div></div>
      <div class="goals"><div><span>Win</span><b>${sc.goal} science</b></div><div><span>Money limit</span><b>$${fmt(m.cost.budget)}M</b></div><div><span>Must survive</span><b>${sc.years} years</b></div></div>
      <div class="tipcard">💡 ${sc.tip}</div>
      ${ms.length ? `<h4>Real NASA missions like this</h4><div class="chips2">${ms.map(x => `<details class="mchip"><summary>${x.name} <span class="small">${x.year}</span></summary><p>${x.fact}</p><p class="small">Lesson: ${x.lesson}</p></details>`).join('')}</div>` : ''}
    </section>`;
  }
  if (cat === 'review') {
    const warns = m.checks.filter(c => !c.ok && c.level !== 'block');
    return `<section class="lo-main wide">
      <div class="rv-sum ${m.blocking.length ? 'bad' : 'ok'}">${m.blocking.length ? `${m.blocking.length} thing${m.blocking.length > 1 ? 's' : ''} must be fixed before launch` : 'Ready to launch'}</div>
      ${m.blocking.map(c => `<div class="rv bad"><span>✕</span><div><b>${esc(stem(c))}</b><small>${esc(c.why)}</small></div>${fixBtn(c)}</div>`).join('')}
      ${warns.length ? `<h4>Allowed, but it will hurt the mission</h4>${warns.map(c => `<div class="rv warn"><span>!</span><div><b>${esc(stem(c))}</b><small>${esc(c.why)}</small></div>${fixBtn(c)}</div>`).join('')}` : ''}
      <h4>Concept maturity <span class="small">(NASA/JPL CML)</span></h4><div class="cml2">${CML.map(c => `<span class="${cmlLevel() >= c.n ? 'on' : ''}" title="${esc(c.desc)}">${c.n} · ${c.name}</span>`).join('')}</div>
    </section>`;
  }
  if (cat === 'team') {
    return `<section class="lo-main wide">
      <h4>Role goals</h4><div class="roles">${Object.entries(ROLES).map(([k, r]) => `<div class="role ${m.roleGoals[k] ? 'ok' : ''}"><span>${r.icon}</span><div><b>${r.name}</b>${team() ? ` <span class="small">${esc(ownerOf(k).name)}</span>` : ''}<small>${r.goal}</small></div><i>${m.roleGoals[k] ? '✓' : ''}</i></div>`).join('')}</div>
      ${team() ? `<h4>Team sign-off</h4><div class="row">${G.players.map((p, i) => `<button class="btn ${G.signoffs[i] ? '' : 'ghost'}" data-sign="${i}" style="${G.signoffs[i] ? `background:${p.color}` : ''}">${G.signoffs[i] ? '✔ ' : ''}${esc(p.name)}</button>`).join('')}</div>` : ''}
      <div class="row" style="margin-top:12px"><button class="btn ghost" data-act="share">🔗 Copy link to this design</button></div>
      <h4>Leaderboard</h4>${leaderboardHTML(sc.id)}
    </section>`;
  }
  // go (launch)
  const ready = m.blocking.length === 0 && allSigned();
  const lim = m.mass.lvCap;
  return `<section class="lo-main wide">
    <div class="go-grid">
      <div class="go-card"><span>Destination</span><b>${d.orbit ? ORBITS[d.orbit].name : 'not chosen'}</b></div>
      <div class="go-card"><span>Rocket</span><b>${d.lv ? LAUNCHERS[d.lv].name : 'not chosen'}</b></div>
      <div class="go-card"><span>Weight</span><b>${fmt(m.mass.total)}${lim ? ` of ${fmt(lim)}` : ''} kg</b></div>
      <div class="go-card"><span>Expected science</span><b>${fmt(m.science.est)} of ${sc.goal}</b></div>
    </div>
    ${m.blocking.map(c => `<div class="rv bad"><span>✕</span><div><b>${esc(stem(c))}</b></div>${fixBtn(c)}</div>`).join('')}
    ${!allSigned() && !m.blocking.length ? '<div class="rv warn"><span>✍</span><div><b>Every player must sign off at Mission Control</b></div><button class="btn small-btn" data-goto="control:team">Go →</button></div>' : ''}
    <button class="btn big go launchbtn" data-act="launch" ${ready && canEdit('lead') ? '' : 'disabled'}>🚀 LAUNCH</button>
    ${!canEdit('lead') ? '<p class="small">Only the Mission Lead can give the GO.</p>' : ''}
    ${d.orbit ? `<details class="phys"><summary>The physics of this orbit</summary><div class="small">${physicsHTML(d.orbit)}</div></details>` : ''}
  </section>`;
}

$('#panel').addEventListener('click', e => {
  if (e.target.id === 'panel') return closePanel(); // click on the dim backdrop
  const t = e.target.closest('button'); if (!t || t.disabled) return;
  const ds = t.dataset;
  if (ds.act === 'close') return closePanel();
  if (ds.act === 'launch') return beginLaunch();
  if (ds.act === 'share') return shareDesign();
  if (ds.tab) { G.panelCat = ds.tab; G.panelSel = null; return renderPanel(); }
  if (ds.pick) { G.panelSel = ds.pick; return renderPanel(); }
  if (ds.goto) { const [s, k] = ds.goto.split(':'); return openPanel(s, k); }
  if (ds.equip) {
    const cat = G.panelCat, ch = changeFor(cat, ds.equip);
    setDesign(ch);
    if (cat !== 'instruments') {
      const cats = stationCats(G.panel);
      const nxt = cats.find(c => isChosen(c) === false);
      toast(`✓ ${CAT_LABEL[cat]} equipped`, 1600);
      if (nxt) { G.panelCat = nxt; G.panelSel = null; renderPanel(); }
    }
    return;
  }
  if (ds.sign !== undefined) {
    if (G.m.blocking.length) return toast('Fix the launch problems before signing off.', 2500);
    G.signoffs[+ds.sign] = !G.signoffs[+ds.sign]; recompute();
  }
});
$('#panel').addEventListener('input', e => {
  if (e.target.dataset.duty === undefined) return;
  G.design.duty = +e.target.value; G.signoffs = {}; G.m = evaluate(G.design); renderHUD();
  const v = $('#panel .duty-val'); if (v) v.textContent = G.design.duty + '%';
  const det = $('#panel .lo-detail'); if (det) det.innerHTML = `<h4>Right now</h4>${impactHTML({})}`;
});
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
  const s = G.sim, owner = ownerOf(ev.role), rec = ev.rec ? ev.rec(s) : -1;
  const card = (c, i) => {
    const ok = !c.need || c.need(s), risk = c.risk ? c.risk(s) : null;
    return `<button class="ev-choice ${i === rec && ok ? 'rec' : ''}" data-c="${i}" ${ok ? '' : 'disabled'}>
      ${i === rec && ok ? '<span class="ev-rec">★ Recommended for your spacecraft</span>' : ''}
      <b class="ev-label">${esc(c.label)}</b>
      ${ok ? `<span class="ev-gain">✓ ${esc(c.gain(s))}</span><span class="ev-cost">✕ ${esc(c.cost(s))}</span>
        ${risk !== null ? `<span class="ev-risk"><span>Chance it goes wrong: <b>${Math.round(risk * 100)}%</b></span><i><em style="width:${Math.max(3, risk * 100)}%"></em></i></span>` : ''}`
      : `<span class="ev-cost">Not possible: ${esc(c.why)}</span>`}</button>`;
  };
  $('#modal').innerHTML = `<div class="box ev">
    <div class="ev-top"><span class="ev-icon">${ev.icon || '⚠️'}</span><div><div class="ev-day">Day ${s.day} · ${roleTag(ev.role)} decides${team() ? ` · <b style="color:${owner.color}">${esc(owner.name)}</b>, talk it over with the team` : ''}</div><h2>${esc(ev.title)}</h2></div></div>
    <p class="ev-what">${esc(ev.what)}</p>
    <div class="ev-why"><b>What this means for your spacecraft</b><span>${esc(ev.why(s))}</span></div>
    <div class="ev-choices">${ev.choices.map(card).join('')}</div>
    ${REAL_CASES[ev.id] ? `<details class="ev-real"><summary>📚 This really happened</summary><p>${REAL_CASES[ev.id]}</p></details>` : ''}</div>`;
  $('#modal').classList.remove('hidden');
  $('#modal').onclick = e => {
    const b = e.target.closest('[data-c]'); if (!b || b.disabled) return;
    const res = s.resolve(ev, ev.choices[+b.dataset.c]);
    // Outcome step: say what happened before the clock runs again.
    $('#modal').innerHTML = `<div class="box ev ev-out ${res.good ? 'good' : 'bad'}"><span class="ev-icon">${res.good ? '✅' : '⚠️'}</span>
      <h2>${res.good ? 'Done' : 'That went badly'}</h2><p>${esc(res.text)}</p><button class="btn big" data-go>Continue the mission</button></div>`;
    $('#modal').onclick = e2 => {
      if (!e2.target.closest('[data-go]')) return;
      $('#modal').classList.add('hidden'); G.paused = false; if (G.speed > 10) G.speed = 10; renderSimCtl(); renderSimUI();
    };
  };
}

// ── Shadowline (Moon mission only) ────────────────────────
function afterFlight() {
  G.surface = null;
  if (G.sim.d.scenario !== 'lunar' || G.sim.launchFailed || !G.sim.d.rover) return showReport();
  G.mode = 'surface';
  $('#simui').classList.add('hidden'); $('#modal').classList.add('hidden');
  toast('🌙 <b>Rover touchdown.</b> Your orbiter mapped the poles. Now plan a route into the dark crater.', 6000);
  shadow.start(G.sim.d, G.sim.d.difficulty, result => { G.surface = result; showReport(); });
}

// ── Report ────────────────────────────────────────────────
function showReport() {
  G.mode = 'report';
  $('#simui').classList.add('hidden'); $('#modal').classList.add('hidden');
  const s = G.sim, m = s.m, r = s.result();
  const goals = { ...m.roleGoals, lead: r.finalReserve / m.cost.budget >= 0.10 };
  const sc = scoreResult(m, r, goals, team());
  const notes = analyze(s.d, m, r);
  const surf = G.surface;
  if (surf && sc.parts.length) {
    // Moon mission: orbiter counts 70%, the Shadowline rover 300 points.
    const ss = surfaceScore(surf);
    sc.parts = sc.parts.map(p => ({ ...p, pts: Math.round(p.pts * 0.7), max: Math.round(p.max * 0.7) }));
    sc.parts.push({ label: 'Shadowline rover', pts: ss.pts, max: ss.max, note: `${surf.evSent} / ${surf.goal} ice evidence home · rover ${surf.state === 'safe' ? 'safe' : surf.state === 'dead' ? 'lost' : surf.state}` });
    sc.total = sc.parts.reduce((a, p) => a + p.pts, 0);
    sc.grade = sc.total >= 850 ? 'S' : sc.total >= 700 ? 'A' : sc.total >= 550 ? 'B' : sc.total >= 400 ? 'C' : 'D';
    if (surf.state !== 'safe' || surf.evSent < surf.goal) sc.status = sc.status === 'MISSION SUCCESS' ? 'PARTIAL SUCCESS' : sc.status;
    notes.push(...surfaceAnalysis(surf));
  }
  const crew = G.players.map(p => p.name).join(' & ');
  lbSave({ sc: m.sc.id, name: crew, score: sc.total, grade: sc.grade, status: sc.status, t: Date.now() });
  const [statusWord, tone] = { 'MISSION SUCCESS': ['Mission success!', 'ok'], 'PARTIAL SUCCESS': ['Partly successful', 'mid'], 'MISSION LOSS': ['Mission failed', 'bad'], 'LAUNCH FAILURE': ['Lost at launch', 'bad'] }[sc.status] || [sc.status, 'mid'];
  const summary = r.launchFailed
    ? `The ${m.lv.name} failed on the way up. Even reliable rockets sometimes fail.`
    : `Your spacecraft ${r.lifeFrac >= 0.999 ? `worked for the full ${m.time.years} years` : `stopped after ${fmt(r.lifeFrac * m.time.years)} of ${m.time.years} years`} and collected ${sciText(r.science, r.goal)} of the ${r.goal} science you needed (${Math.floor(r.science / r.goal * 100)}%)${surf ? `. The Moon rover sent home ${surf.evSent} of ${surf.goal} ice evidence and ${surf.state === 'safe' ? 'survived' : 'was lost'}` : ''}.`;
  const good = notes.filter(n => n.type === 'good').slice(0, 3), bad = notes.filter(n => n.type === 'bad').slice(0, 3), tip = notes.find(n => n.type === 'tip');
  const PLAIN = { 'Science return': ['Science', 'Did you collect enough science?'], 'Mission lifetime': ['Lifetime', 'Did the spacecraft keep working?'], 'Budget efficiency': ['Money left', 'Did you keep money spare?'],
    'Engineering goals': ['Role goals', "Did you meet each role's goal?"], 'Team role goals': ['Role goals', 'Did each player meet their goal?'], 'Shadowline rover': ['Moon rover', 'Did the rover get ice data home and survive?'] };
  const near = !r.launchFailed && closestMissions(s.d, m.mass.total)[0];
  const li = n => `<li>${esc(n.text)}</li>`;
  $('#screen').innerHTML = `<div class="screenbg"><div class="wrap rp">
    <div class="rp-hero ${tone}">
      <div class="rp-grade">${sc.grade}</div>
      <div class="rp-hero-txt"><div class="rp-eyebrow">${m.sc.icon} ${m.sc.name} · ${DIFFICULTY[s.d.difficulty].name}</div><h1>${statusWord}</h1><p>${summary}</p></div>
      <div class="rp-total"><b>${sc.total}</b><span>of 1000 points</span></div>
    </div>
    <div class="rp-scale">${[['S', 850], ['A', 700], ['B', 550], ['C', 400], ['D', 0]].map(([g, n]) => `<span class="${g === sc.grade ? 'on' : ''}"><b>${g}</b>${n ? n + '+' : 'below 400'}</span>`).join('')}</div>
    ${sc.parts.length ? `<h2 class="rp-h">Where your points came from</h2>
    <div class="rp-scores">${sc.parts.map(p => { const f = p.pts / p.max, c = f >= 0.7 ? 'ok' : f >= 0.35 ? 'mid' : 'bad', [name, q] = PLAIN[p.label] || [p.label, '']; return `<div class="rp-score ${c}"><div class="rp-sh"><b>${name}</b><span>${p.pts} / ${p.max}</span></div><div class="rp-bar"><i style="width:${Math.max(2, f * 100)}%"></i></div><small><b>${q}</b> ${esc(p.note)}</small></div>`; }).join('')}</div>` : ''}
    <div class="rp-cols">
      <div class="rp-card ok"><h3>✓ What went well</h3>${good.length ? `<ul>${good.map(li).join('')}</ul>` : '<p class="small">Nothing yet. Every engineer starts here.</p>'}</div>
      <div class="rp-card bad"><h3>✕ What to fix next time</h3>${bad.length ? `<ul>${bad.map(li).join('')}</ul>` : '<p class="small">No big problems. Try a harder difficulty!</p>'}</div>
    </div>
    ${tip ? `<div class="rp-tip">💡 <b>Try this next time:</b> ${esc(tip.text)}</div>` : ''}
    ${near ? `<div class="rp-card"><h3>Your mission vs a real NASA mission</h3><div class="rp-vs"><div><span>Your design</span><b>${fmt(m.mass.total)} kg · ${m.orbit.name}</b></div><div class="vs">vs</div><div><span>${near.ms.name} (${near.ms.year})</span><b>${near.ms.mass ? `~${near.ms.mass.toLocaleString()} kg · ` : ''}${near.ms.orbitText}</b></div></div><p class="small">💡 ${near.ms.lesson}</p></div>` : ''}
    <div class="rp-actions">
      <button class="btn big" id="redesign">🔧 Improve my design</button>
      <button class="btn ghost" id="again">🎲 Fly it again</button>
      <button class="btn ghost" id="share">🔗 Share</button>
      <button class="btn ghost" id="menu">🏠 New mission</button></div>
    <details class="rp-more"><summary>See all details</summary>
      <h3>Every reason</h3><div class="bullets">${notes.map(n => `<div class="${n.type}">${n.type === 'good' ? '✅' : n.type === 'bad' ? '❌' : '💡'} ${esc(n.text)}</div>`).join('')}</div>
      <h3>Role goals</h3>${Object.entries(ROLES).map(([k, ro]) => `<div class="check"><span class="ic">${goals[k] ? '✅' : '❌'}</span><div>${ro.icon} ${ro.name}${team() ? ` <span class="small">(${esc(ownerOf(k).name)})</span>` : ''}<div class="why">${ro.goal}</div></div></div>`).join('')}
      <h3>Your design</h3><p class="small">${m.orbit.name} on a ${m.lv.name} · ${m.P.bus.name}, ${m.P.power.name}, ${m.P.battery.name}, ${m.P.computer.name}, ${m.P.adcs.name}, ${m.P.prop.name} · ${m.P.comms.name} + ${m.P.gs.name} · ${m.insts.map(i => i.name).join(', ')} · observing ${s.d.duty}%</p>
      <h3>Compared with real NASA missions</h3>${compareHTML(s.d, m)}
      <h3>Mission log</h3><div style="max-height:220px;overflow:auto">${s.log.map(l => `<div class="small" style="padding:3px 0">Day ${l.day}: ${esc(l.t)}</div>`).join('')}</div>
      <h3>Leaderboard</h3>${leaderboardHTML(m.sc.id)}
    </details>
  </div></div>`;
  $('#redesign').onclick = () => { G.surface = null; $('#screen').innerHTML = ''; G.mode = 'world'; G.signoffs = {}; world.resetLaunch(G.design.lv); world.focus = null; $('#hud').classList.remove('hidden'); recompute(); };
  $('#again').onclick = () => { G.surface = null; $('#screen').innerHTML = ''; G.m = evaluate(G.design); beginLaunch(); };
  $('#share').onclick = shareDesign;
  $('#menu').onclick = () => { world.resetLaunch(null); showMenu(); };
}

// ── Main loop ─────────────────────────────────────────────
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (G.mode === 'surface') {
    shadow.update(dt);
    draw(shadow.scene, shadow.camera, 0.8, 1.0);
  } else if (G.mode === 'sim') {
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
    if (s.done && !G.reportTimer) { G.reportTimer = setTimeout(() => { G.reportTimer = null; afterFlight(); }, 1800); renderSimUI(); }
    draw(space.scene, space.camera, 0.9, 1.0);
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
    if (G.mode === 'world') { world.drawMinimap($('#minimap').getContext('2d'), 190, 190, true); updateGuide(); }
    draw(world.scene, world.camera, G.mode === 'launch' ? 0.9 : 0.25, 0.5);
  }
  requestAnimationFrame(frame);
}
function showReportDirect() { G.sim.done = true; showReport(); }

// ── Ask CAPCOM (AI tutor) ─────────────────────────────────
const chat = { open: false, busy: false, msgs: [] };
const QUICK = ['What should I fix first?', 'How can I raise my science score?', 'Is my design ready to launch?'];
const md = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
function toggleChat(open = !chat.open) {
  chat.open = open; $('#capcom').classList.toggle('hidden', !open); if (open) renderChat();
}
function renderChat() {
  const el = $('#capcom');
  el.innerHTML = `<div class="cc-head"><b>Ask CAPCOM</b><span class="small">AI mission controller</span><button class="close" data-cc="close">✕</button></div>
    <div class="cc-log" id="ccLog">${chat.msgs.length ? '' : `<div class="cc-msg ai">Hi, I'm CAPCOM. Ask me anything about your design. I check every number with the mission simulator before I answer.</div>`}
    ${chat.msgs.map((m, i) => `<div class="cc-msg ${m.role === 'user' ? 'me' : 'ai'}">${md(m.text)}
      ${m.tools?.length ? `<div class="cc-tools">${m.tools.map(t => `<span>ran ${esc(t)}</span>`).join('')}</div>` : ''}
      ${(m.suggestions || []).map((sg, j) => `<button class="btn small-btn" data-apply="${i}:${j}">Apply: ${esc(sg.label)}</button>`).join('')}
      ${m.mode === 'offline' ? '<div class="small">Offline CAPCOM (no AI key set): answer computed by the simulator.</div>' : ''}</div>`).join('')}
    ${chat.busy ? '<div class="cc-msg ai">Checking the numbers…</div>' : ''}</div>
    <div class="cc-quick">${QUICK.map(q => `<button data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <form class="cc-form" id="ccForm"><input id="ccInput" autocomplete="off" placeholder="Type a question…" maxlength="400" ${chat.busy ? 'disabled' : ''}><button class="btn" ${chat.busy ? 'disabled' : ''}>Send</button></form>`;
  const log = $('#ccLog'); log.scrollTop = log.scrollHeight;
  if (!chat.busy) $('#ccInput')?.focus();
}
async function sendChat(q) {
  q = q.trim(); if (!q || chat.busy) return;
  chat.msgs.push({ role: 'user', text: q }); chat.busy = true; renderChat();
  try {
    const res = await fetch('/api/capcom', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ design: G.design, messages: chat.msgs.map(m => ({ role: m.role, text: m.text })).slice(-10) }) });
    const j = await res.json();
    chat.msgs.push({ role: 'assistant', text: j.text || j.error || 'No answer.', tools: j.tools, suggestions: j.suggestions, mode: j.mode });
  } catch {
    chat.msgs.push({ role: 'assistant', text: 'I lost the radio link to the server. Check your connection and try again.' });
  }
  chat.busy = false; renderChat();
}
$('#capcom').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.cc === 'close') return toggleChat(false);
  if (b.dataset.q) return sendChat(b.dataset.q);
  if (b.dataset.apply) {
    const [i, j] = b.dataset.apply.split(':').map(Number);
    const sg = chat.msgs[i]?.suggestions?.[j]; if (!sg) return;
    setDesign(sg.changes); toast(`Applied: ${esc(sg.label)}`, 2500); renderChat();
  }
});
$('#capcom').addEventListener('submit', e => { e.preventDefault(); const inp = $('#ccInput'); sendChat(inp.value); });

// debug hook for testing in the console
window.MI = { shadow, afterFlight, G, setDesign, openPanel, beginLaunch, evaluate, world, showReport, showEvent, toggleChat, sendChat };

showMenu();
recompute();
frame();
