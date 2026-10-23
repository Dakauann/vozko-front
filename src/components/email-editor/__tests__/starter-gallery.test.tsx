import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";

import { StarterGallery } from "../starter-gallery";
import { STARTERS } from "./fixtures";

describe("StarterGallery", () => {
  it("renders a thumbnail and a name for every starter and hands back a copy", () => {
    const onPick = vi.fn();
    render(
      <NextIntlClientProvider locale="pt" messages={pt}>
        <StarterGallery starters={STARTERS} onPick={onPick} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("list", { name: "Modelos para começar" })).toBeInTheDocument();
    for (const name of ["Em branco", "Boletim de novidades", "Promoção", "Comunicado", "Convite para evento"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.getAllByText("Novidades do mês").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Promoção"));
    const picked = onPick.mock.calls[0][0];
    expect(picked).toEqual(STARTERS[2].document);
    expect(picked).not.toBe(STARTERS[2].document);
  });
});
