// ─────────────────────────────────────────────────────────────
//  Mission model: turns a design into mass / power / data / cost
//  numbers, design-review checks, and a science estimate.
// ─────────────────────────────────────────────────────────────
import './physics.js'; // computes orbit periods/eclipses from real constants (side effect)
import { SCENARIOS, DIFFICULTY, ORBITS, LAUNCHERS, PARTS, INSTRUMENTS, catsFor } from './data.js';

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const instById = Object.fromEntries(INSTRUMENTS.map(i => [i.id, i]));
export const part = (cat, id) => PARTS[cat].options.find(o => o.id === id) || null;
export const relevance = (sc, id) => sc.inst[id] ?? sc.defaultRel ?? 0.05;
export const orbitFit = (sc, o) => sc.orbitFit[o] ?? sc.defaultFit ?? 0;
export const budgetOf = d => Math.round(SCENARIOS[d.scenario].budget * DIFFICULTY[d.difficulty].budget) + (d.grants || 0);
export const pointQ = (need, have) => need <= 0 ? 1 : Math.pow(Math.min(1, have / need), 1.5);

export function newDesign(scenario = 'wildfire', difficulty = 'engineer') {
  return { scenario, difficulty, orbit: null, lv: null, bus: null, power: null, battery: null, computer: null,
           adcs: null, prop: null, comms: null, gs: null, rover: null, relay: null, instruments: [], duty: 100, grants: 0 };
}

/**
 * Science delivered in one day.
 * Data is sent home in priority order (most science per gigabit first).
 * Science from an instrument scales with sqrt(fraction delivered): teams pick the best observations first.
 */
export function scienceDay(stats, activeFrac, capacity, pointing, sciMult = 1) {
  let cap = capacity, sci = 0, gen = 0, down = 0;
  for (const s of stats) {
    const g = s.data * activeFrac;
    gen += g;
    const dl = Math.min(g, Math.max(0, cap));
    cap -= dl; down += dl;
    const f = g > 1e-9 ? dl / g : 1;
    sci += s.base * pointQ(s.i.point, pointing) * activeFrac * Math.sqrt(f);
  }
  return { sci: sci * sciMult, gen, down };
}

