import type { CommandRunInput, On, ProcessRunResult, RenderInput, SessionStartInput } from "claude-code";
import { expect, mock, test } from "claude-code/testing";

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

function command(name: string, args = ""): CommandRunInput {
  return {
    command: name,
    args,
    origin: { kind: "composer" },
    presentation: { isFullscreen: true, columns: 100 },
  };
}

function output(stdout: string): { value: ProcessRunResult } {
  return { value: { exitCode: 0, stdout, stderr: "", isStdoutTruncated: false, isStderrTruncated: false } };
}

function installHost(on: On, options: { hasLedger?: boolean; answers?: Record<string, string> } = {}) {
  const registered: string[] = [];
  const runs: string[][] = [];
  const submitted: string[] = [];
  const hasLedger = options.hasLedger ?? true;
  const answers = { "Initialize TaskLedger in this repository?": "Initialize", ...options.answers };

  on("session.start", ($, e) => ({ cwd: e.cwd }));
  on("command.register", ($, e) => {
    registered.push(e.name);
    return { value: { command: e.name } };
  });
  on("fs.exists", () => ({ value: hasLedger }));
  on("tool.call", { tool: "AskUserQuestion" }, () => ({ result: { answers } }));
  on("prompt.submit", ($, e) => {
    submitted.push(e.text);
    return { drop: "captured by the test host" };
  });
  on("ui.status", () => ({ value: undefined }));
  on("ui.open", () => ({ value: { isPlaced: true } }));
  on("ui.close", () => ({ value: undefined }));
  on("ui.toast", () => ({ value: undefined }));
  on("ui.render", { component: "AbovePrompt" }, ($, e) => {
    const { Text } = $.ui.resolve(e);
    return Text({ children: "" });
  });
  on("process.run", ($, e) => {
    const args = [...e.argv];
    runs.push(args);
    const words = args.slice(3).join(" ");
    if (args.at(-1) === "--version") {
      return output("tl version 0.12.0-0-bcda3fc\n");
    }
    if (words === "ready --json") {
      return output(JSON.stringify([{ id: "task-ready", title: "Ship the mod", status: "open", priority: "high" }]));
    }
    if (words === "list --status in_progress --json") {
      return output(JSON.stringify([{ id: "task-active", title: "Write tests", status: "in_progress", priority: "medium" }]));
    }
    if (words === "stale --json") {
      return output("null\n");
    }
    if (words === "list --all --json") {
      return output(JSON.stringify([
        { id: "task-ready", title: "Ship the mod", status: "open", priority: "high" },
        { id: "task-active", title: "Write tests", status: "in_progress", priority: "medium" },
      ]));
    }
    return output("[]");
  });

  return { registered, runs, submitted };
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
  await $.command.run(command("tl-board"));

  const rendered = JSON.stringify(await $.ui.render(PANE));
  expect(rendered).toContain("Task Ledger Board");
  expect(rendered).toContain("task-ready");
  expect(rendered).toContain("task-active");
  expect(rendered).toContain("Show all");
});

test("initializes a repository that does not yet have a ledger", async ($, on) => {
  const host = installHost(on, { hasLedger: false });
  await $.session.start(SESSION);
  await $.command.run(command("tl-init"));

  expect(host.runs.some((argv) => argv.at(-1) === "init")).toBe(true);
});

test("asks for todos instead of capturing a dialog's padding answer", async ($, on) => {
  const host = installHost(on);
  const clock = mock.clock(on);
  await $.session.start(SESSION);

  const empty = await $.command.run(command("tl-capture"));
  expect(empty.text).toContain("Usage: /tl-capture");
  expect(host.submitted).toEqual([]);

  await $.command.run(command("tl-capture", "fix login; write docs"));
  await clock.advance(0);
  expect(host.submitted).toHaveLength(1);
  expect(host.submitted[0]).toContain("fix login; write docs");
});

test("cancels a task from the board with the default reason", async ($, on) => {
  const host = installHost(on, {
    answers: {
      "Cancel task-ready?": "Cancel",
      "Why cancel task-ready: use the default reason, or type your own under Other?": "Use default reason",
    },
  });
  await $.session.start(SESSION);
  await $.command.run(command("tl-board"));

  const ui = await $.ui.mount({ plugin: "tl", ...PANE });
  await ui.press({ key: "task-task-ready" });
  await ui.press({ key: "cancel" });

  expect(host.runs).toContainEqual(["tl", "--color", "never", "cancel", "task-ready", "--message", "cancelled from Claude TaskLedger board"]);
  await ui.unmount();
});
