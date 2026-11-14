// Shadowline 3D scene + route planner + playback. The engine (sim/surface.js) decides everything;
// this file only draws what it computed: lit ground = sunlit cells, red line = no radio contact.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as S from '../sim/surface.js';
import { planetTexture } from './models.js';

const U = 0.1;            // scene units per metre
const VEX = 1.6;          // vertical exaggeration so the crater reads clearly
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dirFrom = (azDeg, elDeg) => { const az = azDeg * Math.PI / 180, el = elDeg * Math.PI / 180; return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)); };

export class Shadowline {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 1, 8000);
    this.active = false; this.terrain = null;
    this.overlay = { earth: false, ice: true };
    this.speed = 2; // simulated hours per second
    addEventListener('resize', () => { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); });
  }

  // world helpers
  w(x, y, up = 0) { const t = this.terrain; return new THREE.Vector3((x - S.SIZE / 2) * U, (S.heightAt(t, x, y) + up) * U * VEX, -(y - S.SIZE / 2) * U); }

  /** Enter the phase. onDone(result) is called when the player leaves the result screen. */
  start(design, difficulty, onDone) {
    this.design = design; this.difficulty = difficulty; this.onDone = onDone;
    this.active = true; this.phase = 'loading'; this.plan = { site: 'rim', waypoints: [], startHour: 0 }; this.result = null;
    $('#surfaceui').classList.remove('hidden');
    $('#surfaceui').innerHTML = '<div class="sl-panel"><h2>Shadowline</h2><p>Landing near the lunar south pole… computing sunlight and radio paths across the terrain.</p></div>';
    setTimeout(() => this.build(), 30); // let the message paint before the heavy terrain work
  }

  build() {
    if (!this.terrain) this.terrain = S.makeTerrain();
    const t = this.terrain, sc = this.scene;
    sc.clear();
    sc.add(new THREE.AmbientLight(0xffffff, 1.0)); // vertex colours carry the sunlight; lights add headlights only
    // stars
    const g = new THREE.BufferGeometry(), n = 2500, pos = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y); v.multiplyScalar(5000); pos.set([v.x, v.y, v.z], k * 3); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sc.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false })));
    // terrain mesh (one vertex per grid cell)
    const N = S.N, geo = new THREE.PlaneGeometry((N - 1) * S.CELL * U, (N - 1) * S.CELL * U, N - 1, N - 1);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const i = k % N, jRow = Math.floor(k / N), j = N - 1 - jRow; // PlaneGeometry rows run north→south
      p.setY(k, t.H[j * N + i] * U * VEX); this._cellOfVertex ||= new Int32Array(p.count); this._cellOfVertex[k] = j * N + i;
    }
    geo.computeVertexNormals();
    this.colors = new Float32Array(p.count * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.albedo = new Float32Array(p.count);
    for (let k = 0; k < p.count; k++) { const c = this._cellOfVertex[k], i = c % N, j = (c / N) | 0; this.albedo[k] = 0.5 + 0.06 * Math.sin(i * 0.37 + j * 0.23) + 0.04 * Math.cos(i * 0.11 - j * 0.29); }
    this.mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    sc.add(this.mesh);
    // Earth and Sun in the sky
    const earth = new THREE.Mesh(new THREE.SphereGeometry(70, 32, 20), new THREE.MeshBasicMaterial({ map: planetTexture('earth') }));
    earth.position.copy(dirFrom(S.EARTH_AZ, S.EARTH_EL + 2).multiplyScalar(3600)); sc.add(earth);
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12), new THREE.MeshBasicMaterial({ color: 0xfff4d0 }));
    sc.add(this.sun);
    // groups for plan + playback
    this.planGroup = new THREE.Group(); sc.add(this.planGroup);
    this.rover = buildRover(); this.rover.visible = false; sc.add(this.rover);
    this.signal = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: 0x4ade80, dashSize: 6, gapSize: 4 }));
    this.signal.visible = false; sc.add(this.signal);
    this.mast = this.design.relay === 'mast' ? S.mastSite(t) : null;
    if (this.mast) { const m = buildMast(); m.position.copy(this.w(this.mast.x, this.mast.y)); sc.add(m); }
    // camera + controls
    this.controls?.dispose();
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true; this.controls.maxPolarAngle = Math.PI * 0.47; this.controls.minDistance = 40; this.controls.maxDistance = 1400;
    const c = t.crater; this.controls.target.copy(this.w(c.x, c.y));
    this.camera.position.copy(this.w(c.x, c.y)).add(new THREE.Vector3(0, 520, 560));
    this.bindPointer();
    this.hour = 0; this.phase = 'plan';
    this.colorize(0); this.renderPlan(); this.drawPlan();
  }

  /** Paint the ground from the engine's sunlight: sunlit cells bright, shadow nearly black, plus overlays. */
  colorize(hour) {
    const t = this.terrain, n = this.mesh.geometry.attributes.normal, sunDir = dirFrom(S.sunAz(hour), S.SUN_EL + 3);
    const { earth, ice } = this.overlay, planning = this.phase === 'plan';
    for (let k = 0; k < n.count; k++) {
      const c = this._cellOfVertex[k], x = ((c % S.N) + 0.5) * S.CELL, y = (((c / S.N) | 0) + 0.5) * S.CELL;
      const lit = S.sunFraction(t, x, y, hour);
      const shade = Math.max(0.12, n.getX(k) * sunDir.x + n.getY(k) * sunDir.y + n.getZ(k) * sunDir.z);
      const v = this.albedo[k] * (lit * shade * 1.7 + 0.035);
      let r = v, g = v, b = v * 1.03;
      if (planning && ice && t.ice[c] > 0) { const a = 0.25 + t.ice[c] * 0.45; r = r * (1 - a) + 0.05 * a; g = g * (1 - a) + 0.45 * a; b = b * (1 - a) + 0.6 * a; }
      if (planning && earth && S.seesEarth(t, x, y)) { r *= 0.75; g *= 0.85; b = b * 0.7 + 0.12; }
      this.colors[k * 3] = r; this.colors[k * 3 + 1] = g; this.colors[k * 3 + 2] = b;
    }
    this.mesh.geometry.attributes.color.needsUpdate = true;
    this.sun.position.copy(dirFrom(S.sunAz(hour), S.SUN_EL).multiplyScalar(3500));
    this.coloredHour = hour;
  }

  bindPointer() {
    if (this._bound) return; this._bound = true;
    let down = null;
    this.canvas.addEventListener('pointerdown', e => { if (this.active) down = { x: e.clientX, y: e.clientY }; });
    this.canvas.addEventListener('pointerup', e => {
      if (!this.active || this.phase !== 'plan' || !down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
      if (moved > 6) return;
      const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), this.camera);
      const hit = ray.intersectObject(this.mesh)[0]; if (!hit) return;
      const x = hit.point.x / U + S.SIZE / 2, y = -hit.point.z / U + S.SIZE / 2;
      if (this.plan.waypoints.length >= 8) return;
      this.plan.waypoints.push({ x, y, sampleH: S.isPSR(this.terrain, x, y) ? 2 : 0 });
      this.renderPlan(); this.drawPlan();
    });
  }

  drawPlan() {
    const g = this.planGroup; g.clear();
    const t = this.terrain, site = S.landingSites().find(s => s.id === this.plan.site);
    const pts = [site, ...this.plan.waypoints];
    const line = [];
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1], d = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.max(2, Math.ceil(d / 40));
      for (let s = 0; s <= steps; s++) line.push(this.w(a.x + (b.x - a.x) * s / steps, a.y + (b.y - a.y) * s / steps, 6));
    }
    if (line.length > 1) g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(line), new THREE.LineBasicMaterial({ color: 0xffffff })));
    for (const s of S.landingSites()) {
      const sel = s.id === this.plan.site;
      const m = new THREE.Mesh(new THREE.ConeGeometry(sel ? 9 : 6, sel ? 26 : 18, 12), new THREE.MeshBasicMaterial({ color: sel ? 0x4ade80 : 0x8a94a6 }));
      m.rotation.x = Math.PI; m.position.copy(this.w(s.x, s.y, 0)).add(new THREE.Vector3(0, sel ? 16 : 12, 0)); g.add(m);
    }
    this.plan.waypoints.forEach((p, i) => {
      const last = i === this.plan.waypoints.length - 1;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 24, 12), new THREE.MeshBasicMaterial({ color: last ? 0xfbbf24 : 0x5ad1ff }));
      m.position.copy(this.w(p.x, p.y, 0)).add(new THREE.Vector3(0, 12, 0)); g.add(m);
    });
  }

  waypointInfo(p, i, last) {
    const t = this.terrain;
    const dark = S.isPSR(t, p.x, p.y) ? 'permanent shadow' : S.sunFraction(t, p.x, p.y, 0) > 0.5 ? 'sunlit now' : 'shadow now';
    return `${last ? 'Safe haven' : 'Waypoint ' + (i + 1)} · ${dark} · ${S.seesEarth(t, p.x, p.y) ? 'Earth in view' : 'no Earth'}${t.ice[(Math.floor(p.y / S.CELL)) * S.N + Math.floor(p.x / S.CELL)] > 0 ? ` · ice ${Math.round(S.iceAt(t, p.x, p.y) * 100)}%` : ''}`;
  }

  renderPlan() {
    const d = this.design, rover = d.rover === 'rover_m' ? 'VIPER-class Rover · 4,500 Wh' : 'Small Rover · 1,500 Wh';
    const relayName = { none: 'Direct to Earth only', orbiter: 'Orbiter relay (passes every 2 h)', mast: 'Rim relay mast' }[d.relay || 'none'];
    const wps = this.plan.waypoints;
    let forecast = '';
    if (this.difficulty === 'cadet' && wps.length) {
      const r = S.simulateRoute(this.terrain, d, this.plan);
      forecast = `<div class="sl-forecast">Cadet forecast: <b>${r.state === 'safe' ? 'rover survives' : 'rover is lost'}</b>, ${r.evSent} / ${r.goal} ice evidence home, lowest battery ${Math.max(0, Math.round(r.minBatt / r.battWh * 100))}%.</div>`;
    }
    $('#surfaceui').innerHTML = `<div class="sl-panel">
      <div class="sl-eyebrow">Lunar south pole · rover phase</div><h2>Shadowline</h2>
      <p class="small">${rover} · ${relayName}. Goal: send <b>${S.ICE_GOAL}</b> units of ice evidence to Earth and finish in sunlight.</p>
      <h3>1 · Landing site</h3>
      <div class="sl-sites">${S.landingSites().map(s => `<button class="${s.id === this.plan.site ? 'sel' : ''}" data-site="${s.id}"><b>${s.name}</b><span>${s.desc}</span></button>`).join('')}</div>
      <h3>2 · Route</h3>
      <p class="small">Click the ground to add waypoints. Dark cells hide ice; the <b>last</b> waypoint is your safe haven and should be in sunlight.</p>
      <div class="sl-wps">${wps.length ? wps.map((p, i) => `<div class="sl-wp"><span>${esc(this.waypointInfo(p, i, i === wps.length - 1))}</span>
        ${i === wps.length - 1 ? '' : `<span class="sl-h"><button data-dh="${i}:-1">−</button>${p.sampleH} h<button data-dh="${i}:1">+</button></span>`}<button data-del="${i}" aria-label="Remove">✕</button></div>`).join('') : '<div class="small">No waypoints yet.</div>'}</div>
      <h3>3 · Map overlays</h3>
      <div class="sl-ov"><label><input type="checkbox" data-ov="ice" ${this.overlay.ice ? 'checked' : ''}> Ice (cyan)</label><label><input type="checkbox" data-ov="earth" ${this.overlay.earth ? 'checked' : ''}> Earth in view (blue)</label></div>
      ${forecast}
      <button class="btn big go" data-go ${wps.length >= 2 ? '' : 'disabled'}>GO: drive the route</button>
      <p class="small sl-note">Terrain: procedural crater modelled on south-pole conditions (Sun ≤ 1.5° high, Earth low in the north). Real NASA Moon Trek terrain is the next step.</p></div>`;
    $('#surfaceui').onclick = e => this.onPlanClick(e);
    $('#surfaceui').onchange = e => { const k = e.target.dataset.ov; if (k) { this.overlay[k] = e.target.checked; this.colorize(0); } };
  }

  onPlanClick(e) {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const ds = b.dataset, wps = this.plan.waypoints;
    if (ds.site) { this.plan.site = ds.site; const s = S.landingSites().find(x => x.id === ds.site); this.controls.target.copy(this.w(s.x, s.y)); }
    if (ds.dh) { const [i, d] = ds.dh.split(':').map(Number); wps[i].sampleH = Math.max(0, Math.min(8, wps[i].sampleH + d)); }
    if (ds.del !== undefined) wps.splice(+ds.del, 1);
    if (ds.go !== undefined) return this.go();
    this.renderPlan(); this.drawPlan();
  }

  go() {
    this.result = S.simulateRoute(this.terrain, this.design, this.plan);
    this.phase = 'play'; this.playT = 0; this.logShown = 0; this.paused = false;
    this.rover.visible = true; this.colorize(0);
    this.renderPlay();
  }

  renderPlay() {
    $('#surfaceui').innerHTML = `<div class="sl-hud">
      <div class="sl-row"><b id="slClock">Hour 0</b><span id="slSun" class="sl-chip"></span><span id="slLink" class="sl-chip"></span></div>
      <div class="sl-bar"><span>Battery</span><div><i id="slBatt"></i></div><b id="slBattTxt"></b></div>
      <div class="sl-row small"><span id="slData"></span><span id="slEv"></span></div>
      <div id="slLog" class="sl-log"></div>
      <div class="sl-row"><button data-sp="1">1×</button><button data-sp="4">4×</button><button data-sp="12">12×</button><button data-skip>Skip to end</button></div></div>`;
    $('#surfaceui').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.sp) this.speed = +b.dataset.sp * 2; if (b.dataset.skip !== undefined) this.playT = 1e9; };
  }

  showResult() {
    const r = this.result, title = { safe: 'Rover safe in sunlight', dead: 'Rover lost in the dark', stuck: 'Rover stuck', stranded: 'Out of time' }[r.state];
    const notes = S.surfaceAnalysis(r).slice(0, 3);
    $('#surfaceui').innerHTML = `<div class="sl-panel sl-result"><div class="sl-eyebrow">Shadowline result</div><h2 class="${r.state === 'safe' ? 'ok' : 'bad'}">${title}</h2>
      <p><b>${r.evSent}</b> / ${r.goal} ice evidence reached Earth · ${r.evCollected} collected · ${r.hours} h on the surface</p>
      <div class="bullets">${notes.map(n => `<div class="${n.type}">${n.type === 'good' ? '✅' : n.type === 'bad' ? '❌' : '💡'} ${esc(n.text)}</div>`).join('')}</div>
      <button class="btn big" data-done>See the mission report</button></div>`;
    $('#surfaceui').onclick = e => { if (e.target.closest('[data-done]')) { this.stop(); this.onDone(this.result); } };
  }

  stop() { this.active = false; $('#surfaceui').classList.add('hidden'); $('#surfaceui').innerHTML = ''; }

  update(dt) {
    if (!this.active || !this.controls) return;
    this.controls.update();
    if (this.phase !== 'play') return;
    const tl = this.result.timeline, endH = tl.at(-1).h;
    this.playT = Math.min(this.playT + dt * this.speed, endH);
    // find the two samples around playT
    let k = Math.min(tl.length - 1, Math.floor(this.playT / 0.25));
    const a = tl[k], b = tl[Math.min(tl.length - 1, k + 1)], f = Math.min(1, Math.max(0, (this.playT - a.h) / 0.25));
    const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
    const p = this.w(x, y, 2), ahead = this.w(b.x + (b.x - a.x) * 4 + 0.01, b.y + (b.y - a.y) * 4, 2);
    this.rover.position.copy(p); this.rover.lookAt(ahead.x, p.y, ahead.z);
    // follow camera
    this.controls.target.lerp(p, Math.min(1, dt * 3));
    if (Math.abs(this.playT - this.coloredHour) > 0.5) this.colorize(this.playT);
    // signal line
    this.signal.visible = true;
    const to = a.link && a.via === 'relay mast' && this.mast ? this.w(this.mast.x, this.mast.y, 25) : p.clone().add(dirFrom(S.EARTH_AZ, S.EARTH_EL + 2).multiplyScalar(160));
    this.signal.geometry.setFromPoints([p.clone().add(new THREE.Vector3(0, 6, 0)), to]); this.signal.computeLineDistances();
    this.signal.material.color.set(a.link ? 0x4ade80 : 0xf87171);
    // HUD
    const el = id => document.getElementById(id);
    if (el('slClock')) {
      el('slClock').textContent = `Hour ${this.playT.toFixed(1)}`;
      el('slSun').textContent = a.sun > 0.5 ? 'In sunlight' : 'In shadow'; el('slSun').className = 'sl-chip ' + (a.sun > 0.5 ? 'ok' : 'warn');
      el('slLink').textContent = a.link ? `Signal via ${a.via}` : 'NO SIGNAL'; el('slLink').className = 'sl-chip ' + (a.link ? 'ok' : 'bad');
      const pct = Math.max(0, a.batt) * 100; el('slBatt').style.width = pct + '%'; el('slBatt').className = pct < 20 ? 'bad' : pct < 50 ? 'warn' : '';
      el('slBattTxt').textContent = Math.round(pct) + '%';
      el('slData').textContent = `Data on rover: ${(a.held / 1000).toFixed(1)} Gb`;
      el('slEv').textContent = `Ice evidence home: ${a.evSent.toFixed(1)} / ${S.ICE_GOAL}`;
      const logs = this.result.log.filter(l => l.hour <= this.playT);
      if (logs.length !== this.logShown) { this.logShown = logs.length; el('slLog').innerHTML = logs.slice(-4).map(l => `<div class="${l.cls}">h ${l.hour.toFixed(1)} · ${esc(l.text)}</div>`).join(''); }
    }
    if (this.playT >= endH && this.phase === 'play') { this.phase = 'done'; setTimeout(() => this.showResult(), 900); }
  }
}

