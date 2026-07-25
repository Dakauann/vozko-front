"use client";

import type { Branch, BranchConnectionInfo, BranchRegistrationStatus, BranchSecretResult } from "@/lib/branches/types";
import { Browser, CircleNotch, DeviceMobileCamera, Headset, Key } from "@phosphor-icons/react";
import type { DialerRingChannel } from "@/app/actions/branches";
import {
  getBranchSipConfigAction,
  getMyRingChannelsAction,
  listMyBranchesAction,
  rotateMyBranchSecretAction,
  setMyRingChannelsAction,
} from "@/app/actions/branches";
import { useEffect, useState, useTransition } from "react";

import BranchSecretDialog from "./BranchSecretDialog";
import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const statusStyle: Record<BranchRegistrationStatus, { dot: string; text: string }> = {
  never_registered: { dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
  registered: { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
  expired: { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" },
  unreachable: { dot: "bg-red-500", text: "text-red-700 dark:text-red-300" },
};

/**
 * Member self-service: shows the signed-in user's own extension(s) with their
 * registration status and a "generate new password" action. Only rendered when
 * the member holds branches:use.
 */
export default function MyBranchCard({ bare = false }: { bare?: boolean }) {
  const t = useTranslations("branchesPage.mine");
  const tStatus = useTranslations("branchesPage.status");
  const tSecret = useTranslations("branchesPage.secret");
  const tToast = useTranslations("branchesPage.toast");
  const { toast } = useToast();
  const { can } = useWorkspace();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [sipConfig, setSipConfig] = useState<BranchConnectionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [secret, setSecret] = useState<BranchSecretResult | null>(null);
  const [channels, setChannels] = useState<DialerRingChannel[]>(["browser", "branch"]);
  const [, startBusy] = useTransition();
  const [, startSaving] = useTransition();

  useEffect(() => {
    let active = true;
    void (async () => {
      const [{ branches: rows }, { config }, { channels: ch }] = await Promise.all([
        listMyBranchesAction(),
        getBranchSipConfigAction(),
        getMyRingChannelsAction(),
      ]);
      if (!active) return;
      setBranches(rows);
      setSipConfig(config);
      if (ch.length > 0) setChannels(ch);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Optimistic toggle of a ring channel; reverts on failure. The member's live
  // endpoints are re-synced by the backend the moment the selection is saved.
  const toggleChannel = (channel: DialerRingChannel, on: boolean) => {
    const next = on
      ? Array.from(new Set([...channels, channel]))
      : channels.filter((c) => c !== channel);
    const prev = channels;
    setChannels(next);
    startSaving(async () => {
      const { error } = await setMyRingChannelsAction(next);
      if (error) {
        setChannels(prev);
        toast({ title: tToast("genericError"), description: error, variant: "destructive" });
      }
    });
  };

  const rotate = (b: Branch) =>
    startBusy(async () => {
      setBusyId(b.id);
      const { result, error } = await rotateMyBranchSecretAction(b.id);
      setBusyId(null);
      if (error || !result) {
        toast({ title: tToast("genericError"), description: error ?? "", variant: "destructive" });
      } else {
        setSecret(result);
        toast({ title: tToast("rotated") });
      }
    });

  if (!can("branches", "use")) return null;
  if (loading) return null;

  const inner = (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--primary-hover))] text-primary-foreground shadow-lg">
          <Headset weight="fill" className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      {branches.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {branches.map((b) => {
            const s = statusStyle[b.registrationStatus] ?? statusStyle.never_registered;
            const busy = busyId === b.id;
            return (
              <div key={b.id} className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-semibold text-foreground">{b.sipUser}</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                      <span className={cn("text-[10px] font-semibold uppercase", s.text)}>{tStatus(b.registrationStatus)}</span>
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tSecret("realm")}: <span className="font-mono text-foreground">{b.realm}</span>
                  </p>
                  {sipConfig?.configured ? (
                    <p className="text-xs text-muted-foreground">
                      {tSecret("server")}:{" "}
                      <span className="font-mono text-foreground">
                        {sipConfig.server}:{sipConfig.port}
                      </span>{" "}
                      · {sipConfig.transport}
                    </p>
                  ) : null}
                </div>
                <Button
                  variant="outline"
                  title={t("rotate")}
                  icon={busy ? <CircleNotch className="h-4 w-4 animate-spin" weight="bold" /> : <Key className="h-4 w-4" weight="bold" />}
                  iconVisible
                  iconSide="left"
                  onClick={() => rotate(b)}
                  disabled={busy}
                  className="text-[11px] font-semibold uppercase"
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t border-border/60 pt-4">
        <h4 className="text-sm font-semibold text-foreground">
          {t("ringDevices.title")}
        </h4>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("ringDevices.description")}
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {(
            [
              { key: "browser", icon: Browser, label: t("ringDevices.browser") },
              { key: "branch", icon: DeviceMobileCamera, label: t("ringDevices.branch") },
            ] as const
          ).map(({ key, icon: Icon, label }) => (
            <label
              key={key}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-card px-3.5 py-3 transition-colors hover:border-primary/40"
            >
              <span className="flex min-w-0 items-center gap-3">
                <Icon weight="fill" className="h-5 w-5 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm font-medium text-foreground">
                  {label}
                </span>
              </span>
              <ElevatedSwitch
                checked={channels.includes(key)}
                onCheckedChange={(v) => toggleChannel(key, v)}
              />
            </label>
          ))}
        </div>
      </div>

      <BranchSecretDialog result={secret} rotated onClose={() => setSecret(null)} />
    </>
  );

  if (bare) {
    return <div className="flex flex-col gap-4">{inner}</div>;
  }
  return (
    <ElevatedContainer className="flex flex-col gap-4 p-5">{inner}</ElevatedContainer>
  );
}
