export const MIN_TL_VERSION = "0.9.0";

export type TaskSummary = {
  id?: unknown;
  title?: unknown;
  status?: unknown;
  priority?: unknown;
  tags?: unknown;
};

export type TaskSection = {
  label: string;
  icon: string;
  color: string;
  tasks: TaskSummary[];
};

export type Snapshot = {
  ready: TaskSummary[];
  inProgress: TaskSummary[];
  blocked: TaskSummary[];
  pendingHuman: TaskSummary[];
  stale: TaskSummary[];
};

export const EMPTY_SNAPSHOT: Snapshot = {
  ready: [],
  inProgress: [],
  blocked: [],
  pendingHuman: [],
  stale: [],
};

export function tasksFromJson(text: string, command: string): TaskSummary[] {
  if (text.trim() === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`${command} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (parsed === null) return [];
  if (!Array.isArray(parsed)) throw new Error(`${command} returned JSON that is not a task list`);
  return parsed.filter((item): item is TaskSummary => typeof item === "object" && item !== null);
}

export function parseTlVersion(output: string): string | null {
  const match = /^(?:tl(?:\s+version)?\s+)?v?((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)$/.exec(output.trim());
  if (!match) return null;
  if (match[2]?.split(".").some((part) => /^0\d+$/.test(part))) return null;
  return match[1];
}

export function isTlVersionCompatible(version: string): boolean {
  const parsed = parseTlVersion(version);
  if (parsed === null) return false;
  const [core, ...suffixParts] = parsed.split("+")[0].split("-");
  const suffix = suffixParts.join("-");
  const installed = core.split(".").map(Number);
  const minimum = MIN_TL_VERSION.split(".").map(Number);
  for (let index = 0; index < minimum.length; index += 1) {
    if (installed[index] !== minimum[index]) return installed[index] > minimum[index];
  }
  return suffix === "" || /^(?:0|[1-9]\d*)-[0-9a-f]{4,64}$/i.test(suffix);
}

export function taskId(task: TaskSummary): string | null {
  return typeof task.id === "string" && task.id !== "" ? task.id : null;
}

export function priorityMarker(priority: unknown): string {
  if (typeof priority !== "string") return "△";
  if (priority.toLowerCase() === "high") return "▲";
  if (priority.toLowerCase() === "medium") return "△";
  return "▽";
}

export function taskLabel(task: TaskSummary, icon = "·"): string {
  const id = taskId(task) ?? "unknown";
  const title = typeof task.title === "string" ? task.title : "(untitled)";
  return `${icon} ${id} ${priorityMarker(task.priority)} ${title}`;
}

export function snapshotSections(snapshot: Snapshot): TaskSection[] {
  return [
    { label: "Active", icon: "◐", color: "green", tasks: snapshot.inProgress },
    { label: "Blocked", icon: "▲", color: "red", tasks: snapshot.blocked },
    { label: "Pending", icon: "?", color: "yellow", tasks: snapshot.pendingHuman },
    { label: "Ready", icon: "○", color: "cyan", tasks: snapshot.ready },
    { label: "Stale", icon: "◇", color: "yellow", tasks: snapshot.stale },
  ];
}

export function boardSections(inventory: TaskSummary[], ready: TaskSummary[], stale: TaskSummary[]): TaskSection[] {
  const sections: TaskSection[] = [
    { label: "In progress", icon: "◐", color: "green", tasks: [] },
    { label: "Ready", icon: "○", color: "cyan", tasks: [] },
    { label: "Waiting", icon: "◌", color: "yellow", tasks: [] },
    { label: "Blocked", icon: "▲", color: "red", tasks: [] },
    { label: "Pending human", icon: "?", color: "yellow", tasks: [] },
    { label: "Stale claims", icon: "◇", color: "yellow", tasks: [] },
    { label: "Other", icon: "·", color: "gray", tasks: [] },
    { label: "Done", icon: "✓", color: "green", tasks: [] },
    { label: "Cancelled", icon: "✗", color: "gray", tasks: [] },
  ];
  const byLabel = new Map(sections.map((section) => [section.label, section]));
  const readyIds = new Set(ready.map(taskId).filter((id): id is string => id !== null));
  const staleIds = new Set(stale.map(taskId).filter((id): id is string => id !== null));
  const seen = new Set<string>();

  for (const task of inventory) {
    const id = taskId(task);
    if (!id || seen.has(id)) continue;
    seen.add(id);

    let label = "Other";
    if (task.status === "in_progress") label = "In progress";
    else if (task.status === "blocked") label = "Blocked";
    else if (task.status === "pending_human") label = "Pending human";
    else if (task.status === "done") label = "Done";
    else if (task.status === "cancelled") label = "Cancelled";

    if (label !== "Done" && label !== "Cancelled") {
      if (staleIds.has(id)) label = "Stale claims";
      else if (task.status === "open") label = readyIds.has(id) ? "Ready" : "Waiting";
    }
    byLabel.get(label)?.tasks.push(task);
  }
  return sections;
}

export function focusedSections(sections: TaskSection[], showAll: boolean): TaskSection[] {
  if (showAll) return sections;
  return sections.filter((section) => section.label !== "Done" && section.label !== "Cancelled");
}

export type WorkflowAction = "implement" | "refine" | "review" | "plan";

export function buildTaskWorkflowPrompt(id: string, action: WorkflowAction): string {
  if (action === "implement") {
    return `Implement task ${id}.\n\nWorkflow:\n1. Inspect context with tl show ${id} and tl history ${id}.\n2. Claim the task with tl claim ${id} before editing.\n3. Make focused changes for the task.\n4. Run relevant verification.\n5. Add tl note ${id} -m "..." with meaningful progress and test results.\n6. Close with tl close ${id} only when done and verified; otherwise use tl block, tl pending, tl cancel, or tl release as appropriate.`;
  }
  if (action === "refine") {
    return `Refine task ${id}.\n\nReview tl show ${id} and tl history ${id}. Improve its title, description, priority, type, tags, dependencies, or references when useful. Present proposed refinements first if anything is ambiguous. Do not edit repository files for this action.`;
  }
  if (action === "review") {
    return `Review task ${id} for completeness and readiness.\n\nInspect tl show ${id} and tl history ${id}. Look for missing acceptance criteria, blockers, duplicates, unclear scope, or stale context. Summarize findings and recommended next steps. Do not edit files or change the task unless asked.`;
  }
  return `Plan implementation for task ${id}.\n\nInspect tl show ${id} and tl history ${id}. Produce a concise implementation plan, likely files or areas to inspect, risks, and verification steps. Do not claim the task or edit files yet.`;
}

export function buildCapturePrompt(todos: string): string {
  return `Turn these rough todos into clean tl task-ledger tasks.\n\nDeduplicate overlapping items, split unrelated work, and infer clear titles, descriptions, priorities, types, tags, dependencies, and references. Present the cleaned list for confirmation before creating more than one task. After confirmation, create tasks with the tl CLI and report partial failures. Do not create tasks silently.\n\nRough todos:\n\n${todos}`;
}

export function buildTriagePrompt(): string {
  return `Perform a task-ledger triage review.\n\nUse tl list --all --json for the inventory. Inspect relevant tasks with tl show and tl history. Identify duplicates, coverage gaps, vague scope, stale priorities or statuses, actionable blockers, pending-human nudges, and missing dependencies. Report the top issues and propose concrete changes, but do not mutate tasks until I confirm.`;
}

export const TASK_LEDGER_CONTEXT = `Task ledger is available in this repository through the tl CLI. Before selecting queued work, run tl ready --json. Inspect a task with tl show <id> and tl history <id>, claim it before editing, record meaningful progress with tl note, and finish explicitly with tl close, tl block, tl pending, tl cancel, or tl release. Never edit .tl/events.jsonl manually.`;
