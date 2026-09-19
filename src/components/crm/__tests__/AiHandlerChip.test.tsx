import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { AiHandlerChip } from "../AiHandlerChip";

// The chip answers "which AI is attending this conversation". It must never
// answer when there is none.
//
// Live case: campaign "RÉGUA NR - 1809 IA" was created with no agent and no
// workflow. Its 670 entries carry automation_enabled = NULL, which the
// attendance helper reads as "on", so the chip fabricated a generic handler and
// every row displayed "IA · Agente". The campaign produced zero ai_response
// messages, and the operator who built it took the badge as proof it was wired.

describe("AiHandlerChip", () => {
  it("shows nothing when the campaign configured no AI", () => {
    const { container } = render(
      <AiHandlerChip handler={null} automationEnabled={null} conversationStatus="ongoing" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  // automation_enabled = NULL is the shape 651 of those 670 entries were in:
  // never touched, read as "on", and previously enough to light the badge.
  it("does not treat an untouched automation flag as an AI", () => {
    const { container } = render(
      <AiHandlerChip automationEnabled={null} conversationStatus="new" assignedUserId={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("names the agent when one really is configured", () => {
    render(
      <AiHandlerChip
        handler={{ kind: "agent", agent_id: "a1", agent_name: "Clara" }}
        automationEnabled={null}
        conversationStatus="ongoing"
      />,
    );
    expect(screen.getByText("Clara")).toBeTruthy();
    expect(screen.getByText(/IA ·/)).toBeTruthy();
  });

  it("names the workflow when the handler is one", () => {
    render(
      <AiHandlerChip
        handler={{ kind: "workflow", workflow_id: "w1", workflow_name: "Régua NR" }}
        automationEnabled={null}
        conversationStatus="ongoing"
      />,
    );
    expect(screen.getByText("Régua NR")).toBeTruthy();
    expect(screen.getByText(/Fluxo ·/)).toBeTruthy();
  });

  // Turning the AI off for one conversation must still say WHICH AI is paused,
  // otherwise the operator cannot tell what they would be turning back on.
  it("still shows a configured agent when paused for the conversation", () => {
    render(
      <AiHandlerChip
        handler={{ kind: "agent", agent_name: "Clara" }}
        automationEnabled={false}
        conversationStatus="ongoing"
      />,
    );
    expect(screen.getByText("Clara")).toBeTruthy();
  });

  it("hides once a human owns the thread", () => {
    const { container } = render(
      <AiHandlerChip
        handler={{ kind: "agent", agent_name: "Clara" }}
        automationEnabled={null}
        conversationStatus="ongoing"
        assignedUserId="user-1"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("hides on a finished conversation", () => {
    const { container } = render(
      <AiHandlerChip
        handler={{ kind: "agent", agent_name: "Clara" }}
        automationEnabled={null}
        conversationStatus="finished"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
