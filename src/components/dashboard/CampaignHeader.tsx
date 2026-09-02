"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowClockwise,
  CaretLeft,
  ChatCircleDots,
  DotsThreeVertical,
  Monitor,
  PauseCircle,
  Pencil,
  PlayCircle,
  StopCircle,
  Trash,
  WifiHigh,
  WifiMedium,
  WifiSlash,
} from "@/components/icons";
import type { CampaignType, ConnectionStatus } from "@/lib/conversations/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useEffect, useRef, useState, type ReactNode } from "react";

import Button from "@/components/elevated-design/button";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { cn } from "@/lib/utils";
import { useCrm } from "@/contexts/crm-context";


export interface CampaignHeaderTranslations {
  back: string;
  badge: string;
  crm: string;
  edit: string;
  reset: string;
  clearHistory: string;
  stop: string;
  pause: string;
  start: string;
  restart: string;
  actions: string;
  dangerZone: string;
  wsConnected: string;
  wsConnecting: string;
  wsDisconnected: string;
  noPermissionStart?: string;
  noPermissionUpdate?: string;
}

interface CampaignHeaderProps {
  name: string;
  status: string;
  campaignType: CampaignType;
  backLink: string;
  editLink: string;
  isPending?: boolean;
  canStart?: boolean;
  canPause?: boolean;
  canStop?: boolean;
  canReset?: boolean;
  hasPermissionStart?: boolean;
  /**
   * Whether the viewer may HALT a running campaign.
   *
   * Separate from hasPermissionStart because the two are separate RBAC actions:
   * being able to stop a runaway blast is a safety valve and must not require
   * the privilege to launch one. Defaults to hasPermissionStart so callers that
   * do not distinguish them keep their existing behaviour.
   */
  hasPermissionStop?: boolean;
  hasPermissionUpdate?: boolean;
  hasActiveSubscription?: boolean;
  plansLink?: string;
  onShowCrm: () => void;
  onReset: () => void;
  onClearHistory: () => void;
  onLifecycle: (action: "start" | "pause" | "stop") => void;
  isMonitoring?: boolean;
  onToggleMonitoring?: () => void;
  /**
   * The transport chip shown beside the badge, e.g. "Não oficial".
   *
   * The spine already carries this on the family header, and it is the ONLY
   * thing separating two WhatsApp families at a glance — but an operator who
   * deep-links straight to a campaign never passes through the spine. Without
   * it, the two campaign products are indistinguishable on the one screen where
   * confusing them means sending from the wrong number under the wrong rules.
   */
  transportBadge?: { label: string; hint?: string };
  /**
   * Channel-specific entries for the actions menu, rendered above Edit.
   *
   * A slot rather than another boolean prop per action: what belongs here is
   * whatever a channel has that the others do not, and the alternative — a row
   * of buttons under the header — adds a band of vertical space the official
   * campaign does not have, so the two pages stop lining up.
   *
   * Receives `close` so an entry can dismiss the menu after acting.
   */
  extraActions?: (close: () => void) => ReactNode;
  translations: CampaignHeaderTranslations;
}


const statusStyles: Record<string, { bg: string; text: string; dot: string }> =
  {
    IDLE: {
      bg: "bg-muted",
      text: "text-muted-foreground",
      dot: "bg-muted",
    },
    STOPPED: {
      bg: "bg-muted",
      text: "text-muted-foreground",
      dot: "bg-muted",
    },
    RUNNING: {
      bg: "bg-muted",
      text: "text-healthy-ink",
      dot: "bg-healthy",
    },
    PAUSED: {
      bg: "bg-muted",
      text: "text-warning-ink",
      dot: "bg-warning",
    },
    COMPLETED: {
      bg: "bg-muted",
      text: "text-primary-ink",
      dot: "bg-muted",
    },
  };

function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] ?? statusStyles.IDLE;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[--radius] px-2.5 py-1 text-2xs font-semibold",
        style.bg,
        style.text,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          style.dot,
          status === "RUNNING" && "animate-pulse",
        )}
      />
      {status}
    </span>
  );
}


function WsStatusIndicator({
  status,
  translations: t,
}: {
  status: ConnectionStatus;
  translations: Pick<
    CampaignHeaderTranslations,
    "wsConnected" | "wsConnecting" | "wsDisconnected"
  >;
}) {
  const config: Record<
    ConnectionStatus,
    {
      icon: typeof WifiHigh;
      label: string;
      className: string;
      dotClass: string;
      animate: boolean;
    }
  > = {
    connected: {
      icon: WifiHigh,
      label: t.wsConnected,
      className: "text-healthy-ink bg-muted border-border",
      dotClass: "bg-healthy",
      animate: false,
    },
    connecting: {
      icon: WifiMedium,
      label: t.wsConnecting,
      className: "text-warning-foreground bg-warning border-warning",
      dotClass: "bg-warning",
      animate: true,
    },
    disconnected: {
      icon: WifiSlash,
      label: t.wsDisconnected,
      className: "text-muted-foreground bg-muted border-border",
      dotClass: "bg-muted",
      animate: false,
    },
    error: {
      icon: WifiSlash,
      label: t.wsDisconnected,
      className: "text-destructive-foreground bg-destructive border-destructive",
      dotClass: "bg-destructive",
      animate: false,
    },
  };

  const { icon: Icon, label, className, dotClass, animate } = config[status];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[--radius] border px-2 py-0.5 text-2xs font-semibold transition-colors",
        className,
      )}
      title={label}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          dotClass,
          animate && "animate-pulse",
        )}
      />
      <Icon weight="bold" className="h-3 w-3" />
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}


