import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readJson, dateInZone } from './config.mjs';
import { assertBrief, isDate } from './validate.mjs';
import { generationRequest, invokeProvider } from './provider.mjs';
import { renderHtml, renderArchive } from './render.mjs';

export function previousBrief(root, kind) {
  if (!fs.existsSync(root)) return undefined;
  return fs.readdirSync(root).filter(d => new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${kind}$`).test(d) && fs.existsSync(path.join(root, d, 'index.html'))).sort().at(-1)?.slice(0, 10);
}
const dayDiff = (a, b) => (Date.parse(a) - Date.parse(b)) / 86400000;

export async function runBrief(cfg, { kind = 'daily', date, input, due = false } = {}) {
  if (!['daily', 'weekly'].includes(kind)) throw new Error('kind must be daily|weekly');
  let brief = input ? assertBrief(readJson(path.resolve(input)), { dir: path.dirname(path.resolve(input)) }) : undefined;
  date = date || brief?.date || dateInZone(cfg.timezone);
  if (!isDate(date)) throw new Error('date must be a real YYYY-MM-DD date');
  if (brief && (brief.kind !== kind || brief.date !== date)) throw new Error('Input kind/date differs from requested kind/date');
  const root = cfg.outRoot;
  fs.mkdirSync(root, { recursive: true });
  const lock = path.join(root, '.run.lock');
  let fd;
  try { fd = fs.openSync(lock, 'wx', 0o600); }
  catch (e) { if (e.code === 'EEXIST') throw new Error('Another run is active, or .run.lock needs manual recovery'); throw e; }
  const staging = path.join(root, '.staging-' + randomUUID());
  let sandbox;
  try {
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, started: new Date().toISOString() }));
    const previous = previousBrief(root, kind);
    const interval = kind === 'daily' ? cfg.schedule.dailyEveryDays : 7;
    if (due && previous && dayDiff(date, previous) < interval) return { skipped: true, reason: 'not due' };
    const name = `${date}-${kind}`, destination = path.join(root, name);
    if (fs.existsSync(destination)) throw new Error('Brief already exists; existing output is preserved');
    fs.mkdirSync(staging);
    if (!brief) {
      sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'world-brief-provider-'));
      const start = previous && previous < date ? previous : new Date(Date.parse(date) - interval * 86400000).toISOString().slice(0, 10);
      const output = await invokeProvider(cfg, generationRequest(cfg, { kind, date, window: `${start} ~ ${date}` }), sandbox);
      try { brief = JSON.parse(output.replace(/^\uFEFF/, '')); } catch { throw new Error('Provider must return a single brief JSON object'); }
      assertBrief(brief, { dir: staging });
      if (brief.kind !== kind || brief.date !== date) throw new Error('Provider returned the wrong kind/date');
      // Providers cannot create local images; only --input may import validated raster files.
      if (brief.sections.some(s => s.items.some(it => it.images?.some(im => im.file)))) throw new Error('Provider local image files are not supported');
    } else {
      for (const im of brief.sections.flatMap(s => s.items.flatMap(it => it.images || []))) {
        if (im.file) { fs.mkdirSync(path.join(staging, 'img'), { recursive: true }); fs.copyFileSync(path.join(path.dirname(path.resolve(input)), im.file), path.join(staging, im.file)); }
      }
    }
    assertBrief(brief, { dir: staging });
    fs.writeFileSync(path.join(staging, 'brief.json'), JSON.stringify(brief, null, 2) + '\n');
    fs.writeFileSync(path.join(staging, 'index.html'), renderHtml(brief, { dir: staging, locale: cfg.locale, dirname: name }));
    fs.renameSync(staging, destination);
    renderArchive(root, cfg.locale);
    return { skipped: false, dir: destination, items: brief.sections.reduce((n, s) => n + s.items.length, 0) };
  } finally {
    fs.closeSync(fd); fs.rmSync(lock, { force: true });
    fs.rmSync(staging, { recursive: true, force: true });
    if (sandbox) fs.rmSync(sandbox, { recursive: true, force: true });
  }
}
