// Small illustrations for every choice tile (SVG strings, 120×80). Drawn in code so they stay
// light, consistent and easy to change. Each part type has its own little picture.

const C = { gold: '#e2b23a', goldD: '#a77f1c', panel: '#2b5fb4', panelL: '#4f86d9', metal: '#c9d1d9', metalD: '#7c8794', dark: '#334155', flame: '#f59e0b', red: '#dc4a3a', green: '#2f9e57', sky: '#dff0e4', cream: '#fffaf0', earth: '#3a7bd5', moon: '#b9bcc4', mars: '#c8552b', sun: '#fbbf24', ice: '#5ec8d8' };
const svg = body => `<svg class="illus" viewBox="0 0 120 80" role="img" aria-hidden="true"><rect width="120" height="80" rx="10" fill="${C.sky}"/>${body}</svg>`;
const box = (cx, cy, s, fill = C.gold, edge = C.goldD) => `<rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" rx="2" fill="${fill}" stroke="${edge}" stroke-width="1.5"/><path d="M${cx - s / 2} ${cy - s / 6}h${s}M${cx - s / 6} ${cy - s / 2}v${s}" stroke="${edge}" stroke-width="0.8" opacity=".6"/>`;
const panelRow = (x, y, w, h, n) => Array.from({ length: n }, (_, i) => `<rect x="${x + i * (w + 2)}" y="${y}" width="${w}" height="${h}" fill="${C.panel}" stroke="${C.panelL}" stroke-width=".8"/>`).join('');
const dish = (cx, cy, r, fill = C.metal) => `<path d="M${cx - r} ${cy} A${r} ${r * 0.55} 0 0 0 ${cx + r} ${cy}Z" fill="${fill}" stroke="${C.metalD}" stroke-width="1.2"/><path d="M${cx} ${cy}v${-r * 0.7}" stroke="${C.metalD}" stroke-width="1.2"/><circle cx="${cx}" cy="${cy - r * 0.75}" r="1.8" fill="${C.dark}"/>`;
const label = t => `<text x="110" y="72" text-anchor="end" font-size="9" font-weight="700" fill="${C.dark}" font-family="system-ui, sans-serif">${t}</text>`;

