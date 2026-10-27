import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { projectRoot, readJson } from '../src/config.mjs';
import { startServer } from '../src/server.mjs';
import { loadConfig } from '../src/config.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'world-brief-smoke-'));
const cli = path.join(projectRoot, 'bin', 'world-brief.mjs');
const config = path.join(dir, 'config.json');
const run = args => {
  const r = spawnSync(process.execPath, [cli, ...args], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr); return r.stdout;
};
let server;
try {
  run(['init', '--config', config]);
  for (const locale of ['en', 'zh']) {
    const c = readJson(config); c.locale = locale; c.outRoot = path.join(dir, locale); c.ask.port = 0; fs.writeFileSync(config, JSON.stringify(c));
    for (const [kind, file] of [['daily', `daily.${locale}.json`], ['weekly', `weekly.${locale}.json`]]) {
      const output = JSON.parse(run(['run', '--config', config, '--kind', kind, '--input', path.join(projectRoot, 'examples', file)]));
      run(['validate', output.dir]);
      assert.match(run(['push', output.dir]), /message/);
    }
    const live = await startServer(loadConfig(config)); server = live.server;
    const archive = await fetch(live.origin); assert.equal(archive.status, 200);
    const page = await fetch(live.origin + '/2025-01-15-daily/index.html'); assert.equal(page.status, 200);
    assert.match(await page.text(), new RegExp(`lang="${locale === 'zh' ? 'zh-CN' : 'en'}"`));
    const manifest = await (await fetch(live.origin + '/latest.json')).json(); assert.equal(manifest.length, 2);
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); server = undefined;
  }
  for (const platform of ['windows', 'linux', 'macos']) run(['schedule', '--config', config, '--platform', platform, '--out', path.join(dir, platform)]);
  console.log('OK: CLI init → daily/weekly import → validation → render/archive → HTTP → push preview → scheduler export, en + zh');
} finally {
  if (server) { server.close(); server.closeAllConnections(); }
  if (dir.startsWith(path.join(os.tmpdir(), 'world-brief-smoke-'))) fs.rmSync(dir, { recursive: true, force: true });
}
