import { emptyFormBuilder, type FormBuilderState, type LeadForm } from "@/lib/advertising/forms";

export type ChatChannel = "whatsapp" | "messenger" | "instagram";

export type DestinationView =
  | { kind: "chat"; channel: ChatChannel; greeting: string; iceBreakers: string[] }
  | { kind: "form"; formId: string }
  | { kind: "website"; link: string; address: string }
  | { kind: "app" }
  | { kind: "post" }
  | { kind: "none" };

export interface DestinationSource {
  greeting?: string;
  iceBreakers?: string[];
  leadFormId?: string;
  link?: string;
  displayLink?: string;
}

const CHAT_CHANNELS: Record<string, ChatChannel> = {
  WHATSAPP: "whatsapp",
  MESSENGER: "messenger",
  INSTAGRAM_DIRECT: "instagram",
};

function hostOf(link: string): string {
  try {
    return new URL(link).host;
  } catch {
    return link;
  }
}

export function destinationView(destination: string, source: DestinationSource): DestinationView {
  const channel = CHAT_CHANNELS[destination];
  if (channel) {
    return {
      kind: "chat",
      channel,
      greeting: (source.greeting ?? "").trim(),
      iceBreakers: (source.iceBreakers ?? []).map((breaker) => breaker.trim()).filter(Boolean),
    };
  }
  switch (destination) {
    case "ON_AD":
      return { kind: "form", formId: source.leadFormId ?? "" };
    case "WEBSITE":
    case "CATALOG": {
      const link = (source.link ?? "").trim();
      return { kind: "website", link, address: (source.displayLink ?? "").trim() || (link ? hostOf(link) : "") };
    }
    case "APP":
      return { kind: "app" };
    case "ON_POST":
      return { kind: "post" };
  }
  return { kind: "none" };
}

export function formPreviewState(form: LeadForm): FormBuilderState {
  return {
    ...emptyFormBuilder(),
    name: form.name,
    privacyUrl: form.privacyUrl ?? "",
    questions: (form.questions ?? []).map((question, index) => ({
      id: `${form.metaId}-${index}`,
      type: question.type,
      label: question.label ?? "",
      options: question.options ?? [],
    })),
  };
}
