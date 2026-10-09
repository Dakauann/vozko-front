"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { createCustomerListAction } from "@/app/actions/advertising-audiences";
import { isAdsError } from "@/app/actions/advertising";
import { listLeadsQueryAction } from "@/app/actions/leads";
import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { Users } from "@/components/icons";
import { LeadsToolbar } from "@/components/leads/LeadsToolbar";
import { useKeyedLoad } from "@/hooks/use-keyed-load";
import { codedErrorMessage } from "@/lib/api/coded-error";
import type { CustomerListResult } from "@/lib/advertising/audiences";
import { issuesAt, type ExpectedIssues } from "@/lib/advertising/issues";
import type { AdAccount } from "@/lib/advertising/types";
import { effectiveLeadFilter } from "@/lib/leads/bulk-selection";
import { emptyLeadFilter, type LeadFilter } from "@/lib/leads/filters";

import { IssueList } from "../field-issue";
import { useAdsFormat } from "../use-ads-format";
import { HashingNote } from "./hashing-note";

export function CrmListDialog({
  account,
  onClose,
  onCreated,
}: {
  account: AdAccount;
  onClose: () => void;
  onCreated: (result: CustomerListResult) => void;
}) {
  const t = useTranslations("adsAudiences.crm");
  const tLeads = useTranslations("leadsPage");
  const fmt = useAdsFormat();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [filter, setFilter] = useState<LeadFilter>(emptyLeadFilter);
  const [search, setSearch] = useState("");
  const [expected, setExpected] = useState<ExpectedIssues>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const crmFilter = useMemo(() => effectiveLeadFilter(filter, search), [filter, search]);
  const loadCount = useCallback(() => listLeadsQueryAction({ filter: crmFilter, page: 1, pageSize: 1 }), [crmFilter]);
  const count = useKeyedLoad(JSON.stringify(crmFilter), loadCount);
  const matching = count.value && !count.value.error ? count.value.meta.totalItems : null;

  const submit = async () => {
    setSaving(true);
    setFailure(null);
    const outcome = await createCustomerListAction({
      adAccountId: account.id,
      name: name.trim(),
      description: description.trim() || undefined,
      source: "crm",
      crmFilter,
    });
    setSaving(false);
    if (isAdsError(outcome)) {
      setExpected(outcome.expected ?? {});
      setFailure(outcome.expected ? null : outcome.error);
      return;
    }
    onCreated(outcome.data);
  };

  return (
    <ElevatedDialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <ElevatedDialogContent className="max-w-3xl">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("description")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <ElevatedInput label={t("name")} placeholder=" " value={name} onChange={(event) => setName(event.target.value)} />
              <IssueList namespace="adsAudiences" issues={issuesAt(expected, "name")} />
            </div>
            <div className="space-y-1">
              <ElevatedInput
                label={t("descriptionLabel")}
                placeholder=" "
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <IssueList namespace="adsAudiences" issues={issuesAt(expected, "description")} />
            </div>
          </div>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t("filterTitle")}</h3>
              <p className="text-xs text-muted-foreground">{t("filterHint")}</p>
            </div>
            <LeadsToolbar
              filter={filter}
              onFilterChange={setFilter}
              search={search}
              onSearchChange={setSearch}
            />
            <div className="flex items-center gap-2 rounded-[--radius] border border-border bg-muted px-3 py-2.5 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
              {count.loading ? (
                <span className="text-muted-foreground">{t("counting")}</span>
              ) : matching === null ? (
                <span className="text-destructive-ink">{codedErrorMessage(tLeads, { code: count.value?.errorCode ?? undefined }, t("countFailed"))}</span>
              ) : (
                <span className="text-foreground">
                  <span className="font-semibold tabular-nums">{fmt.count(matching)}</span> {t("matching", { count: matching })}
                </span>
              )}
            </div>
            <IssueList namespace="adsAudiences" issues={issuesAt(expected, "crmFilter")} />
          </section>

          <HashingNote />
          {failure ? <p className="text-sm text-destructive-ink">{failure}</p> : null}
        </ElevatedDialogBody>
        <ElevatedDialogFooter>
          <Button variant="secondary" title={t("cancel")} onClick={onClose} disabled={saving} />
          <Button variant="primary" title={saving ? t("creating") : t("create")} onClick={submit} disabled={saving || matching === 0} />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
