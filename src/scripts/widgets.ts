const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T;
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll(s)) as T[];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------------- boot ---------------- */
export async function boot(reduced: boolean) {
  const el = $('#boot');
  if (!el) return;
  if (reduced) { el.remove(); return; }
  const lines = [
    ['mounting module 05', 'ok'],
    ['loading fragments · 3 sites', 'ok'],
    ['two-phase commit coordinator', 'ready'],
    ['joining ring · 9 nodes', 'ok'],
    ['map · shuffle · reduce', 'ok'],
    ['compiling shaders', 'ok'],
  ];
  const n = $('#boot-n'), bar = $('#boot-bar'), log = $('#boot-log');
  const total = 1500, t0 = performance.now();
  let shown = 0;
  await new Promise<void>((res) => {
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / total);
      n.textContent = String(Math.round(p * 100)).padStart(3, '0');
      bar.style.width = `${p * 100}%`;
      const want = Math.floor(p * lines.length);
      while (shown < want) {
        const [a, b] = lines[shown++];
        const li = document.createElement('li');
        li.innerHTML = `${a} <b>…</b> <span>${b}</span>`;
        log.appendChild(li);
      }
      if (p < 1) requestAnimationFrame(tick); else res();
    };
    tick();
  });
}

/* ---------------- phone ---------------- */
type Fam = 'kv' | 'doc' | 'col' | 'graph';
export function phone() {
  const log = $('#qlog');
  const phoneEl = $('#phone');
  if (!log || !phoneEl) return;
  let liked = false, following = false, likes = 812, cart = 0;
  const famName: Record<Fam, string> = { kv: 'Key-value', doc: 'Document', col: 'Wide-column', graph: 'Graph' };
  const acts: Record<string, () => [Fam, string, string, string]> = {
    refresh: () => ['doc', 'MongoDB', 'Load feed', 'db.posts.find({ author: { $in: following } }).sort({ ts: -1 }).limit(20)'],
    like: () => {
      liked = !liked; likes += liked ? 1 : -1;
      const b = $('[data-act="like"]', phoneEl);
      b.classList.toggle('liked', liked); $('span', b).textContent = String(likes);
      return ['kv', 'Redis', liked ? 'Like' : 'Unlike', liked ? 'INCR post:812:likes' : 'DECR post:812:likes'];
    },
    follow: () => {
      following = !following;
      const b = $('[data-act="follow"]', phoneEl);
      b.classList.toggle('on', following); b.textContent = following ? 'Following' : 'Follow';
      return following
        ? ['graph', 'Neo4j', 'Follow', "MATCH (a:User {id: 'u1'}), (b:User {id: 'mira.k'}) MERGE (a)-[:FOLLOWS]->(b)"]
        : ['graph', 'Neo4j', 'Unfollow', "MATCH (:User {id: 'u1'})-[f:FOLLOWS]->(:User {id: 'mira.k'}) DELETE f"];
    },
    cart: () => {
      cart++;
      $('[data-act="cart"]', phoneEl).textContent = `+ Cart (${cart})`;
      return ['kv', 'Redis', 'Add to cart', 'HINCRBY cart:u1 sku-2291 1'];
    },
    view: () => ['col', 'Cassandra', 'Record a view', "INSERT INTO post_views (post_id, ts, user_id) VALUES (812, now(), 'u1');"],
  };
  function push(name: string) {
    const [fam, store, label, code] = acts[name]();
    const li = document.createElement('li');
    li.className = fam;
    li.innerHTML = `<div class="meta"><span>${label}</span><span>${famName[fam]} · ${store}</span></div><code>${esc(code)}</code>`;
    log.prepend(li);
    li.animate([{ opacity: 0, transform: 'translateX(20px)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.22,1,.36,1)' });
    while (log.childElementCount > 5) log.lastElementChild!.remove();
  }
  let last = performance.now();
  phoneEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!b) return;
    last = performance.now();
    push(b.dataset.act!);
  });
  push('refresh');
  const order = ['like', 'view', 'follow', 'cart', 'refresh', 'like', 'view'];
  let i = 0, visible = false;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(phoneEl);
  setInterval(() => {
    if (!visible || performance.now() - last < 4500) return;
    const name = order[i++ % order.length];
    const b = $(`[data-act="${name}"]`, phoneEl);
    b?.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.86)' }, { transform: 'scale(1)' }], { duration: 300 });
    push(name);
  }, 2400);
}

/* ---------------- relational hover ---------------- */
export function relational() {
  const sql = $('#rel-sql');
  $$('#t-students tbody tr').forEach((tr) => {
    const on = () => {
      const reg = tr.dataset.reg!;
      $$('#t-students tbody tr').forEach((r) => r.classList.toggle('hot', r === tr));
      $$('#t-enrol tbody tr').forEach((r) => r.classList.toggle('hot2', r.dataset.reg === reg));
      sql.innerHTML = `<span class="kw">SELECT</span> s.name, e.course\n<span class="kw">FROM</span> students s\n<span class="kw">JOIN</span> enrolments e <span class="kw">ON</span> e.reg_no = s.reg_no\n<span class="kw">WHERE</span> s.reg_no = <span class="str">'${reg}'</span>;`;
    };
    tr.addEventListener('mouseenter', on);
    tr.addEventListener('click', on);
  });
  $$('#t-students tbody tr')[1]?.dispatchEvent(new Event('mouseenter'));
}

/* ---------------- scale lab ---------------- */
export function scaleLab(): (p: number) => void {
  const slider = $<HTMLInputElement>('#traffic');
  const tiers = [
    { n: '4 vCPU', cap: 10e3, cost: 1, px: 70 },
    { n: '16 vCPU', cap: 40e3, cost: 5, px: 115 },
    { n: '64 vCPU', cap: 150e3, cost: 24, px: 160 },
    { n: '192 vCPU', cap: 400e3, cost: 110, px: 205 },
  ];
  const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n)));
  const outStage = $('#stage-out');
  let lastNodes = -1;
  function update() {
    const v = Number(slider.value);
    const rps = 1000 * Math.pow(10, (v / 1000) * 4);
    $('#traffic-out').textContent = `${fmt(rps)} req/s`;
    let tier = tiers.find((t) => rps / t.cap <= 0.85) ?? tiers[tiers.length - 1];
    const load = rps / tier.cap;
    const over = load > 1;
    const box = $('#big-box');
    box.style.width = `${tier.px}px`; box.style.height = `${tier.px * 1.15}px`;
    box.classList.toggle('hot', over);
    $('#ceiling').classList.toggle('on', tier === tiers[tiers.length - 1]);
    $('#up-size').textContent = over ? `${tier.n} · maxed` : tier.n;
    const upLoad = $('#up-load');
    upLoad.textContent = over ? `${Math.round(load * 100)}% · dropping requests` : `${Math.round(load * 100)}%`;
    upLoad.classList.toggle('bad', over);
    const ub = $('#up-bar');
    ub.style.width = `${Math.min(100, load * 100)}%`;
    ub.className = load > 1 ? 'bad' : load > 0.7 ? 'warn' : '';
    $('#up-cost').textContent = `${tier.cost}×`;

    const nodes = Math.max(1, Math.ceil(rps / (10e3 * 0.7)));
    const per = rps / (nodes * 10e3);
    $('#out-n').textContent = String(nodes);
    $('#out-load').textContent = `${Math.round(per * 100)}%`;
    const ob = $('#out-bar');
    ob.style.width = `${per * 100}%`;
    ob.className = per > 0.7 ? 'warn' : '';
    $('#out-cost').textContent = `${nodes}×`;
    if (nodes !== lastNodes) {
      const show = Math.min(nodes, 96);
      const have = outStage.querySelectorAll('i').length;
      if (show > have) for (let i = have; i < show; i++) outStage.insertBefore(document.createElement('i'), outStage.querySelector('.more'));
      else for (let i = have; i > show; i--) outStage.querySelectorAll('i')[i - 1].remove();
      let more = outStage.querySelector('.more');
      if (nodes > 96) {
        if (!more) { more = document.createElement('span'); more.className = 'more'; outStage.appendChild(more); }
        more.textContent = `+${nodes - 96} more`;
      } else more?.remove();
      lastNodes = nodes;
    }
  }
  slider.addEventListener('input', update);
  update();
  return (p: number) => { slider.value = String(Math.round(Math.min(1, Math.max(0, p)) * 1000)); update(); };
}

