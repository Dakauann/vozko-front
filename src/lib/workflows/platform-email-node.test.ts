import { describe, expect, it } from "vitest";

import { PLATFORM_EMAIL_NODE, platformEmailSummary } from "./platform-email-node";

describe("platformEmailSummary", () => {
  it("reads a text email", () => {
    expect(PLATFORM_EMAIL_NODE).toBe("action_send_platform_email");
    expect(
      platformEmailSummary({ subject: " Pedido {{first_name}} ", body_mode: "text", text: "Oi\n\nseu pedido saiu", to: "{{email}}", _display_sender_id: "Vendas <vendas@acme.com.br>" }),
    ).toEqual({ mode: "text", subject: "Pedido {{first_name}}", body: "Oi\n\nseu pedido saiu", designName: "", to: "{{email}}", senderName: "Vendas <vendas@acme.com.br>" });
  });

  it("reads a design email by the name the picker stored", () => {
    expect(platformEmailSummary({ subject: "Oi", body_mode: "design", design_id: "d-1", _display_design_id: "Confirmação", text: "ignored" })).toEqual({
      mode: "design",
      subject: "Oi",
      body: "",
      designName: "Confirmação",
      to: "",
      senderName: "",
    });
  });

  it("treats a missing mode as text, like the backend", () => {
    expect(platformEmailSummary({ text: "Oi" }).mode).toBe("text");
    expect(platformEmailSummary({ body_mode: "pdf", text: "Oi" }).mode).toBe("text");
  });
});
