// Part 01 widgets: distributed database intro, types, architectures, fragmentation,
// replication and allocation, concurrency control, deadlock and the transfer-cost lab.
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { $, $$, el, packet, sleep, esc, cylinder, countTo, fmtBytes, type Pt } from './svg';
import { createFolder, type Folder, type FolderFile } from './folders';
import type { ArtPreset } from './art';

gsap.registerPlugin(Flip);

/* =========================================================== intro: bank branches */
export function ddbIntro() {
  const svg = $<SVGSVGElement>('#ddb-svg');
  if (!svg) return;
  type Site = { id: string; name: string; at: Pt; frag: string; sum: number; node?: SVGGElement; sub?: SVGTextElement };
  const sites: Site[] = [
    { id: 'chn', name: 'Chennai', at: [92, 70], frag: 'account_chn', sum: 3.1 },
    { id: 'mum', name: 'Mumbai', at: [92, 262], frag: 'account_mum', sum: 4.4 },
    { id: 'del', name: 'Delhi', at: [468, 70], frag: 'account_del', sum: 2.9 },
    { id: 'kol', name: 'Kolkata', at: [468, 262], frag: 'account_kol', sum: 2.2 },
  ];
  const hub: Pt = [280, 166];
  const wires: Record<string, SVGPathElement> = {};
  sites.forEach((s) => { wires[s.id] = el('path', { d: `M${hub[0]} ${hub[1]} L${s.at[0]} ${s.at[1]}`, class: 'sv-wire' }, svg); });
  const hubG = el('g', { class: 'sv-node hot' }, svg);
  el('circle', { cx: hub[0], cy: hub[1], r: 52 }, hubG);
  el('text', { x: hub[0], y: hub[1] - 4, 'text-anchor': 'middle' }, hubG, 'DDBMS');
  el('text', { x: hub[0], y: hub[1] + 13, 'text-anchor': 'middle', class: 'sub' }, hubG, 'catalog');
  sites.forEach((s) => {
    const g = el('g', { class: 'sv-node' }, svg);
    el('rect', { x: s.at[0] - 78, y: s.at[1] - 30, width: 156, height: 60, rx: 4 }, g);
    el('text', { x: s.at[0], y: s.at[1] - 6, 'text-anchor': 'middle' }, g, s.name);
    s.sub = el('text', { x: s.at[0], y: s.at[1] + 13, 'text-anchor': 'middle', class: 'sub' }, g, s.frag.toUpperCase());
    s.node = g;
  });
  let q: 'local' | 'all' | 'move' = 'local', transparent = true, mumDown = false, replica = false, busy = false;
  const S = (id: string) => sites.find((s) => s.id === id)!;
  const sqlEl = $('#ddb-sql');
  function text() {
    const kw = (s: string) => `<span class="kw">${s}</span>`;
    if (q === 'local') return transparent
      ? `${kw('SELECT')} balance ${kw('FROM')} account ${kw('WHERE')} acc_no = <span class="str">'A-102'</span>;\n<span class="dim">-- the DDBMS finds A-102 in the Chennai fragment by itself</span>`
      : `${kw('SELECT')} balance ${kw('FROM')} account_chn@chennai ${kw('WHERE')} acc_no = <span class="str">'A-102'</span>;\n<span class="err">-- you must know the site and the local table name</span>`;
    if (q === 'all') return transparent
      ? `${kw('SELECT SUM')}(balance) ${kw('FROM')} account;\n<span class="dim">-- one logical table, four physical fragments</span>`
      : `${kw('SELECT SUM')}(s) ${kw('FROM')} (\n  ${kw('SELECT SUM')}(balance) s ${kw('FROM')} account_chn@chennai ${kw('UNION ALL')}\n  ${kw('SELECT SUM')}(balance) s ${kw('FROM')} account_mum@mumbai ${kw('UNION ALL')}\n  ${kw('SELECT SUM')}(balance) s ${kw('FROM')} account_del@delhi ${kw('UNION ALL')}\n  ${kw('SELECT SUM')}(balance) s ${kw('FROM')} account_kol@kolkata);`;
    return transparent
      ? `${kw('BEGIN')};\n${kw('UPDATE')} account ${kw('SET')} balance = balance - <span class="num">500</span> ${kw('WHERE')} acc_no = <span class="str">'A-102'</span>;\n${kw('UPDATE')} account ${kw('SET')} balance = balance + <span class="num">500</span> ${kw('WHERE')} acc_no = <span class="str">'D-310'</span>;\n${kw('COMMIT')};  <span class="dim">-- the DDBMS runs two-phase commit for you</span>`
      : `${kw('UPDATE')} account_chn@chennai ... ;  ${kw('UPDATE')} account_del@delhi ... ;\n<span class="err">-- and you must make both commit or both roll back yourself</span>`;
  }
  function paint() {
    sqlEl.innerHTML = text();
    $('#ddb-tag').textContent = transparent ? 'Transparent' : 'No transparency';
    const mum = S('mum');
    mum.node!.setAttribute('class', 'sv-node' + (mumDown ? ' dead' : ''));
    wires.mum.setAttribute('class', 'sv-wire' + (mumDown ? ' dead' : ''));
    S('del').sub!.textContent = replica ? 'ACCOUNT_DEL + MUM copy' : 'ACCOUNT_DEL';
    $('#ddb-fail').textContent = mumDown ? 'Bring Mumbai back' : 'Take Mumbai offline';
    const rb = $('#ddb-rep'); rb.textContent = `Replicate Mumbai at Delhi: ${replica ? 'on' : 'off'}`; rb.setAttribute('aria-pressed', String(replica)); rb.classList.toggle('on', replica);
    const tb = $('#ddb-transp'); tb.textContent = `Transparency: ${transparent ? 'on' : 'off'}`; tb.setAttribute('aria-pressed', String(transparent));
  }
  function stats(s: number, m: number, o: string, cls = '') {
    $('#ddb-s').textContent = String(s); $('#ddb-m').textContent = String(m);
    const ob = $('#ddb-o'); ob.textContent = o; ob.className = cls;
  }
  async function run() {
    if (busy) return; busy = true;
    paint();
    sites.forEach((s) => s.node!.classList.remove('hot', 'ok'));
    const lit = (s: Site, cls: string) => s.node!.classList.add(cls);
    if (q === 'local') {
      stats(0, 0, '…');
      await packet(svg, hub, S('chn').at, { label: 'A-102?' }); lit(S('chn'), 'hot');
      await packet(svg, S('chn').at, hub, { cls: 'ok', label: '₹18,400' });
      stats(1, 2, 'Answered', 'good');
    } else if (q === 'all') {
      stats(0, 0, '…');
      const targets = sites.filter((s) => !(s.id === 'mum' && mumDown));
      await Promise.all(targets.map((s) => packet(svg, hub, s.at, { label: 'SUM' }).then(() => lit(s, 'hot'))));
      let msgs = targets.length;
      if (mumDown && !replica) {
        await Promise.all(targets.map((s) => packet(svg, s.at, hub, { cls: 'ok', label: `${s.sum}` })));
        msgs += targets.length;
        stats(targets.length, msgs, 'Incomplete', 'bad');
        sqlEl.innerHTML += `\n<span class="err">ERROR: fragment ACCOUNT_MUM is unreachable. A partial sum would be wrong, so no answer.</span>`;
      } else {
        const back = targets.map((s) => {
          const extra = mumDown && s.id === 'del' ? ` + ${S('mum').sum}` : '';
          return packet(svg, s.at, hub, { cls: 'ok', label: `${s.sum}${extra}` });
        });
        await Promise.all(back);
        msgs += targets.length;
        stats(targets.length, msgs, '₹12.6 Cr', 'good');
        if (mumDown) sqlEl.innerHTML += `\n<span class="ok">-- Mumbai is down, but Delhi holds a replica of its fragment. Still a full answer.</span>`;
      }
    } else {
      stats(0, 0, '…');
      const a = S('chn'), b = S('del');
      await Promise.all([packet(svg, hub, a.at, { label: '−500' }), packet(svg, hub, b.at, { label: '+500' })]);
      lit(a, 'hot'); lit(b, 'hot');
      await Promise.all([packet(svg, hub, a.at, { label: 'prepare', cls: 'ice' }), packet(svg, hub, b.at, { label: 'prepare', cls: 'ice' })]);
      await Promise.all([packet(svg, a.at, hub, { label: 'yes', cls: 'ok' }), packet(svg, b.at, hub, { label: 'yes', cls: 'ok' })]);
      await Promise.all([packet(svg, hub, a.at, { label: 'commit', cls: 'ok' }), packet(svg, hub, b.at, { label: 'commit', cls: 'ok' })]);
      lit(a, 'ok'); lit(b, 'ok');
      stats(2, 8, 'Committed', 'good');
    }
    busy = false;
  }
  $$<HTMLButtonElement>('#ddb-q [data-q]').forEach((b) => b.addEventListener('click', () => {
    q = b.dataset.q as typeof q;
    $$('#ddb-q [data-q]').forEach((x) => x.classList.toggle('on', x === b));
    run();
  }));
  $('#ddb-transp').addEventListener('click', () => { transparent = !transparent; paint(); });
  $('#ddb-fail').addEventListener('click', () => { mumDown = !mumDown; paint(); if (q === 'all') run(); });
  $('#ddb-rep').addEventListener('click', () => { replica = !replica; paint(); if (q === 'all') run(); });
  paint();
  stats(0, 0, '—');
  let started = false;
  new IntersectionObserver(([e]) => { if (e.isIntersecting && !started) { started = true; run(); } }, { threshold: 0.4 }).observe(svg);
}

