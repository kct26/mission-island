// 3D model builders: spacecraft, rockets, planets, labels.
import * as THREE from 'three';

const M = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...opts });
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };

const INST_COLORS = { cam: 0x3b82f6, hires: 0x111827, tir: 0xef4444, hyper: 0xa855f7, sar: 0x9ca3af, lidar: 0x22c55e, neutron: 0xf59e0b, mag: 0x64748b, particle: 0x06b6d4, corona: 0xfacc15 };

export function buildSpacecraft(d) {
  const g = new THREE.Group();
  const s = { cube: 0.5, small: 0.85, medium: 1.3, large: 1.8 }[d.bus] || 0.7;
  const gold = M(0xd4a017, { metalness: 0.85, roughness: 0.3 });
  const silver = M(0xcfd6de, { metalness: 0.8, roughness: 0.25 });
  const panelMat = M(0x1e3a8a, { metalness: 0.5, roughness: 0.35, emissive: 0x0b1a4a, emissiveIntensity: 0.4 });
  const frame = M(0x9aa4b1, { metalness: 0.7 });

  const body = mesh(new THREE.BoxGeometry(s, s * 1.15, s), d.bus ? gold : M(0x666666, { wireframe: true }));
  g.add(body);

  // Power
  if (d.power === 'solar_s') {
    for (const sx of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.02, s * 1.0, s * 0.9), panelMat, sx * (s / 2 + 0.012), 0, 0));
  } else if (d.power === 'solar_m' || d.power === 'solar_l') {
    const segs = d.power === 'solar_l' ? 4 : 2, w = s * 0.9, h = s * (d.power === 'solar_l' ? 1.1 : 0.8);
    for (const sx of [-1, 1]) {
      g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, s * 0.35, 6).rotateZ(Math.PI / 2), frame, sx * (s / 2 + s * 0.17), 0, 0));
      for (let i = 0; i < segs; i++) {
        g.add(mesh(new THREE.BoxGeometry(w, h, 0.02), panelMat, sx * (s / 2 + s * 0.35 + w / 2 + i * (w + 0.03)), 0, 0));
      }
    }
  } else if (d.power === 'rtg') {
    const boom = mesh(new THREE.CylinderGeometry(0.02, 0.02, s * 0.6, 6), frame, 0, 0, 0); boom.rotation.x = Math.PI / 2; boom.position.set(0, -s * 0.3, -s * 0.75); g.add(boom);
    const rtg = new THREE.Group(); rtg.position.set(0, -s * 0.3, -s * 1.1);
    rtg.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.45, 12), M(0x374151, { metalness: 0.6 })));
    for (let i = 0; i < 6; i++) { const fin = mesh(new THREE.BoxGeometry(0.02, 0.42, 0.18), M(0x4b5563)); fin.position.set(Math.cos(i) * 0.18, 0, Math.sin(i) * 0.18); fin.rotation.y = -i; rtg.add(fin); }
    rtg.rotation.x = Math.PI / 2; g.add(rtg);
  }

  // Comms
  if (d.comms === 'uhf') {
    for (const sx of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, s * 0.9, 4), silver, sx * s * 0.3, s * 0.57 + s * 0.45, 0));
  } else if (d.comms === 'sband') {
    g.add(mesh(new THREE.BoxGeometry(s * 0.35, 0.03, s * 0.35), M(0xe5e7eb), 0, s * 0.59, 0));
  } else if (d.comms === 'xband' || d.comms === 'ka') {
    const r = s * (d.comms === 'ka' ? 0.75 : 0.6);
    const pts = []; for (let i = 0; i <= 10; i++) { const x = (i / 10) * r; pts.push(new THREE.Vector2(x, (x * x) / (r * 1.6))); }
    const dish = mesh(new THREE.LatheGeometry(pts, 24), new THREE.MeshStandardMaterial({ color: 0xf3f4f6, side: THREE.DoubleSide, roughness: 0.4 }));
    dish.position.set(0, s * 0.58 + 0.15, 0);
    g.add(dish);
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 6), frame, 0, s * 0.58 + 0.08, 0));
    g.add(mesh(new THREE.ConeGeometry(0.04, 0.12, 8), frame, 0, s * 0.58 + 0.15 + r * 0.45, 0));
  }

  // Instruments on the "nadir" (front, +z) face
  const inst = d.instruments || [];
  inst.forEach((id, idx) => {
    const cols = Math.ceil(Math.sqrt(inst.length)), row = Math.floor(idx / cols), col = idx % cols;
    const cell = s / cols;
    const x = -s / 2 + cell * (col + 0.5), y = s * 0.5 - cell * (row + 0.5) * 1.1;
    const big = ['hires', 'sar', 'corona', 'hyper'].includes(id);
    const len = big ? s * 0.5 : s * 0.22, rad = cell * (big ? 0.4 : 0.3);
    const tube = mesh(new THREE.CylinderGeometry(rad, rad, len, 14), M(INST_COLORS[id] || 0x888888, { metalness: 0.3 }));
    tube.rotation.x = Math.PI / 2; tube.position.set(x, y, s / 2 + len / 2);
    g.add(tube);
    const lens = mesh(new THREE.CircleGeometry(rad * 0.8, 14), M(0x0a0a0a, { metalness: 1, roughness: 0.05 }));
    lens.position.set(x, y, s / 2 + len + 0.002); g.add(lens);
  });

  // Propulsion
  if (d.prop && d.prop !== 'none') {
    const nozzle = mesh(new THREE.ConeGeometry(s * (d.prop === 'biprop' ? 0.22 : 0.12), s * 0.3, 16, 1, true), M(0x4b5563, { metalness: 0.8, side: THREE.DoubleSide }));
    nozzle.position.set(0, -s * 0.58 - s * 0.13, 0); g.add(nozzle);
    if (d.prop === 'ion') { nozzle.material = M(0x60a5fa, { emissive: 0x2563eb, emissiveIntensity: 1.2 }); }
    if (['mono', 'biprop'].includes(d.prop)) {
      for (const sx of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(s * 0.18, 16, 12), silver, sx * s * 0.25, -s * 0.55, -s * 0.25));
    }
  }
  // Star trackers
  if (d.adcs === 'star') for (const sx of [-1, 1]) {
    const st = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.14, 10), M(0x111827), sx * s * 0.35, s * 0.5, -s * 0.5);
    st.rotation.x = -0.6; g.add(st);
  }
  return g;
}

