import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { AssigneeGlyph } from "../AssigneeGlyph";

function kindOf(assignedUserId?: string | null) {
  const { container } = render(<AssigneeGlyph assignedUserId={assignedUserId} />);
  return container.querySelector("[data-assignee-kind]")?.getAttribute("data-assignee-kind");
}

describe("AssigneeGlyph", () => {
  it("marks an agent, a workflow and a person differently", () => {
    expect(kindOf("ai:agent-1")).toBe("ai");
    expect(kindOf("workflow:wf-1")).toBe("workflow");
    expect(kindOf("5f0c-user")).toBe("human");
  });
});
