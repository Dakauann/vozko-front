const BASIS_POINTS_PER_PERCENT = 100;

export function basisPointsToPercent(bps: number): number {
  return bps / BASIS_POINTS_PER_PERCENT;
}

export function formatPercent(percent: number, locale: string, fractionDigits = 1): string {
  return new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(percent / 100);
}

export function formatBasisPoints(bps: number, locale: string, fractionDigits = 1): string {
  return formatPercent(basisPointsToPercent(bps), locale, fractionDigits);
}
