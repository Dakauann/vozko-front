import { automationFixture } from "@/lib/carrier-messaging/test-fixtures";
import type { RcsContent, RcsSender } from "@/lib/rcs/types";

export function senderFixture(overrides: Partial<RcsSender> = {}): RcsSender {
  return {
    id: "snd-1",
    brand_name: "Padaria Sol",
    description: "Avisos de pedidos da Padaria Sol.",
    suggested_description: "A plataforma envia atualizações de pedidos e avisos em nome de Padaria Sol.",
    logo_url: "https://cdn.example/logo.png",
    banner_url: "https://cdn.example/banner.png",
    color: "#E8590C",
    use_case: "transactional",
    sector: "retail",
    gambling_authorization_url: "",
    contact_name: "Ana Souza",
    contact_email: "ana@padariasol.com.br",
    contact_phone: "+5511999990000",
    website_url: "https://padariasol.com.br",
    privacy_url: "https://padariasol.com.br/privacidade",
    terms_url: "https://padariasol.com.br/termos",
    cnpj: "11222333000181",
    billing_category: "non_conversational",
    status: "launched",
    status_reason: "",
    paused_by: "",
    pause_reason: "",
    submitted_at: "2026-10-20T12:00:00Z",
    launched_at: "2026-10-21T09:00:00Z",
    paused_at: null,
    created_at: "2026-10-19T12:00:00Z",
    can_send: true,
    editable: false,
    can_resume: false,
    department_id: null,
    pipeline_id: null,
    automation: automationFixture(),
    ...overrides,
  };
}

export const IMAGE_MEDIA = { kind: "image", url: "https://cdn.example/pao.jpg", mime_type: "image/jpeg", name: "pao.jpg" } as const;

export function carouselFixture(): RcsContent {
  return {
    cards: [
      {
        media: { ...IMAGE_MEDIA },
        title: "Pão de fermentação natural",
        description: "Saiu do forno agora.",
        suggestions: [{ kind: "open_url", label: "Ver cardápio", url: "https://padariasol.com.br/cardapio" }],
      },
      {
        title: "Café da manhã completo",
        description: "Para duas pessoas.",
        suggestions: [{ kind: "reply", label: "Quero" }],
      },
    ],
    suggestions: [{ kind: "dial", label: "Ligar", phone: "+5511999990000" }],
  };
}
