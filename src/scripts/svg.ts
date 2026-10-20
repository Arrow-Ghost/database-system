// Tiny helpers shared by the SVG diagrams: element creation, packets that fly between points.
export const NS = 'http://www.w3.org/2000/svg';
export const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T;
export const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll(s)) as T[];
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element, text?: string): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

export type Pt = [number, number];
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Fly a glowing packet (with an optional label) from a to b along a gentle arc. Resolves on arrival. */
export function packet(svg: SVGSVGElement, a: Pt, b: Pt, opts: { cls?: string; label?: string; dur?: number; r?: number; arc?: number } = {}): Promise<void> {
  const dur = reduced() ? 1 : opts.dur ?? 700;
  const g = el('g', { class: 'pkt-g' }, svg);
  const c = el('circle', { r: opts.r ?? 6, class: `sv-pkt ${opts.cls ?? ''}` }, g);
  c.setAttribute('filter', 'drop-shadow(0 0 6px currentColor)');
  const t = opts.label ? el('text', { class: 'sv-lbl', 'text-anchor': 'middle', fill: '#ece7da' }, g, opts.label) : null;
  if (t) t.style.fill = '#ece7da';
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  const arc = opts.arc ?? 0.12;
  const cx = mx - (dy / len) * len * arc, cy = my + (dx / len) * len * arc;
  return new Promise((res) => {
    const t0 = performance.now();
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / dur), e = ease(p);
      const x = (1 - e) * (1 - e) * a[0] + 2 * (1 - e) * e * cx + e * e * b[0];
      const y = (1 - e) * (1 - e) * a[1] + 2 * (1 - e) * e * cy + e * e * b[1];
      c.setAttribute('cx', x.toFixed(1)); c.setAttribute('cy', y.toFixed(1));
      if (t) { t.setAttribute('x', x.toFixed(1)); t.setAttribute('y', (y - 12).toFixed(1)); }
      if (p < 1) requestAnimationFrame(step);
      else { g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250 }).onfinish = () => g.remove(); res(); }
    };
    step();
  });
}

/** Draw a database cylinder. */
export function cylinder(parent: Element, x: number, y: number, w: number, h: number, cls = ''): SVGGElement {
  const g = el('g', { class: `cyl ${cls}` }, parent);
  const ry = w * 0.16;
  el('path', { d: `M${x} ${y + ry} L${x} ${y + h - ry} A${w / 2} ${ry} 0 0 0 ${x + w} ${y + h - ry} L${x + w} ${y + ry}`, class: 'cyl-body' }, g);
  el('ellipse', { cx: x + w / 2, cy: y + ry, rx: w / 2, ry, class: 'cyl-top' }, g);
  return g;
}

export const fmtBytes = (n: number) => n.toLocaleString('en-US');
export function countTo(node: HTMLElement, from: number, to: number, dur = 600, fmt: (n: number) => string = fmtBytes) {
  if (reduced()) { node.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = () => {
    const p = Math.min(1, (performance.now() - t0) / dur);
    node.textContent = fmt(Math.round(from + (to - from) * ease(p)));
    if (p < 1) requestAnimationFrame(step);
  };
  step();
}
