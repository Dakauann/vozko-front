"use client";

import {
  Brain,
  Buildings,
  CaretDown,
  CaretRight,
  ChatCircle,
  CircleNotch,
  type Icon,
  ListBullets,
  ListNumbers,
  MagnifyingGlass,
  Microphone,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  Sparkle,
  Stop,
  TrashSimple,
  Wrench,
} from "@/components/icons";
import { useTranslations } from "next-intl";
import type {
  ChatMessage,
  ChatThread,
  PendingAction,
} from "@/lib/aichat/types";
import {
  createChatThreadAction,
  deleteChatThreadAction,
  getChatMessagesAction,
  listChatThreadsAction,
} from "@/app/actions/aichat";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { AIModelSelector } from "@/components/elevated-design/ai-model-selector";
import { ChatMarkdown } from "@/components/elevated-design/chat-markdown";
import { ModelBrandIcon } from "@/components/elevated-design/model-brand-icon";
import type { ModelPricingInfo } from "@/lib/agents/types";
import { cn } from "@/lib/utils";
import { getAgentOptionsAction } from "@/app/actions/agents";
import { useChatStream } from "@/hooks/use-chat-stream";

const CHAT_MODEL_KEY = "ai-chat:model";

// Maps each copilot tool to an icon. The friendly label is i18n (aiChatPage.tools);
// unmapped tools fall back to a prettified name + the generic Wrench icon, so a new
// backend tool degrades gracefully instead of showing a raw machine name.
const TOOL_ICON: Record<string, Icon> = {
  create_agent: Plus,
  update_agent: PencilSimple,
  delete_agent: TrashSimple,
  get_agent: MagnifyingGlass,
  list_agents: ListBullets,
  count_agents: ListNumbers,
  list_models: Sparkle,
  list_voices: Microphone,
  list_departments: Buildings,
  list_agent_tools: Wrench,
};

const KNOWN_TOOLS = new Set(Object.keys(TOOL_ICON));

// A Segment is one ordered piece of an assistant turn, the model's thinking, a
// tool step, or a chunk of the answer, appended in the order events arrive, so
// the timeline reads think → act → think → answer (matching the workflow builder).
type Segment =
  | { kind: "thinking"; text: string; streaming?: boolean }
  | { kind: "tool"; name: string; summary: string; ok: boolean }
  | { kind: "text"; text: string; streaming?: boolean };

// UIMessage augments a persisted message with the live, in-flight copilot state:
// the ordered segments of the streaming turn and any pending approval. Persisted
// messages (loaded from the server) carry only `content`.
type UIMessage = ChatMessage & {
  segments?: Segment[];
  pending?: PendingAction | null;
};

// hydrate rebuilds the segment timeline (thinking → tools → answer) from a persisted
// message's reasoning + tool steps, so a reloaded thread replays the same flow as the
// live stream instead of showing only the final text.
function hydrate(m: ChatMessage): UIMessage {
  if (!m.reasoning && !(m.tools && m.tools.length > 0)) return m;
  const segments: Segment[] = [];
  if (m.reasoning) segments.push({ kind: "thinking", text: m.reasoning });
  for (const tool of m.tools ?? []) {
    segments.push({ kind: "tool", name: tool.name, summary: tool.summary, ok: tool.ok });
  }
  if (m.content) segments.push({ kind: "text", text: m.content });
  return { ...m, segments };
}

interface BubbleLabels {
  thinking: string;
  thinkingLive: string;
  generatingResponse: string;
  approvalHint: string;
  approve: string;
  reject: string;
  toolFailed: string;
  toolLabel: (name: string) => string;
}

