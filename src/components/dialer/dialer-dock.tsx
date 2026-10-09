"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

import { DockBounds } from "@/components/docks/dock-bounds";
import { EdgeTab } from "@/components/docks/edge-tab";
import { DialerMark } from "@/components/dialer/dialer-mark";
import {
  DOCK_HEADER_ICON_BUTTON,
  PANEL_EASE,
} from "@/components/docks/dock-chrome";
import { useDraggableDock } from "@/components/docks/use-draggable-dock";
import ElevatedSelect, {
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { InCallPanel } from "@/components/calls/in-call-panel";
import {
  Backspace,
  Minus,
  Phone,
} from "@/components/icons";
import { useCallSession } from "@/contexts/call-session-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { useMayPlaceCalls } from "@/hooks/use-call-readiness";
import { useDialTargets } from "@/hooks/use-dial-targets";
import {
  formatCallDuration,
  useCallElapsedSeconds,
} from "@/hooks/use-call-clock";
import { Link } from "@/i18n/routing";
import {
  requestCall,
  subscribeDialPreset,
  useCallSurfaceClaim,
  useCallSurfaceOwner,
} from "@/lib/call-session/call-session-control";
import {
  EMPTY_DIAL_DRAFT,
  draftFromPreset,
  withDialNumber,
  type DialDraft,
} from "@/lib/dialer/dial-draft";
import {
  DIAL_KEYS,
  appendDialKey,
  dialerErrorCode,
  isDialable,
} from "@/lib/dialer/dial-string";
import { numberRefusal } from "@/lib/dialer/dial-targets";
import { dialerTabState } from "@/lib/dialer/tab-state";
import { soundPlayer } from "@/lib/sounds/sound-player";
import { cn } from "@/lib/utils";

const TRUNK_REFRESH_MS = 10_000;
const KEY_LETTERS: Partial<Record<(typeof DIAL_KEYS)[number], string>> = {
  "2": "ABC",
  "3": "DEF",
  "4": "GHI",
  "5": "JKL",
  "6": "MNO",
  "7": "PQRS",
  "8": "TUV",
  "9": "WXYZ",
};

export function DialerDock() {
  const permitted = useMayPlaceCalls();
  if (!permitted) return null;
  return <Dialer />;
}

function Dialer() {
  const t = useTranslations("calling.dialer");
  const tc = useTranslations("calling");
  const tt = useTranslations("calling.transfer");
  const tReasons = useTranslations("calling.dialTargets.reasons");
  const { can } = useWorkspace();
  const {
    callState,
    lastErrorCode,
    lastError,
    clearError,
    transfer,
    incomingCall,
  } = useCallSession();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DialDraft>(EMPTY_DIAL_DRAFT);
  const number = draft.number;
  const {
    online,
    live,
    blocker: linesBlocker,
    numberBlocker,
    status: linesStatus,
    targets,
    trunks: dialable,
    selectedTrunk,
    chooseTrunk,
    presetTrunk,
  } = useDialTargets({
    leadId: draft.leadId ?? null,
    enabled: open,
    refreshMs: TRUNK_REFRESH_MS,
    direct: true,
    revision: draft.leadRevision,
  });
  const blocker = draft.leadId ? numberBlocker(number) : linesBlocker;
  const loadingTrunks = linesStatus === "loading" || linesStatus === "idle";
  const leadNumberRefusal =
    draft.leadId && targets ? numberRefusal(targets, number) : null;
  const tabRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const elapsed = useCallElapsedSeconds(callState);
  const { x, y, boundsRef, startDrag, reset, dragProps } =
    useDraggableDock("dialer");

  const editNumber = useCallback((edit: (current: string) => string) => {
    setDraft((current) => withDialNumber(current, edit(current.number)));
  }, []);

  const openPanel = useCallback(() => setOpen(true), []);

  const minimize = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => tabRef.current?.focus());
  }, []);

  useCallSurfaceClaim("dialer", open);
  const surfaceOwner = useCallSurfaceOwner();

  useEffect(
    () =>
      subscribeDialPreset((preset) => {
        setDraft(draftFromPreset(preset));
        if (preset.trunkId) presetTrunk(preset.trunkId);
        clearError();
        openPanel();
      }),
    [openPanel, clearError, presetTrunk],
  );

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") minimize();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, minimize]);

  const inCall = callState !== null;
  const callHeldBy = surfaceOwner !== null && surfaceOwner !== "dialer" ? surfaceOwner : null;
  const canPlace =
    blocker === null &&
    !inCall &&
    selectedTrunk !== null &&
    isDialable(number);
  const noLine = blocker === null || blocker === "no_dialable_trunk";
  const tabState = dialerTabState({
    callStatus: callState?.status ?? null,
    hasIncomingCall: incomingCall !== null,
    transferRinging: transfer?.status === "ringing",
  });
  const tabText = {
    idle: t("tabLabel"),
    incoming: t("tabIncoming"),
    holding: tt("holding"),
    ringing: t("tabRinging"),
    timer: formatCallDuration(elapsed),
  }[tabState.label];
  const errorCode = dialerErrorCode(lastErrorCode);

  const placeCall = () => {
    if (!canPlace || !selectedTrunk) return;
    clearError();
    requestCall({
      phoneNumber: number.trim(),
      trunkId: selectedTrunk.id,
      label: selectedTrunk.name,
      ...(draft.leadId ? { leadId: draft.leadId } : {}),
    });
  };

  const press = (key: (typeof DIAL_KEYS)[number]) => {
    soundPlayer.keyTone(key);
    editNumber((current) => appendDialKey(current, key));
    inputRef.current?.focus();
  };

  return (
    <>
      {!open ? (
        <EdgeTab
          ref={tabRef}
          slot="lower"
          label={tabState.status === "idle" ? t("open") : `${t("open")} · ${tabText}`}
          tabLabel={tabText}
          status={tabState.status}
          icon={<DialerMark className="h-5 w-5 text-foreground" />}
          onClick={openPanel}
        />
      ) : null}
      <DockBounds ref={boundsRef} />
      <AnimatePresence>
        {open ? (
          <motion.div
            key="dialer"
            {...dragProps}
            dragConstraints={boundsRef}
            style={{ x: x, y: y }}
            className="fixed inset-x-2 bottom-20 z-[60] sm:inset-x-auto sm:bottom-24 sm:right-[calc(3rem+var(--assistant-sheet-w,0px))] sm:w-[300px]"
          >
            <motion.section
              role="dialog"
              aria-modal="false"
              aria-labelledby="dialer-title"
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.97, x: 16 }
              }
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.98, x: 12 }
              }
              transition={{
                duration: reduceMotion ? 0.12 : 0.22,
                ease: PANEL_EASE,
              }}
              style={{ transformOrigin: "right center" }}
              className="flex max-h-[calc(100dvh-6rem)] flex-col overflow-hidden rounded-2xl border border-border-strong bg-card shadow-lg"
            >
              <header
                onPointerDown={startDrag}
                onDoubleClick={(event) => {
                  if (!(event.target as HTMLElement).closest("button")) reset();
                }}
                title={tc("dragHint")}
                className="cursor-grab touch-none select-none border-b border-border px-4 pb-2.5 pt-3 active:cursor-grabbing"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className={cn(
                      "h-2 w-2 flex-shrink-0 rotate-45 rounded-[1px]",
                      live ? "animate-dot-pulse bg-healthy" : "bg-primary",
                    )}
                  />
                  <h2
                    id="dialer-title"
                    className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-foreground"
                  >
                    {t("title")}
                  </h2>
                  <span className="flex items-center gap-1.5 text-2xs font-medium text-muted-foreground">
                    <span
                      aria-hidden
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        online ? "bg-healthy" : "bg-warning",
                      )}
                    />
                    {t(online ? "online" : "offline")}
                  </span>
                  <button
                    type="button"
                    onClick={minimize}
                    aria-label={t("minimize")}
                    title={t("minimize")}
                    className={DOCK_HEADER_ICON_BUTTON}
                  >
                    <Minus weight="bold" className="h-3.5 w-3.5" />
                  </button>
                </div>
              </header>

              {inCall && callHeldBy ? (
                <p
                  role="status"
                  className="px-4 py-4 text-xs text-muted-foreground"
                >
                  {t(`callHeldBy.${callHeldBy}`)}
                </p>
              ) : inCall ? (
                <InCallPanel />
              ) : (
                <div className="flex min-h-0 flex-col overflow-y-auto">
                  <div className="px-4 pt-3">
                    {dialable.length === 0 ? (
                      <div className="rounded-[--radius] border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
                        {loadingTrunks
                          ? t("loadingTrunks")
                          : noLine
                            ? t("noTrunks")
                            : tReasons(blocker)}
                        {!loadingTrunks && noLine && can("sip_trunks", "read") ? (
                          <Link
                            href="/dashboard/sip-trunks"
                            className="mt-1.5 block font-semibold text-primary-ink underline-offset-2 hover:underline"
                          >
                            {t("manageTrunks")}
                          </Link>
                        ) : null}
                      </div>
                    ) : (
                      <ElevatedSelect
                        label={t("trunk")}
                        value={selectedTrunk?.id ?? ""}
                        onValueChange={chooseTrunk}
                      >
                        {dialable.map((trunk) => (
                          <ElevatedSelectItem key={trunk.id} value={trunk.id}>
                            {trunk.name}
                          </ElevatedSelectItem>
                        ))}
                      </ElevatedSelect>
                    )}
                  </div>

                  <div className="mx-4 mt-3 flex items-center gap-1 border-b border-border-strong focus-within:border-primary">
                    <span aria-hidden className="w-8 flex-shrink-0" />
                    <input
                      ref={inputRef}
                      value={number}
                      onChange={(event) => {
                        const typed = event.target.value;
                        editNumber(() => typed);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") placeCall();
                        if (!event.repeat) soundPlayer.keyTone(event.key);
                      }}
                      inputMode="tel"
                      autoComplete="off"
                      spellCheck={false}
                      aria-label={t("number")}
                      placeholder={t("numberPlaceholder")}
                      className="readout h-14 min-w-0 flex-1 bg-transparent text-center text-2xl font-semibold tracking-wide text-foreground outline-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        editNumber((current) => current.slice(0, -1))
                      }
                      disabled={!number}
                      aria-label={t("erase")}
                      title={t("erase")}
                      className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors duration-DEFAULT hover:bg-muted hover:text-foreground disabled:invisible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Backspace className="h-4 w-4" />
                    </button>
                  </div>

                  <div
                    className="grid grid-cols-3 gap-1 px-4 pt-3"
                    role="group"
                    aria-label={t("keypad")}
                  >
                    {DIAL_KEYS.map((key) => (
                      <button
                        key={key}
                        type="button"
                        aria-label={key}
                        onClick={() => press(key)}
                        className="flex h-12 flex-col items-center justify-center rounded-[--radius] text-foreground transition-colors duration-DEFAULT hover:bg-muted active:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="readout text-lg font-semibold leading-none">
                          {key}
                        </span>
                        <span className="mt-1 h-2.5 text-[9px] font-semibold leading-none tracking-[0.14em] text-muted-foreground">
                          {KEY_LETTERS[key] ?? ""}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="px-4 pb-4 pt-3">
                    <button
                      type="button"
                      onClick={placeCall}
                      disabled={!canPlace}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[--radius] bg-primary text-sm font-semibold text-primary-foreground shadow-button transition-colors duration-DEFAULT hover:bg-primary-hover active:bg-primary-active disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Phone weight="fill" className="h-4 w-4" aria-hidden />
                      {t("call")}
                    </button>
                    {leadNumberRefusal && dialable.length > 0 ? (
                      <p
                        role="status"
                        className="mt-2 text-xs text-muted-foreground"
                      >
                        {tReasons(leadNumberRefusal)}
                      </p>
                    ) : null}
                    {errorCode || lastError ? (
                      <p
                        role="alert"
                        className="mt-2 text-xs text-destructive-ink"
                      >
                        {errorCode ? t(`errors.${errorCode}`) : lastError}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
