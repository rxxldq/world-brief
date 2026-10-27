import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { projectRoot } from '../src/config.mjs';
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).filter(e => !['.git', 'node_modules', '.world-brief', 'schedules'].includes(e.name)).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
const files = walk(projectRoot).filter(f => /\.(mjs|js)$/.test(f));
for (const file of files) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
}
console.log(`OK: syntax checked ${files.length} JavaScript modules`);