export function AIChatClient() {
  const t = useTranslations("aiChatPage");
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [pricing, setPricing] = useState<ModelPricingInfo[]>([]);
  const [model, setModel] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(CHAT_MODEL_KEY) ?? "";
  });
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);

  const { streaming, send, approve, reject, stop } = useChatStream();
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    stickToBottomRef.current = atBottom;
    setShowScrollDown(!atBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    stickToBottomRef.current = true;
    setShowScrollDown(false);
  }, []);

  const onModelChange = useCallback((m: string) => {
    setModel(m);
    if (typeof window !== "undefined") localStorage.setItem(CHAT_MODEL_KEY, m);
  }, []);

  useEffect(() => {
    (async () => {
      const { options } = await getAgentOptionsAction();
      if (options) {
        const messagingModels = options.messaging ?? [];
        setModels(messagingModels);
        setPricing(options.modelPricing ?? []);
        setModel(
          (prev) =>
            prev || options.defaults?.messagingModel || messagingModels[0] || "",
        );
      }
      const { data } = await listChatThreadsAction();
      if (data) setThreads(data.items);
    })();
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const refreshThreads = useCallback(async () => {
    const { data } = await listChatThreadsAction();
    if (data) setThreads(data.items);
  }, []);

  const reloadThread = useCallback(async (tid: string) => {
    const [{ data: msgs }, { data: list }] = await Promise.all([
      getChatMessagesAction(tid),
      listChatThreadsAction(),
    ]);
    if (msgs) setMessages(msgs.items.map(hydrate));
    if (list) setThreads(list.items);
  }, []);

  const selectThread = useCallback(async (id: string) => {
    setActiveId(id);
    setError(null);
    setLoadingThread(true);
    const { data } = await getChatMessagesAction(id);
    setMessages((data?.items ?? []).map(hydrate));
    setLoadingThread(false);
  }, []);

  const newChat = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setError(null);
  }, []);

  const removeThread = useCallback(
    async (id: string) => {
      await deleteChatThreadAction(id);
      setThreads((prev) => prev.filter((th) => th.id !== id));
      if (activeId === id) newChat();
    },
    [activeId, newChat],
  );

  const patchLastAssistant = useCallback((fn: (m: UIMessage) => UIMessage) => {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === "assistant") {
          next[i] = fn(next[i]);
          break;
        }
      }
      return next;
    });
  }, []);

  const patchSegments = useCallback(
    (fn: (segs: Segment[]) => Segment[]) =>
      patchLastAssistant((m) => ({ ...m, segments: fn(m.segments ?? []) })),
    [patchLastAssistant],
  );

  // finalizeStreaming stops every live cursor on the current assistant turn.
  const finalizeStreaming = useCallback(
    () =>
      patchLastAssistant((m) => ({
        ...m,
        segments: (m.segments ?? []).map((s) =>
          s.kind === "tool" ? s : { ...s, streaming: false },
        ),
      })),
    [patchLastAssistant],
  );

  const streamHandlers = useCallback(
    (threadId: string) => ({
      // Thinking: extend the open thinking block, or start a new one.
      onReasoning: (text: string) =>
        patchSegments((segs) => {
          const last = segs[segs.length - 1];
          if (last && last.kind === "thinking" && last.streaming) {
            return [...segs.slice(0, -1), { ...last, text: last.text + text }];
          }
          return [...segs, { kind: "thinking", text, streaming: true }];
        }),
      onReasoningDone: () =>
        patchSegments((segs) => {
          const last = segs[segs.length - 1];
          if (last && last.kind === "thinking" && last.streaming) {
            return [...segs.slice(0, -1), { ...last, streaming: false }];
          }
          return segs;
        }),
      // Tool step: appended in place in the timeline.
      onTool: (name: string, summary: string, ok: boolean) =>
        patchSegments((segs) => [...segs, { kind: "tool", name, summary, ok }]),
      // Answer: extend the open text block, or start a new one.
      onDelta: (text: string) =>
        patchSegments((segs) => {
          const last = segs[segs.length - 1];
          if (last && last.kind === "text" && last.streaming) {
            return [...segs.slice(0, -1), { ...last, text: last.text + text }];
          }
          return [...segs, { kind: "text", text, streaming: true }];
        }),
      onProposal: (action: PendingAction) =>
        patchLastAssistant((m) => ({ ...m, pending: action })),
      // Paused for approval: keep the live timeline + the proposal card.
      onAwaitingApproval: () => finalizeStreaming(),
      onError: (msg: string) => setError(msg),
      // Completed turn: stop cursors, keep the timeline, refresh the sidebar (title).
      onDone: () => {
        finalizeStreaming();
        void refreshThreads();
      },
    }),
    [patchSegments, patchLastAssistant, finalizeStreaming, refreshThreads],
  );

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || streaming || !model) return;
    setInput("");
    setError(null);

    let threadId = activeId;
    if (!threadId) {
      const { data, error: createErr } = await createChatThreadAction(model);
      if (!data) {
        setError(createErr ?? t("createError"));
        return;
      }
      threadId = data.id;
      setActiveId(threadId);
      setThreads((prev) => [data, ...prev]);
    }

    const now = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      { id: `u-${now}`, role: "user", content, createdAt: now },
      { id: `a-${now}`, role: "assistant", content: "", model, createdAt: now, segments: [] },
    ]);

    await send(threadId, content, model, streamHandlers(threadId));
  }, [input, streaming, model, activeId, send, streamHandlers, t]);

  const resolveAction = useCallback(
    async (actionId: string, kind: "approve" | "reject") => {
      if (!activeId) return;
      const tid = activeId;
      // Clear the approval card on the proposing message.
      patchLastAssistant((m) =>
        m.pending?.id === actionId ? { ...m, pending: null } : m,
      );
      if (kind === "approve") {
        // The backend executes the action then RE-ENTERS the loop: stream the
        // continuation into a fresh assistant turn (it confirms on success, or
        // recovers, possibly proposing a corrected action, on failure).
        const now = new Date().toISOString();
        setMessages((prev) => [
          ...prev,
          { id: `a-${now}`, role: "assistant", content: "", model, createdAt: now, segments: [] },
        ]);
        await approve(tid, actionId, streamHandlers(tid));
      } else {
        await reject(tid, actionId, {
          onError: (msg) => setError(msg),
          onDone: () => void reloadThread(tid),
        });
      }
    },
    [activeId, approve, reject, patchLastAssistant, streamHandlers, reloadThread, model],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  const tTools = useTranslations("aiChatPage.tools");
  const toolLabel = useCallback(
    (name: string) => (KNOWN_TOOLS.has(name) ? tTools(name) : name.replace(/_/g, " ")),
    [tTools],
  );

  const labels: BubbleLabels = {
    thinking: t("thinking"),
    thinkingLive: t("thinkingLive"),
    generatingResponse: t("generatingResponse"),
    approvalHint: t("approvalHint"),
    approve: t("approve"),
    reject: t("reject"),
    toolFailed: t("toolFailed"),
    toolLabel,
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="-m-3 flex h-[calc(100dvh-3rem)] overflow-hidden border-y border-border bg-card sm:-m-6 sm:h-[calc(100dvh-3rem)]">
      {/* Thread sidebar */}
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-border bg-mist/30 md:flex">
        <div className="p-3">
          <button
            type="button"
            onClick={newChat}
            className="flex w-full items-center justify-center gap-2 rounded-[--radius] bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
          >
            <Plus weight="bold" className="h-4 w-4" />
            {t("newChat")}
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {threads.map((thread) => (
            <div
              key={thread.id}
              className={cn(
                "group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                activeId === thread.id
                  ? "bg-muted text-lamp-ink"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <button
                type="button"
                onClick={() => selectThread(thread.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <ChatCircle
                  weight="fill"
                  className="h-4 w-4 flex-shrink-0 opacity-60"
                />
                <span className="truncate">{thread.title || t("untitled")}</span>
              </button>
              <button
                type="button"
                onClick={() => removeThread(thread.id)}
                className="flex-shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                aria-label={t("deleteConversation")}
              >
                <TrashSimple className="h-4 w-4" />
              </button>
            </div>
          ))}
          {threads.length === 0 ? (
            <p className="px-2.5 py-6 text-center text-xs text-muted-foreground">
              {t("noConversations")}
            </p>
          ) : null}
        </div>
      </aside>

      {/* Conversation */}
      <section className="relative flex min-w-0 flex-1 flex-col bg-card">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-6"
        >
          {isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-[--radius] bg-primary text-white">
                <Brain weight="fill" className="h-6 w-6" />
              </span>
              <h2 className="text-lg font-semibold text-foreground">
                {t("emptyTitle")}
              </h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                {t("emptyDescription")}
              </p>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  streaming={streaming}
                  onApprove={(id) => void resolveAction(id, "approve")}
                  onReject={(id) => void resolveAction(id, "reject")}
                  labels={labels}
                />
              ))}
              {loadingThread ? (
                <p className="text-center text-sm text-muted-foreground">
                  {t("loading")}
                </p>
              ) : null}
            </div>
          )}
        </div>

        {error ? (
          <div className="mx-4 mb-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        ) : null}

        {/* Composer */}
        <div className="relative border-t border-border p-3">
          {showScrollDown ? (
            <button
              type="button"
              onClick={scrollToBottom}
              className="absolute -top-12 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md transition-colors hover:bg-muted"
              aria-label={t("scrollToBottom")}
            >
              <CaretDown weight="bold" className="h-4 w-4" />
            </button>
          ) : null}
          <div className="mx-auto max-w-3xl">
            <div className="mb-2 w-full sm:w-72">
              <AIModelSelector
                label={t("modelLabel")}
                value={model}
                onValueChange={onModelChange}
                models={models}
                modelPricing={pricing}
                disabled={streaming}
              />
            </div>
            <div className="flex items-end gap-2 rounded-[--radius] border border-border bg-background p-2 focus-within:border-primary/40">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder={t("inputPlaceholder")}
                className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              {streaming ? (
                <button
                  type="button"
                  onClick={stop}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[--radius] bg-muted text-foreground transition-colors hover:bg-muted"
                  aria-label={t("stop")}
                >
                  <Stop weight="fill" className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim() || !model}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[--radius] bg-primary text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={t("send")}
                >
                  <PaperPlaneTilt weight="fill" className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function MessageBubble({
  message,
  streaming,
  onApprove,
  onReject,
  labels,
}: {
  message: UIMessage;
  streaming: boolean;
  onApprove: (actionId: string) => void;
  onReject: (actionId: string) => void;
  labels: BubbleLabels;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-[--radius] rounded-br-md bg-primary px-4 py-2.5 text-sm text-white">
          {message.content}
        </div>
      </div>
    );
  }

  const segs = message.segments ?? [];
  const hasSegs = segs.length > 0;
  const isStreamingThis = streaming && !hasSegs && !message.content && !message.pending;

  return (
    <div className="flex gap-3">
      {message.model ? (
        <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
          <ModelBrandIcon modelId={message.model} size={15} />
        </span>
      ) : (
        <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-white">
          <Brain weight="fill" className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-2 pt-0.5">
        {hasSegs ? (
          segs.map((seg, i) => <SegmentView key={i} seg={seg} labels={labels} />)
        ) : message.content ? (
          <ChatMarkdown content={message.content} />
        ) : isStreamingThis ? (
          <TypingDots label={labels.generatingResponse} />
        ) : null}
        {message.pending ? (
          <ApprovalCard
            pending={message.pending}
            onApprove={onApprove}
            onReject={onReject}
            labels={labels}
          />
        ) : null}
      </div>
    </div>
  );
}

function SegmentView({ seg, labels }: { seg: Segment; labels: BubbleLabels }) {
  if (seg.kind === "thinking") {
    return <ThinkingBlock text={seg.text} streaming={seg.streaming} labels={labels} />;
  }
  if (seg.kind === "tool") {
    return (
      <ToolLine name={seg.name} summary={seg.summary} ok={seg.ok} labels={labels} />
    );
  }
  return (
    <div className="text-sm">
      <ChatMarkdown content={seg.text} />
      {seg.streaming ? <Cursor /> : null}
    </div>
  );
}

function ThinkingBlock({
  text,
  streaming,
  labels,
}: {
  text: string;
  streaming?: boolean;
  labels: BubbleLabels;
}) {
  // Follow the stream: open while thinking, auto-collapse when done, unless the
  // user explicitly toggles it (then their choice sticks).
  const [userToggled, setUserToggled] = useState<boolean | null>(null);
  const open = userToggled ?? !!streaming;
  return (
    <div className="rounded-lg border border-border bg-muted">
      <button
        type="button"
        onClick={() => setUserToggled(!open)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium italic text-muted-foreground"
      >
        <Brain weight="duotone" className="h-3.5 w-3.5" />
        <span>{streaming ? labels.thinkingLive : labels.thinking}</span>
        <CaretRight
          weight="bold"
          className={cn("h-3 w-3 transition-transform", open && "rotate-90")}
        />
      </button>
      {open ? (
        <div className="ml-2 whitespace-pre-wrap border-l-2 border-border px-2.5 pb-2 pl-3 text-xs italic leading-relaxed text-muted-foreground/80">
          {text}
          {streaming ? <Cursor /> : null}
        </div>
      ) : null}
    </div>
  );
}

function ToolLine({
  name,
  summary,
  ok,
  labels,
}: {
  name: string;
  summary: string;
  ok: boolean;
  labels: BubbleLabels;
}) {
  const TileIcon = TOOL_ICON[name] ?? Wrench;
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs",
        ok ? "text-muted-foreground" : "text-danger",
      )}
    >
      <TileIcon weight="bold" className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="flex-shrink-0">{labels.toolLabel(name)}</span>
      {summary ? (
        <span className="truncate opacity-80">· {summary}</span>
      ) : ok ? null : (
        <span className="opacity-80">· {labels.toolFailed}</span>
      )}
    </div>
  );
}

function ApprovalCard({
  pending,
  onApprove,
  onReject,
  labels,
}: {
  pending: PendingAction;
  onApprove: (actionId: string) => void;
  onReject: (actionId: string) => void;
  labels: BubbleLabels;
}) {
  const [busy, setBusy] = useState<null | "approve" | "reject">(null);
  const TileIcon = TOOL_ICON[pending.toolName] ?? Wrench;
  return (
    <div className="rounded-[--radius] border border-primary/25 bg-primary/[0.04] p-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-white">
          <TileIcon weight="bold" className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-foreground">
            {labels.toolLabel(pending.toolName)}
          </p>
          {pending.summary ? (
            <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
              {pending.summary}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2.5 border-t border-primary/15 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <span className="text-xs font-medium text-lamp-ink">{labels.approvalHint}</span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              setBusy("reject");
              onReject(pending.id);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {busy === "reject" ? (
              <CircleNotch weight="bold" className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            {labels.reject}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              setBusy("approve");
              onApprove(pending.id);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {busy === "approve" ? (
              <CircleNotch weight="bold" className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            {labels.approve}
          </button>
        </div>
      </div>
    </div>
  );
}

function Cursor() {
  return (
    <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-muted-foreground/50 align-middle" />
  );
}

function TypingDots({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 py-2" aria-label={label}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}
