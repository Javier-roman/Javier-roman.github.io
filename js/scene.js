// Escena 3D procedural: puesto de trabajo, personaje de arcilla y lámpara de lava.
// Three.js r186 (vendor/). Geometrías redondeadas, materiales PBR, sombras suaves, ACES + sRGB.
// Si existe assets/avatar.glb (data-avatar), sustituye al personaje procedural.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TerminalScreen } from './terminal.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// Cede el hilo principal entre pasos de montaje para no crear tareas largas
const yieldToMain = () => (globalThis.scheduler?.yield ? globalThis.scheduler.yield() : new Promise((r) => setTimeout(r, 0)));
const UP = V(0, 1, 0);
const _a = V(), _b = V(), _c = V(), _d = V();
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
const DESK_Y = 0.74; // superficie del tablero

/* Encuadres de cámara por paso del hero (posición, objetivo, fov, desplazamiento: >0 → sujeto a la derecha) */
export const VIEWS = [
  { pos: V(-0.3, 1.5, 3.8), target: V(-0.04, 0.84, 0.0), fov: 33, shift: 0.19 },
  { pos: V(-2.85, 1.85, 2.85), target: V(0.0, 0.84, 0.0), fov: 25, shift: -0.03 },
  { pos: V(-0.02, 1.36, 0.92), target: V(0.44, 1.12, -0.18), fov: 29, shift: 0.2 },
];

/* ---------------------------------------------------------------- materiales */
function makeMaterials() {
  // Físico (sheen) solo donde aporta: piel y tela. El resto, estándar: shaders más ligeros
  const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.7, metalness: 0, ...o });
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...o });
  return {
    skin: phys(0xd9a68f, { roughness: 0.58, sheen: 0.3, sheenColor: new THREE.Color(0xffd8c8), sheenRoughness: 0.5 }),
    hair: std(0x2b211c, { roughness: 0.78 }),
    hoodie: phys(0x2f2c38, { roughness: 0.9, sheen: 0.85, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x8c82c4) }),
    rib: phys(0x27252f, { roughness: 0.95, sheen: 0.6, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x6f67a0) }),
    pants: phys(0x222128, { roughness: 0.88, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x5e5a70) }),
    shoe: std(0xebe9ee, { roughness: 0.42 }),
    sole: std(0xc9c6d0, { roughness: 0.6 }),
    laces: std(0x34323c, { roughness: 0.7 }),
    string: std(0xdcd8e2, { roughness: 0.6 }),
    eye: std(0x141216, { roughness: 0.1 }),
    eyeShine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    mouth: std(0x7a4646, { roughness: 0.6 }),
    phones: std(0x19181d, { roughness: 0.28 }),
    cushion: std(0x27262c, { roughness: 0.92 }),
    accent: std(0x8f80e0, { emissive: 0xb4a5ff, emissiveIntensity: 0.45, roughness: 0.4 }),
    accentDim: std(0x3a3450, { emissive: 0x7a6cc8, emissiveIntensity: 0.35, roughness: 0.4 }),
    frames: std(0x0f0e12, { roughness: 0.22 }),
    lens: std(0xc9ceff, { roughness: 0.05, transparent: true, opacity: 0.14, depthWrite: false }),
    deskTop: std(0xdcdae1, { roughness: 0.45 }),
    metalDark: std(0x131316, { metalness: 0.3, roughness: 0.34 }),
    monitor: std(0x141418, { roughness: 0.3 }),
    led: new THREE.MeshBasicMaterial({ color: 0xb4a5ff }),
    kbBase: std(0x1b1a20, { roughness: 0.5 }),
    keys: std(0x2d2c34, { roughness: 0.62 }),
    mat: std(0x1f1e25, { roughness: 0.95 }),
    mug: std(0xe9e7ec, { roughness: 0.28 }),
    coffee: std(0x2a1a14, { roughness: 0.12 }),
    note: std(0x2b2937, { roughness: 0.7 }),
    paper: std(0xe7e5ea, { roughness: 0.85 }),
    pen: std(0x16151a, { roughness: 0.3 }),
    book1: std(0x24222c, { roughness: 0.8 }),
    book2: std(0x3a3646, { roughness: 0.8 }),
    book3: std(0x7f72c9, { roughness: 0.7 }),
    cable: std(0x0d0d10, { roughness: 0.5 }),
    chair: std(0x1d1c22, { roughness: 0.5 }),
    chairMetal: std(0x2b2a31, { metalness: 0.35, roughness: 0.32 }),
    caster: std(0x111114, { roughness: 0.4 }),
    lampMetal: std(0x2a2730, { metalness: 0.35, roughness: 0.3 }),
    lampLiquid: std(0x6b2f7c, { emissive: 0x3c1450, emissiveIntensity: 0.9, roughness: 0.08, transparent: true, opacity: 0.5, depthWrite: false }),
    wax: std(0xffa6dc, { emissive: 0xf27ad0, emissiveIntensity: 1.5, roughness: 0.35 }),
  };
}

function mesh(geo, mat, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}
function rbox(w, h, d, r, mat, seg = 4) { return mesh(new RoundedBoxGeometry(w, h, d, seg, r), mat); }
function placeBetween(m, a, b) {
  m.position.copy(a).add(b).multiplyScalar(0.5);
  _d.copy(b).sub(a).normalize();
  m.quaternion.setFromUnitVectors(UP, _d);
}
function radialTexture(stops, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// Cápsula cónica (r1 abajo, r2 arriba), centrada, eje +Y: para brazos y piernas más orgánicos
function taperedCapsuleGeometry(r1, r2, len, seg = 22) {
  const pts = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) { const a = -Math.PI / 2 + (i / steps) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.cos(a) * r1, Math.sin(a) * r1)); }
  for (let i = 0; i <= steps; i++) { const a = (i / steps) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.cos(a) * r2, len + Math.sin(a) * r2)); }
  const g = new THREE.LatheGeometry(pts, seg);
  g.translate(0, -len / 2, 0);
  g.computeVertexNormals();
  return g;
}