/* ---------------- join explorer ---------------- */
export function joinExplorer() {
  const doc = $('#jx-doc');
  let city = 'Pune', running = false;
  const docText = () => `{
  "_id": 1042,
  "date": "2026-10-12",
  "customer": { "id": 7, "name": "Asha", "city": "${city}" },
  "items": [
    { "sku": 31, "name": "Mug", "price": 299, "qty": 2 },
    { "sku": 58, "name": "Pen", "price": 49,  "qty": 1 }
  ],
  "total": 647
}`;
  const render = () => { doc.textContent = docText(); };
  render();
  const T = (t: string) => $(`.jx-t[data-t="${t}"]`);
  const sql = $('#jx-sql'), mq = $('#jx-mq');
  function reset() {
    $$('.jx-t, .jx-t li, #jx-doc').forEach((e) => e.classList.remove('lit'));
    ['#jx-s-t', '#jx-s-j', '#jx-d-r', '#jx-d-u'].forEach((s) => ($(s).textContent = '0'));
    sql.innerHTML = '<span class="dim">-- waiting</span>';
    mq.innerHTML = '<span class="dim">// waiting</span>';
  }
  $('#jx-fetch').addEventListener('click', async () => {
    if (running) return; running = true; reset();
    doc.classList.add('lit'); $('#jx-d-r').textContent = '1';
    mq.innerHTML = `db.orders.<span class="kw">findOne</span>({ _id: <span class="num">1042</span> })\n<span class="ok">// 1 read · whole order returned</span>`;
    const steps: [string, string[], string, number][] = [
      ['orders', ['o1042'], `<span class="kw">SELECT</span> o.id, o.date, c.name, c.city, p.name, i.qty, p.price\n<span class="kw">FROM</span> orders o`, 0],
      ['customers', ['c7'], `\n<span class="kw">JOIN</span> customers c <span class="kw">ON</span> c.id = o.customer_id`, 1],
      ['order_items', ['i1', 'i2'], `\n<span class="kw">JOIN</span> order_items i <span class="kw">ON</span> i.order_id = o.id`, 2],
      ['products', ['p31', 'p58'], `\n<span class="kw">JOIN</span> products p <span class="kw">ON</span> p.sku = i.sku\n<span class="kw">WHERE</span> o.id = <span class="num">1042</span>;`, 3],
    ];
    sql.innerHTML = '';
    for (const [t, rows, txt, joins] of steps) {
      T(t).classList.add('lit');
      rows.forEach((r) => $(`[data-r="${r}"]`).classList.add('lit'));
      sql.innerHTML += txt;
      $('#jx-s-t').textContent = String($$('.jx-t.lit').length);
      $('#jx-s-j').textContent = String(joins);
      await sleep(650);
    }
    sql.innerHTML += `\n<span class="ok">-- 2 result rows, assembled from 4 tables</span>`;
    running = false;
  });
  $('#jx-city').addEventListener('click', () => {
    reset();
    city = city === 'Pune' ? 'Bengaluru' : 'Pune';
    render();
    $('[data-r="c7"]').textContent = `7 · Asha · ${city}`;
    T('customers').classList.add('lit'); $('[data-r="c7"]').classList.add('lit');
    doc.classList.add('lit');
    sql.innerHTML = `<span class="kw">UPDATE</span> customers <span class="kw">SET</span> city = <span class="str">'${city}'</span> <span class="kw">WHERE</span> id = <span class="num">7</span>;\n<span class="ok">-- 1 row. Every join sees the new city.</span>`;
    mq.innerHTML = `db.orders.<span class="kw">updateMany</span>(\n  { <span class="str">"customer.id"</span>: <span class="num">7</span> },\n  { $set: { <span class="str">"customer.city"</span>: <span class="str">"${city}"</span> } })\n<span class="err">// 3 orders copied Asha's city. Miss one and data disagrees.</span>`;
    $('#jx-s-t').textContent = '1'; $('#jx-d-u').textContent = '3';
    $('#jx-note').textContent = 'This is the duplication trade-off. Many teams keep the copy (an order should show the address it shipped to) or store only the customer id and look it up.';
  });
  $('#jx-reset').addEventListener('click', () => { city = 'Pune'; render(); $('[data-r="c7"]').textContent = '7 · Asha · Pune'; reset(); });
}

