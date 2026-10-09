import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";

import { GeoSummaryPanel } from "../GeoSummaryPanel";
import { renderInPortuguese } from "./intl";

const summary = {
  total: 1204,
  onMap: 903,
  approximate: 1611,
  withoutAddress: 1117,
  notFound: 214,
  pending: 96,
  quotaExceeded: 0,
  refused: 0,
};

const colour = {
  field: "Interesse",
  rows: [
    { key: "Matriculado", label: "Matriculado", count: 612, tone: "chart-2" as const },
    { key: "Interessado", label: "Interessado", count: 301, tone: "chart-3" as const },
    { key: "", label: null, count: 203, tone: "neutral" as const },
  ],
};

describe("GeoSummaryPanel", () => {
  it("leads with the count of the filter", () => {
    renderInPortuguese(<GeoSummaryPanel summary={summary} areaNames={[]} />);
    const panel = screen.getByRole("complementary", { name: "Resumo do mapa" });
    expect(within(panel).getByText("Neste filtro")).toBeInTheDocument();
    expect(within(panel).getByText("1.204")).toBeInTheDocument();
    expect(within(panel).getByText("leads neste filtro")).toBeInTheDocument();
  });

  it("names the drawn area when one narrows the filter", () => {
    renderInPortuguese(<GeoSummaryPanel summary={summary} areaNames={["Região Norte"]} />);
    expect(screen.getByText("Nesta área")).toBeInTheDocument();
    expect(screen.getByText("leads em Região Norte")).toBeInTheDocument();
  });

  it("counts the areas when several narrow the filter", () => {
    renderInPortuguese(<GeoSummaryPanel summary={summary} areaNames={["Norte", "Sul"]} />);
    expect(screen.getByText("leads em 2 áreas")).toBeInTheDocument();
  });

  it("breaks the filter down by the colour field with labels and counts, never colour alone", () => {
    renderInPortuguese(<GeoSummaryPanel summary={summary} areaNames={[]} colour={colour} />);
    const section = screen.getByRole("region", { name: "Colorido por Interesse" });
    const rows = within(section).getAllByRole("listitem").map((row) => row.textContent);
    expect(rows).toEqual(["Matriculado612", "Interessado301", "Não informado203"]);
  });

  it("lists what is off the map, each with its count", () => {
    renderInPortuguese(<GeoSummaryPanel summary={summary} areaNames={[]} />);
    const section = screen.getByRole("region", { name: "Fora do mapa neste filtro" });
    const rows = within(section).getAllByRole("listitem").map((row) => row.textContent);
    expect(rows).toEqual([
      "Aproximados (CEP, bairro, cidade)1.611",
      "Sem endereço1.117",
      "Endereço não localizado214",
      "Aguardando localização96",
    ]);
  });

  it("lists the addresses the provider refused, with their count, only when there are any", () => {
    renderInPortuguese(<GeoSummaryPanel summary={{ ...summary, refused: 7 }} areaNames={[]} />);
    const section = screen.getByRole("region", { name: "Fora do mapa neste filtro" });
    const rows = within(section).getAllByRole("listitem").map((row) => row.textContent);
    expect(rows.at(-1)).toBe("Recusados pelo provedor de localização7");
  });

  it("turns every off-map count into a link to the leads it counts", () => {
    const actions = { approximate: vi.fn(), withoutAddress: vi.fn(), notFound: vi.fn(), pending: vi.fn(), refused: vi.fn() };
    renderInPortuguese(<GeoSummaryPanel summary={{ ...summary, refused: 7 }} areaNames={[]} offMapActions={actions} />);
    fireEvent.click(screen.getByRole("button", { name: /Listar na tabela os leads aproximados/ }));
    fireEvent.click(screen.getByRole("button", { name: /Listar na tabela os leads sem endereço/ }));
    fireEvent.click(screen.getByRole("button", { name: /Listar na tabela os endereços não localizados/ }));
    fireEvent.click(screen.getByRole("button", { name: /Listar na tabela os leads aguardando localização/ }));
    fireEvent.click(screen.getByRole("button", { name: /Listar na tabela os endereços recusados/ }));
    for (const action of Object.values(actions)) expect(action).toHaveBeenCalledTimes(1);
  });

  it("keeps a count without somewhere to go as plain text", () => {
    renderInPortuguese(<GeoSummaryPanel summary={summary} areaNames={[]} offMapActions={{ withoutAddress: vi.fn() }} />);
    expect(screen.queryByRole("button", { name: /Endereço não localizado/ })).not.toBeInTheDocument();
  });

  it("says how many approximate leads the drawn area left out and lists them", () => {
    const onList = vi.fn();
    const districts = [
      { pair: "sp:sao paulo/se", cityKey: "sp:sao paulo", districtKey: "se", name: "Sé", city: "São Paulo", state: "SP", count: 6 },
      { pair: "sp:sao paulo/bela vista", cityKey: "sp:sao paulo", districtKey: "bela vista", name: "Bela Vista", city: "São Paulo", state: "SP", count: 3 },
    ];
    renderInPortuguese(<GeoSummaryPanel summary={summary} areaNames={["Região Norte"]} leftOut={{ counts: { total: 37, districts }, onList }} />);
    expect(screen.getByText("37 leads aproximados ficaram fora da área desenhada.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Listar os 37 aproximados fora da área na tabela" }));
    expect(onList).toHaveBeenLastCalledWith();
    const byDistrict = screen.getByRole("button", { name: "Ver por bairro" });
    expect(byDistrict).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(byDistrict);
    const list = screen.getByRole("list", { name: "Aproximados fora da área, por bairro" });
    expect(within(list).getAllByRole("listitem").map((row) => row.textContent)).toEqual(["SéSão Paulo6", "Bela VistaSão Paulo3"]);
    fireEvent.click(within(list).getByRole("button", { name: "Listar na tabela os 6 aproximados de Sé fora da área" }));
    expect(onList).toHaveBeenLastCalledWith("sp:sao paulo/se");
  });

  it("names the areas when several left leads out", () => {
    renderInPortuguese(<GeoSummaryPanel summary={summary} areaNames={["Norte", "Sul"]} leftOut={{ counts: { total: 1, districts: [] } }} />);
    expect(screen.getByText("1 lead aproximado ficou fora das áreas desenhadas.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Listar os/ })).not.toBeInTheDocument();
  });

  it("says when no approximate lead was left out", () => {
    renderInPortuguese(<GeoSummaryPanel summary={summary} areaNames={["Norte"]} leftOut={{ counts: { total: 0, districts: [] } }} />);
    expect(screen.getByText("Nenhum lead aproximado ficou fora da área desenhada.")).toBeInTheDocument();
  });

  it("shows the left-out failure with a retry instead of a zero", () => {
    const onRetry = vi.fn();
    renderInPortuguese(<GeoSummaryPanel summary={summary} areaNames={["Norte"]} leftOut={{ counts: null, failed: true, onRetry }} />);
    expect(screen.getByText("Não foi possível contar os aproximados fora da área.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the failure with a retry instead of zero counts", () => {
    const onRetry = vi.fn();
    renderInPortuguese(<GeoSummaryPanel summary={null} areaNames={[]} failed onRetry={onRetry} />);
    expect(screen.getByText("Não foi possível carregar as contagens deste filtro.")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("says when the server is busy", () => {
    renderInPortuguese(<GeoSummaryPanel summary={null} areaNames={[]} failed busy onRetry={vi.fn()} />);
    expect(screen.getByText("Muitas consultas ao mesmo tempo. Tente de novo em alguns segundos.")).toBeInTheDocument();
  });

  it("keeps the colour failure apart from the counts", () => {
    renderInPortuguese(<GeoSummaryPanel summary={summary} areaNames={[]} colour={{ field: "Interesse", rows: [], failed: true }} />);
    expect(screen.getByText("Não foi possível carregar as contagens por Interesse.")).toBeInTheDocument();
    expect(screen.getByText("1.204")).toBeInTheDocument();
  });

  it("renders the bairro list it is given", () => {
    renderInPortuguese(
      <GeoSummaryPanel summary={summary} areaNames={[]}>
        <p>Lista de bairros</p>
      </GeoSummaryPanel>,
    );
    expect(screen.getByText("Lista de bairros")).toBeInTheDocument();
  });
});