export function evaluate(d) {
  const sc = SCENARIOS[d.scenario];
  const orbit = d.orbit ? ORBITS[d.orbit] : null;
  const lv = d.lv ? LAUNCHERS[d.lv] : null;
  const P = {};
  for (const cat of Object.keys(PARTS)) P[cat] = part(cat, d[cat]);
  const insts = d.instruments.map(id => instById[id]).filter(Boolean);
  const duty = d.duty / 100;
  const sum = (arr, k) => arr.reduce((s, x) => s + (x?.[k] || 0), 0);

  // ── Mass ────────────────────────────────────────────────
  const lunar = d.scenario === 'lunar';
  const surfMass = lunar ? (P.rover?.mass || 0) + (P.relay?.mass || 0) : 0;
  const surfCost = lunar ? (P.rover?.cost || 0) + (P.relay?.cost || 0) : 0;
  const partsMass = sum(['power', 'battery', 'comms', 'computer', 'adcs', 'prop'].map(c => P[c]), 'mass');
  const instMass = sum(insts, 'mass');
  const payloadMass = partsMass + instMass;
  const busMass = P.bus?.mass || 0;
  const totalMass = busMass + payloadMass + surfMass;
  const busCap = P.bus?.maxPayload || 0;
  const lvCap = lv && d.orbit ? lv.cap[d.orbit] : 0;
  const massMargin = lvCap > 0 ? (lvCap - totalMass) / lvCap : -1;

  // ── Power ───────────────────────────────────────────────
  const busPower = (P.bus?.base || 0) + (P.computer?.power || 0) + (P.adcs?.power || 0) + (P.comms?.power || 0);
  const instPower = sum(insts, 'power') * duty;
  const cons = busPower + instPower;
  const sunF = orbit ? orbit.sun : 1;
  const ecl = orbit ? orbit.eclipse : 0, eclH = orbit ? orbit.eclH : 0;
  const isRTG = !!P.power?.rtg;
  const genPeak = P.power ? (isRTG ? P.power.gen : P.power.gen * sunF) : 0;
  const genAvg = isRTG ? genPeak : genPeak * (1 - ecl);
  const powerMargin = cons > 0 ? (genAvg - cons) / cons : 0;
  const battUsable = (P.battery?.wh || 0) * 0.8;                 // 80% depth of discharge
  const needWh = (isRTG ? Math.max(0, cons - genPeak) : cons) * eclH;
  const busNeedWh = (isRTG ? Math.max(0, busPower - genPeak) : busPower) * eclH;
  const busSurvives = battUsable >= busNeedWh - 1e-9;
  const battFrac = needWh <= busNeedWh + 1e-9 ? 1 : clamp((battUsable - busNeedWh) / (needWh - busNeedWh));
  const eclFactor = isRTG ? 1 : 1 - ecl * (1 - battFrac);
  const powerFrac = instPower > 0 ? clamp((genAvg - busPower) / instPower) : 1;
  const activeFrac = powerFrac * eclFactor;
  const ionCruiseOk = !P.prop?.ion || genPeak * 0.8 >= busPower + P.prop.cruisePower;

  // ── Pointing ────────────────────────────────────────────
  let pointing = P.adcs ? P.adcs.pointing : 0.1;
  const magUseless = !!(P.adcs?.magnetic && orbit && !orbit.magOk);
  if (magUseless) pointing = 0.15;

  // ── Communications & data ───────────────────────────────
  const rate = P.comms && d.orbit ? P.comms.rate[d.orbit] : 0;           // Mbps
  const hours = P.gs && d.orbit ? P.gs.hours[d.orbit] : 0;
  const gain = P.gs && d.orbit ? P.gs.gain[d.orbit] : 0;
  const downCap = rate * gain * hours * 3.6;                              // Gb/day
  const compress = P.computer?.compress || 1;
  const fit = orbit ? orbitFit(sc, d.orbit) : 0;
  const stats = insts.map(i => {
    const rel = relevance(sc, i.id);
    const base = i.sci * rel * fit * duty;
    const data = i.data * duty * compress;
    return { i, rel, base, data, dens: base / Math.max(data, 0.01) };
  }).sort((a, b) => b.dens - a.dens);
  const day = scienceDay(stats, activeFrac, downCap, pointing);
  const dataGen = day.gen, dataDown = day.down;
  const downRatio = dataGen > 1e-9 ? dataDown / dataGen : 1;
  const ideal = scienceDay(stats, 1, Infinity, 1).sci;                    // science if nothing held it back

  // ── Time ────────────────────────────────────────────────
  const years = sc.years;
  let transitDays = orbit ? orbit.transit : 0;
  if (P.prop?.ion && orbit?.insertion) transitDays = Math.max(Math.round(transitDays * P.prop.transitMult), 90);
  const dvHave = P.prop?.dv || 0;
  const dvNeed = orbit ? orbit.dv : 0;
  const dragLimited = d.orbit === 'LEO' && dvHave < dvNeed;
  const lifeYears = dragLimited ? Math.min(years, 2) : years;

  // ── Cost ($M) ───────────────────────────────────────────
  const hw = sum(['bus', 'power', 'battery', 'comms', 'computer', 'adcs', 'prop'].map(c => P[c]), 'cost') + sum(insts, 'cost') + surfCost;
  const integration = hw * 0.1;
  const dev = hw + integration;
  const launch = lv?.cost || 0;
  const ops = ((P.gs?.costYr || 0) + 2) * years;                           // ground network + $2M/yr flight team
  const total = dev + launch + ops;
  const budget = budgetOf(d);
  const reserve = budget - total;
  const reserveFrac = reserve / budget;

  const m = {
    sc, orbit, lv, P, insts, stats, duty,
    lunar, surfMass,
    mass: { total: totalMass, payload: payloadMass, bus: busMass, busCap, lvCap, margin: massMargin },
    power: { busPower, instPower, cons, genPeak, genAvg, margin: powerMargin, battUsable, needWh, busNeedWh, busSurvives, battFrac, powerFrac, activeFrac, isRTG, ionCruiseOk, eclH, ecl },
    pointing, magUseless,
    data: { rate, hours, gain, downCap, gen: dataGen, down: dataDown, ratio: downRatio, storage: P.computer?.storage || 0 },
    science: { est: day.sci, ideal, goal: sc.goal, fit },
    time: { years, transitDays, lifeYears, dragLimited, dvHave, dvNeed },
    cost: { hw, integration, dev, launch, ops, total, budget, reserve, reserveFrac },
  };
  m.checks = runChecks(d, m);
  m.blocking = m.checks.filter(c => !c.ok && c.level === 'block');
  m.roleGoals = roleGoals(m);
  return m;
}