/* ---------------------------------------------------------------- escritorio y entorno */
function buildDesk(M, screenTexture) {
  const g = new THREE.Group();
  // tablero
  const top = rbox(0.66, 0.035, 1.28, 0.012, M.deskTop);
  top.position.set(0.18, DESK_Y - 0.0175, 0);
  g.add(top);
  // patas en T (marco negro)
  [-0.58, 0.58].forEach((z) => {
    const post = rbox(0.045, 0.69, 0.045, 0.01, M.metalDark);
    post.position.set(0.2, 0.36, z);
    const foot = rbox(0.6, 0.026, 0.05, 0.012, M.metalDark);
    foot.position.set(0.2, 0.013, z);
    const arm = rbox(0.52, 0.022, 0.045, 0.01, M.metalDark);
    arm.position.set(0.2, 0.694, z);
    g.add(post, foot, arm);
  });
  const beam = rbox(0.04, 0.045, 1.12, 0.01, M.metalDark);
  beam.position.set(0.3, 0.66, 0);
  g.add(beam);

  // monitor
  const body = rbox(0.03, 0.405, 0.69, 0.012, M.monitor);
  body.position.set(0.418, 1.152, 0);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.655, 0.37), new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false }));
  screen.rotation.y = -Math.PI / 2;
  screen.position.set(0.4015, 1.157, 0);
  const neck = rbox(0.03, 0.26, 0.07, 0.01, M.monitor);
  neck.position.set(0.452, 0.88, 0);
  neck.rotation.z = 0.12;
  const base = rbox(0.2, 0.014, 0.25, 0.007, M.monitor);
  base.position.set(0.455, DESK_Y + 0.007, 0);
  const led = mesh(new THREE.SphereGeometry(0.0035, 10, 8), M.led, { cast: false, receive: false });
  led.position.set(0.402, 0.958, 0.3);
  g.add(body, screen, neck, base, led);
  // cable del monitor: por detrás de la mesa hasta el suelo
  const cablePath = new THREE.CatmullRomCurve3([V(0.46, 1.0, 0.02), V(0.5, 0.86, 0.05), V(0.53, DESK_Y + 0.004, 0.1), V(0.56, 0.6, 0.12), V(0.55, 0.25, 0.1), V(0.6, 0.008, 0.05)]);
  g.add(mesh(new THREE.TubeGeometry(cablePath, 48, 0.0055, 8, false), M.cable));

  // alfombrilla bajo teclado y ratón
  const mat = rbox(0.24, 0.004, 0.7, 0.002, M.mat, 2);
  mat.position.set(-0.025, DESK_Y + 0.002, 0.07);
  g.add(mat);

  // teclado + teclas instanciadas (se hunden al ritmo del terminal)
  const kbY = DESK_Y + 0.004;
  const kb = rbox(0.15, 0.016, 0.43, 0.006, M.kbBase);
  kb.position.set(-0.035, kbY + 0.008, 0);
  g.add(kb);
  const keyGeo = new RoundedBoxGeometry(0.019, 0.009, 0.0235, 2, 0.003);
  const rows = 5, cols = 15;
  const keys = new THREE.InstancedMesh(keyGeo, M.keys, rows * cols);
  keys.castShadow = false;
  keys.receiveShadow = true;
  const keyPos = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) keyPos.push(V(-0.087 + r * 0.026, kbY + 0.0205, -0.188 + c * 0.0268));
  }
  const mtx = new THREE.Matrix4();
  keyPos.forEach((p, i) => { mtx.makeTranslation(p.x, p.y, p.z); keys.setMatrixAt(i, mtx); });
  g.add(keys);
  const pressed = new Float32Array(rows * cols);
  function pressKey() { pressed[(Math.random() * pressed.length) | 0] = 0.11; }
  function updateKeys(dt) {
    let dirty = false;
    for (let i = 0; i < pressed.length; i++) {
      if (pressed[i] <= 0) continue;
      pressed[i] = Math.max(0, pressed[i] - dt);
      const p = keyPos[i];
      mtx.makeTranslation(p.x, p.y - (pressed[i] > 0 ? 0.0035 : 0), p.z);
      keys.setMatrixAt(i, mtx);
      dirty = true;
    }
    if (dirty) keys.instanceMatrix.needsUpdate = true;
  }

  // ratón
  const mouse = mesh(new THREE.SphereGeometry(0.03, 24, 16), M.kbBase);
  mouse.scale.set(1.5, 0.55, 1.05);
  mouse.position.set(-0.02, DESK_Y + 0.004 + 0.0165, 0.3);
  g.add(mouse);

  // taza
  const mug = new THREE.Group();
  const cup = mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(0.038, 0), new THREE.Vector2(0.041, 0.006),
    new THREE.Vector2(0.042, 0.09), new THREE.Vector2(0.036, 0.09), new THREE.Vector2(0.035, 0.012), new THREE.Vector2(0, 0.012),
  ], 40), M.mug);
  const handle = mesh(new THREE.TorusGeometry(0.024, 0.0065, 10, 24, Math.PI * 1.15), M.mug);
  handle.rotation.z = -Math.PI * 0.575 + Math.PI / 2;
  handle.position.set(0.042, 0.048, 0);
  const coffee = mesh(new THREE.CircleGeometry(0.035, 32), M.coffee, { cast: false });
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.075;
  mug.add(cup, handle, coffee);
  mug.position.set(0.17, DESK_Y, 0.44);
  mug.rotation.y = -0.6;
  g.add(mug);

  // libreta con goma lila y bolígrafo
  const note = new THREE.Group();
  const pages = rbox(0.163, 0.01, 0.222, 0.003, M.paper);
  pages.position.set(0.002, 0.006, 0);
  const cover = rbox(0.17, 0.006, 0.23, 0.003, M.note);
  cover.position.y = 0.013;
  const backCover = rbox(0.17, 0.004, 0.23, 0.002, M.note);
  backCover.position.y = 0.002;
  const band = rbox(0.008, 0.019, 0.232, 0.003, M.accent);
  band.position.set(0.055, 0.008, 0);
  const pen = mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.15, 12), M.pen);
  pen.rotation.set(Math.PI / 2, 0, 0.35);
  pen.position.set(-0.02, 0.021, 0.0);
  note.add(pages, cover, backCover, band, pen);
  note.position.set(-0.02, DESK_Y, -0.43);
  note.rotation.y = 0.18;
  g.add(note);

  // libros apilados
  const books = new THREE.Group();
  [[0.17, 0.028, 0.235, M.book1, 0.0], [0.155, 0.024, 0.215, M.book3, 0.12], [0.16, 0.03, 0.225, M.book2, -0.06]].reduce((y, [w, h, d, m, rot]) => {
    const b = rbox(w, h, d, 0.004, m);
    b.position.y = y + h / 2;
    b.rotation.y = rot;
    books.add(b);
    return y + h;
  }, 0);
  books.position.set(0.37, DESK_Y, 0.47);
  books.rotation.y = 0.25;
  g.add(books);

  return { group: g, pressKey, updateKeys, mugTop: V(0.17, DESK_Y + 0.085, 0.44) };
}

function buildChair(M) {
  const g = new THREE.Group();
  const seat = rbox(0.44, 0.07, 0.46, 0.03, M.chair);
  seat.position.set(0, 0.465, 0);
  const back = rbox(0.05, 0.46, 0.42, 0.024, M.chair);
  back.position.set(-0.235, 0.82, 0);
  back.rotation.z = 0.13;
  const support = rbox(0.03, 0.32, 0.05, 0.01, M.chairMetal);
  support.position.set(-0.215, 0.58, 0);
  support.rotation.z = 0.32;
  const lift = mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.34, 20), M.chairMetal);
  lift.position.set(0, 0.27, 0);
  g.add(seat, back, support, lift);
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 + 0.3;
    const arm = rbox(0.29, 0.03, 0.045, 0.012, M.chairMetal);
    arm.position.set(Math.cos(ang) * 0.14, 0.085, Math.sin(ang) * 0.14);
    arm.rotation.y = -ang;
    const caster = mesh(new THREE.SphereGeometry(0.028, 16, 12), M.caster);
    caster.position.set(Math.cos(ang) * 0.28, 0.03, Math.sin(ang) * 0.28);
    g.add(arm, caster);
  }
  return g;
}

