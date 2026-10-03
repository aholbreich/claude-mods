---
id: task-2z2
title: Start tasks from the summary band with keys
status: pending_human
priority: medium
type: task
created_at: 2026-10-03T21:52:20Z
updated_at: 2026-10-03T22:07:39Z
created_by: claude
assignee: null
depends_on: []
claim:
  actor: null
  claimed_at: null
  expires_at: null
  heartbeat_at: null
pending:
  question: Please try the band hotkeys live (claude --plugin-dir ./plugins/tl, then ctrl+x tab, arrows, i/r/v/p) and confirm they work before this is closed.
  requester: claude
  requested_at: 2026-10-03T21:55:25Z
tags:
  - ui
  - tl-mod
references:
  - plugins/tl/hooks/register.ts
---

## Description

Make task rows in the above-prompt band focusable. After ctrl+x tab, arrows select a row and i/r/v/p start implement/refine/review/plan for the selected task without opening /tl-board; Enter opens the task in the board.

## Notes

- 2026-10-03T21:55:21Z [claude] note: Band task rows are now focusable Buttons (key tl-band-task-<id>); a ui.focus hook tracks the selected row. i/r/v/p band Buttons submit the workflow prompt for the selected row (first row if none); Enter on a row opens the board at that task's details. Added taskText/truncate helpers, 3 tests. claude plugin test: 11 pass; validate --strict passes; tsc clean. Bumped to 0.1.4. Not yet verified live: installed copy comes from GitHub, so it needs a push + plugin update or claude --plugin-dir ./plugins/tl.
- 2026-10-03T22:07:39Z [claude] note: Live feedback: Tab landed on the i/r/v/p band buttons, and the details view had no visible close key. Fixed in 0.1.5: ui.focus redirects the ring off workflow buttons to task rows (wrapping), and the board gets q: Close (role dismiss) plus a 'b back · q or Esc close' hint. 12 tests pass, validate --strict and tsc clean.
