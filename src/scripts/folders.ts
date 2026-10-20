// Glass Folder Cards, ported from React to plain DOM.
// Back panel with generated art, real file sheets in between, a frosted front panel hinged at the bottom.
// Hover leans the glass, click opens and fans the files, + drops a new file in.
import { artCanvas, rng, hashString, fanSlot, type ArtPreset, type ArtRecipe } from './art';

export type FolderFile = { name: string; meta?: string; art?: ArtPreset | ArtRecipe; key?: string };
export type FolderOpts = {
  label: string;
  meta?: string;
  tone?: 'light' | 'dark';
  art?: ArtPreset | ArtRecipe | 'none';
  seed?: number;
  files?: FolderFile[];
  action?: 'add' | 'none';
  addLabel?: string;
  labelPlacement?: 'bottom-left' | 'top-left' | 'top-right';
  width?: number;
  onFileSelect?: (f: FolderFile, i: number) => void;
  onAdd?: () => void;
  onOpenChange?: (open: boolean) => void;
};
export interface Folder {
  el: HTMLDivElement;
  setFiles(files: FolderFile[], dropKey?: string): void;
  setOpen(open: boolean): void;
  setMeta(meta: string): void;
  setDown(down: boolean): void;
  bump(): void;
  setWidth(w: number): void;
}

const W = 340, H = 272, HEADROOM = 54, FRONT_TOP = 74, FRONT_H = H - FRONT_TOP, SHEET_W = 272, SHEET_H = 184, MAX_VISIBLE = 4;
const BACK_PATH = 'M0 56A22 22 0 0 1 22 34L146 34C170 34 172 0 198 0L318 0A22 22 0 0 1 340 22L340 250A22 22 0 0 1 318 272L22 272A22 22 0 0 1 0 250Z';
const FRONT_PATH = `M0 22A22 22 0 0 1 22 0L118 0C144 0 146 32 172 32L318 32A22 22 0 0 1 340 54L340 ${FRONT_H - 22}A22 22 0 0 1 318 ${FRONT_H}L22 ${FRONT_H}A22 22 0 0 1 0 ${FRONT_H - 22}Z`;
let uidN = 0;
const keyOf = (f: FolderFile) => f.key ?? f.name;