function buildLavaLamp(M) {
  const g = new THREE.Group();
  const base = mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(0.055, 0), new THREE.Vector2(0.06, 0.008),
    new THREE.Vector2(0.046, 0.095), new THREE.Vector2(0.0, 0.095),
  ], 40), M.lampMetal);
  const glassProfile = [
    [0.043, 0.095], [0.052, 0.13], [0.058, 0.17], [0.054, 0.215], [0.044, 0.262], [0.032, 0.305], [0.028, 0.312],
  ];
  const liquid = new THREE.Mesh(new THREE.LatheGeometry(glassProfile.map(([r, y]) => new THREE.Vector2(r, y)), 40), M.lampLiquid);
  liquid.renderOrder = 2;
  const cap = mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.031, 0.31), new THREE.Vector2(0.024, 0.352), new THREE.Vector2(0.0, 0.354),
  ], 32), M.lampMetal);
  g.add(base, liquid, cap);
  const radiusAt = (y) => {
    for (let i = 0; i < glassProfile.length - 1; i++) {
      const [r0, y0] = glassProfile[i], [r1, y1] = glassProfile[i + 1];
      if (y >= y0 && y <= y1) return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
    }
    return 0.03;
  };
  const blobs = [];
  const defs = [
    { r: 0.022, speed: 0.11, phase: 0.0, x: 0.004, z: -0.006 },
    { r: 0.016, speed: 0.15, phase: 1.7, x: -0.012, z: 0.008 },
    { r: 0.026, speed: 0.08, phase: 3.1, x: 0.006, z: 0.004 },
    { r: 0.013, speed: 0.19, phase: 4.4, x: 0.01, z: 0.012 },
    { r: 0.018, speed: 0.13, phase: 5.6, x: -0.008, z: -0.01 },
  ];
  defs.forEach((d) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(d.r, 24, 16), M.wax);
    b.userData = d;
    blobs.push(b);
    g.add(b);
  });
  const pool = new THREE.Mesh(new THREE.SphereGeometry(0.04, 24, 12), M.wax);
  pool.scale.set(1, 0.32, 1);
  pool.position.y = 0.1;
  g.add(pool);
  const light = new THREE.PointLight(0xf2a6e6, 0.55, 1.6, 2);
  light.position.set(0, 0.2, 0);
  g.add(light);
  function update(t) {
    blobs.forEach((b) => {
      const d = b.userData;
      const u = (Math.sin(t * d.speed * 2 * Math.PI * 0.35 + d.phase) + 1) / 2;
      const y = 0.118 + smooth(u) * 0.16;
      const maxR = Math.max(0.004, radiusAt(y) - d.r * 0.8);
      b.position.set(clamp(d.x, -maxR, maxR), y, clamp(d.z, -maxR, maxR));
      const stretch = 1 + Math.abs(Math.cos(t * d.speed * 2 * Math.PI * 0.35 + d.phase)) * 0.45;
      b.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
    });
    light.intensity = 0.5 + Math.sin(t * 0.7) * 0.06;
  }
  return { group: g, update };
}

/* Vapor del café: unos pocos sprites suaves que suben y se desvanecen */
function buildSteam(origin) {
  const tex = radialTexture([[0, 'rgba(255,255,255,0.55)'], [0.5, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0)']], 128);
  const puffs = [];
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xe9e4ff, transparent: true, opacity: 0, depthWrite: false }));
    s.userData.phase = i / 5;
    puffs.push(s);
    g.add(s);
  }
  g.position.copy(origin);
  function update(t) {
    puffs.forEach((s, i) => {
      const k = (t * 0.22 + s.userData.phase) % 1;
      s.position.set(Math.sin(t * 0.9 + i * 2.1) * 0.012 * k, k * 0.2, Math.cos(t * 0.7 + i) * 0.01 * k);
      const sc = 0.03 + k * 0.07;
      s.scale.set(sc, sc * 1.3, 1);
      s.material.opacity = Math.sin(k * Math.PI) * 0.16;
    });
  }
  return { group: g, update };
}

