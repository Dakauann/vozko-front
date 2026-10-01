export const PINNED_DISTANCE_PX = 80;

export interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export function isPinnedToBottom({ scrollTop, scrollHeight, clientHeight }: ScrollMetrics): boolean {
  return scrollHeight - scrollTop - clientHeight < PINNED_DISTANCE_PX;
}

export function firstVisibleIndex(count: number, bottomAt: (index: number) => number, viewportTop: number): number {
  let low = 0;
  let high = count;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (bottomAt(mid) > viewportTop) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  return low < count ? low : -1;
}
