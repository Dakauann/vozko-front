const LINE_REM = 1.5;
const PADDING_REM = 1.25;
const VIEWPORT_SHARE = 0.5;

export const MIN_COMPOSER_LINES = 2;
export const DEFAULT_COMPOSER_LINES = 3;
export const GROW_COMPOSER_LINES = 10;
export const MAX_COMPOSER_LINES = 20;

export function composerLine(rem: number): number {
  return Math.round(rem * LINE_REM);
}

export function composerLines(count: number, rem: number): number {
  return Math.round(rem * (PADDING_REM + LINE_REM * count));
}

export function composerMaxHeight(viewportHeight: number, rem: number): number {
  const min = composerLines(MIN_COMPOSER_LINES, rem);
  const max = composerLines(MAX_COMPOSER_LINES, rem);
  const room = viewportHeight > 0 ? Math.floor(viewportHeight * VIEWPORT_SHARE) : max;
  return Math.max(min, Math.min(max, room));
}

export function clampComposerHeight(height: number, viewportHeight: number, rem: number): number {
  return Math.round(Math.min(Math.max(height, composerLines(MIN_COMPOSER_LINES, rem)), composerMaxHeight(viewportHeight, rem)));
}

export function composerBoxHeight(contentHeight: number, chosenHeight: number, viewportHeight: number, rem: number): number {
  const base = clampComposerHeight(chosenHeight, viewportHeight, rem);
  const cap = Math.max(base, Math.min(composerLines(GROW_COMPOSER_LINES, rem), composerMaxHeight(viewportHeight, rem)));
  return Math.min(Math.max(contentHeight, base), cap);
}
