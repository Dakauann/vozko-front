import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { AskTurn } from "@/lib/aichat/ask";
import type { AskCard } from "@/lib/aichat/types";

import { AskCardView, AskTurnContext } from "./ask-card";

const single: AskCard = {
  kind: "ask",
  questions: [{ text: "Qual o próximo passo?", options: [{ label: "Exportar o vídeo" }, { label: "Colocar música", detail: "Trilha e efeitos" }] }],
};

const form: AskCard = {
  kind: "ask",
  questions: [
    { text: "Onde vai rodar?", options: [{ label: "Stories 9:16", detail: "Vertical, tela cheia" }, { label: "Feed 4:5" }] },
    { text: "Quais cores?", options: [{ label: "Cores da marca" }, { label: "Pode escolher" }] },
  ],
};

function renderCard(card: AskCard, turn: AskTurn | null) {
  return render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <AskTurnContext.Provider value={turn}>
        <AskCardView card={card} />
      </AskTurnContext.Provider>
    </NextIntlClientProvider>,
  );
}

function option(name: RegExp) {
  return screen.getByRole("button", { name });
}

describe("ask card with one question", () => {
  it("sends the tapped option at once and folds into the answer", () => {
    const answer = vi.fn(() => true);
    renderCard(single, { state: "open", answer });
    expect(screen.getByText("Trilha e efeitos")).toBeInTheDocument();
    fireEvent.click(option(/Colocar música/));
    expect(answer).toHaveBeenCalledWith("Colocar música");
    const summary = screen.getByRole("region", { name: "Respondido" });
    expect(within(summary).getByText("Colocar música")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Exportar o vídeo/ })).not.toBeInTheDocument();
  });

  it("picks an option with its number key and moves between options with the arrows", () => {
    const answer = vi.fn(() => true);
    renderCard(single, { state: "open", answer });
    const first = option(/Exportar o vídeo/);
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(option(/Colocar música/)).toHaveFocus();
    fireEvent.keyDown(option(/Colocar música/), { key: "1" });
    expect(answer).toHaveBeenCalledWith("Exportar o vídeo");
  });

  it("sends a written answer from its own field", () => {
    const answer = vi.fn(() => true);
    renderCard(single, { state: "open", answer });
    const field = screen.getByLabelText("Outra resposta");
    fireEvent.change(field, { target: { value: "Passar para 9:16" } });
    fireEvent.submit(field);
    expect(answer).toHaveBeenCalledWith("Passar para 9:16");
  });

  it("keeps the card open when the chat cannot take the answer yet", () => {
    const answer = vi.fn(() => false);
    renderCard(single, { state: "open", answer });
    fireEvent.click(option(/Exportar o vídeo/));
    expect(screen.queryByRole("region", { name: "Respondido" })).not.toBeInTheDocument();
  });

  it("disables every choice when there is no one to answer", () => {
    renderCard(single, { state: "open", answer: null });
    expect(option(/Exportar o vídeo/)).toBeDisabled();
    expect(screen.getByLabelText("Outra resposta")).toBeDisabled();
  });

  it("still shows a single question stored before forms existed", () => {
    renderCard({ kind: "ask", question: { text: "Para onde vai?", options: ["Reels", "Feed"] } }, { state: "open", answer: vi.fn(() => true) });
    expect(screen.getByText("Para onde vai?")).toBeInTheDocument();
    expect(option(/Reels/)).toBeEnabled();
  });
});

describe("ask card with a short form", () => {
  it("walks through each question and sends every answer together", () => {
    const answer = vi.fn(() => true);
    renderCard(form, { state: "open", answer });
    expect(screen.getByText("Pergunta 1 de 2")).toBeInTheDocument();
    fireEvent.click(option(/Stories 9:16/));
    expect(screen.getByText("Pergunta 2 de 2")).toBeInTheDocument();
    expect(answer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Você decide" }));
    expect(screen.getByText("Confira as respostas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Enviar respostas/ }));
    expect(answer).toHaveBeenCalledWith("Onde vai rodar?\nStories 9:16\n\nQuais cores?\nVocê decide");
    const summary = screen.getByRole("region", { name: "Respondido" });
    expect(within(summary).getByText("Stories 9:16")).toBeInTheDocument();
    expect(within(summary).getByText("Você decide")).toBeInTheDocument();
  });

  it("lets an answer be changed from the review before sending", () => {
    const answer = vi.fn(() => true);
    renderCard(form, { state: "open", answer });
    fireEvent.click(option(/Feed 4:5/));
    fireEvent.click(option(/Cores da marca/));
    fireEvent.click(screen.getByRole("button", { name: "Alterar a resposta de: Onde vai rodar?" }));
    expect(option(/Feed 4:5/)).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(option(/Stories 9:16/));
    fireEvent.click(screen.getByRole("button", { name: /Enviar respostas/ }));
    expect(answer).toHaveBeenCalledWith("Onde vai rodar?\nStories 9:16\n\nQuais cores?\nCores da marca");
  });

  it("jumps between questions from the progress steps", () => {
    renderCard(form, { state: "open", answer: vi.fn(() => true) });
    fireEvent.click(screen.getByRole("button", { name: "Ir para a pergunta 2" }));
    expect(screen.getByText("Quais cores?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir para a pergunta 2" })).toHaveAttribute("aria-current", "step");
  });

  it("shows the answers read back from the reply once the person answered", () => {
    renderCard(form, { state: "answered", reply: "Onde vai rodar?\nFeed 4:5\n\nQuais cores?\nPode escolher" });
    const summary = screen.getByRole("region", { name: "Respondido" });
    expect(within(summary).getByText("Feed 4:5")).toBeInTheDocument();
    expect(within(summary).getByText("Pode escolher")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("closes without claiming answers when the person replied something else", () => {
    renderCard(form, { state: "answered", reply: "faz do seu jeito" });
    expect(screen.queryByRole("region", { name: "Respondido" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Perguntas da Elo" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
