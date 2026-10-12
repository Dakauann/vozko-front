"use client";

import { useId, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { EloMark } from "@/components/ai-chat/elo-mark";
import { ArrowsInSimple, ChatText, Globe, ImageSquare, Lightning, Microphone, NotePencil, PencilSimple, Shuffle, Sparkle, SpeakerHigh, Waveform } from "@/components/icons";
import { ContextMenuItem, ContextMenuShortcut, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger } from "@/components/ui/context-menu";
import type { AiActionIcon, AiActionState } from "@/lib/studio/ai-actions";
import { cn } from "@/lib/utils";

export interface AiActionEntry {
  state: AiActionState;
  run: () => void;
}

const ICONS: Record<AiActionIcon, (props: { className?: string }) => ReactNode> = {
  cutout: (props) => <Sparkle aria-hidden {...props} />,
  edit: (props) => <PencilSimple aria-hidden {...props} />,
  variation: (props) => <Shuffle aria-hidden {...props} />,
  denoise: (props) => <Waveform aria-hidden {...props} />,
  captions: (props) => <ChatText aria-hidden {...props} />,
  music: (props) => <SpeakerHigh aria-hidden {...props} />,
  voice: (props) => <Microphone aria-hidden {...props} />,
  sfx: (props) => <Lightning aria-hidden {...props} />,
  image: (props) => <ImageSquare aria-hidden {...props} />,
  rewrite: (props) => <NotePencil aria-hidden {...props} />,
  translate: (props) => <Globe aria-hidden {...props} />,
  shorten: (props) => <ArrowsInSimple aria-hidden {...props} />,
  elo: (props) => <EloMark {...props} />,
};

function AiActionItem({ entry, className }: { entry: AiActionEntry; className?: string }) {
  const t = useTranslations("studio.aiActions");
  const noteId = useId();
  const { definition, enabled, reason } = entry.state;
  const label = t(`items.${definition.id}`);
  const note = reason ? t(`blocked.${reason}`) : definition.cost === "elo" ? null : t(`cost.${definition.cost}`);
  const Icon = ICONS[definition.icon];
  return (
    <ContextMenuItem
      aria-label={label}
      aria-disabled={enabled ? undefined : true}
      aria-describedby={note ? noteId : undefined}
      title={reason ? note ?? undefined : undefined}
      data-ai-action={definition.id}
      className={cn("gap-2", !enabled && "text-muted-foreground", className)}
      onSelect={(event) => {
        if (!enabled) {
          event.preventDefault();
          return;
        }
        entry.run();
      }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{label}</span>
        {reason ? (
          <span id={noteId} className="text-2xs text-muted-foreground">
            {note}
          </span>
        ) : null}
      </span>
      {!reason && note ? (
        <ContextMenuShortcut id={noteId} className="font-sans text-2xs">
          {note}
        </ContextMenuShortcut>
      ) : null}
      {definition.shortcut ? <ContextMenuShortcut className="font-sans text-2xs">{definition.shortcut}</ContextMenuShortcut> : null}
    </ContextMenuItem>
  );
}

export function AiActionsSubmenu({ entries, className }: { entries: readonly AiActionEntry[]; className?: string }) {
  const t = useTranslations("studio.aiActions");
  if (entries.length === 0) return null;
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger className={cn("gap-2", className)}>
        <Sparkle className="h-4 w-4 shrink-0" aria-hidden />
        {t("menu")}
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="w-72">
        {entries.map((entry) => (
          <AiActionItem key={entry.state.definition.id} entry={entry} className={className} />
        ))}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}