function runChecks(d, m) {
  const c = [];
  const add = (ok, level, label, why) => c.push({ ok, level, label, why });
  const missing = [...catsFor('hangar', d.scenario), ...catsFor('ground', d.scenario)].filter(k => !d[k]).map(k => PARTS[k].label);
  add(!!d.orbit && !!d.lv, 'block', 'Orbit and launch vehicle chosen', 'Visit the Launch Complex to choose where you are going and what rocket gets you there.');
  add(missing.length === 0, 'block', 'All spacecraft subsystems selected', missing.length ? 'Still missing: ' + missing.join(', ') + '.' : 'Every subsystem has a choice.');
  add(d.instruments.length > 0, 'block', 'At least one science instrument', 'Without instruments there is no science. Visit the Science Lab.');
  if (d.bus) add(m.mass.payload <= m.mass.busCap, 'block', `Bus can carry the payload (${fmt(m.mass.payload)} / ${fmt(m.mass.busCap)} kg)`,
    'The structure is rated for a maximum load. Choose a bigger bus or lighter components.');
  if (d.lv && d.orbit) {
    add(m.mass.lvCap > 0, 'block', `${m.lv.name} can reach ${m.orbit.name}`, 'Small rockets lack the energy to throw anything to deep-space destinations. Choose a bigger rocket.');
    if (m.mass.lvCap > 0) add(m.mass.total <= m.mass.lvCap, 'block', `Rocket can lift the spacecraft (${fmt(m.mass.total)} / ${fmt(m.mass.lvCap)} kg)`,
      'The farther the destination, the less mass a rocket can deliver there. Lighten the spacecraft or pick a bigger rocket.');
  }
  if (d.orbit && d.prop && m.orbit.insertion) add(m.time.dvHave >= m.time.dvNeed, 'block', `Engine has enough Δv to enter orbit (${m.time.dvHave} / ${m.time.dvNeed} m/s)`,
    'Arriving at the Moon, Mars, GEO or L1 requires a braking or circularizing burn. Without enough Δv the spacecraft flies right past.');
  if (d.prop === 'ion' && d.power) add(m.power.ionCruiseOk, 'block', 'Power supply can run the ion engine', 'Ion engines need ~300 W on top of normal spacecraft loads. Add more solar power.');
  add(m.cost.total <= m.cost.budget, 'block', `Within budget ($${fmt(m.cost.total)}M / $${fmt(m.cost.budget)}M)`,
    'Agencies cancel missions that exceed their budget. Cut cost: smaller rocket, cheaper parts, fewer instruments, or a cheaper ground network.');
  if (d.power && d.bus) add(m.power.margin >= 0, 'warn', `Power positive (${fmt(m.power.genAvg)} W made vs ${fmt(m.power.cons)} W used)`,
    'If loads exceed average generation, instruments must be switched off part of the time.');
  if (d.battery && d.orbit && m.orbit.eclH > 0 && !m.power.isRTG)
    add(m.power.battFrac >= 0.999, m.power.busSurvives ? 'warn' : 'danger', `Battery covers eclipses (${fmt(m.power.battUsable)} / ${fmt(m.power.needWh)} Wh)`,
      m.power.busSurvives ? 'Instruments will shut off in shadow when the battery runs low.' : 'The battery cannot even keep the computer and heaters alive in shadow — high risk of losing the spacecraft!');
  if (d.comms && d.gs && d.instruments.length) add(m.data.ratio >= 0.999, 'warn', `Downlink keeps up with data (${fmt(m.data.down)} / ${fmt(m.data.gen)} Gb/day)`,
    'Data you cannot send home is lost. Upgrade the antenna, buy more ground-station time, lower the duty cycle, or process data onboard.');
  if (d.adcs && d.instruments.length) {
    const poor = m.insts.filter(i => i.point > m.pointing + 1e-9);
    add(poor.length === 0, 'warn', 'Pointing is precise enough for all instruments', poor.length ? `Blurry/missed targets: ${poor.map(i => i.name).join(', ')}.` : '');
  }
  if (m.magUseless) add(false, 'warn', 'Magnetorquers have no magnetic field to push on', 'Far from Earth there is almost no magnetic field. Use reaction wheels.');
  if (d.orbit) add(m.science.fit >= 0.6, 'warn', `Orbit suits the objective (fit ${Math.round(m.science.fit * 100)}%)`, 'Read the mission brief: where must you be to observe your target?');
  if (m.time.dragLimited) add(false, 'warn', 'Spacecraft can fight air drag', `In LEO the thin atmosphere drags you down in ~2 years; the mission needs ${m.time.years}. Add thrusters.`);
  if (d.instruments.length && d.orbit) add(m.science.est >= m.science.goal, 'warn', `Science estimate meets goal (${fmt(m.science.est)} / ${m.science.goal})`,
    'Choose instruments that match the objective, an orbit that fits it, and make sure power, pointing and downlink can support them.');
  return c;
}

