"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { getAdEditableObjectAction } from "@/app/actions/advertising";
import { getAdsOptionsAction } from "@/app/actions/advertising-create";
import { Warning } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAdAccounts } from "@/hooks/use-ad-accounts";
import { managerHref } from "@/lib/advertising/connect";
import { civilToday } from "@/lib/advertising/date-range";
import type { WizardForm } from "@/lib/advertising/draft";
import type { AdsOptions } from "@/lib/advertising/draft-types";
import { objectAnalysis } from "@/lib/advertising/editor-analysis";
import { creativeSwapForm } from "@/lib/advertising/editor-form";
import { objectChain, objectOrder, objectTree, type ObjectTree } from "@/lib/advertising/editor-tree";
import type { AdAccount, AdEditableObject, AdRow } from "@/lib/advertising/types";

import { AdPreviewPanel } from "../ad-preview-panel";
import { ObjectEditForm } from "../edit/object-editor";
import { DeliveryStatus } from "../status-dot";
import { CardSections } from "../wizard/choice-row";
import { previewContent } from "../wizard/preview-content";
import { useAdsResource } from "../wizard/use-ads-resource";
import { useStructureRows } from "../wizard/use-structure-rows";
import { useAdPages } from "../wizard/wizard-context";
import { AnalysisFacts } from "./analysis-view";
import { CreativeSwap } from "./creative-swap";
import { AdDestinationPreview } from "./destination-preview";
import { EditorFooter } from "./editor-footer";
import { EditorBreadcrumb, EditorFailure, EditorShell, EditorStatusLine, EditorTree, TREE_LEVEL, type EditorTab, type TreeEntry } from "./editor-shell";

export function PublishedEditor({ metaId, accountId }: { metaId: string; accountId: string }) {
  const t = useTranslations("adsEditor");
  const { can, permissionsLoading } = useWorkspace();
  const canRead = !permissionsLoading && can("ads", "read");
  const canUpdate = !permissionsLoading && can("ads", "update");
  const [now] = useState(() => new Date());
  const accountsState = useAdAccounts({ enabled: canRead, requested: accountId });
  const options = useAdsResource(canRead ? "ads-options" : null, getAdsOptionsAction);
  const root = useAdsResource(canRead ? `object:${metaId}` : null, () => getAdEditableObjectAction(metaId));
  const account = accountsState.accounts.find((candidate) => candidate.id === accountId);
  const rootRow = root.status === "ready" ? root.data.row : null;
  const campaignId = rootRow ? (rootRow.level === "campaign" ? rootRow.metaId : (rootRow.campaignId ?? "")) : "";
  const today = account ? civilToday(account.timezone, now) : null;
  const scope = campaignId ? [campaignId] : [];
  const campaigns = useStructureRows(accountId, "campaign", !!campaignId, today, scope);
  const adSets = useStructureRows(accountId, "adset", !!campaignId, today, scope);
  const ads = useStructureRows(accountId, "ad", !!campaignId, today, scope);

  if (permissionsLoading) return <div className="h-64 animate-pulse rounded-[--radius] bg-muted" />;
  if (!canRead) return <p className="text-sm text-muted-foreground">{t("noAccess")}</p>;
  const resources = [options, root, campaigns, adSets, ads];
  const failed = accountsState.error ?? resources.map((resource) => (resource.status === "error" ? resource.message : null)).find(Boolean);
  if (failed) return <EditorFailure message={t("loadFailed", { message: failed })} />;
  if (accountsState.loading || resources.some((resource) => resource.status !== "ready")) {
    return <div className="h-64 animate-pulse rounded-[--radius] bg-muted" />;
  }
  if (!account) return <EditorFailure message={t("accountMissing")} />;
  if (options.status !== "ready" || campaigns.status !== "ready" || adSets.status !== "ready" || ads.status !== "ready") return null;
  const tree = objectTree([...campaigns.data, ...adSets.data, ...ads.data], campaignId);
  if (!tree.campaign) return <EditorFailure message={t("objectMissing")} />;

  const reloadTree = () => {
    campaigns.reload();
    adSets.reload();
    ads.reload();
  };

  return (
    <PublishedEditorBody
      account={account}
      accounts={accountsState.accounts}
      options={options.data}
      tree={tree}
      initialId={metaId}
      canUpdate={canUpdate}
      onRowsChanged={reloadTree}
    />
  );
}

