"use client";

import { useEffect, useState } from "react";
import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";

import { getMercadoLivrePackSummaryAction } from "@/app/actions/mercadolivre";
import { localeTagFor } from "@/components/dashboard/attendance/primitives";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip, type StatusChipTone } from "@/components/elevated-design/status-chip";
import { MercadoLivreListingThumb } from "@/components/mercadolivre/mercadolivre-listing-thumb";
import {
  PACK_PENDING_RETRY_MS,
  orderStatusLabel,
  orderStatusTone,
  packLoadOf,
  packMoney,
  shippingStatusLabel,
  shippingStatusTone,
  shippingSubstatusLabel,
  type PackLoad,
  type PackStatusLabel,
} from "@/lib/mercadolivre/pack";
import type { MercadoLivrePackItem, MercadoLivrePackSummary } from "@/lib/mercadolivre/types";

const RELATIVE_TIME_REFRESH_MS = 60_000;

interface LoadedPack {
  entryId: string;
  load: PackLoad;
  retried: boolean;
}

function useMercadoLivrePack(entryId: string): LoadedPack | null {
  const [loaded, setLoaded] = useState<LoadedPack | null>(null);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const fetchPack = async (retried: boolean) => {
      const result = await getMercadoLivrePackSummaryAction(entryId);
      if (cancelled) return;
      const load = packLoadOf(result);
      setLoaded({ entryId, load, retried });
      if (load.state === "pending" && !retried) retry = setTimeout(() => void fetchPack(true), PACK_PENDING_RETRY_MS);
    };
    void fetchPack(false);
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, [entryId]);

  return loaded?.entryId === entryId ? loaded : null;
}

function usePackMoney() {
  const tag = localeTagFor(useLocale());
  return (amount: number, currency: string) => packMoney(amount, currency, tag);
}

function QuietLine({ text }: { text: string }) {
  return <p className="shrink-0 border-b border-border bg-card px-4 py-2 text-2xs text-muted-foreground">{text}</p>;
}

function StatusMark<K extends string>({
  label,
  tone,
  name,
}: {
  label: PackStatusLabel<K> | null;
  tone: StatusChipTone;
  name: (key: K) => string;
}) {
  if (!label) return <EmptyValue />;
  return "key" in label ? <StatusChip tone={tone} label={name(label.key)} /> : <StatusChip tone="muted" label={label.raw} />;
}

function ItemTitle({ item }: { item: MercadoLivrePackItem }) {
  const t = useTranslations("mercadolivre.pack");
  if (!item.permalink) return <span className="block truncate text-sm font-semibold text-foreground">{item.title}</span>;
  return (
    <a
      href={item.permalink}
      target="_blank"
      rel="noopener noreferrer"
      title={t("openListing")}
      className="block truncate text-sm font-semibold text-foreground hover:underline"
    >
      {item.title}
    </a>
  );
}

function ItemPrice({ item, currency }: { item: MercadoLivrePackItem; currency: string }) {
  const t = useTranslations("mercadolivre.pack");
  const money = usePackMoney();
  return (
    <span className="tabular-nums">{t("quantityPrice", { quantity: item.quantity, price: money(item.unitPrice, item.currency || currency) })}</span>
  );
}

function PackItems({ items, currency }: { items: MercadoLivrePackItem[]; currency: string }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <li key={item.itemId} className="flex items-center gap-2">
          <MercadoLivreListingThumb url={item.thumbnailUrl} className="h-8 w-8" />
          <span className="min-w-0 flex-1">
            <ItemTitle item={item} />
            <span className="block text-2xs text-muted-foreground">
              <ItemPrice item={item} currency={currency} />
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function PackCard({ pack }: { pack: MercadoLivrePackSummary }) {
  const t = useTranslations("mercadolivre.pack");
  const format = useFormatter();
  const now = useNow({ updateInterval: RELATIVE_TIME_REFRESH_MS });
  const money = usePackMoney();
  const [expanded, setExpanded] = useState(false);
  const [first, ...rest] = pack.items;
  const substatus = shippingSubstatusLabel(pack.shippingSubstatus);

  return (
    <section aria-label={t("title")} className="flex shrink-0 flex-col gap-2 border-b border-border bg-card px-4 py-2">
      <div className="flex items-center gap-3">
        {first ? <MercadoLivreListingThumb url={first.thumbnailUrl} className="h-10 w-10" /> : null}
        <div className="min-w-0 flex-1">
          {first ? <ItemTitle item={first} /> : <span className="block text-sm font-semibold text-foreground">{t("title")}</span>}
          {first ? (
            <p className="truncate text-2xs text-muted-foreground">
              <ItemPrice item={first} currency={pack.currency} />
              {rest.length > 0 ? <span> · {t("moreItems", { count: rest.length })}</span> : null}
            </p>
          ) : null}
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{t("total", { amount: money(pack.total, pack.currency) })}</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          {t("order")}
          <StatusMark label={orderStatusLabel(pack.orderStatus)} tone={orderStatusTone(pack.orderStatus)} name={(key) => t(key)} />
        </span>
        <span className="inline-flex items-center gap-1.5">
          {t("shipping")}
          <StatusMark label={shippingStatusLabel(pack.shippingStatus)} tone={shippingStatusTone(pack.shippingStatus)} name={(key) => t(key)} />
          {substatus ? <span className="text-foreground">{"key" in substatus ? t(substatus.key) : substatus.raw}</span> : null}
        </span>
        <span>{t("refreshed", { when: format.relativeTime(new Date(pack.refreshedAt), now) })}</span>
        {rest.length > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            className="font-medium text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {expanded ? t("hideItems") : t("showItems", { count: pack.items.length })}
          </button>
        ) : null}
      </div>

      {expanded ? <PackItems items={pack.items} currency={pack.currency} /> : null}
    </section>
  );
}

export function MercadoLivreSaleSummary({ entryId }: { entryId: string }) {
  const t = useTranslations("mercadolivre.pack");
  const loaded = useMercadoLivrePack(entryId);
  if (!loaded) return null;
  switch (loaded.load.state) {
    case "ready":
      return <PackCard pack={loaded.load.pack} />;
    case "pending":
      return <QuietLine text={loaded.retried ? t("stillPending") : t("pending")} />;
    case "failed":
      return <QuietLine text={t("failed")} />;
    case "forbidden":
      return null;
  }
}
