// In-flight events. Each one explains, with the player's real numbers, why it matters,
// what each choice gains and costs, the risk, and which choice the numbers favour.
import { scienceDay, fmt } from './model.js';

const pct = v => `${Math.round(v * 100)}%`;
const remainFrac = s => Math.max(0, (s.endDay - s.day) / s.opsDays);
const reserveLeft = s => s.m.cost.reserve - s.overrun - s.extraCost;
const chemical = s => s.d.prop !== 'none' && s.d.prop !== 'ion';
const age = s => Math.max(0, (s.day - s.transit) / 365);
const money = v => (v < 0 ? `$${fmt(-v)}M over budget` : `$${fmt(v)}M`);
const spareText = v => (v < 0 ? `You are already $${fmt(-v)}M over budget.` : `You have $${fmt(v)}M of spare money.`);
const andList = a => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a.at(-1)}`);
const sciShare = (s, days) => Math.max(0.1, Math.round(days / s.opsDays * 1000) / 10); // % of mission science

export const EVENTS = [
  {
    id: 'storm', role: 'ops', icon: '☀️', title: 'Solar storm incoming',
    what: 'A burst of fast particles from the Sun will hit in a few hours. Radiation can damage electronics that are switched on.',
    risk: s => 0.45 * s.m.P.computer.fault,
    why: s => {
      const p = 0.45 * s.m.P.computer.fault;
      return `Your flight computer (${s.m.P.computer.name}) has a ${pct(p)} chance of being damaged if the instruments stay on.` +
        (s.d.computer === 'radhard' ? ' Radiation-hardened computers are built for this.' : ' A radiation-hardened computer would cut that to about 11%.');
    },
    choices: [
      { label: 'Safe mode for 5 days', gain: () => 'No risk of damage', cost: s => `5 days without observations (about ${sciShare(s, 5)}% of mission science)`,
        run: s => { s.safeDays += 5; return { good: true, text: 'The spacecraft rode out the storm in safe mode. 5 days of observations were skipped, nothing was damaged.' }; } },
      { label: 'Keep observing', gain: () => 'No observations lost', cost: () => 'If damaged: science −25% for the rest of the mission', risk: s => 0.45 * s.m.P.computer.fault,
        run: s => { const p = 0.45 * s.m.P.computer.fault; if (s.rng() < p) { s.sciMult *= 0.75; return { good: false, text: `Radiation damaged an instrument's electronics. Science is 25% lower from now on. (Risk was ${pct(p)}.)` }; } return { good: true, text: `Lucky! No damage. (Risk was ${pct(p)}.)` }; } },
    ],
    rec: s => (0.45 * s.m.P.computer.fault > 0.02 ? 0 : 1),
  },
  {
    id: 'wheel', role: 'eng', icon: '⚙️', title: 'Reaction wheel failure', when: s => ['wheels', 'star'].includes(s.d.adcs),
    what: 'One of the spinning wheels that aims the spacecraft has seized. Aiming is now less precise.',
    calc: s => {
      const pt = s.m.pointing * s.pointMult;
      const now = scienceDay(s.m.stats, 1, Infinity, pt).sci, after = scienceDay(s.m.stats, 1, Infinity, pt * 0.75).sci;
      const lossBackup = now > 0 ? 1 - after / now : 0;
      const affected = s.m.insts.filter(i => i.point > pt * 0.75 + 1e-9).map(i => i.name);
      return { lossBackup, affected, lossThrust: 0.3 * remainFrac(s) };
    },
    why(s) { const c = this.calc(s); return c.affected.length ? `Your ${andList(c.affected)} need${c.affected.length === 1 ? 's' : ''} precise aiming, so backup mode would cut science by about ${pct(c.lossBackup)}.` : 'None of your instruments need precise aiming, so backup mode costs you almost nothing.'; },
    choices: [
      { label: 'Switch to backup mode', gain: () => 'Mission keeps its full length', cost(s) { const c = EVENTS[1].calc(s); return `Aiming −25%: science −${pct(c.lossBackup)}`; },
        run: s => { s.pointMult *= 0.75; return { good: true, text: 'Backup mode on. Aiming is a little shakier from now on.' }; } },
      { label: 'Hold aim with thrusters', need: chemical, why: 'Needs a chemical engine', gain: () => 'Aiming stays perfect',
        cost: s => `Burns fuel: the mission ends about ${Math.round(0.3 * (s.endDay - s.day))} days early`,
        run: s => { const left = s.endDay - s.day; s.endDay = Math.round(s.day + left * 0.7); return { good: true, text: 'Thrusters are holding the aim, but fuel will run out early. The mission is now shorter.' }; } },
    ],
    rec(s) { const c = this.calc(s); return c.lossBackup <= c.lossThrust || !chemical(s) ? 0 : 1; },
  },
  {
    id: 'gs', role: 'ops', icon: '📡', title: 'Ground station outage',
    what: 'A storm on Earth knocked out your main ground antenna for about 10 days. Nothing can be sent home in that time.',
    calc: s => { const tenDays = 10 * s.m.data.gen, store = s.m.data.storage, lost = Math.max(0, tenDays - store); return { tenDays, store, lost, lostFrac: tenDays ? lost / tenDays : 0, reserve: reserveLeft(s) }; },
    why(s) {
      const c = this.calc(s);
      if (!c.tenDays) return 'You are not producing much data, so waiting costs nothing.';
      return (c.lost ? `Your computer can store ${fmt(c.store)} Gb, but you make ${fmt(c.tenDays)} Gb in 10 days, so about ${pct(c.lostFrac)} of that data would be lost.` : `Your computer can store ${fmt(c.store)} Gb, enough for all ${fmt(c.tenDays)} Gb you make in 10 days. Nothing will be lost.`) +
        ` ${spareText(c.reserve)}`;
    },
    choices: [
      { label: 'Wait it out', gain: () => 'Costs nothing', cost(s) { const c = EVENTS[2].calc(s); return c.lost ? `${pct(c.lostFrac)} of these 10 days of data is lost (only ~${sciShare(s, 10 * c.lostFrac)}% of the whole mission's science)` : 'Data waits onboard and is sent later'; },
        run: s => { s.noDownDays += 10; return { good: true, text: `No downlink for 10 days. Data was stored onboard (${fmt(s.m.data.storage)} Gb space); anything beyond that was lost.` }; } },
      { label: 'Rent backup antennas', gain: () => 'No data lost', cost: s => `$4M${reserveLeft(s) < 4 ? ' (this puts you over budget)' : ' from your spare money'}`,
        run: s => { s.extraCost += 4; return { good: true, text: 'Backup antennas kept the data flowing. $4M spent.' }; } },
    ],
    rec(s) { const c = this.calc(s); return c.lost > 0 && c.reserve >= 4 ? 1 : 0; },
  },
  {
    id: 'funding', role: 'lead', icon: '💸', title: 'Budget cut',
    what: "The space agency's budget was trimmed. Your mission must give back $10M.",
    why: s => { const r = reserveLeft(s); return `${spareText(r)} ` + (r >= 10 ? 'Paying keeps every observation, and you stay within budget.' : 'Paying $10M would put you over budget, and a mission over budget loses its money points.'); },
    choices: [
      { label: 'Pay $10M from spare money', gain: () => 'Observations continue as planned', cost: s => `Spare money drops to ${money(reserveLeft(s) - 10)}`,
        run: s => { s.extraCost += 10; return { good: reserveLeft(s) >= 0, text: reserveLeft(s) >= 0 ? 'Paid. Operations continue as planned.' : 'Paid, but the mission is now over budget.' }; } },
      { label: 'Observe less to save money', gain: () => 'Keeps your money', cost: s => `Instruments observe 25% less from now on (about −${Math.round(25 * remainFrac(s))}% of mission science)`,
        run: s => { s.dutyMult *= 0.75; return { good: true, text: 'Fewer observations from now on, but the money is safe.' }; } },
    ],
    rec: s => (reserveLeft(s) >= 10 ? 0 : 1),
  },
  {
    id: 'debris', role: 'lead', icon: '☄️', title: 'Space junk on a collision course', when: s => ['LEO', 'SSO', 'GEO'].includes(s.d.orbit),
    what: 'Tracking shows a piece of space junk will pass dangerously close in 2 days.',
    why: s => 'A hit would destroy the spacecraft and end the mission. ' + (s.d.prop !== 'none' ? 'Your engine can dodge it using a little fuel.' : 'You have no engine, so you cannot dodge.'),
    choices: [
      { label: 'Dodge it', need: s => s.d.prop !== 'none', why: 'Needs an engine', gain: () => 'Zero risk of collision', cost: () => '1 day without observations',
        run: s => { s.safeDays += 1; return { good: true, text: 'Dodged. The junk passed safely; 1 day of observations was skipped.' }; } },
      { label: 'Accept the risk', gain: () => 'No time lost', cost: () => 'If hit: the mission ends immediately', risk: () => 1 / 15,
        run: s => { if (s.rng() < 1 / 15) { s.fail('Struck by orbital debris. The spacecraft broke apart.'); return { good: false, text: 'Impact. The spacecraft was destroyed.' }; } return { good: true, text: 'It missed by 200 metres.' }; } },
    ],
    rec: s => (s.d.prop !== 'none' ? 0 : 1),
  },
  {
    id: 'meteor', role: 'eng', icon: '💥', title: 'Micrometeoroid strike',
    what: 'A grain of space dust punched through a solar panel. Power output dropped 15%.',
    calc: s => { const degr = s.m.power.isRTG ? 1 - 0.04 * age(s) : 1 - 0.025 * age(s); const gen = s.m.power.genAvg * degr * s.powerMult; return { after: gen * 0.85, use: s.m.power.cons, spare: gen * 0.85 - s.m.power.cons }; },
    why(s) { const c = this.calc(s); return c.spare >= 0 ? `Even after losing 15%, you would make ${fmt(c.after)} W and use ${fmt(c.use)} W. You have power to spare.` : `After losing 15%, you would make ${fmt(c.after)} W but need ${fmt(c.use)} W, so instruments would have to switch off part of the time.`; },
    choices: [
      { label: 'Accept the loss', gain: () => 'No time lost', cost(s) { const c = EVENTS[5].calc(s); return `Power −15% from now on${c.spare >= 0 ? ' (no effect: you have spare power)' : ' (instruments will run less)'}`; },
        run: s => { s.powerMult *= 0.85; return { good: true, text: 'Power is now 15% lower.' }; } },
      { label: 'Repair the circuits (3 days)', gain: () => 'Recovers most of it: only −5% power', cost: () => '3 days without observations',
        run: s => { s.safeDays += 3; s.powerMult *= 0.95; return { good: true, text: 'Engineers rerouted the circuits. Only 5% of the power was lost.' }; } },
    ],
    rec(s) { return this.calc(s).spare >= 0 ? 0 : 1; },
  },
  {
    id: 'discovery', role: 'sci', icon: '✨', title: 'Unexpected discovery',
    what: 'Your instruments caught something nobody predicted. Scientists want a 20-day special campaign.',
    why: s => s.m.data.ratio > 0.8 ? `Your antenna sends ${pct(s.m.data.ratio)} of your data home, so the extra campaign data will get through.` : `Your antenna only sends ${pct(s.m.data.ratio)} of your data home, so most of the campaign data would never reach Earth.`,
    choices: [
      { label: 'Run the campaign', gain: s => s.m.data.ratio > 0.8 ? `Big science bonus (+${fmt(s.m.sc.goal * 0.08)})` : `Small science bonus (+${fmt(s.m.sc.goal * 0.02)})`, cost: () => 'Nothing',
        run: s => { const ok = s.m.data.ratio > 0.8; s.bonusSci += ok ? s.m.sc.goal * 0.08 : s.m.sc.goal * 0.02; return { good: true, text: ok ? 'A headline result! Big science bonus.' : 'Only a small part of the campaign data reached Earth: small bonus.' }; } },
      { label: 'Stay on schedule', gain: () => 'Nothing changes', cost: () => 'You miss the bonus', run: () => ({ good: true, text: 'Science stays on plan.' }) },
    ],
    rec: () => 0,
  },
];
