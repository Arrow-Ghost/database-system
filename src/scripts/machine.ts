import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import gsap from 'gsap';

export interface Machine {
  setStep(i: number): void;
  setActive(on: boolean): void;
  resize(): void;
}

type Role = 'primary' | 'replica';
interface Node {
  id: string;
  shard: number;
  role: Role;
  alive: boolean;
  data: Map<string, number>;
  group: THREE.Group;
  chassis: THREE.Mesh;
  led: THREE.MeshStandardMaterial;
  bodyMat: THREE.MeshStandardMaterial;
  screen: { ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture };
  label: HTMLDivElement;
  home: THREE.Vector3;
}
interface Shard {
  name: string;
  lo: number;
  hi: number;
  center: THREE.Vector3;
  hub: THREE.Vector3;
  feed: THREE.CatmullRomCurve3;
  nodes: Node[];
  group: THREE.Group;
  label: HTMLDivElement;
  term: number;
}

const FONT = "'IBM Plex Mono', ui-monospace, monospace";
const C_AMBER = 0xff8a1f, C_ICE = 0x9cc8ff, C_FAIL = 0xff3b30;

function fnv1a(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export function createMachine(root: HTMLElement): Machine | null {
  const host = root.querySelector<HTMLElement>('#mach-canvas')!;
  const labelsEl = root.querySelector<HTMLElement>('#mach-labels')!;
  const tip = root.querySelector<HTMLElement>('#mach-tip')!;
  const logEl = root.querySelector<HTMLElement>('#m-log')!;
  const keyIn = root.querySelector<HTMLInputElement>('#m-key')!;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    root.querySelector<HTMLElement>('#mach-fallback')!.style.display = 'grid';
    return null;
  }
  const W = () => host.clientWidth || innerWidth, H = () => host.clientHeight || innerHeight;
  const mobile = innerWidth < 900;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.75));
  renderer.setSize(W(), H());
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, W() / H(), 0.1, 150);
  camera.position.set(11, 9, 15);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.rotateSpeed = 0.5;
  controls.target.set(0, 0.6, 0);
  if (matchMedia('(pointer: coarse)').matches) controls.enableRotate = false;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  scene.environmentIntensity = 0.55;
  room.dispose(); pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xdbe5f4, 0x29211a, 1.6));
  const key = new THREE.DirectionalLight(0xfff1d8, 3.6);
  key.position.set(-5, 12, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -11, right: 11, top: 9, bottom: -9, near: 0.5, far: 40 });
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.03;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbcd2f0, 2.6);
  rim.position.set(4, 6, -10);
  scene.add(rim);
  const warm = new THREE.PointLight(0xffa040, 22, 18, 2);
  warm.position.set(-5, 4, 4);
  scene.add(warm);

  const mat = (color: number, metalness: number, roughness: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
  const M = {
    body: mat(0x2e353e, 0.75, 0.3),
    base: mat(0x252b32, 0.85, 0.34),
    edge: mat(0x737c87, 0.85, 0.24),
    chrome: mat(0xc3cad0, 0.92, 0.18),
    dark: mat(0x101418, 0.45, 0.4),
    rubber: mat(0x0b0f13, 0.1, 0.6),
    amber: mat(C_AMBER, 0.2, 0.3, { emissive: C_AMBER, emissiveIntensity: 1.6 }),
    ice: mat(C_ICE, 0.2, 0.3, { emissive: C_ICE, emissiveIntensity: 1.2 }),
    tube: mat(0x3a424c, 0.85, 0.3),
  };
  const geos = new Map<string, THREE.BufferGeometry>();
  const rbox = (w: number, h: number, d: number, r = 0.04) => {
    const k = `${w},${h},${d},${r}`;
    if (!geos.has(k)) geos.set(k, r ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3)) : new THREE.BoxGeometry(w, h, d));
    return geos.get(k)!;
  };
  const box = (p: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, r = 0.04) => {
    const o = new THREE.Mesh(rbox(w, h, d, r), m);
    o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; p.add(o); return o;
  };
  const cyl = (p: THREE.Object3D, r: number, h: number, x: number, y: number, z: number, m: THREE.Material, seg = 24) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
    o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; p.add(o); return o;
  };
  const canvasTex = (w: number, h: number) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d')!;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { ctx, tex };
  };
  const screenMesh = (p: THREE.Object3D, w: number, h: number, x: number, y: number, z: number, tex: THREE.Texture) => {
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    o.position.set(x, y, z); p.add(o); return o;
  };

  const machine = new THREE.Group();
  scene.add(machine);

  // floor and contact shadow
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.3 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.45; floor.receiveShadow = true;
  scene.add(floor);
  {
    const pts: THREE.Vector3[] = [];
    for (const rad of [9.2, 9.8]) for (let i = 0; i < 160; i++) for (const j of [i, i + 1]) {
      const a = (j / 160) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * rad, -0.44, Math.sin(a) * rad * 0.75));
    }
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2, r1 = 9.8, r2 = r1 + (i % 6 === 0 ? 0.3 : 0.12);
      pts.push(new THREE.Vector3(Math.cos(a) * r1, -0.44, Math.sin(a) * r1 * 0.75), new THREE.Vector3(Math.cos(a) * r2, -0.44, Math.sin(a) * r2 * 0.75));
    }
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x6a737d, transparent: true, opacity: 0.18 })));
  }

  // platform
  box(machine, 14.6, 0.4, 9.4, 0, -0.1, 0, M.base, 0.18);
  box(machine, 14.4, 0.06, 9.2, 0, 0.13, 0, M.edge, 0.12);
  box(machine, 14.28, 0.09, 9.08, 0, 0.19, 0, M.body, 0.1);
  box(machine, 13.6, 0.03, 0.035, 0, -0.17, 4.71, M.amber, 0.01);
  for (const x of [-6.6, 6.6]) for (const z of [-3.9, 3.9]) {
    cyl(machine, 0.42, 0.26, x, -0.32, z, M.rubber);
    cyl(machine, 0.07, 0.03, x, 0.25, z, M.chrome, 12);
  }
  {
    const { ctx, tex } = canvasTex(1536, 160);
    ctx.fillStyle = '#20262d'; ctx.fillRect(0, 0, 1536, 160);
    ctx.strokeStyle = '#4d555e'; ctx.lineWidth = 2; ctx.strokeRect(2, 2, 1532, 156);
    ctx.fillStyle = '#ddd9cd'; ctx.font = `600 46px ${FONT}`; ctx.fillText('NOSQL CLUSTER', 40, 72);
    ctx.fillStyle = '#9aa1a8'; ctx.font = `500 32px ${FONT}`; ctx.fillText('3 shards · replication factor 3 · hash space 0–1023', 470, 72);
    ctx.fillStyle = '#6f7882'; ctx.font = `500 22px ${FONT}`; ctx.fillText('TEAM 9 · BACSE202 · MODULE 5', 42, 124);
    ctx.fillStyle = '#ff8a1f'; ctx.fillText('No. 009', 1380, 124);
    const pl = screenMesh(machine, 8.2, 0.85, -1.6, 0.245, 4.0, tex);
    pl.rotation.x = -Math.PI / 2;
  }

  // ---------- router ----------
  const router = new THREE.Group();
  router.position.set(0, 0.24, 2.6);
  machine.add(router);
  box(router, 3.0, 0.12, 1.9, 0, 0.06, 0, M.dark, 0.08);
  const routerBody = box(router, 2.6, 1.0, 1.5, 0, 0.62, 0, M.body, 0.1);
  box(router, 2.3, 0.62, 0.04, 0, 0.66, 0.76, M.dark, 0.02);
  const rscreen = canvasTex(640, 220);
  screenMesh(router, 2.1, 0.56, 0, 0.66, 0.785, rscreen.tex);
  const dial = new THREE.Group();
  dial.position.set(0, 1.18, -0.05);
  router.add(dial);
  const torus = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 12, 64), M.chrome);
  torus.rotation.x = Math.PI / 2; torus.castShadow = true; dial.add(torus);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 8, 48, Math.PI * 1.3), M.amber);
  inner.rotation.x = Math.PI / 2; dial.add(inner);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    box(dial, 0.04, 0.05, 0.12, Math.cos(a) * 0.52, 0, Math.sin(a) * 0.52, M.edge, 0).rotation.y = -a;
  }
  for (const x of [-0.8, 0, 0.8]) cyl(router, 0.11, 0.12, x, 0.62, -0.8, M.chrome).rotation.x = Math.PI / 2;
  function drawRouter(line1: string, line2: string, hash: number | null) {
    const { ctx, tex } = rscreen;
    ctx.fillStyle = '#0d1115'; ctx.fillRect(0, 0, 640, 220);
    ctx.fillStyle = '#6f7882'; ctx.font = `500 22px ${FONT}`; ctx.fillText('QUERY ROUTER · hash(key) mod 1024', 24, 40);
    ctx.fillStyle = '#ece7da'; ctx.font = `600 44px ${FONT}`; ctx.fillText(line1.slice(0, 22), 24, 104);
    ctx.fillStyle = '#ff8a1f'; ctx.font = `500 30px ${FONT}`; ctx.fillText(line2, 24, 156);
    ctx.fillStyle = '#1c2229'; ctx.fillRect(24, 182, 592, 12);
    if (hash !== null) {
      ctx.fillStyle = '#ff8a1f'; ctx.fillRect(24 + (hash / 1023) * 586, 176, 6, 24);
      ctx.fillStyle = '#4d555e'; for (const b of [341, 682]) ctx.fillRect(24 + (b / 1023) * 586, 182, 2, 12);
    }
    tex.needsUpdate = true;
  }
  drawRouter('ready', 'waiting for requests', null);

  // ---------- shards ----------
  const shards: Shard[] = [];
  const nodes: Node[] = [];
  const SX = [-4.6, 0, 4.6];
  const ranges: [number, number][] = [[0, 341], [342, 682], [683, 1023]];
  const names = ['A', 'B', 'C'];
  const local: [number, number][] = [[0, 0.8], [-0.95, -0.85], [0.95, -0.85]];
  const routerOut = new THREE.Vector3(0, 1.0, 1.7);

  function drawNodeScreen(n: Node) {
    const { ctx, tex } = n.screen;
    ctx.fillStyle = n.alive ? '#0d1115' : '#1a0c0b'; ctx.fillRect(0, 0, 256, 150);
    ctx.fillStyle = n.alive ? '#ece7da' : '#6b3a36'; ctx.font = `600 46px ${FONT}`; ctx.fillText(n.id, 16, 56);
    ctx.font = `500 22px ${FONT}`;
    ctx.fillStyle = !n.alive ? '#ff3b30' : n.role === 'primary' ? '#ff8a1f' : '#9cc8ff';
    ctx.fillText(!n.alive ? 'DOWN' : n.role.toUpperCase(), 16, 92);
    ctx.fillStyle = '#6f7882'; ctx.fillText(`${n.data.size} keys`, 16, 128);
    tex.needsUpdate = true;
  }
  function paintNode(n: Node) {
    const col = !n.alive ? C_FAIL : n.role === 'primary' ? C_AMBER : C_ICE;
    n.led.color.setHex(col); n.led.emissive.setHex(col);
    n.led.emissiveIntensity = n.alive ? (n.role === 'primary' ? 2 : 1.3) : 0.35;
    n.bodyMat.color.setHex(n.alive ? 0x2e353e : 0x1d1a1a);
    n.label.classList.toggle('dead', !n.alive);
    n.label.innerHTML = `<span><b>${n.id}</b> · ${n.alive ? n.role : 'down'}</span>`;
    drawNodeScreen(n);
  }

  SX.forEach((sx, si) => {
    const g = new THREE.Group();
    g.position.set(sx, 0.24, -1.2);
    machine.add(g);
    box(g, 3.9, 0.08, 3.7, 0, 0.04, 0, M.dark, 0.06);
    box(g, 3.7, 0.025, 0.03, 0, 0.09, 1.82, si === 1 ? M.amber : M.ice, 0.01);
    {
      const { ctx, tex } = canvasTex(512, 64);
      ctx.fillStyle = '#151a1f'; ctx.fillRect(0, 0, 512, 64);
      ctx.fillStyle = '#ece7da'; ctx.font = `600 30px ${FONT}`; ctx.fillText(`SHARD ${names[si]}`, 16, 43);
      ctx.fillStyle = '#ff8a1f'; ctx.font = `500 24px ${FONT}`; ctx.fillText(`hash ${ranges[si][0]}–${ranges[si][1]}`, 230, 42);
      const s = screenMesh(g, 2.4, 0.3, 0, 0.088, 1.55, tex); s.rotation.x = -Math.PI / 2;
    }
    const hub = new THREE.Vector3(sx, 1.25, 0.35);
    const feed = new THREE.CatmullRomCurve3([routerOut.clone(), new THREE.Vector3(sx * 0.55, 2.0, 1.25), hub.clone()]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(feed, 48, 0.045, 8, false), M.tube);
    tube.castShadow = true; scene.add(tube);
    const glowLine = new THREE.Mesh(new THREE.TubeGeometry(feed, 48, 0.012, 6, false), si === 1 ? M.amber : M.ice);
    scene.add(glowLine);
    const lab = document.createElement('div');
    lab.className = 'mlabel';
    lab.innerHTML = `<span>Shard <b>${names[si]}</b> · ${ranges[si][0]}–${ranges[si][1]}</span>`;
    labelsEl.appendChild(lab);
    const shard: Shard = { name: names[si], lo: ranges[si][0], hi: ranges[si][1], center: new THREE.Vector3(sx, 0.24, -1.2), hub, feed, nodes: [], group: g, label: lab, term: 1 };

    local.forEach(([lx, lz], ni) => {
      const ng = new THREE.Group();
      ng.position.set(lx, 0.08, lz);
      g.add(ng);
      box(ng, 1.42, 0.1, 1.24, 0, 0.05, 0, M.dark, 0.04);
      const bodyMat = M.body.clone();
      const chassis = box(ng, 1.3, 0.95, 1.1, 0, 0.6, 0, bodyMat, 0.08);
      box(ng, 1.18, 0.78, 0.04, 0, 0.6, 0.55, M.dark, 0.02);
      for (let k = 0; k < 7; k++) box(ng, 0.36, 0.022, 0.02, -0.33, 0.33 + k * 0.08, 0.575, M.edge, 0);
      const led = M.amber.clone();
      box(ng, 0.05, 0.6, 0.03, 0.5, 0.6, 0.575, led, 0.01);
      for (let k = 0; k < 6; k++) box(ng, 1.1, 0.06, 0.02, 0, 1.1, -0.42 + k * 0.17, M.edge, 0);
      const scr = canvasTex(256, 150);
      screenMesh(ng, 0.52, 0.3, 0.12, 0.66, 0.573, scr.tex);
      const lab2 = document.createElement('div');
      lab2.className = 'mlabel';
      labelsEl.appendChild(lab2);
      const node: Node = {
        id: `${names[si]}${ni + 1}`, shard: si, role: ni === 0 ? 'primary' : 'replica', alive: true, data: new Map(),
        group: ng, chassis, led, bodyMat, screen: scr, label: lab2, home: ng.position.clone(),
      };
      chassis.userData.node = node;
      shard.nodes.push(node);
      nodes.push(node);
      paintNode(node);
    });
    // replication links between the three nodes of the shard
    for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) {
      const pa = g.localToWorld(new THREE.Vector3(local[a][0], 1.25, local[a][1]));
      const pb = g.localToWorld(new THREE.Vector3(local[b][0], 1.25, local[b][1]));
      const mid = pa.clone().lerp(pb, 0.5); mid.y += 0.45;
      const c = new THREE.CatmullRomCurve3([pa, mid, pb]);
      const t = new THREE.Mesh(new THREE.TubeGeometry(c, 24, 0.022, 6, false), M.tube);
      scene.add(t);
    }
    shards.push(shard);
  });
  routerBody.userData.router = true;

  const routerLabel = document.createElement('div');
  routerLabel.className = 'mlabel';
  routerLabel.innerHTML = '<span><b>Router</b> · hashes the key</span>';
  labelsEl.appendChild(routerLabel);

  // ---------- packets ----------
  const glowTex = (() => {
    const { ctx, tex } = canvasTex(64, 64);
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); tex.needsUpdate = true; return tex;
  })();
  const pktGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  function packet(color: number) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(pktGeo, new THREE.MeshBasicMaterial({ color, toneMapped: false })));
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.set(0.9, 0.9, 0.9); g.add(s);
    scene.add(g);
    return g;
  }
  function travel(obj: THREE.Object3D, curve: THREE.Curve<THREE.Vector3>, dur: number) {
    return new Promise<void>((res) => {
      const st = { t: 0 };
      gsap.to(st, {
        t: 1, duration: dur, ease: 'power1.inOut',
        onUpdate: () => { obj.position.copy(curve.getPointAt(st.t)); obj.rotation.x += 0.15; obj.rotation.y += 0.1; },
        onComplete: res,
      });
    });
  }
  const nodeTop = (n: Node) => n.group.localToWorld(new THREE.Vector3(0, 1.25, 0.2));
  function hop(a: THREE.Vector3, b: THREE.Vector3, lift = 0.6) {
    const m = a.clone().lerp(b, 0.5); m.y += lift;
    return new THREE.CatmullRomCurve3([a, m, b]);
  }
  function flash(n: Node) {
    const base = n.led.emissiveIntensity;
    gsap.fromTo(n.led, { emissiveIntensity: base * 3.5 }, { emissiveIntensity: base, duration: 0.7, ease: 'power2.out' });
    gsap.fromTo(n.group.scale, { y: 1.06 }, { y: 1, duration: 0.5, ease: 'back.out(3)' });
  }

  // ---------- log ----------
  function log(html: string) {
    const line = document.createElement('div');
    line.innerHTML = html;
    logEl.appendChild(line);
    while (logEl.childElementCount > 40) logEl.firstElementChild!.remove();
    logEl.scrollTop = logEl.scrollHeight;
  }

  const shardOf = (h: number) => (h <= 341 ? 0 : h <= 682 ? 1 : 2);
  const primaryOf = (s: Shard) => s.nodes.find((n) => n.alive && n.role === 'primary');
  let version = 0;

  async function write(k: string) {
    k = (k || 'user:42').trim().slice(0, 40);
    const h = fnv1a(k) % 1024, si = shardOf(h), s = shards[si];
    drawRouter(k, `hash ${h} → shard ${s.name}`, h);
    gsap.to(dial.rotation, { y: dial.rotation.y + Math.PI * 2, duration: 0.8, ease: 'power3.out' });
    log(`<span class="p">PUT</span> ${k} <span class="dim">→ hash ${h} → shard ${s.name}</span>`);
    const p = packet(C_AMBER);
    p.position.copy(routerOut);
    await travel(p, s.feed, 0.75);
    const prim = primaryOf(s);
    if (!prim) {
      gsap.to(p.scale, { x: 0, y: 0, z: 0, duration: 0.3, onComplete: () => { scene.remove(p); } });
      log(`<span class="err">✕ shard ${s.name} has no primary · write rejected, client retries</span>`);
      return;
    }
    await travel(p, hop(s.hub, nodeTop(prim), 0.3), 0.35);
    scene.remove(p);
    const v = ++version;
    prim.data.set(k, v); flash(prim); drawNodeScreen(prim);
    const reps = s.nodes.filter((n) => n !== prim);
    let acks = 0;
    await Promise.all(reps.map(async (r, i) => {
      if (!r.alive) return;
      const q = packet(C_ICE);
      q.position.copy(nodeTop(prim));
      await travel(q, hop(nodeTop(prim), nodeTop(r), 0.5), 0.45 + i * 0.15);
      scene.remove(q);
      if (!r.alive) return;
      r.data.set(k, v); acks++; flash(r); drawNodeScreen(r);
    }));
    const down = reps.filter((r) => !r.alive).length;
    log(`<span class="ok">✓ ack</span> <span class="dim">primary ${prim.id} · replicated to ${acks}/2${down ? ` · ${down} replica down, will catch up` : ''}</span>`);
  }

  let rr = 0;
  async function read(k: string) {
    k = (k || 'user:42').trim().slice(0, 40);
    const h = fnv1a(k) % 1024, s = shards[shardOf(h)];
    drawRouter(k, `read · shard ${s.name}`, h);
    const alive = s.nodes.filter((n) => n.alive);
    if (!alive.length) { log(`<span class="err">✕ GET ${k} · every replica of shard ${s.name} is down</span>`); return; }
    const n = alive[rr++ % alive.length];
    log(`<span class="ice">GET</span> ${k} <span class="dim">→ shard ${s.name} → ${n.id} (${n.role})</span>`);
    const p = packet(C_ICE);
    p.position.copy(routerOut);
    await travel(p, s.feed, 0.6);
    await travel(p, hop(s.hub, nodeTop(n), 0.3), 0.3);
    flash(n);
    const val = n.data.get(k);
    await travel(p, hop(nodeTop(n), s.hub, 0.3), 0.3);
    await travel(p, new THREE.CatmullRomCurve3(s.feed.points.slice().reverse()), 0.5);
    scene.remove(p);
    const newest = Math.max(0, ...s.nodes.map((x) => x.data.get(k) ?? 0));
    if (val === undefined) log(`<span class="dim">  (nil) · ${n.id} has no copy of ${k}${newest ? ' yet: it missed writes while down' : ''}</span>`);
    else log(`<span class="ok">  value v${val}</span>${val < newest ? ' <span class="err">stale: newer v' + newest + ' exists</span>' : ''}`);
  }

  async function elect(s: Shard) {
    const cands = s.nodes.filter((n) => n.alive && n.role === 'replica');
    if (!cands.length) { log(`<span class="err">✕ shard ${s.name}: no replica left to elect. Shard unavailable.</span>`); return; }
    log(`<span class="dim">… shard ${s.name}: heartbeat lost, replicas start an election</span>`);
    cands.forEach((c) => gsap.to(c.led, { emissiveIntensity: 3, duration: 0.25, yoyo: true, repeat: 5 }));
    await new Promise((r) => setTimeout(r, 1500));
    if (primaryOf(s)) return;
    const live = s.nodes.filter((n) => n.alive && n.role === 'replica');
    if (!live.length) return;
    const best = live.sort((a, b) => b.data.size - a.data.size)[0];
    best.role = 'primary'; s.term++;
    paintNode(best); flash(best);
    log(`<span class="ok">✓ ${best.id} elected primary</span> <span class="dim">(term ${s.term}) · writes resume</span>`);
  }

  async function toggle(n: Node) {
    const s = shards[n.shard];
    if (n.alive) {
      n.alive = false;
      const wasPrimary = n.role === 'primary';
      n.role = 'replica';
      paintNode(n);
      gsap.to(n.group.position, { y: n.home.y - 0.06, duration: 0.3 });
      gsap.fromTo(n.group.rotation, { z: 0.02 }, { z: 0, duration: 0.6, ease: 'elastic.out(1,0.3)' });
      log(`<span class="err">✕ node ${n.id} down</span>${wasPrimary ? ' <span class="dim">(it was the primary)</span>' : ''}`);
      if (wasPrimary) elect(s);
    } else {
      n.alive = true; n.role = primaryOf(s) ? 'replica' : 'primary';
      gsap.to(n.group.position, { y: n.home.y, duration: 0.4, ease: 'back.out(2)' });
      paintNode(n);
      const src = primaryOf(s) && primaryOf(s) !== n ? primaryOf(s)! : null;
      let missing = 0;
      if (src) {
        for (const [k, v] of src.data) if (n.data.get(k) !== v) { n.data.set(k, v); missing++; }
        const q = packet(C_ICE);
        q.position.copy(nodeTop(src));
        await travel(q, hop(nodeTop(src), nodeTop(n), 0.5), 0.6);
        scene.remove(q); flash(n); drawNodeScreen(n);
      }
      log(`<span class="ok">✓ ${n.id} rejoined as ${n.role}</span><span class="dim">${src ? ` · caught up ${missing} write${missing === 1 ? '' : 's'}` : ''}</span>`);
    }
  }

  // ---------- interaction ----------
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  const pickables = () => [...nodes.map((n) => n.chassis), routerBody];
  function pick(ev: PointerEvent) {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    return ray.intersectObjects(pickables(), false)[0]?.object;
  }
  let downAt = { x: 0, y: 0 };
  renderer.domElement.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
    const o = pick(e);
    if (o?.userData.node) toggle(o.userData.node);
    else if (o?.userData.router) write(keyIn.value);
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    const o = pick(e);
    const sticky = root.getBoundingClientRect();
    if (!o) { tip.style.opacity = '0'; renderer.domElement.style.cursor = ''; return; }
    renderer.domElement.style.cursor = 'pointer';
    let t = '', b = '';
    if (o.userData.node) {
      const n: Node = o.userData.node, s = shards[n.shard];
      t = `Node ${n.id} · ${n.alive ? n.role : 'down'}`;
      b = `Shard ${s.name} owns hashes ${s.lo}–${s.hi}. Holds ${n.data.size} key${n.data.size === 1 ? '' : 's'}. Click to ${n.alive ? 'fail' : 'revive'} it.`;
    } else {
      t = 'Query router';
      b = 'Hashes the shard key and forwards each request to the shard that owns that hash. Click to write the current key.';
    }
    tip.querySelector('b')!.textContent = t;
    tip.querySelector('span')!.textContent = b;
    tip.style.left = `${Math.min(e.clientX - sticky.left + 16, sticky.width - 280)}px`;
    tip.style.top = `${e.clientY - sticky.top + 16}px`;
    tip.style.opacity = '1';
  });
  renderer.domElement.addEventListener('pointerleave', () => { tip.style.opacity = '0'; });

  root.querySelector('#m-write')!.addEventListener('click', () => write(keyIn.value));
  root.querySelector('#m-read')!.addEventListener('click', () => read(keyIn.value));
  keyIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') write(keyIn.value); });
  root.querySelector('#m-burst')!.addEventListener('click', () => {
    const words = ['user', 'cart', 'post', 'order', 'session', 'device'];
    for (let i = 0; i < 12; i++) setTimeout(() => write(`${words[i % 6]}:${Math.floor(Math.random() * 9000 + 100)}`), i * 220);
  });
  root.querySelector('#m-fail')?.addEventListener('click', () => {
    const p = primaryOf(shards[1]);
    if (p) toggle(p); else { const d = shards[1].nodes.find((n) => !n.alive); if (d) toggle(d); }
  });
  let exploded = false;
  const cutBtn = root.querySelector<HTMLButtonElement>('#m-cut')!;
  cutBtn.addEventListener('click', () => {
    exploded = !exploded;
    cutBtn.classList.toggle('on', exploded);
    shards.forEach((s, i) => {
      gsap.to(s.group.position, { x: s.center.x * (exploded ? 1.25 : 1), y: s.center.y + (exploded ? 1.1 : 0), duration: 1.1, ease: 'power3.inOut', delay: i * 0.06 });
      s.nodes.forEach((n, j) => gsap.to(n.group.position, { y: n.home.y + (exploded ? 0.5 + j * 0.25 : 0), duration: 1, ease: 'power3.inOut', delay: 0.1 + j * 0.05 }));
    });
    gsap.to(router.position, { y: 0.24 + (exploded ? 0.8 : 0), duration: 1, ease: 'power3.inOut' });
    log(`<span class="dim">${exploded ? 'exploded view: shards lifted apart (feed lines stay at rest positions)' : 'assembled view'}</span>`);
  });
  root.querySelector('#m-reset')!.addEventListener('click', () => {
    nodes.forEach((n, i) => { n.alive = true; n.role = i % 3 === 0 ? 'primary' : 'replica'; n.data.clear(); n.group.position.copy(n.home); paintNode(n); });
    shards.forEach((s) => (s.term = 1));
    version = 0; logEl.innerHTML = '';
    drawRouter('ready', 'waiting for requests', null);
    log('<span class="dim">cluster reset · 9 nodes healthy</span>');
  });
  log('<span class="dim">cluster online · 3 shards · 9 nodes · RF 3</span>');

  // ---------- camera steps ----------
  const views = [
    { p: [11, 9, 15], t: [0, 0.6, 0] },
    { p: [-9.5, 6.2, 7.5], t: [-4.6, 0.9, -1.2] },
    { p: [4.5, 5.5, 9], t: [0, 0.9, -1.2] },
  ];
  let step = -1;
  const seen = new Set<number>();
  function setStep(i: number) {
    if (i === step) return;
    step = i;
    const v = views[i];
    const narrow = W() / H() < 1 ? 1.45 : 1;
    const target = new THREE.Vector3(...(v.t as [number, number, number]));
    const pos = new THREE.Vector3(...(v.p as [number, number, number])).sub(target).multiplyScalar(narrow).add(target);
    gsap.to(camera.position, { x: pos.x, y: pos.y, z: pos.z, duration: 1.8, ease: 'power3.inOut' });
    gsap.to(controls.target, { x: target.x, y: target.y, z: target.z, duration: 1.8, ease: 'power3.inOut' });
    if (!seen.has(i)) {
      seen.add(i);
      if (i === 0) setTimeout(() => write('user:42'), 900);
      if (i === 1) ['cart:7', 'post:812', 'session:9f3a'].forEach((k, j) => setTimeout(() => write(k), 900 + j * 500));
      if (i === 2) setTimeout(() => { const p = primaryOf(shards[1]); if (p) toggle(p); }, 1600);
    }
  }

  // ---------- loop ----------
  let active = false;
  const v3 = new THREE.Vector3();
  function place(el: HTMLElement, world: THREE.Vector3) {
    v3.copy(world).project(camera);
    const hidden = v3.z > 1;
    el.style.opacity = hidden ? '0' : '1';
    el.style.left = `${(v3.x * 0.5 + 0.5) * W()}px`;
    el.style.top = `${(-v3.y * 0.5 + 0.5) * H()}px`;
  }
  let lastT = performance.now();
  function frame() {
    requestAnimationFrame(frame);
    if (!active) return;
    const now = performance.now();
    const dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    inner.rotation.z += dt * 1.2;
    controls.update();
    renderer.render(scene, camera);
    nodes.forEach((n) => place(n.label, n.group.localToWorld(v3.set(0, 1.45, 0)).clone()));
    shards.forEach((s) => place(s.label, s.group.localToWorld(v3.set(0, 0.1, 2.05)).clone()));
    place(routerLabel, router.localToWorld(v3.set(0, 1.55, 0)).clone());
  }
  frame();

  return {
    setStep,
    setActive(on) { if (on && !active) lastT = performance.now(); active = on; },
    resize() {
      renderer.setSize(W(), H());
      camera.aspect = W() / H();
      camera.updateProjectionMatrix();
    },
  };
}
