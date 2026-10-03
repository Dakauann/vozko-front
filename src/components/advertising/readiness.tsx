"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ArrowRight, CheckCircle, MagnifyingGlass, Question, WarningCircle } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "@/i18n/routing";
import { overviewHref } from "@/lib/advertising/connect";
import { accountIsReady, blockingItems, itemAction, readinessKey, readinessState } from "@/lib/advertising/readiness";
import type { AdAccount, AdReadinessItem } from "@/lib/advertising/types";

import { CollapsibleNotice } from "./collapsible-notice";
import { RecheckButton } from "./requirement-steps";
import type { AdReadinessState } from "./use-ad-readiness";
import { ExternalLink } from "./wizard/choice-row";

const STATE_ICONS = {
  ready: <CheckCircle className="h-4 w-4 text-healthy-ink" weight="fill" aria-hidden />,
  missing: <WarningCircle className="h-4 w-4 text-warning-ink" weight="fill" aria-hidden />,
  unknown: <Question className="h-4 w-4 text-muted-foreground" aria-hidden />,
};

export function ReadinessItemAction({
  item,
  account,
  state,
  canCreate,
}: {
  item: AdReadinessItem;
  account: AdAccount;
  state: AdReadinessState;
  canCreate: boolean;
}) {
  const t = useTranslations("adsReadiness");
  const action = itemAction(item);
  if (!action) return null;
  if (action.kind === "portal") {
    return (
      <ExternalLink href={action.url} onOpen={state.openPortal}>
        {t("actions.portal")}
      </ExternalLink>
    );
  }
  const allowed = action.key === "sync" || canCreate;
  return (
    <button
      type="button"
      disabled={!allowed || state.checking}
      title={allowed ? undefined : t("noPermission")}
      onClick={() => state.runInApp(action.key, t("pixelName", { account: account.name }))}
      className="inline-flex items-center gap-1 text-xs font-semibold text-primary-ink hover:underline disabled:opacity-50"
    >
      {t(`actions.${action.key}`)}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

function ItemRow({ item, account, state, canCreate }: { item: AdReadinessItem; account: AdAccount; state: AdReadinessState; canCreate: boolean }) {
  const t = useTranslations("adsReadiness");
  const key = readinessKey(item.key);
  const status = readinessState(item.state);
  if (!key) return null;
  const hintKey = `items.${key}.${status}`;
  const hint = status === "ready" ? null : t.has(hintKey) ? t(hintKey) : t("unknownHint");
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 shrink-0">{STATE_ICONS[status]}</span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
          {t(`items.${key}.title`)}
          {!item.required ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">{t("optional")}</span>
          ) : null}
          <span className="sr-only">{t(`states.${status}`)}</span>
        </p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        <ReadinessItemAction item={item} account={account} state={state} canCreate={canCreate} />
      </div>
    </li>
  );
}

export function ReadinessChecklist({
  items,
  account,
  state,
  canCreate,
}: {
  items: AdReadinessItem[];
  account: AdAccount;
  state: AdReadinessState;
  canCreate: boolean;
}) {
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <ItemRow key={item.key} item={item} account={account} state={state} canCreate={canCreate} />
      ))}
    </ul>
  );
}

function ReadinessFooter({ state }: { state: AdReadinessState }) {
  const t = useTranslations("adsReadiness");
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-3">
        <RecheckButton checking={state.checking} onRecheck={state.recheck} />
        {state.awaiting ? <span className="text-xs text-muted-foreground">{t("awaiting")}</span> : null}
      </div>
      {state.error ? <p className="text-xs text-destructive-ink">{t("loadError", { message: state.error })}</p> : null}
      {state.actionError ? <p className="text-xs text-destructive-ink">{state.actionError}</p> : null}
    </div>
  );
}

export function ReadinessCard({ account, state, canCreate }: { account: AdAccount; state: AdReadinessState; canCreate: boolean }) {
  const t = useTranslations("adsReadiness");
  return (
    <section className="space-y-3 rounded-[--radius] border border-border bg-card p-5 shadow-sm">
      <div className="space-y-1">
        <h2 className="font-display text-base font-semibold text-foreground">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      {state.loading ? <div className="h-40 animate-pulse rounded-[--radius] bg-muted" /> : null}
      {state.readiness ? <ReadinessChecklist items={state.readiness.items} account={account} state={state} canCreate={canCreate} /> : null}
      <ReadinessFooter state={state} />
    </section>
  );
}

function OverviewButton({ account, label }: { account: AdAccount; label: string }) {
  return <Button variant="secondary" size="sm" title={label} link={overviewHref(account.id)} />;
}

function needsAttention(state: AdReadinessState): boolean {
  return !state.loading && !accountIsReady(state.readiness);
}

export function useManagerReadinessEmptyState(account: AdAccount | null, state: AdReadinessState) {
  const t = useTranslations("adsReadiness.banner.manager");
  if (!account || !needsAttention(state)) return null;
  return {
    icon: <MagnifyingGlass className="h-7 w-7 text-muted-foreground" />,
    title: t("title"),
    description: t("emptyBody"),
    action: (
      <div className="mt-2">
        <OverviewButton account={account} label={t("action")} />
      </div>
    ),
  };
}

export function ManagerReadinessBanner({ account, state }: { account: AdAccount; state: AdReadinessState }) {
  const t = useTranslations("adsReadiness.banner.manager");
  if (!needsAttention(state)) return null;
  return (
    <Alert variant="warning">
      <WarningCircle className="h-4 w-4" />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>{t("body")}</span>
        <Link href={overviewHref(account.id)} className="font-semibold text-primary-ink hover:underline">
          {t("action")}
        </Link>
      </AlertDescription>
    </Alert>
  );
}

export function WizardReadinessBanner({
  account,
  state,
  canCreate,
  defaultOpen = false,
}: {
  account: AdAccount;
  state: AdReadinessState;
  canCreate: boolean;
  defaultOpen?: boolean;
}) {
  const t = useTranslations("adsReadiness");
  if (!needsAttention(state)) return null;
  const items = state.readiness ? blockingItems(state.readiness) : [];
  return (
    <CollapsibleNotice
      icon={<WarningCircle className="h-5 w-5 shrink-0 text-warning-ink" weight="fill" aria-hidden />}
      title={t("banner.wizard.title")}
      summary={items.length > 0 ? t("banner.pending", { count: items.length }) : undefined}
      actions={<OverviewButton account={account} label={t("banner.wizard.action")} />}
      defaultOpen={defaultOpen}
    >
      <p className="text-sm text-muted-foreground">{t("banner.wizard.body")}</p>
      {items.length > 0 ? <ReadinessChecklist items={items} account={account} state={state} canCreate={canCreate} /> : null}
      {!state.readiness ? <p className="text-sm text-muted-foreground">{t("unchecked")}</p> : null}
      <ReadinessFooter state={state} />
    </CollapsibleNotice>
  );
}
