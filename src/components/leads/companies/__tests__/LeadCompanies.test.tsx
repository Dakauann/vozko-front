import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { LeadCompany } from "@/lib/leads/companies";

const granted = vi.hoisted(() => ({ value: new Set<string>() }));
const actions = vi.hoisted(() => ({
  listLeadCompaniesAction: vi.fn(),
  getLeadCompanyAction: vi.fn(),
  createLeadCompanyAction: vi.fn(),
  updateLeadCompanyAction: vi.fn(),
  deleteLeadCompanyAction: vi.fn(),
}));
const push = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, can: (resource: string, action: string) => granted.value.has(`${resource}:${action}`) }),
}));
vi.mock("@/app/actions/lead-companies", () => actions);
vi.mock("@/i18n/routing", () => ({ useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }), usePathname: () => "/dashboard/leads/companies",
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/explainers/ExplainerHint", () => ({ ExplainerHint: ({ id }: { id: string }) => <span data-explainer={id} /> }));

import { LeadCompaniesPage } from "../LeadCompaniesPage";
import { LeadCompanyDialog } from "../LeadCompanyDialog";
import { LeadCompanyRow } from "../LeadCompanyRow";

const copy = pt.leadCompanies;

function acme(overrides: Partial<LeadCompany> = {}): LeadCompany {
  return { id: "c-1", name: "Acme", acceptsLeads: true, membersCount: 3, createdAt: "2026-10-17T12:00:00Z", updatedAt: "2026-10-17T12:00:00Z", ...overrides };
}

function renderUi(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

function page(items: LeadCompany[]) {
  return { data: { items, page: 1, pageSize: 20, totalPages: 1, totalItems: items.length }, error: null };
}

beforeEach(() => {
  granted.value = new Set(["lead_companies:read"]);
  for (const action of Object.values(actions)) action.mockReset();
  push.mockReset();
  toast.error.mockReset();
  toast.success.mockReset();
  actions.listLeadCompaniesAction.mockResolvedValue(page([acme()]));
});

describe("LeadCompaniesPage", () => {
  it("lists the companies with how many leads each holds, read only for a viewer", async () => {
    renderUi(<LeadCompaniesPage />);
    expect(await screen.findByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("3 leads")).toBeInTheDocument();
    expect(screen.getByText(copy.accepts.on)).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.page.create })).not.toBeInTheDocument();
  });

  it("opens the leads of a company as the filtered lead list", async () => {
    renderUi(<LeadCompaniesPage />);
    fireEvent.click(await screen.findByText("Acme"));
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/dashboard\/leads\?filter=/));
  });

  it("closes a company to new leads from its switch", async () => {
    granted.value = new Set(["lead_companies:read", "lead_companies:update"]);
    actions.updateLeadCompanyAction.mockResolvedValue({ data: acme({ acceptsLeads: false }), error: null });
    renderUi(<LeadCompaniesPage />);
    fireEvent.click(await screen.findByRole("switch", { name: "Aceitar novos leads em Acme" }));
    await waitFor(() => expect(actions.updateLeadCompanyAction).toHaveBeenCalledWith("c-1", { acceptsLeads: false }));
    expect(toast.success).toHaveBeenCalledWith("Acme não aceita mais novos leads");
  });

  it("offers a new company only to whoever may create one", async () => {
    granted.value = new Set(["lead_companies:read", "lead_companies:create"]);
    renderUi(<LeadCompaniesPage />);
    fireEvent.click(await screen.findByRole("button", { name: copy.page.create }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(copy.dialog.createTitle);
  });
});

describe("LeadCompanyDialog", () => {
  it("creates an open company by default", async () => {
    const onClose = vi.fn();
    actions.createLeadCompanyAction.mockResolvedValue({ data: acme(), error: null });
    renderUi(<LeadCompanyDialog company={null} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(copy.dialog.name), { target: { value: "  Acme  " } });
    fireEvent.click(screen.getByRole("button", { name: copy.dialog.save }));
    await waitFor(() => expect(actions.createLeadCompanyAction).toHaveBeenCalledWith({ name: "Acme", acceptsLeads: true }));
    expect(onClose).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(copy.dialog.created);
  });

  it("asks for a name before saving", async () => {
    renderUi(<LeadCompanyDialog company={null} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: copy.dialog.save }));
    expect(await screen.findByRole("alert")).toHaveTextContent(copy.errors.lead_company_name_required);
    expect(actions.createLeadCompanyAction).not.toHaveBeenCalled();
  });

  it("sends only what changed and explains the switch", async () => {
    actions.updateLeadCompanyAction.mockResolvedValue({ data: acme({ acceptsLeads: false }), error: null });
    renderUi(<LeadCompanyDialog company={acme()} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector('[data-explainer="crm.companyAcceptsLeads"]')).not.toBeNull();
    fireEvent.click(within(dialog).getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: copy.dialog.save }));
    await waitFor(() => expect(actions.updateLeadCompanyAction).toHaveBeenCalledWith("c-1", { acceptsLeads: false }));
  });

  it("states a refusal in the copy of its code and stays open", async () => {
    const onClose = vi.fn();
    actions.createLeadCompanyAction.mockResolvedValue({ data: null, error: { message: "too long", code: "lead_company_name_too_long" } });
    renderUi(<LeadCompanyDialog company={null} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(copy.dialog.name), { target: { value: "Acme" } });
    fireEvent.click(screen.getByRole("button", { name: copy.dialog.save }));
    expect(await screen.findByRole("alert")).toHaveTextContent(copy.errors.lead_company_name_too_long);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("lets only whoever may upload media send an image", () => {
    const { unmount } = renderUi(<LeadCompanyDialog company={null} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: copy.image.add })).toBeDisabled();
    expect(screen.getByText(copy.image.noPermission)).toBeInTheDocument();
    unmount();
    granted.value = new Set(["lead_companies:read", "media:create"]);
    renderUi(<LeadCompanyDialog company={null} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: copy.image.add })).toBeEnabled();
  });
});

describe("LeadCompanyRow", () => {
  it("names the company of the lead with a link to its leads", async () => {
    actions.getLeadCompanyAction.mockResolvedValue({ data: acme({ acceptsLeads: false }), error: null });
    renderUi(<LeadCompanyRow companyId="c-1" />);
    expect(await screen.findByText("Acme")).toBeInTheDocument();
    expect(screen.getByText(pt.leadDetail.company.closed)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: pt.leadDetail.company.members }).getAttribute("href")).toMatch(/^\/dashboard\/leads\?filter=/);
  });

  it("says when the company was removed", async () => {
    actions.getLeadCompanyAction.mockResolvedValue({ data: null, error: { message: "gone", code: "lead_company_not_found", status: 404 } });
    renderUi(<LeadCompanyRow companyId="c-9" />);
    expect(await screen.findByText(pt.leadDetail.company.gone)).toBeInTheDocument();
  });

  it("is left out for a viewer who cannot read companies", () => {
    granted.value = new Set();
    const { container } = renderUi(<LeadCompanyRow companyId="c-1" />);
    expect(container).toBeEmptyDOMElement();
    expect(actions.getLeadCompanyAction).not.toHaveBeenCalled();
  });
});
