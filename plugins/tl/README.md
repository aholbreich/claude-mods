# TaskLedger mod for Claude Code

A native Claude Code integration for [`tl`](https://github.com/aholbreich/tl), the Git-native TaskLedger CLI. It shells out to the separately installed `tl` executable and keeps `.tl/` as the source of truth.

## Requirements

- Claude Code 2.1.287 or newer
- `tl` 0.9.0 or newer on `PATH`
- A repository containing `.tl/`, or initialize one with `/tl-init`

## Features

- Compact ready, active, blocked, pending, and stale summary above the prompt
- Start, refine, review, or plan a task straight from the summary with hotkeys
- Interactive `/tl-board` pane with Focused and All views
- Task details via `tl show`
- Board actions to implement, refine, review, or plan a selected task with Claude
- Confirmed cancel/remove lifecycle actions
- Automatic refresh after each main-agent turn
- TaskLedger workflow context added only when the repository contains `.tl/`

## Commands

| Command | Action |
| --- | --- |
| `/tl-board` | Open the interactive board |
| `/tl-refresh` | Reload summary and board data |
| `/tl-toggle` | Hide or show the summary for this session |
| `/tl-init` | Initialize `.tl/` after confirmation |
| `/tl-capture <rough todos>` | Ask Claude to refine rough todos into tasks |
| `/tl-triage` | Ask Claude to review ledger health without mutating it |

In the summary above the prompt, press `ctrl+x tab` to move the keyboard into it, `↑`/`↓` to select a task, then `i`, `r`, `v`, or `p` to implement, refine, review, or plan it; with no row selected they act on the first task. Enter on a task opens it in the board, and Esc returns to the prompt.

Inside the board, use `↑`/`↓` and Enter to navigate controls. In task details, `i`, `r`, `v`, and `p` start implementation, refinement, review, and planning; `c` and `x` cancel or remove after confirmation.

## Development

From the marketplace repository root:

```bash
claude --plugin-dir ./plugins/tl
claude plugin validate ./plugins/tl --strict
claude plugin test ./plugins/tl
```

The mod uses only Claude Code's mods API (`$.process`, `$.fs`, `$.ui`, `$.prompt`, and `$.command`) and executes `tl` with argv arrays rather than a shell.
