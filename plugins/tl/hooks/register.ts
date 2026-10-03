import type { EngineInterface, ProcessRunResult, Register } from "claude-code";
import {
  EMPTY_SNAPSHOT,
  MIN_TL_VERSION,
  TASK_LEDGER_CONTEXT,
  boardSections,
  buildCapturePrompt,
  buildTaskWorkflowPrompt,
  buildTriagePrompt,
  focusedSections,
  isTlVersionCompatible,
  parseTlVersion,
  snapshotSections,
  taskId,
  taskLabel,
  taskText,
  tasksFromJson,
  truncate,
  type Snapshot,
  type TaskSection,
  type TaskSummary,
  type WorkflowAction,
} from "./model";

const PANE_ID = "tl-board";
const PANE_TITLE = "Task Ledger";
const MAX_BAND_TASKS_PER_SECTION = 3;
const MAX_BAND_TASK_ROWS = 9;
const BAND_TASK_KEY_PREFIX = "tl-band-task-";
const WORKFLOW_HOTKEYS: ReadonlyArray<{ action: WorkflowAction; label: string; hotkey: string }> = [
  { action: "implement", label: "Implement", hotkey: "i" },
  { action: "refine", label: "Refine", hotkey: "r" },
  { action: "review", label: "Review", hotkey: "v" },
  { action: "plan", label: "Plan", hotkey: "p" },
];

type EnvironmentState =
  | { kind: "loading" }
  | { kind: "ready"; version: string }
  | { kind: "not-found" }
  | { kind: "incompatible"; version: string | null }
  | { kind: "no-ledger" }
  | { kind: "error"; message: string };

type BoardMode = "list" | "details";

