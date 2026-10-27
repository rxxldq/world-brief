# World Brief

There are many AI briefing systems, but this one helps you see things a little more objectively. Its weekly review brings together voices from across the political spectrum—left, right and beyond—regardless of nationality. Where possible, it also identifies their funding sources, helping you better understand whose interests they speak for.

[![CI](https://github.com/rxxldq/world-brief/actions/workflows/ci.yml/badge.svg)](https://github.com/rxxldq/world-brief/actions/workflows/ci.yml) [![Website](https://github.com/rxxldq/world-brief/actions/workflows/pages.yml/badge.svg)](https://github.com/rxxldq/world-brief/actions/workflows/pages.yml)

[中文说明](README.zh-CN.md) · [Configuration](docs/configuration.md) · [Validation and scope](SPEC.md) · [Privacy](docs/privacy.md) · [Provenance](docs/provenance.md)

[Public preview](https://rxxldq.club/world-brief/) · [Source repository](https://github.com/rxxldq/world-brief)

[Using the reader](https://rxxldq.club/world-brief/usage.en.html) · [中文使用说明](https://rxxldq.club/world-brief/usage.zh.html)

The public preview contains fictional examples only. Research generation and direct AI questions run on your own computer. To build the same static preview locally, run `npm run build:demo`; output is `.world-brief/site/`.

Requires **Node.js 22 or later** on Windows, macOS or Linux. No runtime packages, account, API key, external model router or quota telemetry are required for the offline workflow. Live research uses a command provider you explicitly configure.

## What it does

| Area | Implementation |
| --- | --- |
| Briefs | Daily news and weekly perspectives with positions, evidence, reasoning and counterpoints |
| Public disclosures | Optional cited funding/ownership context, with explicit personal/organization scope and unknown states |
| Reader | English/Chinese interface, search, contents, expandable stories, source links and copyable AI prompts |
| Local workflow | Node.js CLI, validated JSON, an optional loopback question service and opt-in notifications |
| Scheduling | Windows Task Scheduler, Linux cron and macOS launchd exports; daily cadence by default |
| Verification | Automated tests, privacy checks and CI across three operating systems and Node 22/24 |

The repository contains the reusable tool. The linked website demonstrates its reader with fictional data; it is not a hosted live-news or AI service.

## Try the offline demo

Run these commands from this directory (the same commands work in PowerShell, bash and zsh):

```sh
npm ci --ignore-scripts
node bin/world-brief.mjs init
node bin/world-brief.mjs run --input examples/daily.en.json
node bin/world-brief.mjs run --kind weekly --input examples/weekly.en.json
node bin/world-brief.mjs serve
```

Open the loopback address printed by `serve`. Stop with Ctrl+C. You can also open generated `index.html` files directly; search, contents, expand/collapse and copying prompts work offline. Direct AI answers require `serve` and an enabled provider. Demo news, people and positions are **fictional**; placeholder URLs are not evidence.

For Chinese, use `init --locale zh`, then import `examples/daily.zh.json` and `examples/weekly.zh.json` instead. Set `locale` in your local config for subsequent runs. Article text is supplied in its original language; changing UI language does not translate existing articles.

## Commands

| Command | Result |
| --- | --- |
| `init [--config FILE] [--locale en\|zh]` | Creates a local configuration; refuses to overwrite |
| `run [--kind daily\|weekly] [--input FILE] [--date YYYY-MM-DD] [--due]` | Imports JSON or invokes your provider, validates, renders and updates the archive |
| `validate BRIEF_DIR` | Checks structure, source URL syntax, image provenance and local raster files |
| `render BRIEF_DIR [--locale en\|zh]` | Validates and rerenders an existing brief and its parent archive |
| `serve [--config FILE]` | Serves finished artifacts on `127.0.0.1` and optionally answers questions |
| `push BRIEF_DIR` | Previews a bounded notification payload; sends only with `--send` |
| `schedule --platform windows\|linux\|macos [--out DIR]` | Writes scheduler files for manual review and installation |

`run`, `serve`, `schedule`, and `push --send` accept `--config FILE`. A relative `outRoot` is resolved against the configuration file, not your shell directory. Imported dates come from the fixture; generated dates use your configured timezone. An explicit date/kind must agree with the JSON. An existing dated brief is preserved, and concurrent runs share an exclusive lock.

## Live research and questions

Default `provider.type` is `disabled`. Set it to `command` and configure `executable` and `args` for an installed program that accepts a single JSON request on stdin. Requests contain a `task` (`generate` or `ask`) and a `prompt`. For generation, stdout must be exactly one brief JSON object; for questions, stdout must be plain text. See [the provider contract](docs/configuration.md#provider-contract) for a Claude CLI example and the JSON schema. No provider is executed by installation, rendering, tests, scheduling export or previewing notifications.

```sh
node bin/world-brief.mjs run --kind daily
node bin/world-brief.mjs run --kind weekly
```

The provider must have its own research tools for live news. World Brief does not supply a search API, infer facts from a link, or inspect subscription quotas. An empty working directory is only an organizational boundary: external commands still run with your user permissions. Configure tool restrictions in the provider itself. Questions send the selected item, your question and at most six history messages to that provider; no transcript is saved by World Brief.

## Scheduling and notifications

```sh
node bin/world-brief.mjs schedule --platform windows
node bin/world-brief.mjs schedule --platform linux
node bin/world-brief.mjs schedule --platform macos
```

Each command only exports files into `schedules/`. Review the generated paths before installation. Scheduler clocks use the **OS local timezone**; set `config.timezone` to match if you want date labels to follow the same clock. The daily trigger runs every day with `--due`, which waits `dailyEveryDays` calendar days since the last successful daily brief (default **1**, every day). For an existing config created with an older version, change `schedule.dailyEveryDays` to `1`; installing new source code does not rewrite a private config. Weekly triggers run Sunday, with a seven-day guard. No backfill occurs. The provider must work unattended under your user account, including its environment and login.

- **Windows:** run the generated `install-tasks.ps1` in PowerShell. It creates `WorldBriefOSS-daily` and `WorldBriefOSS-weekly` without overwriting existing tasks. Remove those exact names with `Unregister-ScheduledTask`; existing personal tasks have different names.
- **Linux:** add the generated `world-brief.cron` lines to your user crontab. Remove those lines to stop it. Cron requires the machine to be running at the trigger time.
- **macOS:** copy the two `org.worldbrief.*.plist` files to your user LaunchAgents directory and load them with launchctl. Unload and remove these exact files to stop them. Native scheduler installation is not part of the build tests.

Notifications are separate from scheduled runs. To send, enable `ntfy`, choose your own topic and optionally put a token in the environment variable named by `tokenEnv`, then run `push BRIEF_DIR --send`. A public ntfy topic is not private; use authentication for sensitive content. Generated notification bodies stay within 4096 UTF-8 bytes and include up to three source actions. No mail integration or desktop notification package is bundled.

## Validate this repository

```sh
npm run check
npm test
npm run smoke
npm run privacy
```

CI runs these commands on Node 22/24 and Windows/macOS/Linux. Local verification and its limits are recorded in [the build report](docs/build-report.md). Tests use synthetic providers and local HTTP; they do not generate news, spend model usage, send notifications or install scheduled tasks.

Structure validation **does not verify facts, source reachability, copyright permission, quotation accuracy, publication dates or ideological labels**. Read the cited material before relying on a brief. Remote images are loaded by the browser only when viewed, and can reveal your IP to their host; links and media embeds remain external links, with no third-party widget scripts.

Weekly voices can include a source-grounded position, evidence, reasoning and counterpoint. Public funding disclosures are optional and distinguish a person from an employer or publication. Unknown/not checked does not mean no funding; organization funding is not evidence that a particular statement was paid for. See the usage guide and configuration contract for labels and verification limits.

The project introduction and setup instructions live in this GitHub repository. The website remains a reader demonstration and usage guide. `content/introduction.json` is left empty; usage instructions are maintained separately in `content/usage.json`.

Licensed under MIT. Source and a synthetic reader preview are published on GitHub; no package-registry release or hosted model service is provided. See [release verification](docs/release-report.md) for the checked commit and deployment status.
