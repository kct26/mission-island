// Day-by-day mission simulation with random events that need team decisions.
import { DIFFICULTY } from './data.js';
import { scienceDay, clamp, fmt } from './model.js';

const EVENTS = [
  { id: 'storm', role: 'ops', title: '☀️ Solar Storm Incoming', text: 'A burst of energetic particles from the Sun will hit in hours. Radiation can corrupt electronics.',
    choices: [
      { label: 'Safe mode for 5 days (instruments off)', run: s => { s.safeDays += 5; return 'Spacecraft rode out the storm in safe mode. 5 days of observations lost.'; } },
      { label: 'Keep observing and hope', run: s => { const p = 0.45 * s.m.P.computer.fault; if (s.rng() < p) { s.sciMult *= 0.75; return `Radiation upset damaged an instrument's electronics: science rate −25%. (${Math.round(p * 100)}% risk with your ${s.m.P.computer.name})`; } return `No damage! (${Math.round(p * 100)}% risk with your ${s.m.P.computer.name})`; } },
    ] },
  { id: 'wheel', role: 'eng', when: s => ['wheels', 'star'].includes(s.d.adcs), title: '⚙️ Reaction Wheel Failure', text: 'One of the reaction wheels seized. The spacecraft can\'t hold steady as well as before.',
    choices: [
      { label: 'Switch to a 3-wheel backup mode (pointing −25%)', run: s => { s.pointMult *= 0.75; return 'Pointing is shakier now: high-precision instruments suffer.'; } },
      { label: 'Use thrusters to hold attitude (burns fuel)', need: s => s.d.prop !== 'none' && s.d.prop !== 'ion', why: 'Requires chemical thrusters', run: s => { const left = s.endDay - s.day; s.endDay = Math.round(s.day + left * 0.7); return 'Pointing preserved, but fuel will run out early: mission shortened by 30% of the remaining time.'; } },
    ] },
  { id: 'gs', role: 'ops', title: '📡 Ground Station Outage', text: 'A storm on Earth knocked out your main ground antenna for about 10 days.',
    choices: [
      { label: 'Wait it out (store data onboard)', run: s => { s.noDownDays += 10; return `No downlink for 10 days. Data is stored onboard (${s.m.data.storage} Gb capacity); the rest overflows.`; } },
      { label: 'Rent backup antenna time ($4M)', run: s => { s.extraCost += 4; return 'Backup antennas kept data flowing. $4M spent.'; } },
    ] },
  { id: 'funding', role: 'lead', title: '💸 Budget Cut', text: 'The agency\'s budget was trimmed. Your mission must give back $10M.',
    choices: [
      { label: 'Pay from the reserve ($10M)', run: s => { s.extraCost += 10; return 'Paid from reserves. Operations continue as planned.'; } },
      { label: 'Cut operations: instruments run 25% less', run: s => { s.dutyMult *= 0.75; return 'Fewer observations for the rest of the mission, but the money is safe.'; } },
    ] },
  { id: 'debris', role: 'lead', when: s => ['LEO', 'SSO', 'GEO'].includes(s.d.orbit), title: '☄️ Debris Conjunction', text: 'Tracking shows a piece of space junk will pass dangerously close in 2 days.',
    choices: [
      { label: 'Dodge with an avoidance maneuver', need: s => s.d.prop !== 'none', why: 'Requires propulsion', run: s => { s.safeDays += 1; return 'Dodged successfully. 1 day of observations lost.'; } },
      { label: 'Accept the risk (~1 in 15)', run: s => { if (s.rng() < 1 / 15) { s.fail('Struck by orbital debris. The spacecraft broke apart.'); return 'IMPACT. Contact lost.'; } return 'It missed — by 200 meters.'; } },
    ] },
  { id: 'meteor', role: 'eng', title: '💥 Micrometeoroid Strike', text: 'A sand-grain-size particle punched through a solar panel string. Power output dropped 15%.',
    choices: [
      { label: 'Accept the loss', run: s => { s.powerMult *= 0.85; return 'Power is now 15% lower. Check if your margin can handle it.'; } },
      { label: 'Run 3 days of diagnostics to reroute circuits', run: s => { s.safeDays += 3; s.powerMult *= 0.95; return 'Engineers recovered most of the string: only 5% lost.'; } },
    ] },
  { id: 'discovery', role: 'sci', title: '✨ Unexpected Discovery', text: 'Your instruments caught something nobody predicted! Scientists want a 20-day special campaign.',
    choices: [
      { label: 'Run the campaign (+data, needs downlink)', run: s => { const ok = s.m.data.ratio > 0.8; s.bonusSci += ok ? s.m.sc.goal * 0.08 : s.m.sc.goal * 0.02; return ok ? 'A headline result! Big science bonus.' : 'The downlink couldn\'t keep up — only a small part of the campaign data reached Earth.'; } },
      { label: 'Stay on the planned schedule', run: () => 'Science stays on plan.' },
    ] },
];

