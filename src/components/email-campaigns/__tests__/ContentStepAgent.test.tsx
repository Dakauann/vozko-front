import { act, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { EmailAgentBinding } from "@/components/email-editor/agent/use-email-agent";
import { emptyDraft, type CampaignDraft } from "@/lib/email-campaigns/draft";
import type { Document } from "@/lib/email-design/types";

const seen = vi.hoisted(() => ({ agent: undefined as EmailAgentBinding | undefined, document: undefined as unknown }));
const toasts = vi.hoisted(() => ({ calls: [] as Array<{ title: string; options: { action: { label: string; onClick: () => void } } }> }));

vi.mock("sonner", () => ({
  toast: Object.assign(
    (title: string, options: { action: { label: string; onClick: () => void } }) => {
      toasts.calls.push({ title, options });
    },
    { success: vi.fn(), error: vi.fn() },
  ),
}));
vi.mock("@/components/email-editor", () => ({
  EmailEditor: ({ agent, value }: { agent?: EmailAgentBinding; value: unknown }) => {
    seen.agent = agent;
    seen.document = value;
    return <div data-testid="email-editor" />;
  },
}));
vi.mock("@/components/email-editor/merge-tag-menu", () => ({ MergeTagMenu: () => null }));
vi.mock("@/components/explainers/ExplainerHint", () => ({ ExplainerHint: () => null }));
vi.mock("@/hooks/use-email-campaigns", () => ({ useEmailSenders: () => ({ data: [], isSuccess: false, isPending: false }) }));
vi.mock("../designs/DocumentPicker", () => ({ DocumentPicker: () => null }));
vi.mock("../wizard/TestSendPanel", () => ({ TestSendPanel: () => null }));
vi.mock("../shared", () => ({ useEmailPermission: () => () => true, useEmailErrorMessage: () => () => "" }));

import { ContentStep } from "../wizard/ContentStep";

const document: Document = { version: 1, settings: {}, blocks: [{ id: "footer", kind: "footer", footer: { company_name: "Loja", address: "Rua A" } }] };
const preview = { issues: [], hints: [], html: "", loading: false, subject: null, request: async () => undefined };

const state = { draft: emptyDraft(), edit: (_: Partial<CampaignDraft>) => {} };

function Harness({ campaignId }: { campaignId: string | null }) {
  const [draft, setDraft] = useState<CampaignDraft>({ ...emptyDraft(), name: "Black Friday", subject: "Antes", preheader: "Prévia antes", document });
  state.draft = draft;
  state.edit = (patch) => setDraft((current) => ({ ...current, ...patch }));
  return (
    <ContentStep
      draft={draft}
      onDraftChange={state.edit}
      customFields={[]}
      campaignId={campaignId}
      readOnly={false}
      prepare={async () => true}
      preview={preview as never}
      reviewIssues={[]}
      reviewHints={[]}
    />
  );
}

function mount(campaignId: string | null) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <Harness campaignId={campaignId} />
    </NextIntlClientProvider>,
  );
}

function campaignAgent() {
  const agent = seen.agent;
  if (agent?.surface !== "email_campaign") throw new Error("the editor is not bound to the campaign");
  return agent;
}

describe("ContentStep and Elo", () => {
  beforeEach(() => {
    seen.agent = undefined;
    toasts.calls = [];
  });

  it("binds the editor to the saved campaign and to nothing before it exists", () => {
    mount(null);
    expect(seen.agent).toBeUndefined();
    mount("5f0c7c1e-1d2a-4b8e-9d11-3a2b1c0d9e8f");
    expect(campaignAgent()).toMatchObject({ surface: "email_campaign", projectId: "5f0c7c1e-1d2a-4b8e-9d11-3a2b1c0d9e8f", name: "Black Friday" });
  });

  it("shows Elo's subject live in the draft the autosave keeps, and undoes it without losing the person's typing", () => {
    mount("c1");
    const port = campaignAgent().envelope;
    expect(port.read()).toEqual({ subject: "Antes", preheader: "Prévia antes" });

    act(() => port.apply({ subject: "Da Elo", preheader: "Prévia da Elo" }, { subject: "Antes", preheader: "Prévia antes" }));
    expect(state.draft.subject).toBe("Da Elo");
    expect(state.draft.preheader).toBe("Prévia da Elo");
    expect(state.draft.document).toBe(document);
    expect(campaignAgent().envelope.read()).toEqual({ subject: "Da Elo", preheader: "Prévia da Elo" });
    expect(toasts.calls).toHaveLength(1);
    expect(toasts.calls[0].title).toBe(ptMessages.emailCampaigns.content.agent.envelopeChanged);
    expect(toasts.calls[0].options.action.label).toBe(ptMessages.emailCampaigns.content.agent.undo);

    act(() => state.edit({ subject: "Dela" }));
    act(() => toasts.calls[0].options.action.onClick());
    expect(state.draft.subject).toBe("Dela");
    expect(state.draft.preheader).toBe("Prévia antes");
  });
});
