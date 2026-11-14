// ─────────────────────────────────────────────────────────────
//  Shadowline: the lunar south-pole rover phase (pure logic, no 3D).
//  One idea drives power AND radio: can this spot on the terrain see a point in the sky?
//
//  Terrain: procedural crater modelled on a small south-pole crater (labelled as procedural).
//  Swap in a NASA Moon Trek (LOLA) elevation grid later via makeTerrain({ heights }).
// ─────────────────────────────────────────────────────────────
import { PARTS } from './data.js';

export const N = 128;              // grid cells per side
export const CELL = 60;            // metres per cell → 7.68 km square
export const SIZE = N * CELL;
const MOON_R = 1737400;            // m, for horizon curvature drop
export const AZ_STEPS = 48;        // horizon directions
export const SUN_EL = 1.5;         // degrees: the Sun never rises more than ~1.5° near the pole
export const SUN_RATE = 360 / 708.7; // °/hour: one turn per lunar day (29.53 Earth days)
export const SUN_AZ0 = 115;        // starting azimuth (° clockwise from north)
export const EARTH_AZ = 0, EARTH_EL = 4; // Earth sits low in the north (approximate, ignores libration)
export const SUN_DISK = 0.27;      // ° solar radius → partial sunlight near the horizon
export const SLOPE_LIMIT = 25;     // ° the rover cannot climb
export const ICE_GOAL = 20;        // ice-evidence units that must reach Earth
export const MAX_HOURS = 96;
const DT = 0.25;                   // hours per step

export const RATES = { dte: 0.5, mast: 2, orbiter: 4 }; // Mbps
const SAMPLE_MB_PER_H = 1500;
const TX_W = 25;

const CRATER = { x: 0.5 * SIZE, y: 0.45 * SIZE, R: 1500, depth: 300, rim: 90, rimW: 450 };

// ── tiny deterministic noise ──────────────────────────────────
function hash2(i, j, seed) { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y, seed) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(i, j, seed), b = hash2(i + 1, j, seed), c = hash2(i, j + 1, seed), d = hash2(i + 1, j + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, seed, oct = 4) { let s = 0, a = 0.5, f = 1; for (let k = 0; k < oct; k++) { s += a * vnoise(x * f, y * f, seed + k); f *= 2; a *= 0.5; } return s; }

function craterHeight(x, y) {
  const { R, depth, rim, rimW } = CRATER;
  const r = Math.hypot(x - CRATER.x, y - CRATER.y);
  let h = r < R ? -depth * 0.5 * (1 + Math.cos(Math.PI * r / R)) : 0;
  h += rim * Math.exp(-(((r - R) / rimW) ** 2));
  h += 0.012 * (y - CRATER.y);                       // gentle regional rise to the north
  h += (fbm(x / 900, y / 900, 3) - 0.5) * 60;        // rolling hills
  h += (fbm(x / 180, y / 180, 11, 3) - 0.5) * 8;     // small bumps
  return h;
}

/** Build terrain + horizon map + permanently-shadowed / ice maps. */
export function makeTerrain(opts = {}) {
  const H = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++)
    H[j * N + i] = opts.heights ? opts.heights[j * N + i] : craterHeight((i + 0.5) * CELL, (j + 0.5) * CELL);
  const t = { H, horizon: null, ice: new Float32Array(N * N), psr: new Uint8Array(N * N), crater: CRATER, procedural: !opts.heights };
  t.horizon = buildHorizon(H);
  // Permanently shadowed: the Sun (≤ SUN_EL + disk) never clears the horizon in any direction.
  for (let c = 0; c < N * N; c++) {
    let lit = false;
    for (let a = 0; a < AZ_STEPS && !lit; a++) if (SUN_EL + SUN_DISK > t.horizon[c * AZ_STEPS + a]) lit = true;
    t.psr[c] = lit ? 0 : 1;
    if (!lit) { const i = c % N, j = (c / N) | 0; t.ice[c] = Math.min(1, 0.35 + 0.65 * fbm(i / 9, j / 9, 21)); }
  }
  return t;
}

/** For every cell and direction, the highest terrain angle (degrees) seen from 2 m above the ground. */
function buildHorizon(H) {
  const out = new Float32Array(N * N * AZ_STEPS);
  const dirs = Array.from({ length: AZ_STEPS }, (_, a) => { const az = (a / AZ_STEPS) * 2 * Math.PI; return [Math.sin(az), Math.cos(az)]; });
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const h0 = H[j * N + i] + 2;
    for (let a = 0; a < AZ_STEPS; a++) {
      const [dx, dy] = dirs[a];
      let best = -90, d = CELL;
      while (d < 5000) {
        const x = i + dx * d / CELL, y = j + dy * d / CELL;
        if (x < 0 || y < 0 || x > N - 1 || y > N - 1) break;
        const h = sampleGrid(H, x, y) - d * d / (2 * MOON_R);
        const ang = Math.atan2(h - h0, d) * 180 / Math.PI;
        if (ang > best) best = ang;
        d += Math.max(CELL, d * 0.12);
      }
      out[(j * N + i) * AZ_STEPS + a] = best;
    }
  }
  return out;
}

