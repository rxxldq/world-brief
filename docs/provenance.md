# Provenance and license boundaries

This repository is an authorized clean export of an existing local World Brief tool. Its original daily/weekly data model, source/image credit discipline, search/contents/expand/copy/ask interactions, editorial theme and ntfy payload approach are retained. The renderer, cross-platform runner, command protocol, loopback service, configuration, scheduler exporters, translations, docs, tests and CI are adapted or newly implemented for the public copy.

The two CSS files `assets/brief-ui.css` and `assets/brief-theme.css` are reused unchanged from that local source. No third-party notices were present in those files. The output uses system fonts only; it bundles no font files, photographs, external maps or other people's reporting. The example news and voices are synthetic, with reserved example-domain links clearly labeled as placeholders.

The build card records earlier comparison with `vkorost/claude-daily-news-report`, `elanthus/news-briefing` and `chenxihuang1028-a11y/world-events-briefing`. **No code or assets from those repositories are included here.** The card's compatibility note is not treated as a verified license for any uninspected third-party repository. There is no obligation to import a comparison project's code to fulfill the reuse decision.

The personal tool's vendored research engine, map geometry, desktop notification module, personal mail workflow and generated briefs are excluded. ntfy and a user-installed model CLI are external services/programs, not redistributed libraries. Users must confirm rights before importing third-party images, quotes or other copyrighted data into their own briefs.

The `LICENSE` applies to the exported first-party code in this repository. It does not grant rights to linked content, remote images or output from an external model. Before a public release, the owner should confirm that they have the right to license the original local source and reused styles; this build does not establish ownership history beyond the user's export authorization.
