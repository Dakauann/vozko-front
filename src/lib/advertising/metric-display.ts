export function shownCount(value: number | null | undefined): number | null {
  return value ? value : null;
}

export function shownLinkRate(rate: number | null | undefined, linkClicks: number): number | null {
  return linkClicks > 0 && rate !== undefined ? rate : null;
}
