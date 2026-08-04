"use client";

import { EnvelopeSimple } from "@/components/icons";

// stripHtml flattens an HTML/plain email body to a one-line snippet for preview.
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// action_send_email: an envelope-style card (email is not a chat bubble): sender
// strip on top, then subject, recipient and a short body snippet.
export function SendEmailPreview({
  config,
}: {
  config: Record<string, unknown>;
}) {
  const subject = (config.subject as string) || "";
  const fromName = (config.smtp_from_name as string) || "";
  const fromEmail = (config.smtp_from_email as string) || "";
  const to = (config.to as string) || "";
  const snippet = stripHtml((config.body as string) || "");
  const from = fromName.trim() || fromEmail;

  return (
    <div className="px-2 py-2">
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="flex items-center gap-1.5 border-b border-border bg-muted px-2 py-1">
          <EnvelopeSimple size={12} weight="fill" className="text-lamp-ink" />
          <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-foreground/70">
            {from.trim() || "Remetente"}
          </span>
        </div>
        <div className="px-2 py-1.5">
          <p className="truncate text-[11px] font-semibold text-foreground/80">
            {subject.trim() || "(sem assunto)"}
          </p>
          {to.trim() && (
            <p className="truncate text-[9px] text-muted-foreground">Para: {to}</p>
          )}
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-foreground/60">
            {snippet.trim() || "E-mail sem conteúdo"}
          </p>
        </div>
      </div>
    </div>
  );
}
