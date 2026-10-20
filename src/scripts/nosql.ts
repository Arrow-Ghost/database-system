// Parts 02–07 widgets that are new for Module 5: sparse storage, partitioning, ACID, CAP,
// eventual consistency, aggregates, document modelling, distribution models, MapReduce lab, archive.
import gsap from 'gsap';
import { $, $$, el, packet, sleep, esc, type Pt } from './svg';
import { createFolder, type Folder } from './folders';
import type { ArtPreset } from './art';

/* =========================================================== dense vs sparse */
export function sparse() {
  const stage = $('#sp-stage');
  if (!stage) return;
  const base = ['email', 'phone', 'city', 'github', 'company', 'college', 'instagram', 'linkedin'];
  const extra = ['website', 'timezone', 'referral', 'nickname'];
  const users: [string, Record<string, string>][] = [
    ['Asha', { email: 'asha@mail.in', city: 'Pune' }],
    ['Ravi', { phone: '98xxxxxx21', github: 'ravi-k' }],
    ['Meera', { college: 'VIT', instagram: '@meera' }],
    ['Kabir', { company: 'Zeta', linkedin: 'kabir-s', city: 'Delhi' }],
    ['Zoya', { email: 'zoya@mail.in' }],
    ['Dev', { github: 'devx', college: 'VIT' }],
  ];
  let sparseMode = false, more = false;
  const cols = () => (more ? [...base, ...extra] : base);
  function render() {
    const C = cols();
    if (more) users[4][1] = { email: 'zoya@mail.in', website: 'zoya.dev', timezone: 'IST', referral: 'asha', nickname: 'z' };
    else users[4][1] = { email: 'zoya@mail.in' };
    let cells = 0, nulls = 0;
    if (!sparseMode) {
      const t = document.createElement('div');
      t.className = 'sp-table';
      t.style.gridTemplateColumns = `repeat(${C.length + 1}, max-content)`;
      ['name', ...C].forEach((h) => { const s = document.createElement('span'); s.className = 'h'; s.textContent = h; t.appendChild(s); });
      users.forEach(([n, a]) => {
        const s = document.createElement('span'); s.textContent = n; t.appendChild(s); cells++;
        C.forEach((c) => { const x = document.createElement('span'); cells++; if (a[c]) x.textContent = a[c]; else { x.textContent = 'NULL'; x.className = 'null'; nulls++; } t.appendChild(x); });
      });
      stage.replaceChildren(t);
    } else {
      const d = document.createElement('div');
      d.className = 'sp-docs';
      users.forEach(([n, a]) => {
        const x = document.createElement('div');
        x.className = 'sp-doc';
        const parts = [`<i>name</i>: "${n}"`, ...Object.entries(a).map(([k, v]) => `<i>${k}</i>: "${esc(v)}"`)];
        cells += parts.length;
        x.innerHTML = `{ ${parts.join(', ')} }`;
        d.appendChild(x);
      });
      stage.replaceChildren(d);
    }
    $('#sp-cells').textContent = String(cells);
    $('#sp-null').textContent = String(nulls);
    $('#sp-cols').textContent = sparseMode ? 'none' : String(C.length + 1);
    $('#sp-toggle').textContent = sparseMode ? 'Store it as one table' : 'Store it sparse';
    $('#sp-more').textContent = more ? 'Remove the new attributes' : '+ 4 new attributes';
    gsap.from(stage.firstElementChild!.children, { opacity: 0, y: 8, stagger: 0.006, duration: 0.45, ease: 'expo.out' });
  }
  $('#sp-toggle').addEventListener('click', () => { sparseMode = !sparseMode; render(); });
  $('#sp-more').addEventListener('click', () => { more = !more; render(); });
  render();
}

/* =========================================================== hashing vs range partitioning */
export function partitionLab() {
  const host = $('#pl-nodes');
  if (!host) return;
  let mode: 'hash' | 'range' = 'hash';
  let keys: number[] = [], next = 1001, query: [number, number] | null = null;
  const nodeOf = (k: number) => (mode === 'hash' ? k % 4 : Math.min(3, Math.floor((k - 1) / 2500)));
  const log = $('#pl-log');
  const nodes = [0, 1, 2, 3].map((i) => {
    const n = document.createElement('div');
    n.className = 'pl-node';
    n.innerHTML = `<header><span>node ${i + 1}</span><b>0 keys</b><span class="rng"></span></header><div class="load"><i></i></div><div class="keys"></div>`;
    host.appendChild(n);
    return n;
  });
  function render(fresh: number[] = []) {
    const per = [0, 1, 2, 3].map((i) => keys.filter((k) => nodeOf(k) === i).sort((a, b) => a - b));
    const max = Math.max(4, ...per.map((p) => p.length));
    nodes.forEach((n, i) => {
      $('b', n).textContent = `${per[i].length} key${per[i].length === 1 ? '' : 's'}`;
      $('.rng', n).textContent = mode === 'hash' ? `K mod 4 = ${i}` : `${(i * 2500 + 1).toLocaleString('en-US')}–${((i + 1) * 2500).toLocaleString('en-US')}`;
      const hot = keys.length >= 8 && per[i].length / keys.length > 0.5;
      const bar = $('.load i', n); bar.style.width = `${(per[i].length / max) * 100}%`; bar.className = hot ? 'hot' : '';
      n.classList.toggle('hot', hot);
      const inQ = (k: number) => !!query && k >= query[0] && k <= query[1];
      n.classList.toggle('hit', per[i].some(inQ));
      const box = $('.keys', n);
      box.innerHTML = per[i].map((k) => `<span class="${inQ(k) ? 'q' : ''}" ${fresh.includes(k) ? '' : 'style="animation:none"'}>${k}</span>`).join('');
    });
  }
  function insert(ks: number[], label: string) {
    query = null;
    keys.push(...ks);
    const lines = ks.slice(0, 4).map((k) => mode === 'hash' ? `h(${k}) = ${k} mod 4 = ${k % 4}  → node ${(k % 4) + 1}` : `${k} falls in node ${nodeOf(k) + 1}’s range  → node ${nodeOf(k) + 1}`);
    const per = [0, 1, 2, 3].map((i) => keys.filter((k) => nodeOf(k) === i).length);
    const hot = keys.length >= 8 && Math.max(...per) / keys.length > 0.5;
    log.innerHTML = `<span class="p">${esc(label)}</span>\n${lines.join('\n')}${ks.length > 4 ? '\n…' : ''}\n${hot ? '<span class="err">One node holds most keys: a hotspot. Sequential ids all land in the same range.</span>' : '<span class="ok">Keys are spread across the nodes.</span>'}`;
    render(ks);
  }
  $('#pl-seq').addEventListener('click', () => { const ks = Array.from({ length: 8 }, (_, i) => next + i); next += 8; insert(ks, `insert orders ${ks[0]}–${ks[7]}`); });
  $('#pl-rand').addEventListener('click', () => {
    const ks: number[] = [];
    while (ks.length < 8) { const k = 1 + Math.floor(Math.random() * 10000); if (!keys.includes(k) && !ks.includes(k)) ks.push(k); }
    insert(ks, 'insert 8 random ids');
  });
  $('#pl-range').addEventListener('click', () => {
    if (!keys.some((k) => k >= 1001 && k <= 1008)) { const ks = Array.from({ length: 8 }, (_, i) => 1001 + i).filter((k) => !keys.includes(k)); keys.push(...ks); next = Math.max(next, 1009); }
    query = [1001, 1008];
    const touched = new Set(keys.filter((k) => k >= 1001 && k <= 1008).map(nodeOf));
    log.innerHTML = `<span class="p">find 1001 ≤ K ≤ 1008</span>\n${mode === 'hash' ? `<span class="err">Hashing scattered neighbours: the query must visit ${touched.size} node${touched.size === 1 ? '' : 's'}.</span>` : `<span class="ok">Range partitioning kept neighbours together: ${touched.size} node visited.</span>`}`;
    render();
  });
  $('#pl-reset').addEventListener('click', () => { keys = []; next = 1001; query = null; log.innerHTML = '<span class="dim">empty cluster</span>'; render(); });
  $$('#pl-mode button').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.m as typeof mode;
    $$('#pl-mode button').forEach((x) => x.classList.toggle('on', x === b));
    log.innerHTML = `<span class="p">re-partition with ${mode === 'hash' ? 'h(K) = K mod 4' : 'ranges of 2,500 keys'}</span>`;
    render(keys.slice());
  }));
  log.innerHTML = '<span class="dim">empty cluster · insert some keys</span>';
  render();
}

