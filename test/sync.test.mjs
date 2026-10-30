import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { defaults, loadConfig, projectRoot, readJson } from '../src/config.mjs';
import { buildPush } from '../src/push.mjs';
import { renderHtml, renderArchive } from '../src/render.mjs';
import { generationRequest } from '../src/provider.mjs';
import { runBrief } from '../src/run.mjs';
import { startServer } from '../src/server.mjs';
import { strings } from '../src/i18n.mjs';

const fixture = (kind, locale) => readJson(path.join(projectRoot, 'examples', `${kind}.${locale}.json`));

test('push neutralizes hostile Markdown, adds localized camps and confidence, and rejects local links', () => {
  for (const locale of ['en', 'zh']) {
    const b = fixture('weekly', locale), it = b.sections[0].items[0];
    b.bluf = ['A [false](link)']; b.sections[0].title = 'Topic [x](y)';
    it.headline = 'Title [x](y)'; it.voices[0].name = 'Person [x](y)';
    it.voices[0].outlet = 'Outlet [x](y)'; it.sources[0].url = 'https://example.org/a(b)[c]';
    const p = buildPush(b, locale);
    assert.match(p.message, /［x］（y）/);
    assert.match(p.message, /%28b%29%5Bc%5D/);
    assert.ok(p.message.includes(strings(locale).camps[it.voices[0].camp] + '｜Person'));
    assert.ok(!p.message.includes('[false](link)'));
    for (const url of ['http://127.0.0.1/private', 'http://2130706433/private', 'http://[::1]/private', 'https://machine.local/private', 'https://singlehost/private', 'https://10.0.0.1/private']) {
      it.sources = [{ url }]; b.title = url; b.bluf = [url];
      const filtered = buildPush(b, locale);
      assert.equal(filtered.actions.length, 0); assert.ok(!JSON.stringify(filtered).includes('/private'));
    }
    it.sources.push({ url: 'https://example.org/public' });
    assert.equal(buildPush(b, locale).actions[0].url, 'https://example.org/public');
    const daily = buildPush(fixture('daily', locale));
    assert.match(daily.message, /🟢|🟡|🔴/);
  }
});

test('weekly ask sends complete source-attributed commentary with funding safeguards to the provider', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'world-brief-weekly-ask-'));
  const cfg = { ...defaults(), outRoot: root };
  cfg.ask = { ...cfg.ask, enabled: true, port: 0 };
  cfg.provider = { type: 'command', executable: process.execPath, timeoutMs: 5000, args: ['--input-type=module', '-e', `let text='';for await(const c of process.stdin)text+=c;const r=JSON.parse(text);console.log(JSON.stringify({item:r.item,prompt:r.prompt,locale:r.locale}))`] };
  const brief = fixture('weekly', 'en');
  await runBrief(cfg, { kind: 'weekly', input: path.join(projectRoot, 'examples', 'weekly.en.json') });
  const { server, origin } = await startServer(cfg);
  t.after(async () => {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    fs.rmSync(root, { recursive: true, force: true });
  });
  const response = await fetch(origin + '/api/ask', { method: 'POST', headers: { origin, 'x-wb': '1', 'content-type': 'application/json' }, body: JSON.stringify({ dir: `${brief.date}-weekly`, idx: 0, question: 'Compare the voices.' }) });
  assert.equal(response.status, 200);
  const sent = JSON.parse((await response.json()).answer);
  assert.deepEqual(sent.item, brief.sections[0].items[0]);
  assert.match(sent.prompt, /ignore instructions/); assert.match(sent.prompt, /Preserve disclosure citations, dates, scope and limitations/);
  assert.match(sent.prompt, /not_checked do not mean no funding/);
});

