import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";

const listBusinessPhonesAction = vi.fn();
const startOfficialConversationAction = vi.fn();

vi.mock("@/app/actions/whatsapp-business-phones", () => ({
  listBusinessPhonesAction: (...args: unknown[]) => listBusinessPhonesAction(...args),
}));
vi.mock("@/app/actions/whatsapp-outreach", () => ({
  startOfficialConversationAction: (...args: unknown[]) => startOfficialConversationAction(...args),
}));
vi.mock("@/app/actions/whatsapp-templates", () => ({
  createWhatsAppTemplateAction: vi.fn(),
  getWhatsAppTemplateByIdAction: vi.fn(),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ can: () => false }),
}));

let composer: Record<string, unknown> = {};
vi.mock("@/hooks/use-template-composer", () => ({
  useTemplateComposer: () => composer,
}));

import { StartOfficialConversationDialog } from "../start-official-conversation-dialog";

const errors = ptMessages.whatsappOutreach.errors;

const TEMPLATE = {
  id: "tpl-1",
  name: "aviso",
  language: "pt_BR",
  category: "UTILITY",
  status: "APPROVED",
  components: [{ type: "BODY", text: "Oi" }],
};

function composerWith(overrides: Record<string, unknown>) {
  return {
    templates: [TEMPLATE],
    templatesLoading: false,
    readyTemplates: [TEMPLATE],
    pendingCount: 0,
    templateOptions: [],
    templateId: "tpl-1",
    template: TEMPLATE,
    selectTemplate: vi.fn(),
    slots: { body: [], header: [] },
    bodyValues: [],
    headerValues: [],
    setBodyValue: vi.fn(),
    setHeaderValue: vi.fn(),
    missingValues: false,
    previewMetadata: null,
    quote: null,
    quoteError: null,
    retryQuote: null,
    priceLabel: null,
    reload: vi.fn(),
    upsertTemplate: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  };
}

function renderDialog() {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <StartOfficialConversationDialog open onOpenChange={vi.fn()} onStarted={vi.fn()} />
    </NextIntlClientProvider>,
  );
}

describe("StartOfficialConversationDialog refusals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listBusinessPhonesAction.mockResolvedValue({ phones: [{ id: "bp-1", displayPhoneNumber: "+55 11 99999-0000" }] });
    composer = composerWith({});
  });

  it("announces why the quote was refused in the cost box", async () => {
    composer = composerWith({ quoteError: errors.quote_out_of_range });
    renderDialog();
    expect(await screen.findByRole("status")).toHaveTextContent(errors.quote_out_of_range);
    expect(screen.queryByRole("button", { name: ptMessages.common.tryAgain })).not.toBeInTheDocument();
  });

  it("asks for the quote again when an unavailable quote is retried", async () => {
    const retryQuote = vi.fn();
    composer = composerWith({ quoteError: errors.quote_unavailable, retryQuote });
    renderDialog();
    expect(await screen.findByRole("status")).toHaveTextContent(errors.quote_unavailable);
    fireEvent.click(screen.getByRole("button", { name: ptMessages.common.tryAgain }));
    expect(retryQuote).toHaveBeenCalledTimes(1);
  });

  it("shows the opted out reason when the send is refused", async () => {
    startOfficialConversationAction.mockResolvedValue({
      conversation: null,
      error: { code: "lead_opted_out", message: "lead opted out" },
    });
    renderDialog();
    fireEvent.change(await screen.findByPlaceholderText("5511999999999"), { target: { value: "5511988887777" } });
    const submit = await screen.findByRole("button", { name: ptMessages.whatsappOutreach.submit });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    expect(await screen.findByText(errors.lead_opted_out)).toBeInTheDocument();
  });
});
