import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectRoot } from '../src/config.mjs';

const rules = [
  ['email-address', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
  ['workstation-path', /(?:[A-Z]:[\\/](?:Users|AI-Workspace)[\\/]|[\\/]Users[\\/][^/\\\s]+)/i],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['access-token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})\b/],
  ['embedded-url-credentials', /https?:\/\/[^\s/"']+:[^\s/@"']+@/i]
];
const excluded = new Set(['.git', 'node_modules', '.world-brief', 'schedules']);
export function scan(root = projectRoot) {
  const findings = []; let files = 0;
  function visit(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name), rel = path.relative(root, full).split(path.sep).join('/');
      if (excluded.has(ent.name)) continue;
      if (ent.isSymbolicLink()) { findings.push({ file: rel, rule: 'symlink-not-reviewed' }); continue; }
      if (ent.isDirectory()) { visit(full); continue; }
      files++;
      if (ent.name === 'config.json' || /^\.env(?:\.|$)/.test(ent.name) || /(?:quota\.json|mail-state\.json|\.log|\.jsonl|\.pem|\.key)$/i.test(ent.name)) findings.push({ file: rel, rule: 'private-runtime-file' });
      const bytes = fs.readFileSync(full);
      if (bytes.includes(0)) { findings.push({ file: rel, rule: 'binary-needs-manual-review' }); continue; }
      const content = bytes.toString('utf8');
      for (const [rule, pattern] of rules) if (pattern.test(content)) findings.push({ file: rel, rule });
    }
  }
  visit(root); return { files, findings };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = scan(); console.log(JSON.stringify(result, null, 2));
  if (result.findings.length) process.exitCode = 1;
}
