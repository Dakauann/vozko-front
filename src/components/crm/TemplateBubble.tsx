"use client";

import {
  ArrowSquareOut,
  CopySimple,
  File as FileIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  Phone,
  Play,
  Video,
} from "@/components/icons";

import type { TemplateMessageMetadata } from "@/lib/conversations/types";

export default function TemplateBubble({
  metadata,
}: {
  metadata: TemplateMessageMetadata;
}) {
  const header = metadata.components?.find((c) => c.type === "HEADER");
  const body = metadata.components?.find((c) => c.type === "BODY");
  const footer = metadata.components?.find((c) => c.type === "FOOTER");
  const buttonsComp = metadata.components?.find((c) => c.type === "BUTTONS");

  return (
    <div className="flex flex-col rounded-lg overflow-hidden bg-card border border-border max-w-[320px] shadow-sm">
      {/* Header */}
      {header && (
        <div className="px-3 pt-2.5">
          {header.format === "TEXT" && header.text && (
            <p className="text-[13px] font-semibold text-foreground leading-snug">
              {header.text}
            </p>
          )}
          {header.format === "IMAGE" && (
            <div className="flex items-center justify-center rounded-md bg-muted h-[140px] mb-1">
              {metadata.header_media_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={metadata.header_media_url}
                  alt="Header"
                  className="w-full h-full object-cover rounded-md"
                  loading="lazy"
                />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
          )}
          {header.format === "VIDEO" && (
            <div className="flex items-center justify-center rounded-md bg-muted h-[140px] mb-1">
              {metadata.header_media_url ? (
                <video
                  src={metadata.header_media_url}
                  controls
                  className="w-full h-full object-cover rounded-md"
                  preload="metadata"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <Video className="h-8 w-8" />
                  <span className="text-[10px]">Vídeo</span>
                </div>
              )}
            </div>
          )}
          {header.format === "DOCUMENT" && (
            <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2.5 mb-1">
              <FileIcon className="h-5 w-5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">
                Documento
              </span>
            </div>
          )}
        </div>
      )}

      {/* Body */}
      {body?.text && (
        <div className="px-3 py-1.5">
          <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">
            {body.text}
          </p>
        </div>
      )}

      {/* Footer */}
      {footer?.text && (
        <div className="px-3 pb-1.5">
          <p className="text-[11px] text-muted-foreground leading-snug">
            {footer.text}
          </p>
        </div>
      )}

      {/* Buttons */}
      {buttonsComp?.buttons && buttonsComp.buttons.length > 0 && (
        <div className="border-t border-border mt-1">
          {buttonsComp.buttons.map((btn, idx) => (
            <div
              key={idx}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium text-lamp-ink border-b border-border last:border-b-0 hover:bg-muted transition-colors"
            >
              {btn.type === "URL" && <ArrowSquareOut className="h-3.5 w-3.5" />}
              {btn.type === "PHONE_NUMBER" && <Phone className="h-3.5 w-3.5" />}
              {btn.type === "COPY_CODE" && (
                <CopySimple className="h-3.5 w-3.5" />
              )}
              {btn.type === "QUICK_REPLY" && (
                <LinkIcon className="h-3.5 w-3.5" />
              )}
              <span>{btn.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Template badge */}
      <div className="px-3 py-1 bg-muted border-t border-border">
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">
          Template: {metadata.template_name}
        </span>
      </div>
    </div>
  );
}
