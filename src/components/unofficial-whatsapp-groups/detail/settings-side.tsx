"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { leaveWorkspaceGroupAction, listGroupCategoriesAction, updateWorkspaceGroupAction } from "@/app/actions/unofficial-whatsapp-groups";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { SignOut, Warning } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Link, useRouter } from "@/i18n/routing";
import { MAX_CATEGORY_CHARS, type GroupDetail, type NumberSeat, type WorkspaceGroup } from "@/lib/unofficial-whatsapp-groups/types";
import { cn } from "@/lib/utils";

import { GroupsPanel } from "../kit/panel";
import { groupsRoutes } from "../kit/routes";
import { useGroupName } from "../kit/use-groups-format";
import { canCreateNextInSeries, leaveConfirmed } from "./detail-model";
import { NextInSeriesButton } from "./next-in-series";
import { SeatList } from "./seat-list";
import type { GroupActions } from "./use-group-actions";
import type { GroupPermissions } from "./use-group-permissions";

const CATEGORY_SUGGESTIONS = 8;

export function CategorySection({ group, onChanged }: { group: WorkspaceGroup; onChanged: () => void }) {
  const t = useTranslations("unofficialGroups.detail.settings.category");
  const tTab = useTranslations("unofficialGroups.detail.settingsTab.category");
  const serverCategory = group.category ?? "";
  const [draft, setDraft] = useState(serverCategory);
  const [baseline, setBaseline] = useState(serverCategory);
  const [saving, setSaving] = useState(false);

  if (baseline !== serverCategory) {
    setBaseline(serverCategory);
    if (draft.trim() === baseline.trim()) setDraft(serverCategory);
  }
  const [known, setKnown] = useState<string[]>([]);
  const trimmed = draft.trim();
  const changed = trimmed !== (group.category ?? "").trim();
  const suggestions = known.filter((category) => category.trim() && category !== trimmed).slice(0, CATEGORY_SUGGESTIONS);

  useEffect(() => {
    let cancelled = false;
    void listGroupCategoriesAction().then((result) => {
      if (!cancelled) setKnown(result.categories);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    const result = await updateWorkspaceGroupAction(group.id, { category: trimmed });
    setSaving(false);
    if (result.error) {
      toast.error(tTab("failed"), { description: result.error });
      return;
    }
    toast(t("saved"));
    onChanged();
  };

  return (
    <GroupsPanel title={t("title")} subtitle={t("description")}>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (changed) void save();
        }}
      >
        <ElevatedInput
          type="text"
          label={t("label")}
          value={draft}
          maxLength={MAX_CATEGORY_CHARS}
          onChange={(event) => setDraft(event.target.value)}
          controlSize="sm"
          className="w-full"
        />
        <p className="readout px-1 text-2xs tabular-nums text-muted-foreground">{t("counter", { used: draft.length, max: MAX_CATEGORY_CHARS })}</p>
        {suggestions.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {suggestions.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setDraft(category)}
                className="rounded-[--radius] border border-border bg-muted px-2 py-0.5 text-2xs font-medium text-foreground transition-colors hover:bg-[hsl(var(--accent-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {category}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit" variant="primary" size="sm" title={t("save")} disabled={!changed || saving} />
          {group.category ? (
            <Button variant="ghost" size="sm" title={tTab("clear")} disabled={saving} onClick={() => setDraft("")} />
          ) : null}
        </div>
      </form>
    </GroupsPanel>
  );
}

export function SeriesSection({ detail, permissions, actions }: { detail: GroupDetail; permissions: GroupPermissions; actions: GroupActions }) {
  const t = useTranslations("unofficialGroups.detail.settingsTab.series");
  const tActions = useTranslations("unofficialGroups.detail.actions");
  const tHeader = useTranslations("unofficialGroups.detail.header");
  const groupName = useGroupName();
  const { group, series } = detail;
  const siblings = [...series].sort((a, b) => a.sequence - b.sequence);
  return (
    <GroupsPanel title={t("title")} subtitle={t("subtitle", { count: siblings.length })}>
      {siblings.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("alone")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {siblings.map((sibling) => {
            const current = sibling.groupId === group.id;
            return (
              <li key={sibling.groupId} className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-2 py-1.5 text-xs">
                <span className="readout text-2xs tabular-nums text-muted-foreground">#{sibling.sequence}</span>
                {current ? (
                  <span className="truncate font-semibold text-foreground" aria-current="page">
                    {groupName(sibling.subject)}
                  </span>
                ) : (
                  <Link
                    href={groupsRoutes.group(sibling.groupId)}
                    className="truncate rounded-sm text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {groupName(sibling.subject)}
                  </Link>
                )}
                <span className={cn("readout text-2xs tabular-nums", current ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  {tHeader("seriesMembers", { count: sibling.members })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {canCreateNextInSeries(group, permissions) ? (
        <div className="mt-3 border-t border-border pt-2.5">
          <NextInSeriesButton detail={detail} actions={actions} permissions={permissions} label={tActions("nextInSeriesLong")} />
          <p className="mt-1.5 text-2xs text-muted-foreground">{t("nextHint")}</p>
        </div>
      ) : null}
    </GroupsPanel>
  );
}

export function NumbersSection({ detail, canLeave, onChanged }: { detail: GroupDetail; canLeave: boolean; onChanged: () => void }) {
  const t = useTranslations("unofficialGroups.detail.settings.numbers");
  const tTab = useTranslations("unofficialGroups.detail.settingsTab.numbers");
  const router = useRouter();
  const { group, numbers } = detail;
  const last = numbers.length <= 1;

  const leave = async (seat: NumberSeat) => {
    const result = await leaveWorkspaceGroupAction(group.id, [seat.instanceId]);
    if (result.error) {
      toast.error(t("leaveFailed"), { description: result.error });
      return false;
    }
    toast(t("left", { label: seat.label }));
    if (last) router.push(groupsRoutes.all());
    else onChanged();
    return true;
  };

  return (
    <GroupsPanel title={t("title")} subtitle={t("description")}>
      {numbers.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("empty")}</p>
      ) : (
        <SeatList
          seats={numbers}
          layout="card"
          trailing={(seat) =>
            canLeave ? (
              <ConfirmDialog
                title={t("leaveTitle", { label: seat.label })}
                description={last ? tTab("leaveLast") : t("leaveText")}
                confirmLabel={t("leave")}
                icon={<SignOut size={28} />}
                onConfirm={() => leave(seat)}
                trigger={<Button variant="ghost" size="sm" title={t("leave")} icon={<SignOut className="h-4 w-4" weight="bold" />} iconVisible />}
              />
            ) : null
          }
        />
      )}
    </GroupsPanel>
  );
}

export function DangerZoneSection({ detail }: { detail: GroupDetail }) {
  const t = useTranslations("unofficialGroups.detail.settingsTab.danger");
  const router = useRouter();
  const groupName = useGroupName();
  const { group, numbers } = detail;
  const subject = groupName(group.subject);
  const [typed, setTyped] = useState("");
  const [open, setOpen] = useState(false);

  const leaveAll = async () => {
    const result = await leaveWorkspaceGroupAction(
      group.id,
      numbers.map((seat) => seat.instanceId),
    );
    if (result.error) {
      toast.error(t("failed"), { description: result.error });
      return false;
    }
    toast(t("done", { subject }));
    router.push(groupsRoutes.all());
    return true;
  };

  return (
    <GroupsPanel title={t("title")} subtitle={t("subtitle")}>
      <div className="space-y-2">
        <p className="flex items-start gap-1.5 text-xs text-foreground">
          <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" weight="fill" aria-hidden />
          {t("body", { count: numbers.length })}
        </p>
        <ConfirmDialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setTyped("");
          }}
          title={t("confirmTitle")}
          description={t("confirmText", { subject })}
          confirmLabel={t("confirm")}
          icon={<SignOut size={28} />}
          confirmDisabled={!leaveConfirmed(typed, subject)}
          onConfirm={() => leaveAll()}
          trigger={<Button variant="destructive" size="sm" title={t("action")} icon={<SignOut className="h-4 w-4" weight="bold" />} iconVisible />}
        >
          <ElevatedInput type="text" label={t("typeName", { subject })} value={typed} onChange={(event) => setTyped(event.target.value)} controlSize="sm" autoComplete="off" />
        </ConfirmDialog>
        <p className="text-2xs text-muted-foreground">{t("dataStays")}</p>
      </div>
    </GroupsPanel>
  );
}
