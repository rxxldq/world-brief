import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { defaults, projectRoot, readJson } from '../src/config.mjs';
import { validateBrief } from '../src/validate.mjs';
import { renderHtml } from '../src/render.mjs';
import { generationRequest } from '../src/provider.mjs';

const fixture = locale => readJson(path.join(projectRoot, 'examples', `weekly.${locale}.json`));
const funding = () => ({ status: 'documented', scope: 'person', summary: 'Synthetic public disclosure for a test only.', sources: [{ url: 'https://example.org/disclosure', title: 'Test disclosure', publisher: 'Example' }], checked_at: '2025-01-19' });
test('weekly optional commentary and funding preserve simple brief compatibility', () => {
  for (const locale of ['en', 'zh']) {
    const b = fixture(locale);
    assert.deepEqual(validateBrief(b), []);
    const voices = b.sections[0].items[0].voices;
    assert.ok(voices.some(v => v.funding.status === 'not_found'));
    assert.ok(voices.some(v => v.funding.status === 'not_checked'));
    for (const v of voices) {
      assert.ok(['position', 'evidence', 'reasoning', 'counterpoint'].every(k => v[k]?.length > 10));
      for (const k of ['position', 'evidence', 'reasoning', 'counterpoint', 'funding']) delete v[k];
    }
    assert.deepEqual(validateBrief(b), []);
    assert.doesNotThrow(() => renderHtml(b));
  }
});

test('funding requires explicit scope, status, date and safe citations for documented claims', () => {
  const b = fixture('en'), v = b.sections[0].items[0].voices[0];
  v.funding = funding(); assert.deepEqual(validateBrief(b), []);
  const mutations = [
    f => f.status = 'none', f => f.scope = 'outlet', f => f.checked_at = '2025-02-30',
    f => f.summary = '', f => f.sources = [], f => f.sources = null,
    f => delete f.sources, f => f.sources = [{}], f => f.sources = [{ url: 'javascript:alert(1)' }],
    f => f.sources[0].title = 1, f => f.limitations = [],
  ];
  for (const mutate of mutations) {
    v.funding = funding(); mutate(v.funding);
    assert.ok(validateBrief(b).some(e => e.includes('funding')));
  }
  for (const value of [null, [], 'unknown']) {
    v.funding = value; assert.ok(validateBrief(b).some(e => e.includes('funding')));
  }
  for (const key of ['position', 'evidence', 'reasoning', 'counterpoint']) {
    v.funding = funding(); v[key] = {};
    assert.ok(validateBrief(b).some(e => e.includes(key))); delete v[key];
  }
  for (const status of ['not_found', 'not_checked']) {
    v.funding = { ...funding(), status, sources: [] };
    assert.deepEqual(validateBrief(b), []);
  }
});

test('funding and detailed perspectives render localized, escaped content with uncertainty and scope', () => {
  const b = fixture('en'), v = b.sections[0].items[0].voices[0];
  const hostile = '</script><img src=x onerror=alert(1)>';
  Object.assign(v, { position: hostile, evidence: hostile, reasoning: hostile, counterpoint: hostile });
  v.funding = { ...funding(), summary: hostile, limitations: hostile, sources: [{ url: 'https://example.org/?q=%22', title: hostile }] };
  for (const locale of ['en', 'zh']) {
    const html = renderHtml(b, { locale });
    assert.ok(!html.includes(hostile)); assert.match(html, /&lt;\/script&gt;/);
    assert.match(html, /https:\/\/example.org\/\?q=%22/);
    assert.match(html, /class="voice-counterpoint"/);
    assert.match(html, /class="funding"/);
    assert.match(html, /rel="noopener noreferrer"/);
    const data = JSON.parse(html.match(/<script type="application\/json" id="wb-data">(.*?)<\/script>/s)[1]);
    assert.ok(data.items[0].s.includes(hostile));
    assert.ok(data.items[0].s.includes(v.funding.sources[0].url));
    if (locale === 'en') {
      assert.match(html, /Personal ties/); assert.match(html, /Employer \/ outlet \/ organization/);
      assert.match(html, /Unknown — no information found/); assert.match(html, /Unknown — not checked/);
      assert.match(html, /does not establish payment for a statement/);
    } else {
      assert.match(html, /核心立场/); assert.match(html, /所据材料/); assert.match(html, /推理过程/);
      assert.match(html, /个人经济关联/); assert.match(html, /未知——有限核查未找到资料/);
      assert.match(html, /缺少资料不等于没有资金支持/);
    }
  }
});

test('weekly generation requests bound funding checks and require substantive attributed reasoning', () => {
  const cfg = defaults();
  const weekly = generationRequest(cfg, { kind: 'weekly', date: '2025-01-19', window: '2025-01-12 ~ 2025-01-19' });
  assert.match(weekly.prompt, /position, evidence, reasoning and counterpoint/);
  assert.match(weekly.prompt, /150–250 Chinese characters or 90–160 English words/);
  assert.match(weekly.prompt, /1–2 bounded primary-source funding checks per person/);
  assert.match(weekly.prompt, /reuse an organization's result/);
  assert.match(weekly.prompt, /Unknown does not mean no funding/);
  assert.match(weekly.prompt, /Never infer payment for a particular statement/);
  assert.match(weekly.prompt, /not_checked when no check was completed/);
  const daily = generationRequest(cfg, { kind: 'daily', date: '2025-01-19', window: '24 hours' });
  assert.doesNotMatch(daily.prompt, /funding checks per person/);
});
