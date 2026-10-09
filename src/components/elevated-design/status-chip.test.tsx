import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { CampaignStatusChip } from "@/components/campaigns/CampaignStatusChip";

import { StatusChip } from "./status-chip";

describe("StatusChip", () => {
  it("renders the label with the classes of its tone", () => {
    render(<StatusChip tone="healthy" label="Ganho" />);

    expect(screen.getByText("Ganho").className).toContain("bg-healthy");
  });

  it("draws a glyph before the label when one is given", () => {
    render(<StatusChip tone="muted" label="Bairro" icon={<svg data-testid="glyph" aria-hidden />} />);

    const chip = screen.getByText("Bairro");
    expect(chip.firstElementChild).toBe(screen.getByTestId("glyph"));
    expect(chip.className).toContain("gap-1");
  });

  it("draws an outlined chip for the outline tone", () => {
    render(<StatusChip tone="outline" label="Aberto" />);

    expect(screen.getByText("Aberto").className).toContain("border-border");
  });

  it("keeps the campaign chip on the same shape, by status", () => {
    render(<CampaignStatusChip status="RUNNING" label="Em execução" />);

    const chip = screen.getByText("Em execução");
    expect(chip.className).toContain("bg-healthy");
    expect(chip.className).toContain("rounded-[--radius]");
  });
});
