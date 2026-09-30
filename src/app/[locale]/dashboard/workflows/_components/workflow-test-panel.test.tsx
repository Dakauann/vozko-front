import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { UseWorkflowSimulationReturn } from "@/hooks/use-workflow-simulation";

import { WorkflowTestPanel } from "./workflow-test-panel";

function simulation(overrides: Partial<UseWorkflowSimulationReturn> = {}): UseWorkflowSimulationReturn {
  return {
    status: "waiting_key",
    events: [],
    currentNodeId: null,
    stateVars: {},
    start: vi.fn(),
    sendReply: vi.fn(),
    sendKey: vi.fn(),
    cancel: vi.fn(),
    ...overrides,
  };
}

describe("WorkflowTestPanel", () => {
  it("gives voice workflows a phone keypad instead of a text box", () => {
    const sim = simulation();
    render(<WorkflowTestPanel simulation={sim} voice onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "5" }));
    expect(sim.sendKey).toHaveBeenCalledWith("5");
    expect(screen.queryByPlaceholderText("Escreva uma resposta...")).toBeNull();
  });

  it("plays the workflow's audio in the conversation", () => {
    const sim = simulation({
      events: [
        { type: "message", direction: "outbound", text: "Menu principal", msgType: "audio", messageId: "a1", audioUrl: "https://files/menu.mp3" },
      ],
    });
    const { container } = render(<WorkflowTestPanel simulation={sim} voice onClose={vi.fn()} />);
    expect(container.querySelector("audio")?.getAttribute("src")).toBe("https://files/menu.mp3");
    expect(screen.getByText("Menu principal")).toBeTruthy();
  });

  it("keeps the text reply for messaging workflows", () => {
    render(<WorkflowTestPanel simulation={simulation({ status: "waiting_reply" })} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText("Escreva uma resposta...")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Teclado do telefone" })).toBeNull();
  });
});
