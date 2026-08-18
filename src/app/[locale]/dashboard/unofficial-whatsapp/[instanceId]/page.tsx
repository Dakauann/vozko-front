"use client";

import { ArrowClockwise, Key, Plugs, Power } from "@/components/icons";
import {
  RestrictionNotice,
  SessionState,
  UnofficialNotice,
} from "@/components/unofficial-whatsapp/session-state";
import { useCallback, useEffect, useState } from "react";
import {
  disconnectInstanceAction,
  getInstanceAction,
  resetInstanceAction,
  rotateWebhookTokenAction,
  updateInstanceAction,
} from "@/app/actions/unofficial-whatsapp";
import {
  canRelink,
  type UnofficialWhatsAppInstance,
  type UpdateInstancePayload,
} from "@/lib/unofficial-whatsapp/types";
import { useParams, useRouter } from "next/navigation";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DepartmentAssignmentCard } from "@/components/dashboard/DepartmentAssignmentCard";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { Switch } from "@/components/ui/switch";
import { UnofficialWhatsAppAutomationPanel } from "@/components/unofficial-whatsapp/automation-panel";
import { WhatsAppLogoColor } from "@/components/icons/channel-logos";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

/**
 * One connected number.
 *
 * The page is ordered by what an operator opens it to find out, which is almost
 * never the settings: first "is this number healthy", then "is WhatsApp angry at
 * it", then the automation switches, and only then the pacing controls that
 * exist to keep it alive. Settings-first would put the least urgent thing at the
 * top of a page people open when something is wrong.
 */
