# Public release verification

Date: 2026-10-28 (Australia/Sydney).

The user explicitly authorized publication if ready after the bounded public-copy build. The release target is the authenticated user's new public `world-brief` GitHub repository, with a GitHub Pages preview containing only fictional examples.

- Source: [rxxldq/world-brief](https://github.com/rxxldq/world-brief)
- Preview: [World Brief](https://rxxldq.github.io/world-brief/)
- No personal mailbox, runtime config, historical news, private notification destination or account quota data is published.
- No hosted model service, unattended local scheduler installation or package-registry release is included.

## Release gates

The original 36-file core and the static-demo delta received independent read-only review with no material findings or release blockers. The reviewer confirmed that all four generated pages make zero fetch calls in static mode and copy the selected prompt. Local syntax (18 modules), 15 automated tests, bilingual end-to-end CLI smoke, privacy scan, source-specific sensitive-value comparison and whitespace checks passed before the first push.

The preview builder reads only the four synthetic fixtures. Public reader pages use static mode: question actions copy a prompt instead of invoking an API. The preview workflow tests the candidate and uploads only `.world-brief/site`, excluding personal runtime files.

This record is prepared before publication. Remote CI results, deployment status and exact public content must be verified against the pushed commit before reporting the site as live. The repository's Actions history and Pages deployment records provide the current commit-bound results.

## Remaining limits

Live provider research/answers, ntfy delivery and native installed-scheduler execution remain untested; they require an end user's configuration. Example source links are deliberate placeholders, not evidence. The owner's explicit export/publication authorization is the basis for releasing the first-party source/styles under MIT; third-party content has not been bundled. Windows symlink creation was unavailable locally; the Linux/macOS CI runs should exercise the symlink containment test.
