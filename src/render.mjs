import fs from 'node:fs';
import path from 'node:path';
import { readJson, projectRoot } from './config.mjs';
import { assertBrief, localImage } from './validate.mjs';
import { strings } from './i18n.mjs';
import { renderTranslation } from './translation.mjs';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = x => JSON.stringify(x).replace(/</g, '\\u003c');
const asset = name => fs.readFileSync(path.join(projectRoot, 'assets', name), 'utf8');
const baseCss = `*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg)}main{padding:24px 18px 80px;margin:auto}header{border-bottom:2px solid var(--acc);margin-bottom:20px}h1{font-size:1.8rem;margin:4px 0}.meta,.src,figcaption{color:var(--mut);font-size:.85rem}.cls{color:var(--acc);font-size:.8rem}.bluf{background:var(--card);border-left:4px solid var(--acc);padding:12px 18px;margin:18px 0}h2{font-size:1.3rem;margin-top:32px}.item{background:var(--card);border:1px solid var(--line);border-radius:6px;margin:14px 0}figure{margin:12px 0}img{max-width:100%;height:auto}.credit{display:block}.src a{margin-inline-end:10px}.why{border-top:1px dashed var(--line);padding-top:8px}.warn{color:var(--mid)}.voices{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:10px}.voice{border:1px solid var(--line);padding:10px}.camp,.role,.bio,.vsrc{color:var(--mut);font-size:.85rem}.acts{flex-wrap:wrap}main,summary,.voice{overflow-wrap:anywhere}section[hidden],details[hidden]{display:none!important}`;
const css = () => baseCss + asset('brief-ui.css') + asset('brief-theme.css');
const link = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;

