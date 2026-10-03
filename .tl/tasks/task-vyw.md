---
id: task-vyw
title: Remove duplicated board hotkey labels
status: done
priority: medium
type: bug
created_at: 2026-10-03T21:01:09Z
updated_at: 2026-10-03T21:02:06Z
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

Claude automatically prefixes hotkeys on plain buttons. Use unprefixed labels so the board renders a: Focused rather than a: a: Focused.

## Notes

- 2026-10-03T21:02:06Z [pi-agent] note: Removed manual hotkey prefixes from plain board buttons and bumped the plugin to 0.1.2. Strict validation and all 6 tests pass.