let environment: EnvironmentState = { kind: "loading" };
let snapshot: Snapshot = EMPTY_SNAPSHOT;
let sections: TaskSection[] = [];
let boardMode: BoardMode = "list";
let detailsTask: TaskSummary | null = null;
let detailsText = "";
let detailsLoading = false;
let boardLoading = false;
let boardError: string | null = null;
let showAll = false;
let bandHidden = false;
let bandSelectedId: string | null = null;
let refreshSerial = 0;

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    await registerCommands($);
    const result = await next(e);
    await refreshSummary($);
    return result;
  });

  on("turn.complete", async ($, e, next) => {
    const result = await next(e);
    if (!e.agentId) await refreshSummary($);
    return result;
  });

  on("prompt.context", async ($, e, next) => {
    const result = await next(e);
    try {
      if (!(await $.fs.exists(".tl"))) return result;
      if (result.blocks.some((block) => block.name === "taskLedger")) return result;
      return {
        ...result,
        blocks: [...result.blocks, { name: "taskLedger", text: TASK_LEDGER_CONTEXT }],
      };
    } catch {
      return result;
    }
  });

  on("command.run", { command: "tl-board" }, async ($) => {
    await refreshSummary($);
    if (environment.kind !== "ready") return { text: environmentMessage(environment) };
    await openBoard($);
    return {};
  });

  on("ui.focus", { component: "AbovePrompt" }, async ($, e, next) => {
    if (e.element?.startsWith(BAND_TASK_KEY_PREFIX)) bandSelectedId = e.element.slice(BAND_TASK_KEY_PREFIX.length);
    return next(e);
  });

  on("command.run", { command: "tl-refresh" }, async ($) => {
    await refreshSummary($);
    if (environment.kind === "ready") await loadBoard($);
    return { text: summaryMessage() };
  });

  on("command.run", { command: "tl-toggle" }, async ($) => {
    bandHidden = !bandHidden;
    if (!bandHidden) await refreshSummary($);
    $.ui.invalidate("ui.render");
    return { text: `Task Ledger summary ${bandHidden ? "hidden" : "shown"}.` };
  });

  on("command.run", { command: "tl-init" }, async ($) => {
    const probe = await probeEnvironment($, false);
    if (probe.kind === "not-found") return { text: "The tl CLI is not available on PATH." };
    if (await $.fs.exists(".tl")) return { text: "Task ledger is already initialized in this repository." };

    const answer = await askSafely($, "Initialize TaskLedger in this repository?", ["Initialize", "Cancel"]);
    if (answer !== "Initialize") return { text: "TaskLedger initialization cancelled." };
    const run = await runTl($, ["init"]);
    await refreshSummary($);
    if (run.exitCode !== 0) return { text: run.stderr.trim() || `tl init failed with exit code ${run.exitCode}.` };
    return { text: run.stdout.trim() || "Initialized TaskLedger." };
  });

  on("command.run", { command: "tl-capture" }, async ($, e) => {
    const todos = e.args.trim();
    if (!todos) return { text: "Usage: /tl-capture <rough todos>" };
    submitAfterCommand($, buildCapturePrompt(todos));
    return { text: "Asking Claude to turn these todos into tasks." };
  });

  on("command.run", { command: "tl-triage" }, async ($) => {
    if (!(await $.fs.exists(".tl"))) return { text: "No task ledger found. Run /tl-init first." };
    submitAfterCommand($, buildTriagePrompt());
    return { text: "Asking Claude to triage the task ledger." };
  });

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    if (e.props.hasSurvey || bandHidden || environment.kind !== "ready" || !hasSnapshotContent(snapshot)) {
      return next(e);
    }

    const downstream = await next(e);
    const { Box, Text, Button } = $.ui.resolve(e);
    const nonEmpty = snapshotSections(snapshot).filter((section) => section.tasks.length > 0);
    const summary = nonEmpty.map((section) => `${section.icon}${section.tasks.length} ${section.label.toLowerCase()}`).join(" · ");
    const rows = [];
    const selectableIds: string[] = [];
    let taskRows = 0;

    for (const section of nonEmpty) {
      const visible = section.tasks.slice(0, MAX_BAND_TASKS_PER_SECTION);
      for (const task of visible) {
        if (taskRows >= MAX_BAND_TASK_ROWS) break;
        const id = taskId(task);
        if (id && !selectableIds.includes(id)) {
          selectableIds.push(id);
          rows.push(Box({
            flexDirection: "row",
            children: [
              Text({ color: section.color, children: `${section.icon} ` }),
              Button({
                key: `${BAND_TASK_KEY_PREFIX}${id}`,
                label: truncate(taskText(task), e.props.bodyColumns - 4),
                plain: true,
                onPress: async () => openBoardFromBand($, task),
              }),
            ],
          }));
        } else {
          rows.push(Text({ color: section.color, wrap: "truncate-end", children: taskLabel(task, section.icon) }));
        }
        taskRows += 1;
      }
      const remaining = section.tasks.length - visible.length;
      if (remaining > 0 && taskRows < MAX_BAND_TASK_ROWS) {
        rows.push(Text({ dimColor: true, children: `  ${remaining} more ${section.label.toLowerCase()}` }));
        taskRows += 1;
      }
      if (taskRows >= MAX_BAND_TASK_ROWS) break;
    }

    const band = Box({
      flexDirection: "column",
      paddingX: 1,
      children: [
        Text({ color: "cyan", bold: true, children: `● Task Ledger  ${summary}` }),
        ...rows,
        Box({
          flexDirection: "row",
          flexWrap: "wrap",
          columnGap: 2,
          children: [
            ...(selectableIds.length > 0
              ? WORKFLOW_HOTKEYS.map(({ action, label, hotkey }) => Button({
                key: `tl-band-${action}`,
                label,
                hotkey,
                plain: true,
                dimColor: true,
                onPress: () => startBandWorkflow($, selectableIds, action),
              }))
              : []),
            Text({ dimColor: true, children: "ctrl+x tab to select · /tl-board · /tl-toggle" }),
          ],
        }),
      ],
    });
    return Box({
      flexDirection: "column",
      children: [...(downstream ? [downstream] : []), band],
    });
  });

  on("ui.render", { component: "Pane" }, async ($, e, next) => {
    if (e.requestId !== PANE_ID) return next(e);
    const { Box, Text, Button } = $.ui.resolve(e);
    const redraw = () => $.ui.invalidate("ui.render");

    if (boardLoading) {
      return Box({ padding: 1, children: [Text({ color: "yellow", children: "Loading TaskLedger…" })] });
    }

    if (boardError) {
      return Box({
        flexDirection: "column",
        padding: 1,
        rowGap: 1,
        children: [
          Text({ color: "red", bold: true, children: "TaskLedger unavailable" }),
          Text({ wrap: "wrap", children: boardError }),
          Button({ key: "retry", label: "u: Retry", hotkey: "u", onPress: async () => loadBoard($) }),
        ],
      });
    }

    if (boardMode === "details" && detailsTask) {
      const id = taskId(detailsTask);
      const action = (workflow: WorkflowAction) => async () => {
        if (!id) return;
        await $.ui.close({ id: PANE_ID });
        void $.prompt.submit({ text: buildTaskWorkflowPrompt(id, workflow) });
      };
      return Box({
        flexDirection: "column",
        padding: 1,
        rowGap: 1,
        children: [
          Text({ color: "cyan", bold: true, children: taskLabel(detailsTask) }),
          Text({ color: detailsLoading ? "yellow" : undefined, wrap: "wrap", children: detailsText || "No task details." }),
          Box({
            flexDirection: "row",
            flexWrap: "wrap",
            columnGap: 2,
            children: [
              Button({ key: "back", label: "Back", hotkey: "b", plain: true, autoFocus: true, onPress: () => {
                boardMode = "list";
                redraw();
              } }),
              Button({ key: "implement", label: "Implement", hotkey: "i", plain: true, onPress: action("implement") }),
              Button({ key: "refine", label: "Refine", hotkey: "r", plain: true, onPress: action("refine") }),
              Button({ key: "review", label: "Review", hotkey: "v", plain: true, onPress: action("review") }),
              Button({ key: "plan", label: "Plan", hotkey: "p", plain: true, onPress: action("plan") }),
              ...(id ? [
                Button({ key: "cancel", label: "Cancel task", hotkey: "c", plain: true, onPress: async () => lifecycleTask($, "cancel", id) }),
                Button({ key: "remove", label: "Remove task", hotkey: "x", plain: true, onPress: async () => lifecycleTask($, "remove", id) }),
              ] : []),
            ],
          }),
        ],
      });
    }

    const visibleSections = focusedSections(sections, showAll);
    const taskCount = visibleSections.reduce((sum, section) => sum + section.tasks.length, 0);
    let firstTask = true;
    const sectionTrees = visibleSections.flatMap((section) => {
      if (section.tasks.length === 0) return [];
      const buttons = section.tasks.flatMap((task) => {
        const id = taskId(task);
        if (!id) return [];
        const autofocus = firstTask;
        firstTask = false;
        return [Button({
          key: `task-${id}`,
          label: taskLabel(task, section.icon),
          plain: true,
          dimColor: section.label === "Done" || section.label === "Cancelled",
          ...(autofocus ? { autoFocus: true as const } : {}),
          onPress: async () => showTaskDetails($, task),
        })];
      });
      return [
        Text({ color: section.color, bold: true, children: `${section.icon} ${section.label} (${section.tasks.length})` }),
        ...buttons,
      ];
    });

    return Box({
      flexDirection: "column",
      padding: 1,
      rowGap: 1,
      children: [
        Text({ color: "cyan", bold: true, children: `Task Ledger Board · ${taskCount} ${showAll ? "total" : "focused"}` }),
        Box({
          flexDirection: "row",
          columnGap: 2,
          children: [
            Button({ key: "toggle-all", label: showAll ? "Focused" : "Show all", hotkey: "a", plain: true, onPress: () => {
              showAll = !showAll;
              redraw();
            } }),
            Button({ key: "refresh", label: "Refresh", hotkey: "u", plain: true, onPress: async () => loadBoard($) }),
          ],
        }),
        ...(sectionTrees.length > 0 ? sectionTrees : [Text({ dimColor: true, children: "No tasks in this view." })]),
        Text({ dimColor: true, children: "↑/↓ navigate · Enter select · Esc close" }),
      ],
    });
  });
};

