import * as THREE from 'three';

export type ShapeName =
  | 'nebula' | 'strand' | 'grid' | 'tower' | 'nodes'
  | 'kv' | 'doc' | 'col' | 'graph' | 'ring' | 'globe' | 'text'
  | 'sites' | 'slices' | 'cap' | 'funnel' | 'nest';

type V3 = [number, number, number];
interface Shape {
  pos: Float32Array;
  col: Float32Array;
  cam: V3;
  look: V3;
  spin: number;
  opacity: number;
}

const PAL: Record<string, V3> = {
  ivory: [0.93, 0.9, 0.82],
  amber: [1.0, 0.5, 0.1],
  ice: [0.55, 0.74, 1.0],
  steel: [0.34, 0.38, 0.44],
  lilac: [0.8, 0.72, 1.0],
  green: [0.58, 0.84, 0.5],
  dim: [0.2, 0.23, 0.27],
};

function mulberry(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Writer {
  i = 0;
  constructor(public n: number, public pos: Float32Array, public col: Float32Array) {}
  put(x: number, y: number, z: number, c: V3, k = 1) {
    if (this.i >= this.n) return false;
    const j = this.i * 3;
    this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z;
    this.col[j] = c[0] * k; this.col[j + 1] = c[1] * k; this.col[j + 2] = c[2] * k;
    this.i++;
    return true;
  }
  get full() { return this.i >= this.n; }
}

function gauss(r: () => number) {
  return (r() + r() + r() + r() - 2) * 0.85;
}
function mixC(a: V3, b: V3, t: number): V3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// Points scattered along the 12 edges of a box, plus optional face fill.
function boxEdges(w: Writer, r: () => number, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, count: number, c: V3, k = 1) {
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  for (let n = 0; n < count && !w.full; n++) {
    const e = Math.floor(r() * 12), t = r() * 2 - 1;
    let x = 0, y = 0, z = 0;
    const a = e % 4, sA = a & 1 ? 1 : -1, sB = a & 2 ? 1 : -1;
    if (e < 4) { x = t * hx; y = sA * hy; z = sB * hz; }
    else if (e < 8) { y = t * hy; x = sA * hx; z = sB * hz; }
    else { z = t * hz; x = sA * hx; y = sB * hy; }
    w.put(cx + x, cy + y, cz + z, c, k);
  }
}

function fill(w: Writer, r: () => number, c: V3) {
  // Fill any leftover slots with a faint dust cloud so every shape uses all particles.
  while (!w.full) {
    const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1), rad = 16 + r() * 22;
    w.put(Math.sin(ph) * Math.cos(th) * rad, Math.cos(ph) * rad * 0.6, Math.sin(ph) * Math.sin(th) * rad, c, 0.35 + r() * 0.3);
  }
}