export class Sim {
  constructor(d, m, rng) {
    this.d = d; this.m = m; this.rng = rng;
    this.diff = DIFFICULTY[d.difficulty];
    this.day = 0; this.transit = m.time.transitDays; this.opsDays = Math.round(m.time.years * 365);
    this.endDay = this.transit + this.opsDays;
    this.alive = true; this.done = false; this.failReason = null;
    this.sci = 0; this.bonusSci = 0; this.buffer = 0; this.pendingSci = 0; this.lost = 0; this.downTotal = 0; this.genTotal = 0;
    this.safeDays = 0; this.noDownDays = 0; this.extraCost = 0;
    this.sciMult = 1; this.pointMult = 1; this.powerMult = 1; this.dutyMult = 1;
    this.log = []; this.series = [];
    this.overrun = Math.round(m.cost.dev * (0.03 + 0.12 * rng()) * this.diff.overrun * 10) / 10;
    this.launchFailed = rng() > m.lv.rel;
    // schedule events in the operations phase
    const pool = EVENTS.filter(e => !e.when || e.when(this));
    const n = Math.min(this.diff.events, pool.length);
    this.events = [];
    const picks = [...pool].sort(() => rng() - 0.5).slice(0, n);
    picks.forEach((e, i) => this.events.push({ e, day: Math.round(this.transit + this.opsDays * (0.12 + 0.8 * (i + rng() * 0.8) / n)) }));
    this.events.sort((a, b) => a.day - b.day);
    this.today = { gen: 0, down: 0, sci: 0, active: 1, powerGen: 0, cons: m.power.cons };
    this.addLog(`Development finished $${fmt(this.overrun)}M over estimate.`, this.overrun > m.cost.reserve ? 'bad' : '');
  }
  addLog(t, cls = '') { this.log.unshift({ day: this.day, t, cls }); }
  fail(reason) { this.alive = false; this.failReason = reason; this.addLog(reason, 'bad'); }
  get phase() { return this.day < this.transit ? 'cruise' : 'ops'; }

  /** Advance one day. Returns a pending event if one triggers. */
  step() {
    if (this.done) return null;
    const m = this.m;
    if (!this.alive || this.day >= this.endDay) { this.finish(); return null; }
    const ev = this.events.find(x => !x.fired && x.day <= this.day);
    if (ev) { ev.fired = true; return ev.e; }

    if (this.day === this.transit && this.transit > 0) this.addLog(`Arrived! Orbit insertion burn complete (Δv ${m.time.dvNeed} m/s).`, 'good');
    if (this.day === this.transit) this.addLog('Science operations begin.', 'good');

    const hazardBase = 2e-5 * m.orbit.rad * m.P.computer.fault * this.diff.hazard;
    if (this.phase === 'cruise') {
      if (this.rng() < hazardBase) this.fail('A computer fault during cruise ended the mission.');
      this.day++; return null;
    }
    const age = (this.day - this.transit) / 365;
    const degr = m.power.isRTG ? 1 - 0.04 * age : 1 - 0.025 * age;
    const gen = m.power.genAvg * degr * this.powerMult;
    const instPow = m.power.instPower * this.dutyMult;
    const powerFrac = instPow > 0 ? clamp((gen - m.power.busPower) / instPow) : 1;
    const eclF = m.power.isRTG ? 1 : 1 - m.power.ecl * (1 - m.power.battFrac);
    let active = powerFrac * eclF * this.dutyMult;
    if (this.safeDays > 0) { this.safeDays--; active = 0; }

    // hazards
    let p = hazardBase;
    if (!m.power.busSurvives) p += 0.004;
    if (gen < m.power.busPower) p += 0.02;
    if (this.rng() < p) this.fail(gen < m.power.busPower ? 'Power collapsed: there wasn\'t enough energy even for the computer and heaters.' : !m.power.busSurvives ? 'The battery drained during an eclipse and the spacecraft froze.' : 'A random hardware failure (radiation-induced) ended the mission.');
    if (m.time.dragLimited && age >= 2) this.fail('Air drag pulled the spacecraft into the atmosphere, where it burned up.');

    const capToday = this.noDownDays > 0 ? 0 : m.data.downCap;
    if (this.noDownDays > 0) this.noDownDays--;
    const r = scienceDay(m.stats, active, capToday, m.pointing * this.pointMult, this.sciMult);
    let sciToday = r.sci;
    if (capToday === 0 && r.gen > 0) {
      // store what fits for later
      const nominal = scienceDay(m.stats, active, m.data.downCap, m.pointing * this.pointMult, this.sciMult);
      const room = Math.max(0, m.data.storage - this.buffer);
      const stored = Math.min(nominal.down, room);
      this.buffer += stored; this.lost += r.gen - stored;
      this.pendingSci += nominal.down > 0 ? nominal.sci * stored / nominal.down : 0;
    } else {
      this.lost += r.gen - r.down;
      const spare = capToday - r.down;
      if (this.buffer > 0 && spare > 0) {
        const drain = Math.min(this.buffer, spare), frac = drain / this.buffer;
        sciToday += this.pendingSci * frac; this.pendingSci -= this.pendingSci * frac; this.buffer -= drain;
        r.down += drain;
      }
    }
    if (!this.alive) sciToday = 0;
    this.sci += sciToday; this.genTotal += r.gen; this.downTotal += r.down;
    this.today = { gen: r.gen, down: r.down, sci: sciToday, active, powerGen: gen, cons: m.power.busPower + instPow * (active > 0 ? 1 : 0) };
    if (this.day % 5 === 0) this.series.push({ day: this.day, sci: this.scienceIndex, gen: r.gen, down: r.down, power: gen, active });
    this.day++;
    return null;
  }

