(() => {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const data = JSON.parse($('#wb-data').textContent), t = data.t;
  const items = $$('details.item'), toc = $('#toc'), ask = $('#ask'), log = $('#ask-log');
  const served = data.mode !== 'static' && (location.protocol === 'http:' || location.protocol === 'https:');
  const histories = new Map(); let current = -1, cursor = -1, busy = false, fontSize = 16;
  try { fontSize = Number(localStorage.getItem('wb.fs')) || 16; } catch { /* file mode may disable storage */ }
  function setFont(n) {
    fontSize = Math.max(13, Math.min(21, n)); document.documentElement.style.fontSize = fontSize + 'px';
    try { localStorage.setItem('wb.fs', String(fontSize)); } catch { /* optional preference */ }
  }
  setFont(fontSize); $('#b-fm').onclick = () => setFont(fontSize - 1); $('#b-fp').onclick = () => setFont(fontSize + 1);
  items.forEach(d => { d.open = innerWidth >= 700; });
  function sync() { $('#b-all').textContent = items.every(d => d.open || d.hidden) ? t.collapse : t.expand; }
  $('#b-all').onclick = () => { const open = !items.every(d => d.open || d.hidden); items.forEach(d => { if (!d.hidden) d.open = open; }); sync(); };
  items.forEach(d => d.addEventListener('toggle', sync)); sync();
  $('#b-toc').onclick = () => toc.classList.toggle('show');
  const search = $('#q');
  search.oninput = () => {
    const q = search.value.trim().toLowerCase();
    items.forEach(d => { d.hidden = !!q && !d.textContent.toLowerCase().includes(q); if (q && !d.hidden) d.open = true; });
    $$('section[data-sec]').forEach(s => { const children = [...s.querySelectorAll('details')]; s.hidden = !!q && children.length > 0 && children.every(d => d.hidden); });
    $$('#toc a').forEach(a => { a.hidden = items[Number(a.dataset.go)].hidden; }); sync();
  };
  function go(i) {
    const d = items[i]; if (!d) return;
    if (d.hidden) { search.value = ''; search.oninput(); }
    d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' });
    cursor = i; d.classList.add('hit'); setTimeout(() => d.classList.remove('hit'), 1400);
  }
  $$('#toc a').forEach(a => { a.onclick = e => { e.preventDefault(); go(Number(a.dataset.go)); toc.classList.remove('show'); }; });
  $$('.chips a').forEach(a => { a.onclick = e => { e.preventDefault(); $('#s-' + a.dataset.sec)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }; });
  function spy() {
    let section, story;
    $$('main section[data-sec]').forEach(s => { if (!s.hidden && s.getBoundingClientRect().top < 120) section = s.dataset.sec; });
    items.forEach(d => { if (!d.hidden && d.getBoundingClientRect().top < 120) story = d.dataset.idx; });
    $$('.chips a').forEach(a => a.classList.toggle('on', a.dataset.sec === section));
    $$('#toc a').forEach(a => a.classList.toggle('on', a.dataset.go === story));
  }
  let tick = 0;
  addEventListener('scroll', () => { if (!tick) tick = setTimeout(() => { tick = 0; spy(); }, 80); }, { passive: true }); spy();
  function promptFor(i, question = t.defaultQuestion) {
    const it = data.items[i];
    return `${t.promptIntro}\n\n${t.dataStart}\n${data.date}\n${it.h}\n${it.s}\n${it.w}\n${it.u}\n${it.src.map(s => `${s.t} ${s.url}`).join('\n')}\n${t.dataEnd}\n\n${question}`;
  }
  async function copy(value) {
    try { await navigator.clipboard.writeText(value); }
    catch {
      const box = document.createElement('textarea'); box.value = value; document.body.appendChild(box); box.select();
      if (!document.execCommand('copy')) { box.remove(); window.prompt(t.copy, value); return; }
      box.remove();
    }
    const toast = document.createElement('div'); toast.className = 'toast'; toast.textContent = t.copied; document.body.appendChild(toast); setTimeout(() => toast.remove(), 1800);
  }
  function add(role, text) { const p = document.createElement('div'); p.className = 'm ' + role; p.textContent = text; log.appendChild(p); log.scrollTop = log.scrollHeight; return p; }
  function closeAsk() { ask.hidden = true; document.body.classList.remove('askopen'); }
  function openAsk(i) {
    current = i; ask.hidden = false; document.body.classList.add('askopen'); $('#ask-t').textContent = t.askTitle + data.items[i].h;
    log.replaceChildren(); (histories.get(i) || []).forEach(m => add(m.role, m.text));
    $('#ask-chips').replaceChildren();
    t.chips.forEach(c => { const b = document.createElement('button'); b.textContent = c; b.type = 'button'; b.onclick = () => send(c); $('#ask-chips').appendChild(b); });
    $('#ask-s').textContent = data.mode === 'static' ? t.staticNote : served ? t.askNote : t.offline; go(i); $('#ask-q').focus();
  }
  async function send(question) {
    question = question.trim(); if (!question || busy || current < 0) return;
    const i = current;
    if (!served) { await copy(promptFor(i, question)); return; }
    const history = histories.get(i) || []; histories.set(i, history);
    const previous = history.slice(-6); history.push({ role: 'q', text: question }); add('q', question);
    const waiting = add('wait', t.thinking); busy = true; $('#ask-q').value = '';
    try {
      const r = await fetch('/api/ask', { method: 'POST', signal: AbortSignal.timeout(180000), headers: { 'content-type': 'application/json', 'x-wb': '1' }, body: JSON.stringify({ dir: $('meta[name=wb-dir]').content, idx: i, question, history: previous }) });
      const j = await r.json(); if (!r.ok || !j.answer) throw new Error(j.error || t.failed);
      history.push({ role: 'a', text: j.answer }); if (current === i) add('a', j.answer);
    } catch { history.push({ role: 'err', text: t.unavailable }); if (current === i) add('err', t.unavailable); }
    finally { waiting.remove(); busy = false; }
  }
  $$('.ask-btn').forEach(b => { b.onclick = () => openAsk(Number(b.dataset.idx)); });
  $$('.copy-btn').forEach(b => { b.onclick = () => copy(promptFor(Number(b.dataset.idx))); });
  $('#ask-x').onclick = closeAsk;
  $('#ask-f').onsubmit = e => { e.preventDefault(); send($('#ask-q').value); };
  $('#ask-q').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(e.target.value); } };
  addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeAsk(); toc.classList.remove('show'); }
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); search.focus(); }
    if (e.key === 'j' || e.key === 'k') {
      const visible = items.filter(d => !d.hidden); if (!visible.length) return;
      const at = visible.findIndex(d => Number(d.dataset.idx) === cursor);
      go(Number(visible[Math.max(0, Math.min(visible.length - 1, at + (e.key === 'j' ? 1 : -1)))].dataset.idx));
    }
    if (e.key === 'a' && cursor >= 0) openAsk(cursor);
  });
  items.forEach(d => d.addEventListener('click', e => { if (e.target.closest('summary')) cursor = Number(d.dataset.idx); }));
})();
