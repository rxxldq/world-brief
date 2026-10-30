import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { defaults, loadConfig, readJson, projectRoot } from '../src/config.mjs';
import { strings, locales, cliLocales, localizeDiagnostic } from '../src/i18n.mjs';
import { runBrief } from '../src/run.mjs';
import { invokeProvider } from '../src/provider.mjs';
import { startServer } from '../src/server.mjs';
import { renderArchive, renderDirectory } from '../src/render.mjs';
import { writeSchedules } from '../src/schedule.mjs';

function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'world-brief-optimize 空格-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const cfg = { ...defaults(), configPath: path.join(root, 'config.json'), outRoot: path.join(root, 'briefs') };
  cfg.ask.port = 0;
  return { root, cfg };
}
const input = path.join(projectRoot, 'examples', 'daily.en.json');
const cli = path.join(projectRoot, 'bin', 'world-brief.mjs');

test('config rejects non-object roots and malformed nested groups with field diagnostics', t => {
  const { cfg } = setup(t);
  for (const value of [null, [], 42, 'text', ...['provider', 'ask', 'ntfy', 'schedule'].flatMap(key => [null, [], 'text', false].map(v => ({ [key]: v })))]) {
    fs.writeFileSync(cfg.configPath, JSON.stringify(value));
    assert.throws(() => loadConfig(cfg.configPath), /(?:config|provider|ask|ntfy|schedule).*object/);
  }
  for (const timezone of [null, 42, '', [], {}]) {
    fs.writeFileSync(cfg.configPath, JSON.stringify({ timezone }));
    assert.throws(() => loadConfig(cfg.configPath), /timezone/);
  }
  for (const server of [null, [], 'not a URL']) {
    fs.writeFileSync(cfg.configPath, JSON.stringify({ ntfy: { server } }));
    assert.throws(() => loadConfig(cfg.configPath), /ntfy.server/);
  }
  fs.writeFileSync(cfg.configPath, '{}');
  assert.equal(loadConfig(cfg.configPath).locale, 'en');
});

test('JSON accepts UTF-8 BOM and Unicode paths but rejects corrupt byte sequences', t => {
  const { root } = setup(t), file = path.join(root, '简报 input.json');
  fs.writeFileSync(file, '\uFEFF' + JSON.stringify({ title: '中文 😀' }) + '\r\n');
  assert.deepEqual(readJson(file), { title: '中文 😀' });
  fs.writeFileSync(file, Buffer.concat([Buffer.from('{"title":"'), Buffer.from([0xff]), Buffer.from('"}') ]));
  assert.throws(() => readJson(file), /UTF-8/);
});

test('locale lookup rejects inherited object properties', () => {
  for (const locale of ['toString', 'constructor', '__proto__', 'xx']) assert.throws(() => strings(locale), /locale/);
});

test('due guard ignores incomplete, corrupt and mismatched published directories', async t => {
  const { cfg } = setup(t);
  await runBrief(cfg, { input });
  for (const contents of [undefined, '{', JSON.stringify({}), fs.readFileSync(input, 'utf8')]) {
    const dir = path.join(cfg.outRoot, '2025-01-18-daily');
    fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'index.html'), 'partial');
    if (contents !== undefined) fs.writeFileSync(path.join(dir, 'brief.json'), contents);
    await assert.rejects(runBrief(cfg, { date: '2025-01-19', due: true }), /disabled/);
    assert.ok(!fs.existsSync(path.join(cfg.outRoot, '.run.lock')));
  }
});

test('provider receives literal arguments with shell metacharacters and Unicode', async t => {
  const { root, cfg } = setup(t), marker = path.join(root, 'must-not-exist');
  const args = ['space 空格', '"quoted"', `; touch ${marker}`, '$(echo injected)', '%PATH%'];
  cfg.provider = { type: 'command', executable: process.execPath, args: ['-e', 'console.log(JSON.stringify(process.argv.slice(1)))', '--', ...args], timeoutMs: 5000 };
  assert.deepEqual(JSON.parse(await invokeProvider(cfg, {}, root)), args);
  assert.ok(!fs.existsSync(marker));
});

test('provider rejects invalid UTF-8 instead of publishing replacement characters', async t => {
  const { root, cfg } = setup(t);
  cfg.provider = { type: 'command', executable: process.execPath, args: ['-e', 'process.stdout.write(Buffer.from([0xff]))'], timeoutMs: 5000 };
  await assert.rejects(invokeProvider(cfg, {}, root), /UTF-8/);
});

