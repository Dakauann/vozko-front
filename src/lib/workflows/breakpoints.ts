export function toggleBreakpoint(breakpoints: ReadonlySet<string>, nodeId: string): ReadonlySet<string> {
  const next = new Set(breakpoints);
  if (next.has(nodeId)) next.delete(nodeId);
  else next.add(nodeId);
  return next;
}

export function liveBreakpoints(breakpoints: ReadonlySet<string>, nodeIds: ReadonlySet<string>): string[] {
  return [...breakpoints].filter((nodeId) => nodeIds.has(nodeId)).sort();
}
