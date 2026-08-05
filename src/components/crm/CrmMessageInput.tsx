"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowBendUpLeft,
  CircleNotch,
  File as FileIcon,
  Lightning,
  Microphone,
  PaperPlaneRight,
  Paperclip,
  Stop,
  Trash,
  Warning,
  Waveform,
  X,
} from "@/components/icons";
import type {
  ConversationMessage,
  EntryType,
  MediaType,
} from "@/lib/conversations/types";
import { useCallback, useEffect, useRef, useState } from "react";

import Badge from "../elevated-design/badge";
import Button from "@/components/elevated-design/button";
import ElevatedSwitch from "../elevated-design/elevated-switch";
import type { MessageShortcut } from "@/lib/message-shortcuts/types";
import MessageShortcutSheet from "@/components/message-shortcuts/MessageShortcutSheet";
import type { SendButtonWsInput } from "@/hooks/use-conversation-ws";
import { ShieldWarning } from "@/components/icons";
import ShortcutPicker from "./ShortcutPicker";
import { Toggle } from "../ui/toggle";
import toWav from "audiobuffer-to-wav";
import { uploadConversationMediaAction } from "@/app/actions/conversations";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";


interface PendingMedia {
  file: File;
  previewUrl: string;
  type: MediaType;
  uploading: boolean;
  mediaId?: string;
  error?: string;
}

interface CrmMessageInputProps {
  entryType: EntryType;
  entryId: string;
  onSend: (text: string, signed: boolean) => void;
  onSendMedia: (
    text: string,
    mediaId: string,
    mediaType: MediaType,
    signed: boolean,
    replyToMessageId?: string,
  ) => void;
  onSendButton?: (input: SendButtonWsInput) => void;
  onTyping: (isTyping: boolean) => void;
  windowOpen: boolean;
  windowExpiresAt: string | null;
  disabled?: boolean;
  disabledReason?: string;
  replyToMessage?: ConversationMessage | null;
  onClearReply?: () => void;
  translations: {
    placeholder: string;
    windowClosed: string;
    windowClosedDescription: string;
    // Shown when the send is blocked WITHOUT a clock, the contact blocked the
    // bot, or a business connection lost its reply right. Nothing reopens on
    // its own, so telling the operator to "wait for the contact to write" would
    // be advice that never works.
    windowClosedNoClock?: string;
    sendButton: string;
    attachFile: string;
    recording: string;
    uploading: string;
    windowExpires: string;
  };
}


function getMediaType(file: File): MediaType {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "document";
}

function normalizeUploadFile(file: File): File {
  if (file.name) return file;

  const extension =
    file.type.split("/")[1]?.split("+")[0]?.split(";")[0] || "bin";
  const prefix = file.type.startsWith("image/")
    ? "pasted-image"
    : file.type.startsWith("video/")
      ? "pasted-video"
      : file.type.startsWith("audio/")
        ? "pasted-audio"
        : "pasted-file";

  return new File([file], `${prefix}-${Date.now()}.${extension}`, {
    type: file.type || "application/octet-stream",
  });
}

function getClipboardFile(clipboardData: DataTransfer): File | null {
  if (clipboardData.files.length > 0) {
    return clipboardData.files[0];
  }

  for (const item of Array.from(clipboardData.items)) {
    if (item.kind !== "file") continue;

    const file = item.getAsFile();
    if (file) return file;
  }

  return null;
}

function formatRemainingWindow(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (remaining <= 0) return null;
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function convertBlobToWav(blob: Blob): Promise<File> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const wavBuffer = toWav(audioBuffer);
  const wavBlob = new Blob([wavBuffer], { type: "audio/wav" });
  await audioCtx.close();
  return new File([wavBlob], "audio-message.wav", { type: "audio/wav" });
}


