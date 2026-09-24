import { describe, expect, it } from "vitest";

import {
  RESPONSIBLE_AI,
  RESPONSIBLE_UNASSIGNED,
  RESPONSIBLE_WORKFLOW,
  responsibleFilterPayload,
} from "./responsible-filter";

describe("responsibleFilterPayload", () => {
  it("asks for nothing when every responsible is shown", () => {
    expect(responsibleFilterPayload("")).toEqual({});
  });

  it("keeps the queue and member filters as they were", () => {
    expect(responsibleFilterPayload(RESPONSIBLE_UNASSIGNED)).toEqual({ responsible_unassigned: true });
    expect(responsibleFilterPayload("5f0c-user")).toEqual({ responsible_user_id: "5f0c-user" });
  });

  it("asks by kind for what an agent or a workflow holds", () => {
    // Never as a user id: the backend column is a uuid and an ai:/workflow:
    // string there is a query error, so these travel as responsible_kind.
    expect(responsibleFilterPayload(RESPONSIBLE_AI)).toEqual({ responsible_kind: "ai" });
    expect(responsibleFilterPayload(RESPONSIBLE_WORKFLOW)).toEqual({ responsible_kind: "workflow" });
  });
});