/* =========================================================== ACID lab */
export function acidLab() {
  const panel = $('.acid-panel');
  if (!panel) return;
  type Acct = { n: string; v: number | null; st: string; cls?: string };
  let tab = 'a', busy = false, gen = 0;
  const accts = $('#ac-accts'), btns = $('#ac-btns'), log = $('#ac-log'), stateTag = $('#ac-state');
  const defs: Record<string, [string, string]> = {
    a: ['Atomicity', 'All the work in a transaction completes (commit) or none of it does. A transfer is a withdrawal plus a deposit: if the deposit fails, the withdrawal must not happen either.'],
    c: ['Consistency', 'A transaction takes the database from one consistent state to another. Consistency is defined by constraints, for example: each cheque number is used only once, and a balance never goes negative.'],
    i: ['Isolation', 'Changes made inside a transaction are not visible to others until it commits. A teller checking a balance must not see a withdrawal that is still in progress.'],
    d: ['Durability', 'Once a transaction commits, its results survive failures. A transaction log lets the system re-create committed work after a crash, from some saved point in time, like a backup.'],
  };
  let A: Acct[] = [];
  function paint(flash: number[] = []) {
    accts.innerHTML = A.map((a, i) => `<div class="acct ${a.cls ?? ''} ${flash.includes(i) ? 'flash' : ''}"><span class="nm">${a.n}</span><span class="val">${a.v === null ? '—' : '₹' + a.v.toLocaleString('en-IN')}</span><span class="st">${a.st}</span></div>`).join('');
  }
  const say = (line: string, cls = '') => { log.innerHTML += `<span class="${cls}">${line}</span>\n`; log.scrollTop = log.scrollHeight; };
  const state = (s: string) => { stateTag.textContent = s; };
  const button = (label: string, fn: () => Promise<void> | void, solid = false) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn' + (solid ? ' solid' : ''); b.textContent = label;
    b.addEventListener('click', async () => { if (busy) return; busy = true; const g = gen; try { await fn(); } finally { if (g === gen) busy = false; } });
    btns.appendChild(b);
  };
  const wait = (ms: number) => sleep(ms);
  function setTab(t: string) {
    tab = t; gen++; busy = false;
    $$('.acid-tabs button').forEach((b) => { const on = b.dataset.p === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    $('#ac-k').textContent = defs[t][0];
    $('#ac-def').textContent = defs[t][1];
    btns.innerHTML = ''; log.innerHTML = ''; state('idle');
    if (t === 'a') {
      A = [{ n: 'Account A', v: 5000, st: 'committed' }, { n: 'Account B', v: 2000, st: 'committed' }];
      const transfer = async (crash: boolean) => {
        A = [{ n: 'Account A', v: 5000, st: 'committed' }, { n: 'Account B', v: 2000, st: 'committed' }]; paint(); log.innerHTML = '';
        state('running'); say('BEGIN TRANSACTION', 'p');
        await wait(500); A[0].v = 4000; A[0].st = 'uncommitted −1,000'; paint([0]); say('UPDATE A: withdraw ₹1,000   (log: A old=5000 new=4000)');
        await wait(700);
        if (crash) {
          state('crashed'); A[1].st = 'deposit never ran'; A[1].cls = 'bad'; paint([1]); say('CRASH before the deposit', 'err');
          await wait(900); say('recovery reads the log: transaction never committed → UNDO', 'p');
          await wait(600); A[0].v = 5000; A[0].st = 'rolled back'; A[0].cls = 'good'; A[1].cls = ''; A[1].st = 'unchanged'; paint([0]);
          say('A restored to ₹5,000. Nothing half-done survives.', 'ok'); state('rolled back');
        } else {
          A[1].v = 3000; A[1].st = 'uncommitted +1,000'; paint([1]); say('UPDATE B: deposit ₹1,000');
          await wait(600); say('COMMIT', 'ok'); A.forEach((a) => { a.st = 'committed'; a.cls = 'good'; }); paint(); state('committed');
        }
      };
      button('Transfer ₹1,000', () => transfer(false), true);
      button('Transfer, crash midway', () => transfer(true));
    } else if (t === 'c') {
      let cheques = [1045, 1046], bal = 5000;
      A = [{ n: 'Balance', v: bal, st: 'CHECK (balance ≥ 0)' }, { n: 'Cheques used', v: null, st: cheques.join(', ') + ' · UNIQUE' }];
      const reflect = () => { A[0].v = bal; A[1].st = cheques.join(', ') + ' · UNIQUE'; };
      button('Record cheque 1047', async () => {
        say('BEGIN · INSERT cheque 1047', 'p'); await wait(450);
        if (cheques.includes(1047)) { A[1].cls = 'bad'; paint([1]); say('violates UNIQUE(cheque_no): 1047 already used', 'err'); await wait(300); say('ROLLBACK: the database stays in its last consistent state', 'ok'); state('rejected'); A[1].cls = ''; }
        else { cheques.push(1047); bal -= 750; reflect(); paint([0, 1]); say('constraints hold → COMMIT (₹750 paid)', 'ok'); state('committed'); }
      }, true);
      button('Withdraw ₹9,000', async () => {
        say(`BEGIN · UPDATE balance = ${bal} − 9000`, 'p'); await wait(450);
        A[0].cls = 'bad'; paint([0]); say(`violates CHECK (balance ≥ 0): result would be −₹${(9000 - bal).toLocaleString('en-IN')}`, 'err');
        await wait(300); say('ROLLBACK', 'ok'); A[0].cls = ''; state('rejected');
      });
    } else if (t === 'i') {
      let committed = 5000, working: number | null = null;
      A = [{ n: 'Committed balance', v: committed, st: 'what others may see' }, { n: 'T1 working copy', v: null, st: 'no transaction yet' }, { n: 'Teller sees', v: null, st: 'not checked yet' }];
      button('T1 starts: withdraw ₹500', async () => {
        if (working !== null) return;
        working = committed - 500; A[1].v = working; A[1].st = 'uncommitted · locked'; paint([1]); say('T1: BEGIN · UPDATE balance − 500 (not committed)', 'p'); state('T1 running');
      }, true);
      button('Teller reads balance', async () => {
        A[2].v = committed; A[2].st = working !== null ? 'T1 still running, so its change is invisible' : 'latest committed value'; paint([2]);
        say(`Teller: SELECT balance → ₹${committed.toLocaleString('en-IN')}${working !== null ? '  (T1’s −500 is isolated)' : ''}`, 'ok');
      });
      button('T1 commits', async () => {
        if (working === null) { say('No running transaction to commit.', 'dim'); return; }
        committed = working; working = null; A[0].v = committed; A[1].v = null; A[1].st = 'committed and gone'; paint([0]); say('T1: COMMIT · now the new balance is visible', 'ok'); state('committed');
      });
    } else {
      let disk = 2000, mem: number | null = 2000, logRecs: number[] = [], pendingNoCommit = 0, crashed = false;
      A = [{ n: 'Balance in memory', v: mem, st: 'server running' }, { n: 'Balance on disk', v: disk, st: 'last checkpoint' }, { n: 'Log records', v: null, st: 'empty' }];
      const refl = () => { A[0].v = mem; A[1].v = disk; A[2].st = logRecs.length ? logRecs.map((x) => `+${x} committed`).join(' · ') : 'empty'; };
      button('Deposit ₹700 and commit', async () => {
        if (crashed) { say('The server is down. Restart it first.', 'err'); return; }
        mem = (mem ?? 0) + 700; logRecs.push(700); refl(); A[0].st = 'updated in memory'; paint([0, 2]); say('deposit +700 · log record forced to disk · COMMIT', 'ok'); state('committed');
      }, true);
      button('Deposit ₹300, no commit', async () => {
        if (crashed) { say('The server is down. Restart it first.', 'err'); return; }
        mem = (mem ?? 0) + 300; pendingNoCommit += 300; refl(); A[0].st = 'includes an uncommitted +300'; paint([0]); say('deposit +300 · not committed yet', 'p');
      });
      button('Crash the server', async () => {
        crashed = true; mem = null; refl(); A[0].st = 'lost in the crash'; A[0].cls = 'bad'; paint([0]); say('CRASH: everything in memory is gone', 'err'); state('down');
      });
      button('Restart and recover', async () => {
        if (!crashed) { say('Nothing to recover: the server is running.', 'dim'); return; }
        say('restart · replay committed log records from the checkpoint', 'p'); await wait(600);
        const sum = logRecs.reduce((n, x) => n + x, 0);
        mem = disk + sum; crashed = false; A[0].cls = 'good'; A[0].st = 'recovered'; refl(); paint([0]);
        say(`₹${disk.toLocaleString('en-IN')} + committed deposits ₹${sum.toLocaleString('en-IN')} = ₹${(mem).toLocaleString('en-IN')}${pendingNoCommit ? ` · the uncommitted +${pendingNoCommit} is not replayed` : ''}`, 'ok');
        pendingNoCommit = 0; state('recovered');
      });
    }
    paint();
  }
  $$('.acid-tabs button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.p!)));
  setTab('a');
}

/* =========================================================== CAP */
export function capLab() {
  const svg = $<SVGSVGElement>('#cap-svg');
  if (!svg) return;
  const V: Record<'C' | 'A' | 'P', Pt> = { C: [210, 46], A: [56, 300], P: [364, 300] };
  const colr = { C: '#ff8a1f', A: '#9cc8ff', P: '#9fdc8c' };
  type E = 'CA' | 'CP' | 'AP';
  const info: Record<E, { p: string; ex: string[] }> = {
    CP: { p: '<strong>Consistency + partition tolerance.</strong> When the network splits, the side that cannot confirm the latest data <strong>refuses</strong> reads and writes, or makes them wait. Nobody sees stale data, but some requests fail.', ex: ['BigTable', 'HBase', 'Hypertable', 'MongoDB', 'Redis', 'Terrastore', 'Scalaris', 'Berkeley DB', 'MemcacheDB'] },
    AP: { p: '<strong>Availability + partition tolerance.</strong> When the network splits, every node <strong>keeps answering</strong>, even if its data is stale. Conflicting writes are reconciled after the network heals: <strong>eventual consistency</strong>.', ex: ['Dynamo', 'Cassandra', 'Voldemort', 'CouchDB', 'Riak', 'SimpleDB', 'Tokyo Cabinet', 'KAI'] },
    CA: { p: '<strong>Consistency + availability</strong>, but no partition tolerance: it works only if the network never splits. In practice that means a single site, like a traditional relational database.', ex: ['RDBMSs (MySQL, Postgres)', 'Aster Data', 'Greenplum', 'Vertica'] },
  };
  let edge: E = 'CP';
  function draw() {
    svg.innerHTML = '';
    const ends: Record<E, [Pt, Pt]> = { CA: [V.C, V.A], CP: [V.C, V.P], AP: [V.A, V.P] };
    (Object.keys(ends) as E[]).forEach((k) => {
      const [a, b] = ends[k];
      const ln = el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'edge' + (k === edge ? ' on' : ''), tabindex: 0, role: 'button', 'aria-label': `Choose ${k}` }, svg);
      ln.addEventListener('click', () => pick(k));
      ln.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') { e.preventDefault(); pick(k); } });
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const off = k === 'AP' ? 26 : -22;
      el('text', { x: mx + (k === 'CA' ? -24 : k === 'CP' ? 24 : 0), y: my + (k === 'AP' ? off : 0), class: 'el' + (k === edge ? ' on' : '') }, svg, k);
    });
    (['C', 'A', 'P'] as const).forEach((v) => {
      const off = !edge.includes(v);
      const g = el('g', { class: 'vx' + (off ? ' off' : '') }, svg);
      el('circle', { cx: V[v][0], cy: V[v][1], r: 34, fill: '#0f1216', stroke: colr[v] }, g);
      el('text', { x: V[v][0], y: V[v][1] + 12, fill: colr[v] }, g, v);
    });
    el('text', { x: 210, y: 210, 'text-anchor': 'middle', class: 'sv-lbl' }, svg, 'all three: not possible');
  }
  function pick(k: E) {
    edge = k;
    $('#cap-tag').textContent = k;
    $('#cap-p').innerHTML = info[k].p;
    $('#cap-ex').innerHTML = info[k].ex.map((x) => `<span class="tag">${esc(x)}</span>`).join('');
    draw();
    simReset(`Mode: ${k}. ` + (k === 'CA' ? 'CA assumes the network never splits, so the link cannot be cut here.' : 'Cut the link, then book a seat on each side.'));
  }
  // partition simulator
  type DC = { v: number; ver: string; el: HTMLElement };
  const W: DC = { v: 12, ver: 'v1', el: $('#dc-w') }, Ea: DC = { v: 12, ver: 'v1', el: $('#dc-e') };
  let linkUp = true, verN = 1, base = 12;
  const out = (t: string, cls: '' | 'ok' | 'warn' | 'err' = '') => { const o = $('#cs-out'); o.innerHTML = t; o.className = 'lab-result ' + cls; };
  const paintDc = () => [W, Ea].forEach((d) => { $('.val', d.el).textContent = String(d.v); $('.ver', d.el).textContent = d.ver; d.el.classList.toggle('stale', W.v !== Ea.v); });
  const flash = (d: DC, cls: string) => { d.el.classList.add(cls); setTimeout(() => d.el.classList.remove(cls), 900); };
  function simReset(msg?: string) {
    W.v = Ea.v = 12; W.ver = Ea.ver = 'v1'; verN = 1; linkUp = true;
    $('#dc-link').classList.remove('cut'); $('#cs-cut').textContent = 'Cut the link'; $('#cs-link').textContent = 'link up';
    ($('#cs-cut') as HTMLButtonElement).disabled = edge === 'CA';
    [W, Ea].forEach((d) => d.el.classList.remove('refuse'));
    paintDc();
    out(msg ?? 'The link is up, so both data centres agree.');
  }
  function book(side: 'w' | 'e') {
    const me = side === 'w' ? W : Ea, other = side === 'w' ? Ea : W;
    const name = side === 'w' ? 'West' : 'East';
    if (linkUp) {
      me.v -= 1; other.v = me.v; verN++; me.ver = other.ver = `v${verN}`;
      flash(me, 'flash'); flash(other, 'flash'); paintDc();
      out(`Booked at ${name}. The link is up, so the write reached both data centres before it was acknowledged. ${me.v} seats left everywhere.`, 'ok');
      return;
    }
    if (edge === 'CP') {
      if (side === 'e') { Ea.el.classList.add('refuse'); flash(Ea, 'refuse'); out('<b>East refuses the booking.</b> It cannot reach West, which holds the authoritative copy, so it chooses consistency over availability. The customer sees an error.', 'err'); return; }
      W.v -= 1; verN++; W.ver = `v${verN}`; flash(W, 'flash'); paintDc();
      out('West holds the authoritative copy and accepts the booking. East will refuse reads and writes until the link heals, so nobody sees a stale count.', 'warn');
    } else {
      me.v -= 1; me.ver = `v${verN}${side}`; flash(me, 'flash'); paintDc();
      out(`<b>${name} accepts the booking</b> even though it cannot reach the other side. Both sides stay available, but now they ${W.v === Ea.v ? 'agree only by luck' : 'disagree'}: soft state. Reconnect to reconcile.`, 'warn');
    }
  }
  function read(side: 'w' | 'e') {
    const me = side === 'w' ? W : Ea, name = side === 'w' ? 'West' : 'East';
    if (!linkUp && edge === 'CP' && side === 'e') { flash(Ea, 'refuse'); out('<b>East refuses the read.</b> It might be stale, and a CP system will not risk it.', 'err'); return; }
    flash(me, 'read');
    const stale = W.v !== Ea.v;
    out(`Read at ${name}: <b>${me.v} seats</b> (${me.ver}).${stale ? ' The other side says something different: this answer may be stale.' : ''}`, stale ? 'warn' : 'ok');
  }
  $('#cs-cut').addEventListener('click', async () => {
    if (edge === 'CA') return;
    linkUp = !linkUp;
    $('#dc-link').classList.toggle('cut', !linkUp);
    $('#cs-cut').textContent = linkUp ? 'Cut the link' : 'Reconnect';
    $('#cs-link').textContent = linkUp ? 'link up' : 'partitioned';
    if (!linkUp) { base = W.v; out('Network partition: the two data centres cannot talk. Now book a seat on each side.', 'warn'); return; }
    Ea.el.classList.remove('refuse');
    if (W.v !== Ea.v || W.ver !== Ea.ver) {
      await sleep(400);
      const merged = edge === 'AP' ? base - ((base - W.v) + (base - Ea.v)) : W.v;
      W.v = Ea.v = merged; verN++; W.ver = Ea.ver = `v${verN}`;
      flash(W, 'flash'); flash(Ea, 'flash'); paintDc();
      out(edge === 'AP' ? `Link healed. The replicas exchange their versions and <b>merge both bookings</b>: ${merged} seats left everywhere. They became consistent eventually. (If the flight had one seat left, two people may now hold it: the cost of AP.)` : `Link healed. East copies West’s state: ${merged} seats everywhere, and East accepts requests again.`, 'ok');
    } else out('Link healed. Nothing diverged.', 'ok');
  });
  $$('[data-dc]').forEach((b) => b.addEventListener('click', () => book(b.dataset.dc as 'w' | 'e')));
  $$('[data-read]').forEach((b) => b.addEventListener('click', () => read(b.dataset.read as 'w' | 'e')));
  $('#cs-reset').addEventListener('click', () => simReset());
  pick('CP');
}

