import { describe, expect, it } from "vitest";

import {
  RUN_WORKFLOW_TOOL,
  addToolBinding,
  bindingIdentity,
  boundKeyOf,
  boundValues,
  removeToolBindingAt,
  replaceToolBindingAt,
  toolBindingKey,
} from "./tool-bindings";
import type { ToolBinding } from "./types";

const RUN_WORKFLOW = "run_workflow";

function workflowBinding(workflowId: string): ToolBinding {
  return { name: RUN_WORKFLOW, visibility: ["messaging"], config: { workflow_id: workflowId } };
}

describe("toolBindingKey", () => {
  it("reads the key the backend sends for Executar fluxo", () => {
    expect(toolBindingKey({ name: RUN_WORKFLOW, bindingKey: "workflow_id" })).toBe("workflow_id");
  });

  it("guesses no key when the backend sends none, so identity comes only from the catalog", () => {
    expect(toolBindingKey({ name: RUN_WORKFLOW })).toBeUndefined();
    expect(toolBindingKey({ name: "transfer_to_human", bindingKey: "" })).toBeUndefined();
  });
});

describe("boundKeyOf", () => {
  it("reads the bound value back from a bound tool name, like the backend BoundKeyOf", () => {
    expect(boundKeyOf("run_workflow_6f1c-22", RUN_WORKFLOW_TOOL)).toBe("6f1c-22");
    expect(boundKeyOf(" Run_Workflow_ABC ", RUN_WORKFLOW_TOOL)).toBe("abc");
  });

  it("is null for the base name or another tool", () => {
    expect(boundKeyOf("run_workflow", RUN_WORKFLOW_TOOL)).toBeNull();
    expect(boundKeyOf("run_workflow_", RUN_WORKFLOW_TOOL)).toBeNull();
    expect(boundKeyOf("http_request", RUN_WORKFLOW_TOOL)).toBeNull();
  });
});

describe("bindingIdentity", () => {
  it("is the tool name for a tool bound once", () => {
    expect(bindingIdentity({ name: " Transfer_To_Human " }, undefined)).toBe("transfer_to_human");
  });

  it("is the bound tool name for a tool bound per workflow", () => {
    expect(bindingIdentity(workflowBinding("WF-1"), "workflow_id")).toBe("run_workflow_wf-1");
  });
});

describe("addToolBinding", () => {
  it("keeps every workflow binding, one per workflow", () => {
    let bindings: ToolBinding[] = [{ name: "transfer_to_human" }];
    for (const id of ["wf-1", "wf-2", "wf-3"]) {
      const result = addToolBinding(bindings, workflowBinding(id), "workflow_id");
      expect(result.duplicate).toBe(false);
      bindings = result.bindings;
    }
    expect(bindings).toEqual([{ name: "transfer_to_human" }, workflowBinding("wf-1"), workflowBinding("wf-2"), workflowBinding("wf-3")]);
  });

  it("refuses the same workflow twice and leaves the list untouched", () => {
    const bindings = [workflowBinding("wf-1")];
    const result = addToolBinding(bindings, workflowBinding("wf-1"), "workflow_id");
    expect(result.duplicate).toBe(true);
    expect(result.bindings).toBe(bindings);
  });

  it("refuses a second copy of a tool bound once", () => {
    const result = addToolBinding([{ name: "transfer_to_human" }], { name: "transfer_to_human" }, undefined);
    expect(result.duplicate).toBe(true);
  });
});

describe("replaceToolBindingAt", () => {
  it("changes the workflow of one binding and keeps the others", () => {
    const bindings = [workflowBinding("wf-1"), workflowBinding("wf-2")];
    const result = replaceToolBindingAt(bindings, 1, workflowBinding("wf-3"), "workflow_id");
    expect(result).toEqual({ bindings: [workflowBinding("wf-1"), workflowBinding("wf-3")], duplicate: false });
  });

  it("allows saving a binding unchanged", () => {
    const bindings = [workflowBinding("wf-1")];
    expect(replaceToolBindingAt(bindings, 0, workflowBinding("wf-1"), "workflow_id").duplicate).toBe(false);
  });

  it("refuses to point a binding at a workflow another binding already uses", () => {
    const bindings = [workflowBinding("wf-1"), workflowBinding("wf-2")];
    const result = replaceToolBindingAt(bindings, 1, workflowBinding("wf-1"), "workflow_id");
    expect(result.duplicate).toBe(true);
    expect(result.bindings).toBe(bindings);
  });
});

describe("removeToolBindingAt", () => {
  it("removes only the chosen binding", () => {
    const bindings = [workflowBinding("wf-1"), workflowBinding("wf-2")];
    expect(removeToolBindingAt(bindings, 0)).toEqual([workflowBinding("wf-2")]);
  });
});

describe("boundValues", () => {
  it("lists the workflows other bindings of the tool already use", () => {
    const bindings = [workflowBinding("wf-1"), { name: "transfer_to_human" }, workflowBinding("wf-2")];
    expect(boundValues(bindings, RUN_WORKFLOW, "workflow_id", 2)).toEqual(new Set(["wf-1"]));
    expect(boundValues(bindings, RUN_WORKFLOW, "workflow_id", null)).toEqual(new Set(["wf-1", "wf-2"]));
  });
});
