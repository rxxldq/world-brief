import fs from 'node:fs';
import path from 'node:path';
import { projectRoot } from './config.mjs';

const xml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const ps = s => "'" + s.replace(/'/g, "''") + "'";
const sh = s => "'" + s.replace(/'/g, "'\\''") + "'";
const clock = s => s.split(':').map(Number);

export function schedulerFiles(cfg, platform, { node = process.execPath, cli = path.join(projectRoot, 'bin', 'world-brief.mjs') } = {}) {
  if (!['windows', 'linux', 'macos'].includes(platform)) throw new Error('platform must be windows|linux|macos');
  if ([node, cli, cfg.configPath].some(p => /[\r\n\u0000]/.test(p))) throw new Error('Scheduler paths may not contain newlines or NUL');
  const args = kind => [cli, 'run', '--config', cfg.configPath, '--kind', kind, '--due'];
  if (platform === 'windows') {
    // All trigger days run the due guard. This keeps cadence tied to successful briefs, including after outages.
    const quoteArg = s => '"' + s.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1') + '"';
    const actions = ['daily', 'weekly'].map(kind => {
      const trigger = kind === 'daily' ? `New-ScheduledTaskTrigger -Daily -At ${ps(cfg.schedule.dailyAt)}` : `New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At ${ps(cfg.schedule.weeklyAt)}`;
      return `$action = New-ScheduledTaskAction -Execute ${ps(node)} -Argument ${ps(args(kind).map(quoteArg).join(' '))}\n$trigger = ${trigger}\nRegister-ScheduledTask -TaskName 'WorldBriefOSS-${kind}' -Action $action -Trigger $trigger -Settings $settings -Description 'Local World Brief; user-installed' | Out-Null`;
    });
    return { 'install-tasks.ps1': `# Generated only. Review and run manually in your user session. Uses the OS local timezone.\n$ErrorActionPreference = 'Stop'\n$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 20)\n${actions.join('\n')}\n` };
  }
  if (platform === 'linux') {
    const lines = ['# Generated crontab fragment. Uses the OS local timezone; install manually.', '# The daily --due guard enforces dailyEveryDays. No notification is sent.'];
    for (const kind of ['daily', 'weekly']) {
      const [hour, minute] = clock(cfg.schedule[kind === 'daily' ? 'dailyAt' : 'weeklyAt']);
      // cron treats percent specially even inside shell quotes.
      const command = [node, ...args(kind)].map(sh).join(' ').replace(/%/g, '\\%');
      lines.push(`${minute} ${hour} * * ${kind === 'weekly' ? '0' : '*'} ${command}`);
    }
    return { 'world-brief.cron': lines.join('\n') + '\n' };
  }
  const files = {};
  for (const kind of ['daily', 'weekly']) {
    const [hour, minute] = clock(cfg.schedule[kind === 'daily' ? 'dailyAt' : 'weeklyAt']);
    files[`org.worldbrief.${kind}.plist`] = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>org.worldbrief.${kind}</string><key>ProgramArguments</key><array>${[node, ...args(kind)].map(a => `<string>${xml(a)}</string>`).join('')}</array><key>StartCalendarInterval</key><dict><key>Hour</key><integer>${hour}</integer><key>Minute</key><integer>${minute}</integer>${kind === 'weekly' ? '<key>Weekday</key><integer>0</integer>' : ''}</dict><key>ProcessType</key><string>Background</string></dict></plist>\n`;
  }
  return files;
}

export function writeSchedules(cfg, platform, directory) {
  const root = path.resolve(directory);
  const files = schedulerFiles(cfg, platform);
  fs.mkdirSync(root, { recursive: true });
  for (const name of Object.keys(files)) if (fs.existsSync(path.join(root, name))) throw new Error(`Schedule file exists: ${name}`);
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(root, name), text, { flag: 'wx', mode: 0o600 });
  return Object.keys(files).map(name => path.join(root, name));
}
