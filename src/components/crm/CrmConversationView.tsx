"use client";

import type {
  ActiveConversation,
  ConversationMessage,
  EntryTemplateInfo,
  EntryType,
  InboxEntryLabel,
  Label,
  MediaType,
  Stage,
  TemplateMessageMetadata,
} from "@/lib/conversations/types";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowBendUpLeft,
  ArrowDown,
  ArrowUp,
  Bookmark,
  CaretDown,
  ChatText,
  Check,
  CheckCircle,
  Checks,
  DownloadSimple,
  File as FileIcon,
  Hash,
  Image as ImageIcon,
  Info,
  MagnifyingGlass,
  Pause,
  Phone,
  InstagramLogo,
  PhoneCall,
  Play,
  SpeakerHigh,
  Spinner,
  Tag as TagIcon,
  User,
  Warning as WarningIcon,
  WhatsappLogo,
  Wrench,
  X,
} from "@/components/icons";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { AgentToolDefinition } from "@/lib/agents/types";
import ConversationAnalysisPanel from "@/components/crm/ConversationAnalysisPanel";
import DocumentPreview from "./DocumentPreview";
import FormattedMessageText from "@/components/ui/formatted-message-text";
import TemplateBubble from "@/components/crm/TemplateBubble";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { cn } from "@/lib/utils";
import { getAgentToolsAction } from "@/app/actions/agents";
import { getConversationMediaAction } from "@/app/actions/conversations";
import { useTranslations } from "next-intl";


function formatMessageTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateGroup(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate || "-";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hoje";
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function groupMessagesByDate(messages: ConversationMessage[]) {
  const groups: { date: string; messages: ConversationMessage[] }[] = [];
  let currentDate = "";

  for (const msg of messages) {
    const parsed = new Date(msg.created_at);
    const dateStr = Number.isNaN(parsed.getTime())
      ? (msg.created_at ?? "unknown")
      : parsed.toDateString();
    if (dateStr !== currentDate) {
      currentDate = dateStr;
      groups.push({ date: msg.created_at, messages: [msg] });
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }

  return groups;
}

function groupMessagesByChannel(messages: ConversationMessage[]) {
  const runs: { channel: string; messages: ConversationMessage[] }[] = [];
  for (const msg of messages) {
    const msgType =
      msg.message_type ??
      (msg as unknown as { messageType?: string }).messageType;
    if (msgType === "system") {
      runs.push({ channel: "__system__", messages: [msg] });
      continue;
    }
    const ch =
      msg.channel ?? (msg as unknown as { channel?: string }).channel ?? "";
    if (
      runs.length === 0 ||
      runs[runs.length - 1].channel !== ch ||
      runs[runs.length - 1].channel === "__system__"
    ) {
      runs.push({ channel: ch, messages: [msg] });
    } else {
      runs[runs.length - 1].messages.push(msg);
    }
  }
  return runs;
}

type ToolEventKind = "call" | "result";

interface ToolEventInfo {
  kind: ToolEventKind;
  toolName?: string;
  title: string;
  subtitle: string;
  detail: string;
  raw: string;
}

type ToolDefinitionByName = Map<string, AgentToolDefinition>;

function getMessageType(msg: ConversationMessage): string | undefined {
  return (
    msg.message_type ?? (msg as unknown as { messageType?: string }).messageType
  );
}

function getToolEventKind(
  messageType: string | undefined,
  text?: string,
): ToolEventKind | null {
  const trimmedText = text?.trim() ?? "";
  if (messageType === "tool_call" || trimmedText.startsWith("[Tool Call]")) {
    return "call";
  }
  if (
    messageType === "tool_result" ||
    trimmedText.startsWith("[Tool Result]")
  ) {
    return "result";
  }
  return null;
}

function isToolMessage(msg: ConversationMessage | null | undefined): boolean {
  if (!msg) return false;
  return getToolEventKind(getMessageType(msg), msg.text) !== null;
}

function stripToolPrefix(text: string): string {
  return text.replace(/^\[Tool (?:Call|Result)\]\s*/i, "").trim();
}

function humanizeIdentifier(value?: string): string {
  const normalized = value?.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return "Ferramenta";
  return normalized.replace(/^./, (char) => char.toUpperCase());
}

function getToolDisplayName(
  toolName: string | undefined,
  toolDefinitions: ToolDefinitionByName,
): string {
  if (!toolName) return "Ferramenta";
  const definition = toolDefinitions.get(toolName);
  return definition?.displayName?.trim() || humanizeIdentifier(toolName);
}

function truncateText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function cleanToolValue(value: string): string {
  return value
    .replace(/\\"/g, '"')
    .replace(/^map\[/, "")
    .replace(/\]$/, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
}

function formatToolValue(value: string): string {
  const cleaned = cleanToolValue(value);
  if (!cleaned) return "";
  if (/^https?:\/\//i.test(cleaned)) return truncateText(cleaned, 64);
  if (/^[a-f0-9-]{16,}$/i.test(cleaned)) return truncateText(cleaned, 18);
  return truncateText(cleaned, 72);
}

function parseToolMessageBody(kind: ToolEventKind, text: string) {
  const body = stripToolPrefix(text);

  if (kind === "call") {
    const match = body.match(/^([a-zA-Z0-9_.-]+)(?::|\s|$)\s*([\s\S]*)$/);
    return {
      toolName: match?.[1],
      payload: match?.[2]?.trim() ?? "",
      body,
    };
  }

  const resultWithToolName = body.match(/^([a-zA-Z0-9_.-]+)\s*:\s*([\s\S]*)$/);
  return {
    toolName: resultWithToolName?.[1],
    payload: resultWithToolName?.[2]?.trim() ?? body,
    body,
  };
}

function parseToolArguments(payload: string): Record<string, string> {
  const trimmedPayload = payload.trim();
  if (!trimmedPayload) return {};

  if (trimmedPayload.startsWith("{") && trimmedPayload.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmedPayload) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return Object.entries(parsed as Record<string, unknown>).reduce<
          Record<string, string>
        >((acc, [key, value]) => {
          if (value === null || value === undefined) return acc;
          acc[key] =
            typeof value === "string" ? value : JSON.stringify(value, null, 0);
          return acc;
        }, {});
      }
    } catch {
      // Tool calls are often persisted in Go's map[...] format.
    }
  }

  const mapBody = cleanToolValue(trimmedPayload).replace(/^map\[/, "");
  const entries = [
    ...mapBody.matchAll(
      /(?:^|\s)([a-zA-Z0-9_.-]+):([\s\S]*?)(?=\s+[a-zA-Z0-9_.-]+:|$)/g,
    ),
  ];

  return entries.reduce<Record<string, string>>((acc, match) => {
    const key = match[1]?.trim();
    const value = cleanToolValue(match[2] ?? "");
    if (!key || !value) return acc;
    acc[key] = value;
    return acc;
  }, {});
}

function isTechnicalArgumentKey(key: string): boolean {
  return (
    key.startsWith("__") ||
    key === "id" ||
    key.endsWith("_id") ||
    key.endsWith("Id") ||
    key.includes("token") ||
    key.includes("secret")
  );
}

function getParameterDisplayName(
  definition: AgentToolDefinition | undefined,
  key: string,
): string {
  return (
    definition?.parameters?.[key]?.displayName?.trim() ||
    humanizeIdentifier(key)
  );
}

function summarizeToolCall(
  definition: AgentToolDefinition | undefined,
  payload: string,
) {
  const parsedArguments = parseToolArguments(payload);
  const argumentEntries = Object.entries(parsedArguments);

  if (argumentEntries.length) {
    const orderedKeys = [
      ...Object.keys(definition?.parameters ?? {}).filter(
        (key) => parsedArguments[key],
      ),
      ...Object.keys(parsedArguments).filter(
        (key) => !(key in (definition?.parameters ?? {})),
      ),
    ];

    const visibleKeys = orderedKeys.filter(
      (key) => !isTechnicalArgumentKey(key),
    );
    const keysToRender = (visibleKeys.length ? visibleKeys : orderedKeys).slice(
      0,
      2,
    );
    if (keysToRender.length) {
      return keysToRender
        .map(
          (key) =>
            `${getParameterDisplayName(definition, key)}: ${formatToolValue(
              parsedArguments[key],
            )}`,
        )
        .join(" · ");
    }
  }

  const cleanedPayload = truncateText(cleanToolValue(payload), 120);
  return cleanedPayload || "Executando ação automatizada";
}

function summarizeToolResult(payload: string): string {
  const cleaned = cleanToolValue(payload);
  if (!cleaned) return "Execução concluída";

  const imageSentMatch = cleaned.match(/image sent successfully to\s+(\d+)/i);
  if (imageSentMatch?.[1]) {
    return `Imagem enviada para ${imageSentMatch[1]}`;
  }

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (parsed && typeof parsed === "object") {
      const resultObject = parsed as Record<string, unknown>;
      const readableField = [
        resultObject.message,
        resultObject.status,
        resultObject.result,
        resultObject.error,
      ].find((value): value is string => typeof value === "string");
      if (readableField)
        return truncateText(cleanToolValue(readableField), 120);
    }
  } catch {
    // Result text is commonly plain language instead of JSON.
  }

  return truncateText(cleaned, 120);
}

function getToolEventInfo(
  msg: ConversationMessage,
  toolDefinitions: ToolDefinitionByName,
  relatedToolName?: string,
): ToolEventInfo | null {
  const kind = getToolEventKind(getMessageType(msg), msg.text);
  if (!kind) return null;

  const raw = msg.text ?? "";
  const parsed = parseToolMessageBody(kind, raw);
  const toolName = parsed.toolName ?? relatedToolName;
  const definition = toolName ? toolDefinitions.get(toolName) : undefined;
  const displayName = getToolDisplayName(toolName, toolDefinitions);
  const detail =
    kind === "call"
      ? summarizeToolCall(definition, parsed.payload)
      : summarizeToolResult(parsed.payload);

  return {
    kind,
    toolName,
    title: kind === "call" ? displayName : "Resultado",
    subtitle: kind === "call" ? "Ação do agente" : "Retorno da ação",
    detail,
    raw,
  };
}


const MESSAGE_COLLAPSE_LIMIT = 500;

function CollapsibleMessageText({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldCollapse = text.length > MESSAGE_COLLAPSE_LIMIT;

  if (!shouldCollapse) {
    return (
      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
        <FormattedMessageText>{text}</FormattedMessageText>
      </p>
    );
  }

  const displayedText = isExpanded
    ? text
    : text.slice(0, MESSAGE_COLLAPSE_LIMIT).trimEnd() + "...";

  return (
    <div className="text-sm leading-relaxed">
      <p className="whitespace-pre-wrap break-words">
        <FormattedMessageText>{displayedText}</FormattedMessageText>
      </p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className="mt-1 text-[12px] font-medium text-primary-ink hover:text-primary-ink hover:underline transition-colors"
      >
        {isExpanded ? "Ler menos" : "Ler mais"}
      </button>
    </div>
  );
}



function useMediaUrl(
  url?: string,
  mediaId?: string,
  entryType?: EntryType,
  entryId?: string,
) {
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!url && !!mediaId);
  const [error, setError] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (url || !mediaId || !entryType || !entryId || fetchedRef.current) return;
    fetchedRef.current = true;

    getConversationMediaAction(entryType, entryId, mediaId)
      .then((media) => {
        if (media?.url) setFetchedUrl(media.url);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [mediaId, url, entryType, entryId]);

  return { mediaUrl: url || fetchedUrl, loading, error };
}

function DownloadButton({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full bg-black/40 transition-colors hover:bg-black/60",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
      aria-label="Download"
    >
      <DownloadSimple weight="bold" className="h-3.5 w-3.5" />
    </a>
  );
}

// A stable pseudo-waveform (deterministic bar heights), the WhatsApp voice-note
// look without decoding the audio. Fills with the accent up to the play progress.
const WAVEFORM_BARS = Array.from({ length: 32 }, (_, i) =>
  0.35 + 0.65 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)),
);

function AudioPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const cycleSpeed = useCallback(() => {
    setSpeed((prev) => {
      const next = prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1;
      if (audioRef.current) audioRef.current.playbackRate = next;
      return next;
    });
  }, []);

  const formatTime = (s: number) => {
    if (!s || !Number.isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  }, [isPlaying]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = progressBarRef.current;
      const audio = audioRef.current;
      if (!bar || !audio || !duration) return;
      const rect = bar.getBoundingClientRect();
      const pct = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      );
      audio.currentTime = pct * duration;
    },
    [duration],
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    };
    const onLoaded = () => setDuration(audio.duration);

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("durationchange", onLoaded);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("durationchange", onLoaded);
    };
  }, []);

  const played = Math.round(progress * WAVEFORM_BARS.length);

  return (
    <div className="flex items-center gap-2.5 rounded-[--radius] bg-muted px-3 py-2 mb-1 min-w-[220px] max-w-[300px]">
      {/* Hidden native audio element */}
      <audio ref={audioRef} src={url} preload="metadata">
        <track kind="captions" />
      </audio>

      {/* Play/Pause button */}
      <button
        type="button"
        onClick={togglePlay}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105 active:scale-95"
      >
        {isPlaying ? (
          <Pause weight="fill" className="h-4 w-4" />
        ) : (
          <Play weight="fill" className="h-4 w-4 ml-0.5" />
        )}
      </button>

      {/* Waveform (seekable) + time */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div
          ref={progressBarRef}
          onClick={handleSeek}
          className="flex h-6 cursor-pointer items-center gap-[2px]"
        >
          {WAVEFORM_BARS.map((h, i) => (
            <span
              key={i}
              className={cn(
                "w-[2px] flex-1 rounded-full transition-colors",
                i < played ? "bg-primary" : "bg-muted-foreground/30",
              )}
              style={{ height: `${Math.round(h * 100)}%` }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
            {formatTime(isPlaying || currentTime ? currentTime : duration)}
          </span>
          <button
            type="button"
            onClick={cycleSpeed}
            className="rounded-[--radius] bg-card px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground shadow-sm transition-colors hover:text-foreground"
            aria-label="Velocidade de reprodução"
          >
            {speed}×
          </button>
        </div>
      </div>

      {/* Download */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        download
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary-ink"
        onClick={(e) => e.stopPropagation()}
        aria-label="Download audio"
      >
        <DownloadSimple weight="bold" className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      {/* Top-right controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          download
          onClick={(e) => e.stopPropagation()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          aria-label="Download"
        >
          <DownloadSimple weight="bold" className="h-5 w-5" />
        </a>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          aria-label="Fechar"
        >
          <X weight="bold" className="h-5 w-5" />
        </button>
      </div>

      <motion.img
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        src={src}
        alt={alt}
        className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </motion.div>
  );
}

function MediaBubble({
  type,
  url,
  mediaId,
  entryType,
  entryId,
  text,
}: {
  type?: MediaType;
  url?: string;
  mediaId?: string;
  entryType?: EntryType;
  entryId?: string;
  text?: string;
}) {
  const { mediaUrl, loading, error } = useMediaUrl(
    url,
    mediaId,
    entryType,
    entryId,
  );
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [documentPreviewOpened, setDocumentPreviewOpened] = useState(false);

  if (!type) return null;
  if (!mediaUrl && !mediaId) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-[--radius] bg-muted px-3 py-2.5 mb-1 min-w-[160px]">
        <Spinner className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          Carregando mídia...
        </span>
      </div>
    );
  }

  if (error || (!mediaUrl && !loading)) {
    return (
      <div className="flex items-center gap-2 rounded-[--radius] bg-muted px-3 py-2.5 mb-1 min-w-[160px]">
        {type === "image" && (
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        )}
        {type === "audio" && (
          <SpeakerHigh className="h-4 w-4 text-muted-foreground" />
        )}
        {type === "video" && <Play className="h-4 w-4 text-muted-foreground" />}
        {type === "document" && (
          <FileIcon className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-xs text-muted-foreground">
          Mídia não disponível
        </span>
      </div>
    );
  }

  const resolvedUrl = mediaUrl!;

  switch (type) {
    case "image":
      return (
        <>
          <div className="group relative mb-1 w-fit cursor-pointer overflow-hidden rounded-[--radius]">
            {/* Download button overlay */}
            <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              <DownloadButton url={resolvedUrl} />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolvedUrl}
              alt={text || "Imagem"}
              className="block h-auto max-h-[360px] w-auto max-w-[280px] rounded-[--radius] object-contain"
              loading="lazy"
              onClick={() => setLightboxOpen(true)}
            />
          </div>

          {/* Fullscreen lightbox */}
          <AnimatePresence>
            {lightboxOpen && (
              <ImageLightbox
                src={resolvedUrl}
                alt={text || "Imagem"}
                onClose={() => setLightboxOpen(false)}
              />
            )}
          </AnimatePresence>
        </>
      );

    case "video":
      return (
        <div className="group relative mb-1 w-fit overflow-hidden rounded-[--radius]">
          {/* Download button overlay */}
          <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <DownloadButton url={resolvedUrl} />
          </div>
          <video
            src={resolvedUrl}
            controls
            className="block h-auto max-h-[300px] w-auto max-w-[280px] rounded-[--radius]"
            preload="metadata"
          />
        </div>
      );

    case "audio":
      return <AudioPlayer url={resolvedUrl} />;

    case "document": {
      const fileName = text?.trim() || "Documento";
      const ext = (resolvedUrl.split("?")[0].split(".").pop() || "")
        .toUpperCase()
        .slice(0, 4);
      return (
        <div
          onClick={() => setDocumentPreviewOpened((prev) => !prev)}
          className="mb-1 flex min-w-[220px] max-w-[300px] cursor-pointer items-center gap-3 rounded-[--radius] bg-muted px-3 py-2.5 transition-colors hover:bg-border/70"
        >
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileIcon weight="fill" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">
              {fileName}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {ext ? `${ext} · ` : ""}Toque para abrir
            </p>
          </div>
          <DownloadSimple
            weight="bold"
            className="h-4 w-4 flex-shrink-0 text-muted-foreground"
          />
          <DocumentPreview
            previewDocumentUrl={resolvedUrl}
            open={documentPreviewOpened}
            setOpen={setDocumentPreviewOpened}
          />
        </div>
      );
    }

    case "sticker":
      return (
        <div className="mb-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolvedUrl}
            alt="Sticker"
            className="max-w-[160px] max-h-[160px] object-contain"
            loading="lazy"
          />
        </div>
      );

    default:
      return null;
  }
}


function ReadReceipt({
  read,
  deliveryStatus,
}: {
  read: boolean;
  deliveryStatus?: string;
}) {
  if (deliveryStatus) {
    switch (deliveryStatus) {
      case "failed":
        return (
          <WarningIcon
            weight="fill"
            className="h-3.5 w-3.5 flex-shrink-0 text-destructive-ink"
          />
        );
      case "read":
        return (
          <Checks
            weight="bold"
            className="h-3.5 w-3.5 flex-shrink-0 text-[#53bdeb]"
          />
        );
      case "delivered":
        return (
          <Checks
            weight="bold"
            className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
          />
        );
      case "sent":
        return (
          <Check
            weight="bold"
            className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
          />
        );
      default:
        return (
          <Check
            weight="bold"
            className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
          />
        );
    }
  }

  return (
    <Checks
      weight="bold"
      className={cn(
        "h-3.5 w-3.5 flex-shrink-0",
        read ? "text-[#53bdeb]" : "text-muted-foreground",
      )}
    />
  );
}


// Placeholder thread shown while a conversation's first message batch loads.
// It mirrors the real message layout (same container, same bubble geometry and
// alignment) so swapping in the real messages causes no layout shift, only a
// crossfade. Reduced-motion users get a static placeholder.
const SKELETON_BUBBLES: { side: "in" | "out"; width: string; height: string }[] =
  [
    { side: "in", width: "44%", height: "2.25rem" },
    { side: "in", width: "62%", height: "3.5rem" },
    { side: "out", width: "52%", height: "2.25rem" },
    { side: "out", width: "36%", height: "2.25rem" },
    { side: "in", width: "68%", height: "4.75rem" },
    { side: "out", width: "46%", height: "2.75rem" },
    { side: "in", width: "50%", height: "2.25rem" },
    { side: "out", width: "40%", height: "2.25rem" },
  ];

function ConversationThreadSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="space-y-2 pt-3"
      aria-hidden="true"
    >
      {/* Date-pill placeholder to match the real date separator */}
      <div className="flex justify-center py-3">
        <div className="h-5 w-24 rounded-lg bg-black/[0.06] dark:bg-white/[0.07] animate-pulse motion-reduce:animate-none" />
      </div>

      {SKELETON_BUBBLES.map((bubble, i) => {
        const isOut = bubble.side === "out";
        return (
          <div
            key={i}
            className={cn("flex px-1", isOut ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "rounded-[--radius] animate-pulse motion-reduce:animate-none",
                isOut
                  ? "rounded-tr-md bg-black/[0.05] dark:bg-white/[0.10]"
                  : "rounded-tl-md bg-white/70 dark:bg-white/[0.06]",
              )}
              style={{
                width: bubble.width,
                height: bubble.height,
                animationDelay: `${i * 90}ms`,
              }}
            />
          </div>
        );
      })}
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <div className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-2 w-2 rounded-full bg-muted"
            animate={{ y: [0, -4, 0] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
            }}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground ml-1">digitando...</span>
    </div>
  );
}

function ToolEventRow({
  info,
  createdAt,
  hasResultBelow,
  isMatched,
  isCurrentMatch,
}: {
  info: ToolEventInfo;
  createdAt: string;
  hasResultBelow: boolean;
  isMatched: boolean;
  isCurrentMatch: boolean;
}) {
  const isResult = info.kind === "result";
  const [expanded, setExpanded] = useState(false);
  const iconGradient = isResult
    ? "ink-3"
    : "ink-3";
  const ringTone = isResult ? "ring-warning/20" : "ring-warning/20";

  const hasDetail = Boolean(info.detail);

  return (
    <div className="flex w-full flex-col items-center px-4 py-0.5">
      <motion.button
        type="button"
        onClick={() => hasDetail && setExpanded((v) => !v)}
        initial={{ opacity: 0, y: 2 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        title={info.raw}
        aria-expanded={expanded}
        className={cn(
          "group inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card py-0.5 pl-0.5 pr-2",
          "ring-1 ring-inset transition-colors",
          ringTone,
          hasDetail ? "cursor-pointer hover:bg-muted" : "cursor-default",
          isMatched && "ring-2 ring-warning ring-offset-1",
          isCurrentMatch && "ring-2 ring-healthy ring-offset-2",
        )}
      >
        <span
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gradient-to-br",
            iconGradient,
          )}
        >
          {isResult ? (
            <CheckCircle weight="fill" className="h-2.5 w-2.5" />
          ) : (
            <Wrench weight="bold" className="h-2.5 w-2.5" />
          )}
        </span>
        <span className="min-w-0 max-w-[220px] truncate text-[11px] font-medium leading-none text-foreground">
          {info.title}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums leading-none text-muted-foreground/70">
          {formatMessageTime(createdAt)}
        </span>
        {hasDetail && (
          <CaretDown
            weight="bold"
            className={cn(
              "h-2.5 w-2.5 shrink-0 text-muted-foreground/70 transition-transform",
              expanded && "rotate-180",
            )}
          />
        )}
      </motion.button>
      <AnimatePresence initial={false}>
        {expanded && hasDetail && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="mt-1 w-full max-w-[80%] overflow-hidden"
          >
            <div className="rounded-md border border-border bg-muted px-2.5 py-1.5">
              <p className="whitespace-pre-wrap break-words text-[11px] leading-snug text-muted-foreground">
                {info.detail}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {hasResultBelow && (
        <div
          className="flex h-2 flex-col items-center justify-center"
          aria-hidden="true"
        >
          <span className="h-full w-px bg-border" />
        </div>
      )}
    </div>
  );
}


function EntryMetadataPanel({
  conversation,
}: {
  conversation: ActiveConversation;
}) {
  const [open, setOpen] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);

  const variables = conversation.entry_variables ?? [];
  const hasVariables = variables.length > 0;
  const templateInfo = conversation.lead_metadata?.template_info as
    | EntryTemplateInfo
    | undefined;

  if (!hasVariables && !templateInfo) return null;

  const templateMetadata: TemplateMessageMetadata | null = templateInfo
    ? {
        template_name: templateInfo.template_name,
        language: templateInfo.language,
        category: templateInfo.category,
        components: templateInfo.components,
        header_media_url: templateInfo.header_media_url,
      }
    : null;

  return (
    <div className="flex justify-center pb-2 pt-1">
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between rounded-[--radius] bg-card px-4 py-2.5 shadow-sm transition-colors hover:bg-card"
        >
          <div className="flex items-center gap-2">
            <Info weight="fill" className="h-4 w-4 text-primary-ink" />
            <span className="text-[12px] font-semibold text-foreground">
              Detalhes do contato
            </span>
          </div>
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <CaretDown
              weight="bold"
              className="h-3.5 w-3.5 text-muted-foreground"
            />
          </motion.div>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="mt-1 rounded-[--radius] bg-card px-4 py-3 shadow-sm space-y-2.5">
                {/* Lead info */}
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
                    <User
                      weight="fill"
                      className="h-3.5 w-3.5 text-muted-foreground"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium  text-muted-foreground">
                      Nome
                    </p>
                    <p className="text-[12px] font-semibold text-foreground truncate">
                      {conversation.lead_name || "—"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
                    <Phone
                      weight="fill"
                      className="h-3.5 w-3.5 text-muted-foreground"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium  text-muted-foreground">
                      Telefone
                    </p>
                    <p className="text-[12px] font-semibold text-foreground truncate">
                      {conversation.lead_number || "—"}
                    </p>
                  </div>
                </div>

                {/* Variables */}
                {hasVariables && (
                  <>
                    <div className="border-t border-border pt-2">
                      <p className="text-[11px] font-medium  text-muted-foreground mb-1.5">
                        Variáveis
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {variables.map((v, i) => (
                          <span
                            key={`${i}-${v}`}
                            className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground"
                          >
                            <Hash
                              weight="bold"
                              className="h-3 w-3 text-info"
                            />
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Template sent */}
                {templateInfo && (
                  <div className="border-t border-border pt-2">
                    <button
                      type="button"
                      onClick={() => setShowTemplate(!showTemplate)}
                      className="flex w-full items-center justify-between rounded-lg bg-healthy/10 px-3 py-2 transition-colors hover:bg-healthy/15"
                    >
                      <div className="flex items-center gap-2">
                        <ChatText
                          weight="fill"
                          className="h-4 w-4 text-healthy"
                        />
                        <span className="text-[11px] font-semibold text-healthy">
                          Template enviado: {templateInfo.template_name}
                        </span>
                      </div>
                      <motion.div
                        animate={{ rotate: showTemplate ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <CaretDown
                          weight="bold"
                          className="h-3 w-3 text-healthy-ink"
                        />
                      </motion.div>
                    </button>

                    <AnimatePresence>
                      {showTemplate && templateMetadata && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 flex justify-center">
                            <TemplateBubble metadata={templateMetadata} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Entry ID (subtle) */}
                <div className="border-t border-border pt-2">
                  <p className="text-[11px] text-muted-foreground font-mono truncate">
                    ID: {conversation.entry_id}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}


interface CrmConversationViewProps {
  conversation: ActiveConversation | null;
  isTyping: boolean;
  onLoadMore?: () => void;
  loadingHistory?: boolean;
  loadingConversation?: boolean;
  translations: {
    noConversationSelected: string;
    noConversationDescription: string;
    loadingMore: string;
    windowClosed: string;
    windowClosedDescription: string;
    noPermissionStageAssign?: string;
  };
  onSearchMessages?: (query: string, page?: number) => void;
  onClearMessageSearch?: () => void;
  messageSearchResults?: ConversationMessage[] | null;
  searchingMessages?: boolean;
  messageSearchTotalItems?: number;
  messageSearchQuery?: string | null;
  scrollToMessageTimestamp?: string | null;
  onScrolledToMessage?: () => void;
  onLoadAround?: (timestamp: string) => void;
  onReply?: (message: ConversationMessage) => void;
  tags?: Stage[];
  currentEntryTags?: { stage_id: string; name: string; color: string }[];
  entryAvailableTags?: { stage_id: string; name: string; color: string }[];
  onEntryStageChange?: (
    entryId: string,
    entryType: EntryType,
    newTagId: string,
    oldTagId: string | null,
  ) => void;
  onAssignStage?: (
    stageId: string,
    entryId: string,
    entryType: EntryType,
  ) => void;
  onRemoveStage?: (
    stageId: string,
    entryId: string,
    entryType: EntryType,
  ) => void;
  availableLabels?: Label[];
  currentEntryLabels?: InboxEntryLabel[];
  onAssignLabel?: (
    labelId: string,
    entryId: string,
    entryType: EntryType,
  ) => void;
  onRemoveLabel?: (
    labelId: string,
    entryId: string,
    entryType: EntryType,
  ) => void;
}

export default function CrmConversationView({
  conversation,
  isTyping,
  onLoadMore,
  loadingHistory = false,
  loadingConversation = false,
  translations: t,
  onSearchMessages,
  onClearMessageSearch,
  messageSearchResults,
  searchingMessages = false,
  messageSearchTotalItems = 0,
  scrollToMessageTimestamp,
  onScrolledToMessage,
  onLoadAround,
  onReply,
  tags = [],
  currentEntryTags = [],
  entryAvailableTags = [],
  onEntryStageChange,
  onAssignStage,
  onRemoveStage,
  availableLabels = [],
  currentEntryLabels = [],
  onAssignLabel,
  onRemoveLabel,
}: CrmConversationViewProps) {
  const tCrm = useTranslations("crm");
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [stageSelectorOpen, setTagSelectorOpen] = useState(false);
  const [labelSelectorOpen, setLabelSelectorOpen] = useState(false);
  const [agentToolDefinitions, setAgentToolDefinitions] = useState<
    AgentToolDefinition[]
  >([]);
  const isAtBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const loadMoreCalledRef = useRef(false);
  const justOpenedRef = useRef(true);

  const scrollLockRef = useRef(false);
  const scrolledToTimestampRef = useRef<string | null>(null);
  const loadAroundAttemptRef = useRef<string | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const matchedIds = new Set(messageSearchResults?.map((m) => m.id) ?? []);
  const hasSearchResults =
    messageSearchResults && messageSearchResults.length > 0;
  const toolDefinitionByName = useMemo<ToolDefinitionByName>(() => {
    return new Map(
      agentToolDefinitions.map((tool): [string, AgentToolDefinition] => [
        tool.name,
        tool,
      ]),
    );
  }, [agentToolDefinitions]);

  useEffect(() => {
    let active = true;

    getAgentToolsAction()
      .then(({ tools }) => {
        if (active) setAgentToolDefinitions(tools ?? []);
      })
      .catch(() => {
        if (active) setAgentToolDefinitions([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleOpenSearch = useCallback(() => {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 80);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchInput("");
    setCurrentMatchIdx(0);
    onClearMessageSearch?.();
  }, [onClearMessageSearch]);

  const handleSearchInput = useCallback(
    (value: string) => {
      setSearchInput(value);
      setCurrentMatchIdx(0);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.trim().length < 2) {
        onClearMessageSearch?.();
        return;
      }
      debounceRef.current = setTimeout(() => {
        onSearchMessages?.(value.trim());
      }, 400);
    },
    [onSearchMessages, onClearMessageSearch],
  );

  const handleNextMatch = useCallback(() => {
    if (!messageSearchResults?.length) return;
    setCurrentMatchIdx((prev) =>
      prev < messageSearchResults.length - 1 ? prev + 1 : 0,
    );
  }, [messageSearchResults]);

  const handlePrevMatch = useCallback(() => {
    if (!messageSearchResults?.length) return;
    setCurrentMatchIdx((prev) =>
      prev > 0 ? prev - 1 : messageSearchResults.length - 1,
    );
  }, [messageSearchResults]);

  useEffect(() => {
    if (!messageSearchResults?.length || !containerRef.current) return;
    const targetMsg = messageSearchResults[currentMatchIdx];
    if (!targetMsg) return;

    requestAnimationFrame(() => {
      const el = containerRef.current?.querySelector(
        `[data-msg-id="${targetMsg.id}"]`,
      );
      if (el) {
        loadAroundAttemptRef.current = null;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-warning", "ring-offset-1");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-warning", "ring-offset-1");
          scrollLockRef.current = false;
        }, 2000);
      } else if (
        targetMsg.created_at &&
        onLoadAround &&
        loadAroundAttemptRef.current !== targetMsg.id
      ) {
        loadAroundAttemptRef.current = targetMsg.id;
        scrollLockRef.current = true;
        onLoadAround(targetMsg.created_at);
      }
    });
  }, [
    currentMatchIdx,
    messageSearchResults,
    onLoadAround,
    conversation?.messages.length,
  ]);

  useEffect(() => {
    setSearchOpen(false);
    setSearchInput("");
    setCurrentMatchIdx(0);
  }, [conversation?.entry_id]);

  useEffect(() => {
    if (scrollToMessageTimestamp) {
      scrollLockRef.current = true;
      scrolledToTimestampRef.current = null; 
    }
  }, [scrollToMessageTimestamp]);

  useEffect(() => {
    if (
      !scrollToMessageTimestamp ||
      !conversation?.messages.length ||
      !containerRef.current
    )
      return;

    if (scrolledToTimestampRef.current === scrollToMessageTimestamp) return;

    const targetMsg = conversation.messages.find(
      (m) => m.created_at === scrollToMessageTimestamp,
    );

    if (targetMsg) {
      scrolledToTimestampRef.current = scrollToMessageTimestamp;
      requestAnimationFrame(() => {
        const el = containerRef.current?.querySelector(
          `[data-msg-id="${targetMsg.id}"]`,
        );
        if (el) {
          el.scrollIntoView({ behavior: "instant", block: "center" });
          el.classList.add("ring-2", "ring-warning", "ring-offset-1");
          setTimeout(() => {
            el.classList.remove("ring-2", "ring-warning", "ring-offset-1");
          }, 2500);
        }
        setTimeout(() => {
          scrollLockRef.current = false;
          onScrolledToMessage?.();
        }, 600);
      });
    } else if (scrollToMessageTimestamp && onLoadAround) {
      onLoadAround(scrollToMessageTimestamp);
    } else if (conversation.has_more && onLoadMore) {
      onLoadMore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    scrollToMessageTimestamp,
    conversation?.messages.length,
    onScrolledToMessage,
  ]);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "instant",
    });
  }, []);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const fromBottom = scrollHeight - scrollTop - clientHeight;
    isAtBottomRef.current = fromBottom < 80;
    setShowScrollDown(fromBottom > 200);

    if (
      scrollTop < 60 &&
      conversation?.has_more &&
      onLoadMore &&
      !loadingHistory &&
      !loadMoreCalledRef.current
    ) {
      loadMoreCalledRef.current = true;
      onLoadMore();
    }
  }, [conversation?.has_more, onLoadMore, loadingHistory]);

  useEffect(() => {
    if (!loadingHistory) {
      loadMoreCalledRef.current = false;
    }
  }, [loadingHistory]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const msgCount = conversation?.messages.length ?? 0;
    const prevCount = prevMessageCountRef.current;

    if (!container) {
      prevMessageCountRef.current = msgCount;
      return;
    }

    if (msgCount > prevCount) {
      if (!isAtBottomRef.current && prevCount > 0) {
        const prevScrollHeight = container.scrollHeight;
        const prevScrollTop = container.scrollTop;
        requestAnimationFrame(() => {
          const newScrollHeight = container.scrollHeight;
          const delta = newScrollHeight - prevScrollHeight;
          container.scrollTop = prevScrollTop + delta;
        });
      } else if (isAtBottomRef.current && !scrollLockRef.current) {
        scrollToBottom(true);
      }
    }
    prevMessageCountRef.current = msgCount;
  }, [conversation?.messages.length, scrollToBottom]);

  useEffect(() => {
    justOpenedRef.current = true;
    prevMessageCountRef.current = 0;
    isAtBottomRef.current = true;
    if (conversation?.messages.length && !scrollLockRef.current) {
      scrollToBottom(false);
      justOpenedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.entry_id]);

  useEffect(() => {
    if (scrollLockRef.current) {
      justOpenedRef.current = false;
      return;
    }
    if (justOpenedRef.current && conversation?.messages.length) {
      requestAnimationFrame(() => {
        if (scrollLockRef.current) {
          justOpenedRef.current = false;
          return;
        }
        scrollToBottom(false);
        justOpenedRef.current = false;
      });
    }
  }, [conversation?.messages.length, scrollToBottom]);

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-muted px-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-[--radius] bg-muted">
          <ImageIcon
            weight="duotone"
            className="h-10 w-10 text-muted-foreground"
          />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {t.noConversationSelected}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t.noConversationDescription}
          </p>
        </div>
      </div>
    );
  }

  const dateGroups = groupMessagesByDate(conversation.messages);

  const currentTagId = currentEntryTags?.[0]?.stage_id ?? null;

  return (
    <div className="relative flex h-full flex-col bg-[#efeae2] dark:bg-[#0b141a]">
      {/* WhatsApp-style background pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Analysis panel */}
      <ConversationAnalysisPanel
        entryId={conversation.entry_id}
        entryType={conversation.entry_type as "voice" | "whatsapp"}
      />

      {/* Floating Tag Selector */}
      {(tags.length > 0 || entryAvailableTags.length > 0) && (
        <div className="absolute left-3 top-3 z-30">
          <div className="relative">
            {onEntryStageChange || onAssignStage ? (
              <motion.button
                onClick={() => setTagSelectorOpen(!stageSelectorOpen)}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-colors",
                  stageSelectorOpen
                    ? "bg-healthy/100 text-healthy-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted",
                )}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title={tags.length > 0 ? "Mover para outra tag" : "Etapas"}
              >
                <TagIcon
                  weight={stageSelectorOpen ? "fill" : "bold"}
                  className="h-5 w-5"
                />
              </motion.button>
            ) : (
              <TooltipWrapper
                content={
                  t.noPermissionStageAssign ??
                  "You don't have permission to assign tags"
                }
                enabled
                side="right"
              >
                <motion.button
                  disabled
                  className="flex h-10 w-10 items-center justify-center rounded-full shadow-lg bg-card text-muted-foreground cursor-not-allowed"
                >
                  <TagIcon weight="bold" className="h-5 w-5" />
                </motion.button>
              </TooltipWrapper>
            )}

            <AnimatePresence>
              {stageSelectorOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setTagSelectorOpen(false)}
                  />
                  {/* Tag list */}
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-full z-40 mt-2 w-48 rounded-[--radius] border border-border bg-card shadow-xl py-1.5 overflow-hidden"
                  >
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground ">
                      {tags.length > 0 ? "Mover para" : "Etapas"}
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {tags.length > 0
                        ? tags.map((tag) => {
                            const isCurrentTag = tag.id === currentTagId;
                            return (
                              <button
                                key={tag.id}
                                onClick={() => {
                                  if (!isCurrentTag && onEntryStageChange) {
                                    onEntryStageChange(
                                      conversation.entry_id,
                                      conversation.entry_type,
                                      tag.id,
                                      currentTagId,
                                    );
                                  }
                                  setTagSelectorOpen(false);
                                }}
                                disabled={isCurrentTag}
                                className={cn(
                                  "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
                                  isCurrentTag
                                    ? "text-muted-foreground cursor-not-allowed bg-muted"
                                    : "text-foreground hover:bg-muted",
                                )}
                              >
                                <span
                                  className="h-3 w-3 rounded-full ring-1 ring-black/10 flex-shrink-0"
                                  style={{ backgroundColor: tag.color }}
                                />
                                <span className="text-xs font-medium truncate flex-1">
                                  {tag.name}
                                </span>
                                {isCurrentTag && (
                                  <span className="text-[11px] text-muted-foreground flex-shrink-0">
                                    atual
                                  </span>
                                )}
                              </button>
                            );
                          })
                        : entryAvailableTags.map((tag) => {
                            const isAssigned = currentEntryTags.some(
                              (et) => et.stage_id === tag.stage_id,
                            );
                            return (
                              <button
                                key={tag.stage_id}
                                onClick={() => {
                                  if (isAssigned && onRemoveStage) {
                                    onRemoveStage(
                                      tag.stage_id,
                                      conversation.entry_id,
                                      conversation.entry_type as EntryType,
                                    );
                                  } else if (!isAssigned && onAssignStage) {
                                    onAssignStage(
                                      tag.stage_id,
                                      conversation.entry_id,
                                      conversation.entry_type as EntryType,
                                    );
                                  }
                                }}
                                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors text-foreground hover:bg-muted"
                              >
                                <span
                                  className="h-3 w-3 rounded-full ring-1 ring-black/10 flex-shrink-0"
                                  style={{ backgroundColor: tag.color }}
                                />
                                <span className="text-xs font-medium truncate flex-1">
                                  {tag.name}
                                </span>
                                {isAssigned && (
                                  <span className="text-[11px] text-healthy flex-shrink-0">
                                    ✓
                                  </span>
                                )}
                              </button>
                            );
                          })}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── Floating Label Selector ──────────────────────────────── */}
      {availableLabels.length > 0 && (
        <div className="absolute left-16 top-3 z-30">
          <div className="relative">
            {onAssignLabel ? (
              <motion.button
                onClick={() => setLabelSelectorOpen(!labelSelectorOpen)}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-colors",
                  labelSelectorOpen
                    ? "bg-muted text-muted-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted",
                )}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Etiquetas"
              >
                <Bookmark
                  weight={labelSelectorOpen ? "fill" : "bold"}
                  className="h-5 w-5"
                />
              </motion.button>
            ) : (
              <TooltipWrapper
                content="Sem permissão para gerenciar etiquetas"
                enabled
                side="right"
              >
                <motion.button
                  disabled
                  className="flex h-10 w-10 items-center justify-center rounded-full shadow-lg bg-card text-muted-foreground cursor-not-allowed"
                >
                  <Bookmark weight="bold" className="h-5 w-5" />
                </motion.button>
              </TooltipWrapper>
            )}

            <AnimatePresence>
              {labelSelectorOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setLabelSelectorOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-full z-40 mt-2 w-48 rounded-[--radius] border border-border bg-card shadow-xl py-1.5 overflow-hidden"
                  >
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground ">
                      Etiquetas
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {availableLabels.map((label) => {
                        const isAssigned = currentEntryLabels.some(
                          (el) => el.label_id === label.id,
                        );
                        return (
                          <button
                            key={label.id}
                            onClick={() => {
                              if (isAssigned && onRemoveLabel) {
                                onRemoveLabel(
                                  label.id,
                                  conversation.entry_id,
                                  conversation.entry_type as EntryType,
                                );
                              } else if (!isAssigned && onAssignLabel) {
                                onAssignLabel(
                                  label.id,
                                  conversation.entry_id,
                                  conversation.entry_type as EntryType,
                                );
                              }
                            }}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors text-foreground hover:bg-muted"
                          >
                            <span
                              className="h-3 w-3 rounded-full ring-1 ring-black/10 flex-shrink-0"
                              style={{
                                backgroundColor: label.color || "#8B5CF6",
                              }}
                            />
                            <span className="text-xs font-medium truncate flex-1">
                              {label.name}
                            </span>
                            {isAssigned && (
                              <span className="text-[11px] text-chart-4 flex-shrink-0">
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── Message Search Bar ──────────────────────────────────── */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative z-[30] overflow-hidden border-b border-border bg-card shadow-sm"
          >
            <div className="flex items-center gap-2 px-3 ">
              <MagnifyingGlass
                weight="bold"
                className="h-4 w-4 text-muted-foreground flex-shrink-0"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchInput}
                onChange={(e) => handleSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") handleCloseSearch();
                  if (e.key === "Enter") {
                    if (e.shiftKey) {
                      handlePrevMatch();
                    } else {
                      handleNextMatch();
                    }
                  }
                }}
                placeholder={tCrm("searchMessagesPlaceholder")}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />

              {/* Search status */}
              {searchingMessages && (
                <motion.div
                  className="h-4 w-4 rounded-full border border-healthy border-t-transparent flex-shrink-0"
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              )}

              {/* Result count + navigation arrows */}
              {searchInput.trim().length >= 2 && !searchingMessages && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                    {messageSearchTotalItems > 0
                      ? `${currentMatchIdx + 1}/${messageSearchTotalItems}`
                      : "0 resultados"}
                  </span>
                  <button
                    onClick={handlePrevMatch}
                    disabled={!hasSearchResults}
                    className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-muted disabled:opacity-30 transition-colors"
                  >
                    <ArrowUp
                      weight="bold"
                      className="h-3.5 w-3.5 text-muted-foreground"
                    />
                  </button>
                  <button
                    onClick={handleNextMatch}
                    disabled={!hasSearchResults}
                    className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-muted disabled:opacity-30 transition-colors"
                  >
                    <ArrowDown
                      weight="bold"
                      className="h-3.5 w-3.5 text-muted-foreground"
                    />
                  </button>
                </div>
              )}

              {/* Close */}
              <button
                onClick={handleCloseSearch}
                className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-muted transition-colors flex-shrink-0"
              >
                <X
                  weight="bold"
                  className="h-3.5 w-3.5 text-muted-foreground"
                />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {onSearchMessages && !searchOpen && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={handleOpenSearch}
          title={tCrm("searchMessages")}
          className="absolute top-4 right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-lg border border-border hover:bg-muted transition-colors"
        >
          <MagnifyingGlass
            weight="bold"
            className="h-4 w-4 text-muted-foreground"
          />
        </motion.button>
      )}

      {/* Messages Area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto px-4 py-4 scroll-smooth"
      >
        <div className="mx-auto max-w-3xl space-y-1">
          {/* Entry metadata panel (collapsible) */}
          <EntryMetadataPanel conversation={conversation} />

          {/* Initial-open placeholder: mirrors the thread layout so messages
              swap in without a layout shift (see ConversationThreadSkeleton). */}
          <AnimatePresence>
            {loadingConversation && conversation.messages.length === 0 && (
              <ConversationThreadSkeleton />
            )}
          </AnimatePresence>

          {/* Loading indicator when fetching older messages */}
          {loadingHistory && (
            <div className="flex items-center justify-center py-3">
              <div className="flex items-center gap-2 rounded-lg bg-card px-4 py-2 shadow-sm">
                <motion.div
                  className="h-4 w-4 rounded-full border border-healthy border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
                <span className="text-[11px] font-medium text-muted-foreground">
                  {t.loadingMore}
                </span>
              </div>
            </div>
          )}
          {dateGroups.map((group, groupIndex) => (
            <div key={`${group.date}-${groupIndex}`}>
              {/* Date separator */}
              <div className="flex items-center justify-center py-3">
                <span className="rounded-lg bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
                  {formatDateGroup(group.date)}
                </span>
              </div>

              {/* Messages grouped by channel runs */}
              {(() => {
                const channelRuns = groupMessagesByChannel(group.messages);

                return channelRuns.map((run, runIdx) => {
                  if (run.channel === "__system__") {
                    return run.messages.map((msg) => (
                      <div key={msg.id} className="flex justify-center py-1">
                        <span className="rounded-lg bg-warning px-3 py-1.5 text-[11px] text-warning-foreground shadow-sm max-w-[80%] text-center">
                          {msg.text}
                        </span>
                      </div>
                    ));
                  }

                  const isVoiceRun = run.channel === "voice";
                  const isWhatsAppRun = run.channel === "whatsapp";
                  const channelColor = isVoiceRun
                    ? "border-info"
                    : isWhatsAppRun
                      ? "border-healthy"
                      : "border-foreground/20";

                  return (
                    <div
                      key={`run-${runIdx}-${run.messages[0]?.id ?? runIdx}`}
                      className={cn(runIdx > 0 && "mt-1")}
                    >
                      {run.messages.map((msg, msgIdx) => {
                        const messageType =
                          msg.message_type ??
                          (msg as unknown as { messageType?: string })
                            .messageType;
                        const createdAt =
                          msg.created_at ??
                          (msg as unknown as { createdAt?: string })
                            .createdAt ??
                          "";
                        const senderName =
                          msg.sender_name ??
                          (msg as unknown as { senderName?: string })
                            .senderName;

                        if (
                          messageType === "call_received" ||
                          messageType === "call_answered" ||
                          messageType === "call_missed" ||
                          messageType === "call_ended"
                        ) {
                          const missed = messageType === "call_missed";
                          return (
                            <div
                              key={msg.id ?? `${runIdx}-${msgIdx}`}
                              className="flex justify-center my-2"
                            >
                              <div
                                className={cn(
                                  "flex items-center gap-1.5 rounded-[--radius] px-3 py-1.5 text-[11px] font-medium",
                                  missed
                                    ? "bg-muted text-destructive-ink dark:text-destructive"
                                    : "bg-muted text-muted-foreground",
                                )}
                              >
                                <PhoneCall
                                  weight="fill"
                                  className="h-3.5 w-3.5"
                                />
                                <span>{msg.text}</span>
                              </div>
                            </div>
                          );
                        }

                        /*
                         * Instagram-specific inbound shapes.
                         *
                         * A story reply/mention needs the story context rendered
                         * above the text, otherwise the operator sees a bare
                         * sentence with no idea what it is replying to. An
                         * unsupported message needs a visible placeholder because
                         * Instagram sends the event with no renderable content,
                         * silence would look like a bug.
                         */
                        if (
                          messageType === "story_reply" ||
                          messageType === "story_mention"
                        ) {
                          const meta = (msg.metadata ?? {}) as Record<
                            string,
                            unknown
                          >;
                          const storyUrl =
                            (meta.instagram_story_url as string | undefined) ??
                            (meta.instagram_story_mention_url as
                              | string
                              | undefined);
                          const isMention = messageType === "story_mention";
                          return (
                            <div
                              key={msg.id ?? `${runIdx}-${msgIdx}`}
                              className="flex justify-start my-1"
                            >
                              <div className="max-w-[75%] rounded-lg border border-chart-4/30 bg-chart-4/5 p-2">
                                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold  text-chart-4">
                                  <InstagramLogo className="h-3 w-3" />
                                  <span>
                                    {isMention
                                      ? "Menção em story"
                                      : "Resposta a story"}
                                  </span>
                                </div>
                                {storyUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={storyUrl}
                                    alt=""
                                    className="mb-1.5 max-h-40 rounded object-cover"
                                  />
                                )}
                                {msg.text && (
                                  <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                                    {msg.text}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        }

                        if (messageType === "unsupported") {
                          return (
                            <div
                              key={msg.id ?? `${runIdx}-${msgIdx}`}
                              className="flex justify-center my-2"
                            >
                              <div className="rounded-[--radius] bg-muted px-3 py-1.5 text-[11px] text-muted-foreground">
                                {msg.text || "Mensagem não suportada"}
                              </div>
                            </div>
                          );
                        }

                        if (
                          messageType === "call_permission_request" ||
                          messageType === "call_permission_granted" ||
                          messageType === "call_permission_rejected"
                        ) {
                          const granted =
                            messageType === "call_permission_granted";
                          const rejected =
                            messageType === "call_permission_rejected";
                          return (
                            <div
                              key={msg.id ?? `${runIdx}-${msgIdx}`}
                              className="flex justify-center my-2"
                            >
                              <div
                                className={cn(
                                  "flex items-center gap-1.5 rounded-[--radius] px-3 py-1.5 text-[11px] font-medium text-white",
                                  granted
                                    ? "bg-healthy"
                                    : rejected
                                      ? "bg-destructive"
                                      : "bg-warning",
                                )}
                              >
                                <PhoneCall
                                  weight="fill"
                                  className="h-3.5 w-3.5"
                                />
                                <span>{msg.text}</span>
                              </div>
                            </div>
                          );
                        }

                        const isExplicitOutgoing =
                          messageType === "operator" ||
                          messageType === "ai_response" ||
                          messageType === "tool_call" ||
                          messageType === "tool_result" ||
                          messageType === "template";
                        const isMediaOutgoing =
                          (messageType === "audio" || msg.media_type) &&
                          msg.to === conversation.lead_number;
                        const isOutgoing =
                          isExplicitOutgoing || isMediaOutgoing;
                        const isAgentMessage =
                          messageType === "ai_response" ||
                          (isMediaOutgoing && messageType === "audio");
                        const isOperatorMessage = messageType === "operator";
                        const isToolEventMessage = isToolMessage(msg);
                        const isTemplateMessage = messageType === "template";

                        const prevMsg =
                          msgIdx > 0 ? run.messages[msgIdx - 1] : null;
                        const nextMsg =
                          msgIdx < run.messages.length - 1
                            ? run.messages[msgIdx + 1]
                            : null;

                        const previousToolInfo =
                          prevMsg && isToolMessage(prevMsg)
                            ? getToolEventInfo(prevMsg, toolDefinitionByName)
                            : null;
                        const toolInfo = isToolEventMessage
                          ? getToolEventInfo(
                              msg,
                              toolDefinitionByName,
                              previousToolInfo?.toolName,
                            )
                          : null;

                        if (toolInfo) {
                          const nextToolInfo =
                            nextMsg && isToolMessage(nextMsg)
                              ? getToolEventInfo(
                                  nextMsg,
                                  toolDefinitionByName,
                                  toolInfo.toolName,
                                )
                              : null;
                          const hasResultBelow =
                            toolInfo.kind === "call" &&
                            nextToolInfo?.kind === "result";

                          return (
                            <motion.div
                              key={msg.id}
                              data-msg-id={msg.id}
                              initial={{ opacity: 0, y: 8, scale: 0.97 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{
                                duration: 0.2,
                                ease: "easeOut",
                              }}
                              className="group/msg flex w-full justify-center"
                            >
                              <ToolEventRow
                                info={toolInfo}
                                createdAt={createdAt}
                                hasResultBelow={hasResultBelow}
                                isMatched={matchedIds.has(msg.id)}
                                isCurrentMatch={
                                  messageSearchResults?.[currentMatchIdx]
                                    ?.id === msg.id
                                }
                              />
                            </motion.div>
                          );
                        }

                        const prevOutgoing = prevMsg
                          ? isToolMessage(prevMsg)
                            ? null
                            : ["operator", "ai_response"].includes(
                                prevMsg.message_type ??
                                  (
                                    prevMsg as unknown as {
                                      messageType?: string;
                                    }
                                  ).messageType ??
                                  "",
                              ) ||
                              ((prevMsg.message_type === "audio" ||
                                prevMsg.media_type) &&
                                prevMsg.to === conversation.lead_number)
                          : null;
                        const nextOutgoing = nextMsg
                          ? isToolMessage(nextMsg)
                            ? null
                            : ["operator", "ai_response"].includes(
                                nextMsg.message_type ??
                                  (
                                    nextMsg as unknown as {
                                      messageType?: string;
                                    }
                                  ).messageType ??
                                  "",
                              ) ||
                              ((nextMsg.message_type === "audio" ||
                                nextMsg.media_type) &&
                                nextMsg.to === conversation.lead_number)
                          : null;

                        const sameSidePrev =
                          prevMsg !== null && prevOutgoing === isOutgoing;
                        const sameSideNext =
                          nextMsg !== null && nextOutgoing === isOutgoing;

                        const showSenderName =
                          !isOutgoing &&
                          (msgIdx === 0 ||
                            (prevMsg && prevMsg.from !== msg.from));

                        const showChannelLabel = msgIdx === 0;

                        return (
                          <motion.div
                            key={msg.id}
                            data-msg-id={msg.id}
                            initial={{ opacity: 0, y: 8, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{
                              duration: 0.2,
                              ease: "easeOut",
                            }}
                            className={cn(
                              "group/msg flex items-center gap-1",
                              isOutgoing ? "justify-end" : "justify-start",
                              sameSidePrev ? "pt-[1px]" : "pt-1",
                            )}
                          >
                            {/* Reply arrow, shown on the left of incoming messages, right of outgoing */}
                            {isOutgoing && onReply && (
                              <button
                                type="button"
                                onClick={() => onReply(msg)}
                                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 group-hover/msg:opacity-100 transition-opacity hover:bg-border/80 hover:text-muted-foreground"
                                aria-label="Responder"
                              >
                                <ArrowBendUpLeft
                                  weight="bold"
                                  className="h-3.5 w-3.5"
                                />
                              </button>
                            )}
                            <div
                              className={cn(
                                "relative max-w-[75%] rounded-[--radius] px-3 py-2 shadow-sm transition-all duration-300",
                                matchedIds.has(msg.id) &&
                                  "ring-2 ring-warning ring-offset-1 bg-warning/10/40",
                                messageSearchResults?.[currentMatchIdx]?.id ===
                                  msg.id &&
                                  "ring-2 ring-healthy ring-offset-2",
                                isOutgoing
                                  ? isVoiceRun
                                    ? "bg-primary/15/70 text-foreground rounded-tr-sm"
                                    : "bg-[#d9fdd3] dark:bg-[#005c4b] text-foreground dark:text-slate-100 rounded-tr-sm"
                                  : isVoiceRun
                                    ? "bg-muted text-foreground rounded-tl-sm"
                                    : "bg-card dark:bg-[#202c33] text-foreground dark:text-slate-100 rounded-tl-sm",
                                isOutgoing
                                  ? cn("border-r-[3px]", channelColor)
                                  : cn("border-l-[3px]", channelColor),
                                isOutgoing && sameSidePrev && "rounded-tr-sm",
                                isOutgoing && sameSideNext && "rounded-br-sm",
                                !isOutgoing && sameSidePrev && "rounded-tl-sm",
                                !isOutgoing && sameSideNext && "rounded-bl-sm",
                              )}
                            >
                              {/* Channel label, only on first message of a channel run */}
                              {showChannelLabel && (
                                <div
                                  className={cn(
                                    "flex items-center gap-1 mb-1",
                                    isOutgoing
                                      ? "justify-end"
                                      : "justify-start",
                                  )}
                                >
                                  {isWhatsAppRun && (
                                    <>
                                      <WhatsappLogo
                                        weight="fill"
                                        className="h-2.5 w-2.5 text-healthy/60"
                                      />
                                      <span className="text-[11px] font-semibold  text-healthy/50">
                                        WhatsApp
                                      </span>
                                    </>
                                  )}
                                  {isVoiceRun && (
                                    <>
                                      <PhoneCall
                                        weight="fill"
                                        className="h-2.5 w-2.5 text-info/60"
                                      />
                                      <span className="text-[11px] font-semibold  text-primary-ink/50">
                                        Voz
                                      </span>
                                    </>
                                  )}
                                </div>
                              )}

                              {/* Sender name for incoming */}
                              {showSenderName && (
                                <p
                                  className={cn(
                                    "text-[11px] font-semibold mb-0.5",
                                    isVoiceRun
                                      ? "text-primary-ink"
                                      : "text-healthy",
                                  )}
                                >
                                  {senderName || msg.from}
                                </p>
                              )}

                              {/* Quoted reply bubble */}
                              {msg.reply_to_message_id &&
                                (() => {
                                  const repliedMsg = conversation.messages.find(
                                    (m) => m.id === msg.reply_to_message_id,
                                  );
                                  return repliedMsg ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const el =
                                          containerRef.current?.querySelector(
                                            `[data-msg-id="${repliedMsg.id}"]`,
                                          );
                                        if (el) {
                                          el.scrollIntoView({
                                            behavior: "smooth",
                                            block: "center",
                                          });
                                          el.classList.add(
                                            "ring-2",
                                            "ring-info",
                                            "ring-offset-1",
                                          );
                                          setTimeout(() => {
                                            el.classList.remove(
                                              "ring-2",
                                              "ring-info",
                                              "ring-offset-1",
                                            );
                                          }, 2000);
                                        }
                                      }}
                                      className="mb-1 w-full rounded-lg bg-black/5 px-2.5 py-1.5 text-left border-l-[3px] border-info hover:bg-black/[0.08] transition-colors"
                                    >
                                      <p className="text-[11px] font-semibold text-primary-ink truncate">
                                        {repliedMsg.sender_name ||
                                          repliedMsg.from}
                                      </p>
                                      <p className="text-[11px] text-muted-foreground truncate">
                                        {repliedMsg.media_type
                                          ? `📎 ${repliedMsg.media_type === "image" ? "Imagem" : repliedMsg.media_type === "video" ? "Vídeo" : repliedMsg.media_type === "audio" ? "Áudio" : "Documento"}`
                                          : repliedMsg.text || "..."}
                                      </p>
                                    </button>
                                  ) : (
                                    <div className="mb-1 rounded-lg bg-black/5 px-2.5 py-1.5 border-l-[3px] border-foreground/20">
                                      <p className="text-[11px] text-muted-foreground italic">
                                        Mensagem original não disponível
                                      </p>
                                    </div>
                                  );
                                })()}

                              {/* Media */}
                              {(msg.media_url || msg.media_id) &&
                                msg.media_type && (
                                  <MediaBubble
                                    type={msg.media_type}
                                    url={msg.media_url}
                                    mediaId={msg.media_id}
                                    entryType={msg.entry_type}
                                    entryId={msg.entry_id}
                                    text={msg.text}
                                  />
                                )}

                              {/* Template */}
                              {isTemplateMessage && msg.metadata && (
                                <TemplateBubble
                                  metadata={
                                    msg.metadata as TemplateMessageMetadata
                                  }
                                />
                              )}

                              {/* Text */}
                              {msg.text &&
                                !isToolEventMessage &&
                                !isTemplateMessage && (
                                  <CollapsibleMessageText text={msg.text} />
                                )}

                              {/* Time + Read receipt */}
                              <div
                                className={cn(
                                  "flex items-center gap-1 mt-0.5",
                                  isOutgoing ? "justify-end" : "justify-start",
                                )}
                              >
                                {isAgentMessage && (
                                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold  text-muted-foreground">
                                    AI
                                  </span>
                                )}
                                {isOperatorMessage && (
                                  <span className="rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-semibold  text-primary-foreground">
                                    Operador
                                  </span>
                                )}
                                {isTemplateMessage && (
                                  <span className="rounded-md bg-healthy px-1.5 py-0.5 text-[11px] font-semibold  text-healthy-foreground">
                                    Template
                                  </span>
                                )}
                                <span className="text-[11px] text-muted-foreground">
                                  {formatMessageTime(createdAt)}
                                </span>
                                {isOutgoing && (
                                  <ReadReceipt
                                    read={msg.read}
                                    deliveryStatus={msg.delivery_status}
                                  />
                                )}
                              </div>
                            </div>
                            {/* Reply arrow for incoming messages, on the right */}
                            {!isOutgoing && onReply && (
                              <button
                                type="button"
                                onClick={() => onReply(msg)}
                                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 group-hover/msg:opacity-100 transition-opacity hover:bg-border/80 hover:text-muted-foreground"
                                aria-label="Responder"
                              >
                                <ArrowBendUpLeft
                                  weight="bold"
                                  className="h-3.5 w-3.5"
                                />
                              </button>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  );
                });
              })()}
            </div>
          ))}

          {/* Typing indicator */}
          <AnimatePresence>
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="flex justify-start"
              >
                <div className="rounded-[--radius] rounded-tl-sm bg-card shadow-sm">
                  <TypingIndicator />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Scroll-to-bottom button */}
      <AnimatePresence>
        {showScrollDown && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-4 right-6 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-lg border border-border hover:bg-muted transition-colors"
          >
            <ArrowDown
              weight="bold"
              className="h-4 w-4 text-muted-foreground"
            />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
