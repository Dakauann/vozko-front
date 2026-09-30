"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

import { DockBounds } from "@/components/docks/dock-bounds";
import {
  DOCK_HEADER_ICON_BUTTON,
  PANEL_EASE,
} from "@/components/docks/dock-chrome";
import { useDraggableDock } from "@/components/docks/use-draggable-dock";
import ElevatedSelect, {
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import {
  Backspace,
  Microphone,
  MicrophoneSlash,
  Minus,
  Phone,
  PhoneDisconnect,
  SpinnerGap,
} from "@/components/icons";
import { listSipTrunksAction } from "@/app/actions/sip-trunks";
import { useCallSession } from "@/contexts/call-session-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import {
  formatCallDuration,
  useCallElapsedSeconds,
} from "@/hooks/use-call-clock";
import { Link } from "@/i18n/routing";
import {
  requestCall,
  setDialerOpen,
  subscribeDialPreset,
} from "@/lib/call-session/call-session-control";
import {
  DIAL_KEYS,
  appendDialKey,
  callOutcome,
  dialerErrorCode,
  isDialable,
} from "@/lib/dialer/dial-string";
import { canDialThrough, type SipTrunk } from "@/lib/sip-trunks/types";
import { cn } from "@/lib/utils";
import { formatPhoneForDisplay } from "@/lib/phone/display";

const TRUNK_REFRESH_MS = 10_000;
const REMEMBERED_TRUNK_KEY = "dialer:trunk";
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
  const mayCall = useSettledPermission("sip_trunks", "call");
  const mayUseCalls = useSettledPermission("call_session", "use");
  if (!mayCall || !mayUseCalls) return null;
  return <Dialer />;
}

function readRememberedTrunk(workspaceId: string): string | null {
  try {
    return window.localStorage.getItem(
      `${REMEMBERED_TRUNK_KEY}:${workspaceId}`,
    );
  } catch {
    return null;
  }
}

function rememberTrunk(workspaceId: string, trunkId: string) {
  try {
    window.localStorage.setItem(
      `${REMEMBERED_TRUNK_KEY}:${workspaceId}`,
      trunkId,
    );
  } catch {
    return;
  }
}

