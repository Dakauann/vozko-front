
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(() => Promise.resolve(null)),
}));

import { renderMessageContentPreview } from "./index";

function renderPreview(type: string, config: Record<string, unknown>) {
  const node = renderMessageContentPreview(
    type as Parameters<typeof renderMessageContentPreview>[0],
    config,
  );
  return { node, ...render(<>{node}</>) };
}

describe("renderMessageContentPreview registry", () => {
  it("returns undefined for non-message node types (falls through to legacy)", () => {
    expect(
      renderMessageContentPreview(
        "action_http_request" as Parameters<
          typeof renderMessageContentPreview
        >[0],
        {},
      ),
    ).toBeUndefined();
  });

  it("renders the text bubble body", () => {
    renderPreview("action_send_text", { text: "Olá mundo" });
    expect(screen.getByText("Olá mundo")).toBeInTheDocument();
  });

  it("renders the email subject", () => {
    renderPreview("action_send_email", {
      subject: "Fatura disponível",
      body: "<p>Segue em anexo</p>",
    });
    expect(screen.getByText("Fatura disponível")).toBeInTheDocument();
    expect(screen.getByText("Segue em anexo")).toBeInTheDocument();
  });

  it("template: falls back to template_id when the display cache was stripped", () => {
    renderPreview("action_send_template", { template_id: "hello_world" });
    expect(screen.getByText("hello_world")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum template")).toBeNull();
  });

  it("template: shows the empty state only when truly unset", () => {
    renderPreview("action_send_template", {});
    expect(screen.getByText("Nenhum template")).toBeInTheDocument();
  });
});
