"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Check, Link as LinkIcon, WarningCircle } from "@/components/icons";
import { linkLeadRelationAction } from "@/app/actions/leads";
import { codedErrorMessage } from "@/lib/api/coded-error";
import type { LinkOffer } from "@/lib/leads/sheet-save";

import { SheetLinkButton } from "./SheetSection";

function offerKey(offer: LinkOffer): string {
  return `${offer.leadId}:${offer.kind}`;
}

export function LinkOfferList({ leadId, offers, onLinked }: { leadId: string; offers: LinkOffer[]; onLinked: () => void }) {
  const t = useTranslations("leadSheet.linkOffers");
  const tKinds = useTranslations("leadSheet.family.kinds");
  const tLeads = useTranslations("leads");
  const [linked, setLinked] = useState<ReadonlySet<string>>(new Set());
  const [linking, setLinking] = useState<string | null>(null);

  const link = async (offer: LinkOffer) => {
    const key = offerKey(offer);
    setLinking(key);
    const result = await linkLeadRelationAction(leadId, offer.leadId, offer.kind);
    setLinking(null);
    if (result.error) {
      toast.error(codedErrorMessage(tLeads, result.error, t("failed")));
      return;
    }
    setLinked((previous) => new Set([...previous, key]));
    onLinked();
  };

  return (
    <div role="status" className="space-y-2 rounded-[--radius] border border-border bg-muted p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <WarningCircle className="h-4 w-4 text-info-ink" aria-hidden />
        {t("title")}
      </p>
      <ul className="space-y-1.5">
        {offers.map((offer) => {
          const key = offerKey(offer);
          const kind = tKinds(offer.kind);
          return (
            <li key={key} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
              <span className="font-medium text-foreground">{t("item", { name: offer.label })}</span>
              <Link
                href={`/dashboard/leads/${offer.leadId}`}
                className="inline-flex min-h-[34px] items-center text-sm font-medium text-primary-ink hover:underline sm:min-h-0"
              >
                {t("open")}
              </Link>
              {linked.has(key) ? (
                <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-healthy-ink">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  {t("linked")}
                </span>
              ) : (
                <SheetLinkButton icon={<LinkIcon />} onClick={() => void link(offer)} disabled={linking === key}>
                  {t("link", { kind })}
                </SheetLinkButton>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
