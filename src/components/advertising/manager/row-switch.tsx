"use client";

import { useTranslations } from "next-intl";

import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { toggleBlockerKey } from "@/lib/advertising/delivery";
import type { TableRow } from "@/lib/advertising/manager-drafts";
import type { AdAccount, AdRow } from "@/lib/advertising/types";

export function RowSwitch({
  row,
  account,
  permissions,
  busy,
  onToggle,
}: {
  row: TableRow;
  account: AdAccount;
  permissions: { canStart: boolean; canStop: boolean };
  busy: boolean;
  onToggle: (row: AdRow, on: boolean) => void;
}) {
  const tTable = useTranslations("adsManager.table");
  const tToggle = useTranslations("adsManager.toggleBlocker");
  const tDrafts = useTranslations("adsManager.drafts");
  const blocker = row.draft ? null : toggleBlockerKey(row, account, permissions);
  const reason = row.draft ? tDrafts("toggleHint") : blocker ? tToggle(blocker) : "";
  const locked = !!row.draft || !!blocker;
  return (
    <TooltipWrapper content={reason} enabled={locked}>
      <span onClick={(event) => event.stopPropagation()} className="inline-flex" tabIndex={locked ? 0 : undefined}>
        <ElevatedSwitch
          checked={row.isOn}
          disabled={locked || busy}
          onCheckedChange={(on) => onToggle(row, on)}
          aria-label={tTable(row.isOn ? "turnOff" : "turnOn", { name: row.name })}
          aria-description={reason || undefined}
        />
      </span>
    </TooltipWrapper>
  );
}
