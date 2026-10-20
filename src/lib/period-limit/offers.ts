type Listener = () => void;

export interface PeriodOffers {
  isSettled: (key: string) => boolean;
  settle: (key: string) => void;
  subscribe: (listener: Listener) => () => void;
}

export function periodOfferKey(view: string, from: string, to: string): string {
  return `${view}:${from}:${to}`;
}

export function createPeriodOffers(): PeriodOffers {
  const settled = new Set<string>();
  const listeners = new Set<Listener>();
  return {
    isSettled: (key) => settled.has(key),
    settle: (key) => {
      if (settled.has(key)) return;
      settled.add(key);
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const periodOffers = createPeriodOffers();
