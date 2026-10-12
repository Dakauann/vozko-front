import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/i18n/messages/en.json";
import ptMessages from "@/i18n/messages/pt.json";

import { InspectorGroup, InspectorProvider } from "./inspector-context";
import { InspectorBody, InspectorNav } from "./inspector-nav";
import { InspectorSection } from "./inspector-section";
import type { InspectorScope } from "./inspector-store";

const t = ptMessages.studio.inspector;
const UI = { timeout: 15_000 };

function Panel({ scope = "video", extra = false }: { scope?: InspectorScope; extra?: boolean }) {
  return (
    <InspectorProvider scope={scope}>
      <InspectorNav />
      <InspectorBody>
        <InspectorSection id="timing" title="Tempo" summary="Início 0 s, 4 s">
          <label htmlFor="start">Início</label>
          <input id="start" />
        </InspectorSection>
        <InspectorSection title="Enquadramento">
          <label htmlFor="rotation">Rotação</label>
          <input id="rotation" />
        </InspectorSection>
        <InspectorSection title="Transições">
          <label htmlFor="fade-in">Entrada</label>
          <input id="fade-in" />
        </InspectorSection>
        <InspectorSection title="Texto">
          <label htmlFor="font">Fonte</label>
          <input id="font" />
        </InspectorSection>
        <InspectorGroup id="effects">
          <InspectorSection id="grade" title="Correção de cor">
            <label htmlFor="exposure">Exposição</label>
            <input id="exposure" />
          </InspectorSection>
        </InspectorGroup>
        <InspectorSection title="Velocidade" group="speed">
          <label htmlFor="speed">Velocidade do clipe</label>
          <input id="speed" />
        </InspectorSection>
        {extra ? (
          <InspectorGroup id="cutout">
            <InspectorSection title="Máscaras">
              <label htmlFor="feather">Suavizar borda</label>
              <input id="feather" />
            </InspectorSection>
          </InspectorGroup>
        ) : null}
      </InspectorBody>
    </InspectorProvider>
  );
}

function show(ui: React.ReactNode, messages: typeof ptMessages = ptMessages) {
  return render(
    <NextIntlClientProvider locale={messages === ptMessages ? "pt" : "en"} messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const header = (title: string) => screen.getByRole("button", { name: new RegExp(`^${title}`) });
const tabNames = () => screen.queryAllByRole("tab").map((tab) => tab.textContent);

afterEach(() => vi.restoreAllMocks());

describe("inspector sections", () => {
  it("collapses a section from its header and shows its summary while closed", UI, () => {
    show(<Panel />);
    expect(header("Tempo")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("textbox", { name: "Início" })).toBeVisible();
    fireEvent.click(header("Tempo"));
    expect(header("Tempo")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("textbox", { name: "Início" })).toBeNull();
    expect(header("Tempo")).toHaveTextContent("Início 0 s, 4 s");
    expect(screen.getByRole("region", { name: "Tempo" })).toBeInTheDocument();
  });

  it("remembers which sections are closed per editor across remounts", UI, () => {
    const first = show(<Panel />);
    fireEvent.click(header("Tempo"));
    first.unmount();
    const second = show(<Panel />);
    expect(header("Tempo")).toHaveAttribute("aria-expanded", "false");
    second.unmount();
    show(<Panel scope="image" />);
    expect(header("Tempo")).toHaveAttribute("aria-expanded", "true");
  });

  it("starts open and still folds when the browser refuses storage", UI, () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    show(<Panel />);
    expect(header("Tempo")).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(header("Tempo"));
    expect(header("Tempo")).toHaveAttribute("aria-expanded", "false");
  });

  it("folds with the keyboard and offers reset and enable actions in the header", UI, () => {
    const reset = vi.fn();
    const toggle = vi.fn();
    show(
      <InspectorProvider scope="video">
        <InspectorSection title="Sombra" reset={{ onReset: reset }} toggle={{ checked: false, onChange: toggle }}>
          <p>corpo</p>
        </InspectorSection>
      </InspectorProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: t.reset.replace("{section}", "Sombra") }));
    expect(reset).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("switch", { name: t.enable.replace("{section}", "Sombra") }));
    expect(toggle).toHaveBeenCalledWith(true);
    const fold = header("Sombra");
    fold.focus();
    fireEvent.click(fold);
    expect(screen.queryByText("corpo")).not.toBeVisible();
  });

  it("works on its own outside an inspector panel", UI, () => {
    show(
      <InspectorSection title="Sozinha">
        <p>conteúdo</p>
      </InspectorSection>,
    );
    fireEvent.click(header("Sozinha"));
    expect(screen.queryByText("conteúdo")).not.toBeVisible();
  });
});

