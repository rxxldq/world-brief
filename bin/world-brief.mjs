#!/usr/bin/env node
import path from 'node:path';
import { parseArgs } from 'node:util';
import { initConfig, loadConfig, readJson } from '../src/config.mjs';
import { assertBrief } from '../src/validate.mjs';
import { renderDirectory } from '../src/render.mjs';
import { runBrief } from '../src/run.mjs';
import { buildPush, sendPush } from '../src/push.mjs';
import { writeSchedules } from '../src/schedule.mjs';
import { startServer } from '../src/server.mjs';

const HELP = `World Brief — local-first news briefs (Node.js 22+)
Usage: node bin/world-brief.mjs <command> [arguments]
  init [--config config.json] [--locale en|zh]
  run [--config config.json] [--kind daily|weekly] [--input brief.json] [--date YYYY-MM-DD] [--due]
  validate <brief-dir>
  render <brief-dir> [--locale en|zh]
  serve [--config config.json]
  push <brief-dir> [--locale en|zh] [--send --config config.json]
  schedule --platform windows|linux|macos [--out schedules] [--config config.json]
  help
Offline quick start: init, run --input examples/daily.en.json, serve.
Schedule only writes files. Push only previews unless --send is supplied.
`;

async function main() {
  const { values: v, positionals: p } = parseArgs({ allowPositionals: true, options: {
    config: { type: 'string', default: 'config.json' }, locale: { type: 'string' }, kind: { type: 'string', default: 'daily' },
    input: { type: 'string' }, date: { type: 'string' }, due: { type: 'boolean' }, send: { type: 'boolean' },
    platform: { type: 'string' }, out: { type: 'string', default: 'schedules' }, help: { type: 'boolean', short: 'h' }
  } });
  const command = p[0] || 'help';
  if (v.help || command === 'help') { console.log(HELP); return; }
  if (!['init', 'run', 'validate', 'render', 'serve', 'push', 'schedule'].includes(command)) throw new Error('Unknown command; use help');
  if (p.length > (['validate', 'render', 'push'].includes(command) ? 2 : 1)) throw new Error('Unexpected positional argument');
  if (v.locale && !['en', 'zh'].includes(v.locale)) throw new Error('locale must be en|zh');
  if (command === 'init') { initConfig(v.config, v.locale); console.log('Created configuration'); return; }
  if (['validate', 'render', 'push'].includes(command)) {
    if (!p[1]) throw new Error('brief-dir is required');
    const dir = path.resolve(p[1]);
    const brief = assertBrief(readJson(path.join(dir, 'brief.json')), { dir });
    if (command === 'validate') { console.log('OK: brief structure, source URLs and image provenance'); return; }
    if (command === 'render') { renderDirectory(dir, v.locale); console.log('RENDERED: ' + path.join(dir, 'index.html')); return; }
    const cfg = v.send ? loadConfig(v.config) : undefined;
    const payload = buildPush(brief, v.locale || cfg?.locale || brief.locale || 'en', dir);
    console.log(JSON.stringify(v.send ? await sendPush(cfg, payload) : payload, null, 2)); return;
  }
  const cfg = loadConfig(v.config);
  if (v.locale) cfg.locale = v.locale;
  if (command === 'run') { console.log(JSON.stringify(await runBrief(cfg, { kind: v.kind, date: v.date, input: v.input, due: v.due }), null, 2)); return; }
  if (command === 'schedule') { console.log(JSON.stringify(writeSchedules(cfg, v.platform, v.out), null, 2)); return; }
  const { server, origin } = await startServer(cfg);
  console.log('World Brief: ' + origin);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(); server.closeIdleConnections(); });
}
main().catch(e => { console.error('FAIL: ' + e.message); process.exitCode = 1; });
