"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import {
  ArrowBendUpLeft,
  ArrowSquareOut,
  ClipboardText,
  CopySimple,
  File as FileIcon,
  Image as ImageIcon,
  ListBullets,
  Phone,
  Video,
  type Icon,
} from "@/components/icons";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  buttonChoice,
  chosenOptionId,
  chosenRow,
  interactiveActions,
  rowChoice,
  type InteractiveChoice,
} from "@/lib/conversations/interactive-message";
import type {
  ConversationMessage,
  InteractiveAction,
  InteractiveActionKind,
  InteractiveContent,
  InteractiveHeader,
  InteractiveSection,
} from "@/lib/conversations/types";
import { cn } from "@/lib/utils";

import { CollapsibleMessageText } from "./message-parts";
import { useThreadRow } from "./thread-context";

export const BUBBLE_ACTION_CLASS =
  "flex w-full items-center justify-center gap-1.5 rounded-[--radius] border border-border bg-card px-3 py-1.5 text-xs font-medium text-primary-ink transition-colors enabled:hover:bg-muted disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const HAIRLINE = "border-black/[0.08] dark:border-white/10";

const ACTION_ROW =
  "flex w-full items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-[#0b6ea8] dark:text-[#8fd0f7] transition-colors enabled:hover:bg-black/[0.04] dark:enabled:hover:bg-white/[0.06] disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

const ACTION_ICON: Record<InteractiveActionKind, Icon> = {
  reply: ArrowBendUpLeft,
  url: ArrowSquareOut,
  phone: Phone,
  copy_code: CopySimple,
  flow: ClipboardText,
};

const MEDIA_ICON = { image: ImageIcon, video: Video, document: FileIcon } as const;

type ChooseOption = ((choice: InteractiveChoice) => void) | undefined;

function HeaderMedia({ header }: { header: InteractiveHeader }) {
  const t = useTranslations("crmConversation.thread");
  if (header.type === "text") return header.text ? <p className="text-sm font-semibold leading-snug">{header.text}</p> : null;
  const label = t(`media.${header.type}`);
  if (header.media_url && header.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={header.media_url} alt={label} loading="lazy" className="max-h-56 w-full rounded-md object-cover" />
    );
  }
  if (header.media_url && header.type === "video") {
    return <video src={header.media_url} controls preload="metadata" aria-label={label} className="max-h-56 w-full rounded-md" />;
  }
  const Icon = MEDIA_ICON[header.type];
  return (
    <div data-interactive-media={header.type} className={cn("flex items-center gap-2 rounded-md border px-3 py-2.5 text-xs text-muted-foreground", HAIRLINE)}>
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function InteractiveMessageBody({ content }: { content: InteractiveContent }) {
  return (
    <div data-interactive-card={content.kind} className="flex min-w-[min(15rem,100%)] flex-col gap-1">
      {content.header ? <HeaderMedia header={content.header} /> : null}
      {content.body ? <CollapsibleMessageText text={content.body} /> : null}
      {content.footer ? <p className="text-xs leading-snug text-muted-foreground">{content.footer}</p> : null}
    </div>
  );
}

function ActionLabel({ action }: { action: InteractiveAction }) {
  const t = useTranslations("crmConversation.thread.interactive");
  const Icon = ACTION_ICON[action.kind];
  return (
    <>
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">{action.title || (action.kind === "copy_code" ? t("copyCode") : "")}</span>
    </>
  );
}

function ActionRow({ action, onChoose }: { action: InteractiveAction; onChoose: ChooseOption }) {
  const t = useTranslations("crmConversation.thread.interactive");
  const choice = buttonChoice(action);
  if (action.kind === "url" && action.url) {
    return (
      <a href={action.url} target="_blank" rel="noopener noreferrer" className={ACTION_ROW}>
        <ActionLabel action={action} />
      </a>
    );
  }
  const choosable = Boolean(onChoose && choice);
  return (
    <button
      type="button"
      disabled={!choosable}
      title={choosable ? undefined : t("choiceHint")}
      onClick={() => choice && onChoose?.(choice)}
      className={ACTION_ROW}
    >
      <ActionLabel action={action} />
    </button>
  );
}

function ActionRows({ children }: { children: ReactNode }) {
  return (
    <div
      data-interactive-actions=""
      className={cn(
        "-mx-3 -mb-2 mt-1.5 flex flex-col divide-y overflow-hidden border-t [border-bottom-left-radius:inherit] [border-bottom-right-radius:inherit]",
        HAIRLINE,
        "divide-black/[0.08] dark:divide-white/10",
      )}
    >
      {children}
    </div>
  );
}

function RadioMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      data-radio-checked={checked}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
        checked ? "border-primary" : "border-muted-foreground/50",
      )}
    >
      {checked ? <span className="size-2.5 rounded-full bg-primary" /> : null}
    </span>
  );
}

