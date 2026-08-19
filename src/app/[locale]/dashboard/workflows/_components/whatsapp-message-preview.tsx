"use client";

import {
  ArrowBendUpLeft,
  Copy,
  List as ListIcon,
  CaretRight,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import {
  ActionRowList,
  ChatSurface,
  MessageBubble,
  centerWithin,
  WA_ACTION_TEXT,
  WA_MUTED_TEXT,
  WA_SURFACE_BG,
  type ActionRowItem,
} from "./message-node-primitives";

// Re-exported so existing importers/tests keep a single entry point.
export { centerWithin };

// ── Config parsing ──────────────────────────────────────────────────────────
// Pure, dependency-free translation of the send-buttons/list node config into a
// structured shape the preview (and its tests) can render. It never throws on
// malformed JSON; it degrades to empty options.

export type InteractiveKind = "button" | "copy_code" | "list";

export interface InteractiveOption {
  /** Stable id echoed back by WhatsApp and used as the node's output handle. */
  id: string;
  title: string;
  description?: string;
  kind: InteractiveKind;
  copyCode?: string;
}

export type InteractiveHeaderType = "" | "text" | "image" | "video";

export interface ParsedInteractive {
  interactiveType: "buttons" | "list";
  headerType: InteractiveHeaderType;
  headerText: string;
  headerMediaUrl: string;
  body: string;
  footer: string;
  listButton: string;
  options: InteractiveOption[];
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function safeParseArray(raw: string): unknown[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseInteractiveConfig(
  config: Record<string, unknown> | undefined,
): ParsedInteractive {
  const c = config ?? {};
  const interactiveType =
    str(c.interactive_type).trim().toLowerCase() === "list" ? "list" : "buttons";

  const options: InteractiveOption[] = [];
  if (interactiveType === "list") {
    for (const section of safeParseArray(str(c.sections))) {
      const s = section as Record<string, unknown>;
      const rows = Array.isArray(s?.rows) ? (s.rows as unknown[]) : [];
      for (const row of rows) {
        const r = row as Record<string, unknown>;
        const id = str(r?.id).trim();
        if (!id) continue;
        options.push({
          id,
          title: str(r?.title),
          description: str(r?.description),
          kind: "list",
        });
      }
    }
  } else {
    for (const button of safeParseArray(str(c.buttons))) {
      const b = button as Record<string, unknown>;
      const id = str(b?.ID).trim();
      if (!id) continue;
      const kind: InteractiveKind =
        b?.Type === "copy_code" ? "copy_code" : "button";
      options.push({
        id,
        title: str(b?.Title),
        kind,
        copyCode: str(b?.CopyCode),
      });
    }
  }

  const rawHeader = str(c.header_type).trim().toLowerCase();
  const headerType: InteractiveHeaderType = (
    ["text", "image", "video"].includes(rawHeader) ? rawHeader : ""
  ) as InteractiveHeaderType;

  return {
    interactiveType,
    headerType,
    headerText: str(c.header_text),
    headerMediaUrl: str(c.header_media_url),
    body: str(c.body),
    footer: str(c.footer),
    listButton: str(c.list_button),
    options,
  };
}

// ── Presentation ────────────────────────────────────────────────────────────
// Faithful, theme-aware render of how the message lands in WhatsApp, composed
// from the shared message-node primitives. Each option row carries data-option-id
// and (via rowRef) a measured element so a node shell can align a source handle.

export interface WhatsAppMessagePreviewProps {
  parsed: ParsedInteractive;
  rowRef?: (el: HTMLDivElement | null, optionId: string) => void;
  className?: string;
}

export function WhatsAppMessagePreview({
  parsed,
  rowRef,
  className,
}: WhatsAppMessagePreviewProps) {
  const { headerType, headerText, headerMediaUrl, body, footer, options } =
    parsed;
  const isList = parsed.interactiveType === "list";

  const media =
    headerType === "image"
      ? ({ url: headerMediaUrl, kind: "image" } as const)
      : headerType === "video"
        ? ({ url: headerMediaUrl, kind: "video" } as const)
        : undefined;

  const buttonRows: ActionRowItem[] = options.map((opt) => ({
    id: opt.id,
    leading:
      opt.kind === "copy_code" ? (
        <Copy size={12} weight="bold" className={WA_ACTION_TEXT} />
      ) : (
        <ArrowBendUpLeft size={12} weight="bold" className={WA_ACTION_TEXT} />
      ),
    primary:
      opt.kind === "copy_code"
        ? opt.copyCode?.trim() || "Copiar código"
        : opt.title.trim() || "Botão",
  }));

  const listRows: ActionRowItem[] = options.map((opt) => ({
    id: opt.id,
    primary: opt.title.trim() || "Opção",
    secondary: opt.description?.trim() || undefined,
    trailing: (
      <CaretRight size={11} weight="bold" className={cn("shrink-0", WA_MUTED_TEXT)} />
    ),
  }));

  return (
    <ChatSurface className={className}>
      <div data-testid="wa-preview">
        <MessageBubble
          media={media}
          headerText={headerType === "text" ? headerText : undefined}
          body={body}
          footer={footer}
        />

        {!isList &&
          (options.length === 0 ? (
            <EmptyOptions label="Nenhum botão" className="mt-1" />
          ) : (
            <ActionRowList rows={buttonRows} variant="buttons" rowRef={rowRef} />
          ))}

        {isList && (
          <div className="mt-1">
            <div
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 shadow-sm",
                WA_SURFACE_BG,
              )}
            >
              <ListIcon size={12} weight="bold" className={WA_ACTION_TEXT} />
              <span className={cn("truncate text-2xs font-medium", WA_ACTION_TEXT)}>
                {parsed.listButton.trim() || "Ver opções"}
              </span>
            </div>
            {options.length === 0 ? (
              <EmptyOptions label="Nenhuma opção" className="mt-1" />
            ) : (
              <ActionRowList rows={listRows} variant="list" rowRef={rowRef} />
            )}
          </div>
        )}
      </div>
    </ChatSurface>
  );
}

function EmptyOptions({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-dashed border-black/15 px-2 py-1.5 text-center dark:border-white/15",
        className,
      )}
    >
      <span className="text-2xs italic text-black/40 dark:text-white/40">
        {label}
      </span>
    </div>
  );
}
