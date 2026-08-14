import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { Agent } from "@/lib/agents/types";
import { NextIntlClientProvider } from "next-intl";
import type { SimulateTurnResponse } from "@/lib/agent-simulator/types";
import SimulatorClient from "./SimulatorClient";
import ptMessages from "@/i18n/messages/pt.json";

const simulateAction = vi.fn();
const listLeads = vi.fn();

vi.mock("@/app/actions/agent-simulator", () => ({
    simulateAgentTurnAction: (...args: unknown[]) => simulateAction(...args),
}));
vi.mock("@/app/actions/leads", () => ({
    listLeadsAction: (...args: unknown[]) => listLeads(...args),
}));

const agent: Agent = {
    id: "agent-1",
    name: "Bia",
    messagingModel: "test/model",
} as Agent;

function turnResponse(overrides: Partial<SimulateTurnResponse> = {}): SimulateTurnResponse {
    return {
        replies: ["Oi!", "Como posso ajudar?"],
        toolCalls: [
            {
                name: "manage_lead_memory",
                arguments: { action: "remember", content: "Prefere boleto." },
                result: "(SIMULAÇÃO) considere concluída.",
                isError: false,
            },
        ],
        debug: {
            model: "test/model",
            systemPrompt: "PROMPT-MONTADO",
            toolNames: ["manage_lead_memory"],
            memoryInjected: true,
            ragInjected: false,
            promptTokens: 120,
            completionTokens: 40,
            finishReason: "stop",
        },
        ...overrides,
    };
}

function renderSimulator() {
    return render(
        <NextIntlClientProvider locale="pt" messages={ptMessages}>
            <SimulatorClient
                agent={agent}
                toolCatalog={[
                    {
                        name: "manage_lead_memory",
                        displayName: "Memória do lead",
                        description: "",
                        displayDescription: "",
                        parameters: {},
                        required: null,
                        visibility: ["messaging"],
                        category: "agent_utility",
                    } as never,
                ]}
            />
        </NextIntlClientProvider>,
    );
}

const t = ptMessages.agentSimulator;

async function sendMessage(text: string) {
    fireEvent.change(screen.getByPlaceholderText(t.composerPlaceholder), {
        target: { value: text },
    });
    fireEvent.click(screen.getByLabelText(t.send));
}

describe("SimulatorClient", () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        simulateAction.mockReset().mockResolvedValue({ turn: turnResponse() });
        listLeads.mockReset().mockResolvedValue({ leads: [], meta: {}, error: null });
    });

    it("opens on the empty state with the sandbox promise", () => {
        renderSimulator();
        expect(screen.getByText(t.empty.title.replace("{agent}", "Bia"))).toBeInTheDocument();
        expect(screen.getByText(t.empty.sandboxNote)).toBeInTheDocument();
    });

    it("runs a turn: user bubble, segmented agent bubbles, inline tool row", async () => {
        renderSimulator();
        await sendMessage("quanto custa?");

        expect(await screen.findByText("Oi!")).toBeInTheDocument();
        // Segments are separate bubbles: channel realism, not one blob.
        expect(screen.getByText("Como posso ajudar?")).toBeInTheDocument();
        expect(screen.getByText("quanto custa?")).toBeInTheDocument();
        // The tool call sits inline, named for humans, marked simulated.
        expect(screen.getAllByText("Memória do lead").length).toBeGreaterThan(0);
        expect(screen.getAllByText(t.tool.simulated).length).toBeGreaterThan(0);

        expect(simulateAction).toHaveBeenCalledWith("agent-1", {
            message: "quanto custa?",
            history: [],
            leadId: undefined,
            sessionMemories: [],
        });
    });

    it("replays the transcript as history on the next turn", async () => {
        renderSimulator();
        await sendMessage("oi");
        await screen.findByText("Oi!");
        await sendMessage("e o preço?");

        await waitFor(() =>
            expect(simulateAction).toHaveBeenLastCalledWith("agent-1", {
                message: "e o preço?",
                history: [
                    { role: "user", content: "oi" },
                    { role: "assistant", content: "Oi!" },
                    { role: "assistant", content: "Como posso ajudar?" },
                ],
                leadId: undefined,
                // The remembered fact from turn 1 rides into turn 2: the
                // sandbox swallowed the write, the session replays it.
                sessionMemories: [
                    { id: "sim00001", content: "Prefere boleto.", category: "" },
                ],
            }),
        );
    });

    it("surfaces the provider error verbatim and retries the same line", async () => {
        simulateAction.mockResolvedValueOnce({ turn: null, error: "model deprecated: use x" });
        renderSimulator();
        await sendMessage("oi");

        // The provider's own words ARE the diagnostic this page exists for.
        expect(await screen.findByText("model deprecated: use x")).toBeInTheDocument();

        fireEvent.click(screen.getByText(t.retry));
        await waitFor(() => expect(simulateAction).toHaveBeenCalledTimes(2));
        expect(simulateAction).toHaveBeenLastCalledWith("agent-1", {
            message: "oi",
            history: [],
            leadId: undefined,
            sessionMemories: [],
        });
        expect(await screen.findByText("Oi!")).toBeInTheDocument();
    });

    it("shows the turn X-ray: prompt, tokens, context flags", async () => {
        renderSimulator();
        await sendMessage("oi");
        await screen.findByText("Oi!");

        // The rail renders twice (desktop inline + mobile slide-over), so text
        // queries match both copies.
        fireEvent.click(screen.getAllByText(t.rail.tabs.xray)[0]);
        expect(screen.getAllByText("PROMPT-MONTADO").length).toBeGreaterThan(0);
        expect(screen.getAllByText("120 entrada · 40 saída").length).toBeGreaterThan(0);
        expect(screen.getAllByText(t.rail.memories).length).toBeGreaterThan(0);
    });

    it("resets only after the two-step confirm", async () => {
        renderSimulator();
        await sendMessage("oi");
        await screen.findByText("Oi!");

        fireEvent.click(screen.getByText(t.reset));
        expect(screen.getByText("Oi!")).toBeInTheDocument(); // still there

        fireEvent.click(screen.getByLabelText(t.resetConfirmYes));
        await waitFor(() =>
            expect(screen.queryByText("Oi!")).not.toBeInTheDocument(),
        );
        expect(screen.getByText(t.empty.title.replace("{agent}", "Bia"))).toBeInTheDocument();
    });

    it("survives a reload through sessionStorage", async () => {
        const { unmount } = renderSimulator();
        await sendMessage("oi");
        await screen.findByText("Oi!");
        unmount();

        renderSimulator();
        expect(screen.getByText("Oi!")).toBeInTheDocument();
    });
});