async function registerCommands($: EngineInterface): Promise<void> {
  const commands = [
    { name: "tl-board", description: "Open the interactive TaskLedger board", immediate: true },
    { name: "tl-refresh", description: "Refresh TaskLedger data", immediate: true },
    { name: "tl-toggle", description: "Hide or show the TaskLedger summary", immediate: true },
    { name: "tl-init", description: "Initialize TaskLedger in this repository", immediate: true },
    { name: "tl-capture", description: "Capture rough todos and ask Claude to refine them", argumentHint: "<rough todos>" },
    { name: "tl-triage", description: "Ask Claude to triage the task ledger" },
  ] as const;
  for (const command of commands) {
    try {
      await $.command.register(command);
    } catch (error) {
      $.ui.log(`Could not register /${command.name}: ${messageOf(error)}`, { to: "debug" });
    }
  }
}

async function runTl($: EngineInterface, args: string[], timeoutMs = 30_000): Promise<ProcessRunResult> {
  return $.process.run(["tl", "--color", "never", ...args], { timeoutMs });
}

async function probeEnvironment($: EngineInterface, requireLedger = true): Promise<EnvironmentState> {
  let versionRun: ProcessRunResult;
  try {
    versionRun = await runTl($, ["--version"], 2_000);
  } catch {
    return { kind: "not-found" };
  }
  if (versionRun.exitCode !== 0) return { kind: "not-found" };

  const version = parseTlVersion(versionRun.stdout);
  if (!version || !isTlVersionCompatible(version)) return { kind: "incompatible", version };
  if (requireLedger && !(await $.fs.exists(".tl"))) return { kind: "no-ledger" };
  return { kind: "ready", version };
}

