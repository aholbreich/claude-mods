---
id: task-cwj
title: Fix default lifecycle reason spelling
status: done
priority: low
type: bug
created_at: 2026-10-03T20:56:25Z
updated_at: 2026-10-03T20:56:38Z
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

Use explicit cancelled/removed wording for board lifecycle reasons instead of concatenating action + d.

## Notes

- 2026-10-03T20:56:38Z [pi-agent] note: Replaced concatenation with explicit cancelled/removed default reasons. Full validation and 6 tests pass.