function makeShapes(N: number): Record<ShapeName, Shape> {
  const out = {} as Record<ShapeName, Shape>;
  const mk = (name: ShapeName, seed: number, cam: V3, look: V3, spin: number, opacity: number, build: (w: Writer, r: () => number) => void) => {
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const w = new Writer(N, pos, col);
    const r = mulberry(seed);
    build(w, r);
    fill(w, r, PAL.dim);
    out[name] = { pos, col, cam, look, spin, opacity };
  };

  mk('nebula', 11, [0, 7, 24], [0, -1, 0], 0.035, 1, (w, r) => {
    const core = N * 0.82;
    for (let i = 0; i < core; i++) {
      const arm = i % 3;
      const rad = Math.pow(r(), 0.62) * 15;
      const ang = (arm / 3) * Math.PI * 2 + rad * 0.42 + gauss(r) * (0.35 + rad * 0.02);
      const y = gauss(r) * 0.55 * (1.15 - rad / 15);
      const c = rad < 2.6 ? mixC(PAL.ivory, PAL.amber, rad / 2.6) : mixC(PAL.amber, PAL.ice, Math.min(1, (rad - 2.6) / 8));
      w.put(Math.cos(ang) * rad, y, Math.sin(ang) * rad, r() < 0.2 ? PAL.steel : c, 0.6 + r() * 0.5);
    }
  });

  mk('strand', 22, [0, 2.4, 17], [0, 0, 0], 0, 0.9, (w, r) => {
    const L = 46;
    for (let i = 0; i < N * 0.62; i++) {
      const t = r(), x = -L + 2 * L * t, s = i % 2 ? 0 : Math.PI;
      const a = x * 0.32 + s;
      w.put(x, Math.sin(a) * 1.3 + gauss(r) * 0.1, Math.cos(a) * 1.3 + gauss(r) * 0.1, s ? PAL.ivory : PAL.ice, 0.55 + r() * 0.4);
    }
    // year ticks: vertical amber lines every 4.6 units
    for (let k = -10; k <= 10; k++) {
      const x = k * 4.6;
      for (let j = 0; j < 140; j++) w.put(x + gauss(r) * 0.03, -3 + r() * 6, 0, k % 2 ? PAL.steel : PAL.amber, 0.9);
    }
    for (let i = 0; i < N * 0.1; i++) w.put(-L + 2 * L * r(), gauss(r) * 0.05, 0, PAL.amber, 0.7);
  });

  mk('grid', 33, [5, 7, 21], [3, -0.5, 0], 0, 0.95, (w, r) => {
    // Main table plus a second table and the join lines between them.
    const table = (ox: number, oy: number, oz: number, cols: number, rows: number, cw: number, ch: number, share: number, hdr: V3, body: V3) => {
      const W = cols * cw, H = rows * ch;
      for (let i = 0; i < N * share; i++) {
        const horiz = r() < 0.55;
        if (horiz) {
          const row = Math.floor(r() * (rows + 1));
          const x = r() * W, y = H - row * ch;
          w.put(ox + x - W / 2, oy + y - H / 2, oz + gauss(r) * 0.02, row <= 1 ? hdr : body, 0.6 + r() * 0.4);
        } else {
          const cl = Math.floor(r() * (cols + 1));
          const y = r() * H;
          w.put(ox + cl * cw - W / 2, oy + y - H / 2, oz, y > H - ch ? hdr : body, 0.5 + r() * 0.4);
        }
      }
    };
    table(-2, 0, 0, 8, 20, 2.0, 0.62, 0.5, PAL.amber, PAL.ivory);
    table(12, 2, -2, 3, 10, 1.6, 0.62, 0.16, PAL.amber, PAL.steel);
    for (let i = 0; i < N * 0.08; i++) {
      const row = 2 + Math.floor(r() * 8), t = r();
      const y0 = 6.2 - row * 0.62 * 1.5, y1 = 2 + 3.1 - (row % 8) * 0.62;
      w.put(6 + t * 4.6, y0 + (y1 - y0) * t, -2 * t, PAL.ice, 0.7);
    }
  });

  mk('tower', 44, [0, 1.5, 19], [0, 1.2, 0], 0.12, 1, (w, r) => {
    const H = 12, Wd = 3.2;
    boxEdges(w, r, 0, 0, 0, Wd, H, Wd, N * 0.18, PAL.ivory);
    for (let i = 0; i < N * 0.32; i++) {
      // rack units on the front and back faces
      const u = Math.floor(r() * 24), y = -H / 2 + 0.25 + u * 0.5, z = r() < 0.5 ? Wd / 2 : -Wd / 2;
      const x = (r() - 0.5) * Wd * 0.94;
      const led = Math.abs(x + Wd * 0.38) < 0.08;
      w.put(x, y, z, led ? (u > 15 ? PAL.amber : PAL.green) : PAL.steel, led ? 1.4 : 0.7);
    }
    for (let i = 0; i < N * 0.2; i++) {
      // heat plume escaping the top: the single server is saturated
      const t = Math.pow(r(), 0.7), a = r() * Math.PI * 2, rad = 0.3 + t * 3.5 * r();
      w.put(Math.cos(a) * rad, H / 2 + t * 7, Math.sin(a) * rad, mixC(PAL.amber, PAL.dim, t), 1 - t * 0.6);
    }
    for (let i = 0; i < N * 0.08; i++) {
      const a = r() * Math.PI * 2, rad = 2.5 + r() * 9;
      w.put(Math.cos(a) * rad, -H / 2, Math.sin(a) * rad, PAL.dim, 0.8);
    }
  });

  mk('nodes', 55, [12, 9, 17], [0, -1.5, -1], 0.02, 0.9, (w, r) => {
    const per = Math.floor((N * 0.8) / 18);
    for (let gx = 0; gx < 6; gx++) for (let gz = 0; gz < 3; gz++) {
      const cx = (gx - 2.5) * 3.4, cz = (gz - 1) * 4.2, cy = -1.2;
      boxEdges(w, r, cx, cy, cz, 1.6, 3.2, 1.6, per * 0.45, PAL.ivory, 0.75);
      for (let i = 0; i < per * 0.55; i++) {
        const u = Math.floor(r() * 7), x = (r() - 0.5) * 1.5;
        const led = x < -0.5;
        w.put(cx + x, cy - 1.5 + 0.2 + u * 0.44, cz + 0.8, led ? PAL.ice : PAL.steel, led ? 1.3 : 0.6);
      }
    }
    for (let i = 0; i < N * 0.12; i++) {
      const gx = Math.floor(r() * 20) - 10, x = gx * 1.8, z = (r() - 0.5) * 16;
      if (r() < 0.5) w.put(x, -2.85, z, PAL.dim, 0.9); else w.put((r() - 0.5) * 36, -2.85, Math.round(z / 1.8) * 1.8, PAL.dim, 0.9);
    }
  });

  mk('kv', 66, [0, 0, 18], [-1.5, 0, 0], 0, 0.42, (w, r) => {
    const rows = 12;
    for (let row = 0; row < rows; row++) {
      const y = 6.6 - row * 1.2;
      boxEdges(w, r, -6, y, 0, 2.4, 0.8, 0.8, N * 0.022, PAL.amber, 1);
      const vw = 3 + ((row * 7) % 5) * 1.3;
      boxEdges(w, r, 1 + vw / 2, y, 0, vw, 0.8, 0.8, N * 0.03, PAL.ice, 0.85);
      for (let i = 0; i < 60; i++) w.put(-4.6 + r() * 5.4, y, 0, PAL.steel, 0.9);
    }
  });

  mk('doc', 77, [0, 1, 17], [-1, 0, 0], 0.05, 0.42, (w, r) => {
    for (let d = 0; d < 6; d++) {
      const ang = (d - 2.5) * 0.32, ox = (d - 2.5) * 2.4, oz = -Math.abs(d - 2.5) * 1.2;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const put = (x: number, y: number, c: V3, k: number) => w.put(ox + x * ca, y, oz + x * sa, c, k);
      for (let i = 0; i < N * 0.03; i++) {
        const e = r(); const t = r();
        if (e < 0.25) put(-2 + t * 4, 3.6, PAL.ivory, 0.6); else if (e < 0.5) put(-2 + t * 4, -3.6, PAL.ivory, 0.6);
        else if (e < 0.75) put(-2, -3.6 + t * 7.2, PAL.ivory, 0.6); else put(2, -3.6 + t * 7.2, PAL.ivory, 0.6);
      }
      for (let line = 0; line < 11; line++) {
        const indent = [0, 0.4, 0.4, 0.8, 0.8, 0.4, 0.4, 0.8, 0.4, 0, 0][line];
        const len = 0.8 + ((line * 13 + d * 7) % 9) * 0.3;
        const y = 3 - line * 0.58;
        for (let i = 0; i < 70; i++) put(-1.6 + indent + r() * len, y, line === 0 || line === 10 ? PAL.ice : PAL.ivory, 0.55 + r() * 0.5);
      }
    }
  });

  mk('col', 88, [-3, 3, 17], [1, 0, 0], 0, 0.42, (w, r) => {
    const rows = 13;
    for (let row = 0; row < rows; row++) {
      const y = 6.2 - row * 1.0, z = -(row % 3) * 1.4, cells = 3 + ((row * 5 + 3) % 11);
      for (let c = 0; c < cells; c++) {
        const x = -10 + c * 1.55 + (c ? 1.2 : 0);
        boxEdges(w, r, x, y, z, c === 0 ? 2.4 : 1.3, 0.6, 0.3, N * (c === 0 ? 0.008 : 0.0045), c === 0 ? PAL.lilac : PAL.ivory, c === 0 ? 1.1 : 0.6);
      }
    }
  });

  mk('graph', 99, [0, 0, 21], [-1, 0, 0], 0.07, 0.5, (w, r) => {
    const nodes: V3[] = [];
    for (let i = 0; i < 46; i++) {
      const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1), rad = 3 + r() * 6.5;
      nodes.push([Math.sin(ph) * Math.cos(th) * rad, Math.cos(ph) * rad * 0.7, Math.sin(ph) * Math.sin(th) * rad]);
    }
    const edges: [number, number][] = [];
    nodes.forEach((a, i) => {
      const d = nodes.map((b, j) => [j, (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2] as [number, number]).sort((p, q) => p[1] - q[1]);
      for (let k = 1; k <= 3; k++) edges.push([i, d[k][0]]);
    });
    nodes.forEach((n, i) => {
      const hub = i % 9 === 0, rad = hub ? 0.55 : 0.28, cnt = hub ? 260 : 110;
      for (let k = 0; k < cnt; k++) {
        const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1), rr = rad * Math.cbrt(r());
        w.put(n[0] + Math.sin(ph) * Math.cos(th) * rr, n[1] + Math.cos(ph) * rr, n[2] + Math.sin(ph) * Math.sin(th) * rr, hub ? PAL.amber : PAL.green, 1.1);
      }
    });
    while (!w.full && w.i < N * 0.93) {
      const [a, b] = edges[Math.floor(r() * edges.length)], t = r(), A = nodes[a], B = nodes[b];
      w.put(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t, PAL.ivory, 0.35 + r() * 0.3);
    }
  });

  mk('ring', 111, [0, 10, 15], [0, -0.5, 0], 0.04, 0.85, (w, r) => {
    const R = 7.2;
    for (let i = 0; i < N * 0.42; i++) {
      const a = r() * Math.PI * 2, tr = 0.12 + Math.abs(gauss(r)) * 0.12, b = r() * Math.PI * 2;
      w.put(Math.cos(a) * (R + Math.cos(b) * tr), Math.sin(b) * tr, Math.sin(a) * (R + Math.cos(b) * tr), PAL.ice, 0.55 + r() * 0.4);
    }
    const ks = 8;
    for (let k = 0; k < ks; k++) {
      const a = (k / ks) * Math.PI * 2;
      const cx = Math.cos(a) * R, cz = Math.sin(a) * R;
      for (let i = 0; i < N * 0.025; i++) {
        const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1), rr = 0.65 * Math.cbrt(r());
        w.put(cx + Math.sin(ph) * Math.cos(th) * rr, Math.cos(ph) * rr, cz + Math.sin(ph) * Math.sin(th) * rr, PAL.amber, 1.2);
      }
      // replica arcs to the next two nodes clockwise (replication factor 3)
      for (const step of [1, 2]) {
        const b = ((k + step) / ks) * Math.PI * 2;
        for (let i = 0; i < 260; i++) {
          const t = r(), m = a + (b - a) * t, lift = Math.sin(t * Math.PI) * (1.2 + step);
          w.put(Math.cos(m) * (R - lift * 0.6), lift * 0.6, Math.sin(m) * (R - lift * 0.6), step === 1 ? PAL.ivory : PAL.steel, 0.6);
        }
      }
    }
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      for (let j = 0; j < 30; j++) { const rr = R + 0.6 + j * (i % 8 ? 0.012 : 0.03); w.put(Math.cos(a) * rr, 0, Math.sin(a) * rr, PAL.steel, 0.8); }
    }
  });

  mk('globe', 122, [0, 1.5, 20], [-2.5, 0, 0], 0.07, 0.95, (w, r) => {
    const R = 7.4;
    const noise = (x: number, y: number, z: number) =>
      Math.sin(x * 1.7 + Math.sin(z * 2.1)) * Math.cos(y * 2.3 + Math.sin(x * 1.3)) + 0.5 * Math.sin(z * 3.1 + y * 1.9) + 0.25 * Math.cos(x * 4.7 - z * 3.3);
    const M = Math.floor(N * 0.7);
    for (let i = 0; i < M; i++) {
      const y = 1 - (i / (M - 1)) * 2, rad = Math.sqrt(1 - y * y), th = i * 2.399963;
      const x = Math.cos(th) * rad, z = Math.sin(th) * rad;
      const land = noise(x * 1.6, y * 1.6, z * 1.6) > 0.35;
      if (!land && r() < 0.72) continue;
      w.put(x * R, y * R, z * R, land ? PAL.ice : PAL.dim, land ? 0.9 : 0.5);
    }
    for (let k = 0; k < 18 && !w.full; k++) {
      const p = () => { const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1); return new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)); };
      const A = p(), B = p();
      for (let i = 0; i < 240; i++) {
        const t = i / 239, v = A.clone().lerp(B, t).normalize().multiplyScalar(R * (1 + Math.sin(t * Math.PI) * 0.28));
        w.put(v.x, v.y, v.z, PAL.amber, 0.9);
      }
    }
  });

  mk('text', 133, [0, 0.5, 31], [0, 0.5, 0], 0, 1, (w, r) => {
    // Portrait phones are too narrow for one line, so stack "NOT ONLY" over "SQL".
    const portrait = innerWidth < innerHeight;
    const cv = document.createElement('canvas');
    cv.width = 1200; cv.height = portrait ? 560 : 300;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = "900 230px 'Big Shoulders Display', Impact, sans-serif";
    if (portrait) { ctx.fillText('MODULE', 600, 150); ctx.fillText('05', 600, 400); }
    else ctx.fillText('MODULE 05', 600, 160);
    const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
    const pts: [number, number][] = [];
    for (let y = 0; y < cv.height; y += 2) for (let x = 0; x < cv.width; x += 2) if (data[(y * cv.width + x) * 4 + 3] > 140) pts.push([x, y]);
    if (!pts.length) return;
    const take = Math.floor(N * 0.86);
    const k = portrait ? 74 : 42, cy = cv.height / 2;
    for (let i = 0; i < take; i++) {
      const [px, py] = pts[Math.floor(r() * pts.length)];
      const x = (px - 600) / k, y = -(py - cy) / k;
      const sql = portrait ? py > 280 : px > 870;
      w.put(x + gauss(r) * 0.04, y + 4.2 + gauss(r) * 0.04, gauss(r) * 0.25, sql ? PAL.amber : PAL.ivory, 0.7 + r() * 0.4);
    }
  });

  // Distributed database: five sites on a ring, each a small rack, linked by network arcs.
  mk('sites', 144, [0, 8, 21], [0, -0.5, 0], 0.045, 0.9, (w, r) => {
    const R = 8.2, K = 5;
    const sites: V3[] = [];
    for (let k = 0; k < K; k++) {
      const a = (k / K) * Math.PI * 2 + 0.3;
      sites.push([Math.cos(a) * R, 0, Math.sin(a) * R]);
    }
    sites.forEach(([cx, , cz], k) => {
      boxEdges(w, r, cx, 0, cz, 1.6, 2.8, 1.6, N * 0.03, PAL.ivory, 0.8);
      for (let i = 0; i < N * 0.035; i++) {
        const u = Math.floor(r() * 6), x = (r() - 0.5) * 1.4;
        const led = x < -0.45;
        w.put(cx + x, -1.2 + u * 0.46, cz + 0.8, led ? (k % 2 ? PAL.amber : PAL.ice) : PAL.steel, led ? 1.4 : 0.6);
      }
      // a halo disc under every site: its local database
      for (let i = 0; i < N * 0.03; i++) {
        const a = r() * Math.PI * 2, rr = 1.4 + Math.abs(gauss(r)) * 0.5;
        w.put(cx + Math.cos(a) * rr, -1.5, cz + Math.sin(a) * rr, PAL.amber, 0.5);
      }
    });
    // network links between every pair: a full mesh, arcing over the floor
    for (let a = 0; a < K; a++) for (let b = a + 1; b < K; b++) {
      const A = sites[a], B = sites[b];
      for (let i = 0; i < N * 0.018; i++) {
        const t = r(), lift = Math.sin(t * Math.PI) * 2.6;
        w.put(A[0] + (B[0] - A[0]) * t, 1.6 + lift, A[2] + (B[2] - A[2]) * t, (a + b) % 2 ? PAL.ice : PAL.steel, 0.55);
      }
    }
    for (let i = 0; i < N * 0.08; i++) {
      const a = r() * Math.PI * 2, rr = 3 + r() * 14;
      w.put(Math.cos(a) * rr, -1.6, Math.sin(a) * rr, PAL.dim, 0.7);
    }
  });

  // Fragmentation: one table pulled apart into horizontal slabs and a vertical slice.
  mk('slices', 155, [3, 4, 22], [1, 0, 0], 0, 0.9, (w, r) => {
    const cols = 9, rows = 18, cw = 1.25, ch = 0.5;
    const W = cols * cw;
    for (let i = 0; i < N * 0.78; i++) {
      const row = Math.floor(r() * rows), col = Math.floor(r() * cols);
      const slab = row < 6 ? 0 : row < 12 ? 1 : 2;
      const vert = col >= 6;
      let x = -W / 2 + col * cw + r() * cw, y = 5 - row * ch - slab * 1.1;
      let z = 0;
      if (vert) { x += 3.2; z = -2.5; }
      else z = (slab - 1) * 1.6;
      const onLine = r() < 0.6;
      if (onLine) y = 5 - row * ch - slab * 1.1; else x = -W / 2 + col * cw + (vert ? 3.2 : 0);
      const c = vert ? PAL.lilac : slab === 0 ? PAL.amber : slab === 1 ? PAL.ice : PAL.green;
      w.put(x, y, z + gauss(r) * 0.03, row % 6 === 0 ? PAL.ivory : c, 0.45 + r() * 0.45);
    }
  });

  // CAP: a triangle of three properties with the impossible centre.
  mk('cap', 166, [0, 0.5, 20], [0, 0.5, 0], 0.03, 0.85, (w, r) => {
    const V: V3[] = [[0, 6.4, 0], [-6.6, -4.4, 0], [6.6, -4.4, 0]];
    const C: V3[] = [PAL.amber, PAL.ice, PAL.green];
    V.forEach((v, k) => {
      for (let i = 0; i < N * 0.14; i++) {
        const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1), rr = 1.5 * Math.cbrt(r());
        w.put(v[0] + Math.sin(ph) * Math.cos(th) * rr, v[1] + Math.cos(ph) * rr, v[2] + Math.sin(ph) * Math.sin(th) * rr, C[k], 0.9);
      }
    });
    for (let e = 0; e < 3; e++) {
      const A = V[e], B = V[(e + 1) % 3];
      for (let i = 0; i < N * 0.07; i++) {
        const t = r();
        w.put(A[0] + (B[0] - A[0]) * t + gauss(r) * 0.06, A[1] + (B[1] - A[1]) * t + gauss(r) * 0.06, gauss(r) * 0.06, mixC(C[e], C[(e + 1) % 3], t), 0.7);
      }
    }
    for (let i = 0; i < N * 0.04; i++) {
      const t = r() * 2 - 1, s = r() < 0.5 ? 1 : -1;
      w.put(t * 0.9, -0.2 + t * 0.9 * s, 0, PAL.dim, 1.2);
    }
  });

  // MapReduce: many input streams fan into mappers, cross in the shuffle, converge on reducers.
  mk('funnel', 177, [0, 1, 22], [0, 0, 0], 0, 0.85, (w, r) => {
    const inY = [-5, -3, -1, 1, 3, 5], mapY = [-4, 0, 4], redY = [-2.2, 2.2];
    const seg = (A: V3, B: V3, n: number, c: V3, k = 0.7) => {
      for (let i = 0; i < n; i++) { const t = r(); w.put(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t + gauss(r) * 0.04, A[2] + (B[2] - A[2]) * t, c, k); }
    };
    inY.forEach((y, i) => seg([-15, y, 0], [-8, mapY[Math.floor(i / 2)], 0], N * 0.02, PAL.ivory, 0.5));
    mapY.forEach((y) => boxEdges(w, r, -6.5, y, 0, 2.6, 2, 1.2, N * 0.04, PAL.amber, 1));
    mapY.forEach((y) => redY.forEach((y2) => seg([-5.2, y, 0], [3.8, y2, 0], N * 0.025, PAL.ice, 0.55)));
    redY.forEach((y) => boxEdges(w, r, 5.4, y, 0, 2.6, 2, 1.2, N * 0.05, PAL.green, 1));
    redY.forEach((y) => seg([6.7, y, 0], [14, 0, 0], N * 0.03, PAL.lilac, 0.7));
  });

  // Aggregates: boxes inside boxes, the unit you read and write as one.
  mk('nest', 188, [6, 5, 19], [0, 0, 0], 0.06, 0.85, (w, r) => {
    boxEdges(w, r, 0, 0, 0, 12, 8, 8, N * 0.2, PAL.amber, 0.9);
    const inner: V3[] = [[-3, 1.5, 0], [3, 1.5, -1], [0, -2, 1.5]];
    inner.forEach(([x, y, z], k) => {
      boxEdges(w, r, x, y, z, 4, 3, 3, N * 0.09, k === 2 ? PAL.green : PAL.ice, 0.85);
      for (let s = 0; s < 3; s++) boxEdges(w, r, x - 1 + s, y - 0.4, z, 0.7, 0.9, 0.7, N * 0.025, PAL.ivory, 0.8);
    });
  });

  return out;
}

