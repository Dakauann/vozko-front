import { describe, expect, it } from "vitest";

import { nodeSummary } from "./node-summary";

describe("nodeSummary", () => {
  it("keeps the text of a send text node for the zoomed out card", () => {
    expect(nodeSummary("action_send_text", { text: "Olá!\nVeja os planos" })).toEqual({ text: "Olá!\nVeja os planos" });
  });

  it("gives an interactive message its header and body, since the options are labelled at their handles", () => {
    const buttons = JSON.stringify([{ ID: "planos", Title: "Planos" }]);
    expect(nodeSummary("action_send_interactive", { header_type: "text", header_text: "Academia", body: "Como posso ajudar?", buttons })).toEqual({ heading: "Academia", text: "Como posso ajudar?" });
    expect(nodeSummary("action_send_whatsapp_button", { body: "Escolha" })).toEqual({ text: "Escolha" });
  });

  it("names the template and lists its first parameters", () => {
    expect(nodeSummary("action_send_template", { _display_template_id: "boas_vindas", params: { nome: "Ana", unidade: "" } })).toEqual({ heading: "boas_vindas", text: "nome: Ana" });
    expect(nodeSummary("action_send_template", { template_id: "lembrete" })).toEqual({ heading: "lembrete" });
  });

  it("shows the email subject and the body without markup", () => {
    expect(nodeSummary("action_send_email", { subject: "Confirmado", body: "<p>Sua aula&nbsp;está <b>confirmada</b></p>" })).toEqual({ heading: "Confirmado", text: "Sua aula está confirmada" });
  });

  it("shows the platform email subject with its text or the saved design name", () => {
    expect(nodeSummary("action_send_platform_email", { subject: "Pedido", body_mode: "text", text: "Seu pedido saiu" })).toEqual({ heading: "Pedido", text: "Seu pedido saiu" });
    expect(nodeSummary("action_send_platform_email", { subject: "Pedido", body_mode: "design", design_id: "d-1", _display_design_id: "Confirmação", text: "x" })).toEqual({ heading: "Pedido", text: "Confirmação" });
  });

  it("shows the form header and body, falling back to the form name", () => {
    expect(nodeSummary("action_send_form", { form_id: "f1", _display_form_id: "Matrícula", body: "Preencha seus dados" })).toEqual({ heading: "Matrícula", text: "Preencha seus dados" });
    expect(nodeSummary("action_send_form", { form_id: "f1", header: "Inscrição", body: "Dados" })).toEqual({ heading: "Inscrição", text: "Dados" });
  });

  it("names the agent, or the model and instructions of a prompt agent", () => {
    expect(nodeSummary("action_ai_agent", { _display_agent_id: "Consultora" })).toEqual({ heading: "Consultora" });
    expect(nodeSummary("action_ai_agent", { source: "prompt", model: "gpt-4o-mini", instructions: "Responda curto" })).toEqual({ heading: "gpt-4o-mini", text: "Responda curto" });
  });

  it("lists the fields returned to the agent", () => {
    expect(nodeSummary("action_reply_to_agent", { fields: [{ key: "status", value: "ok" }, { key: "", value: "x" }, { key: "plano", value: "anual" }] })).toEqual({ text: "status: ok\nplano: anual" });
  });

  it("keeps the caption of a media node next to its thumbnail", () => {
    expect(nodeSummary("action_send_media", { caption: "Tabela de preços" })).toEqual({ text: "Tabela de preços" });
  });

  it("summarises common logic nodes in one line", () => {
    expect(nodeSummary("action_set_variable", { variable: "etapa", value: "2" })).toEqual({ text: "etapa = 2" });
    expect(nodeSummary("action_http_request", { method: "post", url: "https://api.test/x" })).toEqual({ text: "POST https://api.test/x" });
  });

  it("has nothing to say for empty messages or nodes it does not know", () => {
    expect(nodeSummary("action_send_text", { text: "   " })).toBeNull();
    expect(nodeSummary("wait_duration", { seconds: 60 })).toBeNull();
  });
});
