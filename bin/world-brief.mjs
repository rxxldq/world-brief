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
import { commandStrings, localizeDiagnostic } from '../src/i18n.mjs';

let outputLocale = 'en';
const help = t => `World Brief — ${t.cliIntro}
${t.cliUsage}: node bin/world-brief.mjs <command> [arguments]
  init [--config config.json] [--locale en|zh]
  run [--config config.json] [--kind daily|weekly] [--input brief.json] [--date YYYY-MM-DD] [--due]
  validate <brief-dir> [--locale en|zh]
  render <brief-dir> [--locale en|zh]
  serve [--config config.json]
  push <brief-dir> [--locale en|zh] [--send --config config.json]
  schedule --platform windows|linux|macos [--out schedules] [--config config.json]
  help [--locale en|zh]
${t.cliQuickStart}
${t.cliSafety}
`;

function configuration(file, locale) {
  try {
    const cfg = loadConfig(file);
    outputLocale = locale || cfg.locale;
    return cfg;
  } catch (error) {
    // Invalid config may still specify the language for its own diagnostic.
    if (!locale) {
      try { if (readJson(file)?.locale === 'zh') outputLocale = 'zh'; } catch { /* use the explicit/default language */ }
    }
    throw error;
  }
}

async function main() {
  // Preserve the requested diagnostic language even when strict argument parsing fails.
  const args = process.argv.slice(2), end = args.indexOf('--');
  const options = end < 0 ? args : args.slice(0, end);
  const localeHint = options.findLastIndex(arg => arg === '--locale' || arg.startsWith('--locale='));
  if (localeHint >= 0 && (options[localeHint] === '--locale=zh' || (options[localeHint] === '--locale' && options[localeHint + 1] === 'zh'))) outputLocale = 'zh';
  const { values: v, positionals: p } = parseArgs({ allowPositionals: true, options: {
    config: { type: 'string', default: 'config.json' }, locale: { type: 'string' }, kind: { type: 'string', default: 'daily' },
    input: { type: 'string' }, date: { type: 'string' }, due: { type: 'boolean' }, send: { type: 'boolean' },
    platform: { type: 'string' }, out: { type: 'string', default: 'schedules' }, help: { type: 'boolean', short: 'h' }
  } });
  if (v.locale && ['en', 'zh'].includes(v.locale)) outputLocale = v.locale;
  const command = p[0] || 'help';
  if (v.help || command === 'help') { console.log(help(commandStrings(outputLocale))); return; }
  if (!['init', 'run', 'validate', 'render', 'serve', 'push', 'schedule'].includes(command)) throw new Error('Unknown command; use help');
  if (p.length > (['validate', 'render', 'push'].includes(command) ? 2 : 1)) throw new Error('Unexpected positional argument');
  if (v.locale && !['en', 'zh'].includes(v.locale)) throw new Error('locale must be en|zh');
  if (command === 'init') { initConfig(v.config, v.locale); console.log(commandStrings(outputLocale).created); return; }
  if (['validate', 'render', 'push'].includes(command)) {
    if (!p[1]) throw new Error('brief-dir is required');
    const dir = path.resolve(p[1]);
    const raw = readJson(path.join(dir, 'brief.json'));
    if (!v.locale && ['en', 'zh'].includes(raw?.locale)) outputLocale = raw.locale;
    const brief = assertBrief(raw, { dir });
    if (command === 'validate') { console.log(commandStrings(outputLocale).validated); return; }
    if (command === 'render') { renderDirectory(dir, v.locale); console.log(commandStrings(outputLocale).rendered + ': ' + path.join(dir, 'index.html')); return; }
    const cfg = v.send ? configuration(v.config, v.locale) : undefined;
    const payload = buildPush(brief, v.locale || cfg?.locale || brief.locale || 'en', dir);
    console.log(JSON.stringify(v.send ? await sendPush(cfg, payload) : payload, null, 2)); return;
  }
  const cfg = configuration(v.config, v.locale);
  if (v.locale) cfg.locale = v.locale;
  outputLocale = cfg.locale;
  if (command === 'run') { console.log(JSON.stringify(await runBrief(cfg, { kind: v.kind, date: v.date, input: v.input, due: v.due }), null, 2)); return; }
  if (command === 'schedule') { console.log(JSON.stringify(writeSchedules(cfg, v.platform, v.out), null, 2)); return; }
  const { server, origin } = await startServer(cfg);
  console.log(commandStrings(outputLocale).serverLabel + ': ' + origin);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(); server.closeIdleConnections(); });
}
main().catch(e => { console.error(commandStrings(outputLocale).failure + ': ' + localizeDiagnostic(e, outputLocale)); process.exitCode = 1; });