  resolve(ev, choice) {
    const msg = choice.run(this);
    this.addLog(`${ev.title}: ${msg}`, '');
  }

  get scienceIndex() { return (this.sci + this.bonusSci) / Math.max(1, this.opsDays); }
  get opsElapsed() { return Math.max(0, Math.min(this.day, this.endDay) - this.transit); }

  finish() {
    if (this.done) return;
    this.done = true;
    if (this.alive) this.addLog(this.day >= this.transit + this.opsDays ? 'Mission complete! The spacecraft finished its planned lifetime.' : 'Mission ended early.', this.day >= this.transit + this.opsDays ? 'good' : 'bad');
  }

  result() {
    const m = this.m;
    const spent = m.cost.total + this.overrun + this.extraCost;
    return {
      launchFailed: this.launchFailed, failReason: this.failReason,
      science: this.scienceIndex, goal: m.sc.goal,
      lifeFrac: clamp(this.opsElapsed / this.opsDays),
      overrun: this.overrun, extraCost: this.extraCost, spent, finalReserve: m.cost.budget - spent,
      dataDown: this.downTotal, dataGen: this.genTotal, lost: this.lost,
      estimate: m.science.est, mults: { point: this.pointMult, power: this.powerMult, duty: this.dutyMult, sci: this.sciMult },
    };
  }
}

export function scoreResult(m, r, roleGoalsMet, teamMode) {
  if (r.launchFailed) return { total: 0, parts: [], grade: 'F', status: 'LAUNCH FAILURE' };
  const sr = r.science / r.goal;
  const sciPts = Math.round(400 * Math.min(1, sr) + Math.min(100, Math.max(0, sr - 1) * 200));
  const lifePts = Math.round(200 * r.lifeFrac);
  const effPts = r.finalReserve < 0 ? 0 : Math.round(150 * Math.min(1, (r.finalReserve / m.cost.budget) / 0.2));
  const goals = Object.values(roleGoalsMet); const met = goals.filter(Boolean).length;
  const teamPts = Math.round(150 * met / goals.length);
  const total = sciPts + lifePts + effPts + teamPts;
  const grade = total >= 850 ? 'S' : total >= 700 ? 'A' : total >= 550 ? 'B' : total >= 400 ? 'C' : 'D';
  const status = sr >= 1 && r.lifeFrac >= 0.999 && r.finalReserve >= 0 ? 'MISSION SUCCESS' : sr >= 0.5 ? 'PARTIAL SUCCESS' : 'MISSION LOSS';
  return {
    total, grade, status, parts: [
      { label: 'Science return', pts: sciPts, max: 500, note: `${fmt(r.science)} / ${r.goal} science index` },
      { label: 'Mission lifetime', pts: lifePts, max: 200, note: `${Math.round(r.lifeFrac * 100)}% of planned operations` },
      { label: 'Budget efficiency', pts: effPts, max: 150, note: r.finalReserve >= 0 ? `$${fmt(r.finalReserve)}M left (20% reserve = full marks)` : `$${fmt(-r.finalReserve)}M over budget` },
      { label: teamMode ? 'Team role goals' : 'Engineering goals', pts: teamPts, max: 150, note: `${met} / ${goals.length} role goals met` },
    ],
  };
}
