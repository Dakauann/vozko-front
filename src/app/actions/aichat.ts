import type {
  ChatThread,
  ChatThreadList,
  ChatMessageList,
} from '@/lib/aichat/types';
import { apiClient } from "@/lib/api/browser-client";

export async function listChatThreadsAction(page = 1, pageSize = 50) {
  const res = await apiClient<ChatThreadList>(`/chat/threads?page=${page}&pageSize=${pageSize}`, {
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

export async function renameChatThreadAction(threadId: string, title: string) {
  const res = await apiClient<{ ok: boolean }>(`/chat/threads/${threadId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  return { error: res.error?.message ?? null };
}

export async function deleteChatThreadAction(threadId: string) {
  const res = await apiClient<{ ok: boolean }>(`/chat/threads/${threadId}`, {
    method: 'DELETE',
  });
  return { error: res.error?.message ?? null };
}
