import { ME, TEAM_MESSAGES, THREAD } from "./fixtures";

const ignore = () => undefined;
const nothing = async () => null;

export const teamChatKeys = { thread: () => ["thread"], people: () => ["people"] };

export function useTeamChatWorkspace() {
  return "ws";
}

export function useTeamChatMe() {
  return ME;
}

export function useTeamChatAccess() {
  return { read: true, send: true, create: true };
}

export async function sectionData<T>(result: Promise<T>) {
  return result;
}

export function useTeamChatSummary() {
  return { data: { unread_threads: 0, unread_messages: 0 } };
}

export function rememberThread() {}

export function useTeamChatThreads() {
  return { threads: [THREAD], hasMore: false, loadMore: ignore, loadingMore: false, isPending: false };
}

export function useTeamChatThread() {
  return { isPending: false, data: THREAD };
}

export function useTeamChatPeople() {
  return { data: [] };
}

export function useTeamChatRealtime() {}

export function useTeamChatMessages() {
  return {
    messages: TEAM_MESSAGES,
    pending: [],
    hasOlder: false,
    loaded: true,
    loadingOlder: false,
    failed: false,
    loadOlder: nothing,
    send: nothing,
    retry: nothing,
    discard: ignore,
    edit: nothing,
    remove: nothing,
    markRead: ignore,
  };
}

export function forgetTeamChatMessages() {}

export function useTeamChatScheduled() {
  return { scheduled: [], schedule: nothing, cancel: nothing };
}

export function useTeamChatTyping() {
  return { names: [], notifyTyping: ignore };
}