export function createFolder(o: FolderOpts): Folder {
  const uid = `gf${++uidN}`;
  let width = o.width ?? 340;
  let k = width / W;
  const density = () => Math.min(1.5, Math.max(1, devicePixelRatio || 1)) * k;
  let files = (o.files ?? []).slice();
  let open = false, entered = false;
  const shown = new Map<string, HTMLElement>();

  const root = document.createElement('div');
  root.className = 'gf-root';
  root.dataset.tone = o.tone ?? 'dark';
  root.dataset.place = o.labelPlacement ?? 'bottom-left';

  const stage = document.createElement('div');
  stage.className = 'gf-stage';
  const tilt = document.createElement('div');
  tilt.className = 'gf-tilt';
  stage.appendChild(tilt);
  root.appendChild(stage);

  tilt.insertAdjacentHTML('beforeend', `<div class="gf-shadow" aria-hidden="true"></div>`);
  const back = document.createElement('div');
  back.className = 'gf-back'; back.style.clipPath = `path('${BACK_PATH}')`; back.setAttribute('aria-hidden', 'true');
  if (o.art && o.art !== 'none') back.appendChild(artCanvas(o.art, o.seed ?? 3, W + 24, H + 24, density(), 0, 'gf-art'));
  back.insertAdjacentHTML('beforeend', '<div class="gf-back-sheen"></div>');
  tilt.appendChild(back);
  tilt.insertAdjacentHTML('beforeend', `<svg class="gf-rim gf-back-rim" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${BACK_PATH}"/></svg>`);

  const front = document.createElement('div');
  front.className = 'gf-front'; front.style.clipPath = `path('${FRONT_PATH}')`;
  front.innerHTML = `<div class="gf-tint" aria-hidden="true"></div><div class="gf-spec" aria-hidden="true"></div>
    <svg class="gf-rim gf-front-rim" viewBox="0 0 ${W} ${FRONT_H}" aria-hidden="true"><defs><linearGradient id="${uid}-rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.95"/><stop offset="0.35" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0.12"/></linearGradient></defs><path d="${FRONT_PATH}" stroke="url(#${uid}-rim)"/></svg>`;
  const hit = document.createElement('button');
  hit.type = 'button'; hit.className = 'gf-hit';
  front.appendChild(hit);
  const label = document.createElement('div');
  label.className = 'gf-label';
  label.innerHTML = `<span class="gf-title"></span><span class="gf-meta"></span>`;
  label.querySelector('.gf-title')!.textContent = o.label;
  front.appendChild(label);
  tilt.appendChild(front);

  const filesEl = document.createElement('div');
  filesEl.className = 'gf-files'; filesEl.setAttribute('role', 'list'); filesEl.setAttribute('aria-label', `${o.label} contents`);
  tilt.appendChild(filesEl);

  let keyBtn: HTMLButtonElement | null = null;
  if ((o.action ?? 'none') === 'add') {
    keyBtn = document.createElement('button');
    keyBtn.type = 'button'; keyBtn.className = 'gf-key gf-key--add';
    keyBtn.setAttribute('aria-label', o.addLabel ?? `Add a file to ${o.label}`);
    keyBtn.innerHTML = `<svg class="gf-glyph gf-glyph--plus" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5v15M4.5 12h15"/></svg>`;
    keyBtn.addEventListener('click', (e) => { e.stopPropagation(); o.onAdd?.(); });
    tilt.appendChild(keyBtn);
  }

  let metaText = o.meta ?? '';
  function setMetaLine() {
    const m = label.querySelector<HTMLElement>('.gf-meta')!;
    const t = metaText || `${files.length} ${files.length === 1 ? 'item' : 'items'}`;
    if (m.textContent === t) return;
    const fresh = m.cloneNode() as HTMLElement;
    fresh.textContent = t;
    m.replaceWith(fresh);
  }
  function aria() {
    hit.setAttribute('aria-expanded', String(open));
    hit.setAttribute('aria-label', `${open ? 'Close' : 'Open'} ${o.label}, ${files.length} ${files.length === 1 ? 'item' : 'items'}`);
    filesEl.toggleAttribute('inert', !open);
  }

  function sheet(f: FolderFile, id: string) {
    const b = document.createElement('button');
    b.type = 'button';
    const picture = !!f.art;
    b.className = 'gf-sheet' + (picture ? ' gf-sheet--art' : '');
    const jit = rng(hashString(f.name) + id.length * 7);
    b.style.setProperty('--gf-jx', `${((jit() - 0.5) * 10).toFixed(2)}px`);
    b.style.setProperty('--gf-jr', `${((jit() - 0.5) * 3.2).toFixed(2)}deg`);
    if (picture) b.appendChild(artCanvas(f.art!, hashString(f.name) % 997, SHEET_W, SHEET_H, Math.min(density(), 1.25), 1, 'gf-sheet-art'));
    else b.insertAdjacentHTML('beforeend', `<span class="gf-lines" aria-hidden="true"><i style="width:86%"></i><i style="width:92%"></i><i style="width:64%"></i><i style="width:88%"></i><i style="width:42%"></i></span>`);
    const head = document.createElement('span');
    head.className = 'gf-sheet-head';
    const nm = document.createElement('span'); nm.className = 'gf-sheet-name'; nm.textContent = f.name;
    head.appendChild(nm);
    if (f.meta) { const mt = document.createElement('span'); mt.className = 'gf-sheet-meta'; mt.textContent = f.meta; head.appendChild(mt); }
    b.appendChild(head);
    b.addEventListener('click', (e) => { e.stopPropagation(); const i = files.findIndex((x) => keyOf(x) === id); if (i >= 0) o.onFileSelect?.(files[i], i); });
    b.addEventListener('animationend', () => b.classList.remove('gf-sheet--drop'));
    return b;
  }

  function renderFiles(dropKey?: string) {
    const start = Math.max(0, files.length - MAX_VISIBLE);
    const visible = files.slice(start);
    const want = new Set(visible.map(keyOf));
    for (const [id, el] of shown) if (!want.has(id)) { el.remove(); shown.delete(id); }
    visible.forEach((f, v) => {
      const id = keyOf(f);
      let el = shown.get(id);
      if (!el) {
        el = sheet(f, id);
        shown.set(id, el);
        if (id === dropKey) el.classList.add('gf-sheet--drop');
      }
      el.style.setProperty('--gf-slot', String(fanSlot(v, visible.length)));
      el.style.setProperty('--gf-depth', String(visible.length - 1 - v));
      el.style.zIndex = String(v + 1);
      filesEl.appendChild(el);
    });
    setMetaLine();
    aria();
  }

  function setOpen(v: boolean) {
    if (v === open) return;
    open = v;
    root.toggleAttribute('data-open', open);
    aria();
    o.onOpenChange?.(open);
  }
  hit.addEventListener('click', () => setOpen(!open));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { setOpen(false); hit.focus(); } });
  document.addEventListener('pointerdown', (e) => { if (open && !root.contains(e.target as Node)) setOpen(false); });

  // light and parallax follow a real mouse, without re-rendering anything
  let raf = 0, px = 0, py = 0;
  const write = () => { raf = 0; root.style.setProperty('--gf-px', px.toFixed(3)); root.style.setProperty('--gf-py', py.toFixed(3)); };
  root.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = root.getBoundingClientRect();
    px = ((e.clientX - r.left) / r.width) * 2 - 1; py = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (!raf) raf = requestAnimationFrame(write);
  });
  root.addEventListener('pointerleave', () => { px = 0; py = 0; if (!raf) raf = requestAnimationFrame(write); });

  // assemble itself the first time it scrolls into view
  const io = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting) || entered) return;
    io.disconnect();
    setTimeout(() => { entered = true; root.setAttribute('data-entered', ''); }, Number(root.dataset.delay || 0));
  }, { threshold: 0.2 });
  requestAnimationFrame(() => io.observe(root));

  function size() {
    k = width / W;
    root.style.width = `${width}px`;
    root.style.height = `${(H + HEADROOM) * k}px`;
    stage.style.transform = `translateY(${HEADROOM * k}px) scale(${k})`;
  }
  size();
  renderFiles();

  return {
    el: root,
    setFiles(next, dropKey) { files = next.slice(); renderFiles(dropKey); },
    setOpen,
    setMeta(m) { metaText = m; setMetaLine(); },
    setDown(d) { root.classList.toggle('gf-down', d); },
    bump() {
      front.classList.remove('gf-front--bump'); void front.offsetWidth; front.classList.add('gf-front--bump');
      const g = keyBtn?.querySelector('svg');
      if (g) { g.classList.remove('gf-glyph--plus'); void (g as unknown as HTMLElement).getBoundingClientRect(); g.classList.add('gf-glyph--plus'); }
    },
    setWidth(w) { width = w; size(); },
  };
}
