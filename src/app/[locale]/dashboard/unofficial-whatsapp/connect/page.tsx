"use client";

import { ArrowClockwise, CheckCircle, DeviceMobile } from "@/components/icons";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  connectInstanceAction,
  getInstanceAction,
  linkStatusAction,
  getInstanceAllowanceAction,
  provisionInstanceAction,
} from "@/app/actions/unofficial-whatsapp";
import {
  allowanceBlock,
  type ConnectMode,
  type LinkChallenge,
  type UnofficialWhatsAppAllowance,
  type UnofficialWhatsAppInstance,
} from "@/lib/unofficial-whatsapp/types";
import { useRouter, useSearchParams } from "next/navigation";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import UnofficialWhatsAppCapacityCard from "@/components/dashboard/addons/UnofficialWhatsAppCapacityCard";
import { UnofficialNotice } from "@/components/unofficial-whatsapp/session-state";
import { WhatsAppLogoColor } from "@/components/icons/channel-logos";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const POLL_MS = 2000;

type Step = "disclosure" | "linking" | "connected";

export default function ConnectUnofficialWhatsAppPage() {
  return (
    <Suspense fallback={null}>
      <ConnectFlow />
    </Suspense>
  );
}

function ConnectFlow() {
  const t = useTranslations("unofficialWhatsapp");
  const router = useRouter();
  const reconnectId = useSearchParams().get("instanceId");

  const [step, setStep] = useState<Step>("disclosure");
  const [mode, setMode] = useState<ConnectMode>("qr");
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [challenge, setChallenge] = useState<LinkChallenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const instanceIdRef = useRef<string | null>(null);

  const [reconnectTarget, setReconnectTarget] = useState<UnofficialWhatsAppInstance | null>(null);
  useEffect(() => {
    if (!reconnectId) return;
    instanceIdRef.current = reconnectId;
    let cancelled = false;
    void (async () => {
      const result = await getInstanceAction(reconnectId);
      if (cancelled) return;
      if (result.error || !result.instance) {
        setError(result.error ?? t("connect.codeFailed"));
        return;
      }
      setReconnectTarget(result.instance);
      if (result.instance.sessionLive) {
        setChallenge({ instance: result.instance });
        setStep("connected");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reconnectId, t]);

  const [allowance, setAllowance] = useState<UnofficialWhatsAppAllowance | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await getInstanceAllowanceAction();
      if (!cancelled && !result.error && result.allowance) setAllowance(result.allowance);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const block = reconnectId ? null : allowanceBlock(allowance);

  const beginLinking = useCallback(async () => {
    setBusy(true);
    setError(null);

    let instanceId = instanceIdRef.current;
    if (!instanceId) {
      const provisioned = await provisionInstanceAction({
        displayName: displayName.trim() || undefined,
      });
      if (provisioned.error || !provisioned.instance) {
        setError(provisioned.error ?? t("connect.provisionFailed"));
        setBusy(false);
        return;
      }
      instanceId = provisioned.instance.id;
      instanceIdRef.current = instanceId;
    }

    const result = await connectInstanceAction(instanceId, {
      mode,
      phone: mode === "pairing" ? phone : undefined,
    });
    setBusy(false);

    if (result.error || !result.challenge) {
      setError(result.error ?? t("connect.codeFailed"));
      return;
    }
    setChallenge(result.challenge);
    setStep("linking");
  }, [mode, phone, displayName, t]);

  useEffect(() => {
    if (step !== "linking") return;

    const timer = setInterval(async () => {
      const instanceId = instanceIdRef.current;
      if (!instanceId) return;

      const result = await linkStatusAction(instanceId);
      if (result.error || !result.challenge) return;

      setChallenge(result.challenge);
      if (result.challenge.instance.sessionLive) {
        setStep("connected");
      }
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [step]);

  useEffect(() => {
    if (step !== "linking" || !challenge?.expiresAt) {
      setSecondsLeft(null);
      return;
    }
    const expiry = new Date(challenge.expiresAt).getTime();

    const tick = () => {
      setSecondsLeft(Math.max(0, Math.round((expiry - Date.now()) / 1000)));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [step, challenge?.expiresAt]);

  const expired = secondsLeft !== null && secondsLeft <= 0;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        icon={<WhatsAppLogoColor className="h-5 w-5" />}
        badge={t("connect.badge")}
        title={reconnectId ? t("connect.reconnectTitle") : t("connect.title")}
        description={t("connect.description")}
        back={{ onClick: () => router.push("/dashboard/unofficial-whatsapp"), label: t("connect.back") }}
      />

      <div className="mx-auto w-full max-w-3xl space-y-6">
        {
}
        {step === "disclosure" && !reconnectId && (
          <UnofficialWhatsAppCapacityCard allowance={allowance} />
        )}

        {
}
        {step === "disclosure" && !block && (
          <DisclosureStep
            mode={mode}
            phone={phone}
            displayName={displayName}
            reconnectName={
              reconnectTarget
                ? reconnectTarget.phoneNumber
                  ? `+${reconnectTarget.phoneNumber}`
                  : reconnectTarget.displayName
                : reconnectId
                  ? ""
                  : null
            }
            busy={busy}
            error={error}
            onModeChange={setMode}
            onPhoneChange={setPhone}
            onDisplayNameChange={setDisplayName}
            onContinue={() => void beginLinking()}
          />
        )}

        {step === "linking" && challenge && (
          <LinkingStep
            challenge={challenge}
            mode={mode}
            secondsLeft={secondsLeft}
            expired={expired}
            busy={busy}
            onRefresh={() => void beginLinking()}
          />
        )}

        {step === "connected" && challenge && (
          <ConnectedStep
            label={
              challenge.instance.phoneNumber
                ? `+${challenge.instance.phoneNumber}`
                : challenge.instance.displayName
            }
            onOpen={() =>
              router.push(`/dashboard/unofficial-whatsapp/${challenge.instance.id}`)
            }
            onDone={() => router.push("/dashboard/unofficial-whatsapp")}
          />
        )}
      </div>
    </div>
  );
}

function DisclosureStep({
  mode,
  phone,
  displayName,
  reconnectName,
  busy,
  error,
  onModeChange,
  onPhoneChange,
  onDisplayNameChange,
  onContinue,
}: {
  mode: ConnectMode;
  phone: string;
  displayName: string;
  reconnectName: string | null;
  busy: boolean;
  error: string | null;
  onModeChange: (mode: ConnectMode) => void;
  onPhoneChange: (phone: string) => void;
  onDisplayNameChange: (name: string) => void;
  onContinue: () => void;
}) {
  const t = useTranslations("unofficialWhatsapp");
  const phoneRequired = mode === "pairing" && phone.trim().length < 10;
  const isReconnect = reconnectName !== null;

  return (
    <div className="space-y-6">
      <UnofficialNotice />

      <ElevatedContainer className="space-y-5">
        {isReconnect ? (
          <p className="rounded-[--radius] bg-muted px-3 py-2 text-sm text-foreground">
            {t("connect.reconnecting", { name: reconnectName || "…" })}
          </p>
        ) : (
          <div className="space-y-1.5">
            <label htmlFor="uw-display-name" className="legend">
              {t("connect.displayNameLabel")}
            </label>
            <ElevatedInput
              id="uw-display-name"
              value={displayName}
              onChange={(event) => onDisplayNameChange(event.target.value)}
              placeholder={t("connect.displayNamePlaceholder")}
              maxLength={120}
            />
            <p className="text-xs text-muted-foreground">{t("connect.displayNameHint")}</p>
          </div>
        )}

        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">{t("connect.methodTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("connect.methodHint")}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <MethodCard
            selected={mode === "qr"}
            title={t("connect.qrTitle")}
            hint={t("connect.qrHint")}
            onSelect={() => onModeChange("qr")}
          />
          <MethodCard
            selected={mode === "pairing"}
            title={t("connect.pairingTitle")}
            hint={t("connect.pairingHint")}
            onSelect={() => onModeChange("pairing")}
          />
        </div>

        {mode === "pairing" && (
          <div className="space-y-1.5">
            <label htmlFor="uw-phone" className="legend">
              {t("connect.phoneLabel")}
            </label>
            <ElevatedInput
              id="uw-phone"
              value={phone}
              onChange={(event) => onPhoneChange(event.target.value)}
              placeholder="5511999999999"
              inputMode="numeric"
            />
            <p className="text-xs text-muted-foreground">{t("connect.phoneHint")}</p>
          </div>
        )}

        {error && (
          <p className="rounded-[--radius] bg-muted px-3 py-2 text-sm text-destructive-ink">
            {error}
          </p>
        )}

        <div className="flex justify-end pt-1">
          <Button
            variant="primary"
            onClick={onContinue}
            disabled={busy || phoneRequired}
            title={busy ? t("connect.preparing") : t("connect.continue")}
          />
        </div>
      </ElevatedContainer>
    </div>
  );
}

function MethodCard({
  selected,
  title,
  hint,
  onSelect,
}: {
  selected: boolean;
  title: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "relative overflow-hidden rounded-lg border p-4 text-left transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-control-edge bg-muted"
          : "border-border bg-card hover:bg-muted",
      )}
    >
      {selected && (
        <span
          aria-hidden
          className="absolute inset-y-3 left-0 w-[3px] rounded-full bg-primary"
        />
      )}
      <p
        className={cn(
          "text-sm",
          selected ? "font-semibold text-primary-ink" : "font-medium text-foreground",
        )}
      >
        {title}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>
    </button>
  );
}

function LinkingStep({
  challenge,
  mode,
  secondsLeft,
  expired,
  busy,
  onRefresh,
}: {
  challenge: LinkChallenge;
  mode: ConnectMode;
  secondsLeft: number | null;
  expired: boolean;
  busy: boolean;
  onRefresh: () => void;
}) {
  const t = useTranslations("unofficialWhatsapp");

  return (
    <ElevatedContainer>
      <div className="grid gap-8 md:grid-cols-[minmax(0,260px)_1fr] md:items-start">
        <div className="space-y-3">
          <div
            className={cn(
              "relative flex aspect-square items-center justify-center rounded-xl border border-border bg-card p-3",
              expired && "opacity-40",
            )}
          >
            {challenge.qrCode ? (
              /* eslint-disable-next-line @next/next/no-img-element -- provider-issued data URI, no remote host to optimise */
              <img
                src={challenge.qrCode}
                alt={t("connect.qrAlt")}
                className="h-full w-full object-contain"
              />
            ) : challenge.pairCode ? (
              <span className="readout font-display text-3xl font-semibold tracking-[0.2em] text-foreground">
                {challenge.pairCode}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">{t("connect.waitingCode")}</span>
            )}
          </div>

          {secondsLeft !== null && (
            <p
              className={cn(
                "text-center text-xs",
                expired ? "text-destructive-ink" : "text-muted-foreground",
              )}
              aria-live="polite"
            >
              {expired
                ? t("connect.expired")
                : t("connect.expiresIn", {
                    time: `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`,
                  })}
            </p>
          )}

          {expired && (
            <Button
              variant="secondary"
              className="w-full"
              disabled={busy}
              onClick={onRefresh}
              title={t("connect.newCode")}
              icon={<ArrowClockwise className="h-4 w-4" />}
              iconVisible
            />
          )}
        </div>

        <div className="space-y-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
            </span>
            <span aria-live="polite">{t("connect.waitingScan")}</span>
          </div>

          <ol className="space-y-4">
            {(mode === "pairing"
              ? ["pairStep1", "pairStep2", "pairStep3"]
              : ["qrStep1", "qrStep2", "qrStep3"]
            ).map((key, index) => (
              <li key={key} className="flex gap-3">
                <span className="readout mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold text-muted-foreground">
                  {index + 1}
                </span>
                <p className="text-sm leading-relaxed text-foreground">{t(`connect.${key}`)}</p>
              </li>
            ))}
          </ol>

          <p className="rounded-[--radius] bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {t("connect.historyNote")}
          </p>
        </div>
      </div>
    </ElevatedContainer>
  );
}

function ConnectedStep({
  label,
  onOpen,
  onDone,
}: {
  label: string;
  onOpen: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("unofficialWhatsapp");

  return (
    <ElevatedContainer className="space-y-5 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
        <CheckCircle className="h-6 w-6 text-healthy-ink" aria-hidden />
      </span>
      <div className="space-y-1">
        <h2 className="font-display text-base font-semibold tracking-[0.01em] text-foreground">{t("connect.successTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("connect.successBody", { name: label })}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        <Button
          variant="primary"
          onClick={onOpen}
          title={t("connect.openNumber")}
          icon={<DeviceMobile className="h-4 w-4" />}
          iconVisible
        />
        <Button variant="secondary" onClick={onDone} title={t("connect.backToList")} />
      </div>
    </ElevatedContainer>
  );
}
