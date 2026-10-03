---
id: task-bhd
title: Fix tl mod review findings
status: done
priority: high
type: bug
created_at: 2026-10-03T21:08:15Z
updated_at: 2026-10-03T21:17:26Z
created_by: claude
assignee: null
depends_on: []
claim:
  actor: null
  claimed_at: null
  expires_at: null
  heartbeat_at: null
tags:
  - claude-mod
references:
  - plugins/tl/hooks/register.ts
  - plugins/tl/hooks/model.ts
---

## Description

Review of the tl mod against Claude Code 2.1.288: strict type errors (null task id passed to lifecycle actions, noUncheckedIndexedAccess in model.ts, stale test mocks), $.ui.ask single-option prompts padded with Yes/No (so 'Yes' becomes the todo list or the cancel reason), truncated tl output not detected, Refresh overriding the user's Focused/All choice, owner name typo.

## Notes

- 2026-10-03T21:11:01Z [claude] note: Fixed: /tl-capture and /tl-triage never reached Claude (engine refuses $.prompt.submit inside command.run; now deferred via $.clock.after); $.ui.ask single-option dialogs padded with Yes/No (capture now requires args, cancel/remove reason offers 'Use default reason'/'Keep task'); null task id passed to lifecycle actions; strict-index type errors in model.ts; truncated tl output detected; Refresh keeps the Focused/All choice; stale test mocks; owner name typo; bumped to 0.1.3. Verified: strict validate (marketplace + plugin), 8/8 plugin tests incl. 2 new, tsc --strict clean.