async function listTasks($: EngineInterface, args: string[]): Promise<TaskSummary[]> {
  const run = await runTl($, args, 10_000);
  const command = `tl ${args.join(" ")}`;
  if (run.exitCode !== 0) throw new Error(run.stderr.trim() || run.stdout.trim() || `${command} failed with exit code ${run.exitCode}`);
  if (run.isStdoutTruncated) throw new Error(`${command} output exceeded the process output limit`);
  return tasksFromJson(run.stdout, command);
}

async function refreshSummary($: EngineInterface): Promise<void> {
  const serial = ++refreshSerial;
  try {
    const nextEnvironment = await probeEnvironment($);
    if (serial !== refreshSerial) return;
    environment = nextEnvironment;
    if (nextEnvironment.kind !== "ready") {
      snapshot = EMPTY_SNAPSHOT;
      updateStatus($);
      $.ui.invalidate("ui.render");
      return;
    }

    const [ready, inProgress, blocked, pendingHuman, stale] = await Promise.all([
      listTasks($, ["ready", "--json"]),
      listTasks($, ["list", "--status", "in_progress", "--json"]),
      listTasks($, ["list", "--status", "blocked", "--json"]),
      listTasks($, ["list", "--status", "pending_human", "--json"]),
      listTasks($, ["stale", "--json"]),
    ]);
    if (serial !== refreshSerial) return;
    snapshot = { ready, inProgress, blocked, pendingHuman, stale };
    updateStatus($);
  } catch (error) {
    if (serial !== refreshSerial) return;
    environment = { kind: "error", message: messageOf(error) };
    snapshot = EMPTY_SNAPSHOT;
    updateStatus($);
  }
  $.ui.invalidate("ui.render");
}

async function loadBoard($: EngineInterface): Promise<void> {
  boardLoading = true;
  boardError = null;
  $.ui.invalidate("ui.render");
  try {
    const [inventory, ready, stale] = await Promise.all([
      listTasks($, ["list", "--all", "--json"]),
      listTasks($, ["ready", "--json"]),
      listTasks($, ["stale", "--json"]),
    ]);
    sections = boardSections(inventory, ready, stale);
  } catch (error) {
    boardError = messageOf(error);
  } finally {
    boardLoading = false;
    $.ui.invalidate("ui.render");
  }
}

async function openBoard($: EngineInterface, task?: TaskSummary): Promise<void> {
  await loadBoard($);
  boardMode = "list";
  showAll = prefersAllView(sections);
  if (task) await showTaskDetails($, task);
  await $.ui.open({
    id: PANE_ID,
    title: PANE_TITLE,
    focus: true,
    closeOnEscape: true,
    holdToasts: true,
    rows: 24,
    columns: 76,
  });
}

async function openBoardFromBand($: EngineInterface, task: TaskSummary): Promise<void> {
  try {
    await openBoard($, task);
  } catch (error) {
    $.ui.toast(`Could not open the board: ${messageOf(error)}`);
  }
}

// The band's workflow hotkeys act on the row last focused with ctrl+x tab and the arrows, else the first row.
function startBandWorkflow($: EngineInterface, selectableIds: readonly string[], action: WorkflowAction): void {
  const id = bandSelectedId && selectableIds.includes(bandSelectedId) ? bandSelectedId : selectableIds[0];
  if (!id) return;
  $.prompt.submit({ text: buildTaskWorkflowPrompt(id, action) }).catch((error) => $.ui.toast(`Could not submit prompt: ${messageOf(error)}`));
}