test('Windows scheduler keeps Unicode paths when read by Windows PowerShell', { skip: process.platform !== 'win32' ? 'Windows PowerShell encoding applies only to Windows' : false }, t => {
  const { root, cfg } = setup(t);
  cfg.configPath = path.join(root, "中文 space & quote's", 'config.json');
  const [file] = writeSchedules(cfg, 'windows', path.join(root, 'schedules'));
  const quote = value => "'" + value.replace(/'/g, "''") + "'";
  // Parse without executing: installing or changing real scheduled tasks is excluded.
  const code = `[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding; $tokens=$null; $errors=$null; $tree=[System.Management.Automation.Language.Parser]::ParseFile(${quote(file)}, [ref]$tokens, [ref]$errors); if($errors.Count){exit 2}; @($tree.FindAll({param($n) $n -is [System.Management.Automation.Language.StringConstantExpressionAst]}, $true) | ForEach-Object {$_.Value}) | ConvertTo-Json -Compress`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', code], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(JSON.parse(result.stdout).some(value => value.includes(cfg.configPath)));
});

test('CLI failures keep nonzero status and Chinese diagnostics, including unreadable inputs', t => {
  const { root, cfg } = setup(t);
  fs.writeFileSync(cfg.configPath, JSON.stringify({ ...defaults(), locale: 'zh' }));
  const cases = [
    ['run', '--config', cfg.configPath],
    ['validate', path.join(root, 'missing'), '--locale', 'zh'],
    ['render', root, '--locale', 'zh'],
    ['run', '--locale', 'zh', '--missing']
  ];
  fs.writeFileSync(path.join(root, 'brief.json'), '{');
  for (const args of cases) {
    const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /[\u3400-\u9fff]/);
  }
});

test('concurrent run cannot remove another run lock or publish a second issue', async t => {
  const { root, cfg } = setup(t), brief = readJson(input);
  brief.date = '2025-01-16';
  cfg.provider = { type: 'command', executable: process.execPath, args: ['-e', `setTimeout(() => console.log(${JSON.stringify(JSON.stringify(brief))}), 100)`], timeoutMs: 5000 };
  const first = runBrief(cfg, { date: brief.date });
  const lock = path.join(cfg.outRoot, '.run.lock'), owner = fs.readFileSync(lock, 'utf8');
  try {
    await assert.rejects(runBrief(cfg, { input }), /active/);
    assert.equal(fs.readFileSync(lock, 'utf8'), owner);
    assert.ok(!fs.existsSync(path.join(cfg.outRoot, '2025-01-15-daily')));
  } finally { await first; }
  assert.ok(!fs.existsSync(lock));
  assert.ok(fs.existsSync(path.join(cfg.outRoot, '2025-01-16-daily', 'index.html')));
});

test('bilingual UI tables match and dynamic diagnostics retain exact field context', () => {
  const leaves = (obj, prefix = '') => Object.entries(obj).flatMap(([key, value]) => value && typeof value === 'object' && !Array.isArray(value) ? leaves(value, prefix + key + '.') : [prefix + key]).sort();
  assert.deepEqual(leaves(locales.en), leaves(locales.zh));
  assert.deepEqual(leaves(cliLocales.en), leaves(cliLocales.zh));
  assert.equal(localizeDiagnostic('Invalid brief:\n- sections[0].items[1].headline is required', 'zh'), '简报无效：\n- sections[0].items[1].headline 为必填项');
  assert.equal(localizeDiagnostic('Provider exited unsuccessfully (2)', 'zh'), '模型服务异常退出（2）');
  assert.equal(localizeDiagnostic('Provider timed out', 'en'), 'Provider timed out');
});

test('Chinese help, successful validation, config and HTTP errors use the selected locale', async t => {
  const { root, cfg } = setup(t);
  const help = spawnSync(process.execPath, [cli, 'help', '--locale', 'zh'], { encoding: 'utf8' });
  assert.equal(help.status, 0); assert.match(help.stdout, /用法/);
  const result = await runBrief(cfg, { input });
  const valid = spawnSync(process.execPath, [cli, 'validate', result.dir, '--locale', 'zh'], { encoding: 'utf8' });
  assert.equal(valid.status, 0); assert.match(valid.stdout, /通过/);
  fs.writeFileSync(cfg.configPath, JSON.stringify({ locale: 'zh', provider: null }));
  const invalid = spawnSync(process.execPath, [cli, 'serve', '--config', cfg.configPath], { encoding: 'utf8' });
  assert.equal(invalid.status, 1); assert.match(invalid.stderr, /provider 必须是对象/);
  cfg.locale = 'zh';
  const { server, origin } = await startServer(cfg);
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  assert.equal((await (await fetch(origin + '/missing')).json()).error, '未找到内容');
});

