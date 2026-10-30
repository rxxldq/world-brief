import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export function readJson(file) {
  const bytes = fs.readFileSync(file);
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error('JSON input must be valid UTF-8'); }
  return JSON.parse(text.replace(/^\uFEFF/, ''));
}
// Keep defaults in the example config, including the one-day daily cadence.
export const defaults = () => readJson(path.join(projectRoot, 'config.example.json'));

export function loadConfig(file = 'config.json') {
  const configPath = path.resolve(file);
  const raw = readJson(configPath);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!object(raw)) throw new Error('config must be an object');
  for (const key of ['provider', 'ask', 'ntfy', 'schedule']) {
    if (raw[key] !== undefined && !object(raw[key])) throw new Error(`${key} must be an object`);
  }
  const base = defaults();
  const cfg = { ...base, ...raw };
  for (const key of ['provider', 'ask', 'ntfy', 'schedule']) cfg[key] = { ...base[key], ...raw[key] };
  if (!['en', 'zh'].includes(cfg.locale)) throw new Error('locale must be en or zh');
  try {
    if (typeof cfg.timezone !== 'string' || !cfg.timezone.trim()) throw new Error();
    new Intl.DateTimeFormat('en', { timeZone: cfg.timezone });
  }
  catch { throw new Error('timezone must be an IANA timezone'); }
  if (typeof cfg.outRoot !== 'string' || !cfg.outRoot.trim()) throw new Error('outRoot is required');
  if (!Array.isArray(cfg.topics) || !cfg.topics.length || cfg.topics.some(t => typeof t !== 'string' || !t.trim())) throw new Error('topics must be non-empty strings');
  if (!['disabled', 'command'].includes(cfg.provider.type)) throw new Error('provider.type must be disabled or command');
  if (typeof cfg.provider.executable !== 'string' || !Array.isArray(cfg.provider.args) || cfg.provider.args.some(a => typeof a !== 'string')) throw new Error('provider requires executable and string args');
  if (cfg.provider.type === 'command' && !cfg.provider.executable.trim()) throw new Error('provider.executable is required');
  for (const [name, n, lo, hi] of [
    ['provider.timeoutMs', cfg.provider.timeoutMs, 100, 900000],
    ['ask.port', cfg.ask.port, 0, 65535], ['ask.maxPerDay', cfg.ask.maxPerDay, 1, 10000],
    ['schedule.dailyEveryDays', cfg.schedule.dailyEveryDays, 1, 365]
  ]) if (!Number.isInteger(n) || n < lo || n > hi) throw new Error(`${name} is out of range`);
  for (const key of ['dailyAt', 'weeklyAt']) if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(cfg.schedule[key])) throw new Error(`schedule.${key} must be HH:MM`);
  if (typeof cfg.ask.enabled !== 'boolean' || typeof cfg.ntfy.enabled !== 'boolean') throw new Error('enabled flags must be boolean');
  if (typeof cfg.ntfy.tokenEnv !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(cfg.ntfy.tokenEnv)) throw new Error('ntfy.tokenEnv must name an environment variable');
  if (typeof cfg.ntfy.topic !== 'string' || (cfg.ntfy.topic && !/^[A-Za-z0-9_-]{1,128}$/.test(cfg.ntfy.topic))) throw new Error('ntfy.topic is invalid');
  try {
    if (typeof cfg.ntfy.server !== 'string') throw new Error();
    const server = new URL(cfg.ntfy.server);
    if (server.protocol !== 'https:' || server.username || server.password || server.search || server.hash) throw new Error();
  } catch { throw new Error('ntfy.server must be HTTPS without credentials, query or fragment'); }
  if (cfg.ntfy.enabled && !cfg.ntfy.topic) throw new Error('enabled ntfy requires a topic');
  return { ...cfg, configPath, outRoot: path.resolve(path.dirname(configPath), cfg.outRoot) };
}

export function dateInZone(timezone, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function initConfig(file, locale = 'en') {
  if (!['en', 'zh'].includes(locale)) throw new Error('locale must be en or zh');
  const cfg = defaults(); cfg.locale = locale;
  if (locale === 'zh') cfg.topics = ['世界局势与冲突', '外交', 'AI', '市场'];
  fs.writeFileSync(path.resolve(file), JSON.stringify(cfg, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