/* =========================================================== types of DDBMS */
export function ddbTypes() {
  const svg = $<SVGSVGElement>('#ddbt-svg');
  if (!svg) return;
  const info: Record<string, { k: string; d: number; h: number; a: number; p: string }> = {
    central: { k: 'Centralized DBMS', d: 0.05, h: 0.05, a: 0.05, p: 'One DBMS at one site holds the whole database. Every user connects to it. It is the baseline the other three are compared against.' },
    pure: { k: 'Pure distributed DBMS', d: 1, h: 0.08, a: 0.12, p: '<strong>Homogeneous</strong>: every site runs the same DBMS software. The sites are tightly integrated under one global schema and a site cannot work as a standalone DBMS, so there is little or no <strong>local autonomy</strong>.' },
    fed: { k: 'Federated DBMS (FDBS)', d: 1, h: 0.85, a: 0.65, p: 'Each server is an <strong>independent, autonomous</strong> centralized DBMS with its own local users, transactions and administrator. A <strong>federated schema</strong>, a global view of the federation, is shared by applications. Sites are often <strong>heterogeneous</strong>.' },
    multi: { k: 'Multidatabase system', d: 1, h: 0.9, a: 1, p: '<strong>Full local autonomy</strong> and no permanent global schema. When an application needs data from several databases, it builds the global view it needs, interactively, at that moment.' },
  };
  const engines = { same: ['DBMS X', 'DBMS X', 'DBMS X'], mixed: ['Oracle', 'MySQL', 'MongoDB'] };
  function draw(k: string) {
    svg.innerHTML = '';
    const user = (x: number, y: number, cls = '') => {
      const g = el('g', { class: `sv-user ${cls}` }, svg);
      el('circle', { cx: x, cy: y - 7, r: 5, fill: 'none', stroke: '#8f969e', 'stroke-width': 1.4 }, g);
      el('path', { d: `M${x - 8} ${y + 8} Q${x} ${y - 3} ${x + 8} ${y + 8}`, fill: 'none', stroke: '#8f969e', 'stroke-width': 1.4 }, g);
      return g;
    };
    if (k === 'central') {
      cylinder(svg, 222, 80, 76, 96, 'hot');
      el('text', { x: 260, y: 200, 'text-anchor': 'middle', class: 'sv-lbl' }, svg, 'one site · one DBMS');
      for (let i = 0; i < 8; i++) {
        const a = ((i + 0.5) / 8) * Math.PI * 2, x = 260 + Math.cos(a) * 160, y = 128 + Math.sin(a) * 92;
        el('path', { d: `M${x} ${y} L${260 + Math.cos(a) * 52} ${128 + Math.sin(a) * 50}`, class: 'sv-wire' }, svg);
        user(x, y);
      }
      return;
    }
    const xs = [90, 260, 430];
    const names = k === 'pure' ? engines.same : engines.mixed;
    const globalBar = k === 'pure' || k === 'fed';
    if (globalBar) {
      const g = el('g', { class: 'sv-node hot' }, svg);
      el('rect', { x: 40, y: 18, width: 440, height: 34, rx: 3 }, g);
      el('text', { x: 260, y: 40, 'text-anchor': 'middle' }, g, k === 'pure' ? 'Global schema · tightly integrated' : 'Federated schema · shared global view');
    } else {
      const g = el('g', { class: 'sv-node' }, svg);
      el('rect', { x: 140, y: 18, width: 240, height: 34, rx: 3, 'stroke-dasharray': '5 5' }, g);
      el('text', { x: 260, y: 40, 'text-anchor': 'middle', class: 'sub' }, g, 'global view built per query');
    }
    xs.forEach((x, i) => {
      el('path', { d: `M${x} 52 L${x} 104`, class: globalBar ? 'sv-wire hot' : 'sv-wire', 'stroke-dasharray': globalBar ? '' : '4 5' }, svg);
      cylinder(svg, x - 34, 104, 68, 80, k === 'pure' ? 'hot' : ['hot', 'cold', 'ok'][i]);
      el('text', { x, y: 204, 'text-anchor': 'middle', class: 'sv-lbl' }, svg, names[i]);
      if (k !== 'pure') { user(x - 50, 228); user(x - 30, 236); el('text', { x: x + 4, y: 236, class: 'sv-lbl' }, svg, 'local users'); }
    });
    if (k === 'pure') el('text', { x: 260, y: 236, 'text-anchor': 'middle', class: 'sv-lbl' }, svg, 'no local users · sites cannot run standalone');
    el('path', { d: 'M124 140 L226 140 M294 140 L396 140', class: 'sv-wire', 'stroke-dasharray': '2 6' }, svg);
  }
  function pick(k: string) {
    const i = info[k];
    $$('.ddbt-tab').forEach((t) => { const on = t.dataset.k === k; t.classList.toggle('on', on); t.setAttribute('aria-selected', String(on)); });
    $('#ddbt-k').textContent = i.k;
    $('#ddbt-p').innerHTML = i.p;
    $('#ax-d').style.width = `${i.d * 100}%`; $('#ax-h').style.width = `${i.h * 100}%`; $('#ax-a').style.width = `${i.a * 100}%`;
    draw(k);
    gsap.from(svg.children, { opacity: 0, y: 14, stagger: 0.02, duration: 0.6, ease: 'expo.out' });
  }
  $$('.ddbt-tab').forEach((t) => t.addEventListener('click', () => pick(t.dataset.k!)));
  pick('central');
}

