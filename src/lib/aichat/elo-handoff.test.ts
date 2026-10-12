import { describe, expect, it, vi } from "vitest";

import { createHandoffChannel, handoffPrompt, mergeDraft, type EloHandoff } from "./elo-handoff";

const handoff: EloHandoff = { projectId: "p-1", prompt: "Sobre a seleção: \"Título\" (Texto, id l_1)\nReescreva este texto.", attachments: [] };

describe("the Elo hand-off channel", () => {
  it("delivers a hand-off to the dock that listens", () => {
    const channel = createHandoffChannel();
    const listener = vi.fn();
    channel.listen(listener);
    channel.send(handoff);
    expect(listener).toHaveBeenCalledWith(handoff);
  });

  it("keeps a hand-off sent before the dock listens and delivers it once", () => {
    const channel = createHandoffChannel();
    channel.send(handoff);
    const listener = vi.fn();
    channel.listen(listener);
    expect(listener).toHaveBeenCalledTimes(1);
    const late = vi.fn();
    channel.listen(late);
    expect(late).not.toHaveBeenCalled();
  });

  it("keeps only the latest hand-off while nobody listens", () => {
    const channel = createHandoffChannel();
    channel.send({ ...handoff, prompt: "primeiro" });
    channel.send(handoff);
    const listener = vi.fn();
    channel.listen(listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(handoff);
  });

  it("stops delivering after the dock stops listening", () => {
    const channel = createHandoffChannel();
    const listener = vi.fn();
    const stop = channel.listen(listener);
    stop();
    channel.send(handoff);
    expect(listener).not.toHaveBeenCalled();
    const next = vi.fn();
    channel.listen(next);
    expect(next).toHaveBeenCalledWith(handoff);
  });
});

describe("the prefilled composer draft", () => {
  it("puts the context first and the instruction last, so the caret lands after it", () => {
    expect(handoffPrompt("Sobre a seleção: x", "Traduza este texto para ")).toBe("Sobre a seleção: x\nTraduza este texto para ");
    expect(handoffPrompt("Sobre a seleção: x")).toBe("Sobre a seleção: x\n");
  });

  it("fills an empty composer and keeps what the person already typed", () => {
    expect(mergeDraft("", "novo")).toBe("novo");
    expect(mergeDraft("   ", "novo")).toBe("novo");
    expect(mergeDraft("meu rascunho  ", "novo")).toBe("meu rascunho\n\nnovo");
  });
});
