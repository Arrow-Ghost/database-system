// Module map: the scroll-morph hero, rebuilt without React or framer-motion.
// Cards scatter, line up, close into a circle, then scroll bends the circle into an arc you fan through.
// Every card position runs through its own spring, so motion stays soft whatever the scroll speed does.
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { artCanvas, type ArtPreset } from './art';

type Card = { n: string; t: string; d: string; to: string; part: string; art: ArtPreset };
const CARDS: Card[] = [
  { n: '01', t: 'Distributed databases', d: 'Many sites, one logical database, and transparency.', to: 'ddb', part: 'Distributed', art: 'aurora' },
  { n: '02', t: 'Types of DDBMS', d: 'Homogeneous, heterogeneous, federated, multidatabase.', to: 'ddb-types', part: 'Distributed', art: 'glacier' },
  { n: '03', t: 'Architectures', d: 'Shared memory, disk, nothing; global and local schemas.', to: 'arch', part: 'Distributed', art: 'dusk' },
  { n: '04', t: 'Fragmentation', d: 'Horizontal, vertical, mixed. Three correctness rules.', to: 'frag', part: 'Distributed', art: 'ember' },
  { n: '05', t: 'Replication', d: 'Where each fragment lives, and how many copies.', to: 'alloc', part: 'Distributed', art: 'verdant' },
  { n: '06', t: 'Two-phase commit', d: 'Prepare, vote, commit. And why it can block.', to: 'tx', part: 'Distributed', art: 'aurora' },
  { n: '07', t: 'Concurrency control', d: 'Primary site, primary copy, voting, deadlock.', to: 'cc', part: 'Distributed', art: 'ember' },
  { n: '08', t: 'Query processing', d: 'Mapping, localization, optimization, and data transfer cost.', to: 'dqp', part: 'Distributed', art: 'glacier' },
  { n: '09', t: 'Why NoSQL', d: 'Big, fast, sparse data and the limits of one machine.', to: 'wall', part: 'Why NoSQL', art: 'dusk' },
  { n: '10', t: 'Definition', d: 'Not only SQL. An umbrella for non-relational stores.', to: 'definition', part: 'Why NoSQL', art: 'verdant' },
  { n: '11', t: 'Characteristics', d: 'Scale out, replicate, shard, no fixed schema.', to: 'traits', part: 'Characteristics', art: 'aurora' },
  { n: '12', t: 'ACID', d: 'Atomic, consistent, isolated, durable, with a bank.', to: 'acid', part: 'CAP · ACID · BASE', art: 'glacier' },
  { n: '13', t: 'CAP theorem', d: 'Consistency, availability, partition tolerance: pick two.', to: 'cap', part: 'CAP · ACID · BASE', art: 'ember' },
  { n: '14', t: 'BASE', d: 'Basically available, soft state, eventually consistent.', to: 'base', part: 'CAP · ACID · BASE', art: 'dusk' },
  { n: '15', t: 'Aggregates', d: 'The unit you read, write and distribute together.', to: 'aggregates', part: 'Modelling', art: 'verdant' },
  { n: '16', t: 'Distribution models', d: 'Sharding, master-slave and peer-to-peer.', to: 'distribution', part: 'Distribution', art: 'aurora' },
  { n: '17', t: 'MapReduce', d: 'Split, map, shuffle, reduce. Then run one.', to: 'mapreduce', part: 'Distribution', art: 'ember' },
  { n: '18', t: 'Four NoSQL types', d: 'Key-value, document, column family, graph.', to: 'families', part: 'Types', art: 'glacier' },
  { n: '19', t: 'SQL vs NoSQL', d: 'Side by side, and where the line blurs.', to: 'compare', part: 'Types', art: 'dusk' },
  { n: '20', t: 'Quiz', d: 'Twelve questions and a live leaderboard.', to: 'recap', part: 'Conclusion', art: 'verdant' },
];

type V = { x: number; y: number; r: number; s: number; o: number };
const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;

