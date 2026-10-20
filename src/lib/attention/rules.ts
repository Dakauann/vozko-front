export type AttentionSource = "customer_message" | "team_message" | "notification";

export type AttentionSound = "message" | "chime";

export interface AttentionSignal {
  id: string;
  source: AttentionSource;
  group: string;
  title: string;
  body: string;
  critical?: boolean;
  quiet?: boolean;
  href?: string;
  open?: () => void;
}

export interface AttentionView {
  now: number;
  focused: boolean;
  visible: boolean;
  viewing: Partial<Record<AttentionSource, string | null>>;
  soundMuted: boolean;
  desktopAllowed: boolean;
}

interface RecentSignal {
  source: AttentionSource;
  group: string;
  at: number;
}

export interface AttentionState {
  lastSoundAt: number;
  recent: RecentSignal[];
}

export interface DesktopNotice {
  tag: string;
  title: string;
  body: string;
  requireInteraction: boolean;
  summary?: { source: AttentionSource; count: number };
  signal?: AttentionSignal;
}

export interface AttentionPlan {
  state: AttentionState;
  sound: AttentionSound | null;
  desktop: DesktopNotice | null;
}

export const SOUND_GAP_MS = 1_500;

export const BURST_WINDOW_MS = 4_000;

export const BURST_GROUP_LIMIT = 3;

export const INITIAL_ATTENTION: AttentionState = { lastSoundAt: Number.NEGATIVE_INFINITY, recent: [] };

function soundFor(source: AttentionSource): AttentionSound {
  return source === "customer_message" ? "message" : "chime";
}

function desktopNotice(signal: AttentionSignal, recent: RecentSignal[]): DesktopNotice {
  if (!signal.critical) {
    const sameSource = recent.filter((r) => r.source === signal.source);
    const groups = new Set(sameSource.map((r) => r.group));
    if (groups.size > BURST_GROUP_LIMIT) {
      return {
        tag: `summary:${signal.source}`,
        title: "",
        body: "",
        requireInteraction: false,
        summary: { source: signal.source, count: sameSource.length },
      };
    }
  }
  return {
    tag: `${signal.source}:${signal.group}`,
    title: signal.title,
    body: signal.body,
    requireInteraction: Boolean(signal.critical),
    signal,
  };
}

export function planAttention(state: AttentionState, signal: AttentionSignal, view: AttentionView): AttentionPlan {
  const looking = view.focused && view.visible;
  if (signal.quiet || (looking && view.viewing[signal.source] === signal.group)) {
    return { state, sound: null, desktop: null };
  }
  const recent = [...state.recent.filter((r) => view.now - r.at < BURST_WINDOW_MS), { source: signal.source, group: signal.group, at: view.now }];
  const playSound = !view.soundMuted && view.now - state.lastSoundAt >= SOUND_GAP_MS;
  return {
    state: { lastSoundAt: playSound ? view.now : state.lastSoundAt, recent },
    sound: playSound ? soundFor(signal.source) : null,
    desktop: view.desktopAllowed && !looking ? desktopNotice(signal, recent) : null,
  };
}
