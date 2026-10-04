"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { deleteSavedAudienceAction, listSavedAudiencesAction } from "@/app/actions/advertising-audiences";
import { isAdsError } from "@/app/actions/advertising";
import Button from "@/components/elevated-design/button";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { Bookmark, PencilSimple, Plus, Trash } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useKeyedLoad } from "@/hooks/use-keyed-load";
import { useToast } from "@/hooks/use-toast";
import { AUDIENCE_MAX_AGE, genderChoiceOf, type SavedAudience } from "@/lib/advertising/audiences";
import type { AdAccount } from "@/lib/advertising/types";
import { formatWhen } from "@/lib/advertising/when";

import { useLoadErrorState } from "../load-error-state";
import { IconAction } from "../icon-action";
import { useAdsFormat } from "../use-ads-format";
import type { AudiencePermissions } from "./audiences-page";
import { SavedAudienceDialog } from "./saved-audience-dialog";

type Editing = { mode: "create" } | { mode: "edit"; audience: SavedAudience } | null;

export function SavedAudiencesPanel({ account, permissions }: { account: AdAccount; permissions: AudiencePermissions }) {
  const t = useTranslations("adsAudiences.saved");
  const fmt = useAdsFormat();
  const { toast } = useToast();
  const loadError = useLoadErrorState();
  const list = useKeyedLoad("saved", listSavedAudiencesAction);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<SavedAudience | null>(null);

  const response = list.latest;
  const audiences = response && !isAdsError(response) ? response.data : [];
  const error = response && isAdsError(response) ? response.error : null;

  const ages = (audience: SavedAudience) => {
    const { ageMin, ageMax } = audience.targeting;
    if (!ageMin || !ageMax) return fmt.empty;
    return ageMax >= AUDIENCE_MAX_AGE ? t("agesPlus", { min: ageMin, max: ageMax }) : t("ages", { min: ageMin, max: ageMax });
  };

  const places = (audience: SavedAudience) => {
    const names = (audience.targeting.locations ?? []).map((location) => location.name).filter(Boolean);
    return names.length > 0 ? names.join(", ") : fmt.empty;
  };

  const saved = (audience: SavedAudience, created: boolean) => {
    setEditing(null);
    toast({ title: created ? t("created", { name: audience.name }) : t("updated", { name: audience.name }) });
    list.reload();
  };

  const confirmDelete = async () => {
    const target = deleting;
    if (!target) return;
    const outcome = await deleteSavedAudienceAction(target.id);
    setDeleting(null);
    if (isAdsError(outcome)) {
      toast({ title: t("deleteFailed"), description: outcome.error, variant: "destructive" });
      return;
    }
    toast({ title: t("deleted", { name: target.name }) });
    list.reload();
  };

  const columns: DashboardTableColumn<SavedAudience>[] = [
    { key: "name", header: t("columns.name"), render: (audience) => <span className="text-sm font-medium text-foreground">{audience.name}</span> },
    {
      key: "locations",
      header: t("columns.locations"),
      render: (audience) => <span className="line-clamp-2 max-w-72 text-sm text-foreground">{places(audience)}</span>,
    },
    { key: "ages", header: t("columns.ages"), render: (audience) => <span className="whitespace-nowrap text-sm tabular-nums">{ages(audience)}</span> },
    {
      key: "genders",
      header: t("columns.genders"),
      render: (audience) => <span className="text-sm">{t(`genders.${genderChoiceOf(audience.targeting.genders)}`)}</span>,
    },
    {
      key: "advantage",
      header: t("columns.advantage"),
      render: (audience) => <span className="text-sm">{audience.targeting.advantageAudience ? t("on") : t("off")}</span>,
    },
    {
      key: "updated",
      header: t("columns.updated"),
      render: (audience) => <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">{formatWhen(audience.updatedAt, fmt.tag)}</span>,
    },
  ];

  const rowActions =
    permissions.canUpdate || permissions.canDelete
      ? (audience: SavedAudience) => (
          <div className="flex items-center justify-end gap-1">
            {permissions.canUpdate ? (
              <IconAction label={t("edit")} onClick={() => setEditing({ mode: "edit", audience })}>
                <PencilSimple className="h-4 w-4" />
              </IconAction>
            ) : null}
            {permissions.canDelete ? (
              <IconAction label={t("delete")} onClick={() => setDeleting(audience)} danger>
                <Trash className="h-4 w-4" />
              </IconAction>
            ) : null}
          </div>
        )
      : undefined;

  return (
    <div className="space-y-4">
      <DashboardTable
        data={audiences}
        columns={columns}
        rowKey={(audience) => audience.id}
        loading={list.loading && !response}
        headerLeft={<p className="text-sm text-muted-foreground">{t("description")}</p>}
        headerRight={
          permissions.canCreate ? (
            <Button
              variant="primary"
              title={t("new")}
              icon={<Plus weight="bold" className="h-4 w-4" />}
              iconVisible
              iconSide="left"
              onClick={() => setEditing({ mode: "create" })}
            />
          ) : null
        }
        renderRowActions={rowActions}
        emptyState={error ? loadError(error, list.reload) : {
          icon: <Bookmark className="h-7 w-7 text-muted-foreground" />,
          title: t("emptyTitle"),
          description: t("emptyBody"),
        }}
      />
      {editing ? (
        <SavedAudienceDialog
          account={account}
          audience={editing.mode === "edit" ? editing.audience : null}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      ) : null}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("deleteTitle")}
        description={t("deleteBody", { name: deleting?.name ?? "" })}
        confirmLabel={t("delete")}
        cancelLabel={t("editor.cancel")}
        tone="danger"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
