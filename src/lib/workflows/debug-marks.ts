export interface NodeDebugMarks {
  breakpoints: ReadonlySet<string>;
  realCalls: ReadonlySet<string>;
  pausedNodeId: string | null;
  activeNodeId: string | null;
}

export const NODE_BREAKPOINT = 1;
export const NODE_REAL_CALL = 2;
export const NODE_PAUSED = 4;
export const NODE_ACTIVE = 8;

export function nodeDebugFlags(marks: NodeDebugMarks | null, nodeId: string): number {
  if (!marks) return 0;
  let flags = 0;
  if (marks.breakpoints.has(nodeId)) flags |= NODE_BREAKPOINT;
  if (marks.realCalls.has(nodeId)) flags |= NODE_REAL_CALL;
  if (marks.pausedNodeId === nodeId) flags |= NODE_PAUSED;
  if (marks.activeNodeId === nodeId) flags |= NODE_ACTIVE;
  return flags;
}

export function hasDebugFlag(flags: number, flag: number): boolean {
  return (flags & flag) === flag;
}
