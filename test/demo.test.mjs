import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { buildDemo } from '../scripts/build-demo.mjs';
test('public preview includes only synthetic bilingual fixtures and disables direct AI requests', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'world-brief-demo-'));
  t.after(() => { if (root.startsWith(path.join(os.tmpdir(), 'world-brief-demo-'))) fs.rmSync(root, { recursive: true, force: true }); });
  buildDemo(root);
  assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /Fictional demonstration only/);
  for (const locale of ['en', 'zh']) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, locale, 'latest.json'), 'utf8'));
    assert.equal(manifest.length, 2);
    for (const entry of manifest) {
      const html = fs.readFileSync(path.join(root, locale, entry.dir, 'index.html'), 'utf8');
      assert.match(html, /"mode":"static"/);
      assert.match(html, /data.mode !== 'static'/);
      assert.match(html, /https:\/\/example.org\//);
    }
  }
  assert.ok(!fs.existsSync(path.join(root, 'config.json')));
});