/* =========================================================== architectures */
export function architectures() {
  const svg = $<SVGSVGElement>('#par-svg');
  if (!svg) return;
  const txt: Record<string, string> = {
    mem: '<strong>Shared memory</strong> (tightly coupled): several processors share both the primary memory and the disks. Simple to program, but the shared memory bus becomes the bottleneck as processors are added.',
    disk: '<strong>Shared disk</strong> (loosely coupled): every processor has its own memory, but all of them share the disks. Any processor can reach any data, while memory traffic stays local.',
    none: '<strong>Shared nothing</strong>: every processor has its own memory and its own disk, and nodes talk only over a fast interconnect. It scales best, and it is the architecture closest to a distributed database. The difference: here the nodes are identical and side by side.',
  };
  function draw(a: string) {
    svg.innerHTML = '';
    const xs = [70, 190, 310, 430];
    const box = (x: number, y: number, w: number, h: number, label: string, cls = '') => {
      const g = el('g', { class: `sv-node ${cls}` }, svg);
      el('rect', { x: x - w / 2, y, width: w, height: h, rx: 3 }, g);
      el('text', { x, y: y + h / 2 + 4, 'text-anchor': 'middle' }, g, label);
    };
    const flow = (d: string) => el('path', { d, class: 'sv-flow' }, svg);
    if (a === 'mem') {
      xs.forEach((x, i) => { box(x, 20, 70, 36, `P${i + 1}`, 'hot'); el('path', { d: `M${x} 56 L${x} 96`, class: 'sv-wire' }, svg); flow(`M${x} 56 L${x} 96`); });
      box(250, 96, 430, 38, 'Shared memory', 'cold');
      el('path', { d: 'M250 134 L250 168', class: 'sv-wire' }, svg); flow('M250 134 L250 168');
      box(250, 168, 300, 22, 'Interconnect');
      [130, 250, 370].forEach((x) => { el('path', { d: `M${x} 190 L${x} 212`, class: 'sv-wire' }, svg); cylinder(svg, x - 22, 212, 44, 40, 'ok'); });
    } else if (a === 'disk') {
      xs.forEach((x, i) => { box(x, 16, 70, 34, `P${i + 1}`, 'hot'); box(x, 60, 70, 30, `M${i + 1}`, 'cold'); el('path', { d: `M${x} 90 L${x} 130`, class: 'sv-wire' }, svg); flow(`M${x} 90 L${x} 130`); });
      box(250, 130, 430, 26, 'Interconnect');
      [130, 250, 370].forEach((x) => { el('path', { d: `M${x} 156 L${x} 196`, class: 'sv-wire' }, svg); flow(`M${x} 156 L${x} 196`); cylinder(svg, x - 22, 196, 44, 44, 'ok'); });
      el('text', { x: 250, y: 256, 'text-anchor': 'middle', class: 'sv-lbl' }, svg, 'shared disks');
    } else {
      xs.forEach((x, i) => { box(x, 16, 70, 34, `P${i + 1}`, 'hot'); box(x, 58, 70, 28, `M${i + 1}`, 'cold'); cylinder(svg, x - 22, 94, 44, 44, 'ok'); el('path', { d: `M${x} 138 L${x} 190`, class: 'sv-wire' }, svg); flow(`M${x} 190 L${x} 138`); });
      box(250, 190, 430, 28, 'Interconnection network');
      el('text', { x: 250, y: 246, 'text-anchor': 'middle', class: 'sv-lbl' }, svg, 'each node: own processor, memory and disk');
    }
  }
  function pick(a: string) {
    $$('#par-seg button').forEach((b) => b.classList.toggle('on', b.dataset.a === a));
    $('#par-p').innerHTML = txt[a];
    draw(a);
    gsap.from(svg.children, { opacity: 0, scale: 0.94, transformOrigin: '50% 50%', stagger: 0.012, duration: 0.5, ease: 'expo.out' });
  }
  $$('#par-seg button').forEach((b) => b.addEventListener('click', () => pick(b.dataset.a!)));
  pick('mem');

  const ly: Record<string, string> = {
    users: '<strong>Global users</strong> and applications see external views defined over the global schema. They never name a site or a fragment.',
    gcs: 'The <strong>global conceptual schema</strong> (GCS) describes all the data as one logical database, as if it were not distributed. It is what provides network transparency. A global query compiler and optimizer use it, through the global system catalog.',
    lcs: 'Each site has a <strong>local conceptual schema</strong> (LCS): the logical organization of the data stored there. Fragmentation and allocation mappings connect the GCS to every LCS.',
    lis: 'The <strong>local internal schema</strong> (LIS) is the physical storage at one site, managed by that site’s own DBMS: files, indexes, buffers.',
  };
  const setL = (k: string) => {
    $$('#layers .ly').forEach((b) => b.classList.toggle('on', b.dataset.l === k));
    $('#layer-p').innerHTML = ly[k];
  };
  $$('#layers .ly').forEach((b) => { b.addEventListener('click', () => setL(b.dataset.l!)); b.addEventListener('mouseenter', () => setL(b.dataset.l!)); });
  setL('gcs');
}

