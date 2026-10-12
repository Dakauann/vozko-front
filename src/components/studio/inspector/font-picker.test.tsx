import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { fontsIn } from "@/lib/studio/fonts";

import { FontPicker } from "./font-picker";

const t = ptMessages.studio.fontPicker;

function setup(value: Parameters<typeof FontPicker>[0]["value"] = "inter") {
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <FontPicker label="Fonte" value={value} mixedLabel="Vários" onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return { onChange, trigger: screen.getByRole("combobox", { name: "Fonte" }) };
}

function open(trigger: HTMLElement) {
  fireEvent.click(trigger);
  return screen.getByRole("listbox");
}

describe("the font picker", () => {
  it("shows the current family drawn in its own face", () => {
    const { trigger } = setup("playfair-display");
    expect(trigger).toHaveTextContent("Playfair Display");
    expect(within(trigger).getByText("Playfair Display").style.fontFamily).toContain("Playfair Display");
  });

  it("says when the selection mixes fonts", () => {
    const { trigger } = setup(null);
    expect(trigger).toHaveTextContent("Vários");
  });

  it("lists all fifty families and filters them by name, accents ignored", () => {
    const { trigger } = setup();
    const list = open(trigger);
    expect(within(list).getAllByRole("option")).toHaveLength(50);
    fireEvent.change(screen.getByRole("searchbox", { name: t.search }), { target: { value: "garamond" } });
    expect(within(list).getAllByRole("option").map((option) => option.querySelector(".sr-only")?.textContent)).toEqual(["EB Garamond", "Cormorant Garamond"]);
  });

  it("filters by category chip and by the category name typed in the search", () => {
    const { trigger } = setup();
    const list = open(trigger);
    fireEvent.click(screen.getByRole("button", { name: t.categories.handwriting }));
    expect(within(list).getAllByRole("option")).toHaveLength(fontsIn("handwriting").length);
    fireEvent.click(screen.getByRole("button", { name: t.all }));
    fireEvent.change(screen.getByRole("searchbox", { name: t.search }), { target: { value: "monoespacadas" } });
    expect(within(list).getAllByRole("option")).toHaveLength(fontsIn("mono").length);
  });

  it("picks with the keyboard from the search field", () => {
    const { trigger, onChange } = setup();
    open(trigger);
    const field = screen.getByRole("searchbox", { name: t.search });
    fireEvent.change(field, { target: { value: "pac" } });
    fireEvent.keyDown(field, { key: "ArrowDown" });
    fireEvent.keyDown(field, { key: "ArrowUp" });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("pacifico");
  });

  it("draws each family name from the shared sprite instead of downloading every font", () => {
    const { trigger } = setup();
    const list = open(trigger);
    const rows = list.querySelectorAll<HTMLElement>("[data-font-sprite]");
    expect(rows).toHaveLength(50);
    expect(rows[1].style.maskPosition).toBe("0 -28px");
    expect(within(list).getAllByRole("option").every((option) => !option.innerHTML.includes("font-family"))).toBe(true);
  });

  it("picks with a click and says so when nothing matches", () => {
    const { trigger, onChange } = setup();
    const list = open(trigger);
    fireEvent.click(within(list).getByRole("option", { name: "Lobster" }));
    expect(onChange).toHaveBeenCalledWith("lobster");
    open(trigger);
    fireEvent.change(screen.getByRole("searchbox", { name: t.search }), { target: { value: "comic" } });
    expect(screen.getByRole("status")).toHaveTextContent("comic");
  });
});