export function buildRocket(lvId) {
  const g = new THREE.Group();
  const spec = { small: [0.7, 9], medium: [1.1, 14], large: [1.5, 21], heavy: [1.5, 21] }[lvId] || [1, 12];
  const [r, h] = spec;
  const white = M(0xf5f5f5, { roughness: 0.4 });
  const dark = M(0x1f2937, { roughness: 0.5 });
  const stage1 = h * 0.62, stage2 = h * 0.25, fairing = h * 0.13;
  g.add(mesh(new THREE.CylinderGeometry(r, r, stage1, 24), lvId === 'small' ? dark : white, 0, stage1 / 2, 0));
  g.add(mesh(new THREE.CylinderGeometry(r * 1.01, r * 1.01, h * 0.03, 24), dark, 0, stage1, 0));
  g.add(mesh(new THREE.CylinderGeometry(r, r, stage2, 24), white, 0, stage1 + stage2 / 2, 0));
  g.add(mesh(new THREE.CylinderGeometry(r * 0.25, r * 1.08, fairing, 24), white, 0, stage1 + stage2 + fairing / 2, 0));
  g.add(mesh(new THREE.SphereGeometry(r * 0.25, 12, 8), white, 0, h, 0));
  const stripe = mesh(new THREE.CylinderGeometry(r * 1.005, r * 1.005, 0.4, 24), M(0x2563eb), 0, stage1 * 0.8, 0); g.add(stripe);
  for (let i = 0; i < 4; i++) {
    const fin = mesh(new THREE.BoxGeometry(0.08, h * 0.08, r * 0.8), dark);
    fin.position.set(Math.cos(i * Math.PI / 2) * r, h * 0.04, Math.sin(i * Math.PI / 2) * r);
    fin.rotation.y = -i * Math.PI / 2 + Math.PI / 2; g.add(fin);
  }
  if (lvId === 'heavy') for (const sx of [-1, 1]) {
    g.add(mesh(new THREE.CylinderGeometry(r, r, stage1, 24), white, sx * r * 2.05, stage1 / 2, 0));
    g.add(mesh(new THREE.ConeGeometry(r, r * 1.6, 24), white, sx * r * 2.05, stage1 + r * 0.8, 0));
  }
  // engine flame (hidden until launch)
  const flame = new THREE.Mesh(new THREE.ConeGeometry(r * 0.9, h * 0.4, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffa53a, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  flame.rotation.x = Math.PI; flame.position.y = -h * 0.2; flame.visible = false; flame.name = 'flame';
  g.add(flame);
  g.userData.height = h;
  return g;
}

export function makeLabel(text, sub = '', color = '#ffffff') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(10,14,30,0.78)'; roundRect(x, 6, 6, 500, 148, 28); x.fill();
  x.strokeStyle = color; x.lineWidth = 5; roundRect(x, 6, 6, 500, 148, 28); x.stroke();
  x.fillStyle = '#fff'; x.font = 'bold 56px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 256, sub ? 62 : 80);
  if (sub) { x.fillStyle = color; x.font = '34px system-ui, sans-serif'; x.fillText(sub, 256, 118); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(10, 3.1, 1); sp.renderOrder = 10;
  return sp;
}
function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

// ── Procedural planet textures (3D value noise sampled on the sphere: no seams) ──
function hash(x, y, z) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440662683)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
  return L(L(L(c(0,0,0), c(1,0,0), u), L(c(0,1,0), c(1,1,0), u), v), L(L(c(0,0,1), c(1,0,1), u), L(c(0,1,1), c(1,1,1), u), v), w);
}
function fbm(x, y, z, oct = 5) { let a = 0.5, f = 1, s = 0; for (let i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f); f *= 2; a *= 0.5; } return s; }

