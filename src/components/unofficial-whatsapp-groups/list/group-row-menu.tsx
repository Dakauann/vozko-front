"use client";

import { useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getWorkspaceGroupInviteLinkAction } from "@/app/actions/unofficial-whatsapp-groups";
import { ArrowSquareOut, ChartLine, CopySimple, DotsThree, Megaphone, Sparkle } from "@/components/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/contexts/workspace-context";
import { useRouter } from "@/i18n/routing";
import { groupErrorKey } from "@/lib/unofficial-whatsapp-groups/group-errors";
import type { GroupRow } from "@/lib/unofficial-whatsapp-groups/types";

import { PostingNumberPicker } from "../kit/campaign";
import { sharedPostingSeats, usableSeats } from "../kit/campaign-model";
import { groupsRoutes } from "../kit/routes";

function ItemText({ label, reason }: { label: string; reason?: string | null }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block">{label}</span>
      {reason ? <span className="block text-2xs text-muted-foreground">{reason}</span> : null}
    </span>
  );
}

function MenuIcon({ children }: { children: ReactNode }) {
  return <span className="mr-2 inline-flex shrink-0">{children}</span>;
}

export function GroupRowMenu({ row, onNewAnalysis }: { row: GroupRow; onNewAnalysis: (groupId: string) => void }) {
  const t = useTranslations("unofficialGroups.list");
  const tErrors = useTranslations("unofficialGroups.list.errors");
  const tCampaign = useTranslations("unofficialGroups.kit.campaign");
  const router = useRouter();
  const { can } = useWorkspace();
  const [open, setOpen] = useState(false);
  const pickerAnchor = useRef<HTMLSpanElement>(null);
  const pickAfterClose = useRef(false);
  const group = row.group;
  const canConfigure = can("unofficial_whatsapp_groups", "configure");
  const canCampaign = can("unofficial_whatsapp_campaigns", "create");
  const hasAdminSeat = row.numbers.some((seat) => seat.admin);
  const postingSeats = sharedPostingSeats([{ numbers: row.numbers }]);
  const campaignBlocked = postingSeats.length === 0 ? tCampaign("noShared") : usableSeats(postingSeats).length === 0 ? tCampaign("allOffline") : null;

  const copyInvite = async () => {
    const result = await getWorkspaceGroupInviteLinkAction(group.id);
    if (result.error || !result.inviteLink) {
      const key = groupErrorKey(result.error);
      toast.error(t("invite.failed"), { description: key ? tErrors(key) : result.error });
      return;
    }
    try {
      await navigator.clipboard.writeText(result.inviteLink);
      toast(t("invite.copied"), { description: result.inviteLink });
    } catch {
      toast(t("invite.ready"), { description: result.inviteLink });
    }
  };

  return (
    <span className="relative inline-flex" onClick={(event) => event.stopPropagation()}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("rowMenu.label", { name: group.subject })}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex h-7 w-7 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-[hsl(var(--accent-hover))] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <DotsThree className="h-4 w-4" weight="bold" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-60"
          onClick={(event) => event.stopPropagation()}
          onCloseAutoFocus={(event) => {
            if (!pickAfterClose.current) return;
            pickAfterClose.current = false;
            event.preventDefault();
            pickerAnchor.current?.click();
          }}
        >
          <DropdownMenuItem onSelect={() => router.push(groupsRoutes.group(group.id))}>
            <ArrowSquareOut className="mr-2 h-4 w-4" />
            {t("rowMenu.open")}
          </DropdownMenuItem>
          {canCampaign ? (
            <DropdownMenuItem
              disabled={campaignBlocked !== null}
              onSelect={() => {
                pickAfterClose.current = true;
              }}
            >
              <MenuIcon>
                <Megaphone className="h-4 w-4" />
              </MenuIcon>
              <ItemText label={tCampaign("newCampaign")} reason={campaignBlocked} />
            </DropdownMenuItem>
          ) : null}
          {canConfigure && group.followedAt ? (
            <DropdownMenuItem onSelect={() => onNewAnalysis(group.id)}>
              <Sparkle className="mr-2 h-4 w-4" />
              {t("rowMenu.newAnalysis")}
            </DropdownMenuItem>
          ) : null}
          {row.hasAnalysis ? (
            <DropdownMenuItem onSelect={() => router.push(groupsRoutes.group(group.id, { tab: "analysis" }))}>
              <ChartLine className="mr-2 h-4 w-4" />
              {t("rowMenu.viewAnalyses")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!hasAdminSeat} onSelect={() => void copyInvite()}>
            <MenuIcon>
              <CopySimple className="h-4 w-4" />
            </MenuIcon>
            <ItemText label={t("rowMenu.copyInvite")} reason={hasAdminSeat ? null : t("rowMenu.inviteNeedsAdmin")} />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {canCampaign && campaignBlocked === null ? (
        <PostingNumberPicker
          seats={postingSeats}
          external={group.origin === "external"}
          onPick={(instanceId) => router.push(groupsRoutes.newCampaign(instanceId, [group.id]))}
          trigger={<span ref={pickerAnchor} aria-hidden tabIndex={-1} className="pointer-events-none absolute inset-0" />}
        />
      ) : null}
    </span>
  );
}