export default function UnofficialWhatsAppInstancePage() {
  const t = useTranslations("unofficialWhatsapp");
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { can } = useWorkspace();

  const instanceId = String(params?.instanceId ?? "");
  const canUpdate = can("unofficial_whatsapp_instances", "update");

  const [instance, setInstance] = useState<UnofficialWhatsAppInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await getInstanceAction(instanceId);
    if (result.error || !result.instance) {
      setError(result.error ?? t("detail.notFound"));
    } else {
      setError(null);
      setInstance(result.instance);
    }
    setLoading(false);
  }, [instanceId, t]);

  useEffect(() => {
    if (instanceId) void load();
  }, [instanceId, load]);

  /**
   * The operator's own label for this number, held as a draft while they type.
   *
   * Separate from the WhatsApp profile name on purpose: the push name is set on
   * the customer's phone and can be anything, while this is how the CRM should
   * refer to the number — "Comercial SP", "Cobrança". It is OURS: nothing here
   * touches the WhatsApp account, and clearing it falls back to the profile
   * name and then the number.
   *
   * A draft rather than a live patch because these toggles are optimistic and a
   * text field is not: firing a request per keystroke would be a write per
   * character and a race on the last one.
   */
  const [nameDraft, setNameDraft] = useState<string | null>(null);

  const patch = useCallback(
    async (payload: UpdateInstancePayload) => {
      if (!instance) return;
      // Optimistic, because these are toggles: waiting a round-trip before the
      // switch moves makes every one of them feel broken.
      setInstance({ ...instance, ...(payload as Partial<UnofficialWhatsAppInstance>) });
      const result = await updateInstanceAction(instance.id, payload);
      if (result.error) {
        toast({ title: t("detail.saveFailed"), description: result.error, variant: "destructive" });
        void load();
        return;
      }
      if (result.instance) setInstance(result.instance);
    },
    [instance, toast, t, load],
  );

  const runAction = useCallback(
    async (action: () => Promise<{ error?: string }>, label: string, success: string) => {
      setBusy(true);
      const result = await action();
      setBusy(false);
      toast({
        title: label,
        description: result.error ?? success,
        variant: result.error ? "destructive" : undefined,
      });
      void load();
    },
    [toast, load],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-14 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!instance) {
    return (
      <ElevatedContainer className="text-center">
        <p className="text-sm text-destructive-ink">{error ?? t("detail.notFound")}</p>
      </ElevatedContainer>
    );
  }

  // The operator's own label wins the title when they set one; otherwise the
  // number, which is what they had before and what they recognise.
  const number = instance.phoneNumber ? `+${instance.phoneNumber}` : "";
  const label = instance.displayName || number || t("detail.unnamed");
  const subtitle =
    [instance.displayName ? number : "", instance.profileName]
      .filter(Boolean)
      .join(" · ") || t("detail.unnamed");

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        icon={<WhatsAppLogoColor className="h-5 w-5" />}
        badge={t("page.badge")}
        title={label}
        description={subtitle}
        back={{
          onClick: () => router.push("/dashboard/unofficial-whatsapp"),
          label: t("connect.back"),
        }}
        actions={
          canUpdate ? (
            <div className="flex items-center gap-2">
              {instance.sessionLive && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      () => resetInstanceAction(instance.id),
                      t("actions.reset"),
                      t("notice.resetStarted"),
                    )
                  }
                  title={t("actions.reset")}
                  icon={<ArrowClockwise className="h-4 w-4" />}
                  iconVisible
                />
              )}
              {instance.sessionLive ? (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      () => disconnectInstanceAction(instance.id),
                      t("actions.disconnect"),
                      t("notice.disconnected", { name: label }),
                    )
                  }
                  title={t("actions.disconnect")}
                  icon={<Power className="h-4 w-4" />}
                  iconVisible
                />
              ) : (
                canRelink(instance) && (
                  <Button
                    variant="primary"
                    // The id is the whole fix: without it the connect screen
                    // provisions a NEW instance instead of re-pairing this one.
                    onClick={() =>
                      router.push(
                        `/dashboard/unofficial-whatsapp/connect?instanceId=${instance.id}`,
                      )
                    }
                    title={t("actions.relink")}
                    icon={<Plugs className="h-4 w-4" />}
                    iconVisible
                  />
                )
              )}
            </div>
          ) : undefined
        }
      />

      {/* Health first: this page is opened when something is wrong. */}
      <SessionPanel instance={instance} />
      <RestrictionNotice instance={instance} />

      {/* A banned number cannot be recovered by anything on this page, so it
          says so instead of leaving an operator trying buttons. */}
      {instance.status === "BANNED" && (
        <div className="rounded-lg border border-border bg-muted p-4">
          <p className="text-sm font-semibold text-destructive-ink">{t("detail.bannedTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("detail.bannedBody")}</p>
        </div>
      )}

      {/* Attendance first and full width: it is the decision that makes the
          number do anything, and it owns its own save state. The two panels
          below configure what happens around it. */}
      {/* The operator's own name for this number.
          Local to the CRM: it never reaches WhatsApp, so renaming here cannot
          affect the connected account or what a customer sees. */}
      <ElevatedContainer className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {t("detail.displayName.title")}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("detail.displayName.description")}
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="w-full max-w-sm">
            <ElevatedInput
              label={t("detail.displayName.label")}
              placeholder={instance.profileName || number}
              maxLength={120}
              value={nameDraft ?? instance.displayName ?? ""}
              onChange={(e) => setNameDraft(e.target.value)}
              disabled={!canUpdate}
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            title={t("detail.displayName.save")}
            disabled={
              !canUpdate ||
              nameDraft === null ||
              nameDraft.trim() === (instance.displayName ?? "")
            }
            onClick={() => {
              if (nameDraft === null) return;
              // Trimmed, and an empty string is a real value: it CLEARS the
              // label so the number falls back to its profile name.
              void patch({ displayName: nameDraft.trim() });
              setNameDraft(null);
            }}
          />
        </div>
      </ElevatedContainer>

      {/* The department that owns this number.
          Assigning one narrows the number to that team everywhere at once: its
          conversations only appear in their inbox, only its members enter the
          round-robin for inbound messages, and only they can open the number or
          send from it. Nothing here is channel-specific — the same card assigns
          departments elsewhere in the product. */}
      {canUpdate && (
        <DepartmentAssignmentCard
          departmentId={instance.departmentId}
          onAssign={(departmentId) =>
            updateInstanceAction(instance.id, { departmentId }).then((result) => ({
              item: result.instance ?? null,
              error: result.error,
            }))
          }
          onAssigned={() => {
            // Re-read rather than patch in place: assigning a department can
            // take the number out of THIS operator's own scope, and the reload
            // is what turns that into an honest "not found" instead of a page
            // showing a number they no longer have.
            void load();
          }}
        />
      )}

      <UnofficialWhatsAppAutomationPanel instance={instance} onUpdated={setInstance} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ConversationHandlingPanel instance={instance} canUpdate={canUpdate} onChange={patch} />
        <SafetyPanel instance={instance} canUpdate={canUpdate} onChange={patch} />
      </div>

      <UnofficialNotice />

      {canUpdate && (
        <ElevatedContainer className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{t("detail.webhookTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("detail.webhookBody")}</p>
          </div>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void runAction(
                () => rotateWebhookTokenAction(instance.id),
                t("detail.rotate"),
                t("notice.rotated"),
              )
            }
            title={t("detail.rotate")}
            icon={<Key className="h-4 w-4" />}
            iconVisible
          />
        </ElevatedContainer>
      )}
    </div>
  );
}