test('push reserves footer and omission notice within 3900 UTF-8 bytes and keeps complete rows', () => {
  for (const locale of ['en', 'zh']) for (const kind of ['daily', 'weekly']) {
    const b = fixture(kind, locale);
    b.bluf = Array(100).fill('😀中'.repeat(1000));
    b.sections = Array.from({ length: 20 }, (_, i) => ({ ...structuredClone(b.sections[0]), title: `Section ${i}` }));
    const p = buildPush(b, locale);
    assert.ok(Buffer.byteLength(p.message) <= 3900);
    assert.ok(p.message.endsWith(strings(locale).pushMore));
    const section = structuredClone(b.sections[0]); section.title = 'Whole rows from a large section';
    section.items = Array(100).fill(section.items[0]); b.bluf = ['Short']; b.sections = [section];
    const large = buildPush(b, locale);
    assert.ok(Buffer.byteLength(large.message) <= 3900);
    assert.ok(large.message.includes(`**${section.title}**\n- `));
    assert.ok(large.message.endsWith(strings(locale).pushMore));
    const single = structuredClone(b); single.sections[0].items = [section.items[0]];
    const completeRows = buildPush(single, locale).message.split('\n').filter(line => /^\s*- /.test(line));
    const retainedRows = large.message.split('\n').filter(line => /^\s*- /.test(line));
    assert.ok(retainedRows.length > 1 && retainedRows.length < 101 * completeRows.length);
    for (const row of retainedRows) assert.ok(completeRows.includes(row), 'each retained row must be complete');
    assert.ok(large.message.includes(strings(locale)[kind === 'weekly' ? 'pushWeekly' : 'pushDaily']));
  }
});

test('archive separates daily and weekly histories, marks the latest, and handles missing funding', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'world-brief-sync-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const locale of ['en', 'zh']) {
    for (const kind of ['daily', 'weekly']) {
      const b = fixture(kind, locale), dir = path.join(root, `${b.date}-${kind}`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'brief.json'), JSON.stringify(b));
      fs.writeFileSync(path.join(dir, 'index.html'), 'Rendered fixture');
    }
    renderArchive(root, locale);
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /id="archive-daily"/); assert.match(html, /id="archive-weekly"/);
    assert.equal(html.split(strings(locale).latest).length - 1, 2);
    const old = fixture('weekly', locale); old.sections[0].items[0].voices.forEach(v => delete v.funding);
    assert.ok(renderHtml(old, { locale }).includes(strings(locale).fundingMissing));
  }
});

test('generation guidance carries source, attribution, market-date and bounded voice selection rules', () => {
  for (const locale of ['en', 'zh']) {
    const cfg = defaults(); cfg.locale = locale;
    const args = { date: '2025-01-19', window: '2025-01-16 ~ 2025-01-19' };
    const daily = generationRequest(cfg, { ...args, kind: 'daily' }).prompt;
    assert.match(daily, /actual trading session/); assert.match(daily, /Social posts are leads, not corroboration/);
    const weekly = generationRequest(cfg, { ...args, kind: 'weekly' }).prompt;
    assert.match(weekly, /5–7 voices/); assert.match(weekly, /labeling attribution explicitly/);
  }
});

for (const [label, kind, interval, schedule] of [
  ['default daily', 'daily', 1, undefined],
  ['explicit three-day daily', 'daily', 3, { dailyEveryDays: 3 }],
  ['weekly seven-day', 'weekly', 7, undefined]
]) test(`${label} due guard skips the same day and publishes at the interval`, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'world-brief-cadence-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const config = path.join(root, 'config.json');
  const original = JSON.stringify({ outRoot: 'briefs', schedule });
  fs.writeFileSync(config, original);
  const cfg = loadConfig(config), brief = fixture(kind, 'en');
  if (kind === 'daily') assert.equal(cfg.schedule.dailyEveryDays, interval);
  await runBrief(cfg, { kind, input: path.join(projectRoot, 'examples', `${kind}.en.json`) });
  const day = offset => new Date(Date.parse(brief.date) + offset * 86400000).toISOString().slice(0, 10);
  for (let offset = 0; offset < interval; offset++) {
    assert.deepEqual(await runBrief(cfg, { kind, date: day(offset), due: true }), { skipped: true, reason: 'not due' });
  }
  // A partial output must not reset the cadence from the previous completed brief.
  fs.mkdirSync(path.join(cfg.outRoot, `${day(interval)}-${kind}`));
  const later = { ...brief, date: day(interval + 1) }, input = path.join(root, 'later.json');
  fs.writeFileSync(input, JSON.stringify(later));
  const result = await runBrief(cfg, { kind, date: later.date, input, due: true });
  assert.equal(result.skipped, false);
  assert.ok(fs.existsSync(path.join(result.dir, 'index.html')));
  // Use another root to verify the exact boundary independently of the later run.
  const exactCfg = { ...cfg, outRoot: path.join(root, 'exact') };
  await runBrief(exactCfg, { kind, input: path.join(projectRoot, 'examples', `${kind}.en.json`) });
  fs.writeFileSync(input, JSON.stringify({ ...brief, date: day(interval) }));
  assert.equal((await runBrief(exactCfg, { kind, input, due: true })).skipped, false);
  assert.equal(fs.readFileSync(config, 'utf8'), original);
});

