import { describe, expect, test } from "claude-code/testing";
import {
  boardSections,
  isTlVersionCompatible,
  parseTlVersion,
  tasksFromJson,
} from "../hooks/model";

describe("TaskLedger model", () => {
  test("parses stable and git-build versions", () => {
    expect(parseTlVersion("tl version 0.12.0-0-bcda3fc")).toBe("0.12.0-0-bcda3fc");
    expect(isTlVersionCompatible("0.9.0")).toBe(true);
    expect(isTlVersionCompatible("0.12.0-0-bcda3fc")).toBe(true);
    expect(isTlVersionCompatible("0.9.0-rc.1")).toBe(false);
    expect(isTlVersionCompatible("0.8.9")).toBe(false);
  });

  test("rejects non-list JSON", () => {
    expect(() => tasksFromJson("{}", "tl ready --json")).toThrow("not a task list");
  });

  test("places each inventory task in one authoritative board section", () => {
    const inventory = [
      { id: "ready", title: "Ready", status: "open" },
      { id: "waiting", title: "Waiting", status: "open" },
      { id: "stale", title: "Stale", status: "in_progress" },
      { id: "done", title: "Done", status: "done" },
    ];
    const sections = boardSections(inventory, [inventory[0]], [inventory[2]]);
    const ids = (label: string) => sections.find((section) => section.label === label)?.tasks.map((task) => task.id);

    expect(ids("Ready")).toEqual(["ready"]);
    expect(ids("Waiting")).toEqual(["waiting"]);
    expect(ids("Stale claims")).toEqual(["stale"]);
    expect(ids("Done")).toEqual(["done"]);
    expect(sections.flatMap((section) => section.tasks)).toHaveLength(4);
  });
});