function sampleGrid(G, x, y) {
  const i = Math.max(0, Math.min(N - 2, Math.floor(x))), j = Math.max(0, Math.min(N - 2, Math.floor(y)));
  const fx = Math.min(1, Math.max(0, x - i)), fy = Math.min(1, Math.max(0, y - j));
  const a = G[j * N + i], b = G[j * N + i + 1], c = G[(j + 1) * N + i], d = G[(j + 1) * N + i + 1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
/** Height (m) at a position in metres. */
export const heightAt = (t, x, y) => sampleGrid(t.H, x / CELL - 0.5, y / CELL - 0.5);
const cellOf = (x, y) => { const i = Math.max(0, Math.min(N - 1, Math.floor(x / CELL))), j = Math.max(0, Math.min(N - 1, Math.floor(y / CELL))); return j * N + i; };
function horizonAt(t, c, azDeg) {
  const f = (((azDeg % 360) + 360) % 360) / 360 * AZ_STEPS, a0 = Math.floor(f) % AZ_STEPS, a1 = (a0 + 1) % AZ_STEPS, w = f - Math.floor(f);
  return t.horizon[c * AZ_STEPS + a0] * (1 - w) + t.horizon[c * AZ_STEPS + a1] * w;
}

export const sunAz = hour => SUN_AZ0 + SUN_RATE * hour;
/** 0..1: how much of the Sun's disk is above the local horizon. */
export function sunFraction(t, x, y, hour) {
  const H = horizonAt(t, cellOf(x, y), sunAz(hour));
  return Math.max(0, Math.min(1, (SUN_EL - H + SUN_DISK) / (2 * SUN_DISK)));
}
export function seesEarth(t, x, y) { return EARTH_EL > horizonAt(t, cellOf(x, y), EARTH_AZ); }
export const iceAt = (t, x, y) => t.ice[cellOf(x, y)];
export const isPSR = (t, x, y) => t.psr[cellOf(x, y)] === 1;

/** Straight line of sight between two points (e.g. rover → relay mast). */
export function lineOfSight(t, a, b) {
  const ha = heightAt(t, a.x, a.y) + (a.up ?? 2), hb = heightAt(t, b.x, b.y) + (b.up ?? 2);
  const dist = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.max(2, Math.ceil(dist / (CELL / 2)));
  for (let k = 1; k < steps; k++) {
    const f = k / steps, x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
    if (heightAt(t, x, y) + 0.5 > ha + (hb - ha) * f) return false;
  }
  return true;
}

/** Landing sites, defined relative to the crater. */
export function landingSites() {
  const { x, y, R } = CRATER;
  return [
    { id: 'rim', name: 'North Rim Ridge', x: x + 150, y: y + R + 120, desc: 'On the crater rim: sunlight and Earth in view, 1.6 km from the ice.' },
    { id: 'plateau', name: 'Sunny Plateau', x: x + 1700, y: y + R + 900, desc: 'Safest site: long sunlight and a clear view of Earth, but 3 km from the ice.' },
    { id: 'inner', name: 'Inner Slope', x: x - 300, y: y + R - 650, desc: 'Inside the rim, only 0.9 km from the ice, but in shadow and without Earth.' },
  ];
}

/** Where a rim relay mast goes: the highest rim cell that sees Earth, near the crater's north side. */
export function mastSite(t) {
  const { x, y, R } = CRATER;
  let best = null;
  for (let a = -40; a <= 40; a += 4) {
    const az = a * Math.PI / 180;
    for (let r = R - 100; r <= R + 300; r += 40) {
      const px = x + Math.sin(az) * r, py = y + Math.cos(az) * r;
      if (!seesEarth(t, px, py)) continue;
      const h = heightAt(t, px, py);
      if (!best || h > best.h) best = { x: px, y: py, h, up: 25 };
    }
  }
  return best;
}

/**
 * Simulate a route. plan = { site, waypoints: [{x, y, sampleH}], startHour }
 * The LAST waypoint is the safe haven. Returns a timeline for playback + a summary.
 */
export function simulateRoute(t, design, plan) {
  const rover = PARTS.rover.options.find(o => o.id === design.rover) || PARTS.rover.options[0];
  const relay = design.relay || 'none';
  const mast = relay === 'mast' ? mastSite(t) : null;
  const site = landingSites().find(s => s.id === plan.site) || landingSites()[0];
  const legs = [{ x: site.x, y: site.y, sampleH: 0 }, ...plan.waypoints];

  const s = { x: site.x, y: site.y, hour: plan.startHour || 0, batt: rover.battWh, dataHeld: 0, evHeld: 0, evSent: 0, evCollected: 0, dataSent: 0, dataLost: 0,
    leg: 1, sampleLeft: plan.waypoints[0]?.sampleH ?? 0, mode: 'drive', state: 'ok', shadowH: 0, noLinkH: 0, minBatt: rover.battWh };
  const timeline = [], log = [];
  const say = (text, cls = '') => log.push({ hour: +(s.hour - (plan.startHour || 0)).toFixed(2), text, cls });
  let wasSun = null, wasLink = null, warned20 = false;

  const linkAt = (x, y, hour) => {
    if (seesEarth(t, x, y)) return { ok: true, via: 'Earth', rate: RATES.dte };
    if (mast && lineOfSight(t, { x, y }, mast)) return { ok: true, via: 'relay mast', rate: RATES.mast };
    if (relay === 'orbiter' && ((hour % 2) + 2) % 2 < 0.34) return { ok: true, via: 'orbiter pass', rate: RATES.orbiter };
    return { ok: false, via: 'none', rate: 0 };
  };

  say(`Landed at ${site.name}. Battery full (${rover.battWh} Wh).`, 'good');
  const t0 = s.hour;
  while (s.hour - t0 < MAX_HOURS) {
    const sun = sunFraction(t, s.x, s.y, s.hour);
    const link = linkAt(s.x, s.y, s.hour);
    const inSun = sun > 0.5;
    if (wasSun !== null && inSun !== wasSun) say(inSun ? 'Back in sunlight: charging.' : 'Entered shadow: heaters on, battery draining.', inSun ? 'good' : 'warn');
    if (wasLink !== null && link.ok !== wasLink) say(link.ok ? `Signal regained (via ${link.via}).` : 'Signal lost: the terrain blocks Earth.', link.ok ? 'good' : 'bad');
    wasSun = inSun; wasLink = link.ok;

    // ── motion / sampling ──
    let load = rover.baseW + (inSun ? 0 : rover.heaterW);
    if (s.mode === 'drive') {
      const tgt = legs[s.leg];
      const dx = tgt.x - s.x, dy = tgt.y - s.y, dist = Math.hypot(dx, dy);
      const step = rover.speed * DT;
      if (dist <= step) {
        s.x = tgt.x; s.y = tgt.y;
        if (s.leg === legs.length - 1) { s.mode = 'haven'; say('Reached the safe haven.', 'good'); }
        else { s.mode = 'sample'; s.sampleLeft = tgt.sampleH; say(`Arrived at waypoint ${s.leg}. Sampling for ${tgt.sampleH} h.`); }
      } else {
        const nx = s.x + dx / dist * step, ny = s.y + dy / dist * step;
        const slope = Math.atan2(Math.abs(heightAt(t, nx, ny) - heightAt(t, s.x, s.y)), step) * 180 / Math.PI;
        if (slope > SLOPE_LIMIT) { s.state = 'stuck'; say(`Stuck: a ${slope.toFixed(0)}° slope is too steep for the wheels.`, 'bad'); }
        else { s.x = nx; s.y = ny; load += rover.driveW; }
      }
    } else if (s.mode === 'sample') {
      load += rover.sampleW;
      const ice = iceAt(t, s.x, s.y);
      const mb = SAMPLE_MB_PER_H * DT, ev = ice * 10 * DT;
      const room = rover.storage - s.dataHeld, keep = Math.min(mb, room);
      s.dataHeld += keep; s.evHeld += ev * (keep / mb); s.evCollected += ev; s.dataLost += mb - keep;
      s.sampleLeft -= DT;
      if (s.sampleLeft <= 1e-6) { s.mode = 'drive'; s.leg++; if (s.leg >= legs.length) s.mode = 'haven'; }
    }

    // ── radio ──
    if (link.ok && s.dataHeld > 0) {
      load += TX_W;
      const can = link.rate * 3600 * DT; // Mb this step
      const sent = Math.min(can, s.dataHeld), frac = sent / s.dataHeld;
      s.evSent += s.evHeld * frac; s.evHeld -= s.evHeld * frac; s.dataHeld -= sent; s.dataSent += sent;
    }
    if (!link.ok) s.noLinkH += DT;
    if (!inSun) s.shadowH += DT;

    // ── power ──
    const solar = rover.panelW * sun;
    s.batt = Math.min(rover.battWh, s.batt + (solar - load) * DT);
    s.minBatt = Math.min(s.minBatt, s.batt);
    if (!warned20 && s.batt < rover.battWh * 0.2) { warned20 = true; say('Battery below 20%.', 'warn'); }

    timeline.push({ h: +(s.hour - t0).toFixed(2), x: s.x, y: s.y, batt: s.batt / rover.battWh, sun, link: link.ok, via: link.via, held: s.dataHeld, evSent: s.evSent, mode: s.mode });
    s.hour += DT;

    if (s.batt <= 0) { s.state = 'dead'; s.batt = 0; say('Battery empty in the dark. The rover froze. Unsent data is lost.', 'bad'); break; }
    if (s.state === 'stuck') break;
    // At the safe haven: done once in sunlight and nothing is left to send (or nothing can be sent from here).
    if (s.mode === 'haven' && inSun) {
      if (s.dataHeld < 1) { s.state = 'safe'; say('Safe in sunlight with all data sent home.', 'good'); break; }
      if (!link.ok && relay !== 'orbiter') { s.state = 'safe'; say('Safe in sunlight, but this spot cannot reach Earth: data is stuck on the rover.', 'warn'); break; }
    }
  }
  if (s.state === 'ok') { s.state = 'stranded'; say('Out of mission time before reaching safety.', 'bad'); }
  const lostOnRover = s.state === 'dead' || s.state === 'stranded' ? s.evHeld : 0;

  return {
    state: s.state, hours: +(s.hour - t0).toFixed(1), site: site.name, relay, rover: rover.name, mast,
    evCollected: +s.evCollected.toFixed(1), evSent: +s.evSent.toFixed(1), evLost: +lostOnRover.toFixed(1), goal: ICE_GOAL, dataLost: Math.round(s.dataLost), storage: rover.storage,
    shadowH: s.shadowH, noLinkH: s.noLinkH, minBatt: Math.round(s.minBatt), battWh: rover.battWh,
    timeline, log, firstSignalLoss: log.find(l => l.text.startsWith('Signal lost'))?.hour ?? null,
  };
}

/** Points out of 300 for the report. */
export function surfaceScore(r) {
  const sci = Math.round(200 * Math.min(1, r.evSent / r.goal));
  const survive = r.state === 'safe' ? 100 : r.state === 'stuck' ? 30 : 0;
  return { pts: sci + survive, max: 300, sci, survive };
}

/** Plain-language explanations of what happened. */
export function surfaceAnalysis(r) {
  const out = [];
  if (r.state === 'dead') out.push({ type: 'bad', text: `The rover's ${r.battWh} Wh battery ran out after ${r.shadowH.toFixed(1)} h in shadow. In the dark there is no charging and the heaters must run.` });
  if (r.state === 'stuck') out.push({ type: 'bad', text: `The route crossed a slope steeper than ${SLOPE_LIMIT}°. Plan waypoints that go around steep crater walls.` });
  if (r.state === 'stranded') out.push({ type: 'bad', text: 'The rover ran out of mission time before reaching sunlight.' });
  if (r.evLost > 0) out.push({ type: 'bad', text: `${r.evLost} units of ice evidence were collected but never sent home. Only data that reaches Earth counts.` });
  if (r.dataLost > 0) out.push({ type: 'bad', text: `The rover's ${r.storage} Mb storage filled up while sampling, so ${r.dataLost} Mb of new data was thrown away. Send data home more often, or sample for shorter stretches.` });
  if (r.noLinkH > 4 && r.relay === 'none') out.push({ type: 'tip', text: `The crater rim blocked Earth for ${r.noLinkH.toFixed(0)} h. A relay (orbiter or rim mast) could send data from inside the crater.` });
  if (r.evSent >= r.goal) out.push({ type: 'good', text: `${r.evSent} ice-evidence units reached Earth (goal ${r.goal}).` });
  else if (r.evCollected >= r.goal) out.push({ type: 'tip', text: `The rover collected enough ice evidence (${r.evCollected}) but only ${r.evSent} reached Earth.` });
  else out.push({ type: 'tip', text: `Only ${r.evCollected} units of ice evidence were collected (goal ${r.goal}). Sample longer, or in darker cells where ice is likelier.` });
  if (r.state === 'safe') out.push({ type: 'good', text: 'The rover finished in sunlight and survived.' });
  out.push({ type: 'tip', text: 'Real case: NASA planned its VIPER rover around exactly these limits (short trips into shadow, blocked radio, sunlit safe havens). VIPER was cancelled in 2024 over cost and schedule.' });
  return out;
}
