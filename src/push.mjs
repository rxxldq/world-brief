import { assertBrief, isUrl } from './validate.mjs';
import { strings } from './i18n.mjs';

const LIMIT = 3900;
const clip = (text, n) => Array.from(String(text).replace(/\s+/g, ' ')).slice(0, n).join('');
// Offline conservative filter: never publish literal IPs or local/internal hostnames.
// DNS resolution and the sensitivity of arbitrary public URL paths cannot be checked here.
export function publicSource(value) {
  if (!isUrl(value)) return false;
  const u = new URL(value), host = u.hostname.toLowerCase().replace(/\.$/, '');
  return /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(host)
    && !/\.(?:localhost|local|internal|lan|home|test|invalid|example|onion)$/.test(host);
}
const clean = value => String(value).replace(/(?:https?|file):\/\/[^\s<>"']+/gi, url => publicSource(url) ? url : '');
const md = value => clean(value).replace(/[\[\]()]/g, c => ({ '[': '［', ']': '］', '(': '（', ')': '）' }[c])).replace(/[*_`<>\\]/g, '').replace(/[\r\n]+/g, ' ');
const urlForMd = value => value.replace(/[()[\]]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const firstSource = it => it.sources.find(s => publicSource(s.url) && s.url.length <= 2048)?.url;

export function buildPush(brief, locale = brief.locale || 'en', dir) {
  assertBrief(brief, { dir }); const t = strings(locale);
  const blocks = brief.sections.map(s => ({ heading: `**${md(clip(clean(s.title), 80))}**`, rows: s.items.flatMap(it => {
    const url = firstSource(it), title = md(clip(clean(it.headline), 100)).trim() || (url ? new URL(url).hostname : '');
    const row = `- ${brief.kind === 'daily' ? ({ high: '🟢', medium: '🟡', low: '🔴' }[it.confidence] || '⚪') + ' ' : ''}${url ? `[${title}](${urlForMd(url)})` : title}`;
    const voices = brief.kind === 'weekly' ? (it.voices || []).map(v => `  - ${t.camps[v.camp]}｜${md(clip(clean(v.name), 24))}${v.outlet ? `（${md(clip(clean(v.outlet), 26))}）` : ''}`) : [];
    return [row, ...voices];
  }) }));
  let message = `**${t.bluf}**\n`;
  const omitted = '\n' + t.pushMore;
  const footer = '\n' + (brief.kind === 'weekly' ? t.pushWeekly : t.pushDaily);
  let truncated = false;
  for (const point of brief.bluf) {
    const next = `- ${md(clip(clean(point), 180))}\n`;
    if (Buffer.byteLength(message + next + footer + omitted) > LIMIT) { truncated = true; break; }
    message += next;
  }
  sections: for (const block of blocks) {
    let prefix = '\n' + block.heading + '\n';
    for (const row of block.rows) {
      const next = prefix + row + '\n';
      if (Buffer.byteLength(message + next + footer + omitted) > LIMIT) { truncated = true; break sections; }
      message += next;
      prefix = '';
    }
  }
  message += footer;
  if (truncated) message += omitted;
  const actions = brief.sections.flatMap(s => s.items).filter(it => firstSource(it)).slice(0, 3).map(it => ({ action: 'view', label: clip(clean(it.headline), 24).trim() || new URL(firstSource(it)).hostname, url: firstSource(it) }));
  return { title: clip(clean(brief.title), 100), short: clip(clean(brief.bluf.join(' / ')), 160), message, actions };
}

export async function sendPush(cfg, payload) {
  if (!cfg.ntfy.enabled || !cfg.ntfy.topic) throw new Error('ntfy is disabled or has no topic');
  if (!isUrl(cfg.ntfy.server) || new URL(cfg.ntfy.server).protocol !== 'https:') throw new Error('ntfy requires HTTPS');
  const token = process.env[cfg.ntfy.tokenEnv];
  const response = await fetch(cfg.ntfy.server, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000), headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ topic: cfg.ntfy.topic, title: payload.title, message: payload.message, markdown: true, actions: payload.actions }) });
  if (!response.ok) throw new Error(`Notification failed (HTTP ${response.status})`);
  return { sent: true };
}
