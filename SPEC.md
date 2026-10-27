# Public-copy scope and acceptance

This records the bounded build requirements, not a replacement project plan. The existing build card requests a clean public repository with CLI, configuration, internationalization, documentation, tests, CI and a privacy scan report. A separate planning card mentions an earlier `SPEC.md`, but no such file was available in the supplied project. No exact pre-existing test commands or extra feature list were supplied.

## Included

- Separate local repository; preserve the personal source tool and all of its runtime data.
- Reuse its sourced daily/weekly brief format, reading interactions, theme and notification concept.
- Cross-platform Node CLI: initialize, generate/import, validate, render/archive, serve/ask, preview/send push, export scheduler files.
- Configurable paths, executable/arguments, topics, timezone, language and optional notification destination.
- English and Simplified Chinese UI, prompts, archive and notification labels; synthetic examples in both languages.
- Daily schedule defaults to every day; weekly voices support richer argument detail and bounded, attributed funding checks. The author's introduction remains empty and separate from maintained usage instructions.
- Windows Task Scheduler, Linux cron and macOS launchd exports; no automatic installation.
- Automated validation, integration and offline smoke tests; a CI matrix; depersonalization report and provenance.

## Excluded

Private email integration, account quota readers/external routing, personal prompts and account data, historical briefs, fixed workspace/browser paths, desktop shortcut/profile setup, auto-downloading external maps/images, bundled research engines, public hosting, remote Git pushes and package publication. These are not needed to make a clean, usable public copy of the requested brief tool.

## Acceptance matrix

| Requirement | Check |
| --- | --- |
| Reproducible zero-runtime-dependency install | `npm ci --ignore-scripts` |
| Import and read daily/weekly artifacts in en/zh | `npm run smoke` |
| Strict source/image checks and malformed JSON handling | `npm test` |
| No stale publication after failed provider; locking and output preservation | `npm test` |
| Escaped HTML/JSON and loopback access controls | `npm test` |
| Bounded push preview and opt-in send | `npm test`, offline smoke; live sending excluded |
| Scheduler files in all three native formats, correctly quoted paths | `npm test`, offline smoke; native registration excluded |
| Static JavaScript validity | `npm run check` |
| Generic private-data patterns and runtime-file exclusion | `npm run privacy` plus local source-specific scan |
| Cross-platform CI defined | `.github/workflows/ci.yml`; CI execution requires a remote runner |
| Personal source untouched | Compare baseline hashes after build |
| Independent review | Handoff to the originating manager; not substituted by the writer's own tests |

The public release adds a static preview generated only from the synthetic fixtures; it does not expose the local question service. Current independent review and deployment evidence are recorded in `docs/release-report.md`. Facts, rights to third-party media, live provider behavior, delivered notifications, native scheduler execution and remote CI are reported separately rather than inferred from structural tests.