interface ActionsDropdownProps {
  /** Channel-specific entries, rendered above Edit. Receives a close callback. */
  extraActions?: (close: () => void) => ReactNode;
  isPending?: boolean;
  canReset?: boolean;
  hasPermissionUpdate?: boolean;
  editLink: string;
  onReset: () => void;
  onClearHistory: () => void;
  translations: Pick<
    CampaignHeaderTranslations,
    | "edit"
    | "reset"
    | "clearHistory"
    | "actions"
    | "dangerZone"
    | "noPermissionUpdate"
  >;
}

function ActionsDropdown({
  extraActions,
  isPending,
  canReset,
  hasPermissionUpdate = true,
  editLink,
  onReset,
  onClearHistory,
  translations: t,
}: ActionsDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline-subtle"
        onClick={() => setOpen(!open)}
        title={t.actions}
        icon={<DotsThreeVertical weight="bold" className="h-4 w-4" />}
        iconVisible
        iconSide="left"
        className={cn(open && "bg-muted")}
      />

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-1 w-48 rounded-[--radius] border border-border bg-card py-1 shadow-lg"
          >
            {extraActions ? (
              <>
                {extraActions(() => setOpen(false))}
                <div className="my-1 border-t border-border" />
              </>
            ) : null}

            <TooltipWrapper
              content={t.noPermissionUpdate || "Sem permissão"}
              enabled={!hasPermissionUpdate}
              side="bottom"
            >
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  window.location.href = editLink;
                }}
                disabled={!hasPermissionUpdate}
                title={t.edit}
                icon={<Pencil weight="bold" className="h-4 w-4" />}
                iconVisible
                iconSide="left"
                className="w-full justify-start rounded-lg text-sm text-foreground"
              />
            </TooltipWrapper>

            <div className="my-1 border-t border-border" />

            <p className="px-3 py-1 text-2xs font-semibold text-muted-foreground">
              {t.dangerZone}
            </p>

            <TooltipWrapper
              content={t.noPermissionUpdate || "Sem permissão"}
              enabled={!hasPermissionUpdate}
              side="bottom"
            >
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  onReset();
                }}
                disabled={isPending || !canReset || !hasPermissionUpdate}
                title={t.reset}
                icon={<ArrowClockwise weight="bold" className="h-4 w-4" />}
                iconVisible
                iconSide="left"
                iconColor="currentColor"
                className="w-full justify-start rounded-lg text-sm text-warning-ink hover:!bg-muted"
              />
            </TooltipWrapper>

            <TooltipWrapper
              content={t.noPermissionUpdate || "Sem permissão"}
              enabled={!hasPermissionUpdate}
              side="bottom"
            >
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  onClearHistory();
                }}
                disabled={isPending || !canReset || !hasPermissionUpdate}
                title={t.clearHistory}
                icon={<Trash weight="bold" className="h-4 w-4" />}
                iconVisible
                iconSide="left"
                iconColor="currentColor"
                className="w-full justify-start rounded-lg text-sm text-destructive-ink hover:!bg-muted"
              />
            </TooltipWrapper>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


