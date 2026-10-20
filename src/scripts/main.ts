import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { createWorld, type ShapeName, type World } from './world';
import type { Machine } from './machine';
import * as W from './widgets';
import * as D from './dd';
import * as X from './nosql';
import { moduleMap } from './morph';
import { frameStages } from './frames';
import { navigation } from './nav';

gsap.registerPlugin(ScrollTrigger, SplitText);

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = () => innerWidth <= 960;
const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector(s) as T;
const $$ = <T extends Element = HTMLElement>(s: string) => Array.from(document.querySelectorAll(s)) as T[];

/* ---------- smooth scroll ---------- */
let lenis: Lenis | null = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis!.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
  (window as any).__lenis = lenis;
}
const scrollTo = (target: number | HTMLElement) => {
  if (lenis) lenis.scrollTo(target, { duration: 2.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else if (typeof target === 'number') scrollTo2(target); else target.scrollIntoView();
};
function scrollTo2(y: number) { window.scrollTo(0, y); }

/* ---------- world ---------- */
let world: World | null = null;
const anchors = $$<HTMLElement>('[data-scene]');
function updateWorld() {
  if (!world || !anchors.length) return;
  const vh = innerHeight, T = vh * 0.45;
  let c = 0;
  const tops = anchors.map((a) => a.getBoundingClientRect().top);
  for (let i = 0; i < tops.length; i++) if (tops[i] <= T) c = i;
  const nx = Math.min(c + 1, anchors.length - 1);
  const t = nx === c ? 0 : Math.min(1, Math.max(0, (vh - tops[nx]) / (vh - T)));
  world.setBlend(anchors[c].dataset.scene as ShapeName, anchors[nx].dataset.scene as ShapeName, t);
}
addEventListener('pointermove', (e) => world?.setMouse((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), { passive: true });
document.addEventListener('pointerleave', () => world?.setMouse(9, 9));

/* ---------- HUD + navigation ---------- */
const jumpTo = (target: HTMLElement) => scrollTo(target.getBoundingClientRect().top + scrollY + 2);
const jumpId = (id: string) => { const t = document.getElementById(id); if (t) jumpTo(t); };
const updateNav = navigation(jumpTo);
function updateHud() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const p = max > 0 ? scrollY / max : 0;
  $('#hud-progress').style.transform = `scaleX(${p})`;
  $('#hud-pct').textContent = `${String(Math.round(p * 100)).padStart(3, '0')}%`;
  updateNav();
}
$$<HTMLElement>('[data-jump]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); jumpId('top'); }));

gsap.ticker.add(() => { updateWorld(); updateHud(); });

/* ---------- widgets ---------- */
W.phone();
W.relational();
const setTraffic = W.scaleLab();
W.joinExplorer();
W.schema();
W.kvConsole();
W.docFilter();
W.columnStore();
W.graph();
W.consistencyLab();
W.compareAndFlips();
W.chooser();
W.polyglot();
W.quiz();
W.devCode();
D.ddbIntro();
D.ddbTypes();
D.architectures();
D.fragmentation();
D.allocation();
D.concurrency();
D.costLab();
X.sparse();
X.partitionLab();
X.acidLab();
X.capLab();
X.convergence();
X.aggregates();
X.modelling();
X.distribution();
X.mrLab();
X.archive();
moduleMap(jumpId, reduced);

/* ---------- reveals ---------- */
function splitReveal(el: HTMLElement, opts: { start?: string; delay?: number } = {}) {
  SplitText.create(el, {
    type: 'lines,words', mask: 'lines', autoSplit: true,
    onSplit(self) {
      return gsap.from(self.lines, {
        yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.08, delay: opts.delay ?? 0,
        scrollTrigger: { trigger: el, start: opts.start ?? 'top 85%', once: true },
      });
    },
  });
}

function setupMotion() {
  if (reduced) return;
  // headings
  $$<HTMLElement>('main [data-split]').forEach((el) => { if (!el.closest('.hero')) splitReveal(el); });
  $$<HTMLElement>('.eyebrow').forEach((el) => gsap.from(el, { opacity: 0, x: -24, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } }));
  $$<HTMLElement>('.vcard, .rel-tables, .schema-grid > .panel, .lab-grid > .panel, .flip, .deploy a, .rrow, .quiz, .lb, .def-facts > div, .mini-cards > div, .trait, .tier, .storm-row > div, .emerge-list > div, .alloc-explain > div, .cap-defs > div, .cap-notes > div, .base-word > div, .tech-row > div, .scale-pan, .when > div, .cc-problems li, .ab2 > div, .ddb-net, .ddbt-stage, .arch-grid > .panel, .frag-side, .cc-grid > .panel, .cost-stage, .acid-panel, .cap-tri, .cap-sim, .agg-grid > .panel, .mod-docs, .dist-stage, .mr-col, .archive-info, .pl-node, .def-quote, .summary-quote').forEach((el, i) =>
    gsap.from(el, { opacity: 0, y: 50, duration: 1.1, ease: 'expo.out', delay: (i % 3) * 0.08, scrollTrigger: { trigger: el, start: 'top 92%', once: true } }));

  // phone climbs over the headline
  const ph = gsap.timeline({ scrollTrigger: { trigger: '#tap', start: 'top top', end: 'bottom bottom', scrub: 0.6 } });
  ph.fromTo('#phone', { rotateX: 24, yPercent: 0, scale: 0.92 }, { rotateX: 0, yPercent: -38, scale: 1, ease: 'none' }, 0)
    .fromTo('.phone-title', { y: 0 }, { y: -40, ease: 'none' }, 0)
    .fromTo('.qlog, .phone-hint', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.25 }, 0.15)
    .to('.phone-title', { opacity: 0.25, duration: 0.3 }, 0.7);

  // definition word morph (pinned)
  const caps = ['The name first read as a refusal.', '“No SQL” was the slogan in 2009…', '…but it means not only SQL.'];
  const def = gsap.timeline({ scrollTrigger: { trigger: '#def-pin', start: 'top top', end: '+=160%', pin: true, scrub: 0.8,
    onUpdate: (s) => { $('#def-cap').textContent = caps[Math.min(2, Math.floor(s.progress * 3))]; } } });
  gsap.set(['.def-word .w2', '.def-word .w3'], { opacity: 0 });
  def.to('.def-word .w1', { opacity: 0, scale: 0.86, filter: 'blur(14px)', duration: 1 }, 0.4)
    .fromTo('.def-word .w2', { opacity: 0, scale: 1.12, filter: 'blur(14px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1 }, 0.6)
    .to('.def-word .w2', { opacity: 0, y: -60, filter: 'blur(10px)', duration: 1 }, 2)
    .fromTo('.def-word .w3', { opacity: 0, y: 60, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1 }, 2.2)
    .to({}, { duration: 0.6 });

  // definition paragraph lights up word by word
  SplitText.create('#def-para', {
    type: 'words', wordsClass: 'word', autoSplit: true,
    onSplit(self) {
      return gsap.to(self.words, { opacity: 1, stagger: 0.04, ease: 'none', scrollTrigger: { trigger: '#def-para', start: 'top 80%', end: 'bottom 45%', scrub: true } });
    },
  });

  // horizontal timeline
  const track = $('#tl-track');
  const dist = () => Math.max(0, track.scrollWidth - innerWidth);
  const tlTween = gsap.to(track, {
    x: () => -dist(), ease: 'none',
    scrollTrigger: { trigger: '#origins', start: 'top top', end: 'bottom bottom', scrub: 0.5, invalidateOnRefresh: true,
      onUpdate: (s) => world?.setPan((s.progress - 0.5) * 34) },
  });
  gsap.to('#tl-line', { width: '100%', ease: 'none', scrollTrigger: { trigger: '#origins', start: 'top top', end: 'bottom bottom', scrub: 0.5 } });
  $$<HTMLElement>('.tl-item').forEach((item) => {
    const card = item.querySelector('.card')!;
    gsap.timeline({ scrollTrigger: { trigger: item, containerAnimation: tlTween, start: 'left 85%', end: 'left 45%', scrub: true } })
      .to(item.querySelector('.stem'), { scaleY: 1, ease: 'none' })
      .to(item.querySelector('.dot'), { scale: 1, ease: 'back.out(3)' }, 0)
      .from(card.children, { yPercent: 40, opacity: 0, stagger: 0.15 }, 0.1);
  });
  ScrollTrigger.create({ trigger: '#origins', start: 'top bottom', end: 'bottom top', onLeave: () => world?.setPan(0), onLeaveBack: () => world?.setPan(0) });

  // scale lab: scroll raises the traffic
  ScrollTrigger.create({ trigger: '#scale', start: 'top top', end: 'bottom bottom', onUpdate: (s) => setTraffic(s.progress * 1.05) });

  // container scroll card
  const mob = narrow();
  gsap.timeline({ scrollTrigger: { trigger: '#cs-wrap', start: 'top bottom', end: 'center center', scrub: 0.6 } })
    .fromTo('#cs-card', { rotateX: 20, scale: mob ? 0.8 : 1.05 }, { rotateX: 0, scale: mob ? 0.95 : 1, ease: 'none' }, 0)
    .fromTo('#cs-title', { y: 0 }, { y: -60, ease: 'none' }, 0);

  // advantages: cards stack. On phones the covered card only shrinks a little: darkening or fading it
  // made the text unreadable while the next card slid up. Opaque card backgrounds keep it clean.
  const phone = innerWidth <= 760;
  if (!mob || phone) {
    const cards = $$<HTMLElement>('.scard');
    const away = phone ? { scale: 0.95 } : { scale: 0.9, opacity: 0.35, filter: 'blur(2px)' };
    cards.forEach((c, i) => {
      const nxt = cards[i + 1];
      if (!nxt) return;
      gsap.to(c, { ...away, ease: 'none', scrollTrigger: { trigger: nxt, start: 'top bottom', end: phone ? 'top 8%' : 'top 14%', scrub: true } });
    });
  }

  // part marquees drift with scroll and lean with scroll speed
  $$<HTMLElement>('.marq').forEach((mq) => {
    const inner = mq.querySelector<HTMLElement>('.marq-in')!;
    const dir = Number(mq.dataset.dir || 1);
    gsap.fromTo(inner, { xPercent: dir > 0 ? 0 : -30 }, { xPercent: dir > 0 ? -30 : 0, ease: 'none', scrollTrigger: { trigger: mq, start: 'top bottom', end: 'bottom top', scrub: 0.4 } });
  });
  const skewTo = gsap.quickTo('.marq-in', 'skewX', { duration: 0.5, ease: 'power3' });
  lenis?.on('scroll', (l: Lenis) => skewTo(Math.max(-8, Math.min(8, l.velocity * -0.25))));

  // finale
  splitReveal($('.fin-title'), { start: 'top 75%' });
}

/* ---------- step-driven chapters (also on reduced motion) ---------- */
function setupSteps() {
  frameStages(reduced);
  // families
  const steps = $$<HTMLElement>('.fam-step'), demos = $$<HTMLElement>('.fam-demo'), bars = $$<HTMLElement>('#fam-progress i');
  let famStep = 0;
  const setFam = (i: number) => {
    if (i === famStep || narrow()) return;
    const prev = famStep;
    famStep = i;
    steps.forEach((s, k) => s.classList.toggle('on', k === i));
    demos.forEach((d, k) => d.classList.toggle('on', k === i));
    bars.forEach((b, k) => b.classList.toggle('on', k <= i));
    if (!reduced) {
      const dir = i > prev ? 1 : -1;
      gsap.fromTo(steps[i].children, { y: 40 * dir, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.06, duration: 0.8, ease: 'expo.out' });
      gsap.fromTo(demos[i], { y: 30 * dir, opacity: 0, rotateX: -6 * dir }, { y: 0, opacity: 1, rotateX: 0, duration: 0.9, ease: 'expo.out' });
    }
  };
  ScrollTrigger.create({ trigger: '#families', start: 'top top', end: 'bottom bottom', onUpdate: (s) => setFam(Math.min(3, Math.floor(s.progress * 4))) });

  // applications list highlight
  $$<HTMLElement>('.use').forEach((u) => ScrollTrigger.create({ trigger: u, start: 'top 62%', end: 'bottom 38%', toggleClass: 'on' }));

  // machine: build lazily, drive camera steps, pause the background world while it covers the screen
  let machine: Machine | null = null, loading = false;
  const msteps = $$<HTMLElement>('.mach-step');
  ScrollTrigger.create({
    trigger: '#cluster', start: 'top 250%', end: 'bottom -150%',
    onToggle: async (s) => {
      if (s.isActive && !machine && !loading) {
        loading = true;
        const mod = await import('./machine');
        machine = mod.createMachine($('#mach-sticky'));
        machine?.setActive(true);
        machine?.setStep(0);
        ScrollTrigger.refresh();
      }
      machine?.setActive(s.isActive);
    },
  });
  ScrollTrigger.create({
    trigger: '#cluster', start: 'top top', end: 'bottom bottom',
    onToggle: (s) => world?.setActive(!s.isActive),
    onUpdate: (s) => {
      const i = Math.min(2, Math.floor(s.progress * 3));
      msteps.forEach((m, k) => m.classList.toggle('on', k === i));
      machine?.setStep(i);
    },
    onEnter: () => machine?.setStep(0),
  });
  addEventListener('resize', () => { world?.resize(); machine?.resize(); });
}

/* ---------- intro ---------- */
async function intro() {
  const bootP = W.boot(reduced);
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
  world = createWorld($<HTMLCanvasElement>('#world'), reduced);
  await bootP;
  setupMotion();
  setupSteps();
  ScrollTrigger.refresh();
  const bootEl = $('#boot');
  if (bootEl) {
    gsap.to(bootEl, { yPercent: -100, duration: 1.1, ease: 'expo.inOut', onComplete: () => bootEl.remove() });
  }
  if (!reduced) {
    const tl = gsap.timeline({ delay: 0.35 });
    $$<HTMLElement>('.hero [data-split]').forEach((el, i) => {
      const st = SplitText.create(el, { type: 'chars', mask: 'chars' });
      tl.from(st.chars, { yPercent: 115, duration: 1.3, ease: 'expo.out', stagger: 0.035 }, i * 0.18);
    });
    tl.from('.hero .eyebrow, .hero-lede, .hero-team > div, .scroll-cue', { opacity: 0, y: 30, duration: 1, ease: 'expo.out', stagger: 0.06 }, 0.5);
  }
  lenis?.start();
}
intro();
