# Claude Mods by Alexander Hobreich

A personal marketplace of native [Claude Code mods](https://code.claude.com/docs/en/plugins/mods/overview).

## Requirements

- Claude Code 2.1.287 or newer (mods support)
- Only install mods from sources you trust: mods execute inside Claude Code with your user permissions

## Install the marketplace

```bash
claude plugin marketplace add aholbreich/claude-mods
claude plugin install tl@aholbreich-claude-mods
```

Restart Claude Code or run `/reload-plugins` after installing or updating a mod.

For local development:

```bash
git clone https://github.com/aholbreich/claude-mods.git
claude --plugin-dir ./claude-mods/plugins/tl
```

## Mods

| Mod | Description |
| --- | --- |
| [`tl`](plugins/tl/) | TaskLedger summary above the prompt and interactive task board |

## Development

```bash
npm run validate
npm test
npm run check
```

Each plugin is independently versioned. Keep its version synchronized between `plugins/<name>/.claude-plugin/plugin.json` and the corresponding marketplace release metadata when publishing.

## License

MIT
