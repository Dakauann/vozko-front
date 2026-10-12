export type StreamedChannel = "text" | "reasoning";

export interface Retraction {
  text: string;
  reasoning: string;
}

export interface Streamed<T> {
  channel: StreamedChannel;
  text: string;
  withText: (text: string) => T;
}

export function takeBackStreamed<T>(items: T[], retraction: Retraction, streamedOf: (item: T) => Streamed<T> | null): T[] {
  const left: Record<StreamedChannel, number> = { text: retraction.text.length, reasoning: retraction.reasoning.length };
  if (left.text === 0 && left.reasoning === 0) return items;
  const kept = [...items];
  for (let i = kept.length - 1; i >= 0 && (left.text > 0 || left.reasoning > 0); i--) {
    const streamed = streamedOf(kept[i]);
    if (!streamed || left[streamed.channel] === 0) break;
    const removed = Math.min(left[streamed.channel], streamed.text.length);
    left[streamed.channel] -= removed;
    const text = streamed.text.slice(0, streamed.text.length - removed);
    if (text) {
      kept[i] = streamed.withText(text);
      break;
    }
    kept.splice(i, 1);
  }
  return kept;
}