/* ---------------- schema ---------------- */
export function schema() {
  const table = $<HTMLTableElement>('#schema-table');
  const ddl = $('#schema-ddl'), dml = $('#schema-dml'), docsEl = $('#schema-docs');
  const vals: Record<string, [string, string, string]> = {
    phone: ['VARCHAR(15)', '"98xxxxxx12"', "'98xxxxxx12'"],
    tags: ['TEXT[]', '["beta", "vip"]', "ARRAY['beta', 'vip']"],
    loyalty: ['VARCHAR(10)', '"gold"', "'gold'"],
  };
  const colName: Record<string, string> = { phone: 'phone', tags: 'tags', loyalty: 'loyalty_tier' };
  let docs: Record<string, string>[] = [];
  let added: string[] = [], docTouched = 0, migrations = 0;
  const baseDocs = () => [
    { _id: '1', name: '"Asha"', email: '"asha@mail.in"' },
    { _id: '2', name: '"Ravi"', email: '"ravi@mail.in"' },
    { _id: '3', name: '"Meera"', email: '"meera@mail.in"' },
  ];
  function renderDocs(fresh?: string) {
    docsEl.innerHTML = '';
    docs.forEach((d, i) => {
      const div = document.createElement('div');
      div.className = 'sdoc' + (fresh && i === 2 ? ' new' : '');
      const parts = Object.entries(d).map(([k, v]) => {
        const line = `${k}: ${v}`;
        return k === fresh ? `<span class="added">${esc(line)}</span>` : esc(line);
      });
      div.innerHTML = `{ ${parts.join(', ')} }`;
      docsEl.appendChild(div);
    });
  }
  function counts() {
    const cols = 3 + added.length;
    $('#sc-rows').textContent = String(cols);
    $('#sc-null').textContent = String(added.length * 2);
    $('#sc-mig').textContent = String(migrations);
    $('#sd-rows').textContent = String(docTouched);
  }
  function reset() {
    added = []; docTouched = 0; migrations = 0; docs = baseDocs();
    table.tHead!.rows[0].innerHTML = '<th>id</th><th>name</th><th>email</th>';
    const names = [['1', 'Asha', 'asha@mail.in'], ['2', 'Ravi', 'ravi@mail.in'], ['3', 'Meera', 'meera@mail.in']];
    table.tBodies[0].innerHTML = names.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
    ddl.innerHTML = '<span class="dim">-- CREATE TABLE users (id INT PRIMARY KEY, name TEXT, email TEXT);</span>';
    dml.innerHTML = '<span class="dim">// no schema declared. Each document carries its own fields.</span>';
    $$('[data-field]').forEach((b) => ((b as HTMLButtonElement).disabled = false));
    renderDocs(); counts();
  }
  $$('[data-field]').forEach((b) => b.addEventListener('click', () => {
    const f = b.dataset.field!;
    if (added.includes(f)) return;
    added.push(f); migrations++; docTouched++;
    (b as HTMLButtonElement).disabled = true;
    const [type, val, sqlVal] = vals[f];
    ddl.innerHTML = `<span class="kw">ALTER TABLE</span> users <span class="kw">ADD COLUMN</span> ${colName[f]} ${type};\n<span class="kw">UPDATE</span> users <span class="kw">SET</span> ${colName[f]} = <span class="str">${esc(sqlVal)}</span> <span class="kw">WHERE</span> id = <span class="num">3</span>;\n<span class="dim">-- run in dev, staging and production. Old rows get NULL.</span>`;
    const th = document.createElement('th'); th.textContent = colName[f]; th.className = 'newcol';
    table.tHead!.rows[0].appendChild(th);
    Array.from(table.tBodies[0].rows).forEach((tr, i) => {
      const td = document.createElement('td');
      td.className = 'newcol' + (i === 2 ? '' : ' null');
      td.textContent = i === 2 ? val.replace(/"/g, '') : 'NULL';
      tr.appendChild(td);
    });
    docs[2][colName[f]] = val;
    dml.innerHTML = `db.users.<span class="kw">updateOne</span>({ _id: <span class="num">3</span> }, { $set: { ${colName[f]}: <span class="str">${esc(val)}</span> } })\n<span class="ok">// one document changed. The other two are untouched.</span>`;
    renderDocs(colName[f]);
    counts();
  }));
  $('#schema-reset').addEventListener('click', reset);
  reset();
}

/* ---------------- key-value console ---------------- */
export function kvConsole() {
  const store = new Map<string, string>([
    ['session:9f3a', '{"user":"u1","exp":"20:00"}'],
    ['post:812:likes', '812'],
    ['cart:u1', 'sku-2291'],
    ['user:u1:name', 'Asha'],
    ['rate:u1:min', '14'],
  ]);
  const grid = $('#kv-store'), out = $('#kv-out'), input = $<HTMLInputElement>('#kv-in');
  function render(flash?: string) {
    grid.innerHTML = '';
    for (const [k, v] of store) {
      const d = document.createElement('div');
      if (k === flash) d.className = 'flash';
      d.innerHTML = `<span>${esc(k)}</span><span>${esc(v)}</span>`;
      grid.appendChild(d);
    }
  }
  function print(cmd: string, res: string, cls = '') {
    out.innerHTML += `<span class="p">&gt;</span> ${esc(cmd)}\n<span class="${cls}">${esc(res)}</span>\n`;
    out.scrollTop = out.scrollHeight;
  }
  function run(raw: string) {
    const line = raw.trim();
    if (!line) return;
    const [c0, k, ...rest] = line.split(/\s+/);
    const cmd = c0.toUpperCase();
    let flash: string | undefined;
    if (cmd === 'GET' && k) print(line, store.has(k) ? `"${store.get(k)}"` : '(nil)', store.has(k) ? 'ok' : 'dim');
    else if (cmd === 'SET' && k && rest.length) { store.set(k, rest.join(' ')); flash = k; print(line, 'OK', 'ok'); }
    else if (cmd === 'DEL' && k) { const had = store.delete(k); print(line, `(integer) ${had ? 1 : 0}`, had ? 'ok' : 'dim'); }
    else if (cmd === 'EXISTS' && k) print(line, `(integer) ${store.has(k) ? 1 : 0}`);
    else if ((cmd === 'INCR' || cmd === 'DECR') && k) {
      const cur = store.get(k) ?? '0';
      if (!/^-?\d+$/.test(cur)) print(line, '(error) ERR value is not an integer or out of range', 'err');
      else { const n = Number(cur) + (cmd === 'INCR' ? 1 : -1); store.set(k, String(n)); flash = k; print(line, `(integer) ${n}`, 'ok'); }
    } else if (cmd === 'KEYS') {
      const pat = new RegExp('^' + (k ?? '*').replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
      const ks = [...store.keys()].filter((x) => pat.test(x));
      print(line, ks.length ? ks.map((x, i) => `${i + 1}) "${x}"`).join('\n') : '(empty array)');
    } else print(line, `(error) ERR unknown or incomplete command. Try GET, SET, DEL, INCR, DECR, EXISTS, KEYS`, 'err');
    render(flash);
  }
  $('#kv-form').addEventListener('submit', (e) => { e.preventDefault(); run(input.value); input.value = ''; });
  $$('#kv-quick [data-cmd]').forEach((b) => b.addEventListener('click', () => run(b.dataset.cmd!)));
  render();
  out.innerHTML = '<span class="dim"># the store only understands keys. Values are opaque blobs.</span>\n';
  run('GET user:u1:name');
}

/* ---------------- document filter ---------------- */
export function docFilter() {
  const products: Record<string, unknown>[] = [
    { _id: 1, name: 'Studio Headphones', category: 'audio', price: 2499, inStock: true, tags: ['wired', 'studio'] },
    { _id: 2, name: 'Field Recorder', category: 'audio', price: 8999, inStock: true, tags: ['portable'] },
    { _id: 3, name: 'Wireless Earbuds', category: 'audio', price: 1999, inStock: false, tags: ['wireless', 'sport'] },
    { _id: 4, name: 'Database Internals', category: 'books', price: 899, inStock: true, author: 'Alex Petrov' },
    { _id: 5, name: 'Bluetooth Speaker', category: 'audio', price: 2799, inStock: true, tags: ['wireless', 'portable'], battery_h: 12 },
    { _id: 6, name: 'Mech Keyboard', category: 'input', price: 4599, inStock: true, tags: ['wireless'], switches: 'brown' },
  ];
  const on = new Set<string>(['cat']);
  const list = $('#doc-list'), q = $('#doc-q');
  const tests: Record<string, [(d: any) => boolean, string]> = {
    cat: [(d) => d.category === 'audio', 'category: <span class="str">"audio"</span>'],
    price: [(d) => d.price < 3000, 'price: { $lt: <span class="num">3000</span> }'],
    stock: [(d) => d.inStock === true, 'inStock: <span class="kw">true</span>'],
    tag: [(d) => Array.isArray(d.tags) && d.tags.includes('wireless'), 'tags: <span class="str">"wireless"</span>'],
  };
  function fmt(d: Record<string, unknown>) {
    return '{\n' + Object.entries(d).map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`).join(',\n') + '\n}';
  }
  function render() {
    const act = [...on];
    q.innerHTML = `db.products.<span class="kw">find</span>({ ${act.map((a) => tests[a][1]).join(', ')} })`;
    list.innerHTML = '';
    let n = 0;
    products.forEach((d) => {
      const m = act.every((a) => tests[a][0](d));
      if (m) n++;
      const c = document.createElement('div');
      c.className = 'doc-card' + (m ? ' match' : '');
      c.textContent = fmt(d);
      list.appendChild(c);
    });
    $('#doc-count').innerHTML = `<b>${n} of ${products.length}</b> documents match. Notice the fields differ: books have an author, speakers a battery life. One collection holds them all. <code>tags: "wireless"</code> matches inside the array.`;
    $$('#doc-chips [data-f]').forEach((b) => b.classList.toggle('on', on.has(b.dataset.f!)));
  }
  $$('#doc-chips [data-f]').forEach((b) => b.addEventListener('click', () => {
    const f = b.dataset.f!;
    on.has(f) ? on.delete(f) : on.add(f);
    render();
  }));
  render();
}

/* ---------------- wide column ---------------- */
export function columnStore() {
  type Row = { ts: string; cells: [string, string][]; isNew?: boolean };
  const parts: Record<string, Row[]> = {
    's-17': [
      { ts: '20:14:05', cells: [['temp', '24.6'], ['hum', '61']] },
      { ts: '20:13:05', cells: [['temp', '24.8'], ['hum', '60']] },
      { ts: '20:12:05', cells: [['temp', '25.1']] },
      { ts: '20:11:05', cells: [['temp', '25.0'], ['hum', '59'], ['battery', '88%']] },
    ],
    's-04': [
      { ts: '20:14:02', cells: [['temp', '19.2'], ['hum', '72']] },
      { ts: '20:13:02', cells: [['temp', '19.4'], ['hum', '71']] },
    ],
  };
  const wrap = $('#col-wrap'), cql = $('#col-cql');
  const token = (s: string) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 6; };
  let queried = false;
  const schemaText = `<span class="kw">CREATE TABLE</span> readings (sensor_id text, ts timestamp, temp float, hum int, battery text,\n  <span class="kw">PRIMARY KEY</span> ((sensor_id), ts)) <span class="kw">WITH CLUSTERING ORDER BY</span> (ts <span class="kw">DESC</span>);`;
  function render() {
    wrap.innerHTML = '';
    for (const [id, rows] of Object.entries(parts)) {
      const p = document.createElement('div');
      p.className = 'part';
      p.innerHTML = `<header><span>partition <b>${id}</b></span><span>token → node ${token(id) + 1} of 6 · ${rows.length} rows</span></header>`;
      const rs = document.createElement('div');
      rs.className = 'rows';
      rows.slice(0, 7).forEach((r, i) => {
        const d = document.createElement('div');
        d.className = 'row' + (queried && id === 's-17' && i < 3 ? ' q' : '') + (r.isNew ? ' new' : '');
        d.innerHTML = `<span class="ts">${r.ts}</span>${r.cells.map(([k, v]) => `<span class="c">${k}=${v}</span>`).join('')}`;
        rs.appendChild(d);
        r.isNew = false;
      });
      if (rows.length > 7) rs.insertAdjacentHTML('beforeend', `<div class="row"><span class="ts">…</span><span class="c">${rows.length - 7} older rows</span></div>`);
      p.appendChild(rs);
      wrap.appendChild(p);
    }
  }
  let clock = 20 * 3600 + 14 * 60 + 5;
  $('#col-ingest').addEventListener('click', () => {
    clock += 60;
    const id = Math.random() < 0.7 ? 's-17' : 's-04';
    const t = `${String(Math.floor(clock / 3600)).padStart(2, '0')}:${String(Math.floor((clock % 3600) / 60)).padStart(2, '0')}:${id === 's-17' ? '05' : '02'}`;
    const temp = (id === 's-17' ? 24 : 19) + Math.round(Math.random() * 15) / 10;
    const withHum = Math.random() < 0.7, hum = 55 + Math.floor(Math.random() * 20);
    const cells: [string, string][] = [['temp', temp.toFixed(1)]];
    if (withHum) cells.push(['hum', String(hum)]);
    parts[id].unshift({ ts: t, cells, isNew: true });
    cql.innerHTML = `<span class="kw">INSERT INTO</span> readings (sensor_id, ts, temp${withHum ? ', hum' : ''})\n  <span class="kw">VALUES</span> (<span class="str">'${id}'</span>, <span class="str">'2026-10-12 ${t}'</span>, <span class="num">${temp.toFixed(1)}</span>${withHum ? `, <span class="num">${hum}</span>` : ''});\n<span class="dim">-- appended at the head of its partition. ${withHum ? '' : 'No hum value written, so no hum cell is stored.'}</span>`;
    render();
  });
  $('#col-query').addEventListener('click', () => {
    queried = true;
    cql.innerHTML = `<span class="kw">SELECT</span> ts, temp, hum <span class="kw">FROM</span> readings\n  <span class="kw">WHERE</span> sensor_id = <span class="str">'s-17'</span> <span class="kw">LIMIT</span> <span class="num">3</span>;\n<span class="ok">-- one partition, already sorted newest first: a single contiguous read</span>`;
    render();
  });
  $('#col-clear').addEventListener('click', () => { queried = false; cql.innerHTML = schemaText; render(); });
  cql.innerHTML = schemaText;
  render();
}

/* ---------------- graph ---------------- */
export function graph() {
  const svg = $<SVGSVGElement>('#graph-svg');
  const cy = $('#g-cy');
  const P: Record<string, [number, number]> = {
    Asha: [90, 80], Ravi: [230, 50], Meera: [180, 190], Kabir: [330, 140], Zoya: [460, 70],
    Dev: [440, 230], Ira: [300, 280], Arjun: [80, 260], Nina: [370, 30],
  };
  const E: [string, string][] = [
    ['Asha', 'Ravi'], ['Asha', 'Meera'], ['Ravi', 'Kabir'], ['Ravi', 'Nina'], ['Meera', 'Ira'], ['Meera', 'Kabir'],
    ['Kabir', 'Zoya'], ['Kabir', 'Dev'], ['Ira', 'Dev'], ['Arjun', 'Asha'], ['Arjun', 'Meera'], ['Nina', 'Zoya'], ['Dev', 'Zoya'], ['Ira', 'Arjun'],
  ];
  const NS = 'http://www.w3.org/2000/svg';
  const defs = document.createElementNS(NS, 'defs');
  defs.innerHTML = `<marker id="arr" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#5d646c"/></marker>`;
  svg.appendChild(defs);
  const edgeEls = E.map(([a, b]) => {
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', String(P[a][0])); l.setAttribute('y1', String(P[a][1]));
    l.setAttribute('x2', String(P[b][0])); l.setAttribute('y2', String(P[b][1]));
    l.setAttribute('class', 'edge'); l.setAttribute('marker-end', 'url(#arr)');
    svg.appendChild(l);
    return { a, b, l };
  });
  const nodeEls: Record<string, SVGGElement> = {};
  for (const [name, [x, y]] of Object.entries(P)) {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'node'); g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button');
    g.setAttribute('aria-label', `Select ${name}`);
    g.innerHTML = `<circle cx="${x}" cy="${y}" r="20"/><text x="${x}" y="${y + 4}">${name}</text>`;
    g.addEventListener('click', () => select(name));
    g.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') { e.preventDefault(); select(name); } });
    svg.appendChild(g);
    nodeEls[name] = g;
  }
  function select(me: string) {
    const h1 = new Set(E.filter(([a]) => a === me).map(([, b]) => b));
    const h2 = new Set<string>();
    h1.forEach((f) => E.filter(([a]) => a === f).forEach(([, b]) => { if (b !== me && !h1.has(b)) h2.add(b); }));
    for (const [n, g] of Object.entries(nodeEls)) g.setAttribute('class', 'node' + (n === me ? ' src' : h1.has(n) ? ' h1' : h2.has(n) ? ' h2' : ''));
    edgeEls.forEach(({ a, b, l }) => l.setAttribute('class', 'edge' + (a === me && h1.has(b) ? ' h1' : h1.has(a) && h2.has(b) ? ' h2' : '')));
    cy.innerHTML = `<span class="kw">MATCH</span> (me:Person {name: <span class="str">'${me}'</span>})-[:FOLLOWS]-&gt;(f)-[:FOLLOWS]-&gt;(fof)\n<span class="kw">WHERE NOT EXISTS</span> { (me)-[:FOLLOWS]-&gt;(fof) } <span class="kw">AND</span> fof &lt;&gt; me\n<span class="kw">RETURN DISTINCT</span> fof.name  <span class="ok">// ${h2.size ? 'suggest: ' + [...h2].join(', ') : 'no suggestions'}</span>`;
  }
  select('Asha');
}

/* ---------------- consistency lab ---------------- */
export function consistencyLab() {
  const N = 3;
  let W = 1, R = 1, version = 1, acked = 1, writeAt = 0;
  const reps = ['n1', 'n2', 'n3'].map((id) => ({ id, val: 299, ver: 1, down: false, el: null as unknown as HTMLElement }));
  const host = $('#replicas'), res = $('#c-result');
  reps.forEach((r) => {
    const d = document.createElement('div');
    d.className = 'rep';
    d.innerHTML = `<span class="nm"><span>replica ${r.id}</span><span class="st">online</span></span><span class="val">₹${r.val}</span><span class="ver">version ${r.ver}</span><div class="pend"><i></i></div><button type="button" class="btn part-btn">Cut off</button>`;
    host.appendChild(d);
    r.el = d;
    $('.part-btn', d).addEventListener('click', () => {
      r.down = !r.down;
      d.classList.toggle('down', r.down);
      $('.part-btn', d).textContent = r.down ? 'Reconnect' : 'Cut off';
      $('.st', d).textContent = r.down ? 'partitioned' : 'online';
      if (!r.down) {
        const best = reps.reduce((a, b) => (b.ver > a.ver && !b.down ? b : a));
        if (best.ver > r.ver) {
          setTimeout(() => { r.val = best.val; r.ver = best.ver; paint(r); flash(r, 'flash'); say(`Replica ${r.id} reconnected and caught up to version ${r.ver} (anti-entropy repair).`, 'ok'); }, 900);
        }
      }
    });
  });
  function paint(r: (typeof reps)[number]) {
    $('.val', r.el).textContent = `₹${r.val}`;
    $('.ver', r.el).textContent = `version ${r.ver}`;
    r.el.classList.toggle('stale', r.ver < version);
  }
  function flash(r: (typeof reps)[number], cls: string) {
    r.el.classList.add(cls);
    setTimeout(() => r.el.classList.remove(cls), 900);
  }
  function say(t: string, cls: '' | 'ok' | 'warn' | 'err' = '') { res.textContent = t; res.className = 'lab-result ' + cls; }
  function rule() {
    $('#cw').textContent = String(W); $('#cr').textContent = String(R);
    const s = R + W, good = s > N;
    $('#rule-eq').textContent = `${R} + ${W} = ${s} ${good ? '>' : '≤'} ${N}`;
    $('#rule-txt').textContent = good
      ? 'Read and write sets always overlap: you see the latest acknowledged write.'
      : 'Fast, but a read can miss the newest write (eventual consistency).';
    $('#rule-box').className = 'rule-box ' + (good ? 'good' : 'bad');
  }
  $$('[data-st]').forEach((b) => b.addEventListener('click', () => {
    const d = Number(b.dataset.d);
    if (b.dataset.st === 'w') W = Math.min(N, Math.max(1, W + d)); else R = Math.min(N, Math.max(1, R + d));
    rule();
  }));
  setInterval(() => { if (writeAt) $('#c-clock').textContent = `t = ${Math.min(99999, Math.round(performance.now() - writeAt))} ms since last write`; }, 120);
  $('#c-write').addEventListener('click', () => {
    const v = ++version, price = 299 + Math.round(Math.random() * 20) * 10;
    writeAt = performance.now();
    reps.forEach(paint);
    const reachable = reps.filter((r) => !r.down);
    if (reachable.length < W) {
      say(`Write rejected: W = ${W} but only ${reachable.length} replica${reachable.length === 1 ? ' is' : 's are'} reachable. The system chose consistency over availability. (Reachable replicas may still apply it; real systems repair this later.)`, 'err');
    } else say(`Writing ₹${price} (version ${v}). Waiting for ${W} acknowledgement${W > 1 ? 's' : ''}…`, 'warn');
    let acks = 0;
    reachable.forEach((r) => {
      const delay = 350 + Math.random() * 2200;
      const bar = $('.pend i', r.el);
      bar.animate([{ width: '0%' }, { width: '100%' }], { duration: delay, fill: 'forwards' });
      setTimeout(() => {
        if (r.down) return;
        if (v >= r.ver) { r.val = price; r.ver = v; }
        paint(r); flash(r, 'flash');
        acks++;
        if (acks === W && reachable.length >= W) {
          acked = Math.max(acked, v);
          say(`Write acknowledged after ${W} replica${W > 1 ? 's' : ''} (${Math.round(performance.now() - writeAt)} ms). ${W < N ? 'The rest are still catching up. Read now.' : 'Every replica has it.'}`, 'ok');
        }
        reps.forEach(paint);
      }, delay);
    });
  });
  $('#c-read').addEventListener('click', () => {
    const reachable = reps.filter((r) => !r.down);
    if (reachable.length < R) { say(`Read failed: R = ${R} but only ${reachable.length} replica${reachable.length === 1 ? ' is' : 's are'} reachable.`, 'err'); return; }
    const pick = reachable.sort(() => Math.random() - 0.5).slice(0, R);
    pick.forEach((r) => flash(r, 'read'));
    const best = pick.reduce((a, b) => (b.ver > a.ver ? b : a));
    const stale = best.ver < acked;
    const pending = best.ver < version;
    say(
      `Asked ${pick.map((p) => p.id).join(', ')} → returned ₹${best.val} (version ${best.ver}). ` +
      (stale ? `Stale: version ${acked} was already acknowledged.` : pending && version > acked ? 'Fresh for every acknowledged write; the newest write is not acknowledged yet.' : 'This is the latest value.'),
      stale ? 'warn' : 'ok',
    );
  });
  rule();
}

/* ---------------- compare + flips ---------------- */
export function compareAndFlips() {
  const b = $('#cmp-blur');
  b?.addEventListener('click', () => {
    const on = $('#compare').classList.toggle('show-blur');
    b.setAttribute('aria-pressed', String(on));
    b.classList.toggle('on', on);
    b.textContent = on ? 'Hide the nuances' : 'Show where the line blurs';
  });
  $$('.flip').forEach((f) => f.addEventListener('click', () => f.classList.toggle('on')));
}

/* ---------------- chooser ---------------- */
export function chooser() {
  type M = 'rel' | 'kv' | 'doc' | 'wide' | 'graph';
  const names: Record<M, string> = { rel: 'Relational', kv: 'Key-value', doc: 'Document', wide: 'Wide-column', graph: 'Graph' };
  const why: Record<M, string> = {
    rel: 'Uniform data, ad hoc questions and multi-row transactions are exactly what relational databases were built for. Start here unless something forces you off it.',
    kv: 'Access is by ID and must be fast at scale. A key-value store does one thing extremely well: get and put by key.',
    doc: 'Records vary in shape and you filter on their fields. Documents mirror your objects and still index well.',
    wide: 'Huge volumes of time-ordered writes, read back by partition and time range: the wide-column sweet spot.',
    graph: 'The questions are about connections. A graph database follows relationships hop by hop without join explosions.',
  };
  const S: Record<string, Partial<Record<M, number>>> = {
    rows: { rel: 3, doc: 1, wide: 1 }, nested: { doc: 3, rel: 1 }, events: { wide: 3, kv: 1, rel: 1 }, links: { graph: 3, rel: 1 }, blobs: { kv: 3, doc: 1 },
    adhoc: { rel: 3, doc: 1 }, key: { kv: 3, doc: 1, wide: 1 }, fields: { doc: 3, rel: 2 }, range: { wide: 3, rel: 1 }, traverse: { graph: 3 },
    must: { rel: 3, doc: 1 }, some: { rel: 1, doc: 2, kv: 1, graph: 1 }, no: { kv: 2, wide: 2, doc: 1, graph: 1 },
    one: { rel: 2, graph: 1, doc: 1 }, grow: { doc: 2, kv: 1, wide: 1, rel: 1 }, huge: { wide: 3, kv: 3, doc: 1 },
  };
  const presets: Record<string, string[]> = {
    bank: ['rows', 'adhoc', 'must', 'grow'], iot: ['events', 'range', 'no', 'huge'],
    social: ['links', 'traverse', 'some', 'huge'], shop: ['nested', 'fields', 'some', 'grow'],
  };
  const form = $<HTMLFormElement>('#ch-form');
  const bars = $('#ch-bars');
  const order: M[] = ['rel', 'doc', 'kv', 'wide', 'graph'];
  function calc() {
    const fd = new FormData(form);
    const score: Record<M, number> = { rel: 0, kv: 0, doc: 0, wide: 0, graph: 0 };
    ['q1', 'q2', 'q3', 'q4'].forEach((q) => { const v = fd.get(q) as string; for (const [m, s] of Object.entries(S[v] ?? {})) score[m as M] += s!; });
    const max = Math.max(...Object.values(score));
    const top = order.find((m) => score[m] === max)!;
    $('#ch-pick').textContent = names[top];
    $('#ch-why').textContent = why[top];
    bars.innerHTML = order.map((m) => `<div class="${m === top ? 'top' : ''}"><span>${names[m]}</span><span class="b"><i style="width:${(score[m] / 12) * 100}%"></i></span><span>${score[m]}</span></div>`).join('');
  }
  form.addEventListener('change', calc);
  $$('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    presets[b.dataset.preset!].forEach((v, i) => {
      const inp = form.querySelector<HTMLInputElement>(`input[name="q${i + 1}"][value="${v}"]`);
      if (inp) inp.checked = true;
    });
    calc();
  }));
  calc();
}