/* =========================================================== fragmentation */
const COLS = ['Ssn', 'Fname', 'Lname', 'Bdate', 'Sex', 'Salary', 'Super_ssn', 'Dno'];
const ROWS = [
  ['123456789', 'John', 'Smith', '1965-01-09', 'M', '30000', '333445555', '5'],
  ['333445555', 'Franklin', 'Wong', '1955-12-08', 'M', '40000', '888665555', '5'],
  ['999887777', 'Alicia', 'Zelaya', '1968-01-19', 'F', '25000', '987654321', '4'],
  ['987654321', 'Jennifer', 'Wallace', '1941-06-20', 'F', '43000', '888665555', '4'],
  ['666884444', 'Ramesh', 'Narayan', '1962-09-15', 'M', '38000', '333445555', '5'],
  ['453453453', 'Joyce', 'English', '1972-07-31', 'F', '25000', '333445555', '5'],
  ['987987987', 'Ahmad', 'Jabbar', '1969-03-29', 'M', '25000', '987654321', '4'],
  ['888665555', 'James', 'Borg', '1937-11-10', 'M', '55000', 'NULL', '1'],
];
export function fragmentation() {
  const stage = $('#frag-stage');
  if (!stage) return;
  type Group = { name: string; def: string; cols: number[]; rows: number[]; color: string; site?: string; lost?: boolean };
  const PERS = [0, 1, 2, 3, 4], WORK = [0, 5, 6, 7], WORK_NOKEY = [5, 6, 7];
  const ALL = COLS.map((_, i) => i);
  const byDno = (d: string) => ROWS.map((r, i) => (r[7] === d ? i : -1)).filter((i) => i >= 0);
  const C = ['#ff8a1f', '#9cc8ff', '#9fdc8c', '#d8c7ff'];
  let mode = 'whole', err = 'none';
  const cellEls = new Map<string, HTMLElement>();

  function layout(): { groups: Group[]; checks: Record<string, 'ok' | 'bad' | 'na'>; alg: string; note: string } {
    const ok = { complete: 'ok', recon: 'ok', disjoint: 'ok' } as Record<string, 'ok' | 'bad' | 'na'>;
    const applies = (e: string) => (e === 'nokey' ? mode === 'v' || mode === 'mix' : mode === 'h' || mode === 'mix');
    const e = err !== 'none' && applies(err) ? err : 'none';
    const note = err !== 'none' && e === 'none' && mode !== 'whole' ? `<span class="dim">-- that mistake does not apply to ${mode === 'h' ? 'horizontal' : 'vertical'} fragments</span>\n` : '';
    if (mode === 'whole') {
      return { groups: [{ name: 'EMPLOYEE', def: 'one relation · 8 rows', cols: ALL, rows: ROWS.map((_, i) => i), color: '#ece7da' }],
        checks: { complete: 'na', recon: 'na', disjoint: 'na' },
        alg: '<span class="dim">-- not fragmented yet. Pick a strategy above.</span>', note: '' };
    }
    if (mode === 'h') {
      let g: Group[];
      let alg: string;
      if (e === 'overlap') {
        const a = ROWS.map((r, i) => (+r[7] >= 4 ? i : -1)).filter((i) => i >= 0), b = ROWS.map((r, i) => (+r[7] <= 4 ? i : -1)).filter((i) => i >= 0);
        g = [{ name: 'EMP_A', def: 'σ Dno ≥ 4', cols: ALL, rows: a, color: C[0], site: 'site 2' }, { name: 'EMP_B', def: 'σ Dno ≤ 4', cols: ALL, rows: b, color: C[1], site: 'site 3' }];
        alg = 'EMP_A ← σ <span class="kw">Dno ≥ 4</span> (EMPLOYEE)\nEMP_B ← σ <span class="kw">Dno ≤ 4</span> (EMPLOYEE)\n\nEMPLOYEE = EMP_A ∪ EMP_B\n<span class="err">-- the Dno = 4 rows are in both fragments</span>';
        ok.disjoint = 'bad';
      } else {
        g = [
          { name: 'EMP_D5', def: 'σ Dno = 5', cols: ALL, rows: byDno('5'), color: C[0], site: 'site 2' },
          { name: 'EMP_D4', def: 'σ Dno = 4', cols: ALL, rows: byDno('4'), color: C[1], site: 'site 3' },
        ];
        alg = 'EMP_D5 ← σ <span class="kw">Dno = 5</span> (EMPLOYEE)   <span class="dim">→ site 2</span>\nEMP_D4 ← σ <span class="kw">Dno = 4</span> (EMPLOYEE)   <span class="dim">→ site 3</span>\n';
        if (e === 'miss') {
          g.push({ name: 'NOT IN ANY FRAGMENT', def: 'lost', cols: ALL, rows: byDno('1'), color: '#ff5a4e', lost: true });
          alg += '\nEMP_D5 ∪ EMP_D4 ≠ EMPLOYEE\n<span class="err">-- James Borg (Dno = 1) is in no fragment</span>';
          ok.complete = 'bad'; ok.recon = 'bad';
        } else {
          g.push({ name: 'EMP_D1', def: 'σ Dno = 1', cols: ALL, rows: byDno('1'), color: C[2], site: 'site 1' });
          alg += 'EMP_D1 ← σ <span class="kw">Dno = 1</span> (EMPLOYEE)   <span class="dim">→ site 1</span>\n\nEMPLOYEE = EMP_D5 ∪ EMP_D4 ∪ EMP_D1  <span class="ok">✓</span>';
        }
      }
      return { groups: g, checks: ok, alg: note + alg, note };
    }
    if (mode === 'v') {
      const work = e === 'nokey' ? WORK_NOKEY : WORK;
      const g = [
        { name: 'EMP_PERS', def: 'π Ssn, Fname, Lname, Bdate, Sex', cols: PERS, rows: ROWS.map((_, i) => i), color: C[0], site: 'site 1' },
        { name: 'EMP_WORK', def: e === 'nokey' ? 'π Salary, Super_ssn, Dno' : 'π Ssn, Salary, Super_ssn, Dno', cols: work, rows: ROWS.map((_, i) => i), color: C[1], site: 'site 2' },
      ];
      let alg = 'EMP_PERS ← π <span class="kw">Ssn, Fname, Lname, Bdate, Sex</span> (EMPLOYEE)\n';
      if (e === 'nokey') {
        alg += 'EMP_WORK ← π <span class="kw">Salary, Super_ssn, Dno</span> (EMPLOYEE)\n\n<span class="err">-- no Ssn in EMP_WORK: nothing to join on, so we cannot tell whose salary is whose</span>';
        ok.recon = 'bad';
      } else alg += 'EMP_WORK ← π <span class="kw">Ssn, Salary, Super_ssn, Dno</span> (EMPLOYEE)\n\nEMPLOYEE = EMP_PERS ⋈<sub>Ssn</sub> EMP_WORK  <span class="ok">✓</span>\n<span class="dim">-- Ssn is repeated on purpose: the key is the glue</span>';
      return { groups: g, checks: ok, alg: note + alg, note };
    }
    // mixed
    const work = e === 'nokey' ? WORK_NOKEY : WORK;
    const g: Group[] = [{ name: 'EMP_PERS', def: 'π personal attributes', cols: PERS, rows: ROWS.map((_, i) => i), color: C[0], site: 'site 1' }];
    let alg = 'EMP_PERS ← π <span class="kw">Ssn, Fname, Lname, Bdate, Sex</span> (EMPLOYEE)\n';
    const wn = e === 'nokey' ? 'Salary, Super_ssn, Dno' : 'Ssn, Salary, Super_ssn, Dno';
    if (e === 'overlap') {
      g.push({ name: 'WORK_A', def: 'π … (σ Dno ≥ 4)', cols: work, rows: ROWS.map((r, i) => (+r[7] >= 4 ? i : -1)).filter((i) => i >= 0), color: C[1], site: 'site 2' });
      g.push({ name: 'WORK_B', def: 'π … (σ Dno ≤ 4)', cols: work, rows: ROWS.map((r, i) => (+r[7] <= 4 ? i : -1)).filter((i) => i >= 0), color: C[2], site: 'site 3' });
      alg += `WORK_A ← π <span class="kw">${wn}</span> (σ <span class="kw">Dno ≥ 4</span> (EMPLOYEE))\nWORK_B ← π <span class="kw">${wn}</span> (σ <span class="kw">Dno ≤ 4</span> (EMPLOYEE))\n<span class="err">-- Dno = 4 work rows are stored twice</span>`;
      ok.disjoint = 'bad';
    } else {
      g.push({ name: 'WORK_D5', def: 'π … (σ Dno = 5)', cols: work, rows: byDno('5'), color: C[1], site: 'site 2' });
      g.push({ name: 'WORK_D4', def: 'π … (σ Dno = 4)', cols: work, rows: byDno('4'), color: C[2], site: 'site 3' });
      alg += `WORK_Dx ← π <span class="kw">${wn}</span> (σ <span class="kw">Dno = x</span> (EMPLOYEE))   <span class="dim">x = 5, 4${e === 'miss' ? '' : ', 1'}</span>\n`;
      if (e === 'miss') {
        g.push({ name: 'NOT IN ANY FRAGMENT', def: 'lost', cols: work, rows: byDno('1'), color: '#ff5a4e', lost: true });
        alg += '<span class="err">-- James Borg’s work data is in no fragment</span>';
        ok.complete = 'bad'; ok.recon = 'bad';
      } else {
        g.push({ name: 'WORK_D1', def: 'π … (σ Dno = 1)', cols: work, rows: byDno('1'), color: C[3], site: 'site 1' });
        alg += `\nEMPLOYEE = EMP_PERS ⋈<sub>Ssn</sub> (WORK_D5 ∪ WORK_D4 ∪ WORK_D1)`;
      }
    }
    if (e === 'nokey') { alg += '\n<span class="err">-- work fragments lost Ssn: the join cannot be rebuilt</span>'; ok.recon = 'bad'; }
    else if (e !== 'miss' && e !== 'overlap') alg += '  <span class="ok">✓</span>';
    return { groups: g, checks: ok, alg: note + alg, note };
  }

  function cell(key: string, text: string, cls: string) {
    let c = cellEls.get(key);
    if (!c) { c = document.createElement('div'); c.dataset.flipId = key; cellEls.set(key, c); }
    c.className = `fcell ${cls}`;
    c.textContent = text;
    return c;
  }
  function render(animate = true) {
    const { groups, checks, alg } = layout();
    const state = animate ? Flip.getState(stage.querySelectorAll('.fcell, .fgroup')) : null;
    const used = new Map<string, number>();
    const take = (k: string) => { const n = used.get(k) ?? 0; used.set(k, n + 1); return n ? `${k}#${n}` : k; };
    // duplicates (same row in two horizontal fragments) are marked so the eye catches them
    const rowCount = new Map<number, number>();
    groups.forEach((g) => { if (!g.lost) g.rows.forEach((r) => rowCount.set(r, (rowCount.get(r) ?? 0) + 1)); });
    stage.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = mode === 'whole' ? '' : 'frag-row-split';
    groups.forEach((g, gi) => {
      const box = document.createElement('div');
      box.className = 'fgroup' + (g.lost ? ' lost bad' : '');
      box.dataset.flipId = `g-${g.name}`;
      box.style.setProperty('--fc', g.color);
      box.innerHTML = `<header><b>${esc(g.name)}</b><span>${esc(g.def)}${g.site ? ' · ' + g.site : ''}</span></header>`;
      const grid = document.createElement('div');
      grid.className = 'fgrid';
      grid.style.gridTemplateColumns = `repeat(${g.cols.length}, max-content)`;
      g.cols.forEach((c) => grid.appendChild(cell(take(`h-${c}`), COLS[c], 'h' + (c === 0 ? ' key' : ''))));
      g.rows.forEach((r) => g.cols.forEach((c) => {
        const dup = !g.lost && (rowCount.get(r) ?? 0) > 1;
        grid.appendChild(cell(take(`${r}-${c}`), ROWS[r][c], (c === 0 ? 'key' : '') + (dup ? ' dup' : '')));
      }));
      box.appendChild(grid);
      wrap.appendChild(box);
      void gi;
    });
    stage.appendChild(wrap);
    // drop elements that are no longer used so the next Flip starts clean
    for (const [k, v] of cellEls) if (!v.isConnected) cellEls.delete(k);
    $('#frag-alg').innerHTML = alg;
    $('#frag-tag').textContent = mode === 'whole' ? '1 relation' : `${groups.filter((g) => !g.lost).length} fragments`;
    $$('#frag-checks > div').forEach((d) => { d.className = checks[d.dataset.c!]; });
    if (state) {
      Flip.from(state, {
        duration: 0.95, ease: 'power3.inOut', absolute: true, stagger: 0.0025, nested: true, prune: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.6, delay: 0.35, ease: 'back.out(2)' }),
      });
    }
  }
  $$('#frag-mode button').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.m!;
    $$('#frag-mode button').forEach((x) => x.classList.toggle('on', x === b));
    render();
  }));
  $<HTMLSelectElement>('#frag-err').addEventListener('change', (e) => { err = (e.target as HTMLSelectElement).value; render(); });
  render(false);
}

