// Records a captioned demo run of the live game. Logs scene windows (seconds from video start) to marks.json.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.GAME_URL || 'https://mission-island.vercel.app';
const DIR = URL_('.');
function URL_(p) { return new globalThis.URL(p, import.meta.url).pathname; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: [process.env.ANGLE || '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const T0 = Date.now();
fs.rmSync(DIR + 'frames', { recursive: true, force: true }); fs.mkdirSync(DIR + 'frames');
const frames = []; let fi = 0;
const cdp = await ctx.newCDPSession(page);
cdp.on('Page.screencastFrame', async f => {
  const name = `f${String(fi++).padStart(5, '0')}.jpg`;
  fs.writeFileSync(DIR + 'frames/' + name, Buffer.from(f.data, 'base64'));
  frames.push({ name, t: f.metadata.timestamp - T0 / 1000 });
  try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 1280, maxHeight: 720, everyNthFrame: 1 });
const now = () => (Date.now() - T0) / 1000;
const marks = [];
const run = (fn, arg) => page.evaluate(fn, arg);
const clearToasts = () => run(() => { const t = document.querySelector('#toast'); if (t) t.innerHTML = ''; });

async function caption(text, sub = '', pos = 'top') {
  await run(([text, sub, pos]) => {
    let el = document.getElementById('demoCap');
    if (!el) {
      el = document.createElement('div'); el.id = 'demoCap';
      el.style.cssText = 'position:fixed;left:50%;top:22px;transform:translateX(-50%);z-index:99999;max-width:86vw;text-align:center;' +
        'background:rgba(20,70,40,.92);color:#fff;border:2px solid #f6c744;border-radius:16px;padding:12px 26px;' +
        'font:700 28px/1.25 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.35);pointer-events:none';
      document.body.appendChild(el);
    }
    el.style.top = pos === 'top' ? '22px' : 'auto'; el.style.bottom = pos === 'top' ? 'auto' : '26px';
    el.innerHTML = text + (sub ? `<div style="font-weight:500;font-size:18px;color:#fff6cc;margin-top:4px">${sub}</div>` : '');
  }, [text, sub, pos]);
}
async function scene(name, dur, fn) {
  const s = now(); marks.push({ name, start: s, dur }); console.log('scene', name, s.toFixed(2));
  await (fn ? fn() : sleep(dur * 1000));
  const left = dur - (now() - s); if (left > 0) await sleep(left * 1000);
}

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.MI && document.querySelector('[data-s=lunar]'), null, { timeout: 60000 });
await run(() => document.querySelector('[data-s=lunar]').click());
await sleep(600);
await caption('Mission Island', 'Design, launch and fly your own space mission · NASA Space Apps 2026', 'bottom');
await sleep(400);
await scene('title', 3.0);

await run(() => document.querySelector('#start').click());
await sleep(1500); await clearToasts();
await run(() => { const c = MI.world.cam; c.yaw = Math.PI * 0.82; c.pitch = 0.42; c.dist = 34; window.__spin = true; (function f() { if (!window.__spin) return; c.yaw += 0.004; requestAnimationFrame(f); })(); });
await caption('Walk a 3D island spaceport', 'Five buildings: rocket, spacecraft, science, ground station, mission control');
await sleep(500);
await scene('island', 4.0);
await run(() => { window.__spin = false; });

await run(() => { MI.setDesign({ orbit: 'MOON' }); MI.openPanel('hangar', 'power'); });
await sleep(500); await clearToasts();
await caption('Every choice has a cost', 'Weight · power · money · data · lifetime · science');
await sleep(300);
await scene('hangar', 3.5, async () => {
  await sleep(1200); await run(() => document.querySelector('[data-pick=solar_m]')?.click()); await clearToasts();
});

await run(() => {
  MI.setDesign({ orbit: 'MOON', lv: 'large', bus: 'medium', power: 'solar_m', battery: 'batt_s', computer: 'obc', adcs: 'magtorq', prop: 'cold', comms: 'uhf', gs: 'uni', rover: 'rover_s', relay: 'none', instruments: ['neutron'] });
  MI.openPanel('control', 'review');
});
await sleep(600); await clearToasts();
await caption('The design review blocks impossible missions', 'and explains why, with a Fix button for each problem');
await sleep(300);
await scene('review', 3.5);

await run(() => {
  document.querySelector('[data-act=close]')?.click();
  MI.setDesign({ orbit: 'MOON', lv: 'large', bus: 'medium', power: 'solar_m', battery: 'batt_m', computer: 'obc', adcs: 'wheels', prop: 'mono', comms: 'xband', gs: 'dsn', rover: 'rover_s', relay: 'none', instruments: ['neutron', 'lidar', 'tir'] });
  MI.beginLaunch(); MI.G.sim.launchFailed = false; MI.G.launchT = 3.6;
});
await caption('Launch!', 'Rockets fail at real-style reliability');
await sleep(300); await clearToasts();
await scene('launch', 3.5);
await run(() => { MI.G.launchT = Math.max(MI.G.launchT, 7.6); });
await page.waitForFunction(() => MI.G.mode === 'sim', null, { timeout: 30000 });
await sleep(800);
await run(() => { MI.G.paused = true; const s = MI.G.sim; let ev = null; for (let i = 0; i < 5000 && !s.done; i++) { ev = s.step(); if (ev) break; } if (ev) MI.showEvent(ev); });
await sleep(800); await clearToasts();
await caption('Fly day by day and handle real NASA-style events', 'Solar storms, failures, budget cuts, space junk');
await sleep(300);
await scene('event', 3.5);

await run(() => { document.querySelector('#modal').classList.add('hidden'); const s = MI.G.sim; for (let i = 0; i < 5000 && !s.done; i++) { const ev = s.step(); if (ev) s.resolve(ev, ev.choices[0]); } MI.afterFlight(); });
await page.waitForFunction(() => MI.shadow.phase === 'plan', null, { timeout: 60000 });
await run(() => { const sh = MI.shadow, c = sh.terrain.crater; sh.plan.waypoints = [{ x: c.x, y: c.y, sampleH: 4 }, { x: c.x + 150, y: c.y + 1620, sampleH: 0 }]; sh.renderPlan(); sh.drawPlan(); });
await sleep(400);
await run(() => { const sh = MI.shadow; sh.go(); sh.speed = 2.2; sh.playT = 2.0; window.__follow = true; (function f() { if (!window.__follow) return; const p = sh.rover.position; sh.controls.target.copy(p); sh.camera.position.set(p.x + 90, p.y + 70, p.z + 110); requestAnimationFrame(f); })(); });
await clearToasts();
await caption('Moon: drive into a shadowed crater to find ice', 'then get back to sunlight before the battery dies');
await sleep(500);
await scene('shadowline', 4.5);
await run(() => { window.__follow = false; MI.shadow.speed = 60; });
await page.waitForSelector('[data-done]', { timeout: 90000 });
await run(() => document.querySelector('[data-done]').click());
await sleep(1200); await clearToasts();
await caption('Debrief: score, grade and real NASA missions to compare', 'Play free in your browser: mission-island.vercel.app', 'bottom');
await sleep(300);
await scene('report', 4.0);

fs.writeFileSync(DIR + 'marks.json', JSON.stringify(marks, null, 1));
await cdp.send('Page.stopScreencast');
fs.writeFileSync(DIR + 'frames.json', JSON.stringify(frames));
await ctx.close(); await browser.close();
console.log('frames', frames.length);
