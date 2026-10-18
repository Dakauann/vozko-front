import { describe, expect, it } from "vitest";

import type { JoinStatus, JoinTask } from "./types";

import {
  defaultJoinNumbers,
  doneJoins,
  groupJoinPlans,
  hasMovingJoins,
  inviteCode,
  joinSchedule,
  nextDueAt,
  planAttempts,
  planProgress,
  plansToWatch,
  planOutcome,
} from "./join-plan";

function task(id: string, planId: string, sequence: number, status: JoinStatus, createdAt = "2026-10-17T10:00:00Z"): JoinTask {
  return {
    id,
    planId,
    workspaceId: "w",
    instanceId: `n-${id}`,
    inviteLink: "https://chat.whatsapp.com/AbC123",
    sequence,
    follow: true,
    status,
    attempts: 0,
    dueAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  };
}

describe("joinSchedule", () => {
  it("joins the first number now and spaces the next ones", () => {
    const start = new Date("2026-10-17T12:00:00Z");
    expect(joinSchedule(["a", "b", "c"], start, 10)).toEqual([
      { instanceId: "a", at: new Date("2026-10-17T12:00:00Z") },
      { instanceId: "b", at: new Date("2026-10-17T12:10:00Z") },
      { instanceId: "c", at: new Date("2026-10-17T12:20:00Z") },
    ]);
  });
});

describe("defaultJoinNumbers", () => {
  it("picks every connected number that is not in the group yet", () => {
    const numbers = [
      { id: "a", sessionLive: true },
      { id: "b", sessionLive: false },
      { id: "c", sessionLive: true },
    ];
    expect(defaultJoinNumbers(numbers, ["c"])).toEqual(["a"]);
  });
});

describe("groupJoinPlans", () => {
  it("groups tasks by plan, in sequence, active plans first then newest", () => {
    const tasks = [
      task("1", "old", 0, "done", "2026-10-16T10:00:00Z"),
      task("2", "new", 1, "pending", "2026-10-17T09:00:00Z"),
      task("3", "new", 0, "done", "2026-10-17T09:00:00Z"),
      task("4", "newest", 0, "failed", "2026-10-17T11:00:00Z"),
    ];
    const plans = groupJoinPlans(tasks);
    expect(plans.map((plan) => plan.planId)).toEqual(["new", "newest", "old"]);
    expect(plans[0].tasks.map((item) => item.id)).toEqual(["3", "2"]);
    expect(plans[0].cancellable).toBe(true);
    expect(plans[1].cancellable).toBe(false);
  });
});

describe("hasMovingJoins", () => {
  it("is true only while some task is pending or running", () => {
    expect(hasMovingJoins([task("1", "p", 0, "done"), task("2", "p", 1, "running")])).toBe(true);
    expect(hasMovingJoins([task("1", "p", 0, "done"), task("2", "p", 1, "cancelled")])).toBe(false);
  });
});

describe("planOutcome", () => {
  it.each([
    [["done", "pending"], "inProgress"],
    [["done", "running"], "inProgress"],
    [["done", "failed"], "failed"],
    [["cancelled", "cancelled"], "cancelled"],
    [["done", "cancelled"], "done"],
    [["done"], "done"],
  ] as [JoinStatus[], string][])("reads %j as %s", (statuses, outcome) => {
    expect(planOutcome({ tasks: statuses.map((status, index) => task(String(index), "p", index, status)) })).toBe(outcome);
  });
});

describe("doneJoins", () => {
  it("counts the numbers that already joined", () => {
    expect(doneJoins([task("1", "p", 0, "done"), task("2", "p", 1, "pending"), task("3", "q", 0, "done")])).toBe(2);
  });
});

describe("inviteCode", () => {
  it("shows the code of a normalised invite link", () => {
    expect(inviteCode("https://chat.whatsapp.com/AbC123")).toBe("AbC123");
    expect(inviteCode("AbC123")).toBe("AbC123");
  });
});

describe("plansToWatch", () => {
  it("keeps only the plans with a pending, running or failed join", () => {
    const plans = groupJoinPlans([
      task("1", "done", 0, "done"),
      task("2", "waiting", 0, "pending"),
      task("3", "broken", 0, "done"),
      task("4", "broken", 1, "failed"),
      task("5", "dropped", 0, "cancelled"),
    ]);
    expect(plansToWatch(plans).map((plan) => plan.planId).sort()).toEqual(["broken", "waiting"]);
  });
});

describe("planProgress", () => {
  it("counts joined numbers against every number of the plan", () => {
    const [plan] = groupJoinPlans([task("1", "p", 0, "done"), task("2", "p", 1, "pending"), task("3", "p", 2, "cancelled")]);
    expect(planProgress(plan)).toEqual({ done: 1, total: 3 });
  });
});

describe("nextDueAt", () => {
  it("is the earliest due time among the joins still waiting", () => {
    const later = { ...task("2", "p", 2, "pending"), dueAt: "2026-10-17T12:20:00Z" };
    const sooner = { ...task("3", "p", 1, "running"), dueAt: "2026-10-17T12:10:00Z" };
    const [plan] = groupJoinPlans([task("1", "p", 0, "done"), later, sooner]);
    expect(nextDueAt(plan)).toBe("2026-10-17T12:10:00Z");
  });

  it("is undefined when nothing waits", () => {
    const [plan] = groupJoinPlans([task("1", "p", 0, "done"), task("2", "p", 1, "failed")]);
    expect(nextDueAt(plan)).toBeUndefined();
  });
});

describe("planAttempts", () => {
  it("adds up the attempts and keeps the last error of the plan", () => {
    const first = { ...task("1", "p", 0, "failed"), attempts: 3, error: "instance is not connected", updatedAt: "2026-10-17T10:05:00Z" };
    const second = { ...task("2", "p", 1, "failed"), attempts: 1, error: "currently restricting", updatedAt: "2026-10-17T10:20:00Z" };
    const third = { ...task("3", "p", 2, "done"), attempts: 1, error: "old", updatedAt: "2026-10-17T10:30:00Z" };
    const [plan] = groupJoinPlans([first, second, third]);
    expect(planAttempts(plan)).toEqual({ attempts: 5, error: "currently restricting" });
  });

  it("has no error when every join went through", () => {
    const [plan] = groupJoinPlans([{ ...task("1", "p", 0, "done"), attempts: 1 }]);
    expect(planAttempts(plan)).toEqual({ attempts: 1, error: undefined });
  });
});