/* =========================================================== replication + allocation */
export function allocation() {
  const host = $('#alloc-folders');
  if (!host) return;
  type F = 'D5' | 'D4' | 'D1' | 'DEPT';
  const FR: Record<F, { name: string; meta: string; art?: ArtPreset; rows: number; desc: string }> = {
    D5: { name: 'EMP_D5', meta: 'σ Dno=5 · 4 rows', art: 'ember', rows: 4, desc: 'Employees of department 5 (Research). Read constantly by Research staff at site 2.' },
    D4: { name: 'EMP_D4', meta: 'σ Dno=4 · 3 rows', art: 'glacier', rows: 3, desc: 'Employees of department 4 (Administration). Read mostly at site 3.' },
    D1: { name: 'EMP_D1', meta: 'σ Dno=1 · 1 row', art: 'dusk', rows: 1, desc: 'Headquarters staff (department 1). Read at site 1.' },
    DEPT: { name: 'DEPARTMENT', meta: 'whole · 3 rows', rows: 3, desc: 'The small department table. Read everywhere, rarely updated: a classic candidate for full replication.' },
  };
  const ORDER: F[] = ['D5', 'D4', 'D1', 'DEPT'];
  const SITES = [
    { label: 'Site 1 · HQ', art: 'aurora' as ArtPreset, seed: 3 },
    { label: 'Site 2 · Research', art: 'verdant' as ArtPreset, seed: 7 },
    { label: 'Site 3 · Admin', art: 'dusk' as ArtPreset, seed: 11 },
  ];
  const PRESET: Record<string, F[][]> = {
    none: [['D1', 'DEPT'], ['D5'], ['D4']],
    partial: [['D5', 'D4', 'D1', 'DEPT'], ['D5', 'DEPT'], ['D4', 'DEPT']],
    full: [ORDER.slice(), ORDER.slice(), ORDER.slice()],
  };
  // reads per site per fragment, and updates per fragment, for the meters
  const READS: Partial<Record<F, number>>[] = [{ D1: 1, D4: 1, D5: 1, DEPT: 1 }, { D5: 4, DEPT: 2 }, { D4: 4, DEPT: 2 }];
  const UPD: Record<F, number> = { D5: 2, D4: 2, D1: 1, DEPT: 1 };
  let alloc: Set<F>[] = PRESET.partial.map((a) => new Set(a));
  const down = [false, false, false];
  let sel: { site: number; f: F } | null = null;
  const width = () => Math.max(240, Math.min(320, (host.clientWidth - 40) / (innerWidth < 760 ? 1 : 3)));
  const folders: Folder[] = [];
  const offBtns: HTMLButtonElement[] = [];
  SITES.forEach((s, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'folder-wrap';
    const f = createFolder({
      label: s.label, tone: 'dark', art: s.art, seed: s.seed, action: 'add', addLabel: `Add a replica to ${s.label}`,
      width: width(), labelPlacement: 'bottom-left',
      onAdd: () => addNext(i),
      onFileSelect: (file) => { sel = { site: i, f: file.key as F }; info(); },
    });
    f.el.dataset.delay = String(i * 140);
    folders.push(f);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn'; b.textContent = 'Take site offline';
    b.addEventListener('click', () => { down[i] = !down[i]; b.textContent = down[i] ? 'Bring site online' : 'Take site offline'; f.setDown(down[i]); meters(); info(); });
    offBtns.push(b);
    wrap.append(f.el, b);
    host.appendChild(wrap);
  });
  const files = (i: number): FolderFile[] => ORDER.filter((k) => alloc[i].has(k)).map((k) => ({ name: FR[k].name, meta: FR[k].meta, art: FR[k].art, key: k }));
  function sync(drop?: { site: number; f: F }) {
    folders.forEach((f, i) => { f.setFiles(files(i), drop && drop.site === i ? drop.f : undefined); f.setMeta(`${alloc[i].size} fragment${alloc[i].size === 1 ? '' : 's'}`); });
    meters();
  }
  function addNext(i: number) {
    const next = ORDER.find((k) => !alloc[i].has(k));
    if (!next) { sel = null; $('#al-info').textContent = `${SITES[i].label} already holds every fragment.`; return; }
    alloc[i].add(next);
    folders[i].bump();
    markCustom();
    sync({ site: i, f: next });
    sel = { site: i, f: next }; info();
  }
  function markCustom() {
    const which = Object.entries(PRESET).find(([, p]) => p.every((a, i) => a.length === alloc[i].size && a.every((x) => alloc[i].has(x))));
    $$('#alloc-mode button').forEach((b) => b.classList.toggle('on', !!which && b.dataset.s === which[0]));
  }
  const copies = (f: F) => alloc.reduce((n, s) => n + (s.has(f) ? 1 : 0), 0);
  function meters() {
    const total = alloc.reduce((n, s) => n + s.size, 0);
    $('#al-copies').textContent = String(total);
    $('#al-copies-x').textContent = `${(total / 4).toFixed(2)}× the data`;
    let local = 0, all = 0;
    READS.forEach((r, i) => { for (const [f, n] of Object.entries(r)) { all += n!; if (alloc[i].has(f as F)) local += n!; } });
    const lp = local / all;
    $('#al-local').textContent = `${Math.round(lp * 100)}%`;
    const lb = $('#al-local-bar'); lb.style.width = `${lp * 100}%`; lb.className = lp < 0.5 ? 'bad' : lp < 0.8 ? 'warn' : '';
    let u = 0, un = 0;
    ORDER.forEach((f) => { u += UPD[f] * copies(f); un += UPD[f]; });
    const per = u / un;
    $('#al-upd').textContent = per.toFixed(1);
    const ub = $('#al-upd-bar'); ub.style.width = `${(per / 3) * 100}%`; ub.className = per > 2.2 ? 'bad' : per > 1.4 ? 'warn' : '';
    const reach = ORDER.filter((f) => alloc.some((s, i) => s.has(f) && !down[i])).length;
    const ab = $('#al-avail'); ab.textContent = `${reach} / 4`; ab.className = reach < 4 ? 'bad' : '';
    const avb = $('#al-avail-bar'); avb.style.width = `${(reach / 4) * 100}%`; avb.className = reach < 4 ? 'bad' : '';
  }
  function info() {
    const btns = $('#al-info-btns'); btns.innerHTML = '';
    if (!sel || !alloc[sel.site].has(sel.f)) { $('#al-info-k').textContent = 'Selected fragment'; $('#al-info-tag').textContent = '—'; return; }
    const { site, f } = sel;
    const at = alloc.map((s, i) => (s.has(f) ? i : -1)).filter((i) => i >= 0);
    const live = at.filter((i) => !down[i]);
    $('#al-info-k').textContent = `${FR[f].name} at ${SITES[site].label}`;
    $('#al-info-tag').textContent = `${at.length} cop${at.length === 1 ? 'y' : 'ies'}`;
    $('#al-info').innerHTML = `${FR[f].desc}<br><br>Stored at: <strong>${at.map((i) => SITES[i].label + (down[i] ? ' (offline)' : '')).join(', ')}</strong>. ${live.length ? `Readable while ${live.length} of them ${live.length === 1 ? 'is' : 'are'} up.` : '<span style="color:var(--fail)">No live copy: this fragment is unavailable right now.</span>'} Every update must reach all ${at.length}.`;
    const rm = document.createElement('button');
    rm.type = 'button'; rm.className = 'btn';
    rm.textContent = at.length > 1 ? `Remove this copy` : 'Last copy, cannot remove';
    rm.disabled = at.length <= 1;
    rm.addEventListener('click', () => { alloc[site].delete(f); markCustom(); sync(); sel = null; info(); $('#al-info').textContent = `Removed the copy of ${FR[f].name} from ${SITES[site].label}.`; });
    btns.appendChild(rm);
  }
  $$('#alloc-mode button').forEach((b) => b.addEventListener('click', () => {
    const p = PRESET[b.dataset.s!];
    const before = alloc.map((s) => new Set(s));
    alloc = p.map((a) => new Set(a));
    $$('#alloc-mode button').forEach((x) => x.classList.toggle('on', x === b));
    // drop the newly added files one site after another, so the change reads as motion
    folders.forEach((f, i) => setTimeout(() => {
      const added = ORDER.find((k) => alloc[i].has(k) && !before[i].has(k));
      f.setFiles(files(i), added);
      f.setMeta(`${alloc[i].size} fragment${alloc[i].size === 1 ? '' : 's'}`);
      if (added) f.bump();
    }, i * 160));
    meters(); sel = null; info();
    $('#al-info').textContent = { none: 'Each fragment is stored once, near the users who need it most. Cheap updates, but no spare copies.', partial: 'HQ keeps everything; each department site keeps its own employees plus the small DEPARTMENT table.', full: 'Every site stores every fragment. Reads are always local, and every update goes everywhere.' }[b.dataset.s!]!;
  }));
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = window.setTimeout(() => folders.forEach((f) => f.setWidth(width())), 150); });
  sync();
}

