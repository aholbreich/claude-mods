# Project entry point

Claude Code mod marketplace maintained by Alexander Holbreich.

## Layout

- `.claude-plugin/marketplace.json` — marketplace catalog
- `plugins/<name>/` — independently installable Claude Code plugins
- `plugins/<name>/hooks/` — mod registration modules
- `plugins/<name>/tests/` — tests run by the Claude Code mod test harness

## Development

Use the exact APIs in the `claude-code` type declarations generated for the installed Claude Code version. Keep plugin manifests and marketplace entries version-aligned.

```bash
claude plugin validate . --strict
claude plugin validate plugins/tl --strict
claude plugin test plugins/tl
```

<!-- BEGIN TL WORKFLOW -->
## tl workflow compact
Use `tl ready --json` before selecting queued work. Inspect with `tl show <id>` and `tl history <id>`. Claim with `tl claim <id> --actor <name>` before editing. Record progress with `tl note`. Finish with `tl close`, `tl block`, `tl pending`, `tl cancel`, or `tl release`.

Do not edit `.tl/events.jsonl` manually.
<!-- END TL WORKFLOW -->
