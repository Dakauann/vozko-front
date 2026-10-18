import type { JoinTask } from "./types";

interface ScheduledJoin {
  instanceId: string;
  at: Date;
}

interface JoinPlan {
  planId: string;
  inviteLink: string;
  follow: boolean;
  createdAt: string;
  tasks: JoinTask[];
  active: boolean;
  cancellable: boolean;
}

const MINUTE_MS = 60_000;

export function joinSchedule(instanceIds: string[], start: Date, spacingMinutes: number): ScheduledJoin[] {
  return instanceIds.map((instanceId, index) => ({
    instanceId,
    at: new Date(start.getTime() + index * spacingMinutes * MINUTE_MS),
  }));
}

export function defaultJoinNumbers(numbers: { id: string; sessionLive: boolean }[], alreadyIn: string[]): string[] {
  const inside = new Set(alreadyIn);
  return numbers.filter((number) => number.sessionLive && !inside.has(number.id)).map((number) => number.id);
}

function moving(task: JoinTask): boolean {
  return task.status === "pending" || task.status === "running";
}

export function hasMovingJoins(tasks: JoinTask[]): boolean {
  return tasks.some(moving);
}

export function groupJoinPlans(tasks: JoinTask[]): JoinPlan[] {
  const byPlan = new Map<string, JoinTask[]>();
  for (const task of tasks) {
    const list = byPlan.get(task.planId) ?? [];
    list.push(task);
    byPlan.set(task.planId, list);
  }
  const plans = [...byPlan.entries()].map(([planId, list]) => {
    const ordered = [...list].sort((a, b) => a.sequence - b.sequence);
    const anchor = ordered[0];
    return {
      planId,
      inviteLink: anchor.inviteLink,
      follow: anchor.follow,
      createdAt: ordered.reduce((earliest, item) => (item.createdAt < earliest ? item.createdAt : earliest), anchor.createdAt),
      tasks: ordered,
      active: ordered.some(moving),
      cancellable: ordered.some((item) => item.status === "pending"),
    };
  });
  return plans.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

export type JoinPlanOutcome = "inProgress" | "failed" | "cancelled" | "done";

export function planOutcome(plan: Pick<JoinPlan, "tasks">): JoinPlanOutcome {
  if (plan.tasks.some(moving)) return "inProgress";
  if (plan.tasks.some((task) => task.status === "failed")) return "failed";
  if (plan.tasks.every((task) => task.status === "cancelled")) return "cancelled";
  return "done";
}

export function doneJoins(tasks: JoinTask[]): number {
  return tasks.filter((task) => task.status === "done").length;
}

export function inviteCode(inviteLink: string): string {
  const trimmed = inviteLink.trim().replace(/\/+$/, "");
  const slash = trimmed.lastIndexOf("/");
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

function needsWatching(task: JoinTask): boolean {
  return moving(task) || task.status === "failed";
}

export function plansToWatch(plans: JoinPlan[]): JoinPlan[] {
  return plans.filter((plan) => plan.tasks.some(needsWatching));
}

export function planProgress(plan: Pick<JoinPlan, "tasks">): { done: number; total: number } {
  return { done: doneJoins(plan.tasks), total: plan.tasks.length };
}

export function nextDueAt(plan: Pick<JoinPlan, "tasks">): string | undefined {
  return plan.tasks
    .filter(moving)
    .map((task) => task.dueAt)
    .reduce<string | undefined>((earliest, dueAt) => (earliest === undefined || Date.parse(dueAt) < Date.parse(earliest) ? dueAt : earliest), undefined);
}

export function planAttempts(plan: Pick<JoinPlan, "tasks">): { attempts: number; error: string | undefined } {
  const attempts = plan.tasks.reduce((sum, task) => sum + task.attempts, 0);
  const failing = plan.tasks
    .filter((task) => task.status !== "done" && task.error)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return { attempts, error: failing[0]?.error };
}
