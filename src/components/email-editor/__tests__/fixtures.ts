import type { Block, Document, Settings, Starter } from "@/lib/email-design/types";

function settings(accent: string, preheader: string): Settings {
  return {
    width: 600,
    background_color: "#f4f4f5",
    content_background_color: "#ffffff",
    text_color: "#1f2937",
    link_color: accent,
    button_color: accent,
    button_text_color: "#ffffff",
    font_family: "inter",
    preheader,
  };
}

function footer(): Block {
  return {
    id: "footer",
    kind: "footer",
    footer: { company_name: "Sua empresa", address: "Endereço da sua empresa", text: "Você recebe este email porque se cadastrou para receber nossas novidades." },
  };
}

function heading(id: string, text: string, level: number): Block {
  return { id, kind: "heading", heading: { text, level, align: "left" } };
}

function text(id: string, ...paragraphs: string[]): Block {
  return { id, kind: "text", text: { paragraphs: paragraphs.map((value) => ({ runs: [{ text: value }] })), align: "left" } };
}

export function blankStarter(): Document {
  return { version: 1, settings: settings("#2563eb", ""), blocks: [text("text", "Escreva sua mensagem aqui."), footer()] };
}

export function newsletterStarter(): Document {
  return {
    version: 1,
    settings: settings("#2563eb", "As novidades que separamos para você este mês"),
    blocks: [
      { id: "top", kind: "spacer", spacer: { height: 16 } },
      heading("title", "Novidades do mês", 1),
      text("intro", "Olá, {{first_name|cliente}}! Separamos o que aconteceu de mais importante por aqui."),
      { id: "divider-1", kind: "divider", divider: { color: "#e5e7eb", thickness: 1 } },
      { id: "highlight-button", kind: "button", button: { label: "Leia mais", href: "https://example.com", align: "center" } },
      {
        id: "stories",
        kind: "columns",
        columns: {
          ratio: "50-50",
          columns: [{ blocks: [heading("story-1-title", "Segunda notícia", 3), text("story-1-text", "Um resumo curto com o essencial.")] }, { blocks: [heading("story-2-title", "Terceira notícia", 3)] }],
        },
      },
      {
        id: "social",
        kind: "social",
        social: {
          align: "center",
          links: [
            { network: "instagram", url: "https://instagram.com" },
            { network: "facebook", url: "https://facebook.com" },
          ],
        },
      },
      footer(),
    ],
  };
}

export function promotionStarter(): Document {
  return {
    version: 1,
    settings: settings("#dc2626", "Uma oferta por tempo limitado"),
    blocks: [
      { id: "offer", kind: "heading", padding: "l", background_color: "#fef2f2", heading: { text: "20% de desconto", level: 1, align: "center", color: "#dc2626" } },
      text("details", "{{first_name|Cliente}}, use o cupom OFERTA20 na finalização da compra.", "Válido enquanto durarem os estoques."),
      { id: "cta", kind: "button", button: { label: "Aproveitar agora", href: "https://example.com", align: "center", full_width: true } },
      { id: "hero", kind: "image", image: { src: "", alt: "", width: 100 } },
      footer(),
    ],
  };
}

export const STARTERS: Starter[] = [
  { key: "blank", document: blankStarter() },
  { key: "newsletter", document: newsletterStarter() },
  { key: "promotion", document: promotionStarter() },
  { key: "announcement", document: blankStarter() },
  { key: "event", document: newsletterStarter() },
];