/* =========================================================== concurrency control */
export function concurrency() {
  const svg = $<SVGSVGElement>('#cc-svg');
  if (!svg) return;
  type T = 'primary' | 'backup' | 'copy' | 'vote';
  const P: Pt[] = [[110, 70], [450, 70], [110, 236], [450, 236]];
  const copies: Record<'X' | 'Y', number[]> = { X: [0, 1, 2], Y: [1, 2, 3] };
  let tech: T = 'primary', s1Down = false, coord = 0, backup = 1, primX = 0, msgs = 0, busy = false;
  const desc: Record<T, { h: string; p: string; g: string; w: string }> = {
    primary: { h: 'Primary site', p: 'One site is the <strong>coordinator for every data item</strong>. All lock requests go to its lock manager, so locking works just like a centralized system.', g: 'Simple; an easy extension of centralized locking.', w: 'That site is a bottleneck and a single point of failure. If it fails, every transaction blocks.' },
    backup: { h: 'Primary site with backup', p: 'All lock information is also recorded at a <strong>backup site</strong>. If the primary fails, the backup takes over at once and chooses a new backup.', g: 'No long freeze when the primary dies.', w: 'Every lock costs extra messages to keep the backup in sync.' },
    copy: { h: 'Primary copy', p: 'Each item has a <strong>distinguished (primary) copy</strong>, and different items have their primary copies at <strong>different sites</strong>. Locks for an item go to the site of its primary copy.', g: 'Load is spread; a failure only affects items whose primary copy was there.', w: 'After a failure, the copies of an item must elect a new primary copy.' },
    vote: { h: 'Voting', p: 'No distinguished copy. A lock request goes to <strong>every site holding a copy</strong>; each grants or refuses its own copy. With a <strong>majority</strong> of grants, the transaction holds the lock.', g: 'Truly distributed; tolerates failed sites.', w: 'Many more messages; needs timeouts when sites do not answer.' },
  };
  const nodes: SVGGElement[] = [];
  function draw() {
    svg.innerHTML = '';
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) el('path', { d: `M${P[a][0]} ${P[a][1]} L${P[b][0]} ${P[b][1]}`, class: 'sv-wire' + (s1Down && (a === 0 || b === 0) ? ' dead' : '') }, svg);
    nodes.length = 0;
    P.forEach((p, i) => {
      const g = el('g', { class: 'sv-node' + (i === 0 && s1Down ? ' dead' : '') }, svg);
      el('rect', { x: p[0] - 74, y: p[1] - 38, width: 148, height: 76, rx: 4 }, g);
      el('text', { x: p[0] - 62, y: p[1] - 18 }, g, `Site ${i + 1}`);
      const role = tech === 'primary' && i === coord ? 'lock manager' : tech === 'backup' ? (i === coord ? 'primary LM' : i === backup ? 'backup LM' : '') : tech === 'copy' ? (i === primX ? 'primary of X' : i === 1 ? 'primary of Y' : '') : '';
      if (role) el('text', { x: p[0], y: p[1] + 54, 'text-anchor': 'middle', class: 'sub', fill: '#ff8a1f' }, g, role).style.fill = '#ff8a1f';
      (['X', 'Y'] as const).forEach((it, k) => {
        if (!copies[it].includes(i)) return;
        const x = p[0] - 52 + k * 40, y = p[1] + 2;
        const prim = tech === 'copy' && ((it === 'X' && i === primX) || (it === 'Y' && i === 1));
        el('rect', { x, y, width: 32, height: 24, rx: 3, fill: prim ? '#2a1d10' : '#0f1216', stroke: prim ? '#ff8a1f' : 'rgba(236,231,218,.3)' }, g);
        el('text', { x: x + 16, y: y + 16, 'text-anchor': 'middle' }, g, prim ? `${it}★` : it);
      });
      if (i === 3) el('text', { x: p[0] + 62, y: p[1] + 30, 'text-anchor': 'end', class: 'sub' }, g, 'T1 runs here');
      if (i === 2) el('text', { x: p[0] + 62, y: p[1] + 30, 'text-anchor': 'end', class: 'sub' }, g, 'T2 runs here');
      nodes.push(g);
    });
  }
  const out = (t: string, cls: '' | 'ok' | 'warn' | 'err' = '') => { const o = $('#cc-out'); o.innerHTML = t; o.className = 'lab-result ' + cls; };
  async function send(a: number, b: number, label: string, cls = '') { msgs++; await packet(svg, P[a], P[b], { label, cls, dur: 650 }); }
  async function lock(item: 'X' | 'Y') {
    if (busy) return; busy = true; msgs = 0;
    const from = item === 'X' ? 3 : 2, T = item === 'X' ? 'T1' : 'T2';
    if (tech === 'primary') {
      if (s1Down) { await send(from, 0, 'lock?', 'bad'); out(`${T} asks site 1 for a lock on ${item}… no reply. <b>The primary site is down</b>, so every lock request in the system blocks until it recovers or an election picks a new coordinator. (${msgs} message)`, 'err'); }
      else { await send(from, 0, `lock ${item}`); await send(0, from, 'granted', 'ok'); out(`Site 1’s lock manager grants ${T} the lock on ${item}. ${T} may read any copy of ${item}, but a write must update every copy. (${msgs} messages)`, 'ok'); }
    } else if (tech === 'backup') {
      if (s1Down && coord === 0) { coord = 1; backup = 2; draw(); out('Site 1 failed. <b>The backup (site 2) becomes the primary</b> and picks site 3 as the new backup.', 'warn'); await sleep(900); }
      await send(from, coord, `lock ${item}`); await send(coord, backup, 'copy lock info', 'ice'); await send(coord, from, 'granted', 'ok');
      out(`Granted by site ${coord + 1}, and recorded at backup site ${backup + 1}. (${msgs} messages: one extra per lock to keep the backup current)`, 'ok');
    } else if (tech === 'copy') {
      const prim = item === 'X' ? primX : 1;
      if (item === 'X' && s1Down && primX === 0) {
        out('The primary copy of X was at site 1, which is down. <b>The remaining copies of X (sites 2 and 3) elect a new primary copy.</b>', 'warn');
        await Promise.all([send(1, 2, 'elect', 'ice'), send(2, 1, 'agree', 'ice')]);
        primX = 1; draw(); await sleep(300);
      }
      const p2 = item === 'X' ? primX : prim;
      await send(from, p2, `lock ${item}`); await send(p2, from, 'granted', 'ok');
      out(`Locks for ${item} are handled by the site of its primary copy, site ${p2 + 1}. ${item === 'Y' ? 'Site 1’s state does not matter for Y: risk and load are spread across sites.' : ''} (${msgs} messages)`, 'ok');
    } else {
      const holders = copies[item];
      const reach = holders.filter((s) => !(s === 0 && s1Down));
      await Promise.all(holders.map((s) => (s === from ? Promise.resolve() : send(from, s, 'vote?'))));
      await Promise.all(reach.map((s) => (s === from ? Promise.resolve() : send(s, from, 'yes', 'ok'))));
      const votes = reach.length, need = Math.floor(holders.length / 2) + 1;
      out(`${votes} of ${holders.length} copies voted yes; a majority needs ${need}. <b>${votes >= need ? 'Lock granted' : 'Lock refused'}</b>${s1Down && holders.includes(0) ? ', even with site 1 down' : ''}. (${msgs} messages)`, votes >= need ? 'ok' : 'err');
    }
    busy = false;
  }
  function setTech(t: T) {
    tech = t; s1Down = false; coord = 0; backup = 1; primX = 0;
    $$('#cc-seg button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    $('#cc-fail').textContent = 'Fail site 1';
    const d = desc[t];
    $('#cc-tech').innerHTML = `<h3>${d.h}</h3><p>${d.p}</p><div class="pc"><div class="g"><b>Good</b><span>${d.g}</span></div><div class="w"><b>Watch out</b><span>${d.w}</span></div></div>`;
    draw(); out('');
  }
  $$('#cc-seg button').forEach((b) => b.addEventListener('click', () => setTech(b.dataset.t as T)));
  $('#cc-lx').addEventListener('click', () => lock('X'));
  $('#cc-ly').addEventListener('click', () => lock('Y'));
  $('#cc-fail').addEventListener('click', () => { s1Down = !s1Down; $('#cc-fail').textContent = s1Down ? 'Recover site 1' : 'Fail site 1'; if (!s1Down) { coord = tech === 'backup' ? coord : 0; } draw(); out(s1Down ? 'Site 1 is down. Now request a lock.' : 'Site 1 is back.', s1Down ? 'warn' : ''); });
  $('#cc-reset').addEventListener('click', () => setTech(tech));
  setTech('primary');

  // distributed deadlock
  const dl = $<SVGSVGElement>('#dl-svg');
  let merged = false, aborted = false;
  function drawDl() {
    dl.innerHTML = '';
    el('defs', {}, dl).innerHTML = `<marker id="dla" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker>`;
    const node = (x: number, y: number, t: string, cls = '') => { const g = el('g', { class: `sv-node ${cls}` }, dl); el('circle', { cx: x, cy: y, r: 20 }, g); el('text', { x, y: y + 4, 'text-anchor': 'middle' }, g, t); };
    const edge = (a: Pt, b: Pt, label: string, red: boolean, bend: number) => {
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 + bend;
      const p = el('path', { d: `M${a[0]} ${a[1]} Q${mx} ${my} ${b[0]} ${b[1]}`, fill: 'none', stroke: red ? '#ff5a4e' : '#8f969e', 'stroke-width': red ? 2.4 : 1.6, 'marker-end': 'url(#dla)' }, dl);
      p.style.color = red ? '#ff5a4e' : '#8f969e';
      el('text', { x: mx, y: my + (bend > 0 ? 14 : -6), 'text-anchor': 'middle', class: 'sv-lbl' }, dl, label);
    };
    if (aborted) {
      node(150, 80, 'T1', 'ok'); el('text', { x: 260, y: 86, class: 'sv-lbl' }, dl, 'T2 rolled back · T1 continues');
      return;
    }
    if (!merged) {
      el('rect', { x: 8, y: 8, width: 192, height: 150, rx: 4, fill: 'none', stroke: 'rgba(236,231,218,.2)' }, dl);
      el('rect', { x: 220, y: 8, width: 192, height: 150, rx: 4, fill: 'none', stroke: 'rgba(236,231,218,.2)' }, dl);
      el('text', { x: 20, y: 28, class: 'sv-lbl' }, dl, 'site A');
      el('text', { x: 232, y: 28, class: 'sv-lbl' }, dl, 'site B');
      node(56, 92, 'T1'); node(150, 92, 'T2'); edge([78, 92], [128, 92], 'waits for', false, -26);
      node(270, 92, 'T2'); node(364, 92, 'T1'); edge([292, 92], [342, 92], 'waits for', false, -26);
    } else {
      node(140, 86, 'T1', 'dead'); node(280, 86, 'T2', 'dead');
      edge([162, 78], [258, 78], 'site A edge', true, -40);
      edge([258, 96], [162, 96], 'site B edge', true, 40);
    }
  }
  $('#dl-merge').addEventListener('click', () => {
    merged = true; aborted = false; drawDl();
    $('#dl-tag').textContent = 'Cycle: deadlock'; $('#dl-tag').className = 'tag'; $('#dl-tag').style.color = 'var(--fail)';
    $('#dl-note').textContent = 'Put together, the edges form a cycle T1 → T2 → T1. Neither site could see it alone. A global detector must abort one transaction.';
    ($('#dl-abort') as HTMLButtonElement).disabled = false;
  });
  $('#dl-abort').addEventListener('click', () => {
    aborted = true; drawDl();
    $('#dl-tag').textContent = 'Resolved'; $('#dl-tag').style.color = 'var(--ok)';
    $('#dl-note').textContent = 'T2 is aborted and rolled back at both sites, releasing its locks. T1 proceeds; T2 can restart later.';
    ($('#dl-abort') as HTMLButtonElement).disabled = true;
    setTimeout(() => { merged = false; aborted = false; drawDl(); $('#dl-tag').textContent = 'No cycle seen'; $('#dl-tag').style.color = ''; $('#dl-note').textContent = 'Each site sees only its own edges, so neither finds a cycle.'; }, 6000);
  });
  drawDl();
}

