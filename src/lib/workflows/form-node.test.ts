import { describe, expect, it } from "vitest";

import type { FormSummary } from "@/lib/whatsapp-forms/types";

import {
  DEFAULT_FORM_TIMEOUT_SECONDS,
  SEND_FORM_OUTPUTS,
  declaredOutputs,
  formTriggerIds,
  isSendFormOutput,
  publishedForms,
  readSendFormConfig,
  sendFormIncomplete,
} from "./form-node";
import { workflowTypeOfTrigger } from "./workflow-types";

function summary(id: string, publishedVersionId?: string, archivedAt?: string): FormSummary {
  return {
    form: {
      id,
      workspaceId: "w1",
      name: id,
      kind: "built",
      draftVersionId: "d1",
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
      ...(publishedVersionId ? { publishedVersionId } : {}),
      ...(archivedAt ? { archivedAt } : {}),
    },
    publications: [],
    sent: 0,
    responses: 0,
  };
}

describe("send form node", () => {
  it("branches on answered, no reply and send failed", () => {
    expect(SEND_FORM_OUTPUTS).toEqual(["completed", "no_reply", "send_failed"]);
    expect(declaredOutputs("action_send_form", undefined)?.map((output) => output.id)).toEqual(["completed", "no_reply", "send_failed"]);
    expect(isSendFormOutput("no_reply")).toBe(true);
    expect(isSendFormOutput("default")).toBe(false);
  });

  it("keeps the outputs the catalog declares", () => {
    const catalog = [{ id: "completed", label: "Respondido" }];
    expect(declaredOutputs("action_send_form", catalog)).toBe(catalog);
    expect(declaredOutputs("action_send_text", undefined)).toBeUndefined();
  });

  it("reads the config keys of the wire contract", () => {
    expect(
      readSendFormConfig({
        form_id: "f1",
        header: "Oi",
        body: "Preencha",
        footer: "Rodapé",
        cta: "Abrir",
        timeout_seconds: "3600",
        fallback_template_id: "t1",
      }),
    ).toEqual({ form_id: "f1", header: "Oi", body: "Preencha", footer: "Rodapé", cta: "Abrir", timeout_seconds: 3600, fallback_template_id: "t1" });
    expect(readSendFormConfig({}).timeout_seconds).toBe(DEFAULT_FORM_TIMEOUT_SECONDS);
  });

  it("is incomplete without a form, a body or a call to action", () => {
    expect(sendFormIncomplete({ form_id: "f1", body: "Preencha", cta: "Abrir" })).toBe(false);
    expect(sendFormIncomplete({ body: "Preencha", cta: "Abrir" })).toBe(true);
    expect(sendFormIncomplete({ form_id: "f1", body: " ", cta: "Abrir" })).toBe(true);
    expect(sendFormIncomplete({ form_id: "f1", body: "Preencha" })).toBe(true);
  });

  it("offers only forms with a published version", () => {
    const items = [summary("draft"), summary("live", "v2"), summary("gone", "v1", "2026-10-02T00:00:00Z")];
    expect(publishedForms(items).map((item) => item.form.id)).toEqual(["live"]);
  });
});

describe("form submitted trigger", () => {
  it("reads the form filter and treats empty as any form", () => {
    expect(formTriggerIds({ form_ids: ["f1", "", 3, "f2"] })).toEqual(["f1", "f2"]);
    expect(formTriggerIds({})).toEqual([]);
  });

  it("belongs to message workflows", () => {
    expect(workflowTypeOfTrigger("trigger_form_submitted")).toBe("messages");
  });
});