const DRAW = {
  bus: id => { const s = { cube: 18, small: 26, medium: 36, large: 46 }[id] || 26; return svg(`<ellipse cx="60" cy="${42 + s / 2 + 4}" rx="${s * 0.8}" ry="3" fill="#000" opacity=".12"/>${box(60, 42, s)}`); },
  power: id => {
    if (id === 'solar_s') return svg(`${box(60, 40, 30)}<rect x="47" y="27" width="26" height="12" fill="${C.panel}" stroke="${C.panelL}"/>`);
    if (id === 'solar_m') return svg(`<path d="M30 40h60" stroke="${C.metalD}" stroke-width="2"/>${panelRow(8, 30, 10, 20, 2)}${panelRow(90, 30, 10, 20, 2)}${box(60, 40, 24)}`);
    if (id === 'solar_l') return svg(`<path d="M4 40h112" stroke="${C.metalD}" stroke-width="2"/>${panelRow(4, 26, 9, 28, 4)}${panelRow(80, 26, 9, 28, 4)}${box(60, 40, 22)}`);
    return svg(`${box(46, 40, 26)}<path d="M59 40h12" stroke="${C.metalD}" stroke-width="3"/><rect x="72" y="26" width="16" height="28" rx="4" fill="${C.dark}"/>${[0, 1, 2, 3].map(i => `<rect x="${68 + (i % 2) * 22}" y="${28 + Math.floor(i / 2) * 14}" width="2" height="10" fill="${C.metalD}"/>`).join('')}<circle cx="80" cy="40" r="3" fill="${C.flame}"/>`);
  },
  battery: id => { const n = { batt_s: 1, batt_m: 2, batt_l: 4 }[id] || 1; return svg(`<rect x="30" y="24" width="56" height="32" rx="5" fill="${C.cream}" stroke="${C.dark}" stroke-width="2.5"/><rect x="86" y="34" width="6" height="12" rx="2" fill="${C.dark}"/>${Array.from({ length: 4 }, (_, i) => `<rect x="${35 + i * 12.5}" y="29" width="10" height="22" rx="2" fill="${i < n ? C.green : '#d5dccf'}"/>`).join('')}`); },
  computer: id => {
    const chip = `<rect x="40" y="22" width="40" height="36" rx="4" fill="${C.dark}"/>${[0, 1, 2, 3].map(i => `<path d="M${46 + i * 9} 22v-6M${46 + i * 9} 58v6M40 ${28 + i * 8}h-6M80 ${28 + i * 8}h6" stroke="${C.metalD}" stroke-width="2"/>`).join('')}`;
    if (id === 'radhard') return svg(`${chip}<path d="M60 26l12 5v8c0 8-6 13-12 15-6-2-12-7-12-15v-8z" fill="${C.green}" stroke="#fff" stroke-width="1.5"/>`);
    if (id === 'edge') return svg(`${chip}<path d="M60 28l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="${C.sun}"/>`);
    return svg(`${chip}<rect x="48" y="30" width="24" height="20" rx="2" fill="#475569"/>`);
  },
  adcs: id => {
    if (id === 'magtorq') return svg(`${box(60, 40, 26)}${[[30, 40, 18, 6], [72, 40, 18, 6], [56, 14, 8, 10]].map(([x, y, w, h]) => `<rect x="${x}" y="${y - h / 2}" width="${w}" height="${h}" rx="3" fill="#b45f26"/>`).join('')}<path d="M20 22c10-8 70-8 80 0" stroke="${C.metalD}" stroke-dasharray="3 3" fill="none"/>`);
    const wheel = `<circle cx="60" cy="40" r="20" fill="${C.metal}" stroke="${C.metalD}" stroke-width="2"/><circle cx="60" cy="40" r="5" fill="${C.dark}"/><path d="M60 20v40M40 40h40" stroke="${C.metalD}"/><path d="M84 30a26 26 0 0 1 0 20" stroke="${C.green}" stroke-width="2.5" fill="none" marker-end=""/>`;
    if (id === 'star') return svg(`${wheel}<rect x="86" y="14" width="12" height="16" rx="2" fill="${C.dark}"/><circle cx="102" cy="10" r="1.5" fill="${C.sun}"/><circle cx="110" cy="18" r="1.2" fill="${C.sun}"/><circle cx="96" cy="6" r="1" fill="${C.sun}"/>`);
    return svg(wheel);
  },
  prop: id => {
    if (id === 'none') return svg(`${box(60, 34, 28)}<path d="M50 54l20 14M70 54L50 68" stroke="${C.red}" stroke-width="3"/>`);
    if (id === 'cold') return svg(`${box(60, 32, 28)}<path d="M56 46h8l2 8h-12z" fill="${C.metalD}"/><circle cx="60" cy="62" r="4" fill="#cfe3f5"/><circle cx="54" cy="68" r="3" fill="#cfe3f5"/><circle cx="66" cy="68" r="3" fill="#cfe3f5"/>`);
    if (id === 'ion') return svg(`${box(60, 30, 26)}<path d="M50 43h20l4 10H46z" fill="${C.metalD}"/><path d="M48 53h24l-6 20h-12z" fill="#60a5fa" opacity=".8"/><path d="M52 53h16l-4 14h-8z" fill="#bfdbfe"/>`);
    const tanks = id === 'biprop' ? `<circle cx="44" cy="30" r="12" fill="${C.metal}" stroke="${C.metalD}"/><circle cx="76" cy="30" r="12" fill="${C.metal}" stroke="${C.metalD}"/>` : `<circle cx="60" cy="28" r="13" fill="${C.metal}" stroke="${C.metalD}"/>`;
    const big = id === 'biprop';
    return svg(`${tanks}<path d="M${big ? 50 : 54} 44h${big ? 20 : 12}l${big ? 6 : 3} ${big ? 12 : 8}H${big ? 44 : 51}z" fill="${C.dark}"/><path d="M${big ? 46 : 52} ${big ? 56 : 52}h${big ? 28 : 16}l-${big ? 8 : 5} ${big ? 20 : 14}h-${big ? 12 : 6}z" fill="${C.flame}"/>`);
  },
  rover: id => { const big = id === 'rover_m', s = big ? 1.25 : 0.9; return svg(`<g transform="translate(60 46) scale(${s}) translate(-60 -46)"><rect x="34" y="34" width="52" height="16" rx="3" fill="#e5e7eb" stroke="${C.metalD}"/><rect x="40" y="24" width="30" height="8" fill="${C.panel}" transform="rotate(-8 55 28)"/><path d="M78 34V20h8" stroke="${C.dark}" stroke-width="2.5" fill="none"/>${[40, 60, 80].map(x => `<circle cx="${x}" cy="56" r="7" fill="${C.dark}"/>`).join('')}${big ? `<path d="M38 50v12" stroke="${C.dark}" stroke-width="3"/>` : ''}</g>`); },
  comms: id => {
    if (id === 'uhf') return svg(`${box(60, 46, 26)}<path d="M52 33l-10-24M68 33l10-24" stroke="${C.metalD}" stroke-width="2"/>`);
    if (id === 'sband') return svg(`${box(60, 46, 28)}<rect x="50" y="26" width="20" height="5" rx="1" fill="#e5e7eb" stroke="${C.metalD}"/>`);
    const r = id === 'ka' ? 30 : 24;
    return svg(`${box(60, 58, 20)}${dish(60, 44, r, id === 'ka' ? '#f3e2a8' : C.metal)}<path d="M${60 + r} 22c6 2 10 6 12 10M${60 + r} 14c10 3 16 9 18 16" stroke="${C.green}" stroke-width="2" fill="none"/>`);
  },
  gs: id => {
    if (id === 'uni') return svg(`<rect x="20" y="52" width="80" height="14" fill="#9cc58d"/>${dish(60, 40, 14)}<path d="M60 40v14" stroke="${C.metalD}" stroke-width="2"/>`);
    if (id === 'comm') return svg(`<circle cx="60" cy="44" r="24" fill="${C.earth}"/><path d="M42 36c8-6 18 0 22-4M48 56c6 0 10-6 18-2" stroke="#7cc47f" stroke-width="5" fill="none"/>${[[40, 22], [80, 22], [60, 70]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="${C.cream}" stroke="${C.dark}" stroke-width="1.5"/>`).join('')}`);
    return svg(`<rect x="10" y="60" width="100" height="10" fill="#9cc58d"/>${dish(60, 34, 30)}<path d="M52 34l-6 26h28l-6-26" fill="${C.metalD}"/>`);
  },
  relay: id => {
    const ground = `<path d="M0 64 L30 50 L52 64 L120 64 L120 80 L0 80z" fill="#9ea3ad"/><path d="M52 64 q14 10 28 0" fill="#575c66"/>`;
    const rover = `<rect x="60" y="62" width="12" height="5" fill="#e5e7eb"/>`;
    const earth = `<circle cx="104" cy="16" r="8" fill="${C.earth}"/>`;
    if (id === 'none') return svg(`${ground}${rover}${earth}<path d="M68 61L100 22" stroke="${C.red}" stroke-width="2" stroke-dasharray="4 3"/><path d="M80 44l6 6M86 44l-6 6" stroke="${C.red}" stroke-width="2"/>`);
    if (id === 'orbiter') return svg(`${ground}${rover}${earth}<path d="M10 22 Q60 -4 110 30" stroke="${C.metalD}" stroke-dasharray="2 3" fill="none"/><rect x="46" y="12" width="8" height="6" fill="${C.gold}"/><path d="M50 18L66 61M54 14L98 16" stroke="${C.green}" stroke-width="1.8" stroke-dasharray="4 3"/>`);
    return svg(`${ground}${rover}${earth}<path d="M30 50V18" stroke="${C.dark}" stroke-width="3"/>${dish(30, 18, 7)}<path d="M64 61L32 22M34 16L98 16" stroke="${C.green}" stroke-width="1.8" stroke-dasharray="4 3"/>`);
  },
  orbit: id => {
    if (id === 'L1') return svg(`<circle cx="14" cy="40" r="12" fill="${C.sun}"/><circle cx="100" cy="40" r="7" fill="${C.earth}"/><path d="M26 40H93" stroke="${C.metalD}" stroke-dasharray="3 4"/><circle cx="76" cy="40" r="4" fill="${C.green}" stroke="#fff" stroke-width="1.5"/><text x="76" y="56" text-anchor="middle" font-size="9" font-weight="700" fill="${C.dark}" font-family="system-ui">L1</text>`);
    const body = id === 'MOON' ? C.moon : id === 'MARS' ? C.mars : C.earth;
    const r = id === 'GEO' ? 10 : 16;
    const path = { LEO: `<ellipse cx="60" cy="40" rx="23" ry="9" fill="none" stroke="${C.green}" stroke-width="2.5"/>`, SSO: `<ellipse cx="60" cy="40" rx="8" ry="25" fill="none" stroke="${C.green}" stroke-width="2.5" transform="rotate(12 60 40)"/>`,
      GEO: `<ellipse cx="60" cy="40" rx="44" ry="16" fill="none" stroke="${C.green}" stroke-width="2.5"/>`, MOON: `<ellipse cx="60" cy="40" rx="8" ry="23" fill="none" stroke="${C.green}" stroke-width="2.5"/>`, MARS: `<ellipse cx="60" cy="40" rx="9" ry="24" fill="none" stroke="${C.green}" stroke-width="2.5" transform="rotate(-10 60 40)"/>` }[id];
    return svg(`${[[12, 10], [100, 14], [20, 66], [108, 62], [88, 8]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1" fill="${C.dark}" opacity=".5"/>`).join('')}<circle cx="60" cy="40" r="${r}" fill="${body}"/>${id === 'MOON' ? `<circle cx="55" cy="36" r="3" fill="#9a9da5"/><circle cx="64" cy="46" r="2" fill="#9a9da5"/>` : ''}${path}`);
  },
  lv: id => {
    const h = { small: 34, medium: 46, large: 58, heavy: 58 }[id] || 46, w = { small: 7, medium: 9, large: 11, heavy: 11 }[id] || 9, base = 72;
    const rocket = (cx, hh, ww) => `<rect x="${cx - ww / 2}" y="${base - hh}" width="${ww}" height="${hh}" fill="#f8fafc" stroke="${C.metalD}"/><path d="M${cx - ww / 2} ${base - hh}L${cx} ${base - hh - ww * 1.4}L${cx + ww / 2} ${base - hh}z" fill="#f8fafc" stroke="${C.metalD}"/><rect x="${cx - ww / 2}" y="${base - hh * 0.55}" width="${ww}" height="3" fill="${C.green}"/>`;
    return svg(`${id === 'heavy' ? rocket(60 - w - 1, h * 0.7, w) + rocket(60 + w + 1, h * 0.7, w) : ''}${rocket(60, h, w)}<rect x="30" y="72" width="60" height="4" fill="${C.metalD}"/>`);
  },
  instruments: id => {
    const glyph = {
      cam: `<rect x="38" y="28" width="44" height="28" rx="4" fill="${C.dark}"/><circle cx="60" cy="42" r="10" fill="#1e293b" stroke="${C.metal}" stroke-width="3"/><rect x="46" y="23" width="12" height="6" rx="1" fill="${C.dark}"/>`,
      hires: `<rect x="22" y="32" width="64" height="16" rx="3" fill="${C.dark}" transform="rotate(-12 54 40)"/><circle cx="90" cy="31" r="9" fill="#1e293b" stroke="${C.metal}" stroke-width="3"/>`,
      tir: `<rect x="54" y="16" width="12" height="38" rx="6" fill="${C.cream}" stroke="${C.dark}" stroke-width="2"/><circle cx="60" cy="58" r="9" fill="${C.red}"/><rect x="57" y="30" width="6" height="26" fill="${C.red}"/><path d="M80 30c4 4-4 8 0 12M90 28c4 4-4 8 0 12" stroke="${C.flame}" stroke-width="2.5" fill="none"/>`,
      hyper: `<path d="M30 56L52 20L74 56z" fill="#e0f2fe" stroke="${C.metalD}" stroke-width="1.5"/>${['#ef4444', '#f59e0b', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6'].map((c, i) => `<path d="M64 ${34 + i * 3}L104 ${26 + i * 6}" stroke="${c}" stroke-width="3"/>`).join('')}<path d="M10 42L46 40" stroke="#fff" stroke-width="3"/>`,
      sar: `<rect x="24" y="30" width="34" height="20" rx="2" fill="${C.dark}"/>${[0, 1, 2].map(i => `<path d="M${66 + i * 12} ${28 - i * 4}a${14 + i * 6} ${14 + i * 6} 0 0 1 0 ${24 + i * 8}" stroke="${C.green}" stroke-width="2.5" fill="none"/>`).join('')}`,
      lidar: `<rect x="20" y="30" width="26" height="20" rx="3" fill="${C.dark}"/><path d="M46 40L100 64" stroke="${C.red}" stroke-width="2.5"/><circle cx="100" cy="64" r="4" fill="${C.red}" opacity=".6"/><path d="M60 70h50" stroke="${C.metalD}" stroke-width="2"/>`,
      neutron: `<circle cx="60" cy="40" r="6" fill="${C.green}"/>${[0, 60, 120].map(a => `<ellipse cx="60" cy="40" rx="26" ry="9" fill="none" stroke="${C.dark}" stroke-width="1.8" transform="rotate(${a} 60 40)"/>`).join('')}<circle cx="86" cy="40" r="3" fill="${C.ice}"/>`,
      mag: `<path d="M40 22v22a20 20 0 0 0 40 0V22h-12v22a8 8 0 0 1-16 0V22z" fill="${C.red}"/><rect x="40" y="16" width="12" height="8" fill="${C.metal}"/><rect x="68" y="16" width="12" height="8" fill="${C.metal}"/>`,
      particle: `<circle cx="18" cy="40" r="10" fill="${C.sun}"/>${[[40, 30], [56, 44], [72, 34], [88, 48], [100, 30], [48, 54], [80, 22]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5" fill="${C.flame}"/><path d="M${x - 8} ${y}h5" stroke="${C.flame}" stroke-width="1.5" opacity=".6"/>`).join('')}`,
      corona: `<circle cx="60" cy="40" r="26" fill="${C.sun}" opacity=".35"/><circle cx="60" cy="40" r="18" fill="${C.sun}" opacity=".6"/><circle cx="60" cy="40" r="13" fill="${C.dark}"/><path d="M80 22c10-6 16 0 20-4" stroke="${C.flame}" stroke-width="2.5" fill="none"/>`,
    }[id] || '';
    return svg(glyph);
  },
};

export function illustration(cat, id) {
  try { return (DRAW[cat] || DRAW.bus)(id); } catch { return svg(''); }
}
