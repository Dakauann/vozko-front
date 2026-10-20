import type { HandleDefinition, WorkflowNodeType } from "./types";

export interface HandleNode {
  id: string;
  type: WorkflowNodeType;
  config: Record<string, unknown>;
}

export interface HandleCache {
  handles: Record<string, HandleDefinition[]>;
  signatures: Record<string, string>;
}

export function emptyHandleCache(): HandleCache {
  return { handles: {}, signatures: {} };
}

function signatureOf(node: HandleNode): string {
  return `${node.type}:${JSON.stringify(node.config)}`;
}

export function seedHandleCache(handles: Record<string, HandleDefinition[]>, nodes: HandleNode[]): HandleCache {
  const signatures: Record<string, string> = {};
  for (const node of nodes) {
    if (handles[node.id]) signatures[node.id] = signatureOf(node);
  }
  return { handles: { ...handles }, signatures };
}

export function handleRequestOf(cache: HandleCache, nodes: HandleNode[]): { cache: HandleCache; send: HandleNode[] } {
  const handles: Record<string, HandleDefinition[]> = {};
  const signatures: Record<string, string> = {};
  const send: HandleNode[] = [];
  for (const node of nodes) {
    if (cache.handles[node.id]) handles[node.id] = cache.handles[node.id];
    const answered = cache.signatures[node.id];
    if (answered !== undefined) signatures[node.id] = answered;
    if (answered !== signatureOf(node) || !cache.handles[node.id]) send.push(node);
  }
  return { cache: { handles, signatures }, send };
}

export function acceptHandles(cache: HandleCache, sent: HandleNode[], answer: Record<string, HandleDefinition[]>): HandleCache {
  const handles = { ...cache.handles };
  const signatures = { ...cache.signatures };
  for (const node of sent) {
    if (!answer[node.id]) continue;
    handles[node.id] = answer[node.id];
    signatures[node.id] = signatureOf(node);
  }
  return { handles, signatures };
}