function Dialer() {
  const t = useTranslations("calling.dialer");
  const tc = useTranslations("calling");
  const { can, currentWorkspace } = useWorkspace();
  const {
    callState,
    status,
    endCall,
    muted,
    setMuted,
    lastErrorCode,
    lastError,
    clearError,
  } = useCallSession();
  const workspaceId = currentWorkspace?.id ?? "";
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [trunks, setTrunks] = useState<SipTrunk[]>([]);
  const [loadingTrunks, setLoadingTrunks] = useState(false);
  const [chosenTrunkId, setChosenTrunkId] = useState<string | null>(null);
  const [number, setNumber] = useState("");
  const tabRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const elapsed = useCallElapsedSeconds(callState);
  const { x, y, boundsRef, startDrag, reset, dragProps } =
    useDraggableDock("dialer");

  const dialable = useMemo(() => trunks.filter(canDialThrough), [trunks]);
  const selectedTrunk =
    dialable.find((trunk) => trunk.id === chosenTrunkId) ??
    dialable.find((trunk) => trunk.id === readRememberedTrunk(workspaceId)) ??
    dialable[0] ??
    null;

  const loadTrunks = useCallback(() => {
    setLoadingTrunks(true);
    void listSipTrunksAction().then((result) => {
      setTrunks(result.trunks);
      setLoadingTrunks(false);
    });
  }, []);

  const openPanel = useCallback(() => {
    setOpen(true);
    loadTrunks();
  }, [loadTrunks]);

  const minimize = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => tabRef.current?.focus());
  }, []);

  useEffect(() => {
    setDialerOpen(open);
    return () => setDialerOpen(false);
  }, [open]);

  useEffect(
    () =>
      subscribeDialPreset((preset) => {
        setNumber(preset.phoneNumber);
        if (preset.trunkId) setChosenTrunkId(preset.trunkId);
        clearError();
        openPanel();
      }),
    [openPanel, clearError],
  );

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const timer = setInterval(loadTrunks, TRUNK_REFRESH_MS);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") minimize();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, loadTrunks, minimize]);

  const inCall = callState !== null;
  const live = inCall && callState.status !== "ended";
  const online = status === "connected";
  const canPlace =
    online && !inCall && selectedTrunk !== null && isDialable(number);
  const errorCode = dialerErrorCode(lastErrorCode);

  const placeCall = () => {
    if (!canPlace || !selectedTrunk) return;
    clearError();
    requestCall({
      phoneNumber: number.trim(),
      trunkId: selectedTrunk.id,
      label: selectedTrunk.name,
    });
  };

  const press = (key: (typeof DIAL_KEYS)[number]) => {
    setNumber((current) => appendDialKey(current, key));
    inputRef.current?.focus();
  };

  return (
    <>
      {!open ? (
        <DialerTab
          ref={tabRef}
          label={t("open")}
          tabLabel={t("tabLabel")}
          live={live}
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
            className="fixed inset-x-2 bottom-20 z-[60] sm:inset-x-auto sm:bottom-24 sm:right-12 sm:w-[300px]"
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

              {inCall ? (
                <div
                  className="flex flex-col items-center px-4 pb-5 pt-7 text-center"
                  role="status"
                  aria-live="polite"
                >
                  <span className="legend">
                    {callState.status === "ended"
                      ? t(`outcome.${callOutcome(callState.reason)}`)
                      : t(
                          callState.status === "answered"
                            ? "inCall"
                            : callState.status === "waiting_slot"
                              ? "waitingSlot"
                              : "ringing",
                        )}
                  </span>
                  <span className="readout mt-2 max-w-full truncate text-2xl font-semibold tracking-wide text-foreground">
                    {formatPhoneForDisplay(callState.phoneNumber)}
                  </span>
                  <span className="mt-1.5 flex h-5 items-center">
                    {callState.status === "answered" ? (
                      <span className="readout text-sm tabular-nums text-muted-foreground">
                        {formatCallDuration(elapsed)}
                      </span>
                    ) : callState.status === "ringing" ||
                      callState.status === "waiting_slot" ? (
                      <SpinnerGap
                        className="h-4 w-4 animate-spin text-muted-foreground"
                        aria-hidden
                      />
                    ) : null}
                  </span>
                  {live ? (
                    <div className="mt-6 grid w-full grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMuted(!muted)}
                        aria-pressed={muted}
                        disabled={callState.status !== "answered"}
                        className={cn(
                          "inline-flex h-11 items-center justify-center gap-2 rounded-[--radius] border text-sm font-semibold transition-colors duration-DEFAULT focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40",
                          muted
                            ? "border-foreground bg-foreground text-background"
                            : "border-control-edge text-foreground hover:bg-muted",
                        )}
                      >
                        {muted ? (
                          <MicrophoneSlash className="h-4 w-4" />
                        ) : (
                          <Microphone className="h-4 w-4" />
                        )}
                        {t(muted ? "unmute" : "mute")}
                      </button>
                      <button
                        type="button"
                        onClick={endCall}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-[--radius] bg-destructive text-sm font-semibold text-destructive-foreground transition-opacity duration-DEFAULT hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <PhoneDisconnect className="h-4 w-4" aria-hidden />
                        {t("hangUp")}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex min-h-0 flex-col overflow-y-auto">
                  <div className="px-4 pt-3">
                    {dialable.length === 0 ? (
                      <div className="rounded-[--radius] border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
                        {loadingTrunks ? t("loadingTrunks") : t("noTrunks")}
                        {!loadingTrunks && can("sip_trunks", "read") ? (
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
                        onValueChange={(value) => {
                          setChosenTrunkId(value);
                          rememberTrunk(workspaceId, value);
                        }}
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
                      onChange={(event) => setNumber(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") placeCall();
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
                        setNumber((current) => current.slice(0, -1))
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

const DialerTab = forwardRef<
  HTMLButtonElement,
  { label: string; tabLabel: string; live: boolean; onClick: () => void }
>(function DialerTab({ label, tabLabel, live, onClick }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={label}
      className="group fixed right-0 top-[calc(50%+4rem)] z-[60] flex h-24 w-9 flex-col items-center justify-center gap-2 rounded-l-xl border border-r-0 border-border-strong bg-card text-foreground shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="relative">
        <Phone className="h-5 w-5" aria-hidden />
        {live ? (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 h-2 w-2 rotate-45 rounded-[1px] bg-healthy animate-dot-pulse"
          />
        ) : null}
      </span>
      <span
        aria-hidden
        className="whitespace-nowrap text-2xs font-semibold [writing-mode:vertical-rl]"
      >
        {tabLabel}
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute right-full top-1/2 mr-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs font-semibold text-foreground opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 sm:block"
      >
        {label}
      </span>
    </button>
  );
});
