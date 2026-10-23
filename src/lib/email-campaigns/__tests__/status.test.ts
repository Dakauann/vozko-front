import { describe, expect, it } from "vitest";

import { ACTION_PERMISSION, campaignCommands, campaignHref, canRun, holdReasonOf, isLaunched, isSending, isWizardStatus, STATUS_TONE, wizardHref } from "../status";
import { CAMPAIGN_ACTIONS, CAMPAIGN_STATUSES } from "../types";

const everything = () => true;

describe("campaignCommands", () => {
  it("offers only the commands the backend allows, in a stable order", () => {
    expect(campaignCommands(["stop", "pause", "resume", "edit"], everything)).toEqual(["resume", "pause", "stop"]);
    expect(campaignCommands(["stop", "unschedule", "launch", "schedule", "edit"], everything)).toEqual(["unschedule", "stop"]);
    expect(campaignCommands(["edit", "delete", "schedule", "launch", "start"], everything)).toEqual(["start"]);
    expect(campaignCommands([], everything)).toEqual([]);
  });

  it("hides commands the member is not allowed to run", () => {
    const held = ["resume", "pause", "stop"] as const;
    expect(campaignCommands([...held], (action) => action === "stop")).toEqual(["pause", "stop"]);
    expect(campaignCommands([...held], (action) => action === "start")).toEqual(["resume"]);
  });
});

describe("canRun", () => {
  it("needs the action from the backend and the matching permission", () => {
    expect(canRun(["edit"], "edit", (action) => action === "update")).toBe(true);
    expect(canRun(["edit"], "edit", () => false)).toBe(false);
    expect(canRun([], "edit", everything)).toBe(false);
    expect(canRun(["delete"], "delete", (action) => action === "delete")).toBe(true);
  });

  it("maps every backend action to a permission", () => {
    for (const action of CAMPAIGN_ACTIONS) expect(ACTION_PERMISSION[action]).toBeTruthy();
    expect(ACTION_PERMISSION.launch).toBe("start");
    expect(ACTION_PERMISSION.start).toBe("start");
    expect(ACTION_PERMISSION.ready).toBe("start");
    expect(ACTION_PERMISSION.pause).toBe("stop");
    expect(ACTION_PERMISSION.edit).toBe("update");
  });
});

describe("status groups", () => {
  it("has a tone for every status", () => {
    for (const status of CAMPAIGN_STATUSES) expect(STATUS_TONE[status]).toBeTruthy();
  });

  it("groups statuses the way the backend does", () => {
    expect(CAMPAIGN_STATUSES.filter(isLaunched)).toEqual(["running", "paused", "held", "completed", "stopped"]);
    expect(CAMPAIGN_STATUSES.filter(isSending)).toEqual(["running", "held"]);
    expect(CAMPAIGN_STATUSES.filter(isWizardStatus)).toEqual(["draft"]);
  });
});

describe("holdReasonOf", () => {
  it("keeps known reasons and drops anything else", () => {
    expect(holdReasonOf("daily_cap")).toBe("daily_cap");
    expect(holdReasonOf("sender_unavailable")).toBe("sender_unavailable");
    expect(holdReasonOf("balance_insufficient")).toBe("balance_insufficient");
    expect(holdReasonOf("validation_interrupted")).toBeNull();
    expect(holdReasonOf("")).toBeNull();
    expect(holdReasonOf("mystery")).toBeNull();
    expect(holdReasonOf(undefined)).toBeNull();
  });
});

describe("hrefs", () => {
  it("opens drafts in the wizard and the rest in the detail page", () => {
    expect(campaignHref("c1", "draft")).toBe("/dashboard/email/campaigns/new?campaign=c1");
    expect(campaignHref("c1", "running")).toBe("/dashboard/email/campaigns/c1");
    expect(wizardHref("c1", "review")).toBe("/dashboard/email/campaigns/new?campaign=c1&step=review");
  });
});

describe("a ready campaign", () => {
  it("is a status of its own that opens on the detail page", () => {
    expect(CAMPAIGN_STATUSES).toContain("ready");
    expect(isWizardStatus("ready")).toBe(false);
    expect(isLaunched("ready")).toBe(false);
    expect(campaignHref("c1", "ready")).toBe("/dashboard/email/campaigns/c1");
  });
});
