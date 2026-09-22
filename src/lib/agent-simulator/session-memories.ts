import type { SessionMemory, SimulatedToolCall } from "@/lib/agent-simulator/types";

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

function matches(id: string, ref: string): boolean {
    return id === ref || id.startsWith(ref) || ref.startsWith(id);
}
