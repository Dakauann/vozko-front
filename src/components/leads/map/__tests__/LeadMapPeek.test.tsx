import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const fetchLeadMapPoint = vi.fn();
vi.mock("@/app/actions/lead-map", () => ({ fetchLeadMapPoint: (...args: unknown[]) => fetchLeadMapPoint(...args) }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws1" } }) }));
const sendGate = vi.hoisted(() => ({
  states: { send_template: { enabled: true }, send_message: { enabled: true } } as Record<string, { enabled: boolean; reason?: string }>,
}));
vi.mock("@/components/leads/sends/use-lead-send-gate", () => ({ useLeadSendGate: () => sendGate.states }));
vi.mock("@/components/leads/sends/LeadSendDialog", () => ({
  LeadSendDialog: ({ action, selection }: { action: string; selection: { ids: string[] } }) => (
    <div role="dialog" aria-label={action}>
      {selection.ids.join(",")}
    </div>
  ),
}));
vi.mock("@/components/leads/LeadCall", () => ({
  LeadCallButton: ({ leadId }: { leadId: string }) => <button type="button">Ligar {leadId}</button>,
}));

import { SectionError } from "@/lib/analytics/section-query";
import { emptyCrmFilter } from "@/lib/crm/board";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import type { MapPoint } from "@/lib/maps/types";

import { LeadMapPeek } from "../LeadMapPeek";

const point: MapPoint = {
  id: "-23.5614,-46.6559",
  lat: -23.5614,
  lng: -46.6559,
  precision: "exact",
  placement: "on_map",
  tone: "chart-2",
  count: 1,
  leadIds: ["l1"],
};

const maria = {
  id: "l1",
  workspaceId: "ws1",
  number: "5511900010142",
  realName: "Maria Aparecida Souza",
  blocked: false,
  relativesCount: 0,
  referredCount: 0,
  version: 3,
  phones: [{ id: "p1", number: "551133334444", label: "home" }],
  addresses: [
    {
      id: "a1",
      label: "home",
      primary: true,
      street: "R. das Acácias",
      number: "120",
      district: "Jardim Silveira",
      geoStatus: "located",
      precision: "exact",
      positionSource: "manual",
    },
  ],
  customFields: { interesse: "Matriculado" },
};

const classification: CustomFieldDefinition = {
  id: "f1",
  workspaceId: "ws1",
  objectType: "lead",
  key: "interesse",
  label: "Interesse",
  type: "select",
  options: ["Matriculado"],
  optionTones: { Matriculado: "chart-2" },
  required: false,
  sensitive: false,
  role: "classification",
  position: 1,
  readable: true,
  createdAt: "",
  updatedAt: "",
};

function renderPeek(props: Partial<Parameters<typeof LeadMapPeek>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <LeadMapPeek
          point={point}
          params={{ filter: emptyCrmFilter, q: "maria" }}
          placement={{ left: 10, top: 20 }}
          classification={classification}
          onClose={onClose}
          {...props}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { onClose };
}

describe("LeadMapPeek", () => {
  beforeEach(() => {
    fetchLeadMapPoint.mockReset().mockResolvedValue({ total: 1, items: [maria] });
  });

  it("asks for the leads at the dot with the page's filter and search", async () => {
    renderPeek();
    await screen.findByText("Maria Aparecida Souza");
    expect(fetchLeadMapPoint).toHaveBeenCalledWith({ filter: emptyCrmFilter, q: "maria" }, { lat: -23.5614, lng: -46.6559, placement: "on_map" }, expect.anything());
  });

  it("says an approximate position is approximate, and where it stands", async () => {
    const near: MapPoint = { ...point, id: "approximate:-6.3104,-35.4793", lat: -6.3104, lng: -35.4793, precision: "district", placement: "approximate", tone: "neutral", count: 2 };
    const joana = {
      ...maria,
      id: "l9",
      realName: "Joana Bezerra",
      addresses: [{ id: "a9", label: "home", primary: true, district: "Centro", city: "Santo Antônio", geoStatus: "located", precision: "district" }],
    };
    fetchLeadMapPoint.mockResolvedValue({ total: 2, items: [joana] });
    renderPeek({ point: near });
    expect(await screen.findByText("Joana Bezerra")).toBeInTheDocument();
    expect(fetchLeadMapPoint).toHaveBeenCalledWith(expect.anything(), { lat: -6.3104, lng: -35.4793, placement: "approximate" }, expect.anything());
    expect(screen.getByText("Posição aproximada (bairro Centro)")).toBeInTheDocument();
    expect(screen.getByText("2 pessoas neste ponto")).toBeInTheDocument();
  });

  it("names the kind of reference when the approximate place has no name", async () => {
    const near: MapPoint = { ...point, id: "approximate:-6.3,-35.4", lat: -6.3, lng: -35.4, precision: "postal_code", placement: "approximate", tone: "neutral" };
    fetchLeadMapPoint.mockResolvedValue({
      total: 1,
      items: [{ ...maria, addresses: [{ id: "a9", label: "home", primary: true, geoStatus: "located", precision: "postal_code" }] }],
    });
    renderPeek({ point: near });
    expect(await screen.findByText("Posição aproximada (por CEP)")).toBeInTheDocument();
  });

  it("shows the name, the phones, the address and how precise the position is", async () => {
    renderPeek();
    expect(await screen.findByText("Maria Aparecida Souza")).toBeInTheDocument();
    expect(screen.getByText("+55 (11) 90001-0142")).toBeInTheDocument();
    expect(screen.getByText("+55 (11) 3333-4444")).toBeInTheDocument();
    expect(screen.getByText("R. das Acácias, 120 · Jardim Silveira")).toBeInTheDocument();
    expect(screen.getByText("Localização exata · pin manual")).toBeInTheDocument();
  });

  it("shows the classification only when the viewer may read it", async () => {
    renderPeek();
    expect(await screen.findByText("Matriculado")).toBeInTheDocument();
  });

  it("leaves the classification out for a viewer who cannot read it", async () => {
    renderPeek({ classification: undefined });
    await screen.findByText("Maria Aparecida Souza");
    expect(screen.queryByText("Matriculado")).not.toBeInTheDocument();
  });

  it("offers Abrir, Ligar and the template send to this lead", async () => {
    sendGate.states = { send_template: { enabled: true }, send_message: { enabled: true } };
    renderPeek();
    await screen.findByText("Maria Aparecida Souza");
    expect(screen.getByRole("link", { name: "Abrir" })).toHaveAttribute("href", "/dashboard/leads/l1");
    expect(screen.getByRole("button", { name: "Ligar l1" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Template/ }));
    expect(screen.getByRole("dialog", { name: "send_template" })).toHaveTextContent("l1");
  });

  it("says why the template send is not offered when no official number is connected", async () => {
    sendGate.states = { send_template: { enabled: false, reason: "noOfficialNumber" }, send_message: { enabled: true } };
    renderPeek();
    await screen.findByText("Maria Aparecida Souza");
    const template = screen.getByRole("button", { name: /Template/ });
    expect(template).toBeDisabled();
    expect(template).toHaveAccessibleDescription(ptMessages.leadSends.blockers.noOfficialNumber);
  });

  it("leaves the template send out for someone who may not send from leads", async () => {
    sendGate.states = { send_template: { enabled: false, reason: "permissionSendTemplate" }, send_message: { enabled: true } };
    renderPeek();
    await screen.findByText("Maria Aparecida Souza");
    expect(screen.queryByRole("button", { name: /Template/ })).toBeNull();
  });

  it("counts the people at a shared address and says how many are not listed", async () => {
    fetchLeadMapPoint.mockResolvedValue({ total: 54, items: [maria] });
    renderPeek({ point: { ...point, count: 54 } });
    expect(await screen.findByText("E mais 53 pessoas neste ponto.")).toBeInTheDocument();
    expect(screen.getByText("54 pessoas neste ponto")).toBeInTheDocument();
  });

  it("says neste endereço only when every lead there shares the full address with its number", async () => {
    const joao = { ...maria, id: "l2", realName: "João Souza" };
    fetchLeadMapPoint.mockResolvedValue({ total: 2, items: [maria, joao] });
    renderPeek({ point: { ...point, count: 2 } });
    expect(await screen.findByText("2 pessoas neste endereço")).toBeInTheDocument();
  });

  it("says neste ponto when the leads there live at different numbers", async () => {
    const vizinho = { ...maria, id: "l3", realName: "Vizinho", addresses: [{ ...maria.addresses[0], id: "a3", number: "122" }] };
    fetchLeadMapPoint.mockResolvedValue({ total: 2, items: [maria, vizinho] });
    renderPeek({ point: { ...point, count: 2 } });
    expect(await screen.findByText("2 pessoas neste ponto")).toBeInTheDocument();
  });

  it("closes from its button and from Escape", async () => {
    const { onClose } = renderPeek();
    await screen.findByText("Maria Aparecida Souza");
    fireEvent.click(screen.getByRole("button", { name: "Fechar prévia" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("shows a failure instead of an empty card", async () => {
    fetchLeadMapPoint.mockRejectedValue(new SectionError("boom", 400));
    renderPeek();
    expect(await screen.findByText("Não foi possível carregar os leads deste ponto.")).toBeInTheDocument();
  });
});
