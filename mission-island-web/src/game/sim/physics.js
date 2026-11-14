// Orbital physics from real constants — the same first-order relations that
// tools like NASA's GMAT build on (two-body motion, cylindrical shadow).
import { ORBITS } from './data.js';

export const BODIES = {
  earth: { name: 'Earth', R: 6378.137, mu: 398600.4418 },   // km, km³/s²
  moon:  { name: 'Moon',  R: 1737.4,   mu: 4902.8 },
  mars:  { name: 'Mars',  R: 3389.5,   mu: 42828.4 },
};
const ALT = { LEO: ['earth', 400], SSO: ['earth', 700], GEO: ['earth', 35786], MOON: ['moon', 100], MARS: ['mars', 300] };
const MARS_AU = 1.524;

/** Period (min) of a circular orbit: T = 2π √(a³/μ) */
export const periodMin = (body, alt) => { const b = BODIES[body], a = b.R + alt; return 2 * Math.PI * Math.sqrt(a ** 3 / b.mu) / 60; };
/** Worst-case shadow fraction (Sun in the orbit plane): asin(R/a)/π */
export const shadowFrac = (body, alt) => { const b = BODIES[body]; return Math.asin(b.R / (b.R + alt)) / Math.PI; };
/** Circular orbital speed (km/s): v = √(μ/a) */
export const speedKms = (body, alt) => { const b = BODIES[body]; return Math.sqrt(b.mu / (b.R + alt)); };

// Overwrite the hand-entered orbit numbers with computed ones.
for (const [k, [body, alt]] of Object.entries(ALT)) {
  const o = ORBITS[k], T = periodMin(body, alt), f = shadowFrac(body, alt);
  o.physics = { body, alt, T, f, v: speedKms(body, alt) };
  o.period = T >= 120 ? `${(T / 60).toFixed(1)} h` : `${Math.round(T)} min`;
  if (k === 'GEO') {
    // GEO only enters Earth's shadow during ~45-day seasons around each equinox (~90 days/yr).
    o.eclH = f * T / 60; o.eclipse = f * 90 / 365;
  } else {
    o.eclH = f * T / 60; o.eclipse = f;
  }
}
ORBITS.MARS.sun = 1 / MARS_AU ** 2;   // inverse-square law → 0.43

export function physicsHTML(key) {
  const o = ORBITS[key];
  if (!o.physics) {
    return key === 'L1' ? `<b>Sun–Earth L1</b> sits ~1.5 million km sunward, where Earth's and the Sun's gravity balance the orbit. The spacecraft circles the point in a halo orbit and is never in shadow. Radio power falls with distance², so signals are ~15,000× weaker than from GEO.` : '';
  }
  const p = o.physics, b = BODIES[p.body];
  return `<b>${o.name}</b> around ${b.name} (R = ${b.R.toLocaleString()} km, μ = ${b.mu.toLocaleString()} km³/s²), altitude ${p.alt.toLocaleString()} km → a = ${(b.R + p.alt).toLocaleString()} km<br>
    Period T = 2π√(a³/μ) = <b>${p.T.toFixed(1)} min</b> · speed v = √(μ/a) = <b>${p.v.toFixed(2)} km/s</b><br>
    Shadow per orbit (Sun in orbit plane) = asin(R/a)/π = <b>${(p.f * 100).toFixed(1)}%</b> → up to <b>${Math.round(p.f * p.T)} min</b> on battery each orbit${key === 'GEO' ? ' (only during equinox seasons)' : ''}${key === 'MARS' ? `<br>Sunlight at Mars = 1 / ${MARS_AU}² = <b>${(ORBITS.MARS.sun * 100).toFixed(0)}%</b> of Earth's` : ''}`;
}
