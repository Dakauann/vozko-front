"use client";

import {
  ArrowClockwise,
  PaintBrush,
  PencilSimple,
  Plus,
  Sparkle,
  Tag,
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
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetFooter,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import {
  createStageGroupAction,
  deleteStageGroupAction,
  listStageGroupsAction,
  updateStageGroupAction,
} from "@/app/actions/stage-groups";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import { AccessDenied } from "@/components/ui/access-denied";
import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { IconBox } from "@/components/elevated-design/listing-card";
import type { StageGroup } from "@/lib/stage-groups/types";
import { cn, readableInkFor } from "@/lib/utils";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const TAG_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#64748b",
];

interface TagItemDraft {
  id: string;
  name: string;
  description: string;
  color: string;
  position: number;
}

let draftCounter = 0;

function newDraftItem(position: number): TagItemDraft {
  return {
    id: `draft_${Date.now()}_${++draftCounter}`,
    name: "",
    description: "",
    color: TAG_COLORS[position % TAG_COLORS.length],
    position,
  };
}

function normalizeStageGroups(stageGroups: StageGroup[]) {
  return stageGroups.map((group) => ({
    ...group,
    items: [...group.items].sort((a, b) => a.position - b.position),
  }));
}

export default function TagGroupsPage() {
  const { toast } = useToast();
  const t = useTranslations("tagGroupsPage");
  const { can, permissionsLoading } = useWorkspace();
  const permissionsReady = !permissionsLoading;
  const canReadStageGroups = permissionsReady && can("stage_groups", "read");
  const canCreateStageGroups =
    permissionsReady && can("stage_groups", "create");
  const canUpdateStageGroups =
    permissionsReady && can("stage_groups", "update");
  const canDeleteStageGroups =
    permissionsReady && can("stage_groups", "delete");
  const [stageGroups, setStageGroups] = useState<StageGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<StageGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [draftItems, setDraftItems] = useState<TagItemDraft[]>([]);
  const [nameError, setNameError] = useState("");
  const [deletingGroup, setDeletingGroup] = useState<StageGroup | null>(null);
  const [isRefreshing, startRefresh] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const load = useCallback(
    async (preferredId?: string) => {
      if (!canReadStageGroups) {
        setStageGroups([]);
        setSelectedGroupId(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const result = await listStageGroupsAction();
        if (result.error) {
          toast({
            title: t("error.title"),
            description: result.error,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const nextStageGroups = normalizeStageGroups(result.stageGroups);
        setStageGroups(nextStageGroups);
        setSelectedGroupId((current) => {
          if (
            preferredId &&
            nextStageGroups.some((item) => item.id === preferredId)
          ) {
            return preferredId;
          }
          if (current && nextStageGroups.some((item) => item.id === current)) {
            return current;
          }
          return nextStageGroups[0]?.id ?? null;
        });
      } catch {
        toast({
          title: t("error.title"),
          description: t("error.loadFailed"),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [canReadStageGroups, t, toast],
  );

  useEffect(() => {
    if (permissionsReady) {
      load();
    }
  }, [load, permissionsReady]);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return stageGroups;
    }

    return stageGroups.filter((group) => {
      return (
        group.name.toLowerCase().includes(query) ||
        group.items.some(
          (item) =>
            item.name.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query),
        )
      );
    });
  }, [search, stageGroups]);

  const selectedGroup = useMemo(() => {
    if (search.trim()) {
      return (
        filteredGroups.find((group) => group.id === selectedGroupId) ||
        filteredGroups[0] ||
        null
      );
    }

    return (
      filteredGroups.find((group) => group.id === selectedGroupId) ||
      stageGroups.find((group) => group.id === selectedGroupId) ||
      null
    );
  }, [filteredGroups, search, selectedGroupId, stageGroups]);

  const totalStages = useMemo(
    () => stageGroups.reduce((sum, group) => sum + group.items.length, 0),
    [stageGroups],
  );

  const averageStages = useMemo(() => {
    if (stageGroups.length === 0) {
      return "0";
    }

    return Number((totalStages / stageGroups.length).toFixed(1)).toString();
  }, [stageGroups.length, totalStages]);

  const stats = useMemo(
    () => [
      {
        label: t("stats.total"),
        value: String(stageGroups.length),
        helper: t("stats.totalHelper"),
        color: "slate" as const,
        icon: <Tag weight="fill" className="h-5 w-5" />,
      },
      {
        label: t("stats.stages"),
        value: String(totalStages),
        helper: t("stats.stagesHelper"),
        color: "primary" as const,
        icon: <Sparkle weight="fill" className="h-5 w-5" />,
      },
      {
        label: t("stats.average"),
        value: averageStages,
        helper: t("stats.averageHelper"),
        color: "amber" as const,
        icon: <PaintBrush weight="fill" className="h-5 w-5" />,
      },
    ],
    [averageStages, stageGroups.length, t, totalStages],
  );

  const draftPreviewItems = useMemo(
    () => draftItems.filter((item) => item.name.trim()),
    [draftItems],
  );

  const resetForm = () => {
    setEditingGroup(null);
    setGroupName("");
    setDraftItems([]);
    setNameError("");
  };

  const handleSheetChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const openCreate = () => {
    if (!canCreateStageGroups) return;

    setEditingGroup(null);
    setGroupName("");
    setDraftItems([newDraftItem(0), newDraftItem(1), newDraftItem(2)]);
    setNameError("");
    setSheetOpen(true);
  };

  const openEdit = (group: StageGroup) => {
    if (!canUpdateStageGroups) return;

    setEditingGroup(group);
    setSelectedGroupId(group.id);
    setGroupName(group.name);
    setDraftItems(
      group.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        color: item.color,
        position: item.position,
      })),
    );
    setNameError("");
    setSheetOpen(true);
  };

  const addDraftItem = () => {
    setDraftItems((prev) => [...prev, newDraftItem(prev.length)]);
  };

  const removeDraftItem = (id: string) => {
    setDraftItems((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      return filtered.map((item, index) => ({ ...item, position: index }));
    });
  };

  const updateDraftItem = (
    id: string,
    field: keyof TagItemDraft,
    value: string | number,
  ) => {
    setDraftItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const handleRefresh = () => {
    startRefresh(async () => {
      await load(selectedGroupId ?? undefined);
      toast({ title: t("refreshed") });
    });
  };

  const handleSave = () => {
    if (editingGroup ? !canUpdateStageGroups : !canCreateStageGroups) {
      return;
    }

    const trimmedName = groupName.trim();
    if (!trimmedName) {
      setNameError(t("modal.nameRequired"));
      return;
    }

    const validItems = draftItems.filter((item) => item.name.trim());
    if (validItems.length === 0) {
      toast({
        title: t("error.title"),
        description: t("modal.itemsRequired"),
        variant: "destructive",
      });
      return;
    }

    startSaving(async () => {
      const items = validItems.map((item, index) => ({
        name: item.name.trim(),
        description: item.description.trim(),
        color: item.color,
        position: index,
      }));

      if (editingGroup) {
        const result = await updateStageGroupAction(editingGroup.id, {
          name: trimmedName,
          items,
        });
        if (result.error) {
          toast({
            title: t("error.title"),
            description: result.error,
            variant: "destructive",
          });
          return;
        }

        toast({
          title: t("toast.updated"),
          description: t("toast.updatedDescription", { name: trimmedName }),
        });
        handleSheetChange(false);
        await load(result.stageGroup?.id ?? editingGroup.id);
        return;
      }

      const result = await createStageGroupAction({
        name: trimmedName,
        items,
      });
      if (result.error) {
        toast({
          title: t("error.title"),
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: t("toast.created"),
        description: t("toast.createdDescription", { name: trimmedName }),
      });
      handleSheetChange(false);
      await load(result.stageGroup?.id ?? undefined);
    });
  };

  const handleDelete = () => {
    if (!deletingGroup || !canDeleteStageGroups) {
      return;
    }

    startDeleting(async () => {
      const result = await deleteStageGroupAction(deletingGroup.id);
      if (result.error) {
        toast({
          title: t("error.title"),
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: t("toast.deleted"),
          description: t("toast.deletedDescription", {
            name: deletingGroup.name,
          }),
        });
        await load(
          selectedGroupId === deletingGroup.id
            ? undefined
            : (selectedGroupId ?? undefined),
        );
      }

      setDeletingGroup(null);
    });
  };

  const selectedItems = selectedGroup?.items || [];
  const firstStage = selectedItems[0]?.name || t("detail.none");
  const lastStage =
    selectedItems[selectedItems.length - 1]?.name || t("detail.none");

  if (permissionsReady && !canReadStageGroups) {
    return <AccessDenied backHref="/dashboard" />;
  }

  return (
    <>
      <main className="w-full space-y-4">
        <DashboardPageHeader
          icon={<Tag className="h-6 w-6" weight="fill" />}
          badge={t("header.badge")}
          description={t("header.description")}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={handleRefresh}
                title={t("refreshButton")}
                disabled={!permissionsReady}
                icon={
                  <ArrowClockwise
                    weight="bold"
                    className={cn("h-4 w-4", isRefreshing && "animate-spin")}
                  />
                }
                iconVisible
              />
              {canCreateStageGroups && (
                <Button
                  onClick={openCreate}
                  title={t("newButton")}
                  icon={<Plus weight="bold" className="h-4 w-4" />}
                  iconVisible
                />
              )}
            </div>
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
        ) : stageGroups.length === 0 ? (
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
              <Tag weight="fill" />
            </IconBox>
            <h2 className="mt-4 font-display text-lg font-semibold tracking-[0.01em] text-foreground">
              {t("empty.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("empty.description")}
            </p>
            {canCreateStageGroups && (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <Button
                  onClick={openCreate}
                  title={t("empty.createButton")}
                  icon={<Plus weight="bold" className="h-4 w-4" />}
                  iconVisible
                />
              </div>
            )}
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
                  {t("filters.resultsLabel")}
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {t("filters.resultsValue", {
                    shown: filteredGroups.length,
                    total: stageGroups.length,
                  })}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("filters.resultsHelper")}
                </p>
              </div>

              <div className="space-y-3">
                {filteredGroups.length === 0 ? (
                  <div className="rounded-[--radius] border border-dashed border-border bg-background px-4 py-10 text-center">
                    <Tag
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
                  filteredGroups.map((group) => {
                    const isSelected = group.id === selectedGroup?.id;
                    const previewItems = group.items.slice(0, 3);
                    const remainingCount = Math.max(
                      group.items.length - previewItems.length,
                      0,
                    );

                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setSelectedGroupId(group.id)}
                        className={cn(
                          "w-full rounded-[--radius] border px-4 py-4 text-left transition-all",
                          isSelected
                            ? "border-primary bg-muted"
                            : "border-border bg-background hover:border-primary/30 hover:bg-background",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <IconBox color="primary" size="sm" animated={false}>
                            <Tag weight="fill" />
                          </IconBox>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">
                                  {group.name}
                                </p>
                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                  {t("card.itemCount", {
                                    count: group.items.length,
                                  })}
                                </p>
                              </div>
                              <span className="rounded-[--radius] border border-border px-2.5 py-1 text-2xs font-semibold text-muted-foreground">
                                {group.items.length}
                              </span>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {previewItems.map((item) => (
                                <span
                                  key={item.id}
                                  className="rounded-[--radius] px-2.5 py-1 text-2xs font-semibold"
                                  style={{
                                    backgroundColor: item.color,
                                    color: readableInkFor(item.color),
                                  }}
                                >
                                  {item.name}
                                </span>
                              ))}
                              {remainingCount > 0 ? (
                                <span className="rounded-[--radius] border border-border px-2.5 py-1 text-2xs font-semibold text-muted-foreground">
                                  +{remainingCount}
                                </span>
                              ) : null}
                            </div>
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
              {selectedGroup ? (
                <>
                  <div className="rounded-[--radius] border border-border bg-background p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex items-start gap-3">
                        <IconBox color="primary" size="lg" animated={false}>
                          <Tag weight="fill" />
                        </IconBox>
                        <div>
                          <p className="text-xs font-semibold text-primary-ink">
                            {t("detail.badge")}
                          </p>
                          <h2 className="mt-2 font-display text-2xl font-semibold tracking-[0.01em] text-foreground">
                            {selectedGroup.name}
                          </h2>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {t("card.itemCount", {
                              count: selectedGroup.items.length,
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {canUpdateStageGroups && (
                          <Button
                            variant="outline"
                            onClick={() => openEdit(selectedGroup)}
                            title={t("detail.editButton")}
                            icon={
                              <PencilSimple weight="bold" className="h-4 w-4" />
                            }
                            iconVisible
                          />
                        )}
                        {canDeleteStageGroups && (
                          <Button
                            variant="outline"
                            onClick={() => setDeletingGroup(selectedGroup)}
                            title={t("detail.deleteButton")}
                            icon={<Trash weight="bold" className="h-4 w-4" />}
                            iconVisible
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-[--radius] border border-border bg-background p-4">
                      <p className="text-2xs font-semibold text-muted-foreground">
                        {t("detail.countLabel")}
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {t("card.itemCount", {
                          count: selectedGroup.items.length,
                        })}
                      </p>
                    </div>
                    <div className="rounded-[--radius] border border-border bg-background p-4">
                      <p className="text-2xs font-semibold text-muted-foreground">
                        {t("detail.firstStageLabel")}
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {firstStage}
                      </p>
                    </div>
                    <div className="rounded-[--radius] border border-border bg-background p-4">
                      <p className="text-2xs font-semibold text-muted-foreground">
                        {t("detail.lastStageLabel")}
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {lastStage}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[--radius] border border-border bg-background p-4">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {t("detail.stagesLabel")}
                    </p>
                    <div className="mt-4 space-y-3">
                      {selectedItems.map((item, index) => (
                        <div
                          key={item.id}
                          className="rounded-[--radius] border border-border bg-card px-4 py-4"
                        >
                          <div className="flex items-start gap-4">
                            <div
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[--radius] text-sm font-semibold"
                              style={{
                                backgroundColor: item.color,
                                color: readableInkFor(item.color),
                              }}
                            >
                              {index + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-foreground">
                                  {item.name}
                                </p>
                                <span
                                  className="h-3 w-3 rounded-full border border-white/70"
                                  style={{ backgroundColor: item.color }}
                                />
                              </div>
                              <p className="mt-2 text-sm text-muted-foreground">
                                {item.description ||
                                  t("detail.emptyDescription")}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[440px] flex-col items-center justify-center rounded-[--radius] border border-dashed border-border bg-background px-6 py-12 text-center">
                  <IconBox color="slate" size="lg" animated={false}>
                    <Tag weight="fill" />
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

      <ElevatedSheet open={sheetOpen} onOpenChange={handleSheetChange}>
        <ElevatedSheetContent side="right" className="w-full sm:max-w-[560px]">
          <ElevatedSheetHeader>
            <div className="flex items-start gap-4 pr-10">
              <IconBox
                color={editingGroup ? "amber" : "primary"}
                size="md"
                animated={false}
              >
                <Tag weight="fill" className="h-5 w-5" />
              </IconBox>
              <div className="min-w-0 flex-1">
                <ElevatedSheetTitle>
                  {editingGroup ? t("modal.editTitle") : t("modal.createTitle")}
                </ElevatedSheetTitle>
                <ElevatedSheetDescription>
                  {t("modal.subtitle")}
                </ElevatedSheetDescription>
              </div>
            </div>
          </ElevatedSheetHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="space-y-5">
              <div className="rounded-[--radius] border border-border bg-background p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-[--radius] bg-primary px-3 py-1 text-2xs font-semibold text-primary-foreground">
                    {groupName || t("modal.namePlaceholder")}
                  </span>
                  <span className="rounded-[--radius] border border-border px-3 py-1 text-2xs font-semibold text-muted-foreground">
                    {t("card.itemCount", { count: draftPreviewItems.length })}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {draftPreviewItems.length > 0 ? (
                    draftPreviewItems.slice(0, 4).map((item) => (
                      <span
                        key={item.id}
                        className="rounded-[--radius] px-2.5 py-1 text-2xs font-semibold"
                        style={{
                          backgroundColor: item.color,
                          color: readableInkFor(item.color),
                        }}
                      >
                        {item.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t("detail.none")}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <ElevatedInput
                  label={t("modal.nameLabel")}
                  value={groupName}
                  onChange={(event) => {
                    setGroupName(event.target.value);
                    if (event.target.value.trim()) {
                      setNameError("");
                    }
                  }}
                  placeholder={t("modal.namePlaceholder")}
                />
                {nameError ? (
                  <p className="mt-1 text-xs font-semibold text-destructive-ink">
                    {nameError}
                  </p>
                ) : null}
              </div>

              <div className="space-y-3 rounded-[--radius] border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-semibold text-muted-foreground">
                    {t("modal.itemsLabel")}
                  </label>
                  <Button
                    variant="ghost"
                    title={t("modal.addItem")}
                    icon={<Plus weight="bold" className="h-3.5 w-3.5" />}
                    iconVisible
                    onClick={addDraftItem}
                    className="text-2xs font-semibold"
                  />
                </div>

                <div className="space-y-3">
                  {draftItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="rounded-[--radius] border border-border bg-card p-3"
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative group">
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-[--radius] border border-border transition-colors hover:border-primary/50"
                            style={{ backgroundColor: item.color }}
                            title={t("modal.pickColor")}
                          >
                            <PaintBrush
                              weight="bold"
                              className="h-3.5 w-3.5"
                              style={{ color: readableInkFor(item.color) }}
                            />
                          </button>
                          <div className="absolute left-0 top-full z-10 mt-1 hidden w-40 grid-cols-4 gap-1 rounded-[--radius] border border-border bg-card p-2 shadow-lg group-focus-within:grid group-hover:grid">
                            {TAG_COLORS.map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={cn(
                                  "h-7 w-7 rounded-md border transition-transform hover:scale-110",
                                  item.color === color
                                    ? "border-foreground"
                                    : "border-transparent",
                                )}
                                style={{ backgroundColor: color }}
                                onClick={() =>
                                  updateDraftItem(item.id, "color", color)
                                }
                              />
                            ))}
                          </div>
                        </div>

                        <input
                          type="text"
                          value={item.name}
                          onChange={(event) =>
                            updateDraftItem(item.id, "name", event.target.value)
                          }
                          placeholder={t("modal.itemNamePlaceholder", {
                            index: index + 1,
                          })}
                          className="flex-1 rounded-[--radius] border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                        />

                        {draftItems.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeDraftItem(item.id)}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <Trash weight="bold" className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>

                      <input
                        type="text"
                        value={item.description}
                        onChange={(event) =>
                          updateDraftItem(
                            item.id,
                            "description",
                            event.target.value,
                          )
                        }
                        placeholder={t("modal.itemDescriptionPlaceholder")}
                        className="mt-2 w-full rounded-[--radius] border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <ElevatedSheetFooter>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                title={t("modal.cancel")}
                onClick={() => handleSheetChange(false)}
                disabled={isSaving}
              />
              <Button
                title={
                  isSaving
                    ? t("modal.saving")
                    : editingGroup
                      ? t("modal.save")
                      : t("modal.create")
                }
                onClick={handleSave}
                disabled={
                  isSaving ||
                  (editingGroup ? !canUpdateStageGroups : !canCreateStageGroups)
                }
              />
            </div>
          </ElevatedSheetFooter>
        </ElevatedSheetContent>
      </ElevatedSheet>

      <ElevatedDialog
        open={!!deletingGroup}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingGroup(null);
          }
        }}
      >
        <ElevatedDialogContent className="max-w-[520px]">
          <ElevatedDialogHeader>
            <div className="flex items-start gap-4">
              <IconBox color="red" size="md" animated={false}>
                <Warning weight="fill" className="h-5 w-5" />
              </IconBox>
              <div className="min-w-0 flex-1">
                <ElevatedDialogTitle>{t("delete.title")}</ElevatedDialogTitle>
                <ElevatedDialogDescription>
                  {t("delete.subtitle")}
                </ElevatedDialogDescription>
              </div>
            </div>
          </ElevatedDialogHeader>

          <div className="rounded-[--radius] border border-border bg-muted p-4">
            <p className="text-sm text-destructive-ink">
              {deletingGroup
                ? t("delete.warning", { name: deletingGroup.name })
                : ""}
            </p>
          </div>

          <ElevatedDialogFooter>
            <Button
              variant="outline"
              title={t("delete.cancel")}
              onClick={() => setDeletingGroup(null)}
              disabled={isDeleting}
            />
            <Button
              title={isDeleting ? t("delete.deleting") : t("delete.confirm")}
              icon={<Trash weight="bold" className="h-4 w-4" />}
              iconVisible
              onClick={handleDelete}
              disabled={isDeleting || !canDeleteStageGroups}
              className="bg-destructive hover:bg-destructive"
            />
          </ElevatedDialogFooter>
        </ElevatedDialogContent>
      </ElevatedDialog>
    </>
  );
}
