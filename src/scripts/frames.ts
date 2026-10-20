// Scroll-scrubbed "frame sequence" stages. Each stage maps scroll progress to a frame number,
// eases the displayed frame toward it (like the original image-sequence hero) and draws that frame live.
import { ScrollTrigger } from 'gsap/ScrollTrigger';

type R = { x: number; y: number; w: number; h: number };
type Draw = (c: CanvasRenderingContext2D, p: number, r: R, t: number) => void;

const COL = { ivory: '#ece7da', dim: '#8f969e', faint: '#5d646c', amber: '#ff8a1f', ice: '#9cc8ff', ok: '#9fdc8c', fail: '#ff5a4e', lilac: '#d8c7ff', steel: '#1c2229', steel3: '#262d36', void: '#0a0c0f' };
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const DISP = "'Big Shoulders Display', Impact, sans-serif";
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const eio = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eo = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function box(c: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, stroke: string, fill = 'rgba(22,27,33,0.92)', glow = 0) {
  c.save();
  if (glow > 0) { c.shadowColor = stroke; c.shadowBlur = 24 * glow; }
  rr(c, cx - w / 2, cy - h / 2, w, h, 6);
  c.fillStyle = fill; c.fill();
  c.lineWidth = 1.4; c.strokeStyle = stroke; c.stroke();
  c.restore();
}
function txt(c: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, opts: { font?: string; align?: CanvasTextAlign; weight?: string; alpha?: number } = {}) {
  c.save();
  c.globalAlpha *= opts.alpha ?? 1;
  c.font = `${opts.weight ?? (opts.font === DISP ? '800' : '400')} ${size}px ${opts.font ?? MONO}`;
  c.fillStyle = color; c.textAlign = opts.align ?? 'center'; c.textBaseline = 'middle';
  c.fillText(s, x, y);
  c.restore();
}
function line(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, w = 1.2, dash: number[] = []) {
  c.save(); c.strokeStyle = color; c.lineWidth = w; c.setLineDash(dash);
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.restore();
}
/** a message packet travelling from a to b, k in 0..1, with a label pill */
function pkt(c: CanvasRenderingContext2D, a: [number, number], b: [number, number], k: number, color: string, label: string, s: number) {
  if (k <= 0 || k >= 1) return;
  const e = eio(k), x = lerp(a[0], b[0], e), y = lerp(a[1], b[1], e);
  c.save();
  c.shadowColor = color; c.shadowBlur = 18;
  c.fillStyle = color; c.beginPath(); c.arc(x, y, 5.5 * s, 0, Math.PI * 2); c.fill();
  c.restore();
  c.save();
  c.font = `500 ${10.5 * s}px ${MONO}`;
  const w = c.measureText(label).width + 12 * s;
  rr(c, x - w / 2, y - 26 * s, w, 17 * s, 3);
  c.fillStyle = 'rgba(10,12,15,0.9)'; c.fill(); c.strokeStyle = color; c.lineWidth = 1; c.stroke();
  c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, x, y - 17.5 * s);
  c.restore();
}
function lock(c: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, alpha = 1) {
  c.save(); c.globalAlpha *= alpha; c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 1.6 * s;
  c.beginPath(); c.arc(x, y - 3 * s, 4 * s, Math.PI, 0); c.stroke();
  rr(c, x - 6 * s, y - 3 * s, 12 * s, 9 * s, 2); c.fill();
  c.restore();
}

/* ================================================================ 2PC */
let tpcScenario: 'commit' | 'abort' | 'crash' = 'commit';
export const setTpcScenario = (s: typeof tpcScenario) => { tpcScenario = s; };