const VERT = /* glsl */ `
  attribute vec3 posB;
  attribute vec3 colA;
  attribute vec3 colB;
  attribute float rnd;
  uniform float uMix;
  uniform float uTime;
  uniform float uSize;
  uniform float uPR;
  uniform vec2 uMouse;
  uniform float uRepel;
  varying vec3 vCol;
  varying float vFade;
  void main() {
    float m = clamp(uMix * 1.45 - rnd * 0.45, 0.0, 1.0);
    m = m * m * (3.0 - 2.0 * m);
    vec3 p = mix(position, posB, m);
    float bump = sin(m * 3.14159);
    p += bump * vec3(sin(rnd * 41.0 + uTime * 0.9), cos(rnd * 29.0 + uTime * 0.7), sin(rnd * 17.0 - uTime * 0.5)) * 2.2;
    p += 0.05 * vec3(sin(uTime * 0.6 + rnd * 20.0), cos(uTime * 0.5 + rnd * 13.0), sin(uTime * 0.4 + rnd * 7.0));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec4 cp = projectionMatrix * mv;
    vec2 ndc = cp.xy / cp.w;
    vec2 d = ndc - uMouse;
    d.x *= 1.6;
    float f = exp(-dot(d, d) * 26.0) * uRepel;
    cp.xy += normalize(d + 0.0001) * f * 0.09 * cp.w;
    gl_Position = cp;
    float dist = -mv.z;
    gl_PointSize = uSize * uPR * (300.0 / dist) * (0.5 + rnd * 0.95) * (1.0 + f * 2.0);
    vCol = mix(colA, colB, m) * (1.0 + f * 1.5);
    vFade = smoothstep(70.0, 6.0, dist) * smoothstep(1.0, 4.0, dist);
  }
`;
const FRAG = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vCol;
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    a = a * a;
    gl_FragColor = vec4(vCol, a * vFade * uOpacity);
  }
