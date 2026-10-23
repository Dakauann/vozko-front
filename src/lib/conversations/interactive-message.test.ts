import { describe, expect, it } from "vitest";

import { buttonChoice, chosenOptionId, chosenRow, interactiveActions, rowChoice } from "./interactive-message";
import type { ConversationMessage, InteractiveContent } from "./types";

const LIST: InteractiveContent = {
  kind: "list",
  body: "Selecione",
  button_label: "Ver opções",
  sections: [{ title: "Atendimento", rows: [{ id: "agendar", title: "Agendar consulta", description: "Escolha o dia" }, { id: "outros", title: "Outros" }] }],
};

function reply(id: string, promptId: string, optionId: string, at: string): ConversationMessage {
  return {
    id,
    entry_id: "e",
    entry_type: "unofficial_whatsapp",
    channel: "unofficial_whatsapp",
    message_type: "user_message",
    direction: "INBOUND",
    from: "5511",
    to: "biz",
    text: optionId,
    sender_name: "",
    read: true,
    read_at: null,
    read_by: null,
    reply_to_message_id: promptId,
    interactive_reply: { kind: "option", option_id: optionId },
    created_at: at,
    updated_at: at,
  };
}

describe("interactive message helpers", () => {
  it("turns only reply buttons into choices the simulator can send", () => {
    expect(buttonChoice({ kind: "reply", id: "sim", title: "Sim" })).toEqual({ kind: "button", id: "sim", title: "Sim" });
    expect(buttonChoice({ kind: "url", title: "Site", url: "https://exemplo.com" })).toBeNull();
    expect(buttonChoice({ kind: "reply", title: "Sem id" })).toBeNull();
    expect(rowChoice({ id: "agendar", title: "Agendar consulta", description: "x" })).toEqual({ kind: "list", id: "agendar", title: "Agendar consulta" });
  });

  it("draws action rows for buttons and templates, never for a list", () => {
    expect(interactiveActions(LIST)).toEqual([]);
    expect(interactiveActions({ kind: "template", body: "Oi", buttons: [{ kind: "url", title: "Site" }] })).toHaveLength(1);
    expect(interactiveActions({ kind: "buttons", body: "Oi" })).toEqual([]);
  });

  it("finds the latest option the contact chose for a prompt", () => {
    const messages = [
      reply("r1", "prompt-1", "outros", "2026-10-23T16:32:10Z"),
      reply("r2", "prompt-1", "agendar", "2026-10-23T16:32:32Z"),
      reply("r3", "prompt-2", "outros", "2026-10-23T16:40:00Z"),
    ];
    expect(chosenOptionId("prompt-1", messages)).toBe("agendar");
    expect(chosenOptionId("prompt-3", messages)).toBeUndefined();
    expect(chosenRow(LIST, "agendar")?.description).toBe("Escolha o dia");
    expect(chosenRow(LIST, "nada")).toBeUndefined();
    expect(chosenRow(undefined, "agendar")).toBeUndefined();
  });
});