export function moduleMap(jump: (id: string) => void, reduced: boolean) {
  const stage = document.querySelector<HTMLElement>('#morph-stage');
  const pin = document.querySelector<HTMLElement>('#morph-pin');
  const sec = document.querySelector<HTMLElement>('#map');
  if (!stage || !pin || !sec) return;
  const intro = document.querySelector<HTMLElement>('#morph-intro')!;
  const head = document.querySelector<HTMLElement>('#morph-head')!;
  const N = CARDS.length;
  const els: HTMLElement[] = [];
  CARDS.forEach((cd, i) => {
    const el = document.createElement('div');
    el.className = 'mcard';
    el.setAttribute('role', 'listitem');
    const inner = document.createElement('div');
    inner.className = 'mcard-in';
    const front = document.createElement('div');
    front.className = 'mface front';
    front.appendChild(artCanvas(cd.art, 17 + i * 7, 88, 124, Math.min(2, devicePixelRatio || 1), 2, 'mart'));
    front.insertAdjacentHTML('beforeend', `<span class="mn">${cd.n}</span><span class="mt">${cd.t}</span>`);
    const back = document.createElement('div');
    back.className = 'mface back';
    back.innerHTML = `<span class="mp">${cd.part}</span><p>${cd.d}</p>`;
    const go = document.createElement('button');
    go.type = 'button'; go.textContent = 'Go →'; go.setAttribute('aria-label', `Go to ${cd.t}`);
    go.addEventListener('click', (e) => { e.stopPropagation(); jump(cd.to); });
    back.appendChild(go);
    inner.append(front, back);
    el.appendChild(inner);
    // touch: first tap flips, the Go button jumps
    front.addEventListener('click', () => { els.forEach((x) => x !== el && x.classList.remove('flip')); el.classList.toggle('flip'); });
    stage.appendChild(el);
    els.push(el);
  });

  let W = pin.clientWidth, H = pin.clientHeight;
  const ro = new ResizeObserver(() => { W = pin.clientWidth; H = pin.clientHeight; });
  ro.observe(pin);

  // random scatter, seeded so it is the same on every visit
  let seed = 9;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const scatter = CARDS.map(() => ({ x: (rnd() - 0.5) * 1500, y: (rnd() - 0.5) * 1000, r: (rnd() - 0.5) * 180, s: 0.6, o: 0 }));

  let phase: 'scatter' | 'line' | 'circle' = reduced ? 'circle' : 'scatter';
  let morph = 0, morphS = 0, rot = 0, rotS = 0, mouse = 0, mouseS = 0;
  const cur: V[] = scatter.map((p) => ({ ...p }));
  const vel: V[] = scatter.map(() => ({ x: 0, y: 0, r: 0, s: 0, o: 0 }));
  let visible = false, started = false, raf = 0, lastT = 0;

  function target(i: number): V {
    if (phase === 'scatter') return scatter[i];
    if (phase === 'line') {
      const sp = Math.min(70, (W - 40) / N);
      return { x: i * sp - (N * sp) / 2 + sp / 2, y: 0, r: 0, s: Math.min(1, sp / 90), o: 1 };
    }
    const mobile = W < 768;
    const minD = Math.min(W, H);
    const cR = Math.min(minD * 0.4, 380);
    const ca = (i / N) * 360, crad = (ca * Math.PI) / 180;
    const circle = { x: Math.cos(crad) * cR, y: Math.sin(crad) * cR, r: ca + 90 };
    const base = Math.min(W, H * 1.5);
    const aR = base * (mobile ? 1.4 : 1.1);
    const apex = H * (mobile ? 0.5 : 0.47);
    const aC = apex + aR;
    const spread = mobile ? 100 : 130;
    const start = -90 - spread / 2, step = spread / (N - 1);
    const bounded = -Math.min(Math.max(rotS, 0), 1) * spread * 0.8 + (mobile ? spread * 0.1 : spread * 0.12);
    const a = start + i * step + bounded, ar = (a * Math.PI) / 180;
    const arc = { x: Math.cos(ar) * aR + mouseS, y: Math.sin(ar) * aR + aC - H / 2, r: a + 90, s: mobile ? 1.15 : 1.45 };
    return { x: lerp(circle.x, arc.x, morphS), y: lerp(circle.y, arc.y, morphS), r: lerp(circle.r, arc.r, morphS), s: lerp(mobile ? 0.62 : 0.86, arc.s, morphS), o: 1 };
  }

  function tick(now: number) {
    raf = 0;
    if (!visible) return;
    const dt = Math.min(0.05, (now - (lastT || now)) / 1000); lastT = now;
    // springs on the scroll-driven values (stiffness 40, damping 20 like the original)
    const spring = (x: number, v: { v: number }, to: number) => { const a = 40 * (to - x) - 20 * v.v; v.v += a * dt; return x + v.v * dt; };
    morphS = spring(morphS, mv, morph); rotS = spring(rotS, rv, rot); mouseS = spring(mouseS, xv, mouse);
    const k = reduced ? 1000 : 40, d = reduced ? 60 : 15;
    els.forEach((el, i) => {
      const tg = target(i), c = cur[i], v = vel[i];
      (['x', 'y', 'r', 's', 'o'] as const).forEach((key) => {
        const acc = k * (tg[key] - c[key]) - d * v[key];
        v[key] += acc * dt; c[key] += v[key] * dt;
      });
      el.style.transform = `translate3d(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px, 0) rotate(${c.r.toFixed(2)}deg) scale(${Math.max(0.05, c.s).toFixed(3)})`;
      el.style.opacity = String(Math.max(0, Math.min(1, c.o)));
    });
    // copy: intro text while the circle stands, heading when the arc forms
    intro.classList.toggle('on', phase === 'circle' && morphS < 0.5);
    (intro.querySelector('.morph-l1') as HTMLElement).style.opacity = phase === 'circle' ? String(Math.max(0, 1 - morphS * 2)) : '';
    const hk = Math.max(0, Math.min(1, (morphS - 0.75) / 0.25));
    head.style.opacity = String(hk);
    head.style.transform = `translateY(${(1 - hk) * 20}px)`;
    raf = requestAnimationFrame(tick);
  }
  const mv = { v: 0 }, rv = { v: 0 }, xv = { v: 0 };

  function begin() {
    if (started) return;
    started = true;
    if (reduced) { phase = 'circle'; return; }
    setTimeout(() => (phase = 'line'), 350);
    setTimeout(() => (phase = 'circle'), 2100);
  }
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) { begin(); lastT = 0; if (!raf) raf = requestAnimationFrame(tick); }
  }, { threshold: 0.05 }).observe(pin);
  ScrollTrigger.create({
    trigger: sec, start: 'top top', end: 'bottom bottom',
    onUpdate: (st) => {
      const p = st.progress;
      morph = Math.min(1, p / 0.28);
      rot = Math.max(0, Math.min(1, (p - 0.3) / 0.62));
      if (p > 0.02 && phase !== 'circle') phase = 'circle';
    },
  });
  pin.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = pin.getBoundingClientRect();
    mouse = (((e.clientX - r.left) / r.width) * 2 - 1) * 70;
  });
  pin.addEventListener('pointerleave', () => (mouse = 0));
  document.addEventListener('pointerdown', (e) => { if (!stage.contains(e.target as Node)) els.forEach((x) => x.classList.remove('flip')); });
}