`;
const BOKEH_VERT = /* glsl */ `
  attribute float rnd;
  uniform float uTime;
  uniform float uPR;
  varying float vA;
  varying vec3 vC;
  void main() {
    vec3 p = position;
    p.y += sin(uTime * 0.15 + rnd * 30.0) * 1.5;
    p.x += cos(uTime * 0.11 + rnd * 20.0) * 1.5;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uPR * (14.0 + rnd * 40.0) * (20.0 / -mv.z);
    vA = 0.05 + 0.08 * rnd;
    vC = mix(vec3(1.0, 0.55, 0.15), vec3(0.6, 0.78, 1.0), step(0.5, fract(rnd * 7.0)));
  }
`;
const BOKEH_FRAG = /* glsl */ `
  varying float vA;
  varying vec3 vC;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float ring = smoothstep(0.5, 0.42, d) * (0.55 + 0.45 * smoothstep(0.2, 0.48, d));
    gl_FragColor = vec4(vC, ring * vA);
  }
`;

export interface World {
  setBlend(from: ShapeName, to: ShapeName, t: number): void;
  setPan(x: number): void;
  setMouse(x: number, y: number): void;
  setActive(on: boolean): void;
  resize(): void;
}

export function createWorld(canvas: HTMLCanvasElement, reduced: boolean): World | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  const mobile = Math.min(innerWidth, innerHeight) < 700;
  const N = mobile ? 9000 : 22000;
  const PR = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.75);
  renderer.setPixelRatio(PR);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.setClearColor(0x0a0c0f, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0c0f, 30, 80);
  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
  camera.position.set(0, 7, 24);

  const shapes = makeShapes(N);
  const geo = new THREE.BufferGeometry();
  const posA = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
  const posB = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
  const colA = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
  const colB = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
  const rnd = new Float32Array(N);
  const rr = mulberry(7);
  for (let i = 0; i < N; i++) rnd[i] = rr();
  geo.setAttribute('position', posA);
  geo.setAttribute('posB', posB);
  geo.setAttribute('colA', colA);
  geo.setAttribute('colB', colB);
  geo.setAttribute('rnd', new THREE.BufferAttribute(rnd, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 80);

  const uniforms = {
    uMix: { value: 0 }, uTime: { value: 0 }, uSize: { value: mobile ? 0.22 : 0.2 }, uPR: { value: PR },
    uMouse: { value: new THREE.Vector2(9, 9) }, uRepel: { value: reduced ? 0 : 1 }, uOpacity: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  const rig = new THREE.Group();
  rig.add(points);
  scene.add(rig);

  // Out-of-focus specks for depth.
  const BN = mobile ? 120 : 260;
  const bgeo = new THREE.BufferGeometry();
  const bpos = new Float32Array(BN * 3), brnd = new Float32Array(BN);
  for (let i = 0; i < BN; i++) {
    bpos[i * 3] = (rr() - 0.5) * 70; bpos[i * 3 + 1] = (rr() - 0.5) * 40; bpos[i * 3 + 2] = (rr() - 0.5) * 50;
    brnd[i] = rr();
  }
  bgeo.setAttribute('position', new THREE.BufferAttribute(bpos, 3));
  bgeo.setAttribute('rnd', new THREE.BufferAttribute(brnd, 1));
  const bmat = new THREE.ShaderMaterial({
    vertexShader: BOKEH_VERT, fragmentShader: BOKEH_FRAG,
    uniforms: { uTime: uniforms.uTime, uPR: uniforms.uPR },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  scene.add(new THREE.Points(bgeo, bmat));

  let from: ShapeName | null = null, to: ShapeName | null = null;
  let tTarget = 0, tNow = 0, pan = 0, panNow = 0;
  const mouse = new THREE.Vector2(9, 9), mouseNow = new THREE.Vector2(9, 9);
  const camPos = new THREE.Vector3(0, 7, 24), camLook = new THREE.Vector3(0, -1, 0);
  const tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3();
  let rotY = 0;
  let active = true;

  function load(a: ShapeName, b: ShapeName) {
    (posA.array as Float32Array).set(shapes[a].pos);
    (posB.array as Float32Array).set(shapes[b].pos);
    (colA.array as Float32Array).set(shapes[a].col);
    (colB.array as Float32Array).set(shapes[b].col);
    posA.needsUpdate = posB.needsUpdate = colA.needsUpdate = colB.needsUpdate = true;
  }

  const ease = (t: number) => t * t * (3 - 2 * t);
  let lastT = performance.now();
  let raf = 0;

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!active || !from || !to) return;
    const now = performance.now();
    const dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    uniforms.uTime.value += dt;
    tNow += (tTarget - tNow) * Math.min(1, dt * 4.5);
    uniforms.uMix.value = tNow;
    const A = shapes[from], B = shapes[to], e = ease(Math.min(1, Math.max(0, tNow)));
    tmpP.set(...A.cam).lerp(tmpL.set(...B.cam), e);
    panNow += (pan - panNow) * Math.min(1, dt * 3);
    tmpP.x += panNow;
    mouseNow.lerp(mouse, Math.min(1, dt * 5));
    const mx = mouseNow.x > 5 ? 0 : mouseNow.x, my = mouseNow.y > 5 ? 0 : mouseNow.y;
    tmpP.x += mx * 1.4; tmpP.y += my * 0.9;
    camPos.lerp(tmpP, Math.min(1, dt * 2.6));
    tmpL.set(...A.look).lerp(new THREE.Vector3(...B.look), e);
    tmpL.x += panNow;
    camLook.lerp(tmpL, Math.min(1, dt * 2.6));
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    const spin = A.spin + (B.spin - A.spin) * e;
    if (spin > 0.001 && !reduced) rotY += spin * dt;
    else rotY += (Math.round(rotY / (Math.PI * 2)) * Math.PI * 2 - rotY) * Math.min(1, dt * 3);
    rig.rotation.y = rotY;
    uniforms.uOpacity.value = A.opacity + (B.opacity - A.opacity) * e;
    uniforms.uMouse.value.copy(mouseNow);
    renderer.render(scene, camera);
  }
  frame();

  return {
    setBlend(a, b, t) {
      if (a !== from || b !== to) {
        load(a, b);
        from = a; to = b;
        tNow = t;
      }
      tTarget = t;
    },
    setPan(x) { pan = x; },
    setMouse(x, y) { mouse.set(x, y); },
    setActive(on) {
      if (on && !active) lastT = performance.now();
      active = on;
    },
    resize() {
      renderer.setSize(innerWidth, innerHeight, false);
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
    },
  };
}
