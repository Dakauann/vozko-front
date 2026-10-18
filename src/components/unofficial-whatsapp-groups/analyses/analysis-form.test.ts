import { describe, expect, it } from "vitest";

import type { GroupAnalysis } from "@/lib/unofficial-whatsapp-groups/types";
import { MAX_MESSAGES_PER_CYCLE, MAX_PROMPT_CHARS, MAX_TRACKED_FIELDS } from "@/lib/unofficial-whatsapp-groups/types";

import {
  analysisFormErrors,
  analysisFormFrom,
  analysisPatch,
  analysisPayload,
  formIsValid,
  parseScheduleTime,
  scheduleTimeOf,
  toFieldKey,
  TRACKED_FIELD_KEY_MAX,
  type AnalysisForm,
} from "./analysis-form";

const analysis: GroupAnalysis = {
  id: "a1",
  workspaceId: "w1",
  groupId: "g1",
  name: "Clima do grupo",
  prompt: "Observe reclamações",
  failures: 0,
  status: "active",
  trigger: "scheduled",
  messagesPerCycle: 80,
  scheduleHour: 7,
  scheduleMinute: 5,
  trackedFields: [{ key: "nps", type: "number" }],
  pendingMessages: 3,
  createdAt: "2026-10-01T10:00:00Z",
  updatedAt: "2026-10-01T10:00:00Z",
};

function validForm(overrides: Partial<AnalysisForm> = {}): AnalysisForm {
  return { ...analysisFormFrom(undefined, "g1"), name: "Análise", prompt: "Foque em vendas", ...overrides };
}

describe("analysisFormFrom", () => {
  it("starts a new analysis on the message count trigger with the backend defaults", () => {
    const form = analysisFormFrom(undefined, "g1");
    expect(form).toEqual({
      groupId: "g1",
      name: "",
      prompt: "",
      trigger: "message_count",
      messagesPerCycle: "50",
      scheduleTime: "20:00",
      trackedFields: [],
    });
  });

  it("copies an existing analysis, padding the schedule time", () => {
    const form = analysisFormFrom(analysis);
    expect(form.groupId).toBe("g1");
    expect(form.trigger).toBe("scheduled");
    expect(form.messagesPerCycle).toBe("80");
    expect(form.scheduleTime).toBe("07:05");
    expect(form.trackedFields).toEqual([{ key: "nps", type: "number" }]);
    expect(form.trackedFields).not.toBe(analysis.trackedFields);
  });
});

