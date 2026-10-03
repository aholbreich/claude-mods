---
id: task-2ju
title: Polish tl mod UI with richer colors and visual hierarchy
status: open
priority: low
type: task
created_at: 2026-10-03T21:48:18Z
updated_at: 2026-10-03T21:48:18Z
created_by: claude
assignee: null
depends_on: []
claim:
  actor: null
  claimed_at: null
  expires_at: null
  heartbeat_at: null
tags:
  - ui
  - tl-mod
references:
  - plugins/tl/hooks/register.ts
  - plugins/tl/hooks/model.ts
---

## Description

The summary band and /tl-board look plain. Use color and styling more consistently so state is quicker to read: distinct colors per status (ready, active, blocked, pending, stale, done), a color for priority, a clear highlight on the focused row, and dimmed secondary details (IDs, tags). Check that it reads well in both dark and light terminal themes and still makes sense without color (keep the icons and labels).
