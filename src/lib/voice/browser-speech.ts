export interface RecognitionAlternative {
  transcript: string;
}

export interface RecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: RecognitionAlternative;
}

export interface RecognitionResultEvent {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionResult };
}

export interface RecognitionErrorEvent {
  error: string;
}

export interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type LocalAvailability = "available" | "downloadable" | "downloading" | "unavailable";

interface LocalOptions {
  langs: string[];
  processLocally: true;
}

export interface RecognitionConstructor {
  new (): Recognition;
  available?: (options: LocalOptions) => Promise<LocalAvailability>;
  install?: (options: LocalOptions) => Promise<boolean>;
}

type SpeechWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};

export function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function speechSynthesisEngine(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    return null;
  }
  return window.speechSynthesis;
}

export type ListenFailure = "blocked" | "no_microphone" | "network" | "installing" | "pack_stalled" | "unavailable";

const FAILURES: Record<string, ListenFailure> = {
  "not-allowed": "blocked",
  "service-not-allowed": "blocked",
  "audio-capture": "no_microphone",
  network: "network",
  "language-not-supported": "unavailable",
};

export function listenFailure(code: string): ListenFailure | null {
  return FAILURES[code] ?? null;
}

export type LocalRecognition = "ready" | "installing" | "unavailable";

export const LOCAL_CHECK_MS = 1500;

const installs = new Map<string, Promise<boolean>>();
const failedInstalls = new Set<string>();

function startInstall(Ctor: RecognitionConstructor, options: LocalOptions): Promise<boolean> {
  const lang = options.langs[0];
  const outcome = Ctor.install!(options)
    .catch(() => false)
    .then((installed) => {
      installs.delete(lang);
      if (!installed) failedInstalls.add(lang);
      return installed;
    });
  installs.set(lang, outcome);
  return outcome;
}

function withinCheckWindow(check: Promise<LocalAvailability>): Promise<LocalAvailability> {
  return Promise.race([
    check,
    new Promise<LocalAvailability>((resolve) => setTimeout(() => resolve("unavailable"), LOCAL_CHECK_MS)),
  ]);
}

async function checkLocal(Ctor: RecognitionConstructor, options: LocalOptions): Promise<LocalRecognition> {
  const lang = options.langs[0];
  if (failedInstalls.has(lang)) return "unavailable";
  const status = await withinCheckWindow(Ctor.available!(options)).catch((): LocalAvailability => "unavailable");
  if (status === "available") return "ready";
  if (status === "unavailable") return "unavailable";
  if (status === "downloading" || installs.has(lang)) return "installing";
  if (!Ctor.install) return "unavailable";
  void startInstall(Ctor, options);
  return "installing";
}

export function localRecognition(Ctor: RecognitionConstructor, lang: string): LocalRecognition | Promise<LocalRecognition> {
  if (typeof Ctor.available !== "function") return "unavailable";
  return checkLocal(Ctor, { langs: [lang], processLocally: true });
}

export function forgetLocalInstalls(): void {
  installs.clear();
  failedInstalls.clear();
}

export const LOCAL_POLL_MS = 2000;
export const LOCAL_WAIT_LIMIT_MS = 2 * 60 * 1000;

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type LocalWait = "ready" | "failed" | "stalled";

export async function whenLocalReady(Ctor: RecognitionConstructor, lang: string): Promise<LocalWait> {
  if (typeof Ctor.available !== "function") return "failed";
  const options: LocalOptions = { langs: [lang], processLocally: true };
  for (let waited = 0; waited < LOCAL_WAIT_LIMIT_MS; waited += LOCAL_POLL_MS) {
    if (failedInstalls.has(lang)) return "failed";
    const status = await withinCheckWindow(Ctor.available(options)).catch((): LocalAvailability => "unavailable");
    if (status === "available") return "ready";
    if (status === "unavailable") return "failed";
    await pause(LOCAL_POLL_MS);
  }
  return "stalled";
}
