---
id: task-jo6
title: Handle null JSON from empty tl queries
status: done
priority: high
type: bug
created_at: 2026-10-03T20:58:06Z
updated_at: 2026-10-03T20:58:59Z
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
  - plugins/tl/hooks/model.ts
  - plugins/tl/.claude-plugin/plugin.json
---

## Description

tl stale --json returns null when there are no stale tasks. Treat null like an empty list, add regression coverage, and bump the plugin patch version so installed copies can update.

## Notes

- 2026-10-03T20:58:59Z [pi-agent] note: Accepted tl's null JSON as an empty task list, updated integration fixtures to match real tl stale output, and bumped the plugin to 0.1.1. Strict validation and all 6 tests pass.
