"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { listWorkspaceGroupsAction } from "@/app/actions/unofficial-whatsapp-groups";
import Button from "@/components/elevated-design/button";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { MagnifyingGlass, X } from "@/components/icons";
import { OriginChip } from "@/components/unofficial-whatsapp-groups/kit/identity";
import { GroupAvatar } from "@/components/unofficial-whatsapp-groups/marks";
import { Notice } from "@/components/ui/notice";
import { splitByPosting } from "@/lib/unofficial-whatsapp-campaigns/group-audience";
import type { GroupRow } from "@/lib/unofficial-whatsapp-groups/types";

import { pickedFromGroup, type PickedCampaignGroup } from "./group-picks";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

type GroupPage = Awaited<ReturnType<typeof listWorkspaceGroupsAction>>;

export function CampaignGroupPicker({
  instanceId,
  value,
  onChange,
  disabled,
}: {
  instanceId: string;
  value: PickedCampaignGroup[];
  onChange: (next: PickedCampaignGroup[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("unofficialWhatsappCampaigns.form.groups");
  const tOrigin = useTranslations("unofficialGroups.kit.origin");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [rows, setRows] = useState<GroupRow[]>([]);
  const [readOnly, setReadOnly] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [settledSearch, setSettledSearch] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchPage = useCallback(
    async (nextPage: number): Promise<GroupPage | null> => {
      const request = ++requestRef.current;
      const result = await listWorkspaceGroupsAction({
        instanceId,
        search: debouncedSearch || undefined,
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      return request === requestRef.current ? result : null;
    },
    [instanceId, debouncedSearch],
  );

  const apply = useCallback(
    (result: GroupPage, append: boolean) => {
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      const split = splitByPosting(result.items, instanceId);
      setRows((previous) => (append ? [...previous, ...split.postable] : split.postable));
      setReadOnly((previous) => (append ? previous + split.readOnly : split.readOnly));
      setPage(result.meta.page);
      setTotalPages(result.meta.totalPages);
    },
    [instanceId],
  );

  useEffect(() => {
    if (!instanceId) return;
    void fetchPage(1).then((result) => {
      if (!result) return;
      apply(result, false);
      setSettledSearch(debouncedSearch);
    });
  }, [instanceId, debouncedSearch, fetchPage, apply]);

  const loadMore = async () => {
    setLoadingMore(true);
    const result = await fetchPage(page + 1);
    setLoadingMore(false);
    if (result) apply(result, true);
  };

  const loading = loadingMore || settledSearch !== debouncedSearch;

  if (!instanceId) {
    return <p className="text-sm text-muted-foreground">{t("pickNumberFirst")}</p>;
  }

  const pickedIds = new Set(value.map((group) => group.id));

  const toggle = (row: GroupRow, checked: boolean) => {
    if (checked) {
      if (!pickedIds.has(row.group.id)) onChange([...value, pickedFromGroup(row.group)]);
      return;
    }
    onChange(value.filter((group) => group.id !== row.group.id));
  };

  return (
    <div className="space-y-4">
      {value.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t("pickedCount", { count: value.length })}</p>
          <ul aria-label={t("picked")} className="flex flex-wrap gap-1.5">
            {value.map((group) => (
              <li
                key={group.id}
                className="inline-flex items-center gap-1 rounded-[--radius] border border-border bg-muted py-0.5 pl-2 pr-1 text-xs font-medium text-foreground"
              >
                {group.subject}
                {group.origin === "external" ? (
                  <span className="inline-flex items-center gap-1 text-2xs font-medium text-muted-foreground">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
                    {tOrigin("external")}
                  </span>
                ) : null}
                <button
                  type="button"
                  aria-label={t("remove")}
                  title={t("remove")}
                  disabled={disabled}
                  onClick={() => onChange(value.filter((picked) => picked.id !== group.id))}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-card hover:text-foreground disabled:opacity-40"
                >
                  <X className="h-3 w-3" weight="bold" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ElevatedInput
        type="text"
        label={t("search")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
        controlSize="sm"
        className="w-full max-w-sm"
      />

      {error ? <Notice tone="fault">{error}</Notice> : null}

      <div className="max-h-[360px] overflow-y-auto rounded-[--radius] border border-border">
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            {loading ? t("loading") : debouncedSearch ? t("noMatch") : t("empty")}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.group.id}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted">
                  <Checkbox
                    aria-label={row.group.subject}
                    checked={pickedIds.has(row.group.id)}
                    onCheckedChange={(checked) => toggle(row, checked === true)}
                    disabled={disabled}
                  />
                  <GroupAvatar group={row.group} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{row.group.subject}</span>
                  <OriginChip origin={row.group.origin} />
                  <span className="readout shrink-0 text-xs text-muted-foreground">
                    {t("members", { count: row.group.memberCount })}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {readOnly > 0 ? (
          <p className="text-xs text-muted-foreground">{t("readOnlyHidden", { count: readOnly })}</p>
        ) : (
          <span />
        )}
        {page < totalPages ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            title={t("loadMore")}
            disabled={loading}
            onClick={() => void loadMore()}
          />
        ) : null}
      </div>
    </div>
  );
}