export function renderHtml(brief, { dir, locale = brief.locale || 'en', dirname = path.basename(dir || ''), mode = 'local' } = {}) {
  assertBrief(brief, { dir });
  const t = strings(locale); let idx = 0;
  const flat = brief.sections.flatMap(s => s.items);
  const fundingHtml = f => !f ? '' : `<aside class="funding"><h4>${t.funding}</h4><p class="funding-status">${t.fundingStatuses[f.status]}</p><p class="meta">${t.fundingScope}: ${f.scope === 'person' ? t.fundingPerson : t.fundingOrganization} · ${t.fundingChecked}: ${esc(f.checked_at)}</p>${f.summary ? `<p>${esc(f.summary)}</p>` : ''}${f.sources.length ? `<p class="vsrc">${f.sources.map(s => link(s.url, s.title || s.publisher || new URL(s.url).hostname)).join(' ')}</p>` : ''}${f.limitations ? `<p><b>${t.fundingLimitations}:</b> ${esc(f.limitations)}</p>` : ''}<p class="bio">${t.fundingCaution}</p></aside>`;
  const voiceHtml = v => `<div class="voice camp-${v.camp}"><div class="vh"><span class="camp">${t.camps[v.camp]}</span> <b>${esc(v.name)}</b> <span class="role">${esc([v.role, v.outlet].filter(Boolean).join(' · '))}</span></div>${v.bio ? `<p class="bio">${esc(v.bio)}</p>` : ''}<p class="take">${v.quote ? `“${esc(v.quote)}”` : ''} ${esc(v.paraphrase)}</p>${['position', 'evidence', 'reasoning', 'counterpoint'].filter(k => v[k]).map(k => `<p class="voice-${k}"><b>${t[k]}:</b> ${esc(v[k])}</p>`).join('')}<p class="vsrc">${link(v.url, t.original)} ${esc(v.date)}</p>${fundingHtml(v.funding)}</div>`;
  // The existing copy-prompt UI reads summary context; include the full attributed discussion.
  const voiceContext = v => {
    const f = v.funding;
    return [v.name, [v.role, v.outlet].filter(Boolean).join(' · '), v.bio, v.quote, v.paraphrase,
      ...['position', 'evidence', 'reasoning', 'counterpoint'].filter(k => v[k]).map(k => `${t[k]}: ${v[k]}`),
      `${t.original}: ${v.url} ${v.date || ''}`,
      ...(f ? [`${t.funding}: ${t.fundingStatuses[f.status]}`, `${t.fundingScope}: ${f.scope === 'person' ? t.fundingPerson : t.fundingOrganization}`, f.summary,
        `${t.fundingChecked}: ${f.checked_at}`, ...f.sources.map(s => `${s.title || s.publisher || ''} ${s.url}`), f.limitations, t.fundingCaution] : [])].filter(Boolean).join('\n');
  };
  const itemHtml = it => {
    const n = idx++;
    const images = (it.images || []).map(im => {
      const local = im.file && localImage(dir, im.file);
      const src = local ? im.file : im.remote_url;
      return `<figure><a href="${esc(im.source_url)}" target="_blank" rel="noopener noreferrer"><img loading="lazy" referrerpolicy="no-referrer" src="${esc(src)}" alt="${esc(im.caption || '')}"></a><figcaption>${esc(im.caption)} <span class="credit">${t.imageSource}: ${link(im.source_url, im.credit)}${local ? '' : ` (${t.external})`}</span></figcaption></figure>`;
    }).join('');
    const voices = (it.voices || []).map(voiceHtml).join('');
    return `<details class="item" id="i-${n}" data-idx="${n}" data-conf="${esc(it.confidence)}"><summary><span class="dot c-${it.confidence || 'none'}" title="${it.confidence ? `${t.confidence}: ${t[it.confidence]}` : ''}"></span><span class="hlw"><span class="hl">${esc(it.headline)}</span>${it.summary ? `<span class="pv">${esc(it.summary)}</span>` : ''}</span></summary><div class="body">${it.summary ? `<p>${esc(it.summary)}</p>` : ''}${it.why_it_matters ? `<p class="why"><b>${t.why}:</b> ${esc(it.why_it_matters)}</p>` : ''}${it.unverified ? `<p class="warn">⚠ ${esc(it.unverified)}</p>` : ''}${images}${(it.embeds || []).map(e => `<p>▶ ${link(e.url, e.note || e.url)}</p>`).join('')}${voices ? `<div class="voices">${voices}</div>` : ''}${it.synthesis ? `<p class="why"><b>${t.synthesis}:</b> ${esc(it.synthesis)}</p>` : ''}<p class="src">${it.confidence ? `${t.confidence}: ${t[it.confidence]} · ` : ''}${it.sources.map(s => `${link(s.url, s.publisher || s.title || new URL(s.url).hostname)} <small>${esc(s.published)}</small>`).join(' ')}</p><div class="acts"><button type="button" class="ask-btn" data-idx="${n}">${t.ask}</button><button type="button" class="copy-btn" data-idx="${n}">${t.copy}</button></div></div></details>`;
  };
  const sections = brief.sections.map((s, si) => `<section id="s-${si}" data-sec="${si}"><h2><span class="sn">${String(si + 1).padStart(2, '0')}</span>${esc(s.title)}</h2>${s.intro ? `<p>${esc(s.intro)}</p>` : ''}${s.items.map(itemHtml).join('')}</section>`).join('');
  let k = 0;
  const toc = brief.sections.map(s => `<h4>${esc(s.title)}</h4>${s.items.map(it => `<a href="#i-${k}" data-go="${k++}">${esc(it.headline)}</a>`).join('')}`).join('');
  const chips = brief.sections.map((s, si) => `<a href="#s-${si}" data-sec="${si}">${esc(s.title)}</a>`).join('');
  const watch = brief.watchlist?.length ? `<section id="s-watch" data-sec="watch"><h2>${t.watch}</h2><ul>${brief.watchlist.map(w => `<li><b>${esc(w.date)}</b> ${esc(w.item)}</li>`).join('')}</ul></section>` : '';
  const imageCount = flat.reduce((n, it) => n + (it.images?.length || 0), 0);
  const sourceCount = new Set(flat.flatMap(it => it.sources.map(s => new URL(s.url).hostname))).size;
  const data = { title: brief.title, date: brief.date, locale, mode, t, items: flat.map(it => ({ h: it.headline, s: [it.summary, ...(it.voices || []).map(voiceContext), it.synthesis].filter(Boolean).join('\n\n'), w: it.why_it_matters || '', u: it.unverified || '', src: it.sources.map(s => ({ t: s.publisher || s.title || '', url: s.url })) })) };
  return `<!doctype html><html lang="${t.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="wb-dir" content="${esc(dirname)}"><title>${esc(brief.title)}</title><style>${css()}</style></head><body><div class="bar"><button type="button" class="tocbtn" id="b-toc">☰ ${t.contents}</button><input id="q" type="search" aria-label="${t.search}" placeholder="${t.search}"><button type="button" id="b-all">${t.expand}</button><button type="button" id="b-fm" title="${t.smaller}">A−</button><button type="button" id="b-fp" title="${t.larger}">A+</button><nav class="chips">${chips}</nav></div>${renderTranslation(locale, { publicPage: mode === 'static' })}<div class="layout"><nav id="toc" aria-label="${t.contents}"><h4>${t.contents}</h4>${toc}</nav><main><header><div class="cls">${t[brief.kind]} · ${t.reference}</div><h1>${esc(brief.title)}</h1><div class="meta">${esc(brief.date)} · ${t.window}: ${esc(brief.window)} · <a href="../index.html">${t.archive}</a></div><div class="stats"><span><b>${flat.length}</b> ${t.stories}</span><span><b>${brief.sections.length}</b> ${t.sections}</span><span><b>${imageCount}</b> ${t.images}</span><span><b>${sourceCount}</b> ${t.sources}</span></div><div class="legend">${t.confidence}: ${['high', 'medium', 'low'].map(c => `<span><i class="dot c-${c}"></i>${t[c]}</span>`).join('')}</div></header><div class="bluf"><b>${t.bluf}</b><ul>${brief.bluf.map(b => `<li>${esc(b)}</li>`).join('')}</ul></div>${sections}${watch}${brief.method_note ? `<p class="src">${t.method}: ${esc(brief.method_note)}</p>` : ''}</main></div><div id="ask" role="dialog" aria-label="${t.ask}" hidden><div class="ask-h"><b id="ask-t"></b><button type="button" id="ask-x" title="${t.close}">×</button></div><div id="ask-chips"></div><div id="ask-log" aria-live="polite"></div><form id="ask-f"><textarea id="ask-q" rows="2" maxlength="600" aria-label="${t.question}" placeholder="${t.question}"></textarea><button type="submit">${t.send}</button></form><div id="ask-s"></div></div><script type="application/json" id="wb-data">${json(data)}</script><script>${asset('brief-ui.js')}</script></body></html>`;
}

