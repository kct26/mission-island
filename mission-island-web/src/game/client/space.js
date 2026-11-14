// Space view shown during the mission simulation.
import * as THREE from 'three';
import { buildSpacecraft, planetTexture } from './models.js';

const texCache = {};
const tex = k => texCache[k] ||= planetTexture(k);

export class SpaceView {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02030a);
    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.01, 5000);
    this.scene.add(new THREE.AmbientLight(0x334466, 0.6));
    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.4); this.sunLight.position.set(-50, 10, 20); this.scene.add(this.sunLight);
    // stars
    const g = new THREE.BufferGeometry(), n = 4000, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(1500 + Math.random() * 1000); pos.set([v.x, v.y, v.z], i * 3); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false })));
    this.dyn = new THREE.Group(); this.scene.add(this.dyn);
    this.camYaw = 0.6; this.camPitch = 0.25; this.camDist = 1;
    this.t = 0;
  }

  setup(design, orbit) {
    this.dyn.clear();
    this.orbit = orbit; this.design = design;
    const R = 5;
    const bodyKind = orbit.body === 'l1' ? 'earth' : orbit.body;
    const body = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 40), new THREE.MeshStandardMaterial({ map: tex(bodyKind), roughness: 0.9 }));
    this.body = body; this.dyn.add(body);
    if (bodyKind === 'earth') {
      const clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.015, 64, 40), new THREE.MeshStandardMaterial({ map: tex('clouds'), transparent: true, depthWrite: false }));
      body.add(clouds); this.clouds = clouds;
    } else this.clouds = null;
    if (bodyKind !== 'moon') {
      const atm = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 48, 32), new THREE.MeshBasicMaterial({ color: bodyKind === 'mars' ? 0xff9966 : 0x66aaff, transparent: true, opacity: 0.12, side: THREE.BackSide }));
      body.add(atm);
    }
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(6, 32, 16), new THREE.MeshBasicMaterial({ color: 0xfff1b0 }));
    this.sun.position.set(-600, 60, 200); this.dyn.add(this.sun);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffdd88, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(120, 120, 1); this.sun.add(glow);
    this.sunLight.position.copy(this.sun.position);

    this.craft = buildSpacecraft(design);
    this.craft.scale.setScalar(0.35);
    this.dyn.add(this.craft);

    this.orbitR = orbit.body === 'l1' ? 0 : R * orbit.r;
    if (orbit.body === 'l1') {
      // place craft sunward, Earth behind it
      this.l1Pos = this.sun.position.clone().normalize().multiplyScalar(60);
      this.craft.position.copy(this.l1Pos);
    } else {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(this.orbitR, 0.01, 4, 200), new THREE.MeshBasicMaterial({ color: 0x5ad1ff, transparent: true, opacity: 0.4 }));
      ring.rotation.x = orbit.polar ? 0 : Math.PI / 2; if (orbit.polar) ring.rotation.y = Math.PI / 2;
      this.dyn.add(ring); this.ring = ring;
    }
    // downlink beam
    this.beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: 0x6cf08a, dashSize: 0.2, gapSize: 0.15 }));
    this.dyn.add(this.beam);
    // Earth marker for deep-space missions (for comms beam)
    this.earthDir = new THREE.Vector3(1, 0.1, 0.4).normalize();
    this.camDist = orbit.body === 'l1' ? 10 : this.orbitR * (orbit.r > 2 ? 1.6 : 2.6);
    this.cruising = false;
    this.camYaw = -0.9; this.camPitch = 0.25; // start on the sunlit side
  }

  update(dt, info) {
    this.t += dt;
    const { phase, downlinking, speed } = info;
    this.body.rotation.y += dt * 0.05 * speed;
    if (this.clouds) this.clouds.rotation.y += dt * 0.01 * speed;
    const cruise = phase === 'cruise';
    this.body.visible = !cruise || this.orbit.body === 'l1';
    if (this.ring) this.ring.visible = !cruise;
    let focus;
    if (cruise) {
      this.craft.position.set(0, 0, 0); this.craft.rotation.y += dt * 0.3;
      if (this.orbit.body === 'l1') { this.craft.position.copy(this.body.position).lerp(this.l1Pos, Math.min(1, info.progress)); }
      focus = this.craft.position.clone();
    } else if (this.orbit.body === 'l1') {
      const a = this.t * 0.3;
      this.craft.position.copy(this.l1Pos).add(new THREE.Vector3(0, Math.sin(a) * 2, Math.cos(a) * 3));
      this.craft.lookAt(this.sun.position);
      focus = this.craft.position.clone().lerp(new THREE.Vector3(), 0.08);
    } else {
      const a = this.t * (this.orbit.r > 2 ? 0.15 : 0.6) * Math.min(speed, 4);
      const r = this.orbitR;
      const p = this.orbit.polar ? new THREE.Vector3(0, Math.sin(a) * r, Math.cos(a) * r) : new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
      this.craft.position.copy(p);
      this.craft.lookAt(0, 0, 0); // instruments (+z) face the planet
      focus = new THREE.Vector3();
    }
    // comms beam
    const show = downlinking && !cruise && Math.sin(this.t * 6) > -0.3;
    this.beam.visible = show;
    if (show) {
      const to = ['earth', 'l1'].includes(this.orbit.body) ? this.craft.position.clone().normalize().multiplyScalar(5) : this.earthDir.clone().multiplyScalar(400);
      if (this.orbit.body === 'l1') to.set(0, 0, 0);
      this.beam.geometry.setFromPoints([this.craft.position.clone(), to]); this.beam.computeLineDistances();
    }
    const d = cruise ? 3 : this.camDist;
    const cp = new THREE.Vector3(Math.sin(this.camYaw) * Math.cos(this.camPitch), Math.sin(this.camPitch), Math.cos(this.camYaw) * Math.cos(this.camPitch)).multiplyScalar(d).add(focus);
    if (this.orbit.body === 'l1' && !cruise) cp.copy(this.craft.position).add(new THREE.Vector3(Math.sin(this.camYaw) * 6, 2 + this.camPitch * 4, Math.cos(this.camYaw) * 6));
    this.camera.position.lerp(cp, Math.min(1, dt * 2));
    this.camera.lookAt(this.orbit.body === 'l1' && !cruise ? this.craft.position : focus);
    if (!info.dragging) this.camYaw += dt * 0.05;
  }
}

let _glow;
function glowTex() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,220,150,0.6)'); g.addColorStop(1, 'rgba(255,200,100,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); _glow = new THREE.CanvasTexture(c); return _glow;
}
