const DEFAULT_OUTPUT = "default";

export function edgeSourceHandle(label: string | undefined, outputIds: string[]): string | undefined {
  if (label) {
    return outputIds.length === 0 && label === DEFAULT_OUTPUT ? undefined : label;
  }
  if (outputIds.includes(DEFAULT_OUTPUT)) return DEFAULT_OUTPUT;
  return outputIds.length === 1 ? outputIds[0] : undefined;
}

export function missingOutputHandles(
  outputIds: readonly string[],
  sourceHandles: readonly (string | null | undefined)[],
): string[] {
  const current = new Set(outputIds);
  const missing: string[] = [];
  for (const handle of sourceHandles) {
    if (!handle || current.has(handle) || missing.includes(handle)) continue;
    missing.push(handle);
  }
  return missing;
}
