"use client";

import { useState, type ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { Megaphone } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { useWorkspace } from "@/contexts/workspace-context";
import { useRouter } from "@/i18n/routing";
import type { GroupOrigin, NumberSeat } from "@/lib/unofficial-whatsapp-groups/types";
import { cn } from "@/lib/utils";

import { sharedPostingSeats, usableSeats } from "./campaign-model";
import { displayPhone } from "./format";
import { ExternalRiskNotice } from "./notices";
import { groupsRoutes } from "./routes";

export function PostingNumberPicker({
  seats,
  onPick,
  trigger,
  external,
}: {
  seats: NumberSeat[];
  onPick: (instanceId: string) => void;
  trigger: ReactNode;
  external?: boolean;
}) {
  const t = useTranslations("unofficialGroups.kit.campaign");
  const [open, setOpen] = useState(false);
  const posting = seats.filter((seat) => seat.canPost);
  const usable = usableSeats(posting);

  if (!external && posting.length === 1 && usable.length === 1) {
    return <Slot onClick={() => onPick(usable[0].instanceId)}>{trigger}</Slot>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2 p-2" onClick={(event) => event.stopPropagation()}>
        {external ? <ExternalRiskNotice className="px-3 py-2.5" /> : null}
        <p className="px-2 pt-1 text-2xs font-semibold text-muted-foreground">{t("pick")}</p>
        <ul className="max-h-64 space-y-0.5 overflow-y-auto">
          {posting.map((seat) => {
            const phone = displayPhone(seat.phone);
            return (
              <li key={seat.instanceId}>
                <button
                  type="button"
                  disabled={!seat.connected}
                  onClick={() => {
                    setOpen(false);
                    onPick(seat.instanceId);
                  }}
                  className="flex w-full items-center gap-2 rounded-[--radius] px-2 py-1.5 text-left text-xs transition-colors hover:bg-[hsl(var(--accent-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                >
                  <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", seat.connected ? "bg-healthy" : "bg-muted-foreground")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-foreground">{seat.label}</span>
                    {phone ? <span className="readout block truncate font-mono text-2xs text-muted-foreground">{phone}</span> : null}
                  </span>
                  {!seat.connected ? <span className="shrink-0 text-2xs text-muted-foreground">{t("offline")}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

const MENU_ITEM =
  "flex w-full items-center gap-2 rounded-[--radius] px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-[hsl(var(--accent-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent";

export function StartCampaignButton({
  groups,
  variant = "secondary",
  label,
}: {
  groups: { id: string; origin: GroupOrigin; numbers: NumberSeat[] }[];
  variant?: "primary" | "secondary" | "menu";
  label?: string;
}) {
  const t = useTranslations("unofficialGroups.kit.campaign");
  const { can } = useWorkspace();
  const router = useRouter();
  if (!can("unofficial_whatsapp_campaigns", "create")) return null;

  const text = label ?? t("newCampaign");
  const shared = sharedPostingSeats(groups);
  const usable = usableSeats(shared);
  const external = groups.some((group) => group.origin === "external");
  const groupIds = groups.map((group) => group.id);
  const reason = groups.length === 0 ? t("noGroups") : shared.length === 0 ? t("noShared") : usable.length === 0 ? t("allOffline") : null;

  const render = (disabled: boolean) =>
    variant === "menu" ? (
      <button type="button" disabled={disabled} className={MENU_ITEM}>
        <Megaphone className="h-4 w-4 shrink-0" />
        {text}
      </button>
    ) : (
      <Button variant={variant} title={text} icon={<Megaphone />} iconVisible disabled={disabled} />
    );

  if (reason) {
    return <TooltipWrapper content={reason}>{render(true)}</TooltipWrapper>;
  }

  return (
    <PostingNumberPicker
      seats={shared}
      external={external}
      trigger={render(false)}
      onPick={(instanceId) => router.push(groupsRoutes.newCampaign(instanceId, groupIds))}
    />
  );
}
