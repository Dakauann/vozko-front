import { groupPositions, type GroupMember, type GroupPosition } from "@/lib/chat/message-groups";
import type { ConversationMessage } from "@/lib/conversations/types";

import type { SimEvent, SimPause, SimStep } from "./sim-session";

export type SimTimelineItem =
  | { kind: "steps"; key: string; steps: SimStep[]; durationMs: number }
  | { kind: "step"; key: string; step: SimStep; compact: boolean }
  | { kind: "event"; key: string; event: Exclude<SimEvent, { type: "step" }> };

type PausePoint = Pick<SimPause, "nodeId" | "stepIndex">;

const SMALLEST_GROUP = 2;

const PROMINENT_STATUSES: ReadonlySet<string> = new Set(["failed", "waiting", "paused"]);

function staysVisible(step: SimStep, pause: PausePoint | null): boolean {
  if (PROMINENT_STATUSES.has(step.status)) return true;
  return pause !== null && step.nodeId === pause.nodeId && step.stepIndex === pause.stepIndex;
}

export function simTimeline(events: readonly SimEvent[], firstIndex: number, pause: PausePoint | null): SimTimelineItem[] {
  const items: SimTimelineItem[] = [];
  let group: Extract<SimTimelineItem, { kind: "steps" }> | null = null;
  events.forEach((event, offset) => {
    const index = firstIndex + offset;
    if (event.type !== "step") {
      group = null;
      items.push({ kind: "event", key: `event:${index}`, event });
      return;
    }
    if (staysVisible(event.step, pause)) {
      group = null;
      items.push({ kind: "step", key: `step:${index}`, step: event.step, compact: false });
      return;
    }
    if (!group) {
      group = { kind: "steps", key: `steps:${index}`, steps: [], durationMs: 0 };
      items.push(group);
    }
    group.steps.push(event.step);
    group.durationMs += event.step.durationMs ?? 0;
  });
  return items.map(unfoldLoneStep);
}

function unfoldLoneStep(item: SimTimelineItem): SimTimelineItem {
  if (item.kind !== "steps" || item.steps.length >= SMALLEST_GROUP) return item;
  return { kind: "step", key: item.key, step: item.steps[0], compact: true };
}

function messageOf(item: SimTimelineItem): ConversationMessage | null {
  return item.kind === "event" && item.event.type === "message" ? (item.event.message ?? null) : null;
}

export function simTimelineGroups(items: readonly SimTimelineItem[], memberOf: (message: ConversationMessage) => GroupMember): Map<string, GroupPosition> {
  const positions = groupPositions(items.map((item) => {
    const message = messageOf(item);
    return message ? memberOf(message) : null;
  }));
  return new Map(items.flatMap((item, index): Array<[string, GroupPosition]> => {
    const position = positions[index];
    return position ? [[item.key, position]] : [];
  }));
}
