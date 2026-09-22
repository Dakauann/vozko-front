"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, DotsThree, Robot } from "@/components/icons";
import {
  type NextConversationStatus,
  nextConversationStatuses,
} from "@/lib/conversations/status-actions";
import { cn } from "@/lib/utils";


export interface ConversationWindowActionsTranslations {
  actions: string;
  statusHeading: string;
  markOngoing: string;
  markFinished: string;
  automationOn: string;
  automationOff: string;
}

interface ConversationWindowActionsProps {
  conversationStatus?: string;
  automationEnabled?: boolean | null;
  canSetStatus: boolean;
  canToggleAutomation: boolean;
  togglingAutomation?: boolean;
  translations: ConversationWindowActionsTranslations;
  onSetStatus: (status: NextConversationStatus) => void;
  onToggleAutomation: () => void;
}

export default function ConversationWindowActions({
  conversationStatus,
  automationEnabled,
  canSetStatus,
  canToggleAutomation,
  togglingAutomation = false,
  translations: t,
  onSetStatus,
  onToggleAutomation,
}: ConversationWindowActionsProps) {
  const statuses = canSetStatus
    ? nextConversationStatuses(conversationStatus)
    : [];
  const automationOn = automationEnabled !== false;

  if (statuses.length === 0 && !canToggleAutomation) return null;

  const statusLabel = (status: NextConversationStatus) =>
    status === "ongoing" ? t.markOngoing : t.markFinished;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t.actions}
          title={t.actions}
          className="flex h-7 w-7 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <DotsThree size={16} weight="bold" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {statuses.length > 0 && (
          <>
            <DropdownMenuLabel className="text-2xs font-semibold text-muted-foreground">
              {t.statusHeading}
            </DropdownMenuLabel>
            {statuses.map((status) => (
              <DropdownMenuItem
                key={status}
                onSelect={() => onSetStatus(status)}
                className="gap-2 text-xs"
              >
                <Check size={14} className="text-muted-foreground" />
                {statusLabel(status)}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {statuses.length > 0 && canToggleAutomation && <DropdownMenuSeparator />}

        {canToggleAutomation && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              onToggleAutomation();
            }}
            disabled={togglingAutomation}
            className="gap-2 text-xs"
          >
            <Robot
              size={14}
              weight={automationOn ? "fill" : "regular"}
              className={cn(
                automationOn ? "text-primary-ink" : "text-muted-foreground",
                togglingAutomation && "animate-pulse",
              )}
            />
            {automationOn ? t.automationOn : t.automationOff}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