function PublishedEditorBody({
  account,
  accounts,
  options,
  tree,
  initialId,
  canUpdate,
  onRowsChanged,
}: {
  account: AdAccount;
  accounts: AdAccount[];
  options: AdsOptions;
  tree: ObjectTree;
  initialId: string;
  canUpdate: boolean;
  onRowsChanged: () => void;
}) {
  const t = useTranslations("adsEditor");
  const tEdit = useTranslations("adsManager.edit");
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(initialId);
  const [tab, setTab] = useState<EditorTab>("edit");
  const [swapForm, setSwapForm] = useState<WizardForm | null>(null);
  const detail = useAdsResource(`object:${selectedId}`, () => getAdEditableObjectAction(selectedId));
  const pages = useAdPages(account.id);
  const order = objectOrder(tree);
  const chain = objectChain(tree, selectedId);
  const [campaignRow, adSetRow] = chain;
  const position = order.findIndex((row) => row.metaId === selectedId);
  const back = order[position - 1];
  const next = order[position + 1];

  const updateSwap: Dispatch<SetStateAction<WizardForm>> = (change) =>
    setSwapForm((current) => current && (typeof change === "function" ? change(current) : change));

  const select = (metaId: string) => {
    setSelectedId(metaId);
    setSwapForm(null);
  };

  const entry = (row: AdRow): TreeEntry => ({
    key: row.metaId,
    level: TREE_LEVEL[row.level],
    label: row.name || row.metaId,
    selected: row.metaId === selectedId,
    onSelect: () => select(row.metaId),
  });
  const entries = [entry(tree.campaign as AdRow), ...tree.adSets.flatMap((branch) => [entry(branch.row), ...branch.ads.map(entry)])];
  const crumbs = chain.map((row) => ({ key: row.metaId, label: row.name || row.metaId, current: row.metaId === selectedId, onSelect: () => select(row.metaId) }));

  const loaded: AdEditableObject | null = detail.status === "ready" ? detail.data : null;
  const isAd = loaded?.row.level === "ad";
  const liveForm = loaded && isAd ? creativeSwapForm(loaded, account.id, campaignRow ?? null, adSetRow ?? null) : null;
  const previewForm = swapForm ?? liveForm;
  const page = pages.status === "ready" ? pages.data.find((candidate) => candidate.pageId === previewForm?.pageId) : undefined;
  const content = previewForm ? previewContent(previewForm.destination, previewForm.ads[0], page) : null;

  const saved = (row: AdRow) => {
    setSwapForm(null);
    detail.reload();
    onRowsChanged();
    if (row.metaId !== selectedId) setSelectedId(row.metaId);
  };

  const body = (() => {
    if (detail.status === "error") {
      return (
        <div className="flex items-center gap-2 text-sm text-destructive-ink">
          <Warning className="h-4 w-4" aria-hidden />
          {detail.message}
          <button type="button" onClick={detail.reload} className="ml-auto font-semibold text-primary-ink hover:underline">
            {tEdit("retry")}
          </button>
        </div>
      );
    }
    if (!loaded) return <div className="h-48 animate-pulse rounded-[--radius] bg-muted" />;
    if (tab === "analyze") {
      return (
        <section className="rounded-[--radius] border border-border bg-card p-5 shadow-sm">
          <AnalysisFacts facts={objectAnalysis(loaded, account.timezone)} currency={account.currency} />
        </section>
      );
    }
    if (swapForm) {
      return (
        <CreativeSwap
          form={swapForm}
          setForm={updateSwap}
          account={account}
          accounts={accounts}
          options={options}
          onSaved={saved}
          onCancel={() => setSwapForm(null)}
        />
      );
    }
    return (
      <CardSections>
        <ObjectEditForm
          key={loaded.row.metaId}
          detail={loaded}
          account={account}
          catalog={options.placements ?? {}}
          canUpdate={canUpdate}
          onSaved={saved}
          onSwapCreative={liveForm ? () => setSwapForm(liveForm) : undefined}
        />
      </CardSections>
    );
  })();

  return (
    <EditorShell
      breadcrumb={<EditorBreadcrumb crumbs={crumbs} />}
      status={<EditorStatusLine status={null} detail={loaded ? <DeliveryStatus delivery={loaded.row.delivery} /> : null} />}
      tab={tab}
      onTab={setTab}
      tree={<EditorTree entries={entries} label={t("tree.objectLabel")} />}
      aside={
        tab === "edit" && content ? (
          <AdPreviewPanel content={content} destination={<AdDestinationPreview content={content} accountId={account.id} page={page} />} />
        ) : undefined
      }
      footer={
        <EditorFooter
          onClose={() => router.push(managerHref({ accountId: account.id, campaignId: tree.campaign?.metaId }))}
          onBack={back ? () => select(back.metaId) : null}
          onNext={next ? () => select(next.metaId) : null}
        />
      }
    >
      {body}
    </EditorShell>
  );
}
