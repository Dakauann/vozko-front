"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { deleteAudienceAction, listAudiencesAction } from "@/app/actions/advertising-audiences";
import { isAdsError } from "@/app/actions/advertising";
import Button from "@/components/elevated-design/button";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ArrowClockwise, ArrowSquareOut, FileCsv, Plus, Trash, UsersThree, Users, Warning } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useKeyedLoad } from "@/hooks/use-keyed-load";
import { audienceSize, audienceState, originCandidates, type Audience, type CustomerListResult } from "@/lib/advertising/audiences";
import type { AdAccount } from "@/lib/advertising/types";
import { formatWhen } from "@/lib/advertising/when";
import { cn } from "@/lib/utils";

import { useLoadErrorState } from "../load-error-state";
import { IconAction } from "../icon-action";
import { StatusDot } from "../status-dot";
import { useAdsFormat } from "../use-ads-format";
import type { AudiencePermissions } from "./audiences-page";
import { CrmListDialog } from "./crm-list-dialog";
import { FileListDialog } from "./file-list-dialog";
import { ListResultDialog } from "./list-result-dialog";
import { LookalikeDialog } from "./lookalike-dialog";

type Creating = "crm" | "file" | "lookalike" | null;

const STATE_TONE = { ready: "healthy", too_small: "warning", processing: "info", unavailable: "neutral" } as const;

