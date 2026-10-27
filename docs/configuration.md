# Configuration and data contract

Copy `config.example.json` through `init`; do not commit your local config. Runtime paths are relative to the config directory. There are no hard-coded executable paths or account identifiers.

| Field | Meaning |
| --- | --- |
| `locale` | `en` or `zh`; reader UI, archive, push headings and generation language |
| `timezone` | IANA timezone for date labels and daily question budget; default `UTC` |
| `outRoot` | Generated briefs/archive root, relative to config file or absolute |
| `topics` | Non-empty topic names used in the research request |
| `provider.type` | `disabled` (default) or `command` |
| `provider.executable`, `args` | Executable and literal arguments; never a shell command string |
| `provider.timeoutMs` | 100–900000 ms; default 150000 |
| `ask.enabled`, `port`, `maxPerDay` | Opt-in question API, loopback port, attempted questions per calendar day |
| `ntfy.enabled`, `server`, `topic` | Opt-in HTTPS notification destination; choose your own topic |
| `ntfy.tokenEnv` | Environment variable holding the token; never put the token in JSON |
| `schedule.dailyAt`, `weeklyAt` | `HH:MM`, OS local clock |
| `schedule.dailyEveryDays` | Calendar days since the last successful daily brief; default 1 (daily). Migrate an older private config from 3 to 1 explicitly |

`serve` binds only to `127.0.0.1`; port `0` requests an ephemeral port. A used port fails, rather than assuming another process is a trusted World Brief server. Use one server per output root so that the in-process concurrency guard and daily budget have one owner. Daily budgets are saved in `.ask-counts.json`; attempted provider calls count even when they fail. Corrupt counters fail closed. The static server never exposes this file.

## Provider contract

World Brief spawns a single executable without a shell, in a temporary empty working directory. It inherits your environment so you can supply credentials through the provider's supported secret mechanisms. It does not inspect credentials or store provider stderr. Successful stdout is limited to 2 MiB; timeouts, empty output, invalid JSON or a nonzero exit reject the run. The CLI does not retry automatically or substitute another model. All fixture tests use a fake command, never a live subscription.

Each invocation receives one JSON object on stdin:

```json
{
  "task": "generate",
  "kind": "daily",
  "date": "2025-01-15",
  "window": "2025-01-12 ~ 2025-01-15",
  "locale": "en",
  "topics": ["Diplomacy", "AI"],
  "prompt": "Research instructions and required JSON structure supplied by World Brief"
}
```

For `generate`, return only a brief object matching the examples. No Markdown fences or progress text on stdout. For `ask`, the request includes `date`, `locale`, `item`, `question`, `history` (at most six bounded messages) and `prompt`. Return plain text. Never treat item, source or history text as trusted instructions. A command provider is arbitrary local code: tool and filesystem restrictions must be enforced by that provider, rather than relying only on the prompt. Termination kills the direct child; wrappers must clean up their own descendant processes.

An installed Claude CLI can be used as a text-mode command provider by setting:

```json
{
  "type": "command",
  "executable": "claude",
  "args": ["-p", "--model", "sonnet", "--output-format", "text", "--allowedTools", "WebSearch,WebFetch", "--disallowedTools", "Bash,Read,Write,Edit,Glob,Grep,NotebookEdit,Task,Agent"],
  "timeoutMs": 150000
}
```

This relies on the provider following the output instructions in the JSON request; any surrounding text will be rejected. Check the installed CLI's help for supported tools/options and configure permissions accordingly. No flags that bypass permissions are used. On Windows, use the native `.exe` or invoke an adapter through `node`; `.cmd`/`.bat` shell shims are not executed with `shell: true`. World Brief itself does not implement a Claude or Codex quota client. A live third-party CLI run has not been performed as part of this build.

## Brief JSON

Required top-level fields: `kind` (`daily`/`weekly`), real ISO `date`, non-empty `title`, non-empty string array `bluf`, non-empty `sections`. Each section requires `title` and a non-empty `items` array. Each item requires `headline` and one or more source objects with a valid HTTP(S) `url`. Optional `confidence` is `high`, `medium` or `low`.

Optional item fields: `summary`, `why_it_matters`, `unverified`, `synthesis`; `sources` with `title`, `publisher`, `published`; `voices` with `name`, `camp`, `url` and at least `quote` or `paraphrase`, plus optional `role`, `outlet`, `bio`, `date`; `embeds` with `url`, optional `note`/`type`; `images` with `source_url`, `credit`, optional `caption`, and either `file` or `remote_url`. Camp values are `left`, `center-left`, `center`, `center-right`, `right`, `state-media`, `other`.

Optional top-level fields: `locale`, `window`, `method_note`, `watchlist` (`item` required, `date` optional). Use `method_note` to disclose research failures, missing perspectives and stale evidence. See the four synthetic examples for full daily/weekly objects in both languages.

### Detailed voices and funding background

Each voice may additionally contain `position`, `evidence`, `reasoning` and `counterpoint` strings. Attribute the author's claims and distinguish editorial counterpoints from the author's own words. Generation targets around 150–250 Chinese characters or 90–160 English words per person when sources support that detail; insufficient material should shorten the entry and disclose the limit.

An optional `funding` object contains `status` (`documented`, `not_found`, `not_checked`), `scope` (`person`, `organization`), `summary` (string), `sources` (objects with HTTP(S) `url`, optional `title`/`publisher`), `checked_at` (real ISO date) and optional `limitations` (string). `documented` requires a non-empty summary and at least one citation. The renderer labels status and scope explicitly, displays citations/date and keeps unknown states distinct from absence of funding.

Use primary disclosures: annual reports, donor lists, ownership statements, public filings or personal disclosures. Research is bounded to one or two source checks per person and may reuse an already checked organization. Do not guess figures, ties or motives when disclosures cannot be found. An employer/outlet's financial background is organizational evidence, not proof of personal compensation for a specific statement. Copy/ask prompts preserve that attribution and context.

The public examples remain fictional; their unknown funding fields demonstrate the format and are not real investigations. Local personal briefs are never included in the public build.

Local image filenames must be `img/name.png|jpg|jpeg|gif|webp`, have a matching file signature, resolve inside the brief directory and be at most 8 MiB. `run --input` copies only validated images into staging. Model-generated local image references are not accepted. An invalid local file fails validation even when a remote fallback is present. Remote images require valid HTTP(S) URLs, provenance and independently checked rights. Embedded videos/social posts are ordinary external links, avoiding third-party scripts and iframes.

## Failure recovery

Runs use an exclusive `.run.lock` and stage in a hidden sibling directory. An invalid provider result is never published as a dated brief. If the process crashes, first verify that no run is still active, then remove that root's stale `.run.lock` and `.staging-*` directories manually. Do not remove another process's live lock. Already published dated briefs are preserved; `render` can rebuild the parent archive if archive writing failed after a successful publish. `--due` considers only completed dated directories; it skips runs until the configured interval has elapsed.