/* ---------------------------------------------------------------- personaje */
// Pelo: casquete inclinado (frente alta, nuca cubierta) con mechones y tupé suaves
function hairGeometry() {
  const g = new THREE.SphereGeometry(0.146, 96, 64, 0, Math.PI * 2, 0, 1.42);
  g.rotateZ(0.56);
  const pos = g.attributes.position;
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.copy(v).normalize();
    const clumps = 0.008 * Math.sin(n.x * 6 + n.z * 3.5) * Math.sin(n.y * 5 + n.z * 7)
      + 0.0018 * Math.sin(n.x * 15 + n.y * 11) * Math.sin(n.z * 13 + n.x * 4);
    const front = Math.max(0, n.x) * Math.max(0, n.y);
    const quiff = 0.045 * Math.pow(front * 2, 2.0) * (0.85 + 0.15 * Math.sin(n.z * 5 + 0.6));
    const crown = 0.012 * Math.max(0, n.y);
    v.addScaledVector(n, Math.max(-0.003, clumps) + quiff + crown);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// Cabeza: esfera deformada → frente redondeada, mejillas llenas y mentón suave, sin costuras
function headGeometry() {
  const g = new THREE.SphereGeometry(0.138, 72, 56);
  const pos = g.attributes.position;
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.copy(v).normalize();
    v.y *= 1.05;
    v.z *= 0.93;
    const low = Math.max(0, -n.y);                    // mitad inferior de la cara
    const front = Math.max(0, n.x);
    v.y -= 0.03 * low * low;                          // alarga la parte baja (mandíbula)
    v.x += 0.026 * front * low;                       // mentón y mejillas hacia delante
    v.z *= 1 - 0.16 * low * low;                      // estrecha hacia la barbilla
    v.x += 0.006 * front * Math.exp(-((n.y + 0.15) ** 2) / 0.02) * (1 - Math.abs(n.z)); // pómulos
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// Superficie frontal del torso (perfil del torno × escala X) para pegar detalles a la tela
const TORSO_PROFILE = [[0.16, 0.0], [0.166, 0.06], [0.174, 0.16], [0.182, 0.26], [0.18, 0.33], [0.166, 0.39], [0.135, 0.44], [0.09, 0.475], [0.05, 0.49]];
const TORSO_SX = 0.8, TORSO_SZ = 1.18;
function torsoFrontX(y) {
  for (let i = 0; i < TORSO_PROFILE.length - 1; i++) {
    const [r0, y0] = TORSO_PROFILE[i], [r1, y1] = TORSO_PROFILE[i + 1];
    if (y >= y0 && y <= y1) return (r0 + ((y - y0) / (y1 - y0)) * (r1 - r0)) * TORSO_SX;
  }
  return 0.04;
}

// Mano con palma, cuatro dedos y pulgar; los dedos teclean
function buildHand(M, s) {
  const g = new THREE.Group();
  const palm = rbox(0.066, 0.026, 0.066, 0.012, M.skin);
  palm.position.set(0.03, 0, 0);
  g.add(palm);
  const fingerGeo = new THREE.CapsuleGeometry(0.0078, 0.024, 4, 10);
  fingerGeo.rotateZ(-Math.PI / 2);   // eje del dedo → +X
  fingerGeo.translate(0.02, 0, 0);   // pivota en el nudillo
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const f = mesh(fingerGeo, M.skin);
    f.position.set(0.06, -0.002, (-0.0245 + i * 0.0163));
    f.rotation.z = -0.62;            // curvados hacia las teclas
    f.userData.phase = i * 1.7 + (s > 0 ? 0 : 0.9);
    g.add(f);
    fingers.push(f);
  }
  const thumbGeo = new THREE.CapsuleGeometry(0.0088, 0.022, 4, 10);
  thumbGeo.rotateZ(-Math.PI / 2);
  thumbGeo.translate(0.018, 0, 0);
  const thumb = mesh(thumbGeo, M.skin);
  thumb.position.set(0.022, -0.004, -0.032 * s);
  thumb.rotation.set(0, 0.55 * s, -0.5);
  g.add(thumb);
  // open (0..1): dedos estirados y algo abiertos, para saludar
  function type(t, amount, open = 0) {
    fingers.forEach((f, i) => {
      const tap = Math.max(0, Math.sin(t * 14 + f.userData.phase)) * amount;
      const curl = -0.62 + 0.22 * tap;
      f.rotation.set(0, open * (1.5 - i) * 0.085, curl + (-0.07 - curl) * open);
    });
    thumb.rotation.set(0, (0.55 + 0.3 * open) * s, -0.5 + 0.26 * open);
  }
  return { group: g, type };
}

function buildCharacter(M) {
  const root = new THREE.Group();

  // pelvis y piernas (fijas: sentado; muslos apoyados SOBRE el asiento, sin atravesarlo)
  const pelvis = rbox(0.235, 0.15, 0.33, 0.07, M.pants);
  pelvis.position.set(0.0, 0.58, 0);
  root.add(pelvis);
  [-1, 1].forEach((s) => {
    const hip = V(0.04, 0.585, 0.095 * s);
    const knee = V(0.39, 0.575, 0.112 * s);
    const ankle = V(0.43, 0.12, 0.12 * s);
    const thigh = mesh(taperedCapsuleGeometry(0.068, 0.078, hip.distanceTo(knee)), M.pants);
    placeBetween(thigh, knee, hip);
    const shin = mesh(taperedCapsuleGeometry(0.052, 0.064, knee.distanceTo(ankle)), M.pants);
    placeBetween(shin, ankle, knee);
    const kneeCap = mesh(new THREE.SphereGeometry(0.066, 20, 14), M.pants);
    kneeCap.position.copy(knee);
    // zapatilla: puntera redondeada, suela y cordones
    const shoe = rbox(0.235, 0.088, 0.112, 0.042, M.shoe);
    shoe.position.set(ankle.x + 0.055, 0.056, ankle.z);
    const sole = rbox(0.245, 0.024, 0.118, 0.011, M.sole);
    sole.position.set(ankle.x + 0.055, 0.012, ankle.z);
    const laces = rbox(0.085, 0.012, 0.05, 0.006, M.laces);
    laces.position.set(ankle.x + 0.07, 0.1, ankle.z);
    laces.rotation.z = -0.32;
    root.add(thigh, shin, kneeCap, shoe, sole, laces);
  });

  // torso (inclinado hacia la mesa)
  const torso = new THREE.Group();
  torso.position.set(-0.01, 0.605, 0);
  torso.rotation.z = -0.17;
  root.add(torso);
  const profile = [[0.0, 0.0], ...TORSO_PROFILE, [0.0, 0.492]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = mesh(new THREE.LatheGeometry(new THREE.SplineCurve(profile).getPoints(44), 44), M.hoodie);
  body.scale.set(TORSO_SX, 1, TORSO_SZ);
  torso.add(body);
  // cintura de canalé
  const waistGeo = new THREE.TorusGeometry(0.161, 0.021, 12, 44);
  waistGeo.rotateX(Math.PI / 2);
  const waist = mesh(waistGeo, M.rib);
  waist.scale.set(TORSO_SX, 1, TORSO_SZ);
  waist.position.y = 0.022;
  torso.add(waist);
  // bolsillo canguro (pegado a la tela) con su abertura
  const pocket = rbox(0.016, 0.115, 0.25, 0.008, M.hoodie);
  pocket.position.set(torsoFrontX(0.13) + 0.003, 0.13, 0);
  pocket.rotation.z = 0.09;
  const slit = rbox(0.004, 0.006, 0.2, 0.002, M.rib);
  slit.position.set(torsoFrontX(0.19) + 0.012, 0.19, 0);
  torso.add(pocket, slit);
  // capucha (bajada, recogida detrás del cuello)
  const hoodGeo = new THREE.TorusGeometry(0.098, 0.052, 14, 32, Math.PI * 1.3);
  hoodGeo.rotateZ(Math.PI * 0.35);
  hoodGeo.rotateX(-Math.PI / 2);
  const hood = mesh(hoodGeo, M.hoodie);
  hood.scale.set(1.0, 1.0, 1.22);
  hood.position.set(-0.035, 0.468, 0);
  hood.rotation.z = 0.25;
  torso.add(hood);
  // cordones: siguen la superficie de la tela, con su remate al final
  [-1, 1].forEach((s) => {
    const z = 0.032 * s;
    const pts = [0.452, 0.415, 0.375, 0.335, 0.3].map((y, i) => V(torsoFrontX(y) + 0.006 + i * 0.0015, y, z + i * 0.002 * s));
    const curve = new THREE.CatmullRomCurve3(pts);
    torso.add(mesh(new THREE.TubeGeometry(curve, 20, 0.0042, 8, false), M.string));
    const end = pts[pts.length - 1], prev = pts[pts.length - 2];
    const tip = mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.02, 10), M.string);
    placeBetween(tip, end, V().copy(end).add(V().copy(end).sub(prev).normalize().multiplyScalar(0.02)));
    torso.add(tip);
  });
  const neck = mesh(new THREE.CylinderGeometry(0.047, 0.05, 0.1, 20), M.skin);
  neck.position.set(0.012, 0.5, 0);
  torso.add(neck);

  // cabeza
  const headPivot = new THREE.Group();
  headPivot.position.set(0.016, 0.535, 0);
  torso.add(headPivot);
  const head = new THREE.Group();
  headPivot.add(head);
  // cabeza en una sola malla esculpida (sin juntas): cráneo + mejillas + mentón continuos
  const skull = mesh(headGeometry(), M.skin);
  skull.position.set(0, 0.135, 0);
  const nose = mesh(new THREE.SphereGeometry(0.024, 20, 14), M.skin);
  nose.scale.set(1.15, 1.0, 0.85);
  nose.position.set(0.138, 0.118, 0);
  head.add(skull, nose);
  const eyes = [], shines = [];
  [-1, 1].forEach((s) => {
    const eye = mesh(new THREE.SphereGeometry(0.0175, 18, 14), M.eye, { cast: false });
    eye.scale.set(0.55, 1.25, 1);
    eye.position.set(0.123, 0.152, 0.047 * s);
    const shine = mesh(new THREE.SphereGeometry(0.0034, 10, 8), M.eyeShine, { cast: false, receive: false });
    shine.position.set(0.1328, 0.1585, 0.047 * s - 0.0045);
    const brow = mesh(new THREE.CapsuleGeometry(0.0078, 0.03, 4, 10), M.hair);
    brow.rotation.x = Math.PI / 2;
    brow.rotation.y = 0.12 * s;
    brow.position.set(0.118, 0.194, 0.05 * s);
    head.add(eye, shine, brow);
    eyes.push(eye);
    shines.push(shine);
  });
  const mouthGeo = new THREE.TorusGeometry(0.021, 0.0043, 8, 20, Math.PI * 0.7);
  mouthGeo.rotateZ(-Math.PI * 0.85);
  mouthGeo.rotateY(Math.PI / 2);
  const mouth = mesh(mouthGeo, M.mouth, { cast: false });
  mouth.position.set(0.137, 0.088, 0);
  head.add(mouth);
  const hair = mesh(hairGeometry(), M.hair);
  hair.scale.set(1.0, 1.05, 0.95);
  hair.position.set(-0.004, 0.136, 0);
  head.add(hair);
  // flequillo: unos mechones sueltos que rompen el borde del pelo
  [[0.112, 0.262, 0.03, 0.036, -0.5], [0.118, 0.255, -0.022, 0.032, -0.35], [0.1, 0.27, -0.065, 0.03, -0.2], [0.098, 0.268, 0.075, 0.028, -0.25]]
    .forEach(([x, y, z, r, rz]) => {
      const lock = mesh(new THREE.SphereGeometry(r, 20, 14), M.hair);
      lock.scale.set(1.35, 0.42, 0.85);
      lock.position.set(x, y, z);
      lock.rotation.set(0, 0, rz);
      head.add(lock);
    });
  // gafas
  const frameShape = (w, h, r) => {
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2);
    sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return sh;
  };
  const outer = frameShape(0.062, 0.045, 0.012);
  outer.holes.push(frameShape(0.046, 0.029, 0.008));
  const frameGeo = new THREE.ExtrudeGeometry(outer, { depth: 0.009, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0012, bevelSegments: 2, curveSegments: 8 });
  frameGeo.center();
  frameGeo.rotateY(Math.PI / 2);
  const lensGeo = new THREE.PlaneGeometry(0.05, 0.033);
  lensGeo.rotateY(Math.PI / 2);
  [-1, 1].forEach((s) => {
    const f = mesh(frameGeo, M.frames, { cast: true, receive: false });
    f.position.set(0.143, 0.152, 0.047 * s);
    const lens = new THREE.Mesh(lensGeo, M.lens);
    lens.position.set(0.144, 0.152, 0.047 * s);
    // patilla: termina antes de la almohadilla del auricular (no la atraviesa)
    const a = V(0.139, 0.158, 0.079 * s), b = V(0.062, 0.152, 0.122 * s);
    const temple = mesh(new THREE.CapsuleGeometry(0.0035, a.distanceTo(b), 4, 8), M.frames);
    placeBetween(temple, a, b);
    head.add(f, lens, temple);
  });
  const bridge = mesh(new THREE.CapsuleGeometry(0.0035, 0.024, 4, 8), M.frames);
  bridge.rotation.x = Math.PI / 2;
  bridge.position.set(0.146, 0.157, 0);
  head.add(bridge);
  // auriculares (diadema algo más amplia: no se hunde en el pelo)
  const bandGeo = new THREE.TorusGeometry(0.168, 0.0125, 10, 56, Math.PI);
  bandGeo.rotateY(Math.PI / 2);
  const band = mesh(bandGeo, M.phones);
  band.position.set(-0.014, 0.142, 0);
  head.add(band);
  [-1, 1].forEach((s) => {
    const slider = rbox(0.014, 0.05, 0.012, 0.005, M.phones);
    slider.position.set(-0.014, 0.142, 0.164 * s);
    const cupGeo = new THREE.CylinderGeometry(0.054, 0.054, 0.042, 36);
    cupGeo.rotateX(Math.PI / 2);
    const cup = mesh(cupGeo, M.phones);
    cup.position.set(-0.012, 0.122, 0.156 * s);
    const cushion = mesh(new THREE.TorusGeometry(0.043, 0.015, 12, 32), M.cushion);
    cushion.position.set(-0.012, 0.122, 0.134 * s);
    const ring = mesh(new THREE.TorusGeometry(0.03, 0.0024, 8, 40), M.accentDim, { cast: false, receive: false });
    ring.position.set(-0.012, 0.122, 0.1775 * s);
    head.add(slider, cup, cushion, ring);
  });

  // brazos (IK de dos huesos) con extremidades cónicas, puño de canalé y mano con dedos
  const L1 = 0.27, L2 = 0.25;
  const upperGeo = taperedCapsuleGeometry(0.052, 0.061, L1);   // abajo (codo) → arriba (hombro)
  const foreGeo = taperedCapsuleGeometry(0.04, 0.05, L2 - 0.02); // abajo (muñeca) → arriba (codo)
  // puño: anillo de canalé con los bordes redondeados (abierto: la mano sale de él)
  const cuffGeo = new THREE.LatheGeometry([
    [0.036, -0.02], [0.043, -0.021], [0.0475, -0.016], [0.0485, 0.0], [0.0475, 0.016], [0.043, 0.021], [0.036, 0.02],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 24);
  const arms = [-1, 1].map((s) => {
    const upper = mesh(upperGeo, M.hoodie);
    const fore = mesh(foreGeo, M.hoodie);
    const elbow = mesh(new THREE.SphereGeometry(0.052, 18, 14), M.hoodie);
    const cuff = mesh(cuffGeo, M.rib);
    const hand = buildHand(M, s);
    root.add(upper, fore, elbow, cuff, hand.group);
    return { s, upper, fore, elbow, cuff, hand, shoulderLocal: V(0.0, 0.405, 0.198 * s) };
  });

  const state = { yaw: 0, pitch: 0, blink: 0, nextBlink: 2.5, typing: 0 };

  function solveIK(S, H, pole, out) {
    _a.copy(H).sub(S);
    let dist = _a.length();
    dist = clamp(dist, 0.05, L1 + L2 - 0.002);
    _a.normalize();
    const cosA = clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1);
    const ang = Math.acos(cosA);
    _b.copy(pole).sub(S);
    _c.crossVectors(_a, _b).normalize();
    _b.crossVectors(_c, _a).normalize();
    out.copy(S).addScaledVector(_a, L1 * Math.cos(ang)).addScaledVector(_b, L1 * Math.sin(ang));
    return out;
  }

  const S = V(), E = V(), H = V(), P = V(), W = V(), F = V(), C0 = V(), C1 = V(), tmp = V();
  // Saludo: vectores, ejes y cuaterniones reutilizados (no se crea nada por fotograma)
  const camL = V(), toCam = V(), axis = V(), Hw = V(), Pw = V(), Ew = V(), Fw = V(), Xh = V(), Yh = V(), Zh = V();
  const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), qC = new THREE.Quaternion();
  const eul = new THREE.Euler(), basis = new THREE.Matrix4();
  const WAVE_HAND = V(0.36, 0.27, -0.02);   // muñeca respecto al hombro (marco del torso girado): delante y a la altura de la cara
  const WAVE_POLE = V(0.25, -0.45, 0.25);   // codo abajo y algo hacia fuera
  const REST = { arm: 0, head: 0, torso: 0, typingOff: 0, swing: 0, flex: 0, tilt: 0, dip: 0 };

  // look = { w: pesos del saludo (0..1), cam: posición de la cámara en el mundo }
  function update(t, dt, pointer, typing, look = null) {
    const w = look?.w || REST;
    const cam = look?.cam || null;
    root.updateWorldMatrix(true, false);
    if (cam) root.worldToLocal(camL.copy(cam));
    // respiración; al saludar, el torso se endereza un poco y gira hacia la cámara
    const breath = Math.sin(t * 1.55);
    torso.scale.set(1 + breath * 0.006, 1 + breath * 0.011, 1 + breath * 0.008);
    const lean = -0.17 + breath * 0.006;
    qA.setFromEuler(eul.set(0, 0, lean, 'XYZ'));
    let twist = 0;
    if (cam && w.torso > 0) {
      twist = clamp(Math.atan2(-camL.z, camL.x - torso.position.x) * 0.3, -0.4, 0.2);
      qB.setFromEuler(eul.set(0, twist, lean + 0.05, 'XYZ'));
      qA.slerp(qB, w.torso);
      twist *= w.torso;
    }
    torso.quaternion.copy(qA);
    // cabeza: mira al monitor y sigue un poco al cursor; al saludar, mira a la cámara (cada fotograma)
    const tyaw = -0.22 - pointer.x * 0.24;
    const tpitch = 0.11 + pointer.y * 0.08;
    const k = 1 - Math.exp(-dt * 3.2);
    state.yaw += (tyaw - state.yaw) * k;
    state.pitch += (tpitch - state.pitch) * k;
    qA.setFromEuler(eul.set(0, state.yaw + Math.sin(t * 0.45) * 0.015, state.pitch + Math.sin(t * 0.6) * 0.01, 'YZX'));
    if (cam && w.head > 0) {
      torso.updateWorldMatrix(false, false);
      torso.worldToLocal(toCam.copy(cam)).sub(headPivot.position);
      toCam.y -= 0.15;                                   // desde la altura de los ojos
      const yawC = clamp(Math.atan2(-toCam.z, toCam.x), -1.45, 0.5);
      const pitchC = clamp(Math.atan2(toCam.y, Math.hypot(toCam.x, toCam.z)), -0.35, 0.45);
      qB.setFromEuler(eul.set(w.tilt, yawC, pitchC, 'YZX'));
      qA.slerp(qB, w.head);
    }
    headPivot.quaternion.copy(qA);
    // parpadeo
    state.nextBlink -= dt;
    if (state.nextBlink <= 0) { state.blink = 0.14; state.nextBlink = 2.2 + Math.random() * 3.5; }
    if (state.blink > 0) state.blink -= dt;
    const closed = state.blink > 0;
    eyes.forEach((e) => { e.scale.y = closed ? 0.15 : 1.25; });
    shines.forEach((sh) => { sh.visible = !closed; });
    // tecleo (se para durante el saludo)
    state.typing += ((typing ? 1 : 0) * (1 - w.typingOff) - state.typing) * (1 - Math.exp(-dt * 8));

    root.updateMatrixWorld(true);
    arms.forEach((arm) => {
      tmp.copy(arm.shoulderLocal);
      torso.localToWorld(tmp);
      root.worldToLocal(S.copy(tmp));
      const drift = Math.sin(t * 0.8 + arm.s) * 0.003;
      H.set(0.36, 0.806 + Math.max(0, Math.sin(t * 7 + arm.s)) * 0.004 * state.typing, 0.1 * arm.s + drift); // muñeca
      P.set(S.x - 0.3, S.y - 0.42, S.z + 0.2 * arm.s);   // polo: codo atrás y algo hacia fuera
      // saludo con la mano derecha: se mezcla el objetivo del IK (no las articulaciones) → huesos de largo constante
      const wa = arm.s === 1 && cam ? w.arm : 0;
      if (arm.s === 1 && cam) {
        H.x -= 0.02 * w.dip;                       // anticipación: suelta el teclado y recula un poco
        H.y += 0.008 * w.dip;
        if (wa > 0) {
          Hw.copy(WAVE_HAND).applyAxisAngle(UP, twist).add(S);
          Pw.copy(WAVE_POLE).applyAxisAngle(UP, twist).add(S);
          solveIK(S, Hw, Pw, Ew);
          if (w.swing) {                           // vaivén del antebrazo alrededor del codo, de cara a la cámara
            axis.copy(camL).sub(Ew).normalize();
            Fw.copy(Hw).sub(Ew).applyAxisAngle(axis, w.swing);
            Hw.copy(Ew).add(Fw);
          }
          H.lerp(Hw, wa);
          P.lerp(Pw, wa);
        }
      }
      solveIK(S, H, P, E);
      placeBetween(arm.upper, E, S);
      arm.elbow.position.copy(E);
      F.copy(H).sub(E).normalize();               // dirección del antebrazo (vector propio: placeBetween usa _d)
      W.copy(H).addScaledVector(F, -0.02);
      placeBetween(arm.fore, W, E);
      // puño de canalé cubriendo la muñeca
      placeBetween(arm.cuff, C0.copy(H).addScaledVector(F, -0.03), C1.copy(H).addScaledVector(F, 0.004));
      // mano: orientada según el antebrazo, ligeramente inclinada hacia el teclado
      const yaw = Math.atan2(-F.z, F.x);
      arm.hand.group.position.copy(H).addScaledVector(F, 0.004);
      arm.hand.group.position.y -= 0.006 * (1 - wa);
      qA.setFromEuler(eul.set(0, yaw, -0.12, 'YXZ'));
      if (wa > 0) {
        // al saludar: dedos a lo largo del antebrazo y palma (−Y local) hacia la cámara
        Xh.copy(F);
        toCam.copy(camL).sub(H).normalize();
        Yh.copy(toCam).addScaledVector(Xh, -toCam.dot(Xh));
        if (Yh.lengthSq() > 1e-6) {
          Yh.normalize().negate();
          Zh.crossVectors(Xh, Yh);
          qB.setFromRotationMatrix(basis.makeBasis(Xh, Yh, Zh));
          if (w.flex) qB.premultiply(qC.setFromAxisAngle(toCam, w.flex)); // muñeca: va un poco por detrás del antebrazo
          qA.slerp(qB, wa);
        }
      }
      arm.hand.group.quaternion.copy(qA);
      arm.hand.type(t, state.typing * (1 - wa), wa);
    });
  }
  // puntos de referencia para la burbuja (mundo): centro de la cabeza y palma de la mano derecha
  const right = arms.find((a) => a.s === 1);
  const headPoint = (out) => { skull.updateWorldMatrix(true, false); return skull.localToWorld(out.set(0, 0, 0)); };
  const handPoint = (out) => { right.hand.group.updateWorldMatrix(true, false); return right.hand.group.localToWorld(out.set(0.05, 0, 0)); };
  return { group: root, update, headPivot, headPoint, handPoint };
}

