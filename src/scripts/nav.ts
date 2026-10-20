// Contents overlay, part rail and the part label in the HUD. Built from the sections themselves,
// so adding a chapter in the markup is enough to list it.
const PARTS = ['Opening', 'Distributed databases', 'Why NoSQL', 'Characteristics', 'CAP · ACID · BASE', 'Data modelling', 'Distribution · MapReduce', 'Types of NoSQL', 'Conclusion'];

export function navigation(jumpTo: (el: HTMLElement) => void) {
  const chapters = Array.from(document.querySelectorAll<HTMLElement>('section[data-chapter]'));
  const grid = document.querySelector<HTMLElement>('#toc-grid')!;
  const toc = document.querySelector<HTMLElement>('#toc')!;
  const btn = document.querySelector<HTMLButtonElement>('#toc-btn')!;
  const rail = Array.from(document.querySelectorAll<HTMLButtonElement>('#part-rail button'));
  const hudPart = document.querySelector<HTMLElement>('#hud-part')!;
  const byPart = PARTS.map((_, i) => chapters.filter((c) => Number(c.dataset.part) === i));
  const tocBtns: HTMLButtonElement[] = [];
  let n = 0;
  byPart.forEach((list, i) => {
    if (!list.length) return;
    const box = document.createElement('div');
    box.className = 'toc-part';
    box.innerHTML = `<h3><span>${String(i).padStart(2, '0')}</span>${PARTS[i]}</h3>`;
    const ol = document.createElement('ol');
    list.forEach((sec) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<em>${String(++n).padStart(2, '0')}</em><span></span>`;
      b.querySelector('span')!.textContent = sec.dataset.chapter!;
      b.addEventListener('click', () => { close(); jumpTo(sec); });
      (b as any)._sec = sec;
      tocBtns.push(b);
      li.appendChild(b);
      ol.appendChild(li);
    });
    box.appendChild(ol);
    grid.appendChild(box);
  });
  let lastFocus: HTMLElement | null = null;
  function open() {
    lastFocus = document.activeElement as HTMLElement;
    toc.hidden = false; btn.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('toc-open');
    (window as any).__lenis?.stop();
    tocBtns.find((b) => b.classList.contains('here'))?.focus({ preventScroll: true });
  }
  function close() {
    if (toc.hidden) return;
    toc.hidden = true; btn.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('toc-open');
    (window as any).__lenis?.start();
    lastFocus?.focus?.({ preventScroll: true });
  }
  btn.addEventListener('click', () => (toc.hidden ? open() : close()));
  document.querySelector('#toc-close')!.addEventListener('click', close);
  toc.addEventListener('click', (e) => { if (e.target === toc) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  rail.forEach((b) => b.addEventListener('click', () => { const first = byPart[Number(b.dataset.partJump)][0]; if (first) jumpTo(first); }));

  let cur = -1, curPart = -1;
  return function update() {
    const mid = innerHeight * 0.5;
    let c = 0;
    for (let i = 0; i < chapters.length; i++) if (chapters[i].getBoundingClientRect().top <= mid) c = i;
    const part = Number(chapters[c]?.dataset.part ?? 0);
    if (c !== cur) {
      cur = c;
      tocBtns.forEach((b, i) => b.classList.toggle('here', i === c));
      hudPart.textContent = `${String(part).padStart(2, '0')} · ${PARTS[part]} — ${chapters[c].dataset.chapter}`;
    }
    rail.forEach((b, i) => {
      const list = byPart[i];
      if (!list.length) return;
      const start = list[0].getBoundingClientRect().top;
      const nextFirst = byPart.slice(i + 1).find((l) => l.length)?.[0];
      const end = nextFirst ? nextFirst.getBoundingClientRect().top : document.documentElement.scrollHeight - scrollY;
      const p = Math.max(0, Math.min(1, (mid - start) / Math.max(1, end - start)));
      (b.querySelector('u') as HTMLElement).style.transform = `scaleX(${p})`;
      if (i !== curPart) { b.classList.toggle('on', i === part); b.classList.toggle('done', i < part); }
    });
    if (part !== curPart) { curPart = part; rail.forEach((b, i) => { b.classList.toggle('on', i === part); b.classList.toggle('done', i < part); }); }
  };
}