const drawTpc: Draw = (c, p, r, t) => {
  const sc = tpcScenario;
  const wide = r.w / r.h > 1.15;
  const s = clamp(Math.min(r.w / (wide ? 640 : 400), r.h / 380), 0.62, 1.3);
  const C: [number, number] = wide ? [r.x + r.w * 0.17, r.y + r.h * 0.5] : [r.x + r.w * 0.5, r.y + r.h * 0.16];
  const P: [number, number][] = wide
    ? [0.17, 0.5, 0.83].map((f) => [r.x + r.w * 0.76, r.y + r.h * f])
    : [0.17, 0.5, 0.83].map((f) => [r.x + r.w * f, r.y + r.h * 0.72]);
  const bw = (wide ? 150 : 100) * s, bh = 56 * s;
  const no = sc === 'abort', crash = sc === 'crash';
  // phases
  const work = seg(p, 0.03, 0.14), working = seg(p, 0.13, 0.22);
  const prep = seg(p, 0.26, 0.34), force = seg(p, 0.34, 0.4), vote = seg(p, 0.4, 0.48);
  const decide = seg(p, 0.5, 0.54), send = seg(p, 0.54, 0.64), apply = seg(p, 0.64, 0.69), ack = seg(p, 0.69, 0.75);
  const crashed = crash && p > 0.5;
  const recover = crash ? seg(p, 0.88, 0.92) : 0, rsend = crash ? seg(p, 0.92, 0.98) : 0;
  // links
  P.forEach((q) => line(c, C[0], C[1], q[0], q[1], crashed && recover < 1 ? 'rgba(255,90,78,0.35)' : 'rgba(236,231,218,0.18)', 1.2, crashed && recover < 1 ? [4, 6] : []));
  // participants
  P.forEach((q, i) => {
    const isNo = no && i === 2;
    let state = 'idle', col = COL.dim;
    if (work >= 1) { state = 'active'; col = COL.ice; }
    if (vote > 0.5) { state = isNo ? 'aborted' : 'prepared'; col = isNo ? COL.fail : COL.amber; }
    if (!crash && apply > 0) { state = no ? 'aborted' : 'committed'; col = no ? COL.fail : COL.ok; }
    if (crash && p > 0.6 && rsend < 1) { state = 'in doubt'; col = COL.amber; }
    if (crash && rsend >= 1) { state = 'aborted'; col = COL.fail; }
    const pulse = state === 'in doubt' ? 0.5 + 0.5 * Math.sin(t * 5) : vote > 0.5 && vote < 1 ? 0.6 : 0;
    box(c, q[0], q[1], bw, bh, col, 'rgba(22,27,33,0.94)', pulse);
    txt(c, `Site ${i + 1}`, q[0], q[1] - 10 * s, 15 * s, COL.ivory, { font: DISP, weight: '800' });
    txt(c, state.toUpperCase(), q[0], q[1] + 11 * s, 9.5 * s, col);
    // local work progress
    if (working > 0 && working < 1) { c.fillStyle = COL.steel3; c.fillRect(q[0] - bw / 2 + 10 * s, q[1] + bh / 2 - 8 * s, bw - 20 * s, 3 * s); c.fillStyle = COL.ice; c.fillRect(q[0] - bw / 2 + 10 * s, q[1] + bh / 2 - 8 * s, (bw - 20 * s) * working, 3 * s); }
    // locks held from the work until commit/abort
    const held = work >= 1 && !((!crash && apply >= 1) || (crash && rsend >= 1)) && !(isNo && vote > 0.5);
    lock(c, q[0] + bw / 2 - 14 * s, q[1] - bh / 2 + 13 * s, s * 0.85, state === 'in doubt' ? COL.fail : COL.amber, held ? 1 : 0.15);
    // the participant's log
    const logs: [string, string][] = [];
    if (working >= 1) logs.push(['update T', COL.dim]);
    if (force > 0) logs.push([isNo ? 'abort T' : 'ready T  (forced)', isNo ? COL.fail : COL.amber]);
    if (!crash && apply > 0 && !isNo) logs.push([no ? 'abort T' : 'commit T', no ? COL.fail : COL.ok]);
    if (crash && rsend >= 1) logs.push(['abort T', COL.fail]);
    logs.forEach(([l, lc], k) => {
      const lx = wide ? q[0] + bw / 2 + 10 * s : q[0] - bw / 2;
      const ly = wide ? q[1] - bh / 2 + 8 * s + k * 13 * s : q[1] + bh / 2 + 12 * s + k * 12 * s;
      txt(c, l, lx, ly, 9 * s, lc, { align: 'left', alpha: k === logs.length - 1 ? clamp(force > 0 && l.startsWith('ready') ? force * 3 : 1) : 1 });
    });
  });
  // coordinator
  let cState = 'coordinator', cCol = COL.ivory;
  if (prep > 0) { cState = 'collecting votes'; cCol = COL.amber; }
  if (decide > 0 && !crashed) { cState = no ? 'decided: ABORT' : 'decided: COMMIT'; cCol = no ? COL.fail : COL.ok; }
  if (crashed) { cState = recover >= 1 ? 'recovered → abort' : 'CRASHED'; cCol = recover >= 1 ? COL.amber : COL.fail; }
  box(c, C[0], C[1], bw * 1.08, bh * 1.15, cCol, crashed && recover < 1 ? 'rgba(40,16,16,0.95)' : 'rgba(26,22,16,0.95)', decide > 0 && decide < 1 ? 0.8 : 0);
  txt(c, 'Coordinator', C[0], C[1] - 12 * s, 15 * s, COL.ivory, { font: DISP });
  txt(c, cState.toUpperCase(), C[0], C[1] + 10 * s, 9.5 * s, cCol);
  if (crashed && recover < 1) {
    const k = 14 * s; c.save(); c.strokeStyle = COL.fail; c.lineWidth = 3 * s; c.beginPath();
    c.moveTo(C[0] - k, C[1] - k * 2.2); c.lineTo(C[0] + k, C[1] - k * 0.2); c.moveTo(C[0] + k, C[1] - k * 2.2); c.lineTo(C[0] - k, C[1] - k * 0.2); c.stroke(); c.restore();
  }
  const clog: [string, string][] = [];
  if (prep > 0) clog.push(['prepare T', COL.amber]);
  if (decide > 0 && !crash) clog.push([no ? 'abort T' : 'commit T  (forced)', no ? COL.fail : COL.ok]);
  if (ack >= 1 && !crash) clog.push(['end T', COL.dim]);
  if (crash && recover >= 1) clog.push(['no decision → abort', COL.amber]);
  clog.forEach(([l, lc], k) => txt(c, l, C[0], C[1] + bh * 0.72 + k * 13 * s, 9 * s, lc));
  txt(c, 'log', C[0], C[1] + bh * 0.72 - 13 * s, 8 * s, COL.faint, { alpha: clog.length ? 1 : 0 });
  // messages
  P.forEach((q, i) => {
    const st = i * 0.18;
    const sp = st + 0.64;
    pkt(c, C, q, seg(work, st, sp), COL.ice, 'work', s);
    pkt(c, C, q, seg(prep, st, sp), COL.amber, 'PREPARE', s);
    const isNo = no && i === 2;
    pkt(c, q, C, seg(vote, st, sp), isNo ? COL.fail : COL.ok, isNo ? 'NO' : 'YES', s);
    if (!crash) {
      pkt(c, C, q, seg(send, st, sp), no ? COL.fail : COL.ok, no ? 'ABORT' : 'COMMIT', s);
      pkt(c, q, C, seg(ack, st, sp), COL.dim, 'ACK', s);
    } else {
      pkt(c, C, q, seg(rsend, st, sp), COL.fail, 'ABORT', s);
    }
  });
  // closing banner
  const banner = (msg: string, col: string, a: number) => {
    if (a <= 0) return;
    const y = wide ? r.y + r.h * 0.04 : r.y + r.h * 0.42;
    c.save(); c.globalAlpha = a;
    c.font = `800 ${18 * s}px ${DISP}`;
    const w = c.measureText(msg).width + 30 * s;
    const x = wide ? r.x + r.w * 0.47 : r.x + r.w / 2;
    rr(c, x - w / 2, y - 15 * s, w, 30 * s, 4); c.fillStyle = 'rgba(10,12,15,0.85)'; c.fill(); c.strokeStyle = col; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(msg, x, y + 1);
    c.restore();
  };
  if (!crash) banner(no ? 'ONE NO → ALL SITES ROLL BACK' : 'COMMITTED AT 3 OF 3 SITES', no ? COL.fail : COL.ok, seg(p, 0.76, 0.8));
  else {
    banner('BLOCKED · SITES IN DOUBT, HOLDING LOCKS', COL.fail, seg(p, 0.6, 0.64) * (1 - seg(p, 0.88, 0.9)));
    banner('COORDINATOR RECOVERS · NO COMMIT RECORD → ABORT', COL.amber, seg(p, 0.9, 0.93));
  }
};

