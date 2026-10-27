import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaults, loadConfig, initConfig, dateInZone, projectRoot, readJson } from '../src/config.mjs';
import { validateBrief, localImage, isDate } from '../src/validate.mjs';
import { renderHtml } from '../src/render.mjs';
import { buildPush } from '../src/push.mjs';
import { runBrief } from '../src/run.mjs';
import { schedulerFiles } from '../src/schedule.mjs';
import { scan } from '../scripts/privacy-scan.mjs';

const fixture = name => readJson(path.join(projectRoot, 'examples', name));
function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'world-brief-test-'));
  t.after(() => { if (root.startsWith(path.join(os.tmpdir(), 'world-brief-test-'))) fs.rmSync(root, { recursive: true, force: true }); });
  const cfg = { ...defaults(), configPath: path.join(root, 'config.json'), outRoot: path.join(root, 'briefs') };
  return { root, cfg };
}
test('config is relative to config location, refuses overwrite and validates options', t => {
  const { root } = setup(t), file = path.join(root, 'config.json');
  initConfig(file, 'zh'); const cfg = loadConfig(file);
  assert.equal(cfg.schedule.dailyEveryDays, 1);
  assert.equal(cfg.locale, 'zh'); assert.equal(cfg.outRoot, path.join(root, '.world-brief', 'briefs'));
  assert.throws(() => initConfig(file), /EEXIST/);
  for (const modify of [c => c.locale = 'bad', c => c.timezone = 'Invalid/Zone', c => c.ask.enabled = 'false', c => c.provider.timeoutMs = 0, c => c.schedule.dailyAt = '25:90', c => c.ntfy.server = 'http://example.org', c => c.ntfy.enabled = true]) {
    const value = defaults(); modify(value); fs.writeFileSync(file, JSON.stringify(value)); assert.throws(() => loadConfig(file));
  }
  assert.equal(dateInZone('UTC', new Date('2025-01-15T23:30Z')), '2025-01-15');
  assert.equal(dateInZone('Australia/Sydney', new Date('2025-01-15T23:30Z')), '2025-01-16');
});
test('malformed shapes, source URLs, images and voices fail validation without crashes', () => {
  for (const b of [null, [], 1, {}, { sections: [null] }, { sections: [{ title: 'x', items: [null] }] }]) assert.ok(validateBrief(b).length);
  const base = fixture('daily.en.json'); assert.deepEqual(validateBrief(base), []);
  const credentialUrl = 'https://' + ['user', 'pass'].join(':') + '@' + 'example.org';
  for (const url of ['javascript:alert(1)', 'https://', 'file:///tmp/test', 'https://example.org/ bad', credentialUrl]) {
    const b = structuredClone(base); b.sections[0].items[0].sources = [{ url }]; assert.ok(validateBrief(b).length);
  }
  for (const value of ['2025-02-30', '2025-99-99', '2025-1-01', 0]) assert.equal(isDate(value), false);
  const weekly = fixture('weekly.en.json'); assert.deepEqual(validateBrief(weekly), []);
  weekly.sections[0].items[0].voices[0].camp = 'invented'; assert.ok(validateBrief(weekly).length);
  const b = structuredClone(base); b.sections[0].items[0].images = [{ remote_url: 'https://example.org/a.png' }]; assert.ok(validateBrief(b).some(e => e.includes('credit')));
});
test('local images require matching raster signature and contained img path', t => {
  const { root } = setup(t); fs.mkdirSync(path.join(root, 'img'));
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yX9sAAAAASUVORK5CYII=', 'base64');
  fs.writeFileSync(path.join(root, 'img', 'one.png'), png);
  assert.equal(localImage(root, 'img/one.png'), true);
  for (const p of ['../outside.png', 'img/../one.png', 'img\\one.png', '/img/one.png', 'img/a.svg']) assert.equal(localImage(root, p), false);
  fs.writeFileSync(path.join(root, 'img', 'fake.png'), '<svg onload="alert(1)"></svg>'); assert.equal(localImage(root, 'img/fake.png'), false);
  fs.copyFileSync(path.join(root, 'img', 'one.png'), path.join(root, 'img', 'wrong.jpg')); assert.equal(localImage(root, 'img/wrong.jpg'), false);
});
test('render localizes UI and escapes HTML, including embedded JSON script termination', () => {
  const b = fixture('daily.en.json'); b.title = '</script><script>alert(1)</script>'; b.sections[0].items[0].headline = '<img src=x onerror=alert(1)>';
  const en = renderHtml(b), zh = renderHtml(b, { locale: 'zh' });
  assert.ok(!en.includes(b.title)); assert.ok(!en.includes(b.sections[0].items[0].headline));
  assert.match(en, /lang="en"/); assert.match(en, /Search this brief/); assert.match(zh, /lang="zh-CN"/); assert.match(zh, /目录/);
  assert.match(en, /rel="noopener noreferrer"/); assert.match(en, /\\u003c\/script>/);
  assert.throws(() => renderHtml(b, { locale: 'xx' }), /locale/);
});
test('push payload is always bounded in UTF-8, with usable source actions', () => {
  const b = fixture('daily.zh.json'); b.bluf = Array(100).fill('简报'.repeat(1000)); b.sections[0].items[0].headline = '标题[]()'.repeat(1000); b.sections[0].items[0].sources[0].url = 'https://example.org/' + 'x'.repeat(5000);
  const payload = buildPush(b); assert.ok(Buffer.byteLength(payload.message) <= 4096); assert.equal(payload.actions.length, 1);
  const weekly = buildPush(fixture('weekly.en.json')); assert.match(weekly.message, /Illustrative/);
});
test('run imports daily/weekly, skips due runs and preserves existing output', async t => {
  const { cfg } = setup(t); const input = path.join(projectRoot, 'examples', 'daily.en.json');
  const result = await runBrief(cfg, { input }); assert.equal(result.items, 1);
  assert.equal(fs.existsSync(path.join(result.dir, 'index.html')), true);
  assert.equal(readJson(path.join(cfg.outRoot, 'latest.json')).length, 1);
  const old = fs.readFileSync(path.join(result.dir, 'brief.json'), 'utf8');
  await assert.rejects(runBrief(cfg, { input }), /already exists/); assert.equal(fs.readFileSync(path.join(result.dir, 'brief.json'), 'utf8'), old);
  assert.equal((await runBrief(cfg, { kind: 'daily', date: '2025-01-15', due: true })).skipped, true);
  await assert.rejects(runBrief(cfg, { kind: 'daily', date: '2025-01-16', due: true }), /disabled/);
  cfg.schedule.dailyEveryDays = 3;
  assert.equal((await runBrief(cfg, { kind: 'daily', date: '2025-01-16', due: true })).skipped, true);
  await assert.rejects(runBrief(cfg, { kind: 'daily', date: '2025-01-18', due: true }), /disabled/);
  await runBrief(cfg, { input: path.join(projectRoot, 'examples', 'weekly.en.json'), kind: 'weekly' });
  assert.equal(readJson(path.join(cfg.outRoot, 'latest.json')).length, 2);
  await assert.rejects(runBrief(cfg, { input, kind: 'weekly' }), /kind\/date/);
});
test('disabled or failed providers publish no brief and always release locks', async t => {
  const { cfg } = setup(t); await assert.rejects(runBrief(cfg, { date: '2025-01-15' }), /disabled/);
  assert.deepEqual(fs.readdirSync(cfg.outRoot), []);
  fs.writeFileSync(path.join(cfg.outRoot, '.run.lock'), 'test');
  await assert.rejects(runBrief(cfg), /active/); assert.equal(fs.readFileSync(path.join(cfg.outRoot, '.run.lock'), 'utf8'), 'test');
});
test('scheduler exports native formats with quoted paths and does not install anything', t => {
  const { cfg } = setup(t); cfg.configPath = path.join(path.dirname(cfg.configPath), "space & quote's %value", 'config.json');
  const windows = schedulerFiles(cfg, 'windows')['install-tasks.ps1']; assert.match(windows, /New-ScheduledTaskTrigger -Weekly/); assert.match(windows, /--due/); assert.match(windows, /quote''s/);
  const linux = schedulerFiles(cfg, 'linux')['world-brief.cron']; assert.match(linux, /30 7 \* \* \*/); assert.match(linux, /0 9 \* \* 0/); assert.ok(linux.includes('\\%'));
  const mac = schedulerFiles(cfg, 'macos'); assert.equal(Object.keys(mac).length, 2); assert.match(mac['org.worldbrief.daily.plist'], /&amp;/); assert.match(mac['org.worldbrief.weekly.plist'], /<key>Weekday<\/key><integer>0/);
  assert.throws(() => schedulerFiles(cfg, 'other'), /platform/);
});
test('privacy scanner detects synthetic secrets and private runtime files without printing values', t => {
  const { root } = setup(t); fs.writeFileSync(path.join(root, 'leak.txt'), ['example', '@', 'invalid.test'].join(''));
  fs.writeFileSync(path.join(root, '.env'), 'LOCAL_VALUE=1'); const result = scan(root);
  assert.ok(result.findings.some(f => f.rule === 'email-address')); assert.ok(result.findings.some(f => f.rule === 'private-runtime-file'));
  assert.ok(!JSON.stringify(result).includes('@'));
});