export function MetaAudiencesPanel({ account, permissions }: { account: AdAccount; permissions: AudiencePermissions }) {
  const t = useTranslations("adsAudiences");
  const fmt = useAdsFormat();
  const { toast } = useToast();
  const loadError = useLoadErrorState();
  const load = useCallback(() => listAudiencesAction(account.id), [account.id]);
  const list = useKeyedLoad(account.id, load);
  const [creating, setCreating] = useState<Creating>(null);
  const [result, setResult] = useState<CustomerListResult | null>(null);
  const [deleting, setDeleting] = useState<Audience | null>(null);

  const response = list.latest;
  const data = response && !isAdsError(response) ? response.data : null;
  const error = response && isAdsError(response) ? response.error : null;
  const audiences = useMemo(() => data?.audiences ?? [], [data]);
  const termsAccepted = data?.termsAccepted ?? false;
  const origins = useMemo(() => originCandidates(audiences), [audiences]);

  const created = (outcome: CustomerListResult) => {
    setCreating(null);
    setResult(outcome);
    list.reload();
  };

  const lookalikeCreated = (audience: Audience) => {
    setCreating(null);
    toast({ title: t("lookalike.created", { name: audience.name }) });
    list.reload();
  };

  const confirmDelete = async () => {
    const target = deleting;
    if (!target) return;
    const outcome = await deleteAudienceAction(target.metaId, account.id);
    setDeleting(null);
    if (isAdsError(outcome)) {
      toast({ title: t("delete.failed"), description: outcome.error, variant: "destructive" });
      return;
    }
    toast({ title: t("delete.done", { name: target.name }) });
    list.update((current) =>
      isAdsError(current)
        ? current
        : { data: { ...current.data, audiences: (current.data.audiences ?? []).filter((audience) => audience.metaId !== target.metaId) } },
    );
  };

  const sizeText = (audience: Audience) => {
    const size = audienceSize(audience);
    if (size.kind === "calculating") return t("size.calculating");
    if (size.kind === "unknown") return fmt.count(null);
    if (size.lower === size.upper) return fmt.count(size.lower);
    return t("size.range", { lower: fmt.count(size.lower), upper: fmt.count(size.upper) });
  };

  const columns: DashboardTableColumn<Audience>[] = [
    {
      key: "name",
      header: t("columns.name"),
      render: (audience) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{audience.name}</p>
          {audience.description ? <p className="truncate text-xs text-muted-foreground">{audience.description}</p> : null}
        </div>
      ),
    },
    {
      key: "kind",
      header: t("columns.kind"),
      render: (audience) => {
        const kind = t.has(`kinds.${audience.kind}`) ? t(`kinds.${audience.kind}`) : t("kinds.OTHER");
        const ratio = audience.kind === "LOOKALIKE" && audience.lookalikeRatio ? ` · ${Math.round(audience.lookalikeRatio * 100)}%` : "";
        return <span className="whitespace-nowrap text-sm text-foreground">{`${kind}${ratio}`}</span>;
      },
    },
    {
      key: "size",
      header: t("columns.size"),
      className: "text-right",
      render: (audience) => <span className="whitespace-nowrap text-sm tabular-nums text-foreground">{sizeText(audience)}</span>,
    },
    {
      key: "status",
      header: t("columns.status"),
      render: (audience) => {
        const state = audienceState(audience);
        return (
          <div className="min-w-0" title={audience.deliveryDescription || audience.operationDescription || undefined}>
            <StatusDot tone={STATE_TONE[state]}>{t(`states.${state}`)}</StatusDot>
            {state !== "ready" && audience.deliveryDescription ? (
              <p className="max-w-64 truncate text-2xs text-muted-foreground">{audience.deliveryDescription}</p>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "updated",
      header: t("columns.updated"),
      render: (audience) => (
        <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
          {formatWhen(audience.updatedTime ?? audience.createdTime, fmt.tag)}
        </span>
      ),
    },
  ];

  const newMenu = permissions.canCreate ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="primary" title={t("actions.new")} icon={<Plus weight="bold" className="h-4 w-4" />} iconVisible iconSide="left" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuItem disabled={!termsAccepted} onSelect={() => setCreating("crm")} className="items-start gap-2 py-2">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="block text-sm font-medium">{t("actions.crm")}</span>
            <span className="block text-xs text-muted-foreground">{t("actions.crmHint")}</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!termsAccepted} onSelect={() => setCreating("file")} className="items-start gap-2 py-2">
          <FileCsv className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="block text-sm font-medium">{t("actions.file")}</span>
            <span className="block text-xs text-muted-foreground">{t("actions.fileHint")}</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={origins.length === 0} onSelect={() => setCreating("lookalike")} className="items-start gap-2 py-2">
          <UsersThree className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="block text-sm font-medium">{t("actions.lookalike")}</span>
            <span className="block text-xs text-muted-foreground">
              {origins.length === 0 ? t("actions.lookalikeNeedsOrigin") : t("actions.lookalikeHint")}
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  return (
    <div className="space-y-4">
      {data && !data.termsAccepted ? (
        <Alert variant="warning">
          <Warning className="h-4 w-4" />
          <AlertTitle>{t("terms.title")}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{t("terms.body")}</span>
            {data.termsUrl ? (
              <a
                href={data.termsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-primary-ink hover:underline"
              >
                {t("terms.open")}
                <ArrowSquareOut className="h-3.5 w-3.5" aria-hidden />
              </a>
            ) : null}
            <button type="button" onClick={list.reload} className="font-semibold text-primary-ink hover:underline">
              {t("terms.check")}
            </button>
          </AlertDescription>
        </Alert>
      ) : null}


      <DashboardTable
        data={audiences}
        columns={columns}
        rowKey={(audience) => audience.metaId}
        loading={list.loading && !data}
        headerLeft={<p className="text-sm text-muted-foreground">{t("meta.description")}</p>}
        headerRight={
          <div className="flex items-center gap-2">
            <IconAction label={t("refresh")} onClick={list.reload} disabled={list.loading}>
              <ArrowClockwise className={cn("h-4 w-4", list.loading && "animate-spin")} />
            </IconAction>
            {newMenu}
          </div>
        }
        renderRowActions={
          permissions.canDelete
            ? (audience) => (
                <IconAction label={t("delete.action")} onClick={() => setDeleting(audience)} danger>
                  <Trash className="h-4 w-4" />
                </IconAction>
              )
            : undefined
        }
        emptyState={error ? loadError(error, list.reload) : {
          icon: <UsersThree className="h-7 w-7 text-muted-foreground" />,
          title: t("empty.title"),
          description: permissions.canCreate ? t("empty.body") : t("empty.bodyReadOnly"),
        }}
      />

      {creating === "crm" ? <CrmListDialog account={account} onClose={() => setCreating(null)} onCreated={created} /> : null}
      {creating === "file" ? <FileListDialog account={account} onClose={() => setCreating(null)} onCreated={created} /> : null}
      {creating === "lookalike" ? (
        <LookalikeDialog account={account} origins={origins} onClose={() => setCreating(null)} onCreated={lookalikeCreated} />
      ) : null}
      <ListResultDialog result={result} onClose={() => setResult(null)} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("delete.title")}
        description={t("delete.body", { name: deleting?.name ?? "" })}
        confirmLabel={t("delete.action")}
        cancelLabel={t("lookalike.cancel")}
        tone="danger"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