/* ================================================================ distributed query processing */
const drawDqp: Draw = (c, p, r, t) => {
  const wide = r.w / r.h > 1.15;
  const s = clamp(Math.min(r.w / (wide ? 660 : 420), r.h / 380), 0.6, 1.25);
  const s1 = seg(p, 0.02, 0.2), s2 = seg(p, 0.27, 0.46), s3 = seg(p, 0.52, 0.72), s4 = seg(p, 0.78, 0.97);
  const fade1 = 1 - seg(p, 0.5, 0.55);
  // stage 1: SQL text, then the algebra tree
  const sql = ['SELECT Fname, Lname, Dname', 'FROM EMPLOYEE E, DEPARTMENT D', 'WHERE E.Dno = D.Dnumber', '  AND E.Dno = 5 AND E.Salary > 30000'];
  const sqlA = 1 - seg(p, 0.1, 0.17);
  if (sqlA > 0) {
    const fs = 12.5 * s, x0 = r.x + (wide ? 10 : 0), y0 = r.y + r.h * 0.18;
    sql.forEach((l, i) => txt(c, l.slice(0, Math.round(l.length * clamp(s1 * 2.2 - i * 0.25))), x0, y0 + i * fs * 1.6, fs, i === 0 ? COL.ice : COL.ivory, { align: 'left', alpha: sqlA }));
    txt(c, 'global schema · no sites, no fragments', x0, y0 + 5 * fs * 1.6, 9.5 * s, COL.dim, { align: 'left', alpha: sqlA });
  }
  // tree geometry
  const cx = r.x + r.w * (wide ? 0.55 : 0.5), top = r.y + r.h * 0.1;
  const dy = r.h * 0.19;
  const nodes = {
    pi: [cx, top], join: [cx, top + dy], sel: [cx - r.w * (wide ? 0.2 : 0.24), top + dy * 2], emp: [wide ? cx - r.w * 0.2 : cx, top + dy * 3], dept: [cx + r.w * (wide ? 0.2 : 0.24), top + dy * 2],
  } as Record<string, [number, number]>;
  const treeA = seg(p, 0.16, 0.24) * fade1;
  const edge = (a: string, b: string, k: number, col = 'rgba(236,231,218,0.35)') => { if (k > 0) line(c, nodes[a][0], nodes[a][1], lerp(nodes[a][0], nodes[b][0], k), lerp(nodes[a][1], nodes[b][1], k), col, 1.3); };
  const tn = (k: string, label: string, col: string, a: number, w = 150) => { if (a <= 0) return; c.save(); c.globalAlpha = a; box(c, nodes[k][0], nodes[k][1], w * s, 30 * s, col); txt(c, label, nodes[k][0], nodes[k][1], 11 * s, col); c.restore(); };
  if (treeA > 0) {
    edge('pi', 'join', treeA); edge('join', 'sel', treeA); edge('sel', 'emp', treeA * (1 - s2)); edge('join', 'dept', treeA);
    tn('pi', 'π Fname, Lname, Dname', COL.ice, treeA, 190);
    tn('join', '⋈ Dno = Dnumber', COL.ivory, treeA, 150);
    tn('sel', 'σ Dno=5 ∧ Salary>30000', COL.ivory, treeA, 200);
    tn('dept', s2 > 0.6 ? 'DEPARTMENT @ site 1' : 'DEPARTMENT', COL.ok, treeA, 170);
    tn('emp', 'EMPLOYEE', COL.amber, treeA * (1 - s2), 120);
  }
  // stage 2: EMPLOYEE becomes a union of fragments, two are pruned
  if (s2 > 0 && fade1 > 0) {
    const u: [number, number] = [nodes.emp[0], nodes.emp[1]];
    const frs = [['EMP_D5 @ site 2', COL.amber], ['EMP_D4 @ site 3', COL.ice], ['EMP_D1 @ site 1', COL.lilac]] as const;
    c.save(); c.globalAlpha = fade1;
    line(c, nodes.sel[0], nodes.sel[1], u[0], u[1], 'rgba(236,231,218,0.35)', 1.3);
    box(c, u[0], u[1], 40 * s, 26 * s, COL.ivory); txt(c, '∪', u[0], u[1], 15 * s, COL.ivory);
    frs.forEach(([l, col], i) => {
      const fx = u[0] + (i - 1) * (wide ? Math.max(145 * s, r.w * 0.17) : r.w * 0.33), fy = u[1] + dy * 0.95;
      const k = eo(seg(s2, i * 0.12, 0.5 + i * 0.12));
      const pruned = i > 0 ? seg(s2, 0.7, 0.95) : 0;
      c.save(); c.globalAlpha *= k * (1 - pruned * 0.75);
      line(c, u[0], u[1] + 13 * s, fx, fy - 13 * s, col, 1.2);
      box(c, fx, fy, 128 * s, 26 * s, col); txt(c, l, fx, fy, 9.5 * s, col);
      if (pruned > 0) line(c, fx - 64 * s, fy, fx - 64 * s + 128 * s * pruned, fy, COL.fail, 2);
      c.restore();
    });
    if (s2 > 0.8) txt(c, 'Dno = 5 can only match EMP_D5: the other fragments are pruned', u[0], u[1] + dy * 1.55, 9.5 * s, COL.dim, { alpha: seg(s2, 0.8, 1) });
    c.restore();
  }
  // stage 3: candidate strategies with costs
  if (s3 > 0) {
    const a3 = 1 - seg(p, 0.76, 0.8);
    const plans = [
      { l: 'A · ship EMP_D5 rows to site 1, join there', io: 0.18, cpu: 0.1, com: 0.55 },
      { l: 'B · ship DEPARTMENT to site 2, join there', io: 0.16, cpu: 0.1, com: 0.14 },
      { l: 'C · ship both to the result site', io: 0.2, cpu: 0.1, com: 0.7 },
    ];
    const x0 = r.x + r.w * (wide ? 0.08 : 0.04), bwid = r.w * (wide ? 0.62 : 0.9), y0 = r.y + r.h * 0.18;
    c.save(); c.globalAlpha = a3;
    txt(c, 'estimated cost  =  I/O  +  CPU  +  communication', x0, y0 - 26 * s, 10 * s, COL.dim, { align: 'left' });
    plans.forEach((pl, i) => {
      const y = y0 + i * r.h * 0.22;
      const k = eo(seg(s3, i * 0.15, 0.55 + i * 0.15));
      const best = i === 1 && s3 > 0.75;
      txt(c, pl.l, x0, y, 11.5 * s, best ? COL.ok : COL.ivory, { align: 'left' });
      let xx = x0;
      ([['io', COL.dim], ['cpu', COL.lilac], ['com', COL.amber]] as const).forEach(([key, col]) => {
        const w = bwid * (pl as any)[key] * k;
        c.fillStyle = col; c.fillRect(xx, y + 12 * s, w, 10 * s); xx += w;
      });
      if (best) txt(c, '← cheapest: chosen', xx + 10 * s, y + 17 * s, 10 * s, COL.ok, { align: 'left', alpha: seg(s3, 0.75, 0.9) });
    });
    txt(c, 'communication (amber) dominates · illustrative costs', x0, y0 + r.h * 0.66, 9.5 * s, COL.faint, { align: 'left' });
    c.restore();
  }
  // stage 4: sites execute their local plans
  if (s4 > 0) {
    const pos: [number, number][] = wide
      ? [[r.x + r.w * 0.12, r.y + r.h * 0.3], [r.x + r.w * 0.45, r.y + r.h * 0.3], [r.x + r.w * 0.28, r.y + r.h * 0.78]]
      : [[r.x + r.w * 0.22, r.y + r.h * 0.2], [r.x + r.w * 0.78, r.y + r.h * 0.2], [r.x + r.w * 0.5, r.y + r.h * 0.7]];
    const lab = ['site 1 · DEPARTMENT', 'site 2 · EMP_D5', 'result site'];
    const k = eo(seg(s4, 0, 0.25));
    c.save(); c.globalAlpha = k;
    line(c, pos[0][0], pos[0][1], pos[1][0], pos[1][1], 'rgba(236,231,218,0.2)');
    line(c, pos[1][0], pos[1][1], pos[2][0], pos[2][1], 'rgba(236,231,218,0.2)');
    pos.forEach((q, i) => {
      const run = i === 1 ? seg(s4, 0.45, 0.7) : 0;
      box(c, q[0], q[1], 150 * s, 50 * s, i === 2 ? COL.ok : i === 1 ? COL.amber : COL.ice, 'rgba(22,27,33,0.94)', run > 0 && run < 1 ? 0.7 : 0);
      txt(c, lab[i], q[0], q[1] - 8 * s, 11 * s, COL.ivory);
      if (i === 1) {
        txt(c, run >= 1 ? 'σ → ⋈ done' : run > 0 ? 'local plan running' : 'waiting', q[0], q[1] + 10 * s, 9 * s, COL.amber);
        if (run > 0 && run < 1) { c.save(); c.translate(q[0] + 62 * s, q[1] - 14 * s); c.rotate(t * 3); c.strokeStyle = COL.amber; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 6 * s, 0, Math.PI * 1.4); c.stroke(); c.restore(); }
      }
    });
    pkt(c, pos[0], pos[1], seg(s4, 0.22, 0.45), COL.ice, 'DEPARTMENT · 3 rows', s);
    pkt(c, pos[1], pos[2], seg(s4, 0.7, 0.88), COL.ok, 'result · 2 rows', s);
    const ra = seg(s4, 0.88, 1);
    if (ra > 0) {
      const rows = ['Franklin  Wong     Research', 'Ramesh    Narayan  Research'];
      rows.forEach((l, i) => txt(c, l, pos[2][0], pos[2][1] + 42 * s + i * 15 * s, 10 * s, COL.ok, { alpha: ra }));
    }
    c.restore();
  }
};

