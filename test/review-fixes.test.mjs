import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { defaults, projectRoot, readJson } from '../src/config.mjs';
import { renderArchive } from '../src/render.mjs';
import { schedulerFiles, writeSchedules } from '../src/schedule.mjs';
import { buildPush } from '../src/push.mjs';
import { strings } from '../src/i18n.mjs';

const fixture = (kind, locale) => readJson(path.join(projectRoot, 'examples', `${kind}.${locale}.json`));
function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'world-brief-review-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, cfg: { ...defaults(), configPath: path.join(root, 'config.json') } };
}

test('public documentation links resolve and provenance states licensing and import rights', () => {
  const docs = ['README.md', 'README.zh-CN.md', 'SPEC.md', ...fs.readdirSync(path.join(projectRoot, 'docs')).filter(f => f.endsWith('.md')).map(f => 'docs/' + f)];
  for (const file of docs) {
    const content = fs.readFileSync(path.join(projectRoot, file), 'utf8');
    for (const [, target] of content.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)) {
      if (/^(?:https?:|#)/.test(target)) continue;
      assert.ok(fs.existsSync(path.resolve(projectRoot, path.dirname(file), target.split('#')[0])), `${file}: ${target}`);
    }
  }
  const provenance = fs.readFileSync(path.join(projectRoot, 'docs/provenance.md'), 'utf8');
  for (const phrase of ['MIT', 'first-party code', 'system fonts only', 'synthetic', 'No third-party code', 'confirm rights']) assert.ok(provenance.includes(phrase), phrase);
});

test('archive uses middle dots for latest dates and daily/weekly navigation in both locales', t => {
  const { root } = setup(t);
  for (const locale of ['en', 'zh']) {
    for (const kind of ['daily', 'weekly']) {
      const b = fixture(kind, locale), dir = path.join(root, `${b.date}-${kind}`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'brief.json'), JSON.stringify(b));
      fs.writeFileSync(path.join(dir, 'index.html'), 'Rendered example');
    }
    renderArchive(root, locale);
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.ok(html.includes(strings(locale).latest + ' \u00b7 '));
    assert.match(html, /<\/a> \u00b7 <a href="#archive-weekly">/);
    const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    assert.ok(!markup.includes(' ? '));
  }
});

test('Windows exports permit starting and continuing on battery power', t => {
  const { cfg } = setup(t);
  const script = schedulerFiles(cfg, 'windows')['install-tasks.ps1'];
  assert.match(script, /New-ScheduledTaskSettingsSet[^\n]* -AllowStartIfOnBatteries\b/);
  assert.match(script, /New-ScheduledTaskSettingsSet[^\n]* -DontStopIfGoingOnBatteries\b/);
});

test('cron and both launchd jobs export a provider search PATH', t => {
  const { cfg } = setup(t), searchPath = '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin';
  const cron = schedulerFiles(cfg, 'linux')['world-brief.cron'].split('\n');
  const env = cron.indexOf('PATH=' + searchPath);
  assert.ok(env >= 0);
  assert.ok(cron.findIndex(line => /^\d/.test(line)) > env);
  const plists = schedulerFiles(cfg, 'macos');
  assert.equal(Object.keys(plists).length, 2);
  for (const plist of Object.values(plists)) assert.ok(plist.includes(`<key>EnvironmentVariables</key><dict><key>PATH</key><string>${searchPath}</string></dict>`));
});

test('package metadata keeps private publication and explicit repository placeholders', () => {
  const pkg = readJson(path.join(projectRoot, 'package.json'));
  assert.equal(pkg.private, true);
  assert.equal(pkg.author, undefined);
  assert.deepEqual(pkg.repository, { type: 'git', url: 'git+https://github.com/rxxldq/world-brief.git' });
  assert.equal(pkg.homepage, 'https://github.com/rxxldq/world-brief#readme');
  assert.deepEqual(pkg.bugs, { url: 'https://github.com/rxxldq/world-brief/issues' });
  assert.deepEqual(pkg.keywords, ['news', 'briefing', 'digest', 'cli', 'ntfy', 'bilingual']);
});

test('oversized weekly sections retain the longest prefix of whole rows and an omission notice', () => {
  for (const locale of ['en', 'zh']) {
    const brief = fixture('weekly', locale), item = brief.sections[0].items[0];
    brief.sections = [{ title: 'Perspectives', items: [item] }];
    item.headline = 'A useful story';
    item.voices = Array.from({ length: 80 }, (_, i) => ({ ...item.voices[0], name: `Voice${String(i).padStart(2, '0')} ` + '观'.repeat(20), outlet: '论'.repeat(26) }));
    const payload = buildPush(brief, locale), message = payload.message;
    assert.ok(Buffer.byteLength(message) <= 3900);
    assert.ok(message.includes('**Perspectives**\n- [A useful story]'));
    const included = [...message.matchAll(/Voice(\d{2})/g)].map(m => Number(m[1]));
    assert.ok(included.length > 0 && included.length < 80);
    assert.deepEqual(included, Array.from({ length: included.length }, (_, i) => i));
    assert.ok(message.endsWith(strings(locale).pushMore));
    const nextRow = message.split('\n').find(row => row.includes('Voice00')).replace('Voice00', `Voice${String(included.length).padStart(2, '0')}`);
    assert.ok(Buffer.byteLength(message + '\n' + nextRow) > 3900, 'another complete row must not fit');
  }
});

test('cleaned empty link titles use the source host and retain Markdown neutralisation', () => {
  const brief = fixture('daily', 'en'), item = brief.sections[0].items[0];
  item.headline = 'https://machine.local/private';
  item.sources = [{ url: 'https://example.org/a(b)' }];
  const payload = buildPush(brief);
  assert.ok(payload.message.includes('[example.org](https://example.org/a%28b%29)'));
  assert.ok(!payload.message.includes('[]('));
  assert.ok(!JSON.stringify(payload).includes('machine.local'));
  assert.equal(payload.actions[0].label, 'example.org');
});

test('Windows PowerShell parses all single-quote delimiters in exported paths literally', { skip: process.platform !== 'win32' ? 'Windows PowerShell parsing requires Windows' : false }, t => {
  const { root, cfg } = setup(t);
  cfg.configPath = path.join(root, 'reader\u2018s\u2019\u201a\u201b', 'config.json');
  const [file] = writeSchedules(cfg, 'windows', path.join(root, 'schedules'));
  const quote = value => "'" + value.replace(/['\u2018\u2019\u201a\u201b]/g, c => c + c) + "'";
  const code = `[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding; $tokens=$null; $errors=$null; $tree=[System.Management.Automation.Language.Parser]::ParseFile(${quote(file)}, [ref]$tokens, [ref]$errors); if($errors.Count){$errors | Out-String | Write-Error; exit 2}; @($tree.FindAll({param($n) $n -is [System.Management.Automation.Language.StringConstantExpressionAst]}, $true) | ForEach-Object {$_.Value}) | ConvertTo-Json -Compress`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', code], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(JSON.parse(result.stdout).some(value => value.includes(cfg.configPath)));
});