async function showTaskDetails($: EngineInterface, task: TaskSummary): Promise<void> {
  const id = taskId(task);
  if (!id) return;
  detailsTask = task;
  detailsLoading = true;
  detailsText = "Loading task details…";
  boardMode = "details";
  $.ui.invalidate("ui.render");
  try {
    const run = await runTl($, ["show", id]);
    detailsText = run.stdout.trim() || run.stderr.trim() || `tl show ${id} exited with ${run.exitCode}`;
  } catch (error) {
    detailsText = messageOf(error);
  } finally {
    detailsLoading = false;
    $.ui.invalidate("ui.render");
  }
}

async function lifecycleTask($: EngineInterface, action: "cancel" | "remove", id: string): Promise<void> {
  const verb = action === "cancel" ? "Cancel" : "Remove permanently";
  const answer = await askSafely($, `${verb} ${id}?`, [verb, "Keep task"]);
  if (answer !== verb) return;
  const reasonAnswer = await askSafely($, `Why ${action} ${id}: use the default reason, or type your own under Other?`, ["Use default reason", "Keep task"]);
  if (!reasonAnswer || reasonAnswer === "Keep task") return;
  const defaultReason = action === "cancel" ? "cancelled from Claude TaskLedger board" : "removed from Claude TaskLedger board";
  const reason = reasonAnswer === "Use default reason" ? defaultReason : reasonAnswer.trim() || defaultReason;
  const args = [action, id, "--message", reason];
  if (action === "remove") args.push("--force");
  try {
    const run = await runTl($, args);
    if (run.exitCode !== 0) {
      $.ui.toast(run.stderr.trim() || `${verb} failed for ${id}.`);
      return;
    }
    boardMode = "list";
    detailsTask = null;
    $.ui.toast(`${action === "cancel" ? "Cancelled" : "Removed"} ${id}.`);
    await Promise.all([loadBoard($), refreshSummary($)]);
  } catch (error) {
    $.ui.toast(`${verb} failed: ${messageOf(error)}`);
  }
}

// A command.run hook holds the turn that a prompt submitted from it would wait on, so submit once it returns.
function submitAfterCommand($: EngineInterface, text: string): void {
  $.clock.after(0, () => {
    $.prompt.submit({ text }).catch((error) => $.ui.toast(`Could not submit prompt: ${messageOf(error)}`));
  });
}

async function askSafely($: EngineInterface, question: string, options?: readonly string[]): Promise<string | null> {
  try {
    return await $.ui.ask(question, options);
  } catch {
    return null;
  }
}

function updateStatus($: EngineInterface): void {
  if (environment.kind === "not-found") $.ui.status("tl CLI not found");
  else if (environment.kind === "incompatible") $.ui.status(`tl ${environment.version ?? "version unknown"} is incompatible; need ${MIN_TL_VERSION}+`);
  else if (environment.kind === "error") $.ui.status(`tl error: ${environment.message}`);
  else $.ui.status(undefined);
}

function environmentMessage(state: EnvironmentState): string {
  if (state.kind === "not-found") return "The tl CLI is not available on PATH.";
  if (state.kind === "incompatible") return `The installed tl version (${state.version ?? "unknown"}) is incompatible; ${MIN_TL_VERSION}+ is required.`;
  if (state.kind === "no-ledger") return "No task ledger found in this repository. Run /tl-init first.";
  if (state.kind === "error") return `TaskLedger error: ${state.message}`;
  if (state.kind === "loading") return "TaskLedger is still loading.";
  return `TaskLedger ${state.version} is ready.`;
}

function summaryMessage(): string {
  if (environment.kind !== "ready") return environmentMessage(environment);
  const parts = snapshotSections(snapshot)
    .filter((section) => section.tasks.length > 0)
    .map((section) => `${section.tasks.length} ${section.label.toLowerCase()}`);
  return parts.length > 0 ? `TaskLedger refreshed: ${parts.join(", ")}.` : "TaskLedger refreshed: no actionable tasks.";
}

function prefersAllView(value: TaskSection[]): boolean {
  const focusedCount = focusedSections(value, false).reduce((sum, section) => sum + section.tasks.length, 0);
  const allCount = value.reduce((sum, section) => sum + section.tasks.length, 0);
  return focusedCount <= 1 && allCount > focusedCount;
}

function hasSnapshotContent(value: Snapshot): boolean {
  return snapshotSections(value).some((section) => section.tasks.length > 0);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
