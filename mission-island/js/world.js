// The open world: Mission Island spaceport.
import * as THREE from 'three';
import { buildSpacecraft, buildRocket, makeLabel } from './models.js';
import { ROLES } from './data.js';

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...o });
const shade = m => { m.castShadow = true; m.receiveShadow = true; return m; };

export const STATIONS = [
  { id: 'control', name: 'Mission Control', role: 'lead', x: 0,   z: -48, sub: 'Ground segment · Review' },
  { id: 'hangar',  name: 'Assembly Hangar', role: 'eng',  x: -58, z: -6,  sub: 'Space segment · Bus' },
  { id: 'lab',     name: 'Science Lab',     role: 'sci',  x: 58,  z: -6,  sub: 'Space segment · Payload' },
  { id: 'ground',  name: 'Ground Station',  role: 'ops',  x: 48,  z: 58,  sub: 'Ground segment · Comms' },
  { id: 'launch',  name: 'Launch Complex',  role: 'lead', x: -48, z: 66,  sub: 'Launch segment · GO' },
];
const ISLAND_R = 150;

export class World {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b8e8);
    this.scene.fog = new THREE.Fog(0x9cc4ea, 120, 420);
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1500);
    this.colliders = [];   // {x, z, r}
    this.tokens = [];
    this.time = 0;
    this.cam = { yaw: Math.PI, pitch: 0.38, dist: 14 };
    this.focus = null;     // camera override when a panel is open
    this.player = { pos: new THREE.Vector3(0, 0, 18), vy: 0, heading: Math.PI, walk: 0 };
    this.build();
  }

  build() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xcfe8ff, 0x557744, 0.9));
    const sun = new THREE.DirectionalLight(0xfff2d8, 1.9);
    sun.position.set(80, 140, 60); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120, near: 10, far: 400 });
    s.add(sun); this.sun = sun;

    // Sea + island
    const sea = new THREE.Mesh(new THREE.CircleGeometry(1400, 64), M(0x2a6fb0, { roughness: 0.25, metalness: 0.2 }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = -0.6; s.add(sea); this.sea = sea;
    const sand = new THREE.Mesh(new THREE.CircleGeometry(ISLAND_R + 12, 96), M(0xe3d3a1));
    sand.rotation.x = -Math.PI / 2; sand.position.y = -0.2; sand.receiveShadow = true; s.add(sand);
    const grass = new THREE.Mesh(new THREE.CircleGeometry(ISLAND_R, 96), M(0x6aa84f));
    grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; s.add(grass);

    // Plaza
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(16, 48), M(0xb9bec7));
    plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.03; plaza.receiveShadow = true; s.add(plaza);
    const globe = shade(new THREE.Mesh(new THREE.SphereGeometry(2.4, 32, 20), M(0x3b82f6, { metalness: 0.4, roughness: 0.3 })));
    globe.position.set(0, 7, 0); s.add(globe); this.globe = globe;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.12, 8, 64), M(0xfbbf24, { metalness: 0.8, roughness: 0.2 }));
    ring.position.copy(globe.position); ring.rotation.x = 1.2; s.add(ring); this.globeRing = ring;
    s.add(shade(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.4, 4.6, 16), M(0x9ca3af))).translateY(2.3));
    this.colliders.push({ x: 0, z: 0, r: 2.2 });

    // Paths from plaza to each station
    for (const st of STATIONS) {
      const len = Math.hypot(st.x, st.z), ang = Math.atan2(st.x, st.z);
      const path = new THREE.Mesh(new THREE.PlaneGeometry(5, len), M(0xc9b98f));
      path.rotation.x = -Math.PI / 2; path.rotation.z = ang + Math.PI; // align
      path.position.set(st.x / 2, 0.02, st.z / 2); path.receiveShadow = true; s.add(path);
    }

    this.stationObjs = {};
    this.buildControl(STATIONS[0]);
    this.buildHangar(STATIONS[1]);
    this.buildLab(STATIONS[2]);
    this.buildGround(STATIONS[3]);
    this.buildLaunch(STATIONS[4]);

    for (const st of STATIONS) {
      // trigger zone: in front of the building, toward the plaza
      const d = Math.hypot(st.x, st.z), nx = -st.x / d, nz = -st.z / d;
      const off = st.id === 'hangar' ? 23 : 16;
      st.zx = st.x + nx * off; st.zz = st.z + nz * off;
      const zone = new THREE.Mesh(new THREE.RingGeometry(3.2, 4, 48), new THREE.MeshBasicMaterial({ color: ROLES[st.role].color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
      zone.rotation.x = -Math.PI / 2; zone.position.set(st.zx, 0.06, st.zz); s.add(zone);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 6, 32, 1, true), new THREE.MeshBasicMaterial({ color: ROLES[st.role].color, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.set(st.zx, 3, st.zz); s.add(beam);
      const label = makeLabel(st.name, st.sub, ROLES[st.role].color);
      label.position.set(st.x, 17, st.z); s.add(label);
      const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), new THREE.MeshBasicMaterial({ color: 0xffd400 }));
      beacon.position.set(st.x, 21, st.z); s.add(beacon);
      Object.assign(this.stationObjs[st.id] ||= {}, { zone, beam, beacon, label });
    }

    this.buildNature();
    this.buildPlayer();
  }

  buildControl(st) {
    const g = new THREE.Group(); g.position.set(st.x, 0, st.z);
    g.add(shade(new THREE.Mesh(new THREE.BoxGeometry(22, 9, 12), M(0xe5e7eb))).translateY(4.5));
    const glass = new THREE.Mesh(new THREE.BoxGeometry(18, 3.5, 0.2), M(0x1e3a5f, { metalness: 0.6, roughness: 0.1, emissive: 0x0b2440, emissiveIntensity: 0.6 }));
    glass.position.set(0, 5.5, 6.05); g.add(glass);
    const door = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 0.2), M(0x374151)); door.position.set(0, 2, 6.1); g.add(door);
    g.add(shade(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 7, 8), M(0x9ca3af))).translateX(7).translateY(12.5));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(8, 4.5), new THREE.MeshBasicMaterial({ color: 0x0ea5e9 }));
    scr.position.set(-6, 12, 0); g.add(scr);
    this.scene.add(g); this.colliders.push({ x: st.x, z: st.z, r: 11.5 });
  }

  buildHangar(st) {
    const g = new THREE.Group(); g.position.set(st.x, 0, st.z); g.rotation.y = Math.PI / 2;
    const arch = shade(new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 24, 32, 1, true, -Math.PI / 2, Math.PI), M(0xcbd5e1, { side: THREE.DoubleSide, metalness: 0.4 })));
    arch.rotation.x = -Math.PI / 2;
    g.add(arch);
    const back = new THREE.Mesh(new THREE.CircleGeometry(10, 32, 0, Math.PI), M(0x94a3b8, { side: THREE.DoubleSide }));
    back.position.z = -12; g.add(back);
    const stripes = new THREE.Mesh(new THREE.PlaneGeometry(20, 1.2), M(0xf59e0b)); stripes.rotation.x = -Math.PI / 2; stripes.position.set(0, 0.04, 11); g.add(stripes);
    this.scene.add(g); this.colliders.push({ x: st.x, z: st.z, r: 11 });
    // Spacecraft display pedestal, toward the plaza
    const d = Math.hypot(st.x, st.z);
    const px = st.x - st.x / d * 16, pz = st.z - st.z / d * 16;
    const ped = shade(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 1.2, 32), M(0x475569, { metalness: 0.5 })));
    ped.position.set(px, 0.6, pz); this.scene.add(ped);
    this.colliders.push({ x: px, z: pz, r: 2.9 });
    this.pedestal = new THREE.Vector3(px, 1.2, pz);
    this.craftHolder = new THREE.Group(); this.craftHolder.position.set(px, 3.4, pz); this.scene.add(this.craftHolder);
  }

  buildLab(st) {
    const g = new THREE.Group(); g.position.set(st.x, 0, st.z);
    g.add(shade(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M(0xf8fafc, { metalness: 0.2, roughness: 0.35 }))));
    g.add(shade(new THREE.Mesh(new THREE.CylinderGeometry(10.2, 10.2, 1, 32), M(0x64748b))).translateY(0.5));
    const slit = new THREE.Mesh(new THREE.BoxGeometry(2, 10, 0.4), M(0x0f172a)); slit.position.set(0, 6, 7.4); slit.rotation.x = -0.6; g.add(slit);
    const tele = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 7, 16), M(0x334155)));
    tele.position.set(0, 9, 3); tele.rotation.x = 0.7; g.add(tele); this.labTele = tele;
    this.scene.add(g); this.colliders.push({ x: st.x, z: st.z, r: 10.5 });
  }

  buildGround(st) {
    const g = new THREE.Group(); g.position.set(st.x, 0, st.z);
    g.add(shade(new THREE.Mesh(new THREE.BoxGeometry(6, 3, 6), M(0xe5e7eb))).translateY(1.5));
    g.add(shade(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2, 7, 12), M(0xd1d5db))).translateY(6));
    const head = new THREE.Group(); head.position.y = 10;
    const pts = []; for (let i = 0; i <= 16; i++) { const x = (i / 16) * 9; pts.push(new THREE.Vector2(x, x * x / 18)); }
    const dish = shade(new THREE.Mesh(new THREE.LatheGeometry(pts, 48), M(0xf3f4f6, { side: THREE.DoubleSide, roughness: 0.4 })));
    head.add(dish);
    head.add(shade(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), M(0x9ca3af))).translateY(3));
    head.add(shade(new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 12), M(0x6b7280))).translateY(6));
    head.rotation.x = -0.9;
    const yaw = new THREE.Group(); yaw.position.copy(head.position); head.position.set(0, 0, 0); yaw.add(head); g.add(yaw);
    this.dish = yaw;
    this.scene.add(g); this.colliders.push({ x: st.x, z: st.z, r: 6 });
  }

  buildLaunch(st) {
    const g = new THREE.Group(); g.position.set(st.x, 0, st.z);
    g.add(shade(new THREE.Mesh(new THREE.BoxGeometry(16, 1.6, 16), M(0x9ca3af))).translateY(0.8));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, 5), M(0x111827)).translateY(1.65));
    const tower = new THREE.Group(); tower.position.set(5.5, 1.6, 0);
    const red = M(0xb91c1c, { metalness: 0.4 });
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) tower.add(shade(new THREE.Mesh(new THREE.BoxGeometry(0.3, 26, 0.3), red)).translateX(x).translateZ(z).translateY(13));
    for (let y = 2; y < 26; y += 3) tower.add(shade(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 2.4), red)).translateY(y));
    g.add(tower);
    this.scene.add(g); this.colliders.push({ x: st.x, z: st.z, r: 8.5 });
    this.padTop = new THREE.Vector3(st.x, 1.7, st.z);
    this.rocketHolder = new THREE.Group(); this.rocketHolder.position.copy(this.padTop); this.scene.add(this.rocketHolder);
    this.setRocket('large');
  }

  buildNature() {
    const rng = mulberry(42);
    const trunk = M(0x7c4a26), leaf = [M(0x2f7d32), M(0x3f8f3a), M(0x276a2b)];
    const clear = (x, z) => {
      if (Math.hypot(x, z) < 24) return false;
      for (const st of STATIONS) {
        if (Math.hypot(x - st.x, z - st.z) < 22) return false;
        // distance to path segment
        const t = Math.max(0, Math.min(1, (x * st.x + z * st.z) / (st.x * st.x + st.z * st.z)));
        if (Math.hypot(x - st.x * t, z - st.z * t) < 6) return false;
      }
      return true;
    };
    let placed = 0;
    for (let i = 0; i < 600 && placed < 140; i++) {
      const a = rng() * Math.PI * 2, r = 20 + rng() * (ISLAND_R - 26);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!clear(x, z)) continue;
      const sc = 0.8 + rng() * 0.9;
      const t = new THREE.Group(); t.position.set(x, 0, z); t.scale.setScalar(sc);
      t.add(shade(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 2.4, 6), trunk)).translateY(1.2));
      t.add(shade(new THREE.Mesh(new THREE.ConeGeometry(2, 4.2, 7), leaf[placed % 3])).translateY(4));
      t.add(shade(new THREE.Mesh(new THREE.ConeGeometry(1.5, 3.2, 7), leaf[(placed + 1) % 3])).translateY(5.8));
      this.scene.add(t); this.colliders.push({ x, z, r: 0.9 * sc });
      placed++;
    }
    for (let i = 0; i < 40; i++) {
      const a = rng() * Math.PI * 2, r = 30 + rng() * (ISLAND_R - 30);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!clear(x, z)) continue;
      const rock = shade(new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + rng() * 1.4, 0), M(0x8b8f97)));
      rock.position.set(x, 0.3, z); rock.rotation.set(rng() * 3, rng() * 3, 0); this.scene.add(rock);
      this.colliders.push({ x, z, r: 1.2 });
    }
    // distant mountains for an open-world horizon
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + rng() * 0.2, r = 380 + rng() * 120;
      const h = 40 + rng() * 70;
      const mtn = new THREE.Mesh(new THREE.ConeGeometry(50 + rng() * 40, h, 6), M(0x5b7d6a, { flatShading: true }));
      mtn.position.set(Math.cos(a) * r, h / 2 - 4, Math.sin(a) * r); this.scene.add(mtn);
    }
    // Grant tokens: explore the island to find them
    const tokMat = new THREE.MeshStandardMaterial({ color: 0xffd400, emissive: 0xffa000, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.2 });
    let n = 0;
    for (let i = 0; i < 400 && n < 8; i++) {
      const a = rng() * Math.PI * 2, r = 35 + rng() * (ISLAND_R - 45);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!clear(x, z)) continue;
      if (this.colliders.some(c => Math.hypot(c.x - x, c.z - z) < c.r + 2)) continue;
      const tok = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), tokMat);
      tok.position.set(x, 1.6, z); tok.castShadow = true; this.scene.add(tok);
      this.tokens.push({ mesh: tok, x, z, taken: false, idx: n++ });
    }
  }

  buildPlayer() {
    const g = new THREE.Group();
    const suit = M(0xf3f4f6), accent = M(0xf97316);
    const body = shade(new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 6, 12), suit)); body.position.y = 1.05; g.add(body);
    const pack = shade(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.3), M(0xd1d5db))); pack.position.set(0, 1.15, -0.4); g.add(pack);
    const helm = shade(new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 14), suit)); helm.position.y = 1.85; g.add(helm);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14, -Math.PI / 2.4, Math.PI / 1.2, Math.PI / 4, Math.PI / 2.4), M(0x1f2937, { metalness: 1, roughness: 0.05, emissive: 0x1d4ed8, emissiveIntensity: 0.25 }));
    visor.position.set(0, 1.85, 0.08); g.add(visor);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.05, 6, 20), accent); band.rotation.x = Math.PI / 2; band.position.y = 1.2; g.add(band);
    this.legs = [];
    for (const sx of [-1, 1]) {
      const leg = shade(new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.4, 4, 8), suit)); leg.position.set(sx * 0.2, 0.35, 0); g.add(leg); this.legs.push(leg);
    }
    this.playerMesh = g; this.scene.add(g);
    this.playerMesh.position.copy(this.player.pos);
  }

  setPlayerColor(hex) { this.playerMesh.children[4].material = M(new THREE.Color(hex)); }

  setSpacecraft(design) {
    this.craftHolder.clear();
    const sc = buildSpacecraft(design); sc.scale.setScalar(1.7);
    this.craftHolder.add(sc);
  }

  setRocket(lv) {
    this.rocketHolder.clear();
    this.rocket = buildRocket(lv || 'large'); this.rocketHolder.add(this.rocket);
    this.rocketHolder.position.copy(this.padTop);
    this.rocketHolder.visible = !!lv || true;
  }

  stationStatus(id, done) { const o = this.stationObjs[id]; o.beacon.material.color.set(done ? 0x22c55e : 0xffd400); }

  update(dt, input, frozen) {
    this.time += dt;
    const p = this.player;
    // animations
    this.globe.rotation.y += dt * 0.3; this.globeRing.rotation.z += dt * 0.4;
    this.dish.rotation.y = Math.sin(this.time * 0.2) * 1.2;
    this.craftHolder.rotation.y += dt * 0.4;
    for (const id in this.stationObjs) { const o = this.stationObjs[id]; o.beacon.rotation.y += dt * 2; o.beacon.position.y = 21 + Math.sin(this.time * 2) * 0.5; o.zone.material.opacity = 0.55 + Math.sin(this.time * 3) * 0.25; }
    for (const t of this.tokens) if (!t.taken) { t.mesh.rotation.y += dt * 2.5; t.mesh.position.y = 1.6 + Math.sin(this.time * 3 + t.idx) * 0.3; }

    if (!frozen) {
      // movement relative to camera yaw
      let fx = 0, fz = 0;
      if (input.f) fz += 1; if (input.b) fz -= 1; if (input.l) fx += 1; if (input.r) fx -= 1;
      const moving = fx || fz;
      const speed = input.run ? 19 : 10;
      if (moving) {
        const len = Math.hypot(fx, fz); fx /= len; fz /= len;
        const yaw = this.cam.yaw;
        const dx = (Math.sin(yaw) * fz + Math.cos(yaw) * fx) * -1;
        const dz = (Math.cos(yaw) * fz - Math.sin(yaw) * fx) * -1;
        p.pos.x += dx * speed * dt; p.pos.z += dz * speed * dt;
        const target = Math.atan2(dx, dz);
        let diff = target - p.heading; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        p.heading += diff * Math.min(1, dt * 12);
        p.walk += dt * speed * 1.1;
      }
      if (input.jump && p.pos.y <= 0.001) { p.vy = 9; }
      p.vy -= 25 * dt; p.pos.y = Math.max(0, p.pos.y + p.vy * dt); if (p.pos.y === 0) p.vy = 0;
      // collisions
      for (const c of this.colliders) {
        const dx = p.pos.x - c.x, dz = p.pos.z - c.z, d = Math.hypot(dx, dz), min = c.r + 0.5;
        if (d < min && d > 1e-6) { p.pos.x = c.x + dx / d * min; p.pos.z = c.z + dz / d * min; }
      }
      const r = Math.hypot(p.pos.x, p.pos.z);
      if (r > ISLAND_R - 1) { p.pos.x *= (ISLAND_R - 1) / r; p.pos.z *= (ISLAND_R - 1) / r; }
      this.playerMesh.position.copy(p.pos);
      this.playerMesh.rotation.y = p.heading;
      const sw = moving ? Math.sin(p.walk) * 0.35 : 0;
      this.legs[0].rotation.x = sw; this.legs[1].rotation.x = -sw;
      this.playerMesh.children[0].position.y = 1.05 + (moving ? Math.abs(Math.sin(p.walk)) * 0.06 : 0);
    }

    // camera
    const tgt = new THREE.Vector3(p.pos.x, p.pos.y + 1.7, p.pos.z);
    let camPos;
    if (this.focus) {
      camPos = this.focus.pos; tgt.copy(this.focus.look);
    } else {
      const { yaw, pitch, dist } = this.cam;
      camPos = new THREE.Vector3(tgt.x + Math.sin(yaw) * Math.cos(pitch) * dist, tgt.y + Math.sin(pitch) * dist, tgt.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    }
    this.camera.position.lerp(camPos, this.focus ? Math.min(1, dt * 3) : 1);
    if (!this.lookAt) this.lookAt = tgt.clone();
    this.lookAt.lerp(tgt, this.focus ? Math.min(1, dt * 3) : 1);
    this.camera.lookAt(this.lookAt);
    this.sun.position.set(p.pos.x + 80, 140, p.pos.z + 60); this.sun.target.position.copy(p.pos); this.sun.target.updateMatrixWorld();
  }

  nearestStation() {
    const p = this.player.pos;
    for (const st of STATIONS) if (Math.hypot(p.x - st.zx, p.z - st.zz) < 5) return st;
    return null;
  }

  checkTokens() {
    const p = this.player.pos;
    for (const t of this.tokens) if (!t.taken && Math.hypot(p.x - t.x, p.z - t.z) < 2.2) { t.taken = true; t.mesh.visible = false; return t; }
    return null;
  }

  focusOn(id) {
    const st = STATIONS.find(s => s.id === id);
    if (id === 'hangar') { const c = this.craftHolder.position; this.focus = { look: c.clone(), pos: new THREE.Vector3(c.x + 12, c.y + 3, c.z + 2) }; return; }
    if (id === 'launch') { const c = this.padTop; const h = this.rocket.userData.height; this.focus = { look: new THREE.Vector3(c.x, h * 0.5, c.z), pos: new THREE.Vector3(c.x + 22, h * 0.5 + 4, c.z + 26) }; return; }
    const d = Math.hypot(st.x, st.z);
    this.focus = { look: new THREE.Vector3(st.x, 6, st.z), pos: new THREE.Vector3(st.zx - st.x / d * 14 + (-st.z / d) * 10, 11, st.zz - st.z / d * 14 + (st.x / d) * 10) };
  }

  // Launch animation: returns true when finished
  launchStep(t) {
    const flame = this.rocket.getObjectByName('flame');
    const h = this.rocket.userData.height;
    flame.visible = t > 1;
    flame.scale.set(1 + Math.random() * 0.15, 1 + Math.random() * 0.3, 1 + Math.random() * 0.15);
    const lift = t > 2.2 ? Math.pow(t - 2.2, 2.2) * 3 : 0;
    this.rocketHolder.position.y = this.padTop.y + lift;
    this.rocketHolder.position.x = this.padTop.x + (t > 2.2 ? Math.random() * 0.06 : 0);
    if (t > 0.8 && Math.random() < 0.45) this.puff(t);
    const c = this.rocketHolder.position;
    const dl = Math.hypot(this.padTop.x, this.padTop.z), ux = -this.padTop.x / dl, uz = -this.padTop.z / dl;
    this.focus = { look: new THREE.Vector3(c.x, c.y + h * 0.5, c.z), pos: new THREE.Vector3(this.padTop.x + ux * 48, 12 + lift * 0.45, this.padTop.z + uz * 48) };
    for (const s of this.smoke || []) { s.life += 0.016; s.m.scale.multiplyScalar(1.012); s.m.position.y += 0.02; s.m.material.opacity = Math.max(0, 0.45 - s.life * 0.12); }
    return t > 7.5;
  }
  puff() {
    this.smoke ||= [];
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshLambertMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.45, depthWrite: false }));
    const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 7;
    m.position.set(this.padTop.x + Math.cos(a) * r, 2, this.padTop.z + Math.sin(a) * r);
    this.scene.add(m); this.smoke.push({ m, life: 0 });
    if (this.smoke.length > 90) { const old = this.smoke.shift(); this.scene.remove(old.m); }
  }
  resetLaunch(lv) {
    for (const s of this.smoke || []) this.scene.remove(s.m);
    this.smoke = []; this.setRocket(lv);
  }

  drawMinimap(ctx, w, h, tokensVisible) {
    const s = w / (ISLAND_R * 2.2), cx = w / 2, cy = h / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1d4f7a'; ctx.beginPath(); ctx.arc(cx, cy, w / 2, 0, 7); ctx.fill();
    ctx.fillStyle = '#5f9c48'; ctx.beginPath(); ctx.arc(cx, cy, ISLAND_R * s, 0, 7); ctx.fill();
    ctx.strokeStyle = '#d6c79a'; ctx.lineWidth = 2;
    for (const st of STATIONS) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + st.x * s, cy + st.z * s); ctx.stroke(); }
    for (const st of STATIONS) {
      ctx.fillStyle = ROLES[st.role].color; ctx.beginPath(); ctx.arc(cx + st.x * s, cy + st.z * s, 6, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText(st.name.split(' ')[0], cx + st.x * s, cy + st.z * s - 9);
    }
    if (tokensVisible) for (const t of this.tokens) if (!t.taken) { ctx.fillStyle = '#ffd400'; ctx.fillRect(cx + t.x * s - 2, cy + t.z * s - 2, 4, 4); }
    const p = this.player;
    ctx.save(); ctx.translate(cx + p.pos.x * s, cy + p.pos.z * s); ctx.rotate(-p.heading + Math.PI);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.restore();
  }
}

export function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
