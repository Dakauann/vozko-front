import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { nextIntlInPortuguese } from "@/test/next-intl-pt";

vi.mock("next-intl", () => nextIntlInPortuguese());
vi.mock("@/app/actions/medias", () => ({ getMediaAction: vi.fn(() => Promise.resolve(null)) }));

import { renderMessageContentPreview } from "./index";

const copy = ptMessages.workflowsPage.platformEmailNode;

describe("platform email node preview", () => {
  it("shows the chosen sender, the subject, the recipient and the text", () => {
    render(<>{renderMessageContentPreview("action_send_platform_email", { _display_sender_id: "Vendas", subject: "Pedido saiu", to: "a@b.com", body_mode: "text", text: "Oi Ana" })}</>);
    expect(screen.getByText("Vendas")).toBeInTheDocument();
    expect(screen.getByText("Pedido saiu")).toBeInTheDocument();
    expect(screen.getByText(copy.to.replace("{to}", "a@b.com"))).toBeInTheDocument();
    expect(screen.getByText("Oi Ana")).toBeInTheDocument();
  });

  it("falls back to the default sender, the lead email and the design label", () => {
    render(<>{renderMessageContentPreview("action_send_platform_email", { body_mode: "design", design_id: "d-1" })}</>);
    expect(screen.getByText(copy.defaultSender)).toBeInTheDocument();
    expect(screen.getByText(copy.noSubject)).toBeInTheDocument();
    expect(screen.getByText(copy.to.replace("{to}", copy.leadEmail))).toBeInTheDocument();
    expect(screen.getByText(copy.design)).toBeInTheDocument();
  });
});
