"use client";

import {
  ChatText,
  CursorClick,
  Image,
  Lightning,
  PencilSimple,
  Trash,
  Warning,
} from "@/components/icons";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import {
  deleteMessageShortcutAction,
  listMessageShortcutsAction,
} from "@/app/actions/message-shortcuts";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { IconBox } from "@/components/elevated-design/listing-card";
import type { MessageShortcut } from "@/lib/message-shortcuts/types";
import MessageShortcutSheet from "@/components/message-shortcuts/MessageShortcutSheet";
import { cn } from "@/lib/utils";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

function getShortcutIcon(type: string) {
  switch (type) {
    case "button":
      return CursorClick;
    case "media":
      return Image;
    default:
      return ChatText;
  }
}

function getShortcutColor(type: string) {
  switch (type) {
    case "button":
      return "amber" as const;
    case "media":
      return "blue" as const;
    default:
      return "primary" as const;
  }
}

function getShortcutTypeLabel(
  type: string,
  t: ReturnType<typeof useTranslations>,
) {
  switch (type) {
    case "button":
      return t("modal.typeButton");
    case "media":
      return t("modal.typeMedia");
    default:
      return t("modal.typeText");
  }
}

export default function MessageShortcutsPage() {
  const { toast } = useToast();
  const t = useTranslations("messageShortcutsPage");
  const { can, currentWorkspace, permissionsLoading } = useWorkspace();
  const [shortcuts, setShortcuts] = useState<MessageShortcut[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedShortcutId, setSelectedShortcutId] = useState<string | null>(
    null,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingShortcut, setEditingShortcut] =
    useState<MessageShortcut | null>(null);
  const [deletingShortcut, setDeletingShortcut] =
    useState<MessageShortcut | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  const canRead = can("message_shortcuts", "read");
  const canCreate = can("message_shortcuts", "create");
  const canUpdate = can("message_shortcuts", "update");
  const canDelete = can("message_shortcuts", "delete");

  const load = useCallback(
    async (preferredId?: string) => {
      setLoading(true);
      const result = await listMessageShortcutsAction();
      if (result.error) {
        toast({
          title: t("toast.error"),
          description: result.error,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const nextShortcuts = result.shortcuts;
      setShortcuts(nextShortcuts);
      setSelectedShortcutId((current) => {
        if (
          preferredId &&
          nextShortcuts.some((item) => item.id === preferredId)
        ) {
          return preferredId;
        }
        if (current && nextShortcuts.some((item) => item.id === current)) {
          return current;
        }
        return nextShortcuts[0]?.id ?? null;
      });
      setLoading(false);
    },
    [t, toast],
  );

  useEffect(() => {
    load();
  }, [load]);

  const filteredShortcuts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return shortcuts;
    }

    return shortcuts.filter((shortcut) => {
      const previewText =
        shortcut.content.text || shortcut.content.headerText || "";
      return (
        shortcut.shortcut.toLowerCase().includes(query) ||
        shortcut.name.toLowerCase().includes(query) ||
        previewText.toLowerCase().includes(query)
      );
    });
  }, [search, shortcuts]);

  const selectedShortcut = useMemo(
    () =>
      filteredShortcuts.find((item) => item.id === selectedShortcutId) ||
      shortcuts.find((item) => item.id === selectedShortcutId) ||
      null,
    [filteredShortcuts, selectedShortcutId, shortcuts],
  );

  const stats = useMemo(
    () => [
      {
        label: t("stats.total"),
        value: String(shortcuts.length),
        helper: t("stats.totalHelper"),
        color: "slate" as const,
        icon: <Lightning weight="fill" className="h-5 w-5" />,
      },
      {
        label: t("stats.text"),
        value: String(
          shortcuts.filter((item) => item.messageType === "text").length,
        ),
        helper: t("stats.textHelper"),
        color: "primary" as const,
        icon: <ChatText weight="fill" className="h-5 w-5" />,
      },
      {
        label: t("stats.button"),
        value: String(
          shortcuts.filter((item) => item.messageType === "button").length,
        ),
        helper: t("stats.buttonHelper"),
        color: "amber" as const,
        icon: <CursorClick weight="fill" className="h-5 w-5" />,
      },
    ],
    [shortcuts, t],
  );

  const openCreate = () => {
    setEditingShortcut(null);
    setSheetOpen(true);
  };

  const openEdit = (shortcut: MessageShortcut) => {
    setEditingShortcut(shortcut);
    setSelectedShortcutId(shortcut.id);
    setSheetOpen(true);
  };

  const handleSheetChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) {
      setEditingShortcut(null);
    }
  };

  const handleDelete = () => {
    if (!deletingShortcut) {
      return;
    }

    startDeleting(async () => {
      const result = await deleteMessageShortcutAction(deletingShortcut.id);
      if (result.error) {
        toast({
          title: t("toast.error"),
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: t("toast.deleted"),
        description: t("toast.deletedDescription"),
      });

      const deletedId = deletingShortcut.id;
      setDeletingShortcut(null);
      await load(
        selectedShortcutId === deletedId
          ? undefined
          : (selectedShortcutId ?? undefined),
      );
    });
  };

  if (!permissionsLoading && !canRead) {
    return (
      <div
        className="mx-auto mt-8 max-w-2xl rounded-[--radius] border border-border bg-card p-12 text-center"
        style={{ boxShadow: softSurfaceShadow }}
      >
        <IconBox color="amber" size="lg" className="mx-auto" animated={false}>
          <Warning weight="fill" />
        </IconBox>
        <p className="mt-4 font-semibold text-foreground">
          {t("noAccess.title")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("noAccess.description")}
        </p>
      </div>
    );
  }

  return (
    <>
      <main className="w-full space-y-4">
        <DashboardPageHeader
          icon={<Lightning weight="fill" className="h-6 w-6" />}
          badge={t("header.badge")}
          description={t("header.description")}
          actions={
            canCreate ? (
              <Button
                onClick={openCreate}
                title={t("newButton")}
                icon={<Lightning weight="fill" className="h-4 w-4" />}
                iconVisible
              />
            ) : undefined
          }
        />

        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-[--radius] border border-border bg-card p-5"
              style={{ boxShadow: softSurfaceShadow }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-2xs font-semibold text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-2 font-display text-2xl font-semibold text-foreground">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stat.helper}
                  </p>
                </div>
                <IconBox color={stat.color} size="md" animated={false}>
                  {stat.icon}
                </IconBox>
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div
            className="rounded-[--radius] border border-border bg-card px-6 py-16"
            style={{ boxShadow: softSurfaceShadow }}
          >
            <div className="flex items-center justify-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border border-border-strong border-t-transparent" />
              <span className="text-sm text-muted-foreground">
                {t("loading")}
              </span>
            </div>
          </div>
        ) : shortcuts.length === 0 ? (
          <div
            className="rounded-[--radius] border border-border bg-card px-6 py-16 text-center"
            style={{ boxShadow: softSurfaceShadow }}
          >
            <IconBox
              color="primary"
              size="lg"
              className="mx-auto"
              animated={false}
            >
              <Lightning weight="fill" />
            </IconBox>
            <h2 className="mt-4 font-display text-lg font-semibold tracking-[0.01em] text-foreground">
              {t("empty.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("empty.description")}
            </p>
            {canCreate ? (
              <Button
                className="mt-5"
                onClick={openCreate}
                title={t("empty.createButton")}
                icon={<Lightning weight="fill" className="h-4 w-4" />}
                iconVisible
              />
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <section
              className="space-y-4 rounded-[--radius] border border-border bg-card p-5"
              style={{ boxShadow: softSurfaceShadow }}
            >
              <ElevatedInput
                label={t("filters.search")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("filters.searchPlaceholder")}
              />

              <div className="rounded-[--radius] border border-border bg-background px-4 py-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  {t("filters.workspaceLabel")}
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {currentWorkspace?.name || t("filters.workspaceFallback")}
                </p>
              </div>

              <div className="space-y-3">
                {filteredShortcuts.length === 0 ? (
                  <div className="rounded-[--radius] border border-dashed border-border bg-background px-4 py-10 text-center">
                    <ChatText
                      className="mx-auto h-8 w-8 text-muted-foreground"
                      weight="fill"
                    />
                    <p className="mt-3 text-sm font-medium text-foreground">
                      {t("filters.noResultsTitle")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("filters.noResultsDescription")}
                    </p>
                  </div>
                ) : (
                  filteredShortcuts.map((shortcut) => {
                    const Icon = getShortcutIcon(shortcut.messageType);
                    const isSelected = shortcut.id === selectedShortcut?.id;

                    return (
                      <button
                        key={shortcut.id}
                        type="button"
                        onClick={() => setSelectedShortcutId(shortcut.id)}
                        className={cn(
                          "w-full rounded-[--radius] border px-4 py-4 text-left transition-all",
                          isSelected
                            ? "border-primary bg-muted"
                            : "border-border bg-background hover:border-primary/30 hover:bg-background",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <IconBox
                            color={getShortcutColor(shortcut.messageType)}
                            size="sm"
                            animated={false}
                          >
                            <Icon weight="fill" />
                          </IconBox>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">
                                  /{shortcut.shortcut}
                                </p>
                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                  {shortcut.name}
                                </p>
                              </div>
                              <span className="rounded-[--radius] border border-border px-2.5 py-1 text-2xs font-semibold text-muted-foreground">
                                {getShortcutTypeLabel(shortcut.messageType, t)}
                              </span>
                            </div>
                            <p className="mt-3 line-clamp-2 text-xs text-muted-foreground whitespace-pre-wrap">
                              {shortcut.content.text ||
                                shortcut.content.headerText ||
                                t("detail.emptyMessage")}
                            </p>
                            {shortcut.messageType === "button" &&
                            shortcut.content.buttons?.length ? (
                              <p className="mt-3 text-2xs font-medium text-foreground">
                                {t("card.buttons", {
                                  count: shortcut.content.buttons.length,
                                })}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <section
              className="space-y-4 rounded-[--radius] border border-border bg-card p-5"
              style={{ boxShadow: softSurfaceShadow }}
            >
              {selectedShortcut ? (
                <>
                  <div className="rounded-[--radius] border border-border bg-background p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex items-start gap-3">
                        <IconBox
                          color={getShortcutColor(selectedShortcut.messageType)}
                          size="lg"
                          animated={false}
                        >
                          {(() => {
                            const Icon = getShortcutIcon(
                              selectedShortcut.messageType,
                            );
                            return <Icon weight="fill" />;
                          })()}
                        </IconBox>
                        <div>
                          <p className="text-xs font-semibold text-primary-ink">
                            {t("detail.badge")}
                          </p>
                          <h2 className="mt-2 font-display text-2xl font-semibold tracking-[0.01em] text-foreground">
                            /{selectedShortcut.shortcut}
                          </h2>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {selectedShortcut.name}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {canUpdate ? (
                          <Button
                            variant="outline"
                            onClick={() => openEdit(selectedShortcut)}
                            title={t("detail.editButton")}
                            icon={
                              <PencilSimple weight="bold" className="h-4 w-4" />
                            }
                            iconVisible
                          />
                        ) : null}
                        {canDelete ? (
                          <Button
                            variant="outline"
                            onClick={() =>
                              setDeletingShortcut(selectedShortcut)
                            }
                            title={t("detail.deleteButton")}
                            icon={<Trash weight="bold" className="h-4 w-4" />}
                            iconVisible
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-[--radius] border border-border bg-background p-4">
                      <p className="text-2xs font-semibold text-muted-foreground">
                        {t("modal.shortcut")}
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        /{selectedShortcut.shortcut}
                      </p>
                    </div>
                    <div className="rounded-[--radius] border border-border bg-background p-4">
                      <p className="text-2xs font-semibold text-muted-foreground">
                        {t("modal.type")}
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {getShortcutTypeLabel(selectedShortcut.messageType, t)}
                      </p>
                    </div>
                    <div className="rounded-[--radius] border border-border bg-background p-4">
                      <p className="text-2xs font-semibold text-muted-foreground">
                        {t("detail.deliveryLabel")}
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {t("detail.deliveryValue")}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[--radius] border border-border bg-background p-4">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {t("detail.messageLabel")}
                    </p>
                    <div className="mt-3 rounded-[--radius] border border-border bg-card px-4 py-4 text-sm text-foreground whitespace-pre-wrap">
                      {selectedShortcut.content.text ||
                        t("detail.emptyMessage")}
                    </div>
                  </div>

                  {selectedShortcut.messageType === "button" ? (
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                      <div className="rounded-[--radius] border border-border bg-background p-4">
                        <p className="text-xs font-semibold text-muted-foreground">
                          {t("detail.buttonsLabel")}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(selectedShortcut.content.buttons || []).map(
                            (button) => (
                              <span
                                key={button.id}
                                className="rounded-[--radius] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                              >
                                {button.title}
                              </span>
                            ),
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-[--radius] border border-border bg-background p-4">
                          <p className="text-2xs font-semibold text-muted-foreground">
                            {t("modal.headerText")}
                          </p>
                          <p className="mt-2 text-sm text-foreground">
                            {selectedShortcut.content.headerText ||
                              t("detail.none")}
                          </p>
                        </div>
                        <div className="rounded-[--radius] border border-border bg-background p-4">
                          <p className="text-2xs font-semibold text-muted-foreground">
                            {t("modal.footerText")}
                          </p>
                          <p className="mt-2 text-sm text-foreground">
                            {selectedShortcut.content.footerText ||
                              t("detail.none")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="flex min-h-[440px] flex-col items-center justify-center rounded-[--radius] border border-dashed border-border bg-background px-6 py-12 text-center">
                  <IconBox color="slate" size="lg" animated={false}>
                    <ChatText weight="fill" />
                  </IconBox>
                  <h2 className="mt-4 font-display text-lg font-semibold tracking-[0.01em] text-foreground">
                    {t("detail.noSelectionTitle")}
                  </h2>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    {t("detail.noSelectionDescription")}
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <MessageShortcutSheet
        open={sheetOpen}
        onOpenChange={handleSheetChange}
        editingShortcut={editingShortcut}
        onSaved={async (shortcut) => {
          await load(shortcut.id);
        }}
      />

      <ElevatedDialog
        open={!!deletingShortcut}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingShortcut(null);
          }
        }}
      >
        <ElevatedDialogContent className="max-w-[520px]">
          <ElevatedDialogHeader>
            <ElevatedDialogTitle>{t("delete.title")}</ElevatedDialogTitle>
            <ElevatedDialogDescription>
              {t("delete.subtitle")}
            </ElevatedDialogDescription>
          </ElevatedDialogHeader>

          <div className="rounded-[--radius] border border-destructive bg-destructive px-4 py-4 text-sm text-destructive-foreground">
            {t("delete.warning", { name: deletingShortcut?.name || "" })}
          </div>

          <ElevatedDialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingShortcut(null)}
              title={t("delete.cancel")}
              disabled={isDeleting}
            />
            <Button
              onClick={handleDelete}
              title={isDeleting ? t("delete.deleting") : t("delete.confirm")}
              disabled={isDeleting}
            />
          </ElevatedDialogFooter>
        </ElevatedDialogContent>
      </ElevatedDialog>
    </>
  );
}