/* =========================================================== transfer cost lab */
export function costLab() {
  const svg = $<SVGSVGElement>('#cost-svg');
  if (!svg) return;
  const S: Record<number, Pt> = { 1: [110, 80], 2: [450, 80], 3: [280, 262] };
  type Hop = [number, number, number, string];
  type Strat = { t: string; hops: Hop[] };
  const R = { Q: 400000, Q2: 4000 };
  function strats(q: 'Q' | 'Q2', site: number): Strat[] {
    const r = R[q];
    if (site === 3) return [
      { t: 'Ship both tables to site 3 and join there.', hops: [[1, 3, 1000000, 'EMPLOYEE'], [2, 3, 3500, 'DEPARTMENT']] },
      { t: 'Ship EMPLOYEE to site 2, join there, ship the result to site 3.', hops: [[1, 2, 1000000, 'EMPLOYEE'], [2, 3, r, 'result']] },
      { t: 'Ship DEPARTMENT to site 1, join there, ship the result to site 3.', hops: [[2, 1, 3500, 'DEPARTMENT'], [1, 3, r, 'result']] },
    ];
    return [
      { t: 'Ship EMPLOYEE to site 2 and join there.', hops: [[1, 2, 1000000, 'EMPLOYEE']] },
      { t: 'Ship DEPARTMENT to site 1, join, ship the result back to site 2.', hops: [[2, 1, 3500, 'DEPARTMENT'], [1, 2, r, 'result']] },
      q === 'Q'
        ? { t: 'Semijoin: ship only π Dnumber (400 B) to site 1, join, ship back π Dno, Fname, Lname of matches (10,000 × 34 B).', hops: [[2, 1, 400, 'π Dnumber'], [1, 2, 340000, 'matching rows']] }
        : { t: 'Semijoin: ship only π Mgr_ssn (900 B) to site 1, join, ship back π Mgr_ssn, Fname, Lname of the 100 managers (39 B each).', hops: [[2, 1, 900, 'π Mgr_ssn'], [1, 2, 3900, 'matching rows']] },
    ];
  }
  let q: 'Q' | 'Q2' = 'Q', site = 3, pick = 2, busy = false;
  const total = (s: Strat) => s.hops.reduce((n, h) => n + h[2], 0);
  function draw() {
    svg.innerHTML = '';
    [[1, 2], [1, 3], [2, 3]].forEach(([a, b]) => el('path', { d: `M${S[a][0]} ${S[a][1]} L${S[b][0]} ${S[b][1]}`, class: 'sv-wire' }, svg));
    const node = (n: number, t1: string, t2: string, cls: string) => {
      const g = el('g', { class: `sv-node ${cls}` }, svg);
      el('rect', { x: S[n][0] - 92, y: S[n][1] - 34, width: 184, height: 68, rx: 4 }, g);
      el('text', { x: S[n][0], y: S[n][1] - 10, 'text-anchor': 'middle' }, g, t1);
      el('text', { x: S[n][0], y: S[n][1] + 8, 'text-anchor': 'middle', class: 'sub' }, g, t2);
      return g;
    };
    node(1, 'Site 1 · EMPLOYEE', '10,000 rows · 1,000,000 B', 'cold');
    node(2, site === 2 ? 'Site 2 · DEPARTMENT ★' : 'Site 2 · DEPARTMENT', site === 2 ? '3,500 B · result needed here' : '100 rows · 3,500 B', site === 2 ? 'hot' : 'ok');
    const g3 = node(3, site === 3 ? 'Site 3 · result site ★' : 'Site 3', site === 3 ? 'query issued here' : 'not involved', site === 3 ? 'hot' : 'dim');
    void g3;
    const qtxt = q === 'Q' ? 'Q: Fname, Lname, Dname for every employee → 10,000 × 40 B = 400,000 B' : 'Q′: Dname and manager’s name per department → 100 × 40 B = 4,000 B';
    el('text', { x: 280, y: 316, 'text-anchor': 'middle', class: 'sv-lbl' }, svg, qtxt);
  }
  function list() {
    const ss = strats(q, site);
    const max = Math.max(...ss.map(total)), best = Math.min(...ss.map(total));
    const host = $('#cost-strats');
    host.innerHTML = '';
    ss.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cost-strat' + (i === pick ? ' on' : '') + (total(s) === best ? ' best' : '');
      b.innerHTML = `<span class="n">${i + 1}</span><span>${esc(s.t)}</span><span class="bar"><i><u style="width:${Math.max(0.6, (total(s) / max) * 100)}%"></u></i>${fmtBytes(total(s))} B</span>`;
      b.addEventListener('click', () => { pick = i; list(); run(); });
      host.appendChild(b);
    });
    $('#cost-head').textContent = `${q === 'Q' ? 'Q' : 'Q′'} · result at site ${site}`;
  }
  async function run() {
    if (busy) return; busy = true;
    draw();
    const s = strats(q, site)[pick];
    const tot = $('#cost-total');
    let sum = 0;
    const log = $('#cost-log');
    log.innerHTML = '';
    tot.textContent = '0 bytes';
    for (const [a, b, bytes, label] of s.hops) {
      const r = 5 + Math.log10(bytes) * 1.6;
      log.innerHTML += `<span class="p">→</span> site ${a} to site ${b}: ${esc(label)} · <span class="num">${fmtBytes(bytes)} B</span>\n`;
      const prev = sum; sum += bytes;
      countTo(tot, prev, sum, 900, (n) => `${fmtBytes(n)} bytes`);
      await packet(svg, S[a], S[b], { label: `${label} · ${bytes >= 1e6 ? '1 MB' : bytes >= 1000 ? Math.round(bytes / 1000) + ' KB' : bytes + ' B'}`, r, dur: 950, cls: bytes > 100000 ? 'bad' : bytes > 5000 ? '' : 'ok' });
    }
    const best = Math.min(...strats(q, site).map(total));
    log.innerHTML += sum === best ? `<span class="ok">Total ${fmtBytes(sum)} B. The cheapest strategy for this query and result site.</span>` : `<span class="err">Total ${fmtBytes(sum)} B: ${(sum / best).toFixed(sum / best > 10 ? 0 : 1)}× the cheapest plan (${fmtBytes(best)} B).</span>`;
    busy = false;
  }
  $$<HTMLInputElement>('input[name="cq"]').forEach((i) => i.addEventListener('change', () => { q = i.value as 'Q' | 'Q2'; list(); draw(); }));
  $$<HTMLInputElement>('input[name="cs"]').forEach((i) => i.addEventListener('change', () => { site = Number(i.value); pick = site === 2 ? 2 : 2; list(); draw(); }));
  $('#cost-run').addEventListener('click', run);
  draw(); list();
  let started = false;
  new IntersectionObserver(([e]) => { if (e.isIntersecting && !started) { started = true; run(); } }, { threshold: 0.4 }).observe(svg);
}
