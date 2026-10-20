import { INITIAL_ATTENTION, planAttention, type AttentionSignal, type AttentionSound, type AttentionView, type DesktopNotice } from "./rules";

export interface AttentionEnvironment {
  now: () => number;
  view: () => Omit<AttentionView, "now">;
  claim: (id: string, eager: boolean) => Promise<boolean>;
  play: (sound: AttentionSound) => void;
  show: (notice: DesktopNotice) => void;
}

export function createAttention(env: AttentionEnvironment): (signal: AttentionSignal) => Promise<void> {
  let state = INITIAL_ATTENTION;
  return async (signal) => {
    const claimed = await env.claim(signal.id, env.view().focused);
    if (!claimed) return;
    const plan = planAttention(state, signal, { ...env.view(), now: env.now() });
    state = plan.state;
    if (plan.sound) env.play(plan.sound);
    if (plan.desktop) env.show(plan.desktop);
  };
}