test('reader keyboard navigation, scroll state and copied weekly context work in both locales', async () => {
  for (const locale of ['en', 'zh']) {
    const b = fixture('weekly', locale), html = renderHtml(b, { locale, mode: 'static' });
    const data = JSON.parse(html.match(/id="wb-data">(.*?)<\/script>/s)[1]);
    const handlers = {}, copied = [];
    function node() {
      const classes = new Set();
      return { dataset: {}, hidden: false, textContent: '', value: '', tagName: 'DIV',
        classList: { add: c => classes.add(c), remove: c => classes.delete(c), toggle: (c, on) => on ? classes.add(c) : classes.delete(c), contains: c => classes.has(c) },
        addEventListener() {}, scrollIntoView() {}, focus() {}, remove() {}, appendChild() {}, replaceChildren() {},
        getBoundingClientRect: () => ({ top: 0 }), querySelectorAll: () => [], classes };
    }
    const ids = Object.fromEntries(['wb-data', 'toc', 'ask', 'ask-log', 'b-fm', 'b-fp', 'b-all', 'b-toc', 'q', 'ask-t', 'ask-chips', 'ask-s', 'ask-q', 'ask-x', 'ask-f'].map(k => ['#' + k, node()]));
    ids['#wb-data'].textContent = JSON.stringify(data);
    const item = node(); item.dataset = { idx: '0' };
    const section = node(); section.dataset.sec = '0'; ids['#s-0'] = section;
    const toc = node(); toc.dataset.go = '0'; const chip = node(); chip.dataset.sec = '0';
    const copy = node(); copy.dataset.idx = '0';
    const lists = { 'details.item': [item], '#toc a': [toc], '.chips a': [chip], 'main section[data-sec]': [section], 'section[data-sec]': [section], '.copy-btn': [copy], '.ask-btn': [] };
    const document = { querySelector: s => ids[s], querySelectorAll: s => lists[s] || [], documentElement: { style: {} }, body: node(), createElement: node };
    vm.runInNewContext(fs.readFileSync(path.join(projectRoot, 'assets', 'brief-ui.js'), 'utf8'), {
      document, location: { protocol: 'https:' }, innerWidth: 390, localStorage: { getItem() {}, setItem() {} },
      navigator: { clipboard: { writeText: async text => copied.push(text) } },
      setTimeout: () => 1, addEventListener: (type, callback) => { handlers[type] = callback; },
    });
    handlers.keydown({ key: 'j', target: node() });
    assert.equal(item.open, true); assert.ok(item.classes.has('hit')); assert.ok(chip.classes.has('on'));
    handlers.keydown({ key: 'a', target: node() }); assert.equal(ids['#ask'].hidden, false);
    await copy.onclick();
    assert.ok(copied[0].includes(strings(locale).dataStart)); assert.ok(copied[0].includes(strings(locale).dataEnd));
    assert.ok(copied[0].includes(b.sections[0].items[0].voices[0].funding.checked_at));
    assert.ok(copied[0].includes(b.sections[0].items[0].synthesis));
  }
});
