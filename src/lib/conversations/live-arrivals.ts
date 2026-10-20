interface TimedMessage {
  id: string;
  created_at: string;
}

export interface ArrivalTracker {
  threadKey: string | null;
  source: readonly TimedMessage[] | null;
  ids: ReadonlySet<string>;
  newestAt: number;
  live: ReadonlySet<string>;
}

const nothing: ReadonlySet<string> = new Set();

export const idleArrivals: ArrivalTracker = {
  threadKey: null,
  source: null,
  ids: nothing,
  newestAt: Number.NEGATIVE_INFINITY,
  live: nothing,
};

function timeOf(message: TimedMessage): number {
  const time = new Date(message.created_at).getTime();
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

function arrivedAfter(previous: ArrivalTracker, messages: readonly TimedMessage[]): ReadonlySet<string> {
  const live = new Set<string>();
  for (const message of messages) {
    if (!previous.ids.has(message.id) && timeOf(message) > previous.newestAt) live.add(message.id);
  }
  return live.size > 0 ? live : nothing;
}

export function trackArrivals(
  previous: ArrivalTracker,
  threadKey: string | null,
  messages: readonly TimedMessage[],
): ArrivalTracker {
  const sameThread = threadKey !== null && previous.threadKey === threadKey && previous.ids.size > 0;
  return {
    threadKey,
    source: messages,
    ids: new Set(messages.map((message) => message.id)),
    newestAt: messages.reduce((newest, message) => Math.max(newest, timeOf(message)), Number.NEGATIVE_INFINITY),
    live: sameThread ? arrivedAfter(previous, messages) : nothing,
  };
}