/* ================================================================ MapReduce */
const MR = {
  splits: [['sql', 'nosql', 'sql'], ['nosql', 'graph'], ['sql', 'graph', 'graph']],
  part: { sql: 0, graph: 0, nosql: 1 } as Record<string, number>,
};
const PC = [COL.amber, COL.ice];
const drawMr: Draw = (c, p, r, t) => {
  const wide = r.w / r.h > 1.1;
  const s = clamp(Math.min(r.w / (wide ? 700 : 470), r.h / 400), 0.58, 1.25);
  const cols = wide ? [0.06, 0.3, 0.64, 0.92] : [0.08, 0.36, 0.7, 0.93];
  const X = cols.map((f) => r.x + r.w * f);
  const ys = [0.24, 0.52, 0.8].map((f) => r.y + r.h * f);
  const ry = [0.36, 0.72].map((f) => r.y + r.h * f);
  const sp = seg(p, 0.02, 0.16), mp = seg(p, 0.22, 0.4), sh = seg(p, 0.44, 0.62), rd = seg(p, 0.66, 0.82), fx = seg(p, 0.86, 0.99);
  // master
  const M: [number, number] = [r.x + r.w * 0.18, r.y + r.h * 0.04];
  box(c, M[0], M[1], 96 * s, 24 * s, COL.lilac); txt(c, 'master', M[0], M[1], 10 * s, COL.lilac);
  // input document splitting into three
  MR.splits.forEach((words, i) => {
    const y0 = r.y + r.h * 0.52 + (i - 1) * 22 * s, y1 = ys[i];
    const y = lerp(y0, y1, eio(sp));
    const consumed = seg(mp, i * 0.1, 0.5 + i * 0.1);
    c.save(); c.globalAlpha = 1 - consumed * 0.6;
    box(c, X[0] + 38 * s, y, 92 * s, 20 * s, COL.ivory, 'rgba(236,231,218,0.06)');
    txt(c, words.join(' '), X[0] + 38 * s, y, 9.5 * s, COL.ivory);
    c.restore();
    if (sp > 0.6) line(c, M[0], M[1] + 12 * s, X[1], ys[i] - 24 * s, `rgba(216,199,255,${0.35 * seg(sp, 0.6, 1) * (1 - seg(p, 0.42, 0.46))})`, 1, [3, 5]);
  });
  txt(c, 'input', X[0] + 38 * s, r.y + r.h * 0.97, 9 * s, COL.faint);
  // mappers
  const dead = fx > 0.15 && fx < 1;
  ys.forEach((y, i) => {
    const active = mp > i * 0.1 && mp < 0.6 + i * 0.12;
    const isDead = i === 1 && fx > 0.15;
    box(c, X[1], y, 104 * s, 40 * s, isDead ? COL.fail : COL.amber, isDead ? 'rgba(40,16,16,0.95)' : 'rgba(26,22,16,0.94)', active ? 0.6 + 0.3 * Math.sin(t * 6) : 0);
    txt(c, isDead ? 'worker ✕' : `map ${i + 1}`, X[1], y - 6 * s, 12 * s, isDead ? COL.fail : COL.ivory, { font: DISP });
    txt(c, isDead ? 'no heartbeat' : 'emit(w, 1)', X[1], y + 9 * s, 8.5 * s, isDead ? COL.fail : COL.dim);
  });
  // spare worker re-runs the dead mapper's split
  if (fx > 0.3) {
    const k = eo(seg(fx, 0.3, 0.55)), y = ys[1] + 52 * s;
    c.save(); c.globalAlpha = k;
    box(c, X[1], y, 104 * s, 34 * s, COL.ok, 'rgba(20,32,22,0.94)', seg(fx, 0.55, 0.8) > 0 && seg(fx, 0.55, 0.8) < 1 ? 0.7 : 0);
    txt(c, 'map 2 · retry', X[1], y, 11 * s, COL.ok, { font: DISP });
    line(c, M[0], M[1] + 12 * s, X[1], y - 17 * s, 'rgba(159,220,140,0.5)', 1, [3, 5]);
    c.restore();
  }
  // reducers + output
  ry.forEach((y, j) => {
    box(c, X[2], y, 120 * s, 44 * s, COL.ok, 'rgba(20,32,22,0.94)', rd > 0 && rd < 1 ? 0.5 : 0);
    txt(c, `reduce ${j + 1}`, X[2], y - 14 * s, 12 * s, COL.ivory, { font: DISP });
  });
  txt(c, 'hash(word) mod 2', lerp(X[1], X[2], 0.5), r.y + r.h * 0.97, 9 * s, COL.faint, { alpha: seg(sh, 0, 0.2) });
  // pairs: emitted at the mapper, shuffled to reducers, grouped, then reduced
  const groups: Record<string, number> = {};
  const order = ['graph', 'sql', 'nosql'];
  let idx = 0;
  MR.splits.forEach((words, i) => {
    words.forEach((w, k) => {
      const part = MR.part[w];
      const gi = groups[w] = (groups[w] ?? 0) + 1;
      const emitK = eo(seg(mp, i * 0.12 + k * 0.06, i * 0.12 + k * 0.06 + 0.25));
      if (emitK <= 0) { idx++; return; }
      const a: [number, number] = [X[1] + 62 * s + k * 0, ys[i] - 14 * s + k * 14 * s];
      const keysHere = order.filter((o) => MR.part[o] === part);
      const row = keysHere.indexOf(w);
      const b: [number, number] = [X[2] - 22 * s + (gi - 1) * 24 * s, ry[part] + 4 * s + row * 15 * s];
      const sk = eio(seg(sh, idx * 0.05, idx * 0.05 + 0.45));
      const x = sk > 0 ? lerp(a[0], b[0], sk) : lerp(X[1], a[0], emitK);
      const y = sk > 0 ? lerp(a[1], b[1], sk) - Math.sin(sk * Math.PI) * 30 * s : lerp(ys[i], a[1], emitK);
      const gone = rd > 0.3;
      c.save(); c.globalAlpha = (gone ? 1 - seg(rd, 0.3, 0.6) : 1) * emitK;
      const lbl = sk >= 1 ? '1' : `(${w},1)`;
      c.font = `500 ${9.5 * s}px ${MONO}`;
      const ww = c.measureText(lbl).width + 8 * s;
      rr(c, x - ww / 2 + (sk >= 1 ? 0 : 20 * s), y - 7 * s, ww, 14 * s, 3);
      c.fillStyle = 'rgba(10,12,15,0.9)'; c.fill(); c.strokeStyle = PC[part]; c.lineWidth = 1; c.stroke();
      c.fillStyle = PC[part]; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(lbl, x + (sk >= 1 ? 0 : 20 * s), y);
      c.restore();
      idx++;
    });
  });
  // group labels while shuffled, then reduced totals and output files
  const totals: Record<string, number> = { sql: 3, graph: 3, nosql: 2 };
  order.forEach((w) => {
    const part = MR.part[w], row = order.filter((o) => MR.part[o] === part).indexOf(w);
    const y = ry[part] + 4 * s + row * 15 * s;
    const gl = seg(sh, 0.75, 1) * (1 - seg(rd, 0.3, 0.6));
    txt(c, w, X[2] - 34 * s, y, 9.5 * s, PC[part], { align: 'right', alpha: gl });
    const out = eo(seg(rd, 0.4, 0.9));
    if (out > 0) {
      const ox = lerp(X[2], X[3], out), oy = lerp(y, r.y + r.h * (0.3 + order.indexOf(w) * 0.2), out);
      c.save(); c.globalAlpha = seg(rd, 0.4, 0.55);
      const lbl = `(${w}, ${totals[w]})`;
      c.font = `600 ${11 * s}px ${MONO}`;
      const ww = c.measureText(lbl).width + 12 * s;
      rr(c, ox - ww / 2, oy - 9 * s, ww, 18 * s, 3); c.fillStyle = 'rgba(20,32,22,0.95)'; c.fill(); c.strokeStyle = COL.ok; c.stroke();
      c.fillStyle = COL.ok; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(lbl, ox, oy);
      c.restore();
    }
  });
  if (rd > 0.9) txt(c, 'output files', X[3], r.y + r.h * 0.12, 9 * s, COL.faint);
  if (fx > 0.8) txt(c, 'same answer after the retry', X[3] - 10 * s, r.y + r.h * 0.95, 10 * s, COL.ok, { align: 'right', alpha: seg(fx, 0.8, 0.95) });
  void dead;
};

