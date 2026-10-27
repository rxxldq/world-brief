import fs from 'node:fs';
import path from 'node:path';

export const CAMPS = ['left', 'center-left', 'center', 'center-right', 'right', 'state-media', 'other'];
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = x => typeof x === 'string' && x.trim().length > 0;
export function isUrl(value) {
  if (typeof value !== 'string' || /[\s\\\u0000-\u001f]/.test(value)) return false;
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && !!u.hostname && !u.username && !u.password; }
  catch { return false; }
}
export function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

// Only passive raster images are public. SVG/HTML can contain executable content.
export function localImage(root, file) {
  if (typeof file !== 'string' || !/^img\/[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(png|jpe?g|gif|webp)$/i.test(file)) return false;
  try {
    const base = fs.realpathSync(root), full = fs.realpathSync(path.join(root, file));
    if (!full.startsWith(base + path.sep) || !fs.statSync(full).isFile()) return false;
    const stat = fs.statSync(full); if (stat.size < 12 || stat.size > 8 * 1024 * 1024) return false;
    const fd = fs.openSync(full, 'r'); const h = Buffer.alloc(12);
    try { fs.readSync(fd, h, 0, 12, 0); } finally { fs.closeSync(fd); }
    const ext = path.extname(file).toLowerCase();
    if (ext === '.png') return h.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    if (['.jpg', '.jpeg'].includes(ext)) return h[0] === 255 && h[1] === 216 && h[2] === 255;
    if (ext === '.gif') return ['GIF87a', 'GIF89a'].includes(h.toString('ascii', 0, 6));
    return h.toString('ascii', 0, 4) === 'RIFF' && h.toString('ascii', 8, 12) === 'WEBP';
  } catch { return false; }
}

export function validateBrief(b, { dir } = {}) {
  const errors = [];
  if (!object(b)) return ['brief must be an object'];
  if (!['daily', 'weekly'].includes(b.kind)) errors.push('kind must be daily|weekly');
  if (!isDate(b.date)) errors.push('date must be a real YYYY-MM-DD date');
  if (!text(b.title)) errors.push('title is required');
  if (b.locale !== undefined && !['en', 'zh'].includes(b.locale)) errors.push('locale must be en|zh');
  if (!Array.isArray(b.bluf) || !b.bluf.length || b.bluf.some(v => !text(v))) errors.push('bluf must contain non-empty strings');
  const optionalText = (o, fields, at) => fields.forEach(k => { if (o[k] !== undefined && typeof o[k] !== 'string') errors.push(`${at}.${k} must be a string`); });
  const array = (o, key, at, required = false) => {
    if (o[key] === undefined && !required) return [];
    if (!Array.isArray(o[key]) || (required && !o[key].length)) { errors.push(`${at}.${key} must be ${required ? 'a non-empty' : 'an'} array`); return []; }
    return o[key];
  };
  optionalText(b, ['window', 'method_note'], 'brief');
  for (const [si, s] of array(b, 'sections', 'brief', true).entries()) {
    const sat = `sections[${si}]`;
    if (!object(s)) { errors.push(`${sat} must be an object`); continue; }
    if (!text(s.title)) errors.push(`${sat}.title is required`);
    optionalText(s, ['id', 'intro'], sat);
    for (const [ii, it] of array(s, 'items', sat, true).entries()) {
      const at = `${sat}.items[${ii}]`;
      if (!object(it)) { errors.push(`${at} must be an object`); continue; }
      if (!text(it.headline)) errors.push(`${at}.headline is required`);
      optionalText(it, ['summary', 'why_it_matters', 'unverified', 'synthesis'], at);
      if (it.confidence !== undefined && !['high', 'medium', 'low'].includes(it.confidence)) errors.push(`${at}.confidence invalid`);
      for (const src of array(it, 'sources', at, true)) {
        if (!object(src) || !isUrl(src.url)) errors.push(`${at}.sources must contain HTTP(S) URLs without credentials`);
        if (object(src)) optionalText(src, ['title', 'publisher', 'published'], `${at}.sources`);
      }
      for (const im of array(it, 'images', at)) {
        if (!object(im)) { errors.push(`${at}.images must contain objects`); continue; }
        if (!isUrl(im.source_url) || !text(im.credit)) errors.push(`${at}.images require source_url and credit`);
        optionalText(im, ['caption'], `${at}.images`);
        if (im.remote_url !== undefined && !isUrl(im.remote_url)) errors.push(`${at}.images.remote_url invalid`);
        if (!im.file && !im.remote_url) errors.push(`${at}.images need file or remote_url`);
        if (im.file && (!dir || !localImage(dir, im.file))) errors.push(`${at}.images.file must be a usable local raster image in img/`);
      }
      for (const e of array(it, 'embeds', at)) {
        if (!object(e) || !isUrl(e.url)) errors.push(`${at}.embeds require HTTP(S) url`);
        if (object(e)) optionalText(e, ['note', 'type'], `${at}.embeds`);
      }
      for (const v of array(it, 'voices', at)) {
        if (!object(v)) { errors.push(`${at}.voices must contain objects`); continue; }
        if (!text(v.name) || !CAMPS.includes(v.camp) || !isUrl(v.url) || (!text(v.quote) && !text(v.paraphrase))) errors.push(`${at}.voices require name, camp, source URL and quote or paraphrase`);
        optionalText(v, ['role', 'outlet', 'bio', 'quote', 'paraphrase', 'date', 'position', 'evidence', 'reasoning', 'counterpoint'], `${at}.voices`);
        if (v.funding !== undefined) {
          const f = v.funding, fat = `${at}.voices.funding`;
          if (!object(f)) { errors.push(`${fat} must be an object`); continue; }
          if (!['documented', 'not_found', 'not_checked'].includes(f.status)) errors.push(`${fat}.status invalid`);
          if (!['person', 'organization'].includes(f.scope)) errors.push(`${fat}.scope must be person|organization`);
          if (typeof f.summary !== 'string') errors.push(`${fat}.summary must be a string`);
          if (!isDate(f.checked_at)) errors.push(`${fat}.checked_at must be a real YYYY-MM-DD date`);
          optionalText(f, ['limitations'], fat);
          if (!Array.isArray(f.sources)) errors.push(`${fat}.sources must be an array`);
          const sources = array(f, 'sources', fat);
          if (f.status === 'documented' && (!text(f.summary) || !sources.length)) errors.push(`${fat} documented funding requires a non-empty summary and at least one citation`);
          for (const src of sources) {
            if (!object(src) || !isUrl(src.url)) errors.push(`${fat}.sources must contain HTTP(S) URLs without credentials`);
            if (object(src)) optionalText(src, ['title', 'publisher'], `${fat}.sources`);
          }
        }
      }
    }
  }
  for (const w of array(b, 'watchlist', 'brief')) {
    if (!object(w) || !text(w.item)) errors.push('watchlist entries require item');
    if (object(w)) optionalText(w, ['date'], 'watchlist');
  }
  return errors;
}
export function assertBrief(brief, options) {
  const errors = validateBrief(brief, options);
  if (errors.length) throw new Error('Invalid brief:\n- ' + errors.join('\n- '));
  return brief;
}
