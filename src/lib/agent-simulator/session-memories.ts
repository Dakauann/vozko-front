import type { SessionMemory, SimulatedToolCall } from "@/lib/agent-simulator/types";

/**
 * Folds a turn's intercepted manage_lead_memory calls into the session's
 * temporary memory list. Nothing persisted server-side (the sandbox swallowed
 * the calls), so this client-held list is what the next turn replays; the
 * backend renders it through the same block real memories use, which is what
 * makes the READ half of the memory loop debuggable in the simulator.
 *
 * Ids are stable (`sim00001`, ...) and exactly 8 chars: the length the prompt
 * block renders, so the model's update/forget targets match without prefix
 * games. A forget never renumbers survivors.
 */
export function foldSessionMemories(
    previous: SessionMemory[],
    toolCalls: SimulatedToolCall[],
): SessionMemory[] {
    let next = previous;
    let counter = nextCounter(previous);

    for (const call of toolCalls) {
        if (call.name !== "manage_lead_memory" || call.isError) continue;
        const action = stringArg(call, "action");
        const content = stringArg(call, "content").trim();
        const category = stringArg(call, "category").trim().toLowerCase();
        const ref = stringArg(call, "memory_id").trim().toLowerCase();

        if (action === "remember" && content !== "") {
            // Mirror the real tool's dedup: an equivalent fact updates nothing.
            const norm = normalize(content);
            if (!next.some((m) => normalize(m.content) === norm)) {
                next = [...next, { id: `sim${String(counter++).padStart(5, "0")}`, content, category }];
            }
        } else if (action === "update" && ref !== "") {
            next = next.map((m) =>
                matches(m.id, ref)
                    ? {
                          ...m,
                          content: content !== "" ? content : m.content,
                          category: category !== "" ? category : m.category,
                      }
                    : m,
            );
        } else if (action === "forget" && ref !== "") {
            next = next.filter((m) => !matches(m.id, ref));
        }
    }
    return next;
}

function nextCounter(memories: SessionMemory[]): number {
    let max = 0;
    for (const m of memories) {
        const parsed = Number.parseInt(m.id.replace(/^sim/, ""), 10);
        if (Number.isFinite(parsed) && parsed > max) max = parsed;
    }
    return max + 1;
}

function stringArg(call: SimulatedToolCall, key: string): string {
    const value = call.arguments?.[key];
    return typeof value === "string" ? value : "";
}

function normalize(s: string): string {
    return s.toLowerCase().split(/\s+/).join(" ").trim();
}

/** The model may echo the rendered 8-char id or something longer; match either way. */
function matches(id: string, ref: string): boolean {
    return id === ref || id.startsWith(ref) || ref.startsWith(id);
}