function SheetSection({
  section,
  chosenId,
  onChoose,
}: {
  section: InteractiveSection;
  chosenId: string | undefined;
  onChoose: ChooseOption;
}) {
  const t = useTranslations("crmConversation.thread.interactive");
  return (
    <section className="pb-1">
      {section.title ? <h3 className="px-5 pb-1 pt-4 text-xs font-semibold text-primary-ink">{section.title}</h3> : null}
      <div role="radiogroup" aria-label={section.title} className="divide-y divide-border">
        {section.rows.map((row) => {
          const checked = row.id === chosenId;
          return (
            <button
              key={row.id}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={!onChoose}
              onClick={() => onChoose?.(rowChoice(row))}
              className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors enabled:hover:bg-muted disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-foreground">{row.title}</span>
                {row.description ? <span className="block text-xs text-muted-foreground">{row.description}</span> : null}
                {checked ? <span className="mt-0.5 block text-2xs font-medium text-primary-ink">{t("chosen")}</span> : null}
              </span>
              <RadioMark checked={checked} />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ListSheet({
  content,
  chosenId,
  onChoose,
}: {
  content: InteractiveContent;
  chosenId: string | undefined;
  onChoose: ChooseOption;
}) {
  const t = useTranslations("crmConversation.thread.interactive");
  const [open, setOpen] = useState(false);
  const label = content.button_label ?? "";
  const choose = onChoose
    ? (choice: InteractiveChoice) => {
        setOpen(false);
        onChoose(choice);
      }
    : undefined;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ActionRows>
        <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} className={ACTION_ROW}>
          <ListBullets className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{label}</span>
        </button>
      </ActionRows>
      <DialogContent className="max-h-[80vh] max-w-sm gap-0 overflow-y-auto p-0">
        <DialogHeader className="sticky top-0 border-b border-border bg-background px-5 py-4 text-center">
          <DialogTitle className="text-base">{label}</DialogTitle>
          <DialogDescription className="sr-only">{onChoose ? t("sheetChoose") : t("sheetReadOnly")}</DialogDescription>
        </DialogHeader>
        {(content.sections ?? []).map((section, index) => (
          <SheetSection key={`${section.title ?? ""}:${index}`} section={section} chosenId={chosenId} onChoose={choose} />
        ))}
      </DialogContent>
    </Dialog>
  );
}

export function InteractiveMessageActions({ message, content }: { message: ConversationMessage; content: InteractiveContent }) {
  const { onChooseOption, messagesById } = useThreadRow();
  const chosenId = useMemo(() => chosenOptionId(message.id, messagesById.values()), [message.id, messagesById]);
  if (content.kind === "list") return <ListSheet content={content} chosenId={chosenId} onChoose={onChooseOption} />;
  const actions = interactiveActions(content);
  if (actions.length === 0) return null;
  return (
    <ActionRows>
      {actions.map((action, index) => (
        <ActionRow key={`${action.kind}:${action.id ?? action.title}:${index}`} action={action} onChoose={onChooseOption} />
      ))}
    </ActionRows>
  );
}

export function InteractiveReplyText({ message }: { message: ConversationMessage }) {
  const { messagesById } = useThreadRow();
  const prompt = message.reply_to_message_id ? messagesById.get(message.reply_to_message_id) : undefined;
  const row = chosenRow(prompt?.interactive, message.interactive_reply?.option_id);
  return (
    <div data-interactive-reply={message.interactive_reply?.kind} className="flex flex-col">
      {message.text ? <CollapsibleMessageText text={message.text} /> : null}
      {row?.description ? <p className="text-xs leading-snug text-muted-foreground">{row.description}</p> : null}
    </div>
  );
}
