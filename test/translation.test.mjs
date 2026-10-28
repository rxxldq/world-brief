import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { renderTranslation } from '../src/translation.mjs';
import { renderHtml } from '../src/render.mjs';

const context = vm.createContext({ URL, DOMException, AbortController });
vm.runInContext(fs.readFileSync(new URL('../assets/translate.js', import.meta.url), 'utf8'), context);
const api = context.WorldBriefTranslation;

test('language choices cover 39 languages and normalize regional browser preferences', () => {
  assert.equal(api.languages.length, 39);
  assert.equal(new Set(api.languages.map(([code]) => code)).size, 39);
  for (const [input, expected] of [['en-AU', 'en'], ['fr-CA', 'fr'], ['zh-CN', 'zh'], ['zh-Hant-HK', 'zh-Hant'], ['zh_TW', 'zh-Hant'], ['nb-NO', 'no'], ['xx', null]]) assert.equal(api.normalizeLanguage(input), expected);
});

test('cloud fallback needs public opt-in and rejects private URLs and credentials', () => {
  const url = new URL(api.publicTranslationUrl('https://brief.example.org/read.html?private=do-not-send#secret', 'zh-Hant', true));
  assert.equal(url.hostname, 'translate.google.com'); assert.equal(url.searchParams.get('tl'), 'zh-TW');
  assert.equal(url.searchParams.get('u'), 'https://brief.example.org/read.html');
  assert.equal(api.publicTranslationUrl('https://brief.example.org', 'fr'), null);
  for (const input of ['file:///brief.html', 'http://brief.example.org', 'https://localhost', 'https://brief.local', 'https://brief.internal', 'https://127.0.0.1', 'https://192.168.0.3', 'https://[::1]', 'https://2130706433', 'https://user' + ':secret' + '@' + 'brief.example.org']) assert.equal(api.publicTranslationUrl(input, 'fr', true), null, input);
  assert.equal(api.publicTranslationUrl('https://brief.example.org', 'invalid', true), null);
});

test('long Unicode input is split without omissions or surrogate corruption', () => {
  const original = '😀第一段 evidence. '.repeat(900);
  const parts = api.splitText(original);
  assert.ok(parts.length > 1); assert.equal(parts.join(''), original);
  assert.ok(parts.every(p => [...p].length <= 2400 && !/[\uD800-\uDBFF]$/.test(p)));
});

test('all source pair creates start before first download resolves; originals and whitespace are retained', async () => {
  const calls = [], destroyed = [], releases = [];
  const native = { create({ sourceLanguage, targetLanguage }) {
    calls.push([sourceLanguage, targetLanguage]);
    return new Promise(resolve => releases.push(() => resolve({ translate: async text => `[${sourceLanguage}:${text}]`, destroy: () => destroyed.push(sourceLanguage) })));
  } };
  const originals = [{ text: ' English text ', source: 'en' }, { text: '中文', source: 'zh' }, { text: 'Déjà français', source: 'fr' }];
  const pending = api.translateBatch(originals, 'fr', native);
  assert.deepEqual(calls, [['en', 'fr'], ['zh', 'fr']]);
  releases.forEach(resolve => resolve());
  assert.deepEqual(Array.from(await pending), [' [en:English text] ', '[zh:中文]', 'Déjà français']);
  assert.deepEqual(destroyed.sort(), ['en', 'zh']);
  assert.equal(originals[0].text, ' English text ');
});

test('cancelled operation discards late result and destroys translator resources', async () => {
  const controller = new AbortController(); let release, destroyed = 0;
  const native = { create: async () => ({ translate: () => new Promise(resolve => { release = resolve; }), destroy: () => destroyed++ }) };
  const pending = api.translateBatch([{ text: 'Evidence', source: 'en' }], 'fr', native, { signal: controller.signal });
  while (!release) await new Promise(resolve => setImmediate(resolve));
  controller.abort(); release('late result');
  await assert.rejects(pending, { name: 'AbortError' }); assert.equal(destroyed, 1);
});

test('partial pair failure aborts pending work and cleans any late successful instance', async () => {
  let release, destroyed = 0, secondSignal;
  const native = { create({ sourceLanguage, signal }) {
    if (sourceLanguage === 'en') throw new Error('Unsupported pair');
    secondSignal = signal;
    return new Promise(resolve => { release = () => resolve({ destroy: () => destroyed++ }); });
  } };
  const pending = api.translateBatch([{ text: 'A', source: 'en' }, { text: '中文', source: 'zh' }], 'fr', native);
  await assert.rejects(pending, /Unsupported pair/); assert.equal(secondSignal.aborted, true);
  release(); await new Promise(resolve => setImmediate(resolve)); assert.equal(destroyed, 1);
});

test('translation UI is included in briefs and cloud fallback is opt-in for static public output', () => {
  const fixture = JSON.parse(fs.readFileSync(new URL('../examples/weekly.en.json', import.meta.url), 'utf8'));
  const local = renderHtml(fixture), published = renderHtml(fixture, { mode: 'static' });
  assert.match(local, /id="wb-translation"/); assert.match(local, /data-public-page="false"/);
  assert.match(published, /data-public-page="true"/);
  assert.match(renderTranslation('zh'), /恢复原文/);
  assert.match(renderTranslation('en'), /translate="no"/);
  assert.match(renderTranslation('en'), /#ask,\.quota,\[data-translation-skip\]/);
});