export default function CampaignHeader({
  name,
  status,
  campaignType,
  backLink,
  editLink,
  isPending = false,
  canStart = false,
  canPause = false,
  canStop = false,
  canReset = false,
  hasPermissionStart = true,
  hasPermissionStop,
  hasPermissionUpdate = true,
  transportBadge,
  extraActions,
  hasActiveSubscription = true,
  plansLink = "/dashboard/plans",
  onShowCrm,
  onReset,
  onClearHistory,
  onLifecycle,
  isMonitoring = false,
  onToggleMonitoring,
  translations: t,
}: CampaignHeaderProps) {
  const crmContext = useCrm();
  const wsStatus = crmContext.status;

  // Halting falls back to the start privilege only where the caller does not
  // distinguish them, so existing callers behave exactly as before.
  const canHalt = hasPermissionStop ?? hasPermissionStart;

  const badgeColor =
    campaignType === "whatsapp"
      ? "text-healthy-ink"
      : campaignType === "unofficial_whatsapp"
        ? "text-muted-foreground"
        : "text-primary-ink";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Left: Back + Title + Status */}
      <div className="flex items-center gap-2 min-w-0">
        <Button
          variant="ghost"
          title={t.back}
          icon={<CaretLeft weight="bold" className="h-4 w-4" />}
          iconVisible
          iconSide="left"
          link={backLink}
          newTab={false}
          className="flex-shrink-0 text-xs font-semibold px-2"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className={cn(
                "text-2xs font-semibold",
                badgeColor,
              )}
            >
              {t.badge}
            </p>
            {transportBadge ? (
              <span
                title={transportBadge.hint}
                className="shrink-0 rounded-lg border border-border px-1.5 py-px text-2xs font-medium normal-case tracking-normal text-muted-foreground"
              >
                {transportBadge.label}
              </span>
            ) : null}
            <StatusBadge status={status} />
            <WsStatusIndicator
              status={wsStatus}
              translations={{
                wsConnected: t.wsConnected,
                wsConnecting: t.wsConnecting,
                wsDisconnected: t.wsDisconnected,
              }}
            />
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-[0.01em] text-foreground truncate mt-0.5">
            {name}
          </h1>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
        {/* Monitoring Mode Toggle */}
        {onToggleMonitoring && (
          <Button
            variant="outline-subtle"
            onClick={onToggleMonitoring}
            title={isMonitoring ? "Sair do Monitor" : "Modo Monitor"}
            icon={
              <Monitor
                weight={isMonitoring ? "fill" : "bold"}
                className="h-4 w-4"
              />
            }
            iconVisible
          />
        )}

        {/* CRM Button - Primary action */}
        <Button
          variant="outline-subtle"
          title={t.crm}
          icon={<ChatCircleDots weight="fill" className="h-4 w-4" />}
          iconVisible
          iconSide="left"
          onClick={onShowCrm}
        />

        {/* Lifecycle buttons */}
        <div className="flex items-center gap-0.5">
          <TooltipWrapper
            content={t.noPermissionStart || "Sem permissão"}
            enabled={!canHalt}
          >
            <Button
              variant="outline-subtle"
              onClick={() => onLifecycle("stop")}
              disabled={isPending || !canStop || !canHalt}
              aria-label={t.stop}
              icon={<StopCircle weight="fill" className="h-4 w-4" />}
              iconVisible
              iconColor={canStop && canHalt ? "#ef4444" : undefined}
              size="icon"
            />
          </TooltipWrapper>

          <TooltipWrapper
            content={t.noPermissionStart || "Sem permissão"}
            enabled={!canHalt}
          >
            <Button
              variant="outline-subtle"
              onClick={() => onLifecycle("pause")}
              disabled={isPending || !canPause || !canHalt}
              aria-label={t.pause}
              icon={<PauseCircle weight="fill" className="h-4 w-4" />}
              iconVisible
              iconColor={canPause && canHalt ? "#f59e0b" : undefined}
              size="icon"
            />
          </TooltipWrapper>

          {!hasActiveSubscription && canStart ? (
            <Popover>
              <PopoverTrigger asChild>
                <span className="inline-flex">
                  <Button
                    variant="outline-subtle"
                    disabled
                    aria-label={status === "RUNNING" ? t.restart : t.start}
                    icon={<PlayCircle weight="fill" className="h-4 w-4" />}
                    iconVisible
                    size="icon"
                  />
                </span>
              </PopoverTrigger>
              <PopoverContent side="bottom" className="w-72 space-y-3 p-4">
                <p className="text-sm font-semibold text-foreground">
                  Assinatura necessária
                </p>
                <p className="text-xs text-muted-foreground">
                  Sua área de trabalho não possui um plano ativo. Contrate um
                  plano para iniciar campanhas.
                </p>
                <Button
                  variant="primary"
                  title="Ver planos"
                  link={plansLink}
                  className="w-full"
                />
              </PopoverContent>
            </Popover>
          ) : (
            <TooltipWrapper
              content={t.noPermissionStart || "Sem permissão"}
              enabled={!hasPermissionStart}
            >
              <Button
                variant="outline-subtle"
                onClick={() => onLifecycle("start")}
                disabled={isPending || !canStart || !hasPermissionStart}
                aria-label={status === "RUNNING" ? t.restart : t.start}
                icon={<PlayCircle weight="fill" className="h-4 w-4" />}
                iconVisible
                iconColor={
                  canStart && hasPermissionStart
                    ? "hsl(var(--healthy))"
                    : undefined
                }
                size="icon"
              />
            </TooltipWrapper>
          )}
        </div>

        {/* More actions dropdown */}
        <ActionsDropdown
          extraActions={extraActions}
          isPending={isPending}
          canReset={canReset}
          hasPermissionUpdate={hasPermissionUpdate}
          editLink={editLink}
          onReset={onReset}
          onClearHistory={onClearHistory}
          translations={{
            edit: t.edit,
            reset: t.reset,
            clearHistory: t.clearHistory,
            actions: t.actions,
            dangerZone: t.dangerZone,
            noPermissionUpdate: t.noPermissionUpdate,
          }}
        />
      </div>
    </div>
  );
}
