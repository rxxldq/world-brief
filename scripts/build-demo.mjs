import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectRoot, readJson } from '../src/config.mjs';
import { renderHtml, renderArchive } from '../src/render.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STYLE = `:root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;padding:3rem 1.25rem;font:1rem/1.75 system-ui,sans-serif;background:light-dark(#f5f2ea,#101216);color:light-dark(#1a1c20,#e8e5de)}main{max-width:760px;margin:auto;border-top:4px double;padding-top:1rem}h1{font:700 2.4rem/1.2 Georgia,serif}h2{font-size:1.2rem;margin-top:2rem}a{color:light-dark(#1d55a6,#93b8ee);text-underline-offset:.2em}.notice{padding:1rem;border:1px solid;border-radius:6px}nav{display:flex;gap:1rem;flex-wrap:wrap}nav a{border:1px solid;padding:.65rem 1rem;border-radius:5px;text-decoration:none}footer{margin-top:3rem;font-size:.9rem}p,li{overflow-wrap:anywhere}pre{padding:1rem;border:1px solid;border-radius:4px;overflow:auto;font-size:.85rem}pre code{white-space:pre-wrap;overflow-wrap:anywhere}.introduction{white-space:pre-wrap}`;
const document = (title, lang, body) => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="World Brief usage guide and fictional reader examples"><title>${escape(title)}</title><style>${STYLE}</style></head><body><main>${body}<footer><a href="https://github.com/rxxldq/world-brief">Source code &amp; setup / 源码与使用说明</a> · MIT</footer></main></body></html>`;

function writePublicPages(root) {
  const intro = readJson(path.join(projectRoot, 'content', 'introduction.json'));
  const usage = readJson(path.join(projectRoot, 'content', 'usage.json'));
  for (const locale of ['en', 'zh']) {
    const u = usage[locale];
    const body = `<a href="index.html">${escape(u.back)}</a><h1>${escape(u.title)}</h1><p class="notice">${escape(u.notice)}</p>${u.sections.map(s => `<section><h2>${escape(s.title)}</h2><p>${escape(s.text)}</p>${s.commands ? `<pre><code>${escape(s.commands.join('\n'))}</code></pre>` : ''}</section>`).join('')}<p><a href="${locale}/index.html">${escape(u.reader)}</a></p>`;
    fs.writeFileSync(path.join(root, `usage.${locale}.html`), document(u.title, locale === 'zh' ? 'zh-CN' : 'en', body));
  }
  const introHtml = ['en', 'zh'].filter(locale => typeof intro[locale] === 'string' && intro[locale].trim()).map(locale => `<section class="introduction" lang="${locale === 'zh' ? 'zh-CN' : 'en'}">${escape(intro[locale])}</section>`).join('');
  const body = `<p>WORLD BRIEF</p><h1>World Brief</h1>${introHtml}<div class="notice"><strong>Fictional demonstration only.</strong> This preview contains invented news and viewpoints with placeholder source links. It is not current reporting. No AI service, personal account or live notification is connected.<p lang="zh-CN">所有示例新闻、人物与观点均为虚构，链接仅作格式占位；公开预览未接入模型、私人账号或实时通知。</p></div><h2>Read examples / 查看示例</h2><nav><a href="en/index.html">English examples</a><a href="zh/index.html" lang="zh-CN">中文示例</a></nav><h2>Usage / 使用说明</h2><nav><a href="usage.en.html">How to use World Brief</a><a href="usage.zh.html" lang="zh-CN">使用说明</a></nav>`;
  fs.writeFileSync(path.join(root, 'index.html'), document('World Brief · Preview / 预览', 'en', body));
}

// Public demo is built from the four explicitly synthetic fixtures only.
// Never consult user config, provider, personal output root, environment secrets or runtime briefs.
export function buildDemo(output = path.join(projectRoot, '.world-brief', 'site')) {
  const root = path.resolve(output);
  fs.mkdirSync(root, { recursive: true });
  for (const locale of ['en', 'zh']) {
    const archive = path.join(root, locale); fs.mkdirSync(archive, { recursive: true });
    for (const kind of ['daily', 'weekly']) {
      const brief = readJson(path.join(projectRoot, 'examples', `${kind}.${locale}.json`));
      const name = `${brief.date}-${kind}`, dir = path.join(archive, name); fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'brief.json'), JSON.stringify(brief, null, 2) + '\n');
      fs.writeFileSync(path.join(dir, 'index.html'), renderHtml(brief, { dir, locale, dirname: name, mode: 'static' }));
    }
    renderArchive(archive, locale);
  }
  writePublicPages(root);
  fs.writeFileSync(path.join(root, '.nojekyll'), '');
  return root;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) console.log('Built synthetic static preview: ' + buildDemo());
