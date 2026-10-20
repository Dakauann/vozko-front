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

import { campaignLaunchBlock } from "./campaign-model";
import { ExternalRiskNotice } from "./notices";
import { groupsRoutes } from "./routes";

export function PostingNumberPicker({
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

  if (!external) {
    return <Slot onClick={() => onPick("")}>{trigger}</Slot>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2 p-2" onClick={(event) => event.stopPropagation()}>
        <ExternalRiskNotice className="px-3 py-2.5" />
        <p className="px-2 text-2xs text-muted-foreground">{t("perGroup")}</p>
        <div className="flex justify-end px-1 pb-1">
          <Button
            type="button"
            variant="primary"
            size="sm"
            title={t("continue")}
            onClick={() => {
              setOpen(false);
              onPick("");
            }}
          />
        </div>
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
  const block = campaignLaunchBlock(groups);
  const external = groups.some((group) => group.origin === "external");
  const groupIds = groups.map((group) => group.id);

  const render = (disabled: boolean) =>
    variant === "menu" ? (
      <button type="button" disabled={disabled} className={MENU_ITEM}>
        <Megaphone className="h-4 w-4 shrink-0" />
        {text}
      </button>
    ) : (
      <Button variant={variant} title={text} icon={<Megaphone />} iconVisible disabled={disabled} />
    );

  if (block) {
    return <TooltipWrapper content={t(block)}>{render(true)}</TooltipWrapper>;
  }

  return (
    <PostingNumberPicker
      seats={groups.flatMap((group) => group.numbers)}
      external={external}
      trigger={render(false)}
      onPick={() => router.push(groupsRoutes.newCampaign("", groupIds))}
    />
  );
}
