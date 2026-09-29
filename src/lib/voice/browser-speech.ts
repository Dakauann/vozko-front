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
  onstart: (() => void) | null;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionConstructor = new () => Recognition;

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

export type ListenFailure = "blocked" | "no_microphone" | "network" | "unavailable";

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
