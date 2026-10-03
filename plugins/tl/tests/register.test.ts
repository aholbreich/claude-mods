import type { RenderInput, SessionStartInput } from "claude-code";
import { expect, test } from "claude-code/testing";

const SESSION: SessionStartInput = {
  surface: "terminal",
  isInteractive: true,
  cwd: "/work",
};

const ABOVE_PROMPT: RenderInput<"AbovePrompt", "terminal"> = {
  component: "AbovePrompt",
  surface: "terminal",
  requestId: "above-prompt",
  viewport: { columns: 100, rows: 40, isFullscreen: true },
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 18,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 18 },
    view: {},
  },
};

const PANE: RenderInput<"Pane", "terminal"> = {
  component: "Pane",
  surface: "terminal",
  requestId: "tl-board",
  viewport: { columns: 160, rows: 40, isFullscreen: true },
  props: {
    title: "Task Ledger",
    isFocused: true,
    bodyColumns: 76,
    placement: "dock",
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
};

function installHost(on: Parameters<Parameters<typeof test>[1]>[1], options: { hasLedger?: boolean } = {}) {
  const registered: string[] = [];
  const runs: string[][] = [];
  const hasLedger = options.hasLedger ?? true;

  on("session.start", ($, e) => ({ cwd: e.cwd }));
  on("command.register", ($, e) => {
    registered.push(e.name);
    return { value: { command: e.name } };
  });
  on("fs.exists", () => ({ value: hasLedger }));
  on("tool.call", { tool: "AskUserQuestion" }, () => ({
    result: { answers: { "Initialize TaskLedger in this repository?": "Initialize" } },
  }));
  on("ui.status", () => ({ value: undefined }));
  on("ui.invalidate", () => ({ value: undefined }));
  on("ui.open", () => ({ value: undefined }));
  on("ui.render", { component: "AbovePrompt" }, ($, e) => {
    const { Text } = $.ui.resolve(e);
    return Text({ children: "" });
  });
  on("process.run", ($, e) => {
    const args = [...e.argv];
    runs.push(args);
    const words = args.slice(3).join(" ");
    if (args.at(-1) === "--version") {
      return { value: { exitCode: 0, stdout: "tl version 0.12.0-0-bcda3fc\n", stderr: "" } };
    }
    if (words === "ready --json") {
      return { value: { exitCode: 0, stdout: JSON.stringify([{ id: "task-ready", title: "Ship the mod", status: "open", priority: "high" }]), stderr: "" } };
    }
    if (words === "list --status in_progress --json") {
      return { value: { exitCode: 0, stdout: JSON.stringify([{ id: "task-active", title: "Write tests", status: "in_progress", priority: "medium" }]), stderr: "" } };
    }
    if (words === "list --all --json") {
      return { value: { exitCode: 0, stdout: JSON.stringify([
        { id: "task-ready", title: "Ship the mod", status: "open", priority: "high" },
        { id: "task-active", title: "Write tests", status: "in_progress", priority: "medium" },
      ]), stderr: "" } };
    }
    return { value: { exitCode: 0, stdout: "[]", stderr: "" } };
  });

  return { registered, runs };
}

test("registers commands and draws the actionable summary", async ($, on) => {
  const host = installHost(on);
  await $.session.start(SESSION);

  expect(host.registered).toEqual([
    "tl-board",
    "tl-refresh",
    "tl-toggle",
    "tl-init",
    "tl-capture",
    "tl-triage",
  ]);

  const rendered = JSON.stringify(await $.ui.render(ABOVE_PROMPT));
  expect(rendered).toContain("Task Ledger");
  expect(rendered).toContain("task-ready");
  expect(rendered).toContain("Ship the mod");
  expect(rendered).toContain("task-active");
});

test("opens and draws the task board", async ($, on) => {
  installHost(on);
  await $.session.start(SESSION);
  await $.command.run({ command: "tl-board" });

  const rendered = JSON.stringify(await $.ui.render(PANE));
  expect(rendered).toContain("Task Ledger Board");
  expect(rendered).toContain("task-ready");
  expect(rendered).toContain("task-active");
  expect(rendered).toContain("Show all");
});

test("initializes a repository that does not yet have a ledger", async ($, on) => {
  const host = installHost(on, { hasLedger: false });
  await $.session.start(SESSION);
  await $.command.run({ command: "tl-init" });

  expect(host.runs.some((argv) => argv.at(-1) === "init")).toBe(true);
});
