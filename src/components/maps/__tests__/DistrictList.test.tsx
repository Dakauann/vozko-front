import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, within } from "@testing-library/react";

const fetchReferencePoint = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/lead-map", () => ({ fetchReferencePoint }));

import { DistrictList } from "../DistrictList";
import { renderInPortuguese } from "./intl";

function district(name: string, count: number, cityKey = "3550308") {
  return { pair: `${cityKey}/${name.toLowerCase()}`, cityKey, districtKey: name.toLowerCase(), name, lat: -23.5, lng: -46.6, count };
}

const districts = [district("Jardim Silveira", 418), district("Vila Engenho Novo", 366), district("Centro", 291)];

describe("DistrictList", () => {
  it("lists each bairro with its count", () => {
    renderInPortuguese(<DistrictList districts={districts} onActivate={vi.fn()} onSelectAll={vi.fn()} />);
    const list = screen.getByRole("list", { name: "Bairros do filtro" });
    expect(within(list).getAllByRole("button").map((row) => row.textContent)).toEqual([
      "Jardim Silveira418",
      "Vila Engenho Novo366",
      "Centro291",
    ]);
  });

  it("moves through the bairros with the arrow keys, one tab stop for the list", () => {
    renderInPortuguese(<DistrictList districts={districts} onActivate={vi.fn()} onSelectAll={vi.fn()} />);
    const rows = screen.getAllByRole("button", { pressed: false });
    expect(rows.map((row) => row.tabIndex)).toEqual([0, -1, -1]);
    rows[0].focus();
    fireEvent.keyDown(rows[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(rows[1]);
    fireEvent.keyDown(rows[1], { key: "End" });
    expect(document.activeElement).toBe(rows[2]);
    fireEvent.keyDown(rows[2], { key: "Home" });
    expect(document.activeElement).toBe(rows[0]);
    fireEvent.keyDown(rows[0], { key: "ArrowUp" });
    expect(document.activeElement).toBe(rows[0]);
  });

  it("shows a bairro on the map and offers to select everyone in it", () => {
    const onActivate = vi.fn();
    const onSelectAll = vi.fn();
    renderInPortuguese(<DistrictList districts={districts} onActivate={onActivate} onSelectAll={onSelectAll} />);
    fireEvent.click(screen.getByRole("button", { name: /Vila Engenho Novo/ }));
    expect(onActivate).toHaveBeenCalledWith(districts[1]);
    expect(screen.getByRole("button", { name: /Vila Engenho Novo/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Selecionar todos deste bairro" }));
    expect(onSelectAll).toHaveBeenCalledWith(districts[1]);
  });

  it("follows the bairro picked on the map", () => {
    renderInPortuguese(
      <DistrictList districts={districts} activeKey="3550308/centro" onActivate={vi.fn()} onSelectAll={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /Centro/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows ten bairros and more on request", () => {
    const many = Array.from({ length: 25 }, (_, index) => district(`Bairro ${index}`, 100 - index));
    renderInPortuguese(<DistrictList districts={many} onActivate={vi.fn()} onSelectAll={vi.fn()} />);
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar mais bairros" }));
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(25);
    expect(screen.queryByRole("button", { name: "Mostrar mais bairros" })).not.toBeInTheDocument();
  });

  it("says when no bairro has a point yet", () => {
    renderInPortuguese(<DistrictList districts={[]} onActivate={vi.fn()} onSelectAll={vi.fn()} />);
    expect(screen.getByText("Nenhum bairro com ponto no mapa ainda.")).toBeInTheDocument();
  });

  it("shows the failure with a retry", () => {
    const onRetry = vi.fn();
    renderInPortuguese(<DistrictList districts={null} failed onRetry={onRetry} onActivate={vi.fn()} onSelectAll={vi.fn()} />);
    expect(screen.getByText("Não foi possível carregar os bairros.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("hides the select all action when the viewer cannot narrow the filter", () => {
    renderInPortuguese(<DistrictList districts={districts} onActivate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Centro/ }));
    expect(screen.queryByRole("button", { name: "Selecionar todos deste bairro" })).not.toBeInTheDocument();
  });
});

describe("DistrictList radius from a bairro", () => {
  it("draws a radius area around the chosen bairro from the keyboard", () => {
    const onRadius = vi.fn();
    renderInPortuguese(<DistrictList districts={districts} onActivate={vi.fn()} onRadius={onRadius} />);
    fireEvent.click(screen.getByRole("button", { name: /Centro/ }));
    const group = screen.getByRole("group", { name: "Área de raio a partir de Centro" });
    expect(within(group).getAllByRole("button").map((button) => button.textContent)).toEqual(["500 m", "1 km", "2 km", "5 km"]);
    fireEvent.click(within(group).getByRole("button", { name: "1 km" }));
    expect(onRadius).toHaveBeenCalledWith(districts[2], 1000);
  });

  it("offers no radius before a bairro is chosen", () => {
    renderInPortuguese(<DistrictList districts={districts} onActivate={vi.fn()} onRadius={vi.fn()} />);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
});

describe("DistrictList radius from an address or CEP", () => {
  beforeEach(() => {
    fetchReferencePoint.mockReset();
  });

  function openForm() {
    fireEvent.click(screen.getByRole("button", { name: "Raio a partir de um endereço ou CEP" }));
    return screen.getByRole("form", { name: "Raio a partir de um endereço ou CEP" });
  }

  it("draws a radius area around the CEP point from the keyboard", async () => {
    fetchReferencePoint.mockResolvedValue({
      point: { position: { lat: -23.5614, lng: -46.6559 }, precision: "street", attribution: "IBGE, CNEFE 2022" },
      error: null,
    });
    const onRadius = vi.fn();
    renderInPortuguese(<DistrictList districts={districts} onActivate={vi.fn()} onRadius={onRadius} />);
    const form = openForm();
    fireEvent.change(within(form).getByLabelText("CEP"), { target: { value: "01310-100" } });
    fireEvent.click(within(form).getByRole("radio", { name: "2 km" }));
    await act(async () => fireEvent.click(within(form).getByRole("button", { name: "Criar área de raio" })));
    expect(fetchReferencePoint).toHaveBeenCalledWith({ zipCode: "01310-100", district: "", city: "", state: "" });
    expect(onRadius).toHaveBeenCalledWith({ name: "01310-100", lat: -23.5614, lng: -46.6559 }, 2000);
  });

  it("names an address radius by bairro, city and state", async () => {
    fetchReferencePoint.mockResolvedValue({
      point: { position: { lat: -23.56, lng: -46.65 }, precision: "district", attribution: "IBGE, CNEFE 2022" },
      error: null,
    });
    const onRadius = vi.fn();
    renderInPortuguese(<DistrictList districts={[]} onActivate={vi.fn()} onRadius={onRadius} />);
    const form = openForm();
    fireEvent.change(within(form).getByLabelText("Bairro"), { target: { value: "Bela Vista" } });
    fireEvent.change(within(form).getByLabelText("Cidade"), { target: { value: "São Paulo" } });
    fireEvent.change(within(form).getByLabelText("UF"), { target: { value: "sp" } });
    await act(async () => fireEvent.submit(form));
    expect(onRadius).toHaveBeenCalledWith({ name: "Bela Vista, São Paulo/SP", lat: -23.56, lng: -46.65 }, 1000);
  });

  it("explains the server refusal and draws nothing", async () => {
    fetchReferencePoint.mockResolvedValue({ point: null, error: { code: "reference_not_loaded", status: 422 } });
    const onRadius = vi.fn();
    renderInPortuguese(<DistrictList districts={null} failed onActivate={vi.fn()} onRadius={onRadius} />);
    const form = openForm();
    fireEvent.change(within(form).getByLabelText("CEP"), { target: { value: "20040-002" } });
    await act(async () => fireEvent.submit(form));
    expect(screen.getByRole("alert")).toHaveTextContent("A base de endereços do IBGE ainda não foi carregada para este estado.");
    expect(onRadius).not.toHaveBeenCalled();
  });

  it("asks for a place before calling the server", async () => {
    renderInPortuguese(<DistrictList districts={districts} onActivate={vi.fn()} onRadius={vi.fn()} />);
    const form = openForm();
    await act(async () => fireEvent.submit(form));
    expect(fetchReferencePoint).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Informe um CEP, ou a cidade com a UF.");
  });

  it("is not offered when the viewer cannot draw areas", () => {
    renderInPortuguese(<DistrictList districts={districts} onActivate={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Raio a partir de um endereço ou CEP" })).not.toBeInTheDocument();
  });
});