describe("analysisFormErrors", () => {
  it("accepts a complete form", () => {
    expect(formIsValid(analysisFormErrors(validForm()))).toBe(true);
  });

  it("requires a group, a name and a prompt", () => {
    const errors = analysisFormErrors(validForm({ groupId: "", name: "  ", prompt: " " }));
    expect(errors.issues).toEqual(["group", "name", "prompt"]);
  });

  it("refuses a prompt longer than the backend limit, counting characters not code units", () => {
    expect(analysisFormErrors(validForm({ prompt: "a".repeat(MAX_PROMPT_CHARS) })).issues).toEqual([]);
    expect(analysisFormErrors(validForm({ prompt: "😀".repeat(MAX_PROMPT_CHARS) })).issues).toEqual([]);
    expect(analysisFormErrors(validForm({ prompt: "a".repeat(MAX_PROMPT_CHARS + 1) })).issues).toEqual(["promptTooLong"]);
  });

  it("checks messages per cycle on both triggers, since it is the batch size of a scheduled run", () => {
    expect(analysisFormErrors(validForm({ messagesPerCycle: "0" })).issues).toEqual(["messagesPerCycle"]);
    expect(analysisFormErrors(validForm({ messagesPerCycle: String(MAX_MESSAGES_PER_CYCLE + 1) })).issues).toEqual(["messagesPerCycle"]);
    expect(analysisFormErrors(validForm({ messagesPerCycle: "2.5" })).issues).toEqual(["messagesPerCycle"]);
    expect(analysisFormErrors(validForm({ messagesPerCycle: "" })).issues).toEqual(["messagesPerCycle"]);
    expect(analysisFormErrors(validForm({ messagesPerCycle: String(MAX_MESSAGES_PER_CYCLE) })).issues).toEqual([]);
    expect(analysisFormErrors(validForm({ trigger: "scheduled", messagesPerCycle: "0" })).issues).toEqual(["messagesPerCycle"]);
  });

  it("checks the schedule only on the scheduled trigger", () => {
    expect(analysisFormErrors(validForm({ trigger: "scheduled", scheduleTime: "" })).issues).toEqual(["schedule"]);
    expect(analysisFormErrors(validForm({ trigger: "scheduled", scheduleTime: "24:00" })).issues).toEqual(["schedule"]);
    expect(analysisFormErrors(validForm({ scheduleTime: "" })).issues).toEqual([]);
  });

  it("flags each tracked field with its own problem", () => {
    const errors = analysisFormErrors(
      validForm({
        trackedFields: [
          { key: "nps", type: "number" },
          { key: "Nps", type: "number" },
          { key: "1abc", type: "text" },
          { key: "nps", type: "boolean" },
          { key: `a${"b".repeat(TRACKED_FIELD_KEY_MAX)}`, type: "text" },
          { key: "", type: "text" },
        ],
      }),
    );
    expect(errors.fields).toEqual([null, "key", "key", "duplicate", "keyTooLong", "key"]);
    expect(formIsValid(errors)).toBe(false);
  });

  it("refuses more tracked fields than the backend allows", () => {
    const trackedFields = Array.from({ length: MAX_TRACKED_FIELDS + 1 }, (_, index) => ({ key: `f${index}`, type: "text" as const }));
    expect(analysisFormErrors(validForm({ trackedFields })).issues).toEqual(["tooManyFields"]);
  });
});

describe("payloads", () => {
  it("builds a create payload with trimmed values and the parsed schedule", () => {
    const payload = analysisPayload(
      validForm({ name: " Vendas ", prompt: " Foque ", trigger: "scheduled", scheduleTime: "09:30", trackedFields: [{ key: " nps ", type: "number" }] }),
    );
    expect(payload).toEqual({
      groupId: "g1",
      name: "Vendas",
      prompt: "Foque",
      trigger: "scheduled",
      messagesPerCycle: 50,
      scheduleHour: 9,
      scheduleMinute: 30,
      trackedFields: [{ key: "nps", type: "number" }],
    });
  });

  it("keeps the saved schedule when the message count trigger leaves the time blank", () => {
    const patch = analysisPatch({ ...analysisFormFrom(analysis), trigger: "message_count", scheduleTime: "" }, analysis);
    expect(patch.scheduleHour).toBe(7);
    expect(patch.scheduleMinute).toBe(5);
    expect(patch).not.toHaveProperty("groupId");
  });

  it("keeps the saved messages per cycle when the scheduled trigger leaves it invalid", () => {
    const patch = analysisPatch({ ...analysisFormFrom(analysis), messagesPerCycle: "" }, analysis);
    expect(patch.messagesPerCycle).toBe(80);
  });
});

describe("schedule time", () => {
  it("parses and formats hours and minutes", () => {
    expect(parseScheduleTime("00:00")).toEqual({ hour: 0, minute: 0 });
    expect(parseScheduleTime("23:59")).toEqual({ hour: 23, minute: 59 });
    expect(parseScheduleTime("7:5")).toBeNull();
    expect(parseScheduleTime("12:60")).toBeNull();
    expect(scheduleTimeOf(8, 3)).toBe("08:03");
  });
});

describe("toFieldKey", () => {
  it("turns typed text into the key shape without dropping what the person wrote", () => {
    expect(toFieldKey("Taxa Conversão")).toBe("taxa_conversão");
    expect(toFieldKey("nps-score")).toBe("nps_score");
    expect(toFieldKey("ok")).toBe("ok");
  });
});
