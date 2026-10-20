import { describe, expect, it } from "vitest";

import { readInteractiveMessage } from "./interactive-message";

describe("readInteractiveMessage", () => {
  it("reads reply buttons with their header and footer, each button a choice with its id", () => {
    expect(
      readInteractiveMessage({
        buttons: {
          header_text: "Matrícula",
          body_text: "Quer continuar?",
          footer_text: "Responda abaixo",
          buttons: [
            { id: "sim", title: "Sim" },
            { id: "nao", title: "Não" },
          ],
        },
      }),
    ).toEqual({
      kind: "buttons",
      header: "Matrícula",
      footer: "Responda abaixo",
      choices: [
        { kind: "button", id: "sim", title: "Sim" },
        { kind: "button", id: "nao", title: "Não" },
      ],
    });
  });

  it("prefers the list over the flattened buttons a list message also carries, so rows keep their sections", () => {
    expect(
      readInteractiveMessage({
        buttons: { body_text: "Escolha", buttons: [{ id: "a", title: "Manhã" }] },
        list: {
          body_text: "Escolha",
          button_text: "Ver turnos",
          sections: [
            { title: "Presencial", rows: [{ id: "a", title: "Manhã", description: "8h às 12h" }] },
            { rows: [{ id: "b", title: "Noite" }] },
          ],
        },
      }),
    ).toEqual({
      kind: "list",
      buttonText: "Ver turnos",
      sections: [
        { title: "Presencial", rows: [{ kind: "list", id: "a", title: "Manhã", description: "8h às 12h" }] },
        { rows: [{ kind: "list", id: "b", title: "Noite" }] },
      ],
    });
  });

  it("drops choices without an id or a title, since the channel could not deliver them as a selection", () => {
    expect(
      readInteractiveMessage({ buttons: { body_text: "x", buttons: [{ id: "", title: "Sem id" }, { id: "ok", title: "" }, { id: "y", title: "Sim" }] } }),
    ).toEqual({ kind: "buttons", choices: [{ kind: "button", id: "y", title: "Sim" }] });
  });

  it("is not interactive without any deliverable choice, a missing block or malformed metadata", () => {
    expect(readInteractiveMessage({ buttons: { body_text: "x", buttons: [] } })).toBeNull();
    expect(readInteractiveMessage({ list: { body_text: "x", button_text: "Ver", sections: [{ rows: [] }] } })).toBeNull();
    expect(readInteractiveMessage({ template_name: "boas_vindas" })).toBeNull();
    expect(readInteractiveMessage(undefined)).toBeNull();
    expect(readInteractiveMessage({ buttons: "sim" })).toBeNull();
  });
});
