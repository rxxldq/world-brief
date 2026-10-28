# Public release verification

Date: 2026-10-28 (Australia/Sydney).

The user explicitly authorized publication if ready after the bounded public-copy build. The release target is the authenticated user's new public `world-brief` GitHub repository, with a GitHub Pages preview containing only fictional examples.

- Source: [rxxldq/world-brief](https://github.com/rxxldq/world-brief)
- Preview: [World Brief](https://rxxldq.club/world-brief/), the account's inherited project Pages domain, with HTTPS enforced for this repository.
- No personal mailbox, runtime config, historical news, private notification destination or account quota data is published.
- No hosted model service, unattended local scheduler installation or package-registry release is included.

## Release gates

The original 36-file core and the static-demo delta received independent read-only review with no material findings or release blockers. The reviewer confirmed that all four generated pages make zero fetch calls in static mode and copy the selected prompt. Local syntax (18 modules), 15 automated tests, bilingual end-to-end CLI smoke, privacy scan, source-specific sensitive-value comparison and whitespace checks passed before the first push.

The preview builder reads only the four synthetic fixtures. Public reader pages use static mode: question actions copy a prompt instead of invoking an API. The preview workflow tests the candidate and uploads only `.world-brief/site`, excluding personal runtime files.

The initial source commit is `3da1865c124e36b308d10357d47fd81f94d749cd`. Its [Pages build and deployment](https://github.com/rxxldq/world-brief/actions/runs/40538188141) succeeded, and the public HTTPS homepage returned HTTP 200 with the exact fictional-demo notice. Its [validation matrix](https://github.com/rxxldq/world-brief/actions/runs/40538188540) records the six Windows/Linux/macOS and Node 22/24 combinations; the repository's Actions history is authoritative for current job states.

Browser checks on the public domain covered all four English/Chinese daily/weekly pages at 1280 and 390 pixels (eight combinations). Each returned HTTP 200, used static mode and had no horizontal overflow. Search filtering and prompt-copy actions worked; public question chips issued zero API requests and displayed the disconnected-model notice. The first-party archive and article paths remained under the new `/world-brief/` project path.

This report-only follow-up updates the public address and captures the verified deployment. Release tags and the latest commit's Actions/deployment records establish the final published revision; no personal-site source or DNS configuration was modified.

## Remaining limits

Live provider research/answers, ntfy delivery and native installed-scheduler execution remain untested; they require an end user's configuration. Example source links are deliberate placeholders, not evidence. The owner's explicit export/publication authorization is the basis for releasing the first-party source/styles under MIT; third-party content has not been bundled. Windows symlink creation was unavailable locally; the Linux/macOS CI runs should exercise the symlink containment test.

## Multilingual reader extension

The reader, archive, public homepage and usage guides now offer 39 target-language options, an English shortcut and the browser language. Supported browsers use their native Translator API after a user action, with model-download progress, cancellation, errors and original-text restoration. A separate Google website-translation link is explicitly enabled only for safe public HTTPS pages.

The candidate passed 26 automated tests, syntax checks for 22 JavaScript modules, offline CLI smoke tests, a 48-file privacy scan with zero findings, a source-specific sensitive-value comparison with zero findings, and whitespace checks. Independent read-only review found no material release blocker; targeted review of the final corrections is tracked separately by the release manager.

Real browser checks translated the mixed English/Chinese homepage into French and the Chinese weekly reader into English and Arabic. Original wording restored exactly; source JSON, URLs and identifying source names stayed unchanged. Arabic set right-to-left reading direction, and the tested 390-pixel mobile layout had no horizontal overflow. The personal daily reader also completed native English translation while private quota text stayed unchanged and no Google link was offered.

A simulated unsupported-native-browser check on the public origin confirmed the optional Google fallback, zero automatic translation requests, and removal of query strings and fragments from the forwarded public URL. This simulation does not establish Google service availability in every region. Native support remains conditional on browser, device and language pair; all 39 pairs were not tested. These are candidate verification results, not a claim that the remote deployment has completed.