/* ---------------- polyglot ---------------- */
export function polyglot() {
  const svcs = [
    { id: 'catalog', k: 'Catalog', fam: 'Document', store: 'MongoDB', cls: 'doc', x: 40, y: 40, a: [350, 228], b: [240, 83],
      why: 'Every product has different attributes: sizes for shirts, wattage for speakers. Documents hold each shape as-is and index the fields shoppers filter on.',
      code: 'db.products.find({ category: "audio", price: { $lt: 3000 } })' },
    { id: 'cart', k: 'Cart and sessions', fam: 'Key-value', store: 'Redis', cls: 'kv', x: 660, y: 40, a: [550, 228], b: [660, 83],
      why: 'Carts and sessions are read and written by user ID all day long and can expire. An in-memory key-value store serves them very fast.',
      code: 'HINCRBY cart:u1 sku-31 1\nEXPIRE cart:u1 604800   # 7 days' },
    { id: 'orders', k: 'Orders and payments', fam: 'Relational', store: 'PostgreSQL', cls: 'sql', x: 40, y: 394, a: [350, 268], b: [240, 437],
      why: 'Money moves here. Stock, orders and payments must change together or not at all, so they need multi-row ACID transactions.',
      code: 'BEGIN;\nUPDATE stock SET qty = qty - 2 WHERE sku = 31;\nINSERT INTO orders (id, customer_id) VALUES (1042, 7);\nCOMMIT;' },
    { id: 'recs', k: 'Recommendations', fam: 'Graph', store: 'Neo4j', cls: 'graph', x: 660, y: 394, a: [550, 268], b: [660, 437],
      why: '“Customers who bought this also bought” is a question about connections between people and products.',
      code: 'MATCH (:Product {sku: 31})<-[:BOUGHT]-(:Customer)-[:BOUGHT]->(rec)\nRETURN rec.name, count(*) AS score\nORDER BY score DESC LIMIT 5' },
    { id: 'events', k: 'Activity events', fam: 'Wide-column', store: 'Cassandra', cls: 'col', x: 350, y: 410, a: [450, 296], b: [450, 410],
      why: 'Every click and page view is appended at high volume and read back by user and time range for analytics.',
      code: "INSERT INTO clicks (user_id, ts, page)\n  VALUES ('u1', now(), '/p/31');" },
  ];
  const NS = 'http://www.w3.org/2000/svg';
  const wires = $('#poly-wires'), group = $('#poly-svcs');
  const gEls: Record<string, SVGGElement> = {};
  const flows: Record<string, SVGPathElement> = {};
  svcs.forEach((s) => {
    const [sx, sy] = s.a, [ex, ey] = s.b;
    const vertical = sx === ex;
    const d = vertical ? `M ${sx} ${sy} L ${ex} ${ey}` : `M ${sx} ${sy} C ${(sx + ex) / 2} ${sy}, ${(sx + ex) / 2} ${ey}, ${ex} ${ey}`;
    const w = document.createElementNS(NS, 'path'); w.setAttribute('d', d); w.setAttribute('class', 'wire'); wires.appendChild(w);
    const f = document.createElementNS(NS, 'path'); f.setAttribute('d', d); f.setAttribute('class', 'flow'); wires.appendChild(f);
    flows[s.id] = f;
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'svc'); g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', `${s.k}: ${s.fam}`);
    g.innerHTML = `<rect class="box" x="${s.x}" y="${s.y}" width="200" height="86" rx="4"/><text class="t1" x="${s.x + 14}" y="${s.y + 30}">${s.k}</text><text class="t2" x="${s.x + 14}" y="${s.y + 52}">${s.fam}</text><text class="t3" x="${s.x + 14}" y="${s.y + 72}" fill="#ff8a1f">${s.store}</text>`;
    group.appendChild(g);
    gEls[s.id] = g;
    const sel = () => select(s.id);
    g.addEventListener('click', sel);
    g.addEventListener('mouseenter', sel);
    g.addEventListener('focus', sel);
  });
  function select(id: string) {
    const s = svcs.find((x) => x.id === id)!;
    Object.entries(gEls).forEach(([k, g]) => g.classList.toggle('on', k === id));
    Object.entries(flows).forEach(([k, f]) => f.classList.toggle('on', k === id));
    $('#poly-k').textContent = s.store;
    const tag = $('#poly-tag'); tag.textContent = s.fam; tag.className = `tag ${s.cls}`;
    $('#poly-h').textContent = s.k;
    $('#poly-p').textContent = s.why;
    $('#poly-code').textContent = s.code;
  }
  select('catalog');
  let i = 0, touched = false;
  $('#poly-svg').addEventListener('pointerenter', () => (touched = true));
  setInterval(() => { if (!touched) select(svcs[++i % svcs.length].id); }, 3200);
}

