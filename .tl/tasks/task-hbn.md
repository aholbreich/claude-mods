---
id: task-hbn
title: Fix /tl-init ledger detection
status: done
priority: high
type: bug
created_at: 2026-10-03T20:54:10Z
updated_at: 2026-10-03T20:56:13Z
created_by: pi-agent
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
---

## Description

The initial implementation treats any compatible tl CLI as proof that .tl already exists, preventing initialization in a new repository. Check .tl independently.

## Notes

- 2026-10-03T20:56:13Z [pi-agent] note: Fixed /tl-init to check .tl independently of CLI compatibility. Added integration coverage proving init executes without an existing ledger. Strict validation passes and all 6 tests pass.
