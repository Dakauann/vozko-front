import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { TemplateHealth } from "@/lib/whatsapp-templates/health";

import { TemplateHealthHistory, TemplateQualityChips } from "../TemplateQuality";

const t = ptMessages.templateHealth;

const pending: TemplateHealth = { templateId: "tpl", status: "APPROVED", category: "MARKETING", quality: "UNKNOWN", flagged: false, changes: [] };

function wrap(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      {node}
    </NextIntlClientProvider>,
  );
}

describe("TemplateQualityChips", () => {
  it("shows a template Meta has not rated as pending, with the reason", () => {
    wrap(<TemplateQualityChips state={{ health: pending, error: false }} />);

    const chip = screen.getByText(t.quality.UNKNOWN);
    expect(chip.closest("[title]")).toHaveAttribute("title", t.qualityHint.UNKNOWN);
    expect(screen.queryByText(t.flagged)).not.toBeInTheDocument();
  });

  it("shows the rating and Meta's flag", () => {
    wrap(<TemplateQualityChips state={{ health: { ...pending, quality: "YELLOW", flagged: true }, error: false }} />);

    expect(screen.getByText(t.quality.YELLOW)).toBeInTheDocument();
    expect(screen.getByText(t.flagged)).toBeInTheDocument();
  });

  it("says when the quality could not be read, never hiding it", () => {
    wrap(<TemplateQualityChips state={{ health: null, error: true }} />);

    expect(screen.getByText(t.unavailable)).toBeInTheDocument();
  });

  it("shows nothing while loading", () => {
    const { container } = wrap(<TemplateQualityChips state={{ health: null, error: false }} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("TemplateHealthHistory", () => {
  it("tells each change in the person's words, newest first", () => {
    wrap(
      <TemplateHealthHistory
        health={{
          ...pending,
          changes: [
            { signal: "status", current: "FLAGGED", previous: "APPROVED", occurredAt: "2026-10-16T13:00:00Z" },
            { signal: "quality", current: "YELLOW", previous: "GREEN", occurredAt: "2026-10-16T12:00:00Z" },
          ],
        }}
      />,
    );

    const items = screen.getAllByRole("listitem").map((item) => item.textContent ?? "");
    expect(items[0]).toContain("Status: de aprovado para sinalizado");
    expect(items[1]).toContain("Qualidade: de alta para média");
  });

  it("says when Meta has recorded nothing yet", () => {
    wrap(<TemplateHealthHistory health={pending} />);

    expect(screen.getByText(t.history.empty)).toBeInTheDocument();
  });
});