function buildRover() {
  const g = new THREE.Group(), white = new THREE.MeshLambertMaterial({ color: 0xe5e7eb }), dark = new THREE.MeshLambertMaterial({ color: 0x374151 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 14), white); body.position.y = 5; g.add(body);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(9, 0.5, 9), new THREE.MeshLambertMaterial({ color: 0x1e3a8a, emissive: 0x0b1a4a })); panel.position.set(0, 9, -2); panel.rotation.x = -0.5; g.add(panel);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 7), dark); mast.position.set(0, 10, 5); g.add(mast);
  const head = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 2), white); head.position.set(0, 14, 5); g.add(head);
  for (const sx of [-6, 6]) for (const sz of [-5, 0, 5]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 2, 12), dark); w.rotation.z = Math.PI / 2; w.position.set(sx, 2, sz); g.add(w); }
  for (const sx of [-3, 3]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.8), new THREE.MeshBasicMaterial({ color: 0xfff6d0 })); lamp.position.set(sx, 6, 7.2); g.add(lamp);
    const spot = new THREE.SpotLight(0xfff2cc, 400, 260, 0.45, 0.6, 1.2); spot.position.set(sx, 7, 7); spot.target.position.set(sx * 2, -6, 60); g.add(spot, spot.target);
  }
  return g;
}
function buildMast() {
  const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color: 0xcbd5e1 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.4, 40), m); pole.position.y = 20; g.add(pole);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), new THREE.MeshLambertMaterial({ color: 0xf3f4f6, side: THREE.DoubleSide }));
  dish.position.y = 40; dish.rotation.x = -1.2; g.add(dish);
  const light = new THREE.Mesh(new THREE.SphereGeometry(1.2), new THREE.MeshBasicMaterial({ color: 0xf87171 })); light.position.y = 42; g.add(light);
  return g;
}