describe("inspector tabs", () => {
  it("shows a tab only for the groups that have sections and puts ungrouped sections in the first one", UI, () => {
    show(<Panel />);
    expect(tabNames()).toEqual([t.groups.basic, t.groups.effects, t.groups.speed]);
    expect(screen.getByRole("tab", { name: t.groups.basic })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName(t.groups.basic);
    expect(screen.getByRole("region", { name: "Enquadramento" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Correção de cor" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: t.groups.effects }));
    expect(screen.getByRole("region", { name: "Correção de cor" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Tempo" })).toBeNull();
  });

  it("moves between tabs with the arrow keys and wraps around", UI, () => {
    show(<Panel />);
    const basic = screen.getByRole("tab", { name: t.groups.basic });
    basic.focus();
    fireEvent.keyDown(basic, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: t.groups.effects })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: t.groups.effects })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: t.groups.effects }), { key: "End" });
    expect(screen.getByRole("tab", { name: t.groups.speed })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tab", { name: t.groups.speed }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: t.groups.basic })).toHaveAttribute("aria-selected", "true");
  });

  it("remembers the chosen tab and falls back to the first one when the selection lacks it", UI, () => {
    const first = show(<Panel extra />);
    fireEvent.click(screen.getByRole("tab", { name: t.groups.cutout }));
    first.unmount();
    const second = show(<Panel />);
    expect(tabNames()).not.toContain(t.groups.cutout);
    expect(screen.getByRole("tab", { name: t.groups.basic })).toHaveAttribute("aria-selected", "true");
    second.unmount();
    show(<Panel extra />);
    expect(screen.getByRole("tab", { name: t.groups.cutout })).toHaveAttribute("aria-selected", "true");
  });

  it("labels the tabs in each locale", UI, () => {
    show(<Panel />, enMessages);
    expect(tabNames()).toEqual([enMessages.studio.inspector.groups.basic, enMessages.studio.inspector.groups.effects, enMessages.studio.inspector.groups.speed]);
  });
});

describe("property search", () => {
  it("finds a property in any tab by its label, ignoring accents, and marks it", UI, () => {
    show(<Panel />);
    fireEvent.click(screen.getByRole("tab", { name: t.groups.effects }));
    fireEvent.click(header("Correção de cor"));
    fireEvent.click(screen.getByRole("tab", { name: t.groups.basic }));
    fireEvent.change(screen.getByRole("searchbox", { name: t.search }), { target: { value: "exposicao" } });
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    const grade = screen.getByRole("region", { name: "Correção de cor" });
    expect(within(grade).getByRole("textbox", { name: "Exposição" })).toBeVisible();
    expect(within(grade).getByText("Exposição")).toHaveAttribute("data-search-hit", "true");
    expect(screen.queryByRole("region", { name: "Tempo" })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("1 seção encontrada");
  });

  it("says when nothing matches and returns to the tab and folds after Escape", UI, () => {
    show(<Panel />);
    fireEvent.click(screen.getByRole("tab", { name: t.groups.effects }));
    fireEvent.click(header("Correção de cor"));
    const search = screen.getByRole("searchbox", { name: t.search });
    fireEvent.change(search, { target: { value: "volume" } });
    expect(screen.getByRole("status")).toHaveTextContent(t.noResults.replace("{query}", "volume"));
    expect(screen.queryAllByRole("region")).toHaveLength(0);
    fireEvent.keyDown(search, { key: "Escape" });
    expect(search).toHaveValue("");
    expect(screen.getByRole("tab", { name: t.groups.effects })).toHaveAttribute("aria-selected", "true");
    expect(header("Correção de cor")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Exposição")).not.toHaveAttribute("data-search-hit");
  });

  it("hides the search box while the selection has only a few sections", UI, () => {
    show(
      <InspectorProvider scope="video">
        <InspectorNav />
        <InspectorSection title="Projeto">
          <p>cor de fundo</p>
        </InspectorSection>
      </InspectorProvider>,
    );
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });

  it("matches section titles too and clears from the button", UI, () => {
    show(<Panel />);
    fireEvent.change(screen.getByRole("searchbox", { name: t.search }), { target: { value: "veloc" } });
    expect(screen.getByRole("region", { name: "Velocidade" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.clearSearch }));
    expect(screen.getByRole("searchbox", { name: t.search })).toHaveValue("");
    expect(screen.getByRole("tab", { name: t.groups.basic })).toHaveAttribute("aria-selected", "true");
  });
});