export function planetTexture(kind, W = 512, H = 256) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); const img = x.createImageData(W, H);
  const seed = { earth: 3.1, moon: 7.7, mars: 11.3, clouds: 19.9 }[kind];
  for (let j = 0; j < H; j++) {
    const lat = (0.5 - j / H) * Math.PI;
    for (let i = 0; i < W; i++) {
      const lon = (i / W) * Math.PI * 2;
      const px = Math.cos(lat) * Math.cos(lon), py = Math.sin(lat), pz = Math.cos(lat) * Math.sin(lon);
      const n = fbm(px * 2 + seed, py * 2 + seed, pz * 2 + seed);
      let r, g, b, a = 255;
      const polar = Math.abs(lat) / (Math.PI / 2);
      if (kind === 'earth') {
        if (n > 0.52) { const t = (n - 0.52) * 4; r = 60 + t * 120; g = 120 + t * 40 - polar * 20; b = 50 + t * 30; if (Math.abs(lat) < 0.45 && n > 0.6) { r = 190; g = 160; b = 100; } }
        else { const t = n / 0.52; r = 10 + t * 20; g = 50 + t * 60; b = 120 + t * 80; }
        if (polar > 0.82 + (n - 0.5) * 0.2) { r = g = b = 240; }
      } else if (kind === 'moon') {
        const v = 110 + n * 120 + (fbm(px * 9, py * 9, pz * 9, 3) - 0.5) * 70; r = g = b = v; if (n < 0.42) { r = g = b = v * 0.55; }
      } else if (kind === 'mars') {
        const t = fbm(px * 3 + 2, py * 3, pz * 3, 4);
        r = 150 + n * 90; g = 70 + n * 40; b = 40 + n * 20; if (t < 0.45) { r *= 0.6; g *= 0.6; b *= 0.6; }
        if (polar > 0.88) { r = g = b = 235; }
      } else { // clouds
        const t = fbm(px * 3 + 5, py * 5, pz * 3, 5); r = g = b = 255; a = Math.max(0, (t - 0.5) * 3) * 230;
      }
      const k = (j * W + i) * 4; img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = a;
    }
  }
  x.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