export function renderArchive(root, locale = 'en', { publicPage = false } = {}) {
  const t = strings(locale);
  const entries = fs.readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory() && /^\d{4}-\d{2}-\d{2}-(daily|weekly)$/.test(d.name)).flatMap(d => {
    try {
      if (!fs.statSync(path.join(root, d.name, 'index.html')).isFile()) return [];
      const b = assertBrief(readJson(path.join(root, d.name, 'brief.json')), { dir: path.join(root, d.name) });
      return [{ dir: d.name, title: b.title, kind: b.kind, bluf: b.bluf[0] }];
    } catch { return []; }
  }).sort((a, b) => b.dir.localeCompare(a.dir));
  const html = `<!doctype html><html lang="${t.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t.archive}</title><style>${css()}</style></head><body>${renderTranslation(locale, { publicPage })}<main><header><div class="cls" translate="no">WORLD BRIEF</div><h1>${t.archive}</h1></header>${entries.map(e => `<article class="item" style="padding:16px"><h2><a href="${e.dir}/index.html">${esc(e.title)}</a></h2><p class="meta">${t[e.kind]}</p><p>${esc(e.bluf)}</p></article>`).join('')}</main></body></html>`;
  fs.writeFileSync(path.join(root, 'index.html'), html);
  fs.writeFileSync(path.join(root, 'latest.json'), JSON.stringify(entries, null, 2) + '\n');
  return entries;
}

export function renderDirectory(dir, locale) {
  const brief = readJson(path.join(dir, 'brief.json'));
  const html = renderHtml(brief, { dir, locale });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  renderArchive(path.dirname(dir), locale || brief.locale || 'en');
  return brief;
}