test('ask rejects JSON lookalike media types and corrupt budget dates without running a provider', async t => {
  const { root, cfg } = setup(t), marker = path.join(root, 'called');
  cfg.ask.enabled = true;
  cfg.provider = { type: 'command', executable: process.execPath, args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'called');console.log('answer')`], timeoutMs: 5000 };
  await runBrief(cfg, { input });
  const { server, origin } = await startServer(cfg);
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const request = type => fetch(origin + '/api/ask', { method: 'POST', headers: { origin, 'x-wb': '1', 'content-type': type }, body: JSON.stringify({ dir: '2025-01-15-daily', idx: 0, question: 'Test?' }) });
  assert.equal((await request('application/jsonp')).status, 403);
  const malformed = await fetch(origin + '/api/ask', { method: 'POST', headers: { origin, 'x-wb': '1', 'content-type': 'application/json' }, body: JSON.stringify({ dir: ['2025-01-15-daily'], idx: 0, question: 'Test?' }) });
  assert.equal(malformed.status, 400);
  for (const day of ['broken', '2025-02-30']) {
    fs.writeFileSync(path.join(cfg.outRoot, '.ask-counts.json'), JSON.stringify({ day, count: 100 }));
    assert.equal((await request('application/json; charset=utf-8')).status, 500);
  }
  assert.ok(!fs.existsSync(marker));
});

test('archive write failure preserves the previous file and cleans temporary output', async t => {
  const { cfg } = setup(t);
  await runBrief(cfg, { input });
  const file = path.join(cfg.outRoot, 'index.html'), old = fs.readFileSync(file, 'utf8');
  const write = fs.writeFileSync;
  t.mock.method(fs, 'writeFileSync', (target, data, ...options) => {
    if (typeof target === 'string' && target.startsWith(file)) {
      write(target, String(data).slice(0, 20), ...options);
      throw new Error('synthetic write failure');
    }
    return write(target, data, ...options);
  });
  assert.throws(() => renderArchive(cfg.outRoot, 'zh'), /synthetic write failure/);
  assert.ok(fs.readFileSync(file, 'utf8') === old, 'the previous archive must remain intact');
  assert.ok(!fs.readdirSync(cfg.outRoot).some(name => name.endsWith('.tmp')));
});

test('rerender write failure preserves the previous issue page', async t => {
  const { cfg } = setup(t), result = await runBrief(cfg, { input });
  const file = path.join(result.dir, 'index.html'), old = fs.readFileSync(file, 'utf8');
  const write = fs.writeFileSync;
  t.mock.method(fs, 'writeFileSync', (target, data, ...options) => {
    if (typeof target === 'string' && target.startsWith(file)) {
      write(target, String(data).slice(0, 20), ...options);
      throw new Error('synthetic write failure');
    }
    return write(target, data, ...options);
  });
  assert.throws(() => renderDirectory(result.dir, 'zh'), /synthetic write failure/);
  assert.ok(fs.readFileSync(file, 'utf8') === old, 'the previous issue page must remain intact');
  assert.ok(!fs.readdirSync(result.dir).some(name => name.endsWith('.tmp')));
});

test('ask rejects corrupt UTF-8 before reserving budget or invoking the provider', async t => {
  const { root, cfg } = setup(t), marker = path.join(root, 'called');
  cfg.ask.enabled = true;
  cfg.provider = { type: 'command', executable: process.execPath, args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'called');console.log('answer')`], timeoutMs: 5000 };
  await runBrief(cfg, { input });
  const { server, origin } = await startServer(cfg);
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const prefix = Buffer.from('{"dir":"2025-01-15-daily","idx":0,"question":"');
  const request = question => fetch(origin + '/api/ask', { method: 'POST', headers: { origin, 'x-wb': '1', 'content-type': 'application/json; charset=utf-8' }, body: Buffer.concat([prefix, question, Buffer.from('"}')]) });
  assert.equal((await request(Buffer.from([0xff]))).status, 400);
  assert.ok(!fs.existsSync(marker));
  assert.ok(!fs.existsSync(path.join(cfg.outRoot, '.ask-counts.json')));
  // A real replacement character is valid Unicode; reject corrupt bytes, not the character.
  assert.equal((await request(Buffer.from('中文 \uFFFD 😀'))).status, 200);
  assert.ok(fs.existsSync(marker));
  assert.equal(readJson(path.join(cfg.outRoot, '.ask-counts.json')).count, 1);
});

test('archive omits date and kind mismatches instead of presenting them as the latest issue', async t => {
  const { cfg } = setup(t);
  const published = await runBrief(cfg, { input });
  const brief = readJson(input);
  for (const name of ['2025-01-18-daily', '2025-01-15-weekly']) {
    const dir = path.join(cfg.outRoot, name);
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'index.html'), 'Mismatched fixture');
    fs.writeFileSync(path.join(dir, 'brief.json'), JSON.stringify(brief));
  }
  const entries = renderArchive(cfg.outRoot);
  assert.deepEqual(entries.map(entry => entry.dir), [path.basename(published.dir)]);
  assert.deepEqual(readJson(path.join(cfg.outRoot, 'latest.json')), entries);
  const html = fs.readFileSync(path.join(cfg.outRoot, 'index.html'), 'utf8');
  assert.ok(!html.includes('2025-01-18-daily/index.html'));
  assert.ok(!html.includes('2025-01-15-weekly/index.html'));
});