/* ---------------------------------------------------------------- escena */
export async function createScene({ canvas, terminal, avatarUrl = null, capture = null } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: !!capture,
  });
  renderer.setPixelRatio(capture ? (capture.dpr || 1) : Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;   // sombras suaves sin comparar profundidades (Firefox no avisa)
  renderer.setClearColor(0x08080a, 1);
  // en producción no leemos los logs de compilación (evita avisos del compilador HLSL de ANGLE)
  renderer.debug.checkShaderErrors = false;

  await yieldToMain();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(VIEWS[0].fov, 1, 0.1, 40);

  // terminal del monitor
  const term = new TerminalScreen({ prompt: terminal?.prompt || '~$', script: terminal?.script || [], title: (terminal?.user || 'javier-roman') + ' — terminal' });
  await term.ready();
  await yieldToMain();
  const screenTex = new THREE.CanvasTexture(term.canvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const M = makeMaterials();
  const desk = buildDesk(M, screenTex);
  scene.add(desk.group);
  await yieldToMain();
  const chair = buildChair(M);
  chair.position.set(-0.47, 0, 0);
  chair.rotation.y = 0.05;
  scene.add(chair);
  const lamp = buildLavaLamp(M);
  lamp.group.position.set(0.42, DESK_Y, -0.48);
  lamp.group.scale.setScalar(1.12);
  scene.add(lamp.group);
  const steam = buildSteam(desk.mugTop);
  scene.add(steam.group);
  await yieldToMain();
  const character = buildCharacter(M);
  character.group.position.set(-0.47, 0, 0);
  scene.add(character.group);
  await yieldToMain();

  // suelo: charco de luz + sombras reales + sombra de contacto
  const poolTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.28, 'rgba(255,255,255,0.78)'], [0.52, 'rgba(255,255,255,0.3)'], [0.78, 'rgba(255,255,255,0.06)'], [1, 'rgba(255,255,255,0)']], 512);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: poolTex, color: 0xd9d2f4, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(-0.1, 0.001, 0.12);
  scene.add(pool);
  const contactTex = radialTexture([[0, 'rgba(0,0,0,0.9)'], [0.5, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.3), new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, opacity: 0.32, depthWrite: false }));
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(-0.05, 0.002, 0);
  scene.add(contact);
  const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.5 }));
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.y = 0.003;
  shadowFloor.receiveShadow = true;
  scene.add(shadowFloor);

  // halo del monitor + luz derramada sobre la mesa
  const glowTex = radialTexture([[0, 'rgba(255,255,255,0.85)'], [0.35, 'rgba(255,255,255,0.32)'], [0.7, 'rgba(255,255,255,0.07)'], [1, 'rgba(255,255,255,0)']], 512);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.95), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xf2b6ec, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.rotation.y = -Math.PI / 2;
  halo.position.set(0.445, 1.16, 0);
  scene.add(halo);
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.1), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xf2b6ec, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(0.12, DESK_Y + 0.0015, 0);
  scene.add(spill);

  // luces
  scene.add(new THREE.HemisphereLight(0x3c3c48, 0x060607, 0.9));
  const key = new THREE.SpotLight(0xfff3ea, 42, 0, 0.5, 0.88, 2);
  key.position.set(-0.3, 3.7, 0.75);
  key.target.position.set(-0.12, 0.35, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 7;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.015;
  key.shadow.camera.near = 1.2;
  key.shadow.camera.far = 5.5;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xb4a5ff, 2.6);
  rim.position.set(1.9, 2.3, -2.4);
  rim.target.position.set(-0.4, 1.0, 0);
  scene.add(rim, rim.target);
  const rim2 = new THREE.DirectionalLight(0xb4a5ff, 1.1);
  rim2.position.set(-2.6, 1.6, -2.2);
  rim2.target.position.set(-0.4, 0.9, 0);
  scene.add(rim2, rim2.target);
  const fill = new THREE.DirectionalLight(0xd6d8ff, 0.45);
  fill.position.set(-2.2, 2.0, 3.2);
  scene.add(fill);
  const screenLight = new THREE.SpotLight(0xf2b6ec, 2.6, 3.2, 0.95, 1, 2);
  screenLight.position.set(0.38, 1.16, 0);
  screenLight.target.position.set(-0.5, 1.05, 0);
  scene.add(screenLight, screenLight.target);

  /* ----- saludo: máquina de estados explícita idle → waving → returning → idle ----- */
  // Un único "timeline" (wave.t) que se reutiliza; avanza con el mismo dt (acotado) del render loop.
  const WAVE = {
    raise0: 0.12, raise1: 0.5,   // anticipación y subida del brazo (~0,38 s)
    end: 1.65,                   // fin del vaivén → returning
    back: 0.42,                  // vuelta a la pose de teclear
    cps: 1.3, amp: 0.3,          // vaivén: ciclos por segundo y amplitud (rad) del antebrazo
    bubble: 0.45,                // la burbuja aparece con el brazo ya arriba
  };
  const wave = { state: 'idle', t: 0, count: 0, lastEnd: -Infinity };
  const ww = { arm: 0, head: 0, torso: 0, typingOff: 0, swing: 0, flex: 0, tilt: 0, dip: 0 };
  const wFrom = { ...ww };
  const sstep = (a, b, x) => smooth(clamp((x - a) / (b - a), 0, 1));
  const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  function waveWeights() {
    const t = wave.t;
    if (wave.state === 'waving') {
      const env = sstep(0.4, 0.62, t) * (1 - sstep(WAVE.end - 0.24, WAVE.end, t));
      const ph = (t - WAVE.raise1) * WAVE.cps * Math.PI * 2;
      ww.typingOff = sstep(0, 0.16, t);
      ww.dip = t < 0.24 ? Math.sin((Math.PI * t) / 0.24) : 0;
      ww.arm = inOut(clamp((t - WAVE.raise0) / (WAVE.raise1 - WAVE.raise0), 0, 1));
      ww.head = sstep(0.02, 0.5, t);
      ww.torso = sstep(0.06, 0.62, t);
      ww.swing = WAVE.amp * Math.sin(ph) * env;
      ww.flex = 0.24 * Math.sin(ph - 0.8) * env;
      ww.tilt = 0.12 * sstep(0.25, 0.75, t) + 0.025 * Math.sin(ph * 0.5) * env;
    } else if (wave.state === 'returning') {
      const u = clamp(wave.t / WAVE.back, 0, 1), e = inOut(u), s = smooth(u);
      ww.arm = wFrom.arm * (1 - e);
      ww.head = wFrom.head * (1 - s);
      ww.torso = wFrom.torso * (1 - s);
      ww.swing = wFrom.swing * (1 - e);
      ww.flex = wFrom.flex * (1 - e);
      ww.tilt = wFrom.tilt * (1 - e);
      ww.dip = wFrom.dip * (1 - e);
      ww.typingOff = wFrom.typingOff * (1 - sstep(0.6, 1, u));
    } else {
      for (const k in ww) ww[k] = 0;
    }
  }

  // avatar externo (opcional): si trae un clip de saludo, lo usa con la misma máquina de estados
  let mixer = null, avatarHead = null, idleAction = null, waveAction = null;
  if (avatarUrl) {
    try {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(avatarUrl);
      const model = gltf.scene;
      model.traverse((o) => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
        if (!avatarHead && o.isBone && /head/i.test(o.name)) avatarHead = o;
      });
      model.position.copy(character.group.position);
      scene.add(model);
      character.group.visible = false;
      if (gltf.animations?.length) {
        mixer = new THREE.AnimationMixer(model);
        const waveClip = gltf.animations.find((c) => /wave|waving|saludo|hello|greet/i.test(c.name)) || null;
        const idleClip = gltf.animations.find((c) => c !== waveClip && /idle|typing|sit/i.test(c.name))
          || gltf.animations.find((c) => c !== waveClip) || null;
        if (idleClip) { idleAction = mixer.clipAction(idleClip); idleAction.play(); }
        if (waveClip) {
          waveAction = mixer.clipAction(waveClip);
          waveAction.setLoop(THREE.LoopOnce, 1);
          waveAction.clampWhenFinished = true;
          WAVE.end = Math.max(0.9, waveClip.duration - WAVE.back * 0.5);
        }
      }
    } catch (e) {
      character.group.visible = true; // fallback al personaje procedural
      mixer = null; avatarHead = null; idleAction = null; waveAction = null;
    }
  }
  const useClip = () => !!waveAction && !character.group.visible;
  function startReturning() {
    Object.assign(wFrom, ww);
    wave.state = 'returning';
    wave.t = 0;
    if (useClip()) {
      if (idleAction) {
        idleAction.enabled = true;
        idleAction.setEffectiveTimeScale(1).setEffectiveWeight(1).play();
        waveAction.crossFadeTo(idleAction, WAVE.back, false);
      } else waveAction.fadeOut(WAVE.back);
    }
  }
  function waveStep(dt) {
    if (wave.state === 'idle') return;
    wave.t += dt;
    if (wave.state === 'waving' && wave.t >= WAVE.end) { waveWeights(); startReturning(); }
    else if (wave.state === 'returning' && wave.t >= WAVE.back) { wave.state = 'idle'; wave.t = 0; wave.lastEnd = performance.now(); }
  }
  function waveTrigger() {
    if (wave.state !== 'idle' || capture) return false;   // cualquier disparo fuera de idle se ignora
    wave.state = 'waving';
    wave.t = 0;
    wave.count++;
    if (useClip()) {
      waveAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
      if (idleAction) idleAction.crossFadeTo(waveAction, 0.3, false);
    }
    return true;
  }
  function waveCancel() {
    if (wave.state !== 'waving') return false;           // returning ya va hacia la pose normal
    startReturning();
    return true;
  }

  /* ----- cámara: travelling entre encuadres ----- */
  const path = new THREE.CatmullRomCurve3(VIEWS.map((v) => v.pos.clone()), false, 'centripetal');
  const camState = { p: 0, target: 0 };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let width = 1, height = 1;
  const look = V();
  function viewAt(p) {
    const n = VIEWS.length - 1;
    const f = clamp(p, 0, 1) * n;
    const i = Math.min(n - 1, Math.floor(f));
    const u = smooth(f - i);
    const a = VIEWS[i], b = VIEWS[i + 1];
    return {
      pos: path.getPoint(clamp(p, 0, 1)),
      target: look.copy(a.target).lerp(b.target, u),
      fov: a.fov + (b.fov - a.fov) * u,
      shift: a.shift + (b.shift - a.shift) * u,
    };
  }
  function applyCamera(view, t = 0) {
    camera.position.copy(view.pos);
    _a.set(1, 0, 0).applyQuaternion(camera.quaternion);
    camera.position.addScaledVector(_a, pointer.sx * 0.07);
    camera.position.y += pointer.sy * 0.04 + Math.sin(t * 0.32) * 0.008;
    // Como object-fit: cover respecto a 16:10 → en pantallas más anchas se mantiene el campo horizontal
    const aspectNow = width / height, REF = 1.6;
    camera.fov = aspectNow > REF
      ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(view.fov) / 2) * REF / aspectNow))
      : view.fov;
    camera.lookAt(view.target);
    const shift = view.shift * (aspectNow > 1.45 ? 1 : clamp((aspectNow - 0.9) / 0.55, 0, 1));
    camera.setViewOffset(width, height, -shift * width, 0, width, height);
    camera.aspect = aspectNow;
    camera.updateProjectionMatrix();
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(capture?.width || r.width));
    height = Math.max(1, Math.round(capture?.height || r.height));
    renderer.setSize(width, height, false);
  }
  resize();
  let ready = false; // hasta el primer fotograma no se renderiza desde el observer (evita compilar shaders en síncrono)
  const ro = capture ? null : new ResizeObserver(() => { resize(); if (ready && !running) renderFrame(lastT); });
  ro?.observe(canvas);

  // Datos del saludo para la burbuja (overlay HTML): cabeza y mano proyectadas a píxeles del canvas
  let onWaveFrame = null, waveNotified = false;
  const waveInfo = { state: 'idle', t: 0, bubble: false, bubbleAt: WAVE.bubble, x: 0, y: 0, r: 0, hx: 0, hy: 0, hr: 0, visible: false, width: 1, height: 1, dt: 0 };
  const pHead = V(), pHand = V(), pUp = V(), pTmp = V(), pAux = V();
  const sHead = { x: 0, y: 0, z: 0 }, sTop = { x: 0, y: 0, z: 0 }, sHand = { x: 0, y: 0, z: 0 }, sHandTop = { x: 0, y: 0, z: 0 };
  function toScreen(p, out) {
    pTmp.copy(p).project(camera);
    out.x = (pTmp.x + 1) * 0.5 * width; out.y = (1 - pTmp.y) * 0.5 * height; out.z = pTmp.z;
    return out;
  }
  function notifyWave(dt) {
    if (!onWaveFrame || (wave.state === 'idle' && !waveNotified)) return;
    waveNotified = wave.state !== 'idle';           // tras volver a idle se avisa una última vez (oculta la burbuja)
    if (avatarHead) { avatarHead.updateWorldMatrix(true, false); avatarHead.getWorldPosition(pHead); }
    else character.headPoint(pHead);
    character.handPoint(pHand);
    pUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    toScreen(pHead, sHead);
    toScreen(pAux.copy(pUp).multiplyScalar(0.155).add(pHead), sTop);
    toScreen(pHand, sHand);
    toScreen(pAux.copy(pUp).multiplyScalar(0.07).add(pHand), sHandTop);
    waveInfo.state = wave.state;
    waveInfo.t = wave.t;
    waveInfo.bubble = wave.state === 'waving' && wave.t >= WAVE.bubble;
    waveInfo.x = sHead.x; waveInfo.y = sHead.y; waveInfo.r = Math.hypot(sTop.x - sHead.x, sTop.y - sHead.y);
    waveInfo.hx = sHand.x; waveInfo.hy = sHand.y;
    waveInfo.hr = ww.arm > 0.4 && !avatarHead ? Math.hypot(sHandTop.x - sHand.x, sHandTop.y - sHand.y) : 0;
    waveInfo.visible = sHead.z > -1 && sHead.z < 1 && sHead.x > 0 && sHead.x < width && sHead.y > 0 && sHead.y < height;
    waveInfo.width = width; waveInfo.height = height;
    waveInfo.dt = dt;
    onWaveFrame(waveInfo);
  }

  let running = false, raf = 0, lastNow = 0, lastT = 0, typedSeen = 0;
  function renderFrame(t, dt = 0) {
    if (dt) waveStep(dt);                         // el saludo solo avanza con el reloj del render loop
    waveWeights();
    term.hold = wave.state === 'waving' || (wave.state === 'returning' && wave.t < WAVE.back * 0.7);
    camState.p += (camState.target - camState.p) * (1 - Math.exp(-dt * 7));
    if (!dt) camState.p = camState.target;
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 2.5));
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 2.5));
    applyCamera(capture?.view || viewAt(camState.p), t);
    camera.updateMatrixWorld();
    character.update(t, dt || 0.016, pointer, term.isTyping && !term.hold, { w: ww, cam: camera.position });
    notifyWave(dt);
    lamp.update(t);
    steam.update(t);
    if (mixer) mixer.update(dt);
    if (!capture && term.update(dt)) {
      screenTex.needsUpdate = true;
      if (term.typedCount !== typedSeen) { typedSeen = term.typedCount; desk.pressKey(); }
    }
    desk.updateKeys(dt);
    renderer.render(scene, camera);
  }
  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - lastNow) / 1000 || 0.016);
    lastNow = now;
    lastT += dt;
    renderFrame(lastT, dt);
    raf = requestAnimationFrame(loop);
  }

  // compilar shaders antes del primer frame (sin bloquear el hilo principal)
  applyCamera(viewAt(0));
  await yieldToMain();
  // compilación en paralelo solo si el navegador la soporta (si no, compila en el primer render)
  if (renderer.extensions.has('KHR_parallel_shader_compile')) {
    try { await renderer.compileAsync(scene, camera); } catch (e) { /* compila en el primer render */ }
  }
  await yieldToMain();

  if (capture) {
    term.fastForward(capture.terminalSeconds ?? 14);
    screenTex.needsUpdate = true;
    camState.target = camState.p = capture.progress ?? 0;
    pointer.x = pointer.sx = capture.pointer?.x ?? 0;
    pointer.y = pointer.sy = capture.pointer?.y ?? 0;
    applyCamera(capture.view || viewAt(camState.p), 2.0);
    camera.updateMatrixWorld();
    // asentar animaciones (IK, cabeza) sin que avance el tiempo
    const look = { w: ww, cam: camera.position };
    for (let i = 0; i < 60; i++) character.update(2.0, 0.05, pointer, false, look);
    renderFrame(2.0, 0);
  } else {
    // Mismo fotograma que el póster (t = 2 s, pose asentada, terminal en el mismo punto):
    // al aparecer el canvas sobre la imagen no cambia nada
    term.fastForward(15);
    screenTex.needsUpdate = true;
    applyCamera(viewAt(camState.p), 2.0);
    camera.updateMatrixWorld();
    const look = { w: ww, cam: camera.position };
    for (let i = 0; i < 60; i++) character.update(2.0, 0.05, pointer, false, look);
    lastT = 2.0;
    renderFrame(2.0, 0);
  }
  ready = true;

  return {
    renderer, scene, camera,
    setProgress(p) { camState.target = clamp(p, 0, 1); },
    setPointer(x, y) { pointer.x = clamp(x, -1, 1); pointer.y = clamp(y, -1, 1); },
    setRunning(on) {
      if (on === running) return;
      running = on;
      if (on) { lastNow = performance.now(); raf = requestAnimationFrame(loop); }
      else cancelAnimationFrame(raf);
    },
    // saludo: el scroll solo lo dispara (js/wave.js); aquí vive la animación y su estado
    wave: {
      trigger: waveTrigger,
      cancel: waveCancel,
      get state() { return wave.state; },
      get count() { return wave.count; },
      get t() { return wave.t; },
      get lastEnd() { return wave.lastEnd; },
      get weights() { return ww; },
    },
    onWave(fn) { onWaveFrame = fn; },
    capture() { return canvas.toDataURL('image/png'); },
    dispose() {
      running = false; cancelAnimationFrame(raf); ro?.disconnect();
      renderer.dispose();
    },
  };
}