/* =========================================================== eventual consistency strip */
export function convergence() {
  const row = $('#conv-row');
  if (!row) return;
  const N = 5;
  let val = 41, touched = false, visible = false;
  const reps = Array.from({ length: N }, (_, i) => {
    const d = document.createElement('div');
    d.className = 'conv-rep';
    d.innerHTML = `<span>replica ${i + 1}</span><b>${val}</b>`;
    row.appendChild(d);
    return d;
  });
  function write() {
    val++;
    const v = val;
    reps.forEach((r) => { r.classList.add('old'); r.classList.remove('new'); });
    const first = Math.floor(Math.random() * N);
    reps.forEach((r, i) => {
      const delay = i === first ? 120 : 400 + Math.random() * 2600;
      setTimeout(() => { if (val !== v) return; $('b', r).textContent = String(v); r.classList.remove('old'); r.classList.add('new'); }, delay);
    });
  }
  $('#cv-write').addEventListener('click', () => { touched = true; write(); });
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(row);
  setInterval(() => { if (visible && !touched) write(); }, 5200);
}

/* =========================================================== aggregates */
export function aggregates() {
  const svg = $<SVGSVGElement>('#agg-svg');
  if (!svg) return;
  type M = 'two' | 'one' | 'none';
  const N: Record<string, { at: Pt; t: string; s: string }> = {
    cust: { at: [92, 70], t: 'Customer', s: 'id 1 · Martin' },
    bill: { at: [92, 178], t: 'Billing address', s: 'Chicago' },
    order: { at: [300, 70], t: 'Order', s: 'id 99' },
    item: { at: [300, 178], t: 'Order item', s: 'price 32.45' },
    prod: { at: [300, 300], t: 'Product', s: 'id 27' },
    ship: { at: [476, 70], t: 'Shipping address', s: 'Chicago' },
    pay: { at: [476, 178], t: 'Order payment', s: 'card · txn id' },
  };
  const E: [string, string, string][] = [['cust', 'bill', '1'], ['cust', 'order', '*'], ['order', 'item', '*'], ['item', 'prod', 'ref'], ['order', 'ship', '1'], ['order', 'pay', '*']];
  const json: Record<M, string> = {
    two: `// customers
{ "id": 1, "name": "Martin",
  "billingAddress": { "city": "Chicago" } }

// orders
{ "id": 99, "customerId": 1,
  "orderItems": [
    { "productId": 27, "price": 32.45,
      "productName": "NoSQL Distilled" } ],
  "shippingAddress": { "city": "Chicago" },
  "orderPayment": [
    { "ccinfo": "1000-1000-1000-1000",
      "txnId": "abelif879rft",
      "billingAddress": { "city": "Chicago" } } ] }`,
    one: `// customers
{ "id": 1, "name": "Martin",
  "billingAddress": { "city": "Chicago" },
  "orders": [
    { "id": 99,
      "orderItems": [
        { "productId": 27, "price": 32.45,
          "productName": "NoSQL Distilled" } ],
      "shippingAddress": { "city": "Chicago" },
      "orderPayment": [
        { "ccinfo": "1000-1000-1000-1000",
          "txnId": "abelif879rft",
          "billingAddress": { "city": "Chicago" } } ] } ] }`,
    none: `-- aggregate-ignorant: one table per kind of thing
customer      (id, name, billing_address_id)
address       (id, street, city)
"order"       (id, customer_id, shipping_address_id)
order_item    (order_id, product_id, price)
product       (id, name)
order_payment (order_id, card_no, txn_id,
               billing_address_id)

-- every relationship is a foreign key;
-- joins put the picture back together`,
  };
  const cost: Record<M, [string, string][]> = {
    two: [['g', '1 read: the order aggregate'], ['m', 'query orders by customerId (needs an index)'], ['x', 'open every order aggregate (MapReduce or a materialized view)'], ['g', 'atomic: one aggregate']],
    one: [['m', '1 read, but it loads the whole customer'], ['g', '1 read'], ['x', 'open every customer and dig into nested orders'], ['g', 'atomic: one aggregate']],
    none: [['m', 'join of 4 tables'], ['g', 'one join query'], ['g', 'one GROUP BY'], ['g', 'an ACID transaction across tables']],
  };
  const Qs = ['Show order 99 with its items and payment', 'All orders of customer 1', 'Total sales of product 27 across all orders', 'Change an order and its payment together'];
  function draw(m: M) {
    svg.innerHTML = '';
    const pad = 16;
    const bound = (ids: string[], label: string, cls: string) => {
      const xs = ids.map((i) => N[i].at[0]), ys = ids.map((i) => N[i].at[1]);
      const x0 = Math.min(...xs) - 70 - pad, x1 = Math.max(...xs) + 70 + pad, y0 = Math.min(...ys) - 26 - pad - 12, y1 = Math.max(...ys) + 26 + pad;
      el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 14, class: `bnd ${cls}` }, svg);
      el('text', { x: x0 + 12, y: y0 + 15, class: 'bnd-l', fill: cls === 'b2' ? '#9cc8ff' : '#ff8a1f' }, svg, label);
    };
    if (m === 'two') { bound(['cust', 'bill'], 'customer aggregate', 'b2'); bound(['order', 'item', 'ship', 'pay'], 'order aggregate', ''); }
    if (m === 'one') bound(['cust', 'bill', 'order', 'item', 'ship', 'pay'], 'customer aggregate (orders inside)', '');
    E.forEach(([a, b, k]) => {
      const A = N[a].at, B = N[b].at;
      el('path', { d: `M${A[0]} ${A[1]} L${B[0]} ${B[1]}`, class: 'sv-wire', 'stroke-dasharray': k === 'ref' ? '4 5' : '' }, svg);
      el('text', { x: (A[0] + B[0]) / 2 + 8, y: (A[1] + B[1]) / 2 - 4, class: 'sv-lbl' }, svg, k === 'ref' ? 'by id' : k === '*' ? '1..*' : '1');
    });
    Object.entries(N).forEach(([k, n]) => {
      const inAgg = m === 'none' ? false : k !== 'prod';
      const g = el('g', { class: 'sv-node' + (m === 'none' ? '' : inAgg ? (m === 'two' && (k === 'cust' || k === 'bill') ? ' cold' : ' hot') : ' dim') }, svg);
      el('rect', { x: n.at[0] - 66, y: n.at[1] - 24, width: 132, height: 48, rx: 4, 'stroke-dasharray': m === 'none' ? '3 4' : '' }, g);
      el('text', { x: n.at[0], y: n.at[1] - 3, 'text-anchor': 'middle' }, g, n.t);
      el('text', { x: n.at[0], y: n.at[1] + 14, 'text-anchor': 'middle', class: 'sub' }, g, m === 'none' ? 'its own table' : n.s);
    });
    if (m !== 'none') el('text', { x: 300, y: 344, 'text-anchor': 'middle', class: 'sv-lbl' }, svg, 'product stays outside: referenced by id, shared by many orders');
  }
  function pick(m: M) {
    $$('#agg-mode button').forEach((b) => b.classList.toggle('on', b.dataset.a === m));
    draw(m);
    gsap.from(svg.querySelectorAll('.bnd'), { opacity: 0, scale: 0.94, transformOrigin: '50% 50%', duration: 0.8, ease: 'expo.out' });
    const j = $('#agg-json');
    j.textContent = json[m];
    gsap.from(j, { opacity: 0, y: 10, duration: 0.5 });
    $('#agg-k').textContent = m === 'none' ? 'Relational tables' : 'Documents stored';
    $('#agg-tag').textContent = m === 'two' ? '2 aggregates' : m === 'one' ? '1 aggregate' : '6 tables';
    const tb = $('#agg-cost tbody');
    const word = { g: 'cheap', m: 'okay', x: 'expensive' } as Record<string, string>;
    tb.innerHTML = Qs.map((q, i) => `<tr><th>${q}</th><td><b class="${cost[m][i][0]}">${word[cost[m][i][0]]}</b>${cost[m][i][1]}</td></tr>`).join('');
  }
  $$('#agg-mode button').forEach((b) => b.addEventListener('click', () => pick(b.dataset.a as M)));
  pick('two');
}

