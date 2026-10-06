"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from "@/components/ui/context-menu";
import { findClip } from "@/lib/studio/timeline";

import { useEditorState, useVideoEditor } from "../editor-context";

export type MenuTarget = { kind: "clip"; clipId: string } | { kind: "lane"; trackId: string; atMs: number };

const ITEM = "gap-2 text-xs focus:bg-accent-hover focus:text-foreground";

function Item({ label, shortcut, onSelect, disabled }: { label: string; shortcut?: string; onSelect: () => void; disabled?: boolean }) {
  return (
    <ContextMenuItem className={ITEM} disabled={disabled} onSelect={onSelect}>
      {label}
      {shortcut ? <ContextMenuShortcut className="font-sans text-2xs">{shortcut}</ContextMenuShortcut> : null}
    </ContextMenuItem>
  );
}

export function TimelineContextMenu({ target, children }: { target: MenuTarget | null; children: ReactNode }) {
  const t = useTranslations("studio.video.timeline.menu");
  const { commands, playback } = useVideoEditor();
  const document = useEditorState((s) => s.document);
  const clip = target?.kind === "clip" ? findClip(document, target.clipId)?.clip : null;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-60 border-border-strong">
        {clip ? (
          <>
            <Item label={t("focus")} shortcut="F" onSelect={() => commands.enterFocus(clip.id)} />
            <ContextMenuSeparator />
            <Item label={t("cut")} shortcut="Ctrl+X" onSelect={commands.cut} />
            <Item label={t("copy")} shortcut="Ctrl+C" onSelect={commands.copy} />
            <Item label={t("paste")} shortcut="Ctrl+V" onSelect={() => commands.paste("overwrite")} />
            <Item label={t("duplicate")} shortcut="Ctrl+D" onSelect={commands.duplicate} />
            <Item label={t("split")} shortcut="S" onSelect={commands.split} />
            <ContextMenuSeparator />
            <Item label={t("delete")} shortcut="Delete" onSelect={() => commands.remove(false)} />
            <Item label={t("rippleDelete")} shortcut="Shift+Delete" onSelect={() => commands.remove(true)} />
            <Item label={clip.disabled ? t("enable") : t("disable")} shortcut="D" onSelect={commands.toggleDisabled} />
            <ContextMenuSeparator />
            {clip.linkId ? <Item label={t("unlink")} onSelect={commands.unlink} /> : <Item label={t("link")} onSelect={commands.link} />}
            <Item label={t("relink")} onSelect={commands.relink} />
            <Item label={t("selectForward")} shortcut="Shift+A" onSelect={() => commands.selectForward(clip.id, false)} />
            <Item label={t("selectForwardAll")} shortcut="Ctrl+Shift+A" onSelect={() => commands.selectForward(clip.id, true)} />
            <ContextMenuSeparator />
            <Item label={t("properties")} onSelect={() => commands.selectClip(clip.id, false)} />
          </>
        ) : null}
        {target?.kind === "lane" ? (
          <>
            <Item label={t("paste")} shortcut="Ctrl+V" onSelect={() => commands.paste("overwrite")} />
            <Item label={t("pasteInsert")} shortcut="Ctrl+Shift+V" onSelect={() => commands.paste("insert")} />
            <Item label={t("closeGaps")} onSelect={() => commands.closeAllGaps(target.trackId)} />
            <Item
              label={t("addMarker")}
              shortcut="M"
              onSelect={() => {
                playback.seek(target.atMs);
                commands.addMarker();
              }}
            />
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}