export default function CrmMessageInput({
  entryType,
  entryId,
  onSend,
  onSendMedia,
  onSendButton,
  onTyping,
  windowOpen,
  windowExpiresAt,
  disabled = false,
  disabledReason,
  replyToMessage,
  onClearReply,
  translations: t,
}: CrmMessageInputProps) {
  const { can } = useWorkspace();
  const crmT = useTranslations("crm");
  const shortcutPageT = useTranslations("messageShortcutsPage");
  const [text, setText] = useState("");
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>([]);
  const [shortcutPickerVisible, setShortcutPickerVisible] = useState(false);
  const [shortcutQuery, setShortcutQuery] = useState("");
  const [shortcutSheetOpen, setShortcutSheetOpen] = useState(false);
  const [shortcutRefreshToken, setShortcutRefreshToken] = useState(0);
  const [shortcutDraftValue, setShortcutDraftValue] = useState("");
  const [autoSendCreatedShortcut, setAutoSendCreatedShortcut] = useState(false);
  const [sendSigned, setSendSigned] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleTyping = useCallback(() => {
    onTyping(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 2000);
  }, [onTyping]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (pendingMedia?.previewUrl)
        URL.revokeObjectURL(pendingMedia.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [windowRemaining, setWindowRemaining] = useState<string | null>(
    formatRemainingWindow(windowExpiresAt),
  );

  useEffect(() => {
    if (!windowExpiresAt || !windowOpen) return;
    const interval = setInterval(() => {
      setWindowRemaining(formatRemainingWindow(windowExpiresAt));
    }, 30_000);
    setWindowRemaining(formatRemainingWindow(windowExpiresAt));
    return () => clearInterval(interval);
  }, [windowExpiresAt, windowOpen]);

  useEffect(() => {
    const localSendSigned = localStorage.getItem("sendSigned") == "true";
    if (localSendSigned) {
      setSendSigned(localSendSigned);
    }
  }, [sendSigned]);


  const handleSendSignedToggle = useCallback((active: boolean) => {
    setSendSigned(() => {
      localStorage.setItem("sendSigned", active.toString());
      return active;
    });
  }, []);

  // Auto-grow the composer textarea up to ~6 lines, then it scrolls (WhatsApp-style).
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [text, pendingMedia]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && !pendingMedia) return;

    if (pendingMedia?.mediaId) {
      const caption = pendingMedia.type === "audio" ? "" : trimmed;
      onSendMedia(caption, pendingMedia.mediaId, pendingMedia.type, sendSigned);
      URL.revokeObjectURL(pendingMedia.previewUrl);
      setPendingMedia(null);
    } else if (trimmed) {
      onSend(trimmed, sendSigned);
    }

    setText("");
    onTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [text, pendingMedia, onSend, onSendMedia, onTyping]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (shortcutPickerVisible) {
      if (["Enter", "Tab", "ArrowUp", "ArrowDown", "Escape"].includes(e.key)) {
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = useCallback(
    (value: string) => {
      setText(value);
      handleTyping();

      const trimmed = value.trimStart();
      if (trimmed.startsWith("/") && !trimmed.includes(" ")) {
        setShortcutPickerVisible(true);
        setShortcutQuery(trimmed.slice(1));
      } else {
        setShortcutPickerVisible(false);
        setShortcutQuery("");
      }
    },
    [handleTyping],
  );

  const handleShortcutSelect = useCallback(
    (shortcut: MessageShortcut) => {
      setShortcutPickerVisible(false);
      setShortcutQuery("");
      setText("");

      switch (shortcut.messageType) {
        case "text":
          if (shortcut.content.text) {
            onSend(shortcut.content.text, sendSigned);
          }
          break;
        case "button":
          if (
            onSendButton &&
            shortcut.content.text &&
            shortcut.content.buttons?.length
          ) {
            onSendButton({
              headerType: shortcut.content.headerType,
              headerText: shortcut.content.headerText,
              bodyText: shortcut.content.text,
              footerText: shortcut.content.footerText,
              buttons: shortcut.content.buttons,
            });
          }
          break;
        case "media":
          if (shortcut.content.text) {
            onSend(shortcut.content.text, sendSigned);
          }
          break;
      }

      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    },
    [onSend, onSendButton],
  );

  const canCreateShortcut = can("message_shortcuts", "create");

  const openShortcutCreator = useCallback(
    (rawShortcut?: string, autoSend = false) => {
      if (!canCreateShortcut) return;

      const normalized = (rawShortcut || "")
        .replace(/^\/+/, "")
        .replace(/[^a-zA-Z0-9_-]/g, "");

      setShortcutDraftValue(normalized);
      setAutoSendCreatedShortcut(autoSend);
      setShortcutSheetOpen(true);
      setShortcutPickerVisible(false);
    },
    [canCreateShortcut],
  );

  const uploadMediaFile = useCallback(
    async (rawFile: File) => {
      const file = normalizeUploadFile(rawFile);
      const type = getMediaType(file);
      const previewUrl = URL.createObjectURL(file);

      setPendingMedia((prev) => {
        if (prev?.previewUrl) {
          URL.revokeObjectURL(prev.previewUrl);
        }

        return { file, previewUrl, type, uploading: true };
      });

      const result = await uploadConversationMediaAction(
        entryType,
        entryId,
        file,
        type,
      );

      if (result.error || !result.mediaId) {
        setPendingMedia((prev) =>
          prev?.previewUrl === previewUrl
            ? {
                ...prev,
                uploading: false,
                error: result.error || "Upload failed",
              }
            : prev,
        );
        return;
      }

      setPendingMedia((prev) =>
        prev?.previewUrl === previewUrl
          ? { ...prev, uploading: false, mediaId: result.mediaId! }
          : prev,
      );
    },
    [entryType, entryId],
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      await uploadMediaFile(file);

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [uploadMediaFile],
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (disabled || !windowOpen || pendingMedia?.type === "audio") return;

      const file = getClipboardFile(e.clipboardData);
      if (!file) return;

      e.preventDefault();
      await uploadMediaFile(file);
    },
    [disabled, pendingMedia?.type, uploadMediaFile, windowOpen],
  );

  const handleClearMedia = useCallback(() => {
    if (pendingMedia?.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
    setPendingMedia(null);
  }, [pendingMedia]);


  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const sampleLevels = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalized = Math.min(avg / 128, 1);
        setAudioLevels((prev) => {
          const next = [...prev, normalized];
          return next.length > 50 ? next.slice(-50) : next;
        });
        animFrameRef.current = requestAnimationFrame(sampleLevels);
      };
      sampleLevels();

      const mimeType = MediaRecorder.isTypeSupported("audio/webm; codecs=opus")
        ? "audio/webm; codecs=opus"
        : MediaRecorder.isTypeSupported("audio/ogg; codecs=opus")
          ? "audio/ogg; codecs=opus"
          : "audio/mp4";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
        analyserRef.current = null;
        await audioCtx.close();

        const rawBlob = new Blob(audioChunksRef.current, { type: mimeType });

        let wavFile: File;
        try {
          wavFile = await convertBlobToWav(rawBlob);
        } catch (err) {
          console.error("[CrmInput] WAV conversion failed, using raw:", err);
          const ext = mimeType.includes("ogg")
            ? "ogg"
            : mimeType.includes("mp4")
              ? "m4a"
              : "webm";
          wavFile = new File([rawBlob], `audio-message.${ext}`, {
            type: mimeType,
          });
        }

        await uploadMediaFile(wavFile);

        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      setAudioLevels([]);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch {
      console.error("[CrmInput] Failed to start recording");
    }
  }, [uploadMediaFile]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    analyserRef.current = null;
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingDuration(0);
    setAudioLevels([]);
  }, []);


  const canSend =
    !disabled &&
    windowOpen &&
    (text.trim().length > 0 ||
      (pendingMedia?.mediaId && !pendingMedia.uploading));

  return (
    // The composer sits on the SAME chat wallpaper as the message list (no white
    // bar behind it); the input pill + any alerts float on top of it.
    <div className="relative flex-shrink-0">
      <div className="relative">
      {/* Alerts float as centered pills over the wallpaper (never full-width bars,
          never a same-colour wash, the meaning colour rides the icon/dot only). */}
      {disabled && disabledReason && (
        <div className="flex justify-center px-4 pt-2">
          <div className="flex max-w-[92%] items-center gap-2 rounded-[--radius] border border-border bg-card px-3 py-1.5 shadow-md">
            <ShieldWarning
              weight="fill"
              className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
            />
            <p className="truncate text-[11px] font-medium text-foreground">
              {disabledReason}
            </p>
          </div>
        </div>
      )}

      {!windowOpen && (
        <div className="flex justify-center px-4 pt-2">
          <div className="flex max-w-[92%] items-center gap-2 rounded-[--radius] border border-border bg-card px-3 py-2 shadow-md">
            <Warning
              weight="fill"
              className="h-4 w-4 flex-shrink-0 text-warning"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-foreground">
                {t.windowClosed}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {/* An expiry means a clock that reopens on its own; its absence
                    means a structural block. The backend distinguishes them
                    deliberately (nil expiry == "not a clock") and showing the
                    24h copy for a blocked contact sends the operator waiting
                    for something that will never happen. */}
                {windowExpiresAt || !t.windowClosedNoClock
                  ? t.windowClosedDescription
                  : t.windowClosedNoClock}
              </p>
            </div>
          </div>
        </div>
      )}

      {windowOpen && windowRemaining && (
        <div className="flex justify-center px-4 pt-2">
          <div className="flex items-center gap-1.5 rounded-[--radius] border border-border bg-card px-3 py-1 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-healthy animate-pulse" />
            <span className="text-[11px] font-medium text-foreground">
              {t.windowExpires}: {windowRemaining}
            </span>
          </div>
        </div>
      )}

      {/* Pending media preview */}
      <AnimatePresence>
        {pendingMedia && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-border"
          >
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3">
              {/* Preview */}
              <div className="relative flex-shrink-0">
                {pendingMedia.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pendingMedia.previewUrl}
                    alt="Preview"
                    className="h-10 w-10 sm:h-14 sm:w-14 rounded-lg object-cover"
                  />
                ) : pendingMedia.type === "audio" ? (
                  <div className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-lg bg-muted">
                    <Waveform
                      weight="fill"
                      className="h-5 w-5 sm:h-6 sm:w-6 text-primary-ink"
                    />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-lg bg-muted">
                    <FileIcon
                      weight="fill"
                      className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground"
                    />
                  </div>
                )}

                {/* Uploading overlay */}
                {pendingMedia.uploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40">
                    <CircleNotch
                      weight="bold"
                      className="h-4 w-4 sm:h-5 sm:w-5 text-white animate-spin"
                    />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] sm:text-xs font-medium text-foreground">
                  {pendingMedia.file.name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {pendingMedia.uploading
                    ? t.uploading
                    : pendingMedia.error
                      ? pendingMedia.error
                      : `${(pendingMedia.file.size / 1024).toFixed(1)} KB`}
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="flex-shrink-0"
                aria-label="Clear media"
                onClick={handleClearMedia}
                icon={<X weight="bold" className="h-3.5 w-3.5" />}
                iconVisible
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording overlay – replaces the normal input area while recording */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3"
          >
            {/* Cancel button */}
            <button
              type="button"
              onClick={cancelRecording}
              className="flex h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
              aria-label="Cancel recording"
            >
              <Trash weight="bold" className="h-4 w-4" />
            </button>

            {/* Waveform visualizer + timer */}
            <div className="flex flex-1 min-w-0 items-center gap-2 sm:gap-3 rounded-full bg-muted px-3 sm:px-4 py-2">
              {/* Pulsing dot */}
              <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5 flex-shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive/20 opacity-75" />
                <span className="relative inline-flex h-full w-full rounded-full bg-destructive" />
              </span>

              {/* Waveform bars - responsive count */}
              <div className="flex flex-1 min-w-0 items-center justify-center gap-[2px] h-6 sm:h-7 overflow-hidden">
                {Array.from({ length: 30 }).map((_, i) => {
                  const level = audioLevels[i] ?? 0;
                  const barHeight = Math.max(3, level * 20);
                  return (
                    <motion.div
                      key={i}
                      className="w-[2px] sm:w-[3px] rounded-full bg-muted"
                      initial={{ height: 3 }}
                      animate={{ height: barHeight }}
                      transition={{ duration: 0.1, ease: "easeOut" }}
                    />
                  );
                })}
              </div>

              {/* Timer */}
              <span className="flex-shrink-0 font-mono text-[11px] sm:text-xs font-semibold text-primary-ink tabular-nums">
                {formatDuration(recordingDuration)}
              </span>
            </div>

            {/* Stop & send button */}
            <button
              type="button"
              onClick={stopRecording}
              className="flex h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground shadow-md transition-transform hover:scale-105 active:scale-95"
              aria-label="Stop and send"
            >
              <Stop weight="fill" className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Normal input area – hidden while recording */}
      {!isRecording && (
        <>
          {/* Reply-to-message bar */}
          <AnimatePresence>
            {replyToMessage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="border-b border-border overflow-hidden"
              >
                <div className="flex items-center gap-2 px-4 py-2 bg-muted">
                  <ArrowBendUpLeft
                    weight="bold"
                    className="h-4 w-4 text-primary-ink flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1 rounded-md bg-card border-l-[3px] border-info px-2.5 py-1.5">
                    <p className="text-[11px] font-semibold text-primary-ink truncate">
                      {replyToMessage.sender_name || replyToMessage.from}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {replyToMessage.media_type
                        ? `📎 ${replyToMessage.media_type === "image" ? "Imagem" : replyToMessage.media_type === "video" ? "Vídeo" : replyToMessage.media_type === "audio" ? "Áudio" : "Documento"}`
                        : replyToMessage.text || "..."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClearReply}
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full hover:bg-border transition-colors"
                    aria-label={crmT("cancelReply")}
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.pptx,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* WhatsApp-style composer: a floating rounded pill on the chat bg + a
              single circular morph button (mic when empty, send when there's text). */}
          <div className="flex items-end gap-2 px-2 py-2 sm:px-3">
            <div className="relative flex min-w-0 flex-1 items-end gap-0.5 rounded-[--radius] border border-border bg-card px-1.5 py-1 shadow-sm">
              {/* attach */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || !windowOpen}
                aria-label={t.attachFile}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Paperclip weight="bold" className="h-5 w-5" />
              </button>

              {/* quick-shortcut */}
              {canCreateShortcut ? (
                <button
                  type="button"
                  onClick={() => openShortcutCreator(shortcutQuery || "", false)}
                  aria-label={shortcutPageT("inlineCreateButton")}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Lightning weight="fill" className="h-5 w-5" />
                </button>
              ) : null}

              {/* text input */}
              <div className="relative min-w-0 flex-1 self-center">
                <ShortcutPicker
                  query={shortcutQuery}
                  onSelect={handleShortcutSelect}
                  onClose={() => setShortcutPickerVisible(false)}
                  visible={shortcutPickerVisible}
                  canCreate={canCreateShortcut}
                  onCreateShortcut={(value) => openShortcutCreator(value, true)}
                  refreshToken={shortcutRefreshToken}
                />
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={pendingMedia?.type === "audio" ? "" : text}
                  onChange={(e) => {
                    if (pendingMedia?.type === "audio") return;
                    handleTextChange(e.target.value);
                  }}
                  onPaste={handlePaste}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    pendingMedia?.type === "audio"
                      ? "Áudio não suporta legenda"
                      : windowOpen
                        ? t.placeholder
                        : t.windowClosed
                  }
                  disabled={
                    disabled || !windowOpen || pendingMedia?.type === "audio"
                  }
                  spellCheck
                  autoCorrect="on"
                  autoCapitalize="sentences"
                  autoComplete="on"
                  className="block max-h-[120px] w-full resize-none border-0 bg-transparent px-2 py-2 text-sm font-medium leading-snug text-foreground outline-none placeholder:text-muted-foreground focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              {/* sign-with-name toggle */}
              <div className="flex flex-shrink-0 items-center gap-1 self-center pl-1 pr-0.5">
                <span className="hidden text-[11px] font-medium text-muted-foreground sm:inline">
                  Assinar
                </span>
                <ElevatedSwitch
                  onCheckedChange={(active) => handleSendSignedToggle(active)}
                  checked={sendSigned}
                />
              </div>
            </div>

            {/* single morph button: mic when empty → send when there's text */}
            {text.trim().length > 0 || pendingMedia ? (
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                aria-label={t.sendButton}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all duration-150 hover:bg-[hsl(var(--primary-hover))] active:scale-95 disabled:opacity-50"
              >
                <PaperPlaneRight weight="fill" className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={disabled || !windowOpen}
                aria-label={t.recording}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all duration-150 hover:bg-[hsl(var(--primary-hover))] active:scale-95 disabled:opacity-40"
              >
                <Microphone weight="fill" className="h-5 w-5" />
              </button>
            )}
          </div>
        </>
      )}

      <MessageShortcutSheet
        open={shortcutSheetOpen}
        onOpenChange={setShortcutSheetOpen}
        defaultShortcut={shortcutDraftValue}
        onSaved={async (shortcut) => {
          setShortcutRefreshToken((current) => current + 1);

          if (autoSendCreatedShortcut) {
            handleShortcutSelect(shortcut);
            return;
          }

          setText(`/${shortcut.shortcut}`);
          setShortcutQuery(shortcut.shortcut);
          setShortcutPickerVisible(true);
          requestAnimationFrame(() => {
            textareaRef.current?.focus();
          });
        }}
      />
      </div>
    </div>
  );
}
