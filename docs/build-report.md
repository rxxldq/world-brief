# Build and privacy report

This is the original local-build record. Subsequent independent review and public publication are recorded in [the release report](release-report.md).

Date: 2026-10-28 (Australia/Sydney). Execution: direct local Codex session acting as the existing task-card worker. No external model router, quota telemetry, live model invocation or secondary agent was used.

## Delivered

An independent Git repository containing a clean public copy: cross-platform CLI, configuration, English/Chinese reader and research requests, daily/weekly JSON examples, renderer/archive, loopback question service, bounded notification preview/opt-in send, three-platform scheduler exports, docs, tests, CI and MIT license. The personal source tool is unchanged. No remote repository, Git commit, publication or scheduler registration was created.

The supplied build card did not name exact test commands. Its separate planning card referred to a `SPEC.md` that was not present in the available project. The scope and checks used here are recorded in the new `SPEC.md`, derived from the build card's named deliverables and its source tool, without replaying unrelated project work.

## Verification

| Check | Actual result |
| --- | --- |
| `npm ci --ignore-scripts` | Passed; dependency-free package with lockfile |
| `npm run check` | Passed; 16 JavaScript modules parsed |
| `npm test` | Passed; 14 automated tests, no failures |
| `npm run smoke` | Passed; complete CLI import/validate/render/archive/HTTP/push-preview/scheduler-export flow in both languages and both brief kinds |
| `npm run privacy` | Passed; zero generic findings in public files |
| Local source-specific privacy scan | Passed; no matches for sensitive source-config values or the current user's profile path; matching values are never included in this report |
| Source preservation | All 16 baseline top-level personal source files retain their SHA-256 hashes; both reused CSS files match the personal source |
| Generated Windows schedule | PowerShell parser accepted the generated registration script; it was not executed |
| Generated macOS schedules | Both plist documents parsed as XML; launchd was not run |
| Browser layout | English daily and Chinese weekly at 1280/390 px, light/dark: 8 combinations, no horizontal overflow and no page JavaScript errors |
| Browser interaction | Search filters/restores items; expand, contents navigation, question panel open/close and text sizing work. Copy handler receives a prompt containing its source. Disabled-provider API response produces a readable message |
| Diff whitespace | `git diff --check` passed after adding public files with intent-to-add; source changes remain uncommitted |

Tests cover malformed shapes and dates, invalid source URLs, missing image credits, invalid raster files and path escape attempts, HTML/JSON escaping, localized UI, push UTF-8 byte limits, existing-output preservation, locking, failed/timed-out/oversized provider output, multibyte provider output, loopback artifact access, hostile Host and absolute request targets, malformed URLs, Origin and header restrictions, request limits, question concurrency, durable daily limits and private-file denial. Synthetic command providers do not consume a subscription or access live sources.

The Windows host could not create a file symlink without additional privilege, so the symlink escape branch was **not exercised locally**. Canonical containment is implemented; the CI matrix is configured to exercise this on hosts with symlink support. This limitation is reported rather than counted as a demonstrated local result.

The copy-button browser check captured its outgoing text through a test stub; actual OS clipboard permissions were not independently tested. A deliberate disabled-provider request returns HTTP 503 and a readable message; the browser's corresponding failed-network console entry is expected.

## Depersonalization

The public file inventory contains source code, local styles, configuration template, synthetic fixtures, documentation and test/CI definitions. It excludes personal email integrations/accounts, mail state, real briefs, account quotas, router policies, private notification topics, browser profiles, source config, logs and vendored research/media trees. Runtime config, previews, screenshots and generated scheduler files are ignored and excluded from the release inventory.

The generic scanner checks email addresses, workstation paths, key/token patterns, embedded URL credentials, private runtime filenames, symlinks and binary files requiring review. A separate private local comparison checks sensitive values from the source config without copying them into the public repo. A scan is an aid to review and does not prove absence of all personal data.

## Remaining verification

- Independent reviewer signoff remains with the originating manager, as requested by the card's independent review plan. The current executor is the writer and has not represented self-testing as independent review.
- Remote GitHub Actions has not run. Windows/Node 24 is the actual local test environment; Node 22 and macOS/Linux behavior are covered by portable code, format tests and the configured CI matrix, not native local execution.
- No live provider research/answer, real news fact check, delivered ntfy notification or installed scheduler execution was attempted. They require the eventual user's provider/service configuration. There is no claimed end-to-end delivery for these external services.
- The local source's ownership history was not independently established; the owner should confirm rights to license the reused first-party styles/source before public publication. No external comparison-repository code, media or license was imported.

## Changed files

All files below are newly added to this public-copy repository. No personal tool file was modified.

```text
.gitattributes
.github/workflows/ci.yml
.gitignore
LICENSE
README.md
README.zh-CN.md
SPEC.md
assets/brief-theme.css
assets/brief-ui.css
assets/brief-ui.js
bin/world-brief.mjs
config.example.json
docs/build-report.md
docs/configuration.md
docs/privacy.md
docs/provenance.md
examples/daily.en.json
examples/daily.zh.json
examples/weekly.en.json
examples/weekly.zh.json
package-lock.json
package.json
scripts/check.mjs
scripts/privacy-scan.mjs
scripts/smoke.mjs
src/config.mjs
src/i18n.mjs
src/provider.mjs
src/push.mjs
src/render.mjs
src/run.mjs
src/schedule.mjs
src/server.mjs
src/validate.mjs
test/core.test.mjs
test/integration.test.mjs
```
