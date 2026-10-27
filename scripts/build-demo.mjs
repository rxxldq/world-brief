import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectRoot, readJson } from '../src/config.mjs';
import { renderHtml, renderArchive } from '../src/render.mjs';

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
  fs.writeFileSync(path.join(root, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="World Brief: a local-first bilingual news reader. Fictional demonstration only."><title>World Brief · Preview / 预览</title><style>:root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;padding:3rem 1.25rem;font:1rem/1.75 system-ui,sans-serif;background:light-dark(#f5f2ea,#101216);color:light-dark(#1a1c20,#e8e5de)}main{max-width:720px;margin:auto;border-top:4px double;padding-top:1rem}h1{font:700 2.7rem/1.2 Georgia,serif}h2{font-size:1.2rem}a{color:light-dark(#1d55a6,#93b8ee);text-underline-offset:.2em}.notice{padding:1rem;border:1px solid;border-radius:6px}nav{display:flex;gap:1rem;flex-wrap:wrap}nav a{border:1px solid;padding:.65rem 1rem;border-radius:5px;text-decoration:none}footer{margin-top:3rem;font-size:.9rem}p,li{overflow-wrap:anywhere}</style></head><body><main><p>WORLD BRIEF</p><h1>A clearer view of the news.</h1><p>A local-first reader for daily briefs and weekly perspectives, with source attribution and an English or Chinese interface.</p><div class="notice"><strong>Fictional demonstration only.</strong> This preview contains invented news and viewpoints with placeholder source links. It is not current reporting. No AI service, personal account or live notification is connected.</div><h2>Explore the reader</h2><nav><a href="en/index.html">English examples</a><a href="zh/index.html" lang="zh-CN">中文示例</a></nav><section lang="zh-CN"><h2>世界简报 · 公开预览</h2><p>本地优先的日报与多视角周评阅读器，支持来源标注、中英文界面、目录、搜索与复制提示词。</p><p><strong>本页所有新闻、人物与观点均为虚构，链接仅作格式占位。</strong> 公开预览未接入模型、私人账号或实时通知。真实简报生成和问答需在自己的电脑上配置。</p></section><footer><a href="https://github.com/rxxldq/world-brief">Source code &amp; setup / 源码与使用说明</a> · MIT</footer></main></body></html>`);
  fs.writeFileSync(path.join(root, '.nojekyll'), '');
  return root;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) console.log('Built synthetic static preview: ' + buildDemo());