/* =========================================================== embed vs reference (textbook example) */
export function modelling() {
  const host = $('#mod-cards');
  if (!host) return;
  type D = 'a' | 'b' | 'c';
  let d: D = 'a', joined = false;
  const q = $('#mod-q');
  const s = (x: string) => `<span class="s">"${x}"</span>`, k = (x: string) => `<span class="k">${x}</span>`, n = (x: string) => `<span class="n">${x}</span>`;
  function docs(): { c: string; body: string; mark?: boolean; warn?: boolean }[] {
    if (d === 'a') {
      const p2w = [`    { ${k('Ename')}: ${s('Joyce English')}, ${k('Hours')}: ${n('20.0')} }`];
      if (joined) p2w.push(`    <mark>{ ${k('Ename')}: ${s('John Smith')}, ${k('Hours')}: ${n('7.5')} }</mark>`);
      return [
        { c: 'project', body: `{ ${k('_id')}: ${s('P1')},\n  ${k('Pname')}: ${s('ProductX')},\n  ${k('Plocation')}: ${s('Bellaire')},\n  ${k('Workers')}: [\n    { ${k('Ename')}: ${s('John Smith')}, ${k('Hours')}: ${n('32.5')} },\n    { ${k('Ename')}: ${s('Joyce English')}, ${k('Hours')}: ${n('20.0')} } ] }` },
        { c: 'project', body: `{ ${k('_id')}: ${s('P2')},\n  ${k('Pname')}: ${s('ProductY')},\n  ${k('Plocation')}: ${s('Sugarland')},\n  ${k('Workers')}: [\n${p2w.join(',\n')} ] }`, mark: joined },
      ];
    }
    if (d === 'b') return [
      { c: 'project', body: `{ ${k('_id')}: ${s('P1')}, ${k('Pname')}: ${s('ProductX')},\n  ${k('Plocation')}: ${s('Bellaire')},\n  ${k('WorkerIds')}: [ ${s('W1')}, ${s('W2')} ] }` },
      { c: 'project', body: `{ ${k('_id')}: ${s('P2')}, ${k('Pname')}: ${s('ProductY')},\n  ${k('Plocation')}: ${s('Sugarland')},\n  ${k('WorkerIds')}: [ ${s('W2')}${joined ? `, <mark>${s('W1')}</mark>` : ''} ] }`, mark: joined },
      { c: 'worker', body: `{ ${k('_id')}: ${s('W1')}, ${k('Ename')}: ${s('John Smith')},\n  ${k('Hours')}: ${joined ? `<mark>${n('32.5')} or ${n('7.5')}?</mark>` : n('32.5')} }`, warn: joined },
      { c: 'worker', body: `{ ${k('_id')}: ${s('W2')}, ${k('Ename')}: ${s('Joyce English')},\n  ${k('Hours')}: ${n('20.0')} }` },
    ];
    const out = [
      { c: 'project', body: `{ ${k('_id')}: ${s('P1')}, ${k('Pname')}: ${s('ProductX')},\n  ${k('Plocation')}: ${s('Bellaire')} }` },
      { c: 'project', body: `{ ${k('_id')}: ${s('P2')}, ${k('Pname')}: ${s('ProductY')},\n  ${k('Plocation')}: ${s('Sugarland')} }` },
      { c: 'worker', body: `{ ${k('_id')}: ${s('W1')}, ${k('Ename')}: ${s('John Smith')},\n  ${k('ProjectId')}: ${s('P1')}, ${k('Hours')}: ${n('32.5')} }` },
      { c: 'worker', body: `{ ${k('_id')}: ${s('W2')}, ${k('Ename')}: ${s('Joyce English')},\n  ${k('ProjectId')}: ${s('P1')}, ${k('Hours')}: ${n('20.0')} }` },
    ] as { c: string; body: string; mark?: boolean; warn?: boolean }[];
    if (joined) out.push({ c: 'worker', body: `<mark>{ ${k('_id')}: ${s('W3')}, ${k('Ename')}: ${s('John Smith')},\n  ${k('ProjectId')}: ${s('P2')}, ${k('Hours')}: ${n('7.5')} }</mark>`, mark: true });
    return out;
  }
  const kw = (x: string) => `<span class="kw">${x}</span>`;
  const readQ: Record<D, string> = {
    a: `db.project.${kw('findOne')}({ _id: <span class="str">"P1"</span> })\n<span class="ok">// 1 query: the workers are inside the project</span>`,
    b: `p = db.project.${kw('findOne')}({ _id: <span class="str">"P1"</span> })\ndb.worker.${kw('find')}({ _id: { $in: p.WorkerIds } })\n<span class="dim">// 2 queries: follow the references</span>`,
    c: `db.project.${kw('findOne')}({ _id: <span class="str">"P1"</span> })\ndb.worker.${kw('find')}({ ProjectId: <span class="str">"P1"</span> })\n<span class="dim">// 2 queries: an application-side join</span>`,
  };
  const joinQ: Record<D, string> = {
    a: `db.project.${kw('updateOne')}({ _id: <span class="str">"P2"</span> },\n  { $push: { Workers: { Ename: <span class="str">"John Smith"</span>, Hours: <span class="num">7.5</span> } } })\n<span class="err">// John’s name is now stored in two projects. Renaming him means two updates.</span>`,
    b: `db.project.${kw('updateOne')}({ _id: <span class="str">"P2"</span> }, { $push: { WorkerIds: <span class="str">"W1"</span> } })\n<span class="err">// but W1 has a single Hours field: 32.5 on P1 and 7.5 on P2 cannot both fit.</span>\n<span class="dim">// relationship attributes need a home of their own</span>`,
    c: `db.worker.${kw('insertOne')}({ _id: <span class="str">"W3"</span>, Ename: <span class="str">"John Smith"</span>,\n  ProjectId: <span class="str">"P2"</span>, Hours: <span class="num">7.5</span> })\n<span class="err">// a second John document: “not fully normalized” for many-to-many</span>`,
  };
  const intro: Record<D, string> = {
    a: `<span class="dim">// (a) project documents with an embedded array of workers</span>`,
    b: `<span class="dim">// (b) project documents with an embedded array of worker ids</span>`,
    c: `<span class="dim">// (c) normalized project and worker documents, inserted with</span>\ndb.project.${kw('insert')}({ _id: <span class="str">"P1"</span>, Pname: <span class="str">"ProductX"</span>, Plocation: <span class="str">"Bellaire"</span> })\ndb.worker.${kw('insert')}([ { _id: <span class="str">"W1"</span>, … }, { _id: <span class="str">"W2"</span>, … } ])`,
  };
  function render(lit: 'read' | 'join' | null = null) {
    const list = docs();
    host.innerHTML = list.map((x) => `<div class="mdoc ${x.mark && lit === 'join' ? 'lit' : ''} ${x.warn ? 'warn' : ''}"><header><span>${x.c}</span><span>${x.c === 'project' ? 'collection: project' : 'collection: worker'}</span></header><pre>${x.body}</pre></div>`).join('');
    if (lit === 'read') {
      const cards = $$('.mdoc', host);
      cards.forEach((c, i) => { const txt = c.textContent ?? ''; if ((d === 'a' && i === 0) || (d !== 'a' && (txt.includes('"P1"') || (txt.includes('"W1"') && !txt.includes('"P2"')) || (txt.includes('"W2"') && !txt.includes('"P2"') && d === 'b')))) c.classList.add('lit'); });
    }
    $('#mod-k').textContent = d === 'a' ? 'project collection' : 'project + worker collections';
  }
  function pick(x: D) {
    d = x; joined = false;
    $$('.mod-tabs button').forEach((b) => { const on = b.dataset.d === x; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    render(); q.innerHTML = intro[x];
    gsap.from('.mdoc', { opacity: 0, y: 16, stagger: 0.06, duration: 0.6, ease: 'expo.out' });
  }
  $$('.mod-tabs button').forEach((b) => b.addEventListener('click', () => pick(b.dataset.d as D)));
  $('#mod-read').addEventListener('click', () => { render('read'); q.innerHTML = readQ[d]; });
  $('#mod-join').addEventListener('click', () => { joined = true; render('join'); q.innerHTML = joinQ[d]; });
  pick('a');
}

/* =========================================================== distribution models */
export function distribution() {
  const svg = $<SVGSVGElement>('#dist-svg');
  if (!svg) return;
  type M = 'single' | 'shard' | 'ms' | 'p2p' | 'combo';
  type Nd = { id: string; at: Pt; t: string; s: string; role?: string; dead?: boolean; g?: SVGGElement };
  const client: Pt = [46, 150];
  let m: M = 'single', nodes: Nd[] = [], links: [number, number][] = [], busy = false, lastWrite = 0, wi = 0;
  const pc: Record<M, [string, string, string]> = {
    single: ['Single server', 'No distribution complexity at all. If the data fits, this is often the best choice; graph databases commonly run this way.', 'Limited to one machine’s capacity, and if it fails, everything is down.'],
    shard: ['Sharding', 'Different data on different nodes. Each node handles the reads and writes for its own keys, so both reads and writes scale. Keep data that is read together on the same node.', 'No resilience by itself: when a shard dies, its data is unavailable. Rebalancing is real work.'],
    ms: ['Master-slave replication', 'The master handles every write and streams changes to the slaves. Reads scale by adding slaves, and if the master fails, slaves can still serve reads.', 'The master is a write bottleneck and, until a new one is appointed, a single point of failure for writes. Slaves can return stale data.'],
    p2p: ['Peer-to-peer replication', 'No master: every replica accepts reads and writes. Losing a node loses nothing, and you scale by adding nodes.', 'Two nodes can accept conflicting writes to the same record at once (a write-write conflict). You need quorums or a way to merge.'],
    combo: ['Sharding + replication', 'Sharding spreads the load and replication keeps each shard available: master-slave per shard here. Column-family stores often use peer-to-peer with a replication factor of 3.', 'Many moving parts at once: rebalancing, failover and consistency.'],
  };
  function build() {
    links = [];
    if (m === 'single') nodes = [{ id: 'n', at: [330, 150], t: 'Node', s: 'all the data' }];
    if (m === 'shard') nodes = [{ id: 'a', at: [330, 60], t: 'Shard A', s: 'keys a–h' }, { id: 'b', at: [330, 150], t: 'Shard B', s: 'keys i–p' }, { id: 'c', at: [330, 240], t: 'Shard C', s: 'keys q–z' }];
    if (m === 'ms') { nodes = [{ id: 'm', at: [270, 150], t: 'Master', s: 'all writes', role: 'master' }, { id: 's1', at: [500, 60], t: 'Slave 1', s: 'reads' }, { id: 's2', at: [500, 150], t: 'Slave 2', s: 'reads' }, { id: 's3', at: [500, 240], t: 'Slave 3', s: 'reads' }]; links = [[0, 1], [0, 2], [0, 3]]; }
    if (m === 'p2p') { nodes = [{ id: 'p1', at: [260, 66], t: 'Node 1', s: 'reads + writes' }, { id: 'p2', at: [480, 66], t: 'Node 2', s: 'reads + writes' }, { id: 'p3', at: [480, 234], t: 'Node 3', s: 'reads + writes' }, { id: 'p4', at: [260, 234], t: 'Node 4', s: 'reads + writes' }]; links = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]]; }
    if (m === 'combo') { nodes = [{ id: 'am', at: [290, 60], t: 'A · master', s: 'keys a–h', role: 'master' }, { id: 'ar', at: [490, 60], t: 'A · replica', s: 'copy of A' }, { id: 'bm', at: [290, 150], t: 'B · master', s: 'keys i–p', role: 'master' }, { id: 'br', at: [490, 150], t: 'B · replica', s: 'copy of B' }, { id: 'cm', at: [290, 240], t: 'C · master', s: 'keys q–z', role: 'master' }, { id: 'cr', at: [490, 240], t: 'C · replica', s: 'copy of C' }]; links = [[0, 1], [2, 3], [4, 5]]; }
  }
  function draw() {
    svg.innerHTML = '';
    nodes.forEach((n) => { if (!links.length || m === 'shard' || m === 'single') el('path', { d: `M${client[0]} ${client[1]} L${n.at[0] - 80} ${n.at[1]}`, class: 'sv-wire' + (n.dead ? ' dead' : '') }, svg); });
    if (m === 'ms' || m === 'p2p' || m === 'combo') {
      const entry = m === 'ms' ? [0] : m === 'combo' ? [0, 2, 4] : [0, 3];
      entry.forEach((i) => el('path', { d: `M${client[0]} ${client[1]} L${nodes[i].at[0] - 80} ${nodes[i].at[1]}`, class: 'sv-wire' }, svg));
    }
    links.forEach(([a, b]) => el('path', { d: `M${nodes[a].at[0]} ${nodes[a].at[1]} L${nodes[b].at[0]} ${nodes[b].at[1]}`, class: 'sv-wire' + (nodes[a].dead || nodes[b].dead ? ' dead' : ''), 'stroke-dasharray': '5 5' }, svg));
    const cg = el('g', { class: 'sv-node cold' }, svg);
    el('circle', { cx: client[0], cy: client[1], r: 28 }, cg);
    el('text', { x: client[0], y: client[1] + 4, 'text-anchor': 'middle' }, cg, 'app');
    nodes.forEach((n) => {
      const g = el('g', { class: 'sv-node' + (n.dead ? ' dead' : n.role === 'master' ? ' hot' : '') }, svg);
      el('rect', { x: n.at[0] - 80, y: n.at[1] - 28, width: 160, height: 56, rx: 4 }, g);
      el('text', { x: n.at[0], y: n.at[1] - 4, 'text-anchor': 'middle' }, g, n.dead ? `${n.t} ✕` : n.t);
      el('text', { x: n.at[0], y: n.at[1] + 14, 'text-anchor': 'middle', class: 'sub' }, g, n.dead ? 'down' : n.s);
      n.g = g;
    });
  }
  const out = (t: string, cls: '' | 'ok' | 'warn' | 'err' = '') => { const o = $('#dm-out'); o.innerHTML = t; o.className = 'lab-result ' + cls; };
  const keys = ['alice', 'mia', 'zoe'];
  const shardOf = (k: string) => (k < 'i' ? 0 : k < 'q' ? 1 : 2);
  const go = (a: Pt, b: Pt, label: string, cls = '') => packet(svg, a, b, { label, cls, dur: 650 });
  const edgePt = (n: Nd): Pt => [n.at[0] - 80, n.at[1]];
  async function write() {
    if (busy) return; busy = true; lastWrite = performance.now();
    const key = keys[wi++ % 3];
    if (m === 'single') {
      const n = nodes[0];
      if (n.dead) out('The only node is down. Nothing can be written or read.', 'err');
      else { await go(client, edgePt(n), `put ${key}`); out(`Stored ${key} on the only node.`, 'ok'); }
    } else if (m === 'shard') {
      const n = nodes[shardOf(key)];
      if (n.dead) { await go(client, [client[0] + 120, n.at[1]], `put ${key}`, 'bad'); out(`${key} belongs to ${n.t}, which is down: <b>this key cannot be written</b>. Keys on other shards are fine.`, 'err'); }
      else { await go(client, edgePt(n), `put ${key}`); out(`${key} hashes to <b>${n.t}</b> (${n.s}). Only that node does the work.`, 'ok'); }
    } else if (m === 'ms') {
      const ms = nodes[0];
      if (ms.dead) { out('<b>No master, so no writes</b> until a slave is promoted.', 'err'); }
      else {
        await go(client, edgePt(ms), `write ${key}`);
        out(`The master applied the write and acknowledged it. Now it streams the change to the slaves…`, 'warn');
        await Promise.all(nodes.slice(1).filter((n) => !n.dead).map((n, i) => sleep(i * 250).then(() => go(ms.at, n.at, 'replicate', 'ice'))));
        out('Every live slave has the change. Reads anywhere now return it.', 'ok');
      }
    } else if (m === 'p2p') {
      const live = nodes.filter((n) => !n.dead);
      const n = live[Math.floor(Math.random() * live.length)];
      await go(client, edgePt(n), `write ${key}`);
      out(`${n.t} accepted the write directly; there is no master. It propagates to its peers…`, 'warn');
      await Promise.all(live.filter((x) => x !== n).map((x) => go(n.at, x.at, 'sync', 'ice')));
      out('All live peers have the write.', 'ok');
    } else {
      const s = shardOf(key), ms = nodes[s * 2], rep = nodes[s * 2 + 1];
      const target = ms.dead ? rep : ms;
      await go(client, edgePt(target), `write ${key}`);
      if (!ms.dead && !rep.dead) await go(ms.at, rep.at, 'replicate', 'ice');
      out(`${key} → shard ${'ABC'[s]}: written on ${target.t}${!ms.dead && !rep.dead ? ' and copied to its replica' : ''}.`, 'ok');
    }
    busy = false;
  }
  async function read() {
    if (busy) return; busy = true;
    const key = keys[(wi + 2) % 3];
    const recent = performance.now() - lastWrite < 2200;
    if (m === 'single') { const n = nodes[0]; if (n.dead) out('Down: nothing to read from.', 'err'); else { await go(client, edgePt(n), `get ${key}`); await go(edgePt(n), client, 'value', 'ok'); out('Read from the only node.', 'ok'); } }
    else if (m === 'shard') { const n = nodes[shardOf(key)]; if (n.dead) out(`${key} lives on ${n.t}, which is down.`, 'err'); else { await go(client, edgePt(n), `get ${key}`); await go(edgePt(n), client, 'value', 'ok'); out(`Routed straight to ${n.t}.`, 'ok'); } }
    else if (m === 'ms') {
      const live = nodes.slice(1).filter((n) => !n.dead);
      const n = live[Math.floor(Math.random() * live.length)] ?? nodes[0];
      await go(client, edgePt(n), `get ${key}`); await go(edgePt(n), client, 'value', recent ? '' : 'ok');
      out(recent ? `Read from ${n.t} right after a write: it <b>may not have the change yet</b> (a stale read).` : `Read served by ${n.t}. The master stays free for writes.`, recent ? 'warn' : 'ok');
    } else if (m === 'p2p') {
      const live = nodes.filter((n) => !n.dead), n = live[Math.floor(Math.random() * live.length)];
      await go(client, edgePt(n), `get ${key}`); await go(edgePt(n), client, 'value', 'ok'); out(`Any peer can answer: ${n.t} did.`, 'ok');
    } else {
      const s = shardOf(key), cands = [nodes[s * 2], nodes[s * 2 + 1]].filter((n) => !n.dead), n = cands[Math.floor(Math.random() * cands.length)];
      await go(client, edgePt(n), `get ${key}`); await go(edgePt(n), client, 'value', 'ok'); out(`Shard ${'ABC'[s]} answered from ${n.t}.`, 'ok');
    }
    busy = false;
  }
  async function fail() {
    if (busy) return;
    const idx = m === 'single' ? 0 : m === 'shard' ? 1 : m === 'ms' ? 0 : m === 'p2p' ? 1 : 0;
    const n = nodes[idx];
    n.dead = !n.dead;
    $('#dm-f').textContent = n.dead ? 'Revive it' : 'Fail a node';
    draw();
    if (!n.dead) { out(`${n.t} is back.`, 'ok'); return; }
    if (m === 'single') out('<b>The whole database is down.</b> One server means one point of failure.', 'err');
    if (m === 'shard') out('Shard B is down: keys i–p are unavailable, while shards A and C keep working.', 'warn');
    if (m === 'p2p') out('Node 2 is down. The other peers hold the same data and keep accepting reads and writes.', 'ok');
    if (m === 'ms' || m === 'combo') {
      out(m === 'ms' ? 'The master is down. Slaves still serve reads, but <b>writes stop</b>…' : 'Shard A’s master is down. Writes for keys a–h stop…', 'err');
      busy = true; await sleep(1500);
      const promote = m === 'ms' ? nodes[1] : nodes[1];
      promote.role = 'master'; promote.t = m === 'ms' ? 'Slave 1 → master' : 'A · new master'; promote.s = 'promoted';
      draw(); busy = false;
      out(`${promote.t}: a replica was <b>promoted</b>, and writes resume. (Appointing a new master can be manual or automatic.)`, 'ok');
    }
  }
  async function conflict() {
    if (busy) return; busy = true;
    if (m !== 'p2p') {
      const where = m === 'single' ? 'the only node' : m === 'shard' ? 'the same shard (same key)' : 'the master';
      if (m === 'shard') { const n = nodes[0]; await Promise.all([go(client, edgePt(n), 'alice = 1'), sleep(120).then(() => go(client, edgePt(n), 'alice = 2'))]); }
      else { const n = nodes[0]; await Promise.all([go(client, edgePt(n), 'x = 1'), sleep(120).then(() => go(client, edgePt(n), 'x = 2'))]); }
      out(`Both writes go to ${where}, which applies them one after the other. <b>No conflict.</b>`, 'ok');
    } else {
      const a = nodes[0], b = nodes[2];
      await Promise.all([go(client, edgePt(a), 'seat = Asha'), go(client, edgePt(b), 'seat = Ravi')]);
      a.g?.classList.add('hot'); b.g?.classList.add('hot');
      await Promise.all([go(a.at, b.at, 'Asha', 'bad'), go(b.at, a.at, 'Ravi', 'bad')]);
      out('<b>Write-write conflict.</b> Node 1 says the seat is Asha’s, node 3 says Ravi’s, and both were acknowledged. Fix it by requiring a quorum of nodes to agree before a write succeeds, or by detecting and merging conflicting versions afterwards.', 'err');
    }
    busy = false;
  }
  function pick(x: M) {
    m = x; build(); draw();
    $$('.dist-tabs button').forEach((b) => { const on = b.dataset.m === x; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    $('#dm-k').textContent = pc[x][0]; $('#dm-good').textContent = pc[x][1]; $('#dm-bad').textContent = pc[x][2];
    $('#dm-f').textContent = 'Fail a node';
    out('');
    gsap.from(svg.children, { opacity: 0, x: -10, stagger: 0.015, duration: 0.5, ease: 'expo.out' });
  }
  $$('.dist-tabs button').forEach((b) => b.addEventListener('click', () => pick(b.dataset.m as M)));
  $('#dm-w').addEventListener('click', write);
  $('#dm-r').addEventListener('click', read);
  $('#dm-f').addEventListener('click', fail);
  $('#dm-x').addEventListener('click', conflict);
  pick('single');
}

/* =========================================================== MapReduce word count lab */
export function mrLab() {
  const ta = $<HTMLTextAreaElement>('#mr-text');
  if (!ta) return;
  let Rsel = 2, combSel = false, running = false;
  const h = (w: string) => { let s = 0; for (const c of w) s += c.charCodeAt(0); return s; };
  const words = (line: string) => (line.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  async function run() {
    if (running) return; running = true;
    const R = Rsel, comb = combSel;
    const lines = ta.value.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 4);
    const maps = $('#mr-maps'), shuf = $('#mr-shuf'), reds = $('#mr-reds');
    maps.innerHTML = ''; shuf.innerHTML = ''; reds.innerHTML = '';
    let emitted = 0, sent = 0;
    const perMap: [string, number][][] = lines.map((l) => {
      const ws = words(l); emitted += ws.length;
      if (!comb) return ws.map((w) => [w, 1] as [string, number]);
      const m = new Map<string, number>(); ws.forEach((w) => m.set(w, (m.get(w) ?? 0) + 1));
      return [...m.entries()];
    });
    perMap.forEach((p) => (sent += p.length));
    $('#mr-e').textContent = String(emitted); $('#mr-n').textContent = '0';
    // map
    const mapChips: HTMLElement[][] = [];
    for (let i = 0; i < lines.length; i++) {
      const box = document.createElement('div');
      box.className = 'mr-box m';
      box.innerHTML = `<span>map ${i + 1}${comb ? ' + combiner' : ''}<b>“${esc(lines[i].slice(0, 34))}${lines[i].length > 34 ? '…' : ''}”</b></span><div class="mr-pairs"></div>`;
      maps.appendChild(box);
      gsap.from(box, { opacity: 0, x: -20, duration: 0.5, ease: 'expo.out' });
      const pairs = $('.mr-pairs', box);
      const chips: HTMLElement[] = [];
      for (const [w, c] of perMap[i]) {
        const s = document.createElement('span');
        s.className = `mr-pair p${h(w) % R}`;
        s.textContent = `(${w}, ${c})`;
        pairs.appendChild(s);
        chips.push(s);
        s.animate([{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' });
        await sleep(55);
      }
      mapChips.push(chips);
    }
    await sleep(350);
    // shuffle: group by key inside each reducer partition
    const groups: Map<string, number[]>[] = Array.from({ length: R }, () => new Map());
    perMap.forEach((p) => p.forEach(([w, c]) => { const g = groups[h(w) % R]; g.set(w, [...(g.get(w) ?? []), c]); }));
    const slots: Map<string, HTMLElement>[] = [];
    for (let r = 0; r < R; r++) {
      const box = document.createElement('div');
      box.className = 'mr-box';
      box.innerHTML = `<span>partition ${r} → reducer ${r + 1}<b></b></span><div class="mr-pairs"></div>`;
      shuf.appendChild(box);
      const holder = $('.mr-pairs', box);
      const map = new Map<string, HTMLElement>();
      [...groups[r].keys()].sort().forEach((w) => { const s = document.createElement('span'); s.className = `mr-pair p${r}`; s.style.opacity = '0'; s.dataset.vals = ''; s.textContent = `${w}: [ ]`; holder.appendChild(s); map.set(w, s); });
      slots.push(map);
    }
    let n = 0;
    const flights: Promise<void>[] = [];
    perMap.forEach((p, i) => p.forEach(([w, c], j) => {
      const src = mapChips[i][j], dst = slots[h(w) % R].get(w)!;
      const delay = n++ * 70;
      flights.push(sleep(delay).then(() => new Promise<void>((res) => {
        const a = src.getBoundingClientRect(), b = dst.getBoundingClientRect();
        const fly = src.cloneNode(true) as HTMLElement;
        fly.classList.add('mr-fly');
        fly.style.left = `${a.left}px`; fly.style.top = `${a.top}px`;
        document.body.appendChild(fly);
        src.style.opacity = '0.35';
        const anim = fly.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${b.left - a.left}px, ${b.top - a.top - 30}px)`, offset: 0.5 }, { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px)` }], { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 700, easing: 'cubic-bezier(.65,0,.35,1)' });
        anim.onfinish = () => {
          fly.remove();
          dst.style.opacity = '1';
          const vals = dst.dataset.vals ? dst.dataset.vals.split(',') : [];
          vals.push(String(c));
          dst.dataset.vals = vals.join(',');
          dst.textContent = `${w}: [${vals.join(', ')}]`;
          $('#mr-n').textContent = String(Number($('#mr-n').textContent) + 1);
          res();
        };
      })));
    }));
    await Promise.all(flights);
    await sleep(300);
    // reduce
    let distinct = 0;
    for (let r = 0; r < R; r++) {
      const box = document.createElement('div');
      box.className = 'mr-box r';
      box.innerHTML = `<span>reducer ${r + 1} · output file ${r}<b></b></span><div class="mr-pairs"></div>`;
      reds.appendChild(box);
      const holder = $('.mr-pairs', box);
      for (const [w, vals] of [...groups[r].entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        distinct++;
        const s = document.createElement('span');
        s.className = 'mr-pair out';
        s.textContent = `(${w}, ${vals.reduce((x, y) => x + y, 0)})`;
        holder.appendChild(s);
        s.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 350 });
        await sleep(60);
      }
    }
    $('#mr-k').textContent = String(distinct);
    void sent;
    running = false;
  }
  $$('#mr-r button').forEach((b) => b.addEventListener('click', () => { Rsel = Number(b.dataset.r); $$('#mr-r button').forEach((x) => x.classList.toggle('on', x === b)); }));
  $('#mr-comb').addEventListener('click', () => { combSel = !combSel; const b = $('#mr-comb'); b.textContent = `Combiner: ${combSel ? 'on' : 'off'}`; b.setAttribute('aria-pressed', String(combSel)); b.classList.toggle('on', combSel); });
  $('#mr-run').addEventListener('click', run);
  let started = false;
  new IntersectionObserver(([e]) => { if (e.isIntersecting && !started) { started = true; run(); } }, { threshold: 0.35 }).observe($('#mr-board'));
}

