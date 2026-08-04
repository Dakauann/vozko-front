"use client";

import { ChatText, CursorClick, Lightning, Plus } from "@/components/icons";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetFooter,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import type {
  MessageShortcut,
  ShortcutMessageType,
} from "@/lib/message-shortcuts/types";
import {
  createMessageShortcutAction,
  updateMessageShortcutAction,
} from "@/app/actions/message-shortcuts";
import { useEffect, useMemo, useState, useTransition } from "react";

import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { IconBox } from "@/components/elevated-design/listing-card";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

interface ButtonDraft {
  id: string;
  title: string;
}

interface MessageShortcutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingShortcut?: MessageShortcut | null;
  defaultShortcut?: string;
  onSaved?: (shortcut: MessageShortcut) => void | Promise<void>;
}

let btnCounter = 0;

function newButton(): ButtonDraft {
  return {
    id: `btn_${Date.now()}_${++btnCounter}`,
    title: "",
  };
}

function sanitizeShortcut(value: string) {
  return value.replace(/^\/+/, "").replace(/[^a-zA-Z0-9_-]/g, "");
}

export default function MessageShortcutSheet({
  open,
  onOpenChange,
  editingShortcut,
  defaultShortcut,
  onSaved,
}: MessageShortcutSheetProps) {
  const t = useTranslations("messageShortcutsPage");
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [messageType, setMessageType] = useState<ShortcutMessageType>("text");
  const [bodyText, setBodyText] = useState("");
  const [headerType, setHeaderType] = useState("");
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [buttons, setButtons] = useState<ButtonDraft[]>([]);
  const [isSaving, startSaving] = useTransition();

  useEffect(() => {
    if (!open) return;

    if (editingShortcut) {
      setName(editingShortcut.name);
      setShortcut(editingShortcut.shortcut);
      setMessageType(editingShortcut.messageType);
      setBodyText(editingShortcut.content.text || "");
      setHeaderType(editingShortcut.content.headerType || "");
      setHeaderText(editingShortcut.content.headerText || "");
      setFooterText(editingShortcut.content.footerText || "");
      setButtons(
        editingShortcut.content.buttons?.map((button) => ({
          id: button.id,
          title: button.title,
        })) || [],
      );
      return;
    }

    setName("");
    setShortcut(sanitizeShortcut(defaultShortcut || ""));
    setMessageType("text");
    setBodyText("");
    setHeaderType("");
    setHeaderText("");
    setFooterText("");
    setButtons([]);
  }, [defaultShortcut, editingShortcut, open]);

  const canSubmit = useMemo(
    () =>
      name.trim().length > 0 &&
      shortcut.trim().length > 0 &&
      bodyText.trim().length > 0,
    [bodyText, name, shortcut],
  );

  const handleSave = () => {
    if (!canSubmit) return;

    const normalizedShortcut = sanitizeShortcut(shortcut);
    const normalizedHeaderText = headerText.trim();
    const activeHeaderType = normalizedHeaderText ? headerType || "text" : "";
    const content = {
      text: bodyText.trim(),
      ...(messageType === "button"
        ? {
            headerType: activeHeaderType || undefined,
            headerText: normalizedHeaderText || undefined,
            footerText: footerText.trim() || undefined,
            buttons: buttons
              .filter((button) => button.title.trim())
              .map((button) => ({
                id: button.id,
                title: button.title.trim(),
              })),
          }
        : {}),
    };

    startSaving(async () => {
      const result = editingShortcut
        ? await updateMessageShortcutAction(editingShortcut.id, {
            name: name.trim(),
            shortcut: normalizedShortcut,
            messageType,
            content,
          })
        : await createMessageShortcutAction({
            name: name.trim(),
            shortcut: normalizedShortcut,
            messageType,
            content,
          });

      if (result.error || !result.shortcut) {
        toast({
          title: t("toast.error"),
          description: result.error || t("toast.error"),
          variant: "destructive",
        });
        return;
      }

      toast({
        title: editingShortcut ? t("toast.updated") : t("toast.created"),
        description: editingShortcut
          ? t("toast.updatedDescription", { shortcut: normalizedShortcut })
          : t("toast.createdDescription", { shortcut: normalizedShortcut }),
      });

      onOpenChange(false);
      await onSaved?.(result.shortcut);
    });
  };

  return (
    <ElevatedSheet open={open} onOpenChange={onOpenChange}>
      <ElevatedSheetContent side="right" className="w-full sm:max-w-[560px]">
        <ElevatedSheetHeader>
          <div className="flex items-start gap-4 pr-10">
            <IconBox
              color={editingShortcut ? "amber" : "primary"}
              size="md"
              animated={false}
            >
              <Lightning weight="fill" />
            </IconBox>
            <div className="min-w-0 flex-1">
              <ElevatedSheetTitle>
                {editingShortcut
                  ? t("modal.editTitle")
                  : t("modal.createTitle")}
              </ElevatedSheetTitle>
              <ElevatedSheetDescription>
                {editingShortcut
                  ? t("modal.editSubtitle")
                  : t("modal.createSubtitle")}
              </ElevatedSheetDescription>
            </div>
          </div>
        </ElevatedSheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="space-y-5">
            <div className="rounded-[--radius] border border-border bg-background p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-[--radius] bg-primary px-3 py-1 text-[11px] font-semibold uppercase text-primary-foreground">
                  /{shortcut || t("modal.shortcutPlaceholder")}
                </span>
                <span className="rounded-[--radius] border border-border px-3 py-1 text-[11px] font-semibold uppercase text-muted-foreground">
                  {messageType === "button"
                    ? t("modal.typeButton")
                    : t("modal.typeText")}
                </span>
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">
                {name || t("modal.namePlaceholder")}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground whitespace-pre-wrap">
                {bodyText || t("modal.bodyTextPlaceholder")}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <ElevatedInput
                label={t("modal.name")}
                placeholder={t("modal.namePlaceholder")}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <ElevatedInput
                label={t("modal.shortcut")}
                placeholder={t("modal.shortcutPlaceholder")}
                value={shortcut}
                onChange={(event) =>
                  setShortcut(sanitizeShortcut(event.target.value))
                }
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
                {t("modal.type")}
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  {
                    value: "text" as const,
                    label: t("modal.typeText"),
                    icon: ChatText,
                  },
                  {
                    value: "button" as const,
                    label: t("modal.typeButton"),
                    icon: CursorClick,
                  },
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMessageType(value)}
                    className={cn(
                      "rounded-[--radius] border px-4 py-3 text-left transition-all",
                      messageType === value
                        ? "border-primary bg-muted"
                        : "border-border bg-background hover:border-primary/30",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <IconBox
                        color={value === "button" ? "blue" : "primary"}
                        size="sm"
                        animated={false}
                      >
                        <Icon weight="fill" />
                      </IconBox>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {label}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <ElevatedTextarea
              label={t("modal.bodyText")}
              placeholder={t("modal.bodyTextPlaceholder")}
              value={bodyText}
              onChange={(event) => setBodyText(event.target.value)}
              autoResize
              maxHeight={220}
            />

            {messageType === "button" ? (
              <div className="space-y-4 rounded-[--radius] border border-border bg-background p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <ElevatedInput
                    label={t("modal.headerText")}
                    placeholder={t("modal.headerTextPlaceholder")}
                    value={headerText}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setHeaderText(nextValue);
                      setHeaderType(nextValue.trim() ? "text" : "");
                    }}
                  />
                  <ElevatedInput
                    label={t("modal.footerText")}
                    placeholder={t("modal.footerTextPlaceholder")}
                    value={footerText}
                    onChange={(event) => setFooterText(event.target.value)}
                  />
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">
                      {t("modal.buttonsLabel")}
                    </label>
                    {buttons.length < 3 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setButtons((current) => [...current, newButton()])
                        }
                        title={t("modal.addButton")}
                        icon={<Plus weight="bold" className="h-3.5 w-3.5" />}
                        iconVisible
                      />
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    {buttons.map((button, index) => (
                      <div key={button.id} className="flex items-center gap-2">
                        <ElevatedInput
                          placeholder={t("modal.buttonPlaceholder", {
                            index: index + 1,
                          })}
                          value={button.title}
                          onChange={(event) => {
                            const next = [...buttons];
                            next[index] = {
                              ...button,
                              title: event.target.value,
                            };
                            setButtons(next);
                          }}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setButtons((current) =>
                              current.filter((item) => item.id !== button.id),
                            )
                          }
                          icon={
                            <Plus
                              weight="bold"
                              className="h-3.5 w-3.5 rotate-45"
                            />
                          }
                          iconVisible
                          aria-label={t("delete.confirm")}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <ElevatedSheetFooter>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              title={t("modal.cancel")}
              disabled={isSaving}
            />
            <Button
              onClick={handleSave}
              title={
                isSaving
                  ? t("modal.saving")
                  : editingShortcut
                    ? t("modal.save")
                    : t("modal.create")
              }
              disabled={isSaving || !canSubmit}
            />
          </div>
        </ElevatedSheetFooter>
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}
