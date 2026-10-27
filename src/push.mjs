import { assertBrief, isUrl } from './validate.mjs';
import { strings } from './i18n.mjs';

const LIMIT = 4096;
const clip = (text, n) => Array.from(String(text).replace(/\s+/g, ' ')).slice(0, n).join('');
const md = value => String(value).replace(/[\[\]()*_`<>\\]/g, '').replace(/[\r\n]+/g, ' ');
const urlForMd = value => value.replace(/[()]/g, c => c === '(' ? '%28' : '%29');

export function buildPush(brief, locale = brief.locale || 'en', dir) {
  assertBrief(brief, { dir }); const t = strings(locale);
  const blocks = brief.sections.map(s => `**${md(clip(s.title, 80))}**\n` + s.items.map(it => {
    const url = it.sources[0].url;
    return `- [${md(clip(it.headline, 100))}](${urlForMd(url)})`;
  }).join('\n'));
  let message = `**${t.bluf}**\n`;
  const omitted = locale === 'zh' ? '\n…其余内容见本机简报。' : '\n…More in the local brief.';
  for (const point of brief.bluf) {
    const next = `- ${md(clip(point, 180))}\n`;
    if (Buffer.byteLength(message + next + omitted) > LIMIT) break;
    message += next;
  }
  let used = 0;
  for (const block of blocks) {
    if (Buffer.byteLength(message + '\n' + block + omitted) > LIMIT) break;
    message += '\n' + block + '\n'; used++;
  }
  if (used < blocks.length) message += omitted;
  const actions = brief.sections.flatMap(s => s.items).slice(0, 3).map(it => ({ action: 'view', label: clip(it.headline, 24), url: it.sources[0].url }));
  return { title: clip(brief.title, 100), short: clip(brief.bluf.join(' / '), 160), message, actions };
}

export async function sendPush(cfg, payload) {
  if (!cfg.ntfy.enabled || !cfg.ntfy.topic) throw new Error('ntfy is disabled or has no topic');
  if (!isUrl(cfg.ntfy.server) || new URL(cfg.ntfy.server).protocol !== 'https:') throw new Error('ntfy requires HTTPS');
  const token = process.env[cfg.ntfy.tokenEnv];
  const response = await fetch(cfg.ntfy.server, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000), headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ topic: cfg.ntfy.topic, title: payload.title, message: payload.message, markdown: true, actions: payload.actions }) });
  if (!response.ok) throw new Error(`Notification failed (HTTP ${response.status})`);
  return { sent: true };
}