export function roleGoals(m) {
  return {
    lead: m.cost.reserveFrac >= 0.10,
    eng: m.power.margin >= 0.2 && m.mass.margin >= 0.1,
    sci: m.science.est >= m.science.goal * 1.1,
    ops: m.data.gen > 0 && m.data.ratio >= 0.999,
  };
}

/** Science shown so that "just short" never rounds up to the goal (49.96 → "49.9", not "50"). */
export function sciText(v, goal) {
  return v < goal ? (Math.floor(v * 10) / 10).toFixed(1) : fmt(v);
}

export function fmt(v) {
  if (!isFinite(v)) return '∞';
  const a = Math.abs(v);
  if (a >= 100) return Math.round(v).toLocaleString();
  if (a >= 10) return (Math.round(v * 10) / 10).toString();
  if (a >= 1) return (Math.round(v * 10) / 10).toString();
  if (a === 0) return '0';
  return (Math.round(v * 100) / 100).toString();
}

/** Post-mission analysis: explain *why* things happened. */
export function analyze(d, m, r) {
  const out = [];
  const good = t => out.push({ type: 'good', text: t });
  const bad = t => out.push({ type: 'bad', text: t });
  const tip = t => out.push({ type: 'tip', text: t });
  if (r.launchFailed) { bad(`The ${m.lv.name} failed during ascent (it has a ${Math.round(m.lv.rel * 100)}% success record). Real missions buy launch insurance or choose the most reliable rocket they can afford.`); return out; }
  if (r.failReason) bad(r.failReason);
  if (m.science.fit < 0.6) bad(`Your ${m.orbit.name} was a poor match for "${m.sc.name}" (fit ${Math.round(m.science.fit * 100)}%). Where you fly decides what you can observe.`);
  else good(`${m.orbit.name} suited the objective well (fit ${Math.round(m.science.fit * 100)}%).`);
  if (m.power.margin < 0) bad(`Power deficit: loads were ${fmt(m.power.cons)} W but arrays averaged ${fmt(m.power.genAvg)} W, so instruments ran only ${Math.round(m.power.powerFrac * 100)}% of the time.`);
  else if (m.power.margin < 0.2) tip(`Power margin was only ${Math.round(m.power.margin * 100)}%. Solar cells degrade ~2.5% per year, so thin margins shrink as the mission ages.`);
  else good(`Healthy power margin (${Math.round(m.power.margin * 100)}%).`);
  if (!m.power.isRTG && m.power.battFrac < 0.999 && m.orbit.eclH > 0) bad(`The battery could cover only ${Math.round(m.power.battFrac * 100)}% of each eclipse, so instruments went dark in the shadow.`);
  if (m.data.ratio < 0.999) bad(`Only ${Math.round(m.data.ratio * 100)}% of the data could be sent home (${fmt(m.data.down)} of ${fmt(m.data.gen)} Gb/day). The rest was never seen by scientists.`);
  else good(`The downlink handled all ${fmt(m.data.gen)} Gb/day of science data.`);
  const poor = m.insts.filter(i => i.point > m.pointing + 1e-9);
  if (poor.length) bad(`Pointing was too coarse for ${poor.map(i => i.name).join(', ')}, blurring observations.`);
  const weak = m.stats.filter(s => s.rel < 0.35);
  if (weak.length) tip(`${weak.map(s => s.i.name).join(', ')} contributed little to this objective but still cost mass, power and money.`);
  if (m.time.dragLimited) bad('Without thrusters, air drag pulled the spacecraft down after ~2 years. (Real case: in Feb 2022 a geomagnetic storm increased drag enough that ~38 new Starlink satellites re-entered.)');
  if (r.overrun > 0) (r.finalReserve >= 0 ? good : bad)(`Development ran $${fmt(r.overrun)}M over estimate${r.extraCost ? ` and events cost $${fmt(r.extraCost)}M more` : ''}. ${r.finalReserve >= 0 ? 'Your reserve absorbed it.' : 'With no reserve left, the mission went over budget.'}`);
  if (m.mass.margin >= 0 && m.mass.margin < 0.1) tip(`Launch-mass margin was only ${Math.round(m.mass.margin * 100)}%. Spacecraft almost always grow during development.`);
  const hits = [];
  if (r.mults) {
    if (r.mults.point < 1) hits.push(`pointing −${Math.round((1 - r.mults.point) * 100)}%`);
    if (r.mults.power < 1) hits.push(`power −${Math.round((1 - r.mults.power) * 100)}%`);
    if (r.mults.duty < 1) hits.push(`observing time −${Math.round((1 - r.mults.duty) * 100)}%`);
    if (r.mults.sci < 1) hits.push(`instrument damage −${Math.round((1 - r.mults.sci) * 100)}%`);
  }
  if (r.science < r.goal) {
    const short = `Science finished at ${sciText(r.science, r.goal)}, just ${(Math.ceil((r.goal - r.science) * 10) / 10).toFixed(1)} short of the goal of ${r.goal} (pre-launch estimate: ${fmt(r.estimate)}).`;
    bad(short + (hits.length ? ` In-flight events cost you: ${hits.join(', ')}. A design that only just meets the goal has no room for surprises — build in science margin.` : ''));
  } else if (hits.length) good(`Despite in-flight setbacks (${hits.join(', ')}), your margins carried the mission past its science goal.`);
  if (r.lifeFrac >= 0.999) good(`The spacecraft completed its full ${m.time.years}-year mission.`);
  return out;
}
