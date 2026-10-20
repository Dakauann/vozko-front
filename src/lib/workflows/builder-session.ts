export interface BuilderIdentity {
  workflowId: string;
  workspaceId: string;
}

export interface BuilderSession extends BuilderIdentity {
  epoch: number;
}

export function shouldRestartBuilderSession(prev: BuilderIdentity, next: BuilderIdentity): boolean {
  if (prev.workspaceId !== next.workspaceId) return true;
  if (prev.workflowId === next.workflowId) return false;
  return prev.workflowId !== "";
}

export function initialBuilderSession(identity: BuilderIdentity): BuilderSession {
  return { ...identity, epoch: 0 };
}

export function advanceBuilderSession(session: BuilderSession, next: BuilderIdentity): BuilderSession {
  if (session.workflowId === next.workflowId && session.workspaceId === next.workspaceId) return session;
  const epoch = shouldRestartBuilderSession(session, next) ? session.epoch + 1 : session.epoch;
  return { ...next, epoch };
}

export function builderSocketPath(workflowId: string): string {
  return workflowId
    ? `/ws/workflows/${encodeURIComponent(workflowId)}/ai-builder`
    : `/ws/workflows/ai-builder`;
}