/* ---------------- quiz + leaderboard ---------------- */
type Entry = { id: string; name: string; score: number; total: number; timeMs: number; answers: number[]; at: string };

export function quiz() {
  const Q: { q: string; o: string[]; a: number; why: string }[] = [
    { q: 'EMPLOYEE is split into σ Dno=5 (EMPLOYEE) and σ Dno≠5 (EMPLOYEE). What kind of fragmentation is this?', o: ['Vertical', 'Horizontal', 'Replication', 'Mixed'], a: 1, why: 'A selection (σ) picks subsets of rows, so these are horizontal fragments. UNION rebuilds the table.' },
    { q: 'What must every vertical fragment include so the relation can be rebuilt?', o: ['The primary key', 'A foreign key', 'An index', 'A timestamp'], a: 0, why: 'Vertical fragments are joined back on the primary key, so each one must keep it.' },
    { q: 'In two-phase commit, one participant votes NO. What does the coordinator do?', o: ['Commits at the YES sites only', 'Sends a global abort to every site', 'Waits forever', 'Lets the majority decide'], a: 1, why: 'Commit needs a unanimous YES. One NO means every site rolls back.' },
    { q: 'In distributed query processing, which cost usually dominates?', o: ['CPU time', 'Disk I/O', 'Data transfer over the network', 'Memory use'], a: 2, why: 'Shipping data between sites is the main cost, so optimizers minimize bytes moved, for example with semijoins.' },
    { q: 'What is the primary copy technique for distributed concurrency control?', o: ['All locks are managed at one site', 'Each item’s distinguished copy may be at a different site, which manages its locks', 'Every copy votes on each lock', 'No locks are used'], a: 1, why: 'Different items have primary copies at different sites, spreading the locking load and the impact of failures.' },
    { q: 'What does the name “NoSQL” mean today?', o: ['No SQL allowed', 'Not only SQL', 'New SQL', 'Non-standard queries'], a: 1, why: 'It is an umbrella term for non-relational stores. Many even offer SQL-like languages.' },
    { q: 'During a network partition, what does a CP system do?', o: ['Keeps answering with possibly stale data', 'Refuses some requests to stay consistent', 'Loses its committed data', 'Prevents the partition'], a: 1, why: 'CP keeps consistency and partition tolerance, so it sacrifices availability while the network is split.' },
    { q: 'What does the S in BASE stand for?', o: ['Soft state', 'Strong state', 'Sharded storage', 'Serializable'], a: 0, why: 'Basically Available, Soft state, Eventually consistent: replicas may differ for a while.' },
    { q: 'With N = 3 replicas, which setting guarantees a read sees the latest acknowledged write?', o: ['R = 1, W = 1', 'R = 1, W = 2', 'R = 2, W = 2', 'R = 1, W = 1 with retries'], a: 2, why: 'R + W = 4 > 3, so every read set overlaps every write set in at least one replica.' },
    { q: 'Which kind of database is aggregate-ignorant?', o: ['Key-value', 'Document', 'Column family', 'Graph'], a: 3, why: 'Relational and graph databases have no built-in notion of an aggregate; key-value, document and column-family stores are aggregate-oriented.' },
    { q: 'In MapReduce, which phase brings together all values for the same key?', o: ['Map', 'Shuffle and sort', 'Reduce', 'Split'], a: 1, why: 'Pairs are partitioned by hash(key) and sorted, so each reducer receives every value for its keys.' },
    { q: 'Which of these is a column-family store?', o: ['Redis', 'Neo4j', 'MongoDB', 'HBase'], a: 3, why: 'HBase follows Google’s Bigtable design. Redis is key-value, Neo4j is graph, MongoDB is document.' },
  ];
  const T = Q.length;
  const COLL = 'm5-quiz-scores', LS = 'm5-quiz-scores', PENDING = 'm5-quiz-pending';
  // Set PUBLIC_API_URL (e.g. https://dbs-module5-api.onrender.com) at build time to use the Render API.
  const API = String((import.meta as any).env?.PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
  const joinEl = $<HTMLFormElement>('#qz-join'), playEl = $('#qz-play'), resEl = $('#qz-result');
  const nameIn = $<HTMLInputElement>('#qz-name');
  const qEl = $('#quiz-q'), opts = $('#quiz-opts'), whyEl = $('#quiz-why'), next = $<HTMLButtonElement>('#quiz-next');
  const list = $('#lb-list'), lbNote = $('#lb-note'), lbCount = $('#lb-count'), modeTag = $('#lb-mode');

  let player = '', i = 0, score = 0, answers: number[] = [], answered = false;
  let t0 = 0, timer = 0, elapsed = 0, myId = '', myRank = 0, boardTotal = 0;
  let entries: Entry[] = [];
  type Mode = 'api' | 'claude' | 'local';
  let mode: Mode = 'local';
  let shared: any = null, sharedDocs: Entry[] = [], canShare = false;
  const localMine: Entry[] = [];
  let baseNote = '';

  /* ---- helpers ---- */
  const clean = (id: string, d: any): Entry | null => {
    if (!d || typeof d.name !== 'string' || !id) return null;
    const sc = Number(d.score), tm = Number(d.timeMs);
    if (!Number.isFinite(sc) || !Number.isFinite(tm)) return null;
    return {
      id: String(id), name: d.name.slice(0, 24), score: Math.max(0, Math.min(T, Math.round(sc))), total: T,
      timeMs: Math.max(0, tm), answers: Array.isArray(d.answers) ? d.answers.slice(0, T).map((x: unknown) => Number(x)) : [],
      at: typeof d.at === 'string' ? d.at : '',
    };
  };
  const readLS = (k: string): Entry[] => {
    try { return (JSON.parse(localStorage.getItem(k) || '[]') as any[]).map((d) => clean(d.id, d)).filter(Boolean) as Entry[]; } catch { return []; }
  };
  const writeLS = (k: string, all: Entry[]) => { try { localStorage.setItem(k, JSON.stringify(all.slice(0, 200))); } catch { /* storage blocked */ } };
  const sorted = (xs: Entry[]) => xs.slice().sort((a, b) => b.score - a.score || a.timeMs - b.timeMs || a.at.localeCompare(b.at));
  const setMode = (m: Mode, tag: string, cls = 'tag') => { mode = m; modeTag.textContent = tag; modeTag.className = cls; };
  const note = (t: string) => { baseNote = t; renderBoard(); };
  function withTimeout(url: string, init: RequestInit = {}, ms = 15000) {
    const c = new AbortController();
    const id = setTimeout(() => c.abort(), ms);
    return fetch(url, { ...init, signal: c.signal, cache: 'no-store' }).finally(() => clearTimeout(id));
  }

  /* ---- Render API mode ---- */
  let apiUp = false, polling = 0, inViewBoard = false;
  const pending = () => readLS(PENDING);
  async function apiLoad() {
    const r = await withTimeout(`${API}/api/scores?limit=100`, {}, apiUp ? 12000 : 75000);
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    apiUp = true;
    boardTotal = Number(j.total) || 0;
    const fromServer = (Array.isArray(j.scores) ? j.scores : []).map((d: any) => clean(d.id, d)).filter(Boolean) as Entry[];
    const waiting = pending().filter((p) => !fromServer.some((d) => d.id === p.id));
    entries = [...fromServer, ...waiting];
    setMode('api', 'Live · shared', 'tag kv');
    note(waiting.length ? `${waiting.length} score${waiting.length === 1 ? '' : 's'} waiting to sync from this device.` : '');
    if (waiting.length) flushPending();
  }
  async function apiPost(e: Entry) {
    const r = await withTimeout(`${API}/api/scores`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: e.id, name: e.name, answers: e.answers, timeMs: e.timeMs }),
    }, apiUp ? 15000 : 75000);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      const err: any = new Error(j.error || String(r.status)); err.status = r.status; throw err;
    }
    return r.json() as Promise<{ entry: any; rank: number; total: number }>;
  }
  let flushing = false;
  async function flushPending() {
    if (flushing) return; flushing = true;
    for (const p of pending()) {
      try { await apiPost(p); writeLS(PENDING, pending().filter((x) => x.id !== p.id)); }
      catch (err: any) { if (err?.status && err.status < 500 && err.status !== 429) writeLS(PENDING, pending().filter((x) => x.id !== p.id)); else break; }
    }
    flushing = false;
  }
  async function poll() {
    clearTimeout(polling);
    let wait = 9000;
    if (document.visibilityState === 'visible' && (inViewBoard || !apiUp)) {
      try { await apiLoad(); } catch { wait = 30000; if (apiUp) note('Lost the score server for a moment. Retrying…'); apiUp = false; }
    }
    renderBoard();
    polling = window.setTimeout(poll, wait);
  }
  function startApi() {
    setMode('api', 'Connecting…');
    entries = pending();
    note('Waking the score server. Free servers sleep when idle, so the first load can take up to a minute.');
    withTimeout(`${API}/health`, {}, 75000).catch(() => {}); // wake Render as soon as the page opens
    new IntersectionObserver(([en]) => { inViewBoard = en.isIntersecting; if (inViewBoard) poll(); }, { rootMargin: '600px' }).observe($('#quiz-wrap'));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && inViewBoard) poll(); });
    poll();
  }

  /* ---- Claude artifact mode ---- */
  async function connectClaude() {
    const cl = (window as any).claude;
    if (!cl?.use) return;
    const db = await cl.use('db').catch(() => null);
    if (!db) return;
    shared = db; canShare = true;
    setMode('claude', 'Live · shared', 'tag kv');
    note('Everyone with this page open sees the same board, live.');
    db.collection(COLL).orderBy('score', 'desc').limit(300).onSnapshot(
      (snap: any) => {
        sharedDocs = snap.docs.map((d: any) => clean(d.id, d.data())).filter(Boolean);
        entries = [...sharedDocs, ...localMine.filter((m) => !sharedDocs.some((d) => d.id === m.id))];
        renderBoard();
      },
      () => { shared = null; setMode('local', 'This device'); entries = readLS(LS); renderBoard(); },
    );
    const user = await cl.use('user').catch(() => null);
    const canWrite = user?.can ? await Promise.resolve(user.can('data.write')).catch(() => null) : null;
    if (canWrite === false) { canShare = false; note('You can watch the live board. Your own score saves on this device only, because this view is read-only.'); }
  }

  /* ---- save ---- */
  async function save(e: Entry) {
    if (mode === 'api') {
      try {
        const res = await apiPost(e);
        const saved = clean(res.entry?.id, res.entry) ?? e;
        myId = saved.id; myRank = Number(res.rank) || 0; boardTotal = Number(res.total) || boardTotal;
        entries = [saved, ...entries.filter((x) => x.id !== saved.id)];
        apiUp = true;
        note('');
      } catch (err: any) {
        if (err?.status === 400) { note(`The server rejected this score: ${err.message}.`); return; }
        writeLS(PENDING, [e, ...pending().filter((x) => x.id !== e.id)]);
        entries = [e, ...entries.filter((x) => x.id !== e.id)];
        note(err?.status === 429 ? 'Too many scores from this network in a minute. Yours is saved here and will sync shortly.' : 'Could not reach the score server. Your score is saved on this device and will sync automatically.');
      }
      return;
    }
    if (mode === 'claude' && shared && canShare) {
      try {
        await shared.collection(COLL).doc(e.id).set({ name: e.name, score: e.score, total: e.total, timeMs: e.timeMs, answers: e.answers, at: e.at });
        return;
      } catch (err: any) {
        canShare = false;
        baseNote = err?.code === 'quota_exceeded' ? 'The shared board is full. Scores now save on this device only.' : 'This view cannot write to the shared board, so scores save on this device only.';
      }
    }
    if (mode === 'claude' && shared) {
      localMine.push(e);
      entries = [...sharedDocs, ...localMine];
    } else {
      const all = [e, ...readLS(LS).filter((x) => x.id !== e.id)];
      writeLS(LS, all);
      entries = all;
    }
    renderBoard();
  }

  /* ---- leaderboard ---- */
  function renderBoard() {
    const xs = sorted(entries);
    const total = Math.max(boardTotal, xs.length);
    lbCount.textContent = `${total} player${total === 1 ? '' : 's'}`;
    list.innerHTML = '';
    lbNote.textContent = xs.length ? baseNote : `No scores yet. Be the first.${baseNote ? ' ' + baseNote : ''}`;
    xs.slice(0, 50).forEach((e, k) => {
      const li = document.createElement('li');
      if (e.id === myId) li.className = 'you';
      const rk = document.createElement('span'); rk.className = 'rk'; rk.textContent = String(k + 1);
      const nm = document.createElement('span'); nm.className = 'nm';
      const b = document.createElement('b'); b.textContent = e.name || 'Anonymous';
      const dots = document.createElement('span');
      for (let q = 0; q < T; q++) { const d = document.createElement('i'); if (e.answers[q] === Q[q].a) d.className = 'r'; dots.appendChild(d); }
      nm.append(b, dots);
      const sc = document.createElement('span'); sc.className = 'sc'; sc.textContent = `${e.score}/${T}`;
      const tm = document.createElement('span'); tm.className = 'tm'; tm.textContent = `${(e.timeMs / 1000).toFixed(1)}s`;
      li.append(rk, nm, sc, tm);
      list.appendChild(li);
    });
    if (myId && !resEl.hidden) {
      const me = list.querySelector<HTMLElement>('li.you');
      if (me) list.scrollTop = me.offsetTop - list.clientHeight / 2;
      const idx = xs.findIndex((e) => e.id === myId) + 1;
      const rank = idx || myRank;
      if (rank) $('#qz-rank').textContent = `Rank #${rank} of ${total} · ${(elapsed / 1000).toFixed(1)} seconds`;
    }
  }

  /* ---- flow ---- */
  const show = (el: HTMLElement) => { [joinEl, playEl, resEl].forEach((x) => (x.hidden = x !== el)); };
  function start(name: string) {
    player = name; i = 0; score = 0; answers = []; myId = '';
    $('#qz-player').textContent = player;
    $('#quiz-score').textContent = '0';
    $('#qz-dots').innerHTML = Q.map(() => '<i></i>').join('');
    show(playEl);
    t0 = performance.now(); elapsed = 0;
    clearInterval(timer);
    timer = window.setInterval(() => { $('#qz-time').textContent = `${((performance.now() - t0) / 1000).toFixed(1)}s`; }, 100);
    renderQ();
    (document.activeElement as HTMLElement | null)?.blur();
    opts.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }
  function pick(j: number) {
    if (answered) return;
    answered = true;
    const it = Q[i];
    answers[i] = j;
    $$('button', opts).forEach((x, k) => { (x as HTMLButtonElement).disabled = true; if (k === it.a) x.classList.add('right'); if (k === j && j !== it.a) x.classList.add('wrong'); });
    if (j === it.a) score++;
    $('#quiz-score').textContent = String(score);
    const dot = $$('#qz-dots i')[i];
    dot.className = j === it.a ? 'r' : 'w';
    whyEl.textContent = (j === it.a ? 'Correct. ' : 'Not quite. ') + it.why;
    next.disabled = false;
    next.focus({ preventScroll: true });
    if (i === T - 1) { elapsed = performance.now() - t0; clearInterval(timer); $('#qz-time').textContent = `${(elapsed / 1000).toFixed(1)}s`; }
  }
  function renderQ() {
    answered = false;
    const it = Q[i];
    $('#quiz-pos').textContent = `Question ${i + 1} of ${T}`;
    $$('#qz-dots i').forEach((d, k) => { if (k === i) d.classList.add('cur'); });
    qEl.textContent = it.q;
    whyEl.textContent = 'Pick an answer. Keys A–D work too.';
    next.disabled = true; next.textContent = i === T - 1 ? 'Finish and see the board' : 'Next question';
    opts.innerHTML = '';
    it.o.forEach((o, j) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<span>${'ABCD'[j]}</span>${esc(o)}`;
      b.addEventListener('click', () => pick(j));
      opts.appendChild(b);
    });
  }
  async function finish() {
    show(resEl);
    $('#qz-final').textContent = `${score}/${T}`;
    $('#qz-verdict').textContent =
      score === T ? `Perfect run, ${player}. Module 5 is yours.`
      : score >= 9 ? `Strong work, ${player}. Check the misses below.`
      : score >= 6 ? `Halfway there, ${player}. The review shows what to revisit.`
      : `Good start, ${player}. Scroll back through the chapters and try again.`;
    $('#qz-rank').textContent = `${(elapsed / 1000).toFixed(1)} seconds · saving your score…`;
    $('#qz-retry').textContent = `Try again as ${player}`;
    const rv = $('#qz-review'); rv.innerHTML = '';
    Q.forEach((it, k) => {
      const ok = answers[k] === it.a;
      const li = document.createElement('li');
      li.className = ok ? 'r' : 'w';
      li.innerHTML = `<span class="m">${ok ? '✓' : '✕'}</span><span>${esc(it.q)}</span><span class="a">You: <b>${esc(it.o[answers[k]] ?? '—')}</b>${ok ? '' : ` · Correct: <b>${esc(it.o[it.a])}</b>`}</span>`;
      rv.appendChild(li);
    });
    const e: Entry = {
      id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      name: player, score, total: T, timeMs: Math.round(elapsed), answers: answers.slice(), at: new Date().toISOString(),
    };
    myId = e.id; myRank = 0;
    if (mode !== 'claude' || !canShare) { entries = [e, ...entries.filter((x) => x.id !== e.id)]; renderBoard(); }
    await save(e);
    renderBoard();
  }

  joinEl.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const n = nameIn.value.replace(/\s+/g, ' ').trim().slice(0, 24);
    if (!n) { $('#qz-join-msg').textContent = 'Type a name first, so the board knows who scored.'; nameIn.focus(); return; }
    start(n);
  });
  next.addEventListener('click', () => {
    if (!answered) return;
    if (i < T - 1) { i++; renderQ(); } else finish();
  });
  $('#qz-again').addEventListener('click', () => { nameIn.value = ''; myId = ''; renderBoard(); show(joinEl); nameIn.focus({ preventScroll: true }); });
  $('#qz-retry').addEventListener('click', () => start(player));

  let inView = false;
  new IntersectionObserver(([en]) => (inView = en.isIntersecting)).observe($('#quiz-wrap'));
  addEventListener('keydown', (ev) => {
    if (!inView || playEl.hidden || (ev.target as HTMLElement)?.tagName === 'INPUT') return;
    const k = ev.key.toLowerCase();
    const j = ['a', 'b', 'c', 'd'].indexOf(k);
    if (j >= 0 && !answered) { ev.preventDefault(); pick(j); }
    else if ((k === 'enter' || k === 'arrowright') && answered && document.activeElement !== next) { ev.preventDefault(); next.click(); }
  });

  if (API) startApi();
  else { setMode('local', 'This device'); entries = readLS(LS); renderBoard(); connectClaude(); }
}

/* ---------------- typed code in advantage card ---------------- */
export function devCode() {
  const el = $('#dev-code');
  if (!el) return;
  const text = `const order = {\n  id: 1042,\n  customer: { name: "Asha" },\n  items: [{ sku: 31, qty: 2 }]\n};\n\nawait orders.insertOne(order);\n// stored as-is, no mapping layer`;
  let visible = false;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(el);
  let n = 0;
  setInterval(() => {
    if (!visible) return;
    n = n > text.length + 40 ? 0 : n + 1;
    el.innerHTML = esc(text.slice(0, Math.min(n, text.length))) + '<span class="cur"></span>';
  }, 45);
}