const DRAWS: Record<string, Draw> = { tpc: drawTpc, dqp: drawDqp, mr: drawMr };

export function frameStages(reducedMotion: boolean) {
  document.querySelectorAll<HTMLElement>('.fstage').forEach((sec) => {
    const canvas = sec.querySelector<HTMLCanvasElement>('.fs-canvas')!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const draw = DRAWS[sec.dataset.draw!];
    const frames = Number(sec.dataset.frames) || 960;
    const cards = Array.from(sec.querySelectorAll<HTMLElement>('.fs-card'));
    const steps = cards.map((cd) => ({ from: Number(cd.dataset.from), to: Number(cd.dataset.to) }));
    const ticks = cards.map((cd) => Array.from(cd.querySelectorAll<HTMLElement>('.fs-ticks i span')));
    const bar = sec.querySelector<HTMLElement>('.fs-progress span')!;
    const counter = sec.querySelector<HTMLElement>('.fs-frame b');
    const copy = sec.querySelector<HTMLElement>('.fs-copy')!;
    const cardsBox = sec.querySelector<HTMLElement>('.fs-cards')!;
    let target = 0, disp = 0, visible = false, raf = 0, W = 0, H = 0, region: R = { x: 0, y: 0, w: 1, h: 1 };
    let last = -1;
    const dpr = () => Math.min(devicePixelRatio || 1, 1.75);
    function measure() {
      const sticky = canvas.parentElement!;
      W = sticky.clientWidth; H = sticky.clientHeight;
      canvas.width = Math.round(W * dpr()); canvas.height = Math.round(H * dpr());
      const top = sticky.getBoundingClientRect().top;
      const cb = copy.getBoundingClientRect().bottom - top;
      const cr = cardsBox.getBoundingClientRect();
      const phone = W <= 760;
      const gutter = parseFloat(getComputedStyle(copy).left) || 20;
      if (phone) region = { x: 14, y: cb + 18, w: W - 28, h: Math.max(160, cr.top - top - cb - 30) };
      else region = { x: gutter, y: cb + 30, w: Math.max(260, cr.left - gutter - 40), h: Math.max(220, H - cb - 30 - 60) };
    }
    function render(now: number) {
      ctx!.setTransform(dpr(), 0, 0, dpr(), 0, 0);
      ctx!.clearRect(0, 0, W, H);
      draw(ctx!, disp / (frames - 1), region, now / 1000);
    }
    function loop(now: number) {
      raf = 0;
      if (!visible) return;
      const diff = target - disp;
      if (reducedMotion || Math.abs(diff) < 0.08) disp = target; else disp += diff * 0.28;
      render(now);
      const f = Math.round(disp);
      if (counter && f !== last) { counter.textContent = String(f + 1).padStart(4, '0'); last = f; }
      raf = requestAnimationFrame(loop);
    }
    function ui(p: number) {
      let idx = -1, local = 0;
      steps.forEach((st, i) => { if (p >= st.from && p < st.to) { idx = i; local = (p - st.from) / (st.to - st.from); } });
      if (p >= 1) { idx = steps.length - 1; local = 1; }
      cards.forEach((cd, i) => { cd.classList.toggle('on', i === idx); cd.classList.toggle('prev', idx >= 0 && i < idx); });
      ticks.forEach((tk) => tk.forEach((sp, j) => { sp.style.transform = `scaleX(${j < idx ? 1 : j === idx ? clamp(local) : 0})`; }));
      bar.style.width = `${p * 100}%`;
    }
    ScrollTrigger.create({
      trigger: sec, start: 'top top', end: 'bottom bottom',
      onUpdate: (st) => { target = st.progress * (frames - 1); ui(st.progress); },
      onRefresh: (st) => { measure(); target = st.progress * (frames - 1); ui(st.progress); },
    });
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) { measure(); if (!raf) raf = requestAnimationFrame(loop); }
    }).observe(sec);
    addEventListener('resize', () => { if (visible) measure(); });
    ui(0);
  });
  const scen = document.querySelector('#tpc-scen');
  scen?.querySelectorAll<HTMLButtonElement>('[data-sc]').forEach((b) => b.addEventListener('click', () => {
    setTpcScenario(b.dataset.sc as typeof tpcScenario);
    scen.querySelectorAll('[data-sc]').forEach((x) => x.classList.toggle('on', x === b));
  }));
}
