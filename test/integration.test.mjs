import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { defaults, projectRoot, readJson } from '../src/config.mjs';
import { invokeProvider } from '../src/provider.mjs';
import { runBrief } from '../src/run.mjs';
import { startServer } from '../src/server.mjs';

function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'world-brief-integration-'));
  t.after(() => { if (root.startsWith(path.join(os.tmpdir(), 'world-brief-integration-'))) fs.rmSync(root, { recursive: true, force: true }); });
  const cfg = { ...defaults(), configPath: path.join(root, 'config.json'), outRoot: path.join(root, 'briefs') };
  cfg.ask.port = 0;
  return { root, cfg };
}
function command(cfg, code) {
  cfg.provider = { type: 'command', executable: process.execPath, args: ['--input-type=module', '-e', code], timeoutMs: 5000 };
}
const fake = `let input='';for await(const c of process.stdin)input+=c;const r=JSON.parse(input);if(r.task==='ask'){console.log('A synthetic answer.')}else{console.log(JSON.stringify({kind:r.kind,date:r.date,title:'Synthetic generated brief',bluf:['Synthetic only'],sections:[{title:'Test',items:[{headline:'A test item',sources:[{url:'https://example.org/'}]}]}]}))}`;

test('command protocol supports generation and isolates failed, malformed and timed-out runs', async t => {
  const { root, cfg } = setup(t); command(cfg, fake);
  const result = await runBrief(cfg, { date: '2025-01-15' }); assert.equal(result.items, 1);
  assert.equal(readJson(path.join(result.dir, 'brief.json')).title, 'Synthetic generated brief');
  for (const code of ["process.exit(2)", "console.log('not JSON')", "setTimeout(()=>{}, 10000)", "console.log(JSON.stringify({kind:'daily'}))"]) {
    command(cfg, code); cfg.provider.timeoutMs = 100;
    await assert.rejects(runBrief(cfg, { date: '2025-01-16' }));
    assert.ok(!fs.existsSync(path.join(cfg.outRoot, '2025-01-16-daily')));
    assert.ok(!fs.readdirSync(cfg.outRoot).some(d => d.startsWith('.staging-') || d === '.run.lock'));
  }
  command(cfg, "process.stdout.write('x'.repeat(3*1024*1024))"); await assert.rejects(invokeProvider(cfg, {}, root), /exceeds/);
  command(cfg, "process.stdout.write(Buffer.from([228]));setTimeout(()=>process.stdout.write(Buffer.from([184,173])),30)");
  assert.equal(await invokeProvider(cfg, {}, root), '中');
});

test('loopback server serves artifacts only, rejects hostile hosts, traversal and malformed URLs', async t => {
  const { root, cfg } = setup(t);
  const result = await runBrief(cfg, { input: path.join(projectRoot, 'examples', 'daily.en.json') });
  fs.writeFileSync(path.join(cfg.outRoot, 'private.txt'), 'private');
  const { server, origin } = await startServer(cfg);
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  assert.equal((await fetch(origin + '/health')).status, 200);
  const page = await fetch(origin + '/2025-01-15-daily/index.html'); assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  for (const suffix of ['/config.json', '/private.txt', '/.ask-counts.json', '/2025-01-15-daily/prompt.md', '/2025-01-15-daily/img/map.svg', '/%2e%2e%2fprivate.txt', '/%ZZ']) {
    assert.ok([400, 404].includes((await fetch(origin + suffix)).status), suffix);
  }
  const hostileHost = await new Promise((resolve, reject) => {
    const req = http.request(origin + '/health', { headers: { host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(hostileHost, 403);
  assert.equal((await fetch(origin + '/', { method: 'PUT' })).status, 405);
  await t.test('symlink outside the artifact root is not served', async subtest => {
    const file = path.join(root, 'outside.json'); fs.writeFileSync(file, '{}');
    fs.unlinkSync(path.join(result.dir, 'brief.json'));
    try { fs.symlinkSync(file, path.join(result.dir, 'brief.json'), 'file'); }
    catch (e) {
      if (process.platform === 'win32' && e.code === 'EPERM') {
        subtest.skip('Windows symlink privilege is unavailable'); return;
      }
      throw e;
    }
    assert.equal((await fetch(origin + '/2025-01-15-daily/brief.json')).status, 404);
  });
});

test('ask API enforces Origin/header, validation, concurrency, durable daily cap and no transcript exposure', async t => {
  const { cfg } = setup(t); command(cfg, fake.replace("console.log('A synthetic answer.')", "await new Promise(r=>setTimeout(r,150));console.log('A synthetic answer.')"));
  cfg.ask.enabled = true; cfg.ask.maxPerDay = 1;
  await runBrief(cfg, { input: path.join(projectRoot, 'examples', 'daily.en.json') });
  let live = await startServer(cfg);
  t.after(() => new Promise(resolve => { live.server.close(resolve); live.server.closeAllConnections(); }));
  const request = (body, overrides = {}) => fetch(live.origin + '/api/ask', { method: 'POST', headers: { origin: live.origin, 'x-wb': '1', 'content-type': 'application/json', ...overrides }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  const body = { dir: '2025-01-15-daily', idx: 0, question: 'Explain this synthetic example.' };
  assert.equal((await request(body, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await request(body, { 'x-wb': '0' })).status, 403);
  for (const bad of ['{', 'null', { ...body, idx: -1 }, { ...body, history: {} }, { ...body, question: 'a'.repeat(601) }]) assert.equal((await request(bad)).status, 400);
  assert.equal((await request({ ...body, idx: 99 })).status, 404);
  assert.equal((await request({ ...body, question: 'a'.repeat(21000) })).status, 413);
  const first = request(body);
  let busy = false;
  for (let i = 0; i < 30; i++) { const health = await (await fetch(live.origin + '/health')).json(); if (health.busy) { busy = true; break; } await new Promise(r => setTimeout(r, 10)); }
  assert.equal(busy, true);
  assert.equal((await request(body)).status, 429);
  const response = await first; assert.equal(response.status, 200); assert.equal((await response.json()).answer, 'A synthetic answer.');
  assert.equal((await request(body)).status, 429);
  await new Promise(resolve => { live.server.close(resolve); live.server.closeAllConnections(); });
  live = await startServer(cfg);
  assert.equal((await request(body)).status, 429);
  const count = fs.readFileSync(path.join(cfg.outRoot, '.ask-counts.json'), 'utf8'); assert.ok(!count.includes(body.question));
});

test('disabled ask never starts a command', async t => {
  const { cfg } = setup(t); const { server, origin } = await startServer(cfg);
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  assert.equal((await fetch(origin + '/api/ask', { method: 'POST', headers: { origin, 'x-wb': '1', 'content-type': 'application/json' }, body: '{}' })).status, 503);
});

test('invalid absolute request target cannot bypass Host validation', async t => {
  const { cfg } = setup(t); const { server, origin } = await startServer(cfg);
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const status = await new Promise((resolve, reject) => {
    const req = http.request(origin, { path: 'http://evil.example/health', headers: { host: new URL(origin).host } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); req.end();
  });
  assert.equal(status, 403);
});
