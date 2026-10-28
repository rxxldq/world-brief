(() => {
  'use strict';
  const languages = [
    ['en', 'English'], ['ar', 'العربية · Arabic'], ['bg', 'Български · Bulgarian'], ['bn', 'বাংলা · Bengali'],
    ['cs', 'Čeština · Czech'], ['da', 'Dansk · Danish'], ['de', 'Deutsch · German'], ['el', 'Ελληνικά · Greek'],
    ['es', 'Español · Spanish'], ['fi', 'Suomi · Finnish'], ['fr', 'Français · French'], ['he', 'עברית · Hebrew'],
    ['hi', 'हिन्दी · Hindi'], ['hr', 'Hrvatski · Croatian'], ['hu', 'Magyar · Hungarian'], ['id', 'Bahasa Indonesia'],
    ['it', 'Italiano · Italian'], ['ja', '日本語 · Japanese'], ['kn', 'ಕನ್ನಡ · Kannada'], ['ko', '한국어 · Korean'],
    ['lt', 'Lietuvių · Lithuanian'], ['mr', 'मराठी · Marathi'], ['nl', 'Nederlands · Dutch'], ['no', 'Norsk · Norwegian'],
    ['pl', 'Polski · Polish'], ['pt', 'Português · Portuguese'], ['ro', 'Română · Romanian'], ['ru', 'Русский · Russian'],
    ['sk', 'Slovenčina · Slovak'], ['sl', 'Slovenščina · Slovenian'], ['sv', 'Svenska · Swedish'], ['ta', 'தமிழ் · Tamil'],
    ['te', 'తెలుగు · Telugu'], ['th', 'ไทย · Thai'], ['tr', 'Türkçe · Turkish'], ['uk', 'Українська · Ukrainian'],
    ['vi', 'Tiếng Việt · Vietnamese'], ['zh', '简体中文 · Chinese (Simplified)'], ['zh-Hant', '繁體中文 · Chinese (Traditional)']
  ];
  const codes = new Set(languages.map(([code]) => code));
  function normalizeLanguage(value) {
    const tag = String(value || '').replace(/_/g, '-').toLowerCase();
    if (/^zh(?:-|$)/.test(tag)) return /(?:hant|tw|hk|mo)(?:-|$)/.test(tag) ? 'zh-Hant' : 'zh';
    const base = tag.split('-')[0];
    return base === 'nb' || base === 'nn' ? 'no' : codes.has(base) ? base : null;
  }
  function publicTranslationUrl(value, target, publicPage = false) {
    if (!publicPage || !codes.has(target)) return null;
    try {
      const url = new URL(value), host = url.hostname.toLowerCase();
      // Reject every IP literal and local/internal suffix, including IPv6 and integer IPv4.
      if (url.protocol !== 'https:' || url.username || url.password || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(host) || /\.(?:localhost|local|internal|lan|home|test|invalid|example|onion)$/.test(host)) return null;
      url.search = ''; url.hash = '';
      const out = new URL('https://translate.google.com/translate');
      out.searchParams.set('sl', 'auto'); out.searchParams.set('tl', target === 'zh' ? 'zh-CN' : target === 'zh-Hant' ? 'zh-TW' : target);
      out.searchParams.set('u', url.href);
      return out.href;
    } catch { return null; }
  }
  function splitText(text, size = 2400) {
    const points = [...text], chunks = [];
    for (let i = 0; i < points.length;) {
      let end = Math.min(i + size, points.length);
      if (end < points.length) {
        const part = points.slice(i, end).join(''), boundary = Math.max(part.lastIndexOf('\n'), part.lastIndexOf(' '));
        if (boundary > part.length / 2) end = i + [...part.slice(0, boundary + 1)].length;
      }
      chunks.push(points.slice(i, end).join('')); i = end;
    }
    return chunks;
  }
  const aborted = () => new DOMException('Translation cancelled', 'AbortError');
  async function translateBatch(entries, target, api, { signal, onProgress = () => {}, onDownload = () => {} } = {}) {
    if (!codes.has(target)) throw new Error('Unsupported language');
    const controller = new AbortController(), instances = new Set(), pairs = new Map(); let closed = false;
    const stop = () => controller.abort();
    signal?.addEventListener('abort', stop, { once: true });
    if (signal?.aborted) controller.abort();
    const operationSignal = controller.signal;
    try {
      if (operationSignal.aborted) throw aborted();
      // Start every create in the original click activation, before awaiting any download.
      for (const source of new Set(entries.map(e => e.source).filter(s => s !== target))) {
        let pending;
        try {
          pending = api.create({ sourceLanguage: source, targetLanguage: target, signal: operationSignal,
            monitor(monitor) { monitor.addEventListener('downloadprogress', event => onDownload(event.loaded)); }
          });
        } catch (error) { pending = Promise.reject(error); }
        pairs.set(source, Promise.resolve(pending).then(instance => {
          if (closed || operationSignal.aborted) { instance.destroy(); throw aborted(); }
          instances.add(instance); return instance;
        }));
      }
      const resolved = new Map(await Promise.all([...pairs].map(async ([source, pending]) => [source, await pending])));
      const results = []; let complete = 0;
      for (const entry of entries) {
        if (operationSignal.aborted) throw aborted();
        if (entry.source === target) results.push(entry.text);
        else {
          const translator = resolved.get(entry.source), pieces = [];
          for (const chunk of splitText(entry.text)) {
            if (operationSignal.aborted) throw aborted();
            const [, before, content, after] = /^(\s*)(.*?)(\s*)$/s.exec(chunk);
            pieces.push(content ? before + String(await translator.translate(content, { signal: operationSignal })).trim() + after : chunk);
          }
          results.push(pieces.join(''));
        }
        onProgress(++complete, entries.length);
      }
      if (operationSignal.aborted) throw aborted();
      return results;
    } finally {
      closed = true;
      controller.abort(); signal?.removeEventListener('abort', stop);
      for (const instance of instances) { try { instance.destroy(); } catch { /* already destroyed */ } }
    }
  }
  // Small, dependency-free interface also permits deterministic native API tests.
  globalThis.WorldBriefTranslation = Object.freeze({ languages, normalizeLanguage, publicTranslationUrl, splitText, translateBatch });
  if (typeof document === 'undefined') return;
  const panel = document.getElementById('wb-translation'); if (!panel) return;
  const zh = panel.lang.startsWith('zh'), $ = id => document.getElementById(id);
  const select = $('wb-tr-language'), start = $('wb-tr-start'), english = $('wb-tr-english'), restoreButton = $('wb-tr-restore'), status = $('wb-tr-status');
  const native = typeof globalThis.Translator?.create === 'function';
  const browserLanguage = (navigator.languages || [navigator.language]).map(normalizeLanguage).find(Boolean) || 'en';
  const auto = document.createElement('option'); auto.value = 'auto'; auto.textContent = (zh ? '浏览器语言' : 'Browser language') + ` (${languages.find(([code]) => code === browserLanguage)[1]})`; select.appendChild(auto);
  for (const [code, label] of languages) { const option = document.createElement('option'); option.value = code; option.textContent = label; select.appendChild(option); }
  const targetLanguage = () => select.value === 'auto' ? browserLanguage : select.value;
  const skip = '#wb-translation,#ask,.quota,[data-translation-skip],[translate="no"],script,style,noscript,template,input,textarea,select,option,button,pre,code,kbd,samp,.credit,.src a,.vsrc a,.vh b,.vh .role';
  let entries = null, attributes = null, active = null, sequence = 0, translated = false;
  function updateFallback() {
    const url = publicTranslationUrl(location.href, targetLanguage(), panel.dataset.publicPage === 'true');
    $('wb-tr-fallback').hidden = !url;
    if (url) $('wb-tr-google').href = url; else $('wb-tr-google').removeAttribute('href');
  }
  function idleMessage() {
    status.textContent = native
      ? (zh ? '就绪：点击后在本机翻译。不同浏览器和语言组合的支持情况可能不同。' : 'Ready: click to translate on this device. Support depends on your browser and language pair.')
      : (zh ? '此浏览器不支持本机翻译。可使用下方公开网页翻译入口（若有），或在支持 Translator API 的桌面浏览器中打开。本机内容不会上传。' : 'This browser has no on-device translator. Use the public website option below if shown, or a desktop browser supporting the Translator API. Local content is not uploaded.');
  }
  function snapshot() {
    if (entries) return;
    entries = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement, text = node.nodeValue;
      if (!parent || parent.closest(skip) || !/\p{L}/u.test(text) || /^\s*https?:\/\//i.test(text)) continue;
      const source = normalizeLanguage(parent.closest('[lang]')?.getAttribute('lang')) || normalizeLanguage(document.documentElement.lang) || 'en';
      entries.push({ node, text, source });
    }
    attributes = [document.documentElement, ...document.body.querySelectorAll('[lang],[dir]')]
      .filter(element => !element.closest(skip))
      .map(element => ({ element, lang: element.getAttribute('lang'), dir: element.getAttribute('dir') }));
  }
  function restoreText() {
    for (const entry of entries || []) if (entry.node.isConnected) entry.node.nodeValue = entry.text;
    for (const { element, lang, dir } of attributes || []) {
      if (lang === null) element.removeAttribute('lang'); else element.setAttribute('lang', lang);
      if (dir === null) element.removeAttribute('dir'); else element.setAttribute('dir', dir);
    }
    translated = false;
  }
  function cancel() { sequence++; active?.abort(); active = null; restoreText(); start.disabled = !native; restoreButton.disabled = true; }
  async function translate() {
    if (!native) { idleMessage(); return; }
    cancel(); snapshot(); const run = ++sequence, controller = new AbortController(); active = controller;
    const target = targetLanguage(); start.disabled = true; restoreButton.disabled = false;
    status.textContent = zh ? '正在准备本机翻译模型……' : 'Preparing on-device translation…';
    try {
      const results = await translateBatch(entries, target, globalThis.Translator, { signal: controller.signal,
        onDownload: loaded => { if (run === sequence && active === controller && !controller.signal.aborted) status.textContent = (zh ? '正在下载本机语言模型：' : 'Downloading language model: ') + Math.round(Math.min(1, loaded) * 100) + '%'; },
        onProgress: (done, total) => { if (run === sequence && active === controller && !controller.signal.aborted) status.textContent = (zh ? '正在翻译：' : 'Translating: ') + done + '/' + total; }
      });
      if (run !== sequence || controller.signal.aborted) return;
      entries.forEach((entry, index) => { if (entry.node.isConnected) entry.node.nodeValue = results[index]; });
      for (const { element } of attributes) { element.lang = target; element.dir = ['ar', 'he'].includes(target) ? 'rtl' : 'ltr'; }
      translated = true;
      status.textContent = (zh ? '机器翻译完成：' : 'Machine translation complete: ') + languages.find(([code]) => code === target)[1] + (zh ? '。请对照原文核实。' : '. Check against the original.');
    } catch (error) {
      if (run !== sequence) return;
      restoreText(); restoreButton.disabled = true;
      status.textContent = error.name === 'AbortError' ? (zh ? '已取消，保留原文。' : 'Cancelled; original restored.') : (zh ? '本机翻译未完成，已保留原文。请检查模型下载、网络和语言组合支持；公开页面也可使用下方 Google 入口。' : 'On-device translation did not finish; original retained. Check model download, connection and language-pair support. Public pages can also use the Google option below.');
    } finally {
      if (run === sequence) { active = null; start.disabled = false; restoreButton.disabled = !translated; }
    }
  }
  start.disabled = !native; start.addEventListener('click', translate);
  english.addEventListener('click', () => { select.value = 'en'; updateFallback(); translate(); });
  restoreButton.addEventListener('click', () => { cancel(); status.textContent = zh ? '已恢复原文。' : 'Original restored.'; });
  select.addEventListener('change', () => { cancel(); updateFallback(); idleMessage(); });
  window.addEventListener('pagehide', cancel, { once: true });
  updateFallback(); idleMessage();
})();
