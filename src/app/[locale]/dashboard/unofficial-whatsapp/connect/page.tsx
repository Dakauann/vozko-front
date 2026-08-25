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

/**
 * How often the screen asks the host whether the code has been scanned.
 *
 * Two seconds because the customer is standing there with a phone in their hand.
 * This is the one place in the product where a polling interval is a UX decision
 * rather than a load decision: the whole screen is a wait, and a slow tick makes
 * a successful scan feel like a failure.
 */
const POLL_MS = 2000;

type Step = "disclosure" | "linking" | "connected";

/**
 * The connect flow.
 *
 * The design problem here is not the QR code, it is the CONSENT. This is the
 * riskiest action in the product — an unofficial linked-device session that Meta
 * can disable, taking the customer's number with it — and every other connect
 * screen in this app is a token paste with no consequences. So the disclosure is
 * a step, not a footnote: the code does not exist until someone has read what
 * they are agreeing to, which is what PRODUCT.md principle 3 asks for and what
 * turns "I clicked connect" into "we decided to do this".
 *
 * After that the screen gets out of the way. One live code, one honest deadline,
 * and a state that changes by itself the moment the phone scans it.
 *
 * RECONNECTS reuse this same screen with `?instanceId=`: the uazapi contract
 * is that `/instance/init` (admin token) CREATES an instance while
 * `/instance/connect` (instance token) re-pairs the one it belongs to — so a
 * relink must seed the existing instance and never provision. Before this
 * carried the id, every "reconectar" click minted a brand-new instance.
 */
export default function ConnectUnofficialWhatsAppPage() {
  return (
    // useSearchParams demands a Suspense boundary during prerender.
    <Suspense fallback={null}>
      <ConnectFlow />
    </Suspense>
  );
}

function ConnectFlow() {
  const t = useTranslations("unofficialWhatsapp");
  const router = useRouter();
  // The instance being RE-linked. Present = skip provisioning entirely; the
  // slot, its transcript, and its conversations all stay attached to this row.
  const reconnectId = useSearchParams().get("instanceId");

  const [step, setStep] = useState<Step>("disclosure");
  const [mode, setMode] = useState<ConnectMode>("qr");
  const [phone, setPhone] = useState("");
  /**
   * The operator's own name for the number being connected.
   *
   * Asked for HERE rather than only after linking, because this is the moment
   * they know what the number is for — "Comercial SP", "Cobrança" — and a
   * workspace connecting its third number has no way to tell them apart in the
   * list until one is set. Optional: left empty, the provider's generated name
   * stands in until the WhatsApp profile name arrives.
   *
   * Local to the CRM. It is never sent to WhatsApp and cannot affect the
   * connected account or what a customer sees.
   */
  const [displayName, setDisplayName] = useState("");
  const [challenge, setChallenge] = useState<LinkChallenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Held in a ref rather than state: the poller reads it every two seconds and
  // must not be a dependency that restarts the interval on every tick.
  const instanceIdRef = useRef<string | null>(null);

  /**
   * The instance a reconnect targets, loaded up front so the screen can name
   * the number being re-paired and so an already-live session short-circuits
   * to "connected" instead of offering a pointless QR.
   */
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

  /**
   * The workspace's number allowance, read before anything is offered.
   *
   * The server refuses an over-limit provision either way — that is the
   * authority — but finding out AFTER reading a disclosure and pressing a button
   * is a worse experience than being told up front. This screen is reachable by
   * URL, so it cannot rely on the list page having disabled its link.
   */
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

  // A reconnect re-pairs a slot the workspace already pays for, so the
  // new-number capacity gate does not apply to it.
  const block = reconnectId ? null : allowanceBlock(allowance);

  /** Provisions a slot, then asks for a code. Two calls, one operator action. */
  const beginLinking = useCallback(async () => {
    setBusy(true);
    setError(null);

    let instanceId = instanceIdRef.current;
    if (!instanceId) {
      const provisioned = await provisionInstanceAction({
        displayName: displayName.trim() || undefined,
      });
      if (provisioned.error || !provisioned.instance) {
        // Capacity is the failure the operator is most likely to hit, and it is
        // not their fault — the message says so rather than reading as a bug.
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

  /**
   * Polls until the phone scans, then stops.
   *
   * Stopping matters: without the guard this keeps hitting the host forever on a
   * screen an operator walked away from, and every one of those calls is a
   * request against the customer's own session.
   */
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

  /**
   * The countdown.
   *
   * The provider's deadline is real — two minutes for a QR, five for a pairing
   * code — and a screen that stalls past it with no explanation is
   * indistinguishable from a broken one. Showing the number turns "nothing is
   * happening" into "this expires, and here is the button".
   */
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
        {/* Capacity first, ahead of the control it governs — the same rail the
            official channel's connect page uses, so an operator who has learnt
            to read one meter has learnt to read both. When it is full this card
            IS the gate, and its call to action routes to the add-ons. A
            reconnect re-pairs an existing slot, so the meter stays out of its
            way. */}
        {step === "disclosure" && !reconnectId && (
          <UnofficialWhatsAppCapacityCard allowance={allowance} />
        )}

        {/* No allowance, no flow: walking someone through a ban-risk warning for
            a number they cannot connect wastes their time and buries the
            blocker the card above already explains. */}
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

/**
 * Step one: what you are agreeing to.
 *
 * The mode choice sits here rather than on the code screen because it changes
 * what the customer will be asked to do with their phone, and that is part of
 * the decision, not a setting to discover afterwards.
 */
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
  /** Non-null when re-pairing an existing instance; "" while it loads. */
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
          // Re-pairing an existing slot: the name is settled, the transcript
          // stays, and the screen says WHICH number this QR belongs to.
          <p className="rounded-[--radius] bg-muted px-3 py-2 text-sm text-foreground">
            {t("connect.reconnecting", { name: reconnectName || "…" })}
          </p>
        ) : (
          /* Optional, and said so: an operator who does not care should not be
             stopped by a field, and one who does should not have to find the
             number again afterwards to name it. */
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

/**
 * A method choice.
 *
 * Selection is a tinted ground, a weighted label and the lamp bar — never colour
 * alone, per the state language in DESIGN.md §5.
 */
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
          ? "border-border-strong bg-muted"
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

/**
 * Step two: the live code.
 *
 * Everything on this screen except the code itself is deliberately quiet. The
 * customer is looking at their phone, and the operator is looking at the code —
 * so the code gets the sheet, the light and the whole centre, and the
 * instructions sit beside it rather than above it where they would push it below
 * the fold on a 1366×768 laptop.
 */
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
              // An expired code is dimmed rather than removed: the operator's
              // eye is already there, and an empty box reads as a crash.
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

/**
 * Step three: done.
 *
 * Short on purpose. The work is finished and the operator has somewhere to be —
 * the screen names the number so they know the right one connected, and offers
 * the two places they would go next.
 */
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
