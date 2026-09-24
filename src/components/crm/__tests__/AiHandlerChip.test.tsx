import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { AiHandlerChip } from "../AiHandlerChip";


describe("AiHandlerChip", () => {
  it("shows nothing when the campaign configured no AI", () => {
    const { container } = render(
      <AiHandlerChip handler={null} automationEnabled={null} conversationStatus="ongoing" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

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

  it("stays while the workflow itself holds the conversation", () => {
    render(
      <AiHandlerChip
        handler={{ kind: "workflow", workflow_id: "w1", workflow_name: "Régua NR" }}
        automationEnabled={null}
        conversationStatus="ongoing"
        assignedUserId="workflow:w1"
      />,
    );
    expect(screen.getByText("Régua NR")).toBeTruthy();
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