/** The health strip: state, and the two timestamps that explain it. */
function SessionPanel({ instance }: { instance: UnofficialWhatsAppInstance }) {
  const t = useTranslations("unofficialWhatsapp");

  const facts: Array<{ label: string; value: string }> = [
    {
      label: t("detail.connectedAt"),
      value: instance.connectedAt ? new Date(instance.connectedAt).toLocaleString() : "—",
    },
    {
      label: t("detail.lastChecked"),
      value: instance.lastPolledAt ? new Date(instance.lastPolledAt).toLocaleString() : "—",
    },
    {
      label: t("detail.platform"),
      value: instance.platform || "—",
    },
  ];

  return (
    <ElevatedContainer>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <SessionState instance={instance} />
          {instance.statusReason && (
            <p className="max-w-md text-sm text-muted-foreground">{instance.statusReason}</p>
          )}
          {!instance.sessionLive && instance.lastDisconnectReason && (
            <p className="max-w-md text-sm text-muted-foreground">
              {instance.lastDisconnectReason}
            </p>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt className="legend">{fact.label}</dt>
              <dd className="readout mt-0.5 text-sm text-foreground">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </ElevatedContainer>
  );
}

/**
 * What happens to a conversation ONCE it is attended.
 *
 * Deliberately separate from the attendance panel above. Those three settings
 * are not "who answers" — analysis and auto-staging run whether or not an agent
 * replies, and group handling decides what even reaches the inbox. Mixing them
 * into the same list is what made the old panel read as five equal switches and
 * hid the fact that two of them did nothing without a selection.
 */
function ConversationHandlingPanel({
  instance,
  canUpdate,
  onChange,
}: {
  instance: UnofficialWhatsAppInstance;
  canUpdate: boolean;
  onChange: (payload: UpdateInstancePayload) => void;
}) {
  const t = useTranslations("unofficialWhatsapp");

  const toggles: Array<{ key: keyof UpdateInstancePayload; on: boolean; hint: string }> = [
    {
      key: "enableAnalysis",
      on: instance.enableAnalysis,
      hint: t("handling.analysisHint"),
    },
    {
      key: "enableAutoStaging",
      on: instance.enableAutoStaging,
      hint: t("handling.autoStagingHint"),
    },
    {
      key: "enableAutoMemory",
      on: instance.enableAutoMemory,
      hint: t("handling.autoMemoryHint"),
    },
    { key: "handleGroups", on: instance.handleGroups, hint: t("automation.groupsHint") },
  ];

  return (
    <ElevatedContainer className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">{t("handling.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("handling.description")}</p>
      </div>

      <div className="divide-y divide-border">
        {toggles.map((toggle) => (
          <label
            key={toggle.key}
            className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
          >
            <span className="min-w-0">
              <span className="block text-sm text-foreground">{t(`automation.${toggle.key}`)}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {toggle.hint}
              </span>
            </span>
            <Switch
              checked={toggle.on}
              disabled={!canUpdate}
              onCheckedChange={(next) => onChange({ [toggle.key]: next })}
            />
          </label>
        ))}
      </div>
    </ElevatedContainer>
  );
}

/**
 * The controls that keep the number alive.
 *
 * Grouped and named as protection rather than as "advanced settings", because
 * that is what they are: pacing and a daily cap are the difference between a
 * working number and a banned one, and an operator who reads them as throughput
 * knobs will turn them the wrong way.
 */
function SafetyPanel({
  instance,
  canUpdate,
  onChange,
}: {
  instance: UnofficialWhatsAppInstance;
  canUpdate: boolean;
  onChange: (payload: UpdateInstancePayload) => void;
}) {
  const t = useTranslations("unofficialWhatsapp");

  const [minMs, setMinMs] = useState(String(instance.sendDelayMinMs));
  const [maxMs, setMaxMs] = useState(String(instance.sendDelayMaxMs));
  const [cap, setCap] = useState(String(instance.dailySendCap));

  const commit = () => {
    onChange({
      sendDelayMinMs: Number(minMs) || instance.sendDelayMinMs,
      sendDelayMaxMs: Number(maxMs) || instance.sendDelayMaxMs,
      dailySendCap: Number(cap) || 0,
    });
  };

  return (
    <ElevatedContainer className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">{t("safety.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("safety.description")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="uw-delay-min"
          label={t("safety.delayMin")}
          value={minMs}
          disabled={!canUpdate}
          onChange={setMinMs}
          onBlur={commit}
        />
        <Field
          id="uw-delay-max"
          label={t("safety.delayMax")}
          value={maxMs}
          disabled={!canUpdate}
          onChange={setMaxMs}
          onBlur={commit}
        />
      </div>

      <Field
        id="uw-daily-cap"
        label={t("safety.dailyCap")}
        hint={t("safety.dailyCapHint")}
        value={cap}
        disabled={!canUpdate}
        onChange={setCap}
        onBlur={commit}
      />

      <label className="flex items-start justify-between gap-4 border-t border-border pt-3">
        <span className="min-w-0">
          <span className="block text-sm text-foreground">{t("safety.autoRejectCalls")}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            {t("safety.autoRejectCallsHint")}
          </span>
        </span>
        <Switch
          checked={instance.autoRejectCalls}
          disabled={!canUpdate}
          onCheckedChange={(next) => onChange({ autoRejectCalls: next })}
        />
      </label>
    </ElevatedContainer>
  );
}

function Field({
  id,
  label,
  hint,
  value,
  disabled,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  return (
    <div className={cn("space-y-1.5", hint && "sm:col-span-2")}>
      <label htmlFor={id} className="legend">
        {label}
      </label>
      <ElevatedInput
        id={id}
        value={value}
        inputMode="numeric"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
