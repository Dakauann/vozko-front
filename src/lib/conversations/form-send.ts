import type { SendCopy } from "@/lib/whatsapp-forms/types";

export const FORM_COPY_LIMITS = { header: 60, body: 1024, footer: 60, cta: 30 } as const;

export interface FormCopyDraft {
  header: string;
  body: string;
  footer: string;
  cta: string;
}

export function formCopyOf(draft: FormCopyDraft): SendCopy {
  const header = draft.header.trim();
  const footer = draft.footer.trim();
  return {
    ...(header ? { header } : {}),
    body: draft.body.trim(),
    ...(footer ? { footer } : {}),
    cta: draft.cta.trim(),
  };
}
