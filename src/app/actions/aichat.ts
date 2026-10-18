import type {
  ChatThread,
  ChatThreadList,
  ChatMessageList,
} from '@/lib/aichat/types';
import type { ThreadCost } from '@/lib/aichat/thread-cost';
import { apiClient } from "@/lib/api/browser-client";

export async function listChatThreadsAction(page = 1, pageSize = 50, query = '') {
  const search = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (query.trim()) search.set('q', query.trim());
  const res = await apiClient<ChatThreadList>(`/chat/threads?${search.toString()}`, {
    method: 'GET',
  });
  if (res.error) return { data: null, error: res.error.message };
  return { data: res.data ?? null, error: null };
}

export async function createChatThreadAction(model: string, title = '') {
  const res = await apiClient<ChatThread>('/chat/threads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, title }),
  });
  if (res.error) return { data: null, error: res.error.message };
  return { data: res.data ?? null, error: null };
}

export async function getChatMessagesAction(threadId: string, page = 1, pageSize = 100) {
  const res = await apiClient<ChatMessageList>(
    `/chat/threads/${threadId}/messages?page=${page}&pageSize=${pageSize}`,
    { method: 'GET' },
  );
  if (res.error) return { data: null, error: res.error.message };
  return { data: res.data ?? null, error: null };
}

export async function getChatThreadCostAction(threadId: string) {
  const res = await apiClient<ThreadCost>(`/chat/threads/${encodeURIComponent(threadId)}/cost`, {
    method: 'GET',
  });
  if (res.error || !res.data) return { data: null, error: res.error?.message ?? null };
  return { data: res.data, error: null };
}

export async function stopChatTurnAction(threadId: string) {
  const res = await apiClient<{ ok: boolean }>(`/chat/threads/${encodeURIComponent(threadId)}/turn/stop`, {
    method: 'POST',
  });
  return { error: res.error?.message ?? null };
}

interface QueueChatMessageInput {
  clientId: string;
  content: string;
  attachments: string[];
}

export async function queueChatMessageAction(threadId: string, input: QueueChatMessageInput) {
  const res = await apiClient<unknown>(`/chat/threads/${encodeURIComponent(threadId)}/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (res.error) return { data: null, error: { message: res.error.message, code: res.error.code ?? null } };
  return { data: res.data ?? null, error: null };
}

export async function unqueueChatMessageAction(threadId: string, clientId: string) {
  const res = await apiClient<{ ok: boolean }>(`/chat/threads/${encodeURIComponent(threadId)}/queue/${encodeURIComponent(clientId)}`, {
    method: 'DELETE',
  });
  if (res.error) return { error: { message: res.error.message, code: res.error.code ?? null } };
  return { error: null };
}

export async function deleteChatThreadAction(threadId: string) {
  const res = await apiClient<{ ok: boolean }>(`/chat/threads/${threadId}`, {
    method: 'DELETE',
  });
  return { error: res.error?.message ?? null };
}