/* =========================================================== archive of notable systems */
export function archive() {
  const host = $('#archive-folders');
  if (!host) return;
  type Item = { name: string; meta: string; art?: ArtPreset; d: string; users: string[]; ul: string };
  const fams: { label: string; art: ArtPreset; seed: number; tag: string; cls: string; items: Item[] }[] = [
    { label: 'Key-value', art: 'aurora', seed: 5, tag: 'Key-value', cls: 'kv', items: [
      { name: 'Redis', meta: 'in-memory', art: 'ember', d: 'An in-memory key-value store whose values can be strings, hashes, lists, sets and counters. Very fast; often used as a cache or session store.', users: ['Craigslist', 'Instagram', 'Stack Overflow', 'Flickr'], ul: 'Users listed in the slides' },
      { name: 'Amazon Dynamo', meta: 'paper · 2007', art: 'glacier', d: 'Amazon’s highly available key-value store, designed so the shopping cart always accepts writes. It inspired DynamoDB, Riak, Voldemort and Cassandra.', users: ['Amazon', 'Elsevier', 'IMDb'], ul: 'Users listed in the slides' },
      { name: 'Riak', meta: 'Dynamo-style', d: 'An open-source, Dynamo-style distributed key-value store with tunable consistency.', users: ['GitHub', 'Comcast', 'Mochi Media'], ul: 'Users listed in the slides' },
      { name: 'Voldemort', meta: 'LinkedIn', art: 'dusk', d: 'LinkedIn’s distributed key-value store, open-sourced in 2009.', users: ['LinkedIn', 'eBay'], ul: 'Users listed in the slides' },
    ] },
    { label: 'Document', art: 'glacier', seed: 9, tag: 'Document', cls: 'doc', items: [
      { name: 'MongoDB', meta: 'BSON', art: 'verdant', d: 'Stores JSON-like documents (BSON) in collections, with rich queries, secondary indexes and, since 4.0, multi-document transactions.', users: ['Foursquare', 'GitHub'], ul: 'Users listed in the slides' },
      { name: 'CouchDB', meta: 'JSON over HTTP', d: 'Stores JSON documents and speaks HTTP. Its views are written as map and reduce functions.', users: ['Apple', 'BBC', 'Canonical', 'CERN'], ul: 'Users listed in the slides' },
      { name: 'Couchbase', meta: 'doc + key-value', art: 'aurora', d: 'A memory-first document and key-value store with a SQL-like query language, SQL++.', users: ['Zynga', 'Vimeo', 'NAVTEQ'], ul: 'Users listed in the slides' },
    ] },
    { label: 'Column family', art: 'ember', seed: 13, tag: 'Column family', cls: 'col', items: [
      { name: 'Bigtable', meta: 'Google · 2006', art: 'dusk', d: 'Google’s sparse, distributed, sorted map indexed by row key, column and timestamp. The original column-family store.', users: ['Gmail', 'Google Maps', 'Web indexing'], ul: 'Google services named in the slides' },
      { name: 'HBase', meta: 'on Hadoop', d: 'An open-source Bigtable design that runs on Hadoop’s HDFS. Facebook’s 2010 Messages system used it.', users: ['Facebook', 'StumbleUpon', 'Hulu', 'Yahoo!'], ul: 'Users listed in the slides' },
      { name: 'Cassandra', meta: 'Facebook · 2008', art: 'glacier', d: 'Combines Dynamo’s peer-to-peer distribution with Bigtable’s data model. The slides list it with key-value stores; it is usually classed as column family.', users: ['Facebook', 'Digg', 'Reddit', 'Twitter'], ul: 'Users listed in the slides' },
    ] },
    { label: 'Graph', art: 'verdant', seed: 17, tag: 'Graph', cls: 'graph', items: [
      { name: 'Neo4j', meta: 'native graph', art: 'aurora', d: 'An open-source native graph database with ACID transactions. Development began in 2003 and it has been public since 2007. Written in Java and Scala; queried with Cypher.', users: ['Community Edition', 'Enterprise Edition: backups, clustering, failover'], ul: 'Editions' },
      { name: 'GraphBase', meta: 'graph store', d: 'A graph database named alongside Neo4j in the textbook’s list of graph-based NoSQL systems.', users: ['Graph-based NoSQL'], ul: 'Category' },
      { name: 'OrientDB', meta: 'multi-model', art: 'ember', d: 'A hybrid system that combines graph, document and key-value ideas in one database.', users: ['Graph', 'Document', 'Key-value'], ul: 'Models combined' },
    ] },
  ];
  const width = () => Math.max(230, Math.min(300, (host.clientWidth - 60) / (innerWidth < 760 ? 1 : innerWidth < 1200 ? 2 : 4)));
  const folders: Folder[] = [];
  fams.forEach((f, i) => {
    const fd = createFolder({
      label: f.label, tone: 'dark', art: f.art, seed: f.seed, action: 'none', width: width(),
      labelPlacement: i % 2 ? 'top-left' : 'bottom-left',
      files: f.items.map((it) => ({ name: it.name, meta: it.meta, art: it.art, key: it.name })),
      onFileSelect: (file) => {
        const it = f.items.find((x) => x.name === file.key)!;
        $('#ar-k').textContent = f.label; const t = $('#ar-tag'); t.textContent = f.tag; t.className = `tag ${f.cls}`;
        $('#ar-h').textContent = it.name;
        $('#ar-p').textContent = it.d;
        $('#ar-users').innerHTML = `<span style="border:0;padding-left:0;color:var(--dim)">${esc(it.ul)}:</span>` + it.users.map((u) => `<span>${esc(u)}</span>`).join('');
        gsap.from('.archive-body > *', { opacity: 0, y: 10, stagger: 0.05, duration: 0.5 });
      },
      onOpenChange: (open) => { if (open) folders.forEach((o) => o !== fd && o.setOpen(false)); },
    });
    fd.el.dataset.delay = String(i * 140);
    folders.push(fd);
    host.appendChild(fd.el);
  });
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = window.setTimeout(() => folders.forEach((f) => f.setWidth(width())), 150); });
}
