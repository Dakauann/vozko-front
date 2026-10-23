import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import rawPt from "@/i18n/messages/pt.json";
import { IMAGE_MEDIA, carouselFixture } from "@/lib/rcs/test-fixtures";
import type { RcsContent } from "@/lib/rcs/types";
import { brandedMessages } from "@/test/branded-messages";

import { RcsAgentProfile } from "./RcsAgentProfile";
import { RcsPhonePreview } from "./RcsPhonePreview";

const pt = brandedMessages(rawPt);
const copy = pt.rcs.preview;
const agent = { name: "Padaria Sol", color: "#E8590C" };

function renderPreview(content: RcsContent, extra: Partial<Parameters<typeof RcsPhonePreview>[0]> = {}) {
  return render(
    <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
      <RcsPhonePreview content={content} agent={agent} {...extra} />
    </NextIntlClientProvider>,
  );
}

describe("RcsPhonePreview", () => {
  it("invites the person to write while the message is empty", () => {
    renderPreview({});
    expect(screen.getByText(copy.empty)).toBeInTheDocument();
    expect(screen.getByText("Padaria Sol")).toBeInTheDocument();
    expect(screen.getByText(copy.verified)).toBeInTheDocument();
  });

  it("renders a text message with its suggestion chips and what each one does", () => {
    renderPreview({
      text: "Seu pedido saiu para entrega.",
      suggestions: [
        { kind: "reply", label: "Obrigado" },
        { kind: "open_url", label: "Rastrear", url: "https://sol.example/r", webview: true },
        { kind: "dial", label: "Ligar", phone: "+5511" },
      ],
    });
    expect(screen.getByText("Seu pedido saiu para entrega.")).toBeInTheDocument();
    const chips = screen.getByRole("list", { name: copy.suggestions });
    expect(within(chips).getAllByRole("listitem")).toHaveLength(3);
    expect(within(chips).getByText(copy.actions.webview)).toBeInTheDocument();
    expect(within(chips).getByText(copy.actions.dial)).toBeInTheDocument();
  });

  it("renders an image with its alt text", () => {
    renderPreview({ media: { ...IMAGE_MEDIA }, text: "Fresquinho" });
    expect(screen.getByRole("img", { name: "pao.jpg" })).toBeInTheDocument();
    expect(screen.getByText("Fresquinho")).toBeInTheDocument();
  });

  it("renders audio and PDF files as labelled tiles", () => {
    const { unmount } = renderPreview({ media: { kind: "audio", url: "https://cdn.example/a.mp3", mime_type: "audio/mpeg" } });
    expect(screen.getByRole("group", { name: copy.media.audio })).toBeInTheDocument();
    unmount();
    renderPreview({ media: { kind: "pdf", url: "https://cdn.example/menu.pdf", mime_type: "application/pdf", name: "cardapio.pdf" } });
    expect(screen.getByText("cardapio.pdf")).toBeInTheDocument();
    expect(screen.getByText(copy.media.pdf)).toBeInTheDocument();
  });

  it("renders a video with a labelled first frame", () => {
    const { container } = renderPreview({ media: { kind: "video", url: "https://cdn.example/v.mp4", mime_type: "video/mp4" } });
    expect(container.querySelector("video")?.getAttribute("aria-label")).toBe(copy.media.video);
  });

  it("shows a placeholder while a media message has no file yet", () => {
    renderPreview({}, { expectsMedia: true });
    expect(screen.getByText(copy.noMedia)).toBeInTheDocument();
  });

  it("renders a rich card with title, text and buttons", () => {
    renderPreview({ cards: [{ media: { ...IMAGE_MEDIA }, title: "Pão de queijo", description: "Seis por 10 reais", suggestions: [{ kind: "reply", label: "Quero" }] }] });
    const card = screen.getByRole("article", { name: copy.richCard });
    expect(within(card).getByRole("heading", { name: "Pão de queijo" })).toBeInTheDocument();
    expect(within(card).getByText("Seis por 10 reais")).toBeInTheDocument();
    expect(within(card).getByRole("list", { name: copy.cardButtons })).toBeInTheDocument();
  });

  it("renders a carousel with one entry per card", () => {
    renderPreview(carouselFixture());
    const carousel = screen.getByRole("list", { name: "Carrossel com 2 cartões" });
    expect(within(carousel).getAllByRole("article")).toHaveLength(2);
    expect(screen.getByRole("article", { name: "Cartão 2 de 2" })).toBeInTheDocument();
  });

  it("fills the personalized fields with the preview values", () => {
    renderPreview({ text: "Oi {{1}}, tudo bem?" }, { values: ["[Primeiro nome]"] });
    expect(screen.getByText("Oi [Primeiro nome], tudo bem?")).toBeInTheDocument();
  });

  it("switches between the Android and iPhone frames", () => {
    const { container } = renderPreview({ text: "Oi" });
    expect(container.querySelector("figcaption")?.textContent).toBe(copy.frame.android);
    fireEvent.click(screen.getByRole("button", { name: pt.carrierMessaging.preview.platforms.ios }));
    expect(container.querySelector("figcaption")?.textContent).toBe(copy.frame.ios);
    expect(screen.getAllByText(copy.stamp.iosChannel).length).toBeGreaterThan(0);
  });
});

describe("RcsAgentProfile", () => {
  it("shows the brand profile with its contact rows", () => {
    render(
      <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
        <RcsAgentProfile agent={{ name: "Padaria Sol", description: "Avisos da Padaria Sol" }} contact={{ website: "https://sol.example", email: "oi@sol.example" }} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Avisos da Padaria Sol")).toBeInTheDocument();
    expect(screen.getByText("https://sol.example")).toBeInTheDocument();
    expect(screen.getByText("oi@sol.example")).toBeInTheDocument();
  });
});
