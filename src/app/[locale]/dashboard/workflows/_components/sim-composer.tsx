"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import ElevatedButton from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { MapPin, Paperclip, PaperPlaneRight } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import {
  SIM_MEDIA_KINDS,
  locationReply,
  mediaReply,
  type LocationDraft,
  type MediaDraft,
  type SimCustomerReply,
  type SimMediaKind,
} from "@/lib/workflows/sim-replies";

type ComposerMode = "text" | "location" | "media";

const EMPTY_LOCATION: LocationDraft = { latitude: "", longitude: "", name: "", address: "" };
const EMPTY_MEDIA: MediaDraft = { kind: "image", url: "", caption: "" };

const TOOL_BUTTON =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ReplyForm({ error, onSubmit, onCancel, children }: { error: string | null; onSubmit: () => void; onCancel: () => void; children: ReactNode }) {
  const t = useTranslations("workflowDebug.chat");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <form onSubmit={submit} className="space-y-2">
      {children}
      {error && <Notice tone="fault">{error}</Notice>}
      <div className="flex gap-1.5">
        <ElevatedButton type="submit" variant="primary" size="sm" title={t("send")} className="flex-1" />
        <ElevatedButton type="button" variant="ghost" size="sm" title={t("cancel")} onClick={onCancel} />
      </div>
    </form>
  );
}

function LocationForm({ onSend, onCancel }: { onSend: (reply: SimCustomerReply) => void; onCancel: () => void }) {
  const t = useTranslations("workflowDebug.chat");
  const [draft, setDraft] = useState(EMPTY_LOCATION);
  const [invalid, setInvalid] = useState(false);
  const field = (key: keyof LocationDraft) => ({
    value: draft[key],
    onChange: (event: { target: { value: string } }) => setDraft((current) => ({ ...current, [key]: event.target.value })),
  });
  const submit = () => {
    const reply = locationReply(draft);
    setInvalid(!reply);
    if (reply) onSend(reply);
  };
  return (
    <ReplyForm error={invalid ? t("invalidLocation") : null} onSubmit={submit} onCancel={onCancel}>
      <div className="grid grid-cols-2 gap-1.5">
        <ElevatedInput label={t("latitude")} type="number" step="any" inputMode="decimal" controlSize="sm" autoFocus {...field("latitude")} />
        <ElevatedInput label={t("longitude")} type="number" step="any" inputMode="decimal" controlSize="sm" {...field("longitude")} />
      </div>
      <ElevatedInput label={t("placeName")} controlSize="sm" {...field("name")} />
      <ElevatedInput label={t("address")} controlSize="sm" {...field("address")} />
    </ReplyForm>
  );
}

function MediaForm({ onSend, onCancel }: { onSend: (reply: SimCustomerReply) => void; onCancel: () => void }) {
  const t = useTranslations("workflowDebug.chat");
  const [draft, setDraft] = useState(EMPTY_MEDIA);
  const [invalid, setInvalid] = useState(false);
  const submit = () => {
    const reply = mediaReply(draft);
    setInvalid(!reply);
    if (reply) onSend(reply);
  };
  return (
    <ReplyForm error={invalid ? t("invalidMedia") : null} onSubmit={submit} onCancel={onCancel}>
      <ElevatedSelect
        label={t("mediaKind")}
        value={draft.kind}
        onValueChange={(kind) => setDraft((current) => ({ ...current, kind: kind as SimMediaKind }))}
      >
        {SIM_MEDIA_KINDS.map((kind) => (
          <ElevatedSelectItem key={kind} value={kind}>
            {t(`mediaKinds.${kind}`)}
          </ElevatedSelectItem>
        ))}
      </ElevatedSelect>
      <ElevatedInput
        label={t("mediaUrl")}
        type="url"
        inputMode="url"
        controlSize="sm"
        autoFocus
        value={draft.url}
        onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))}
      />
      {draft.kind !== "sticker" && (
        <ElevatedInput
          label={t("caption")}
          controlSize="sm"
          value={draft.caption}
          onChange={(event) => setDraft((current) => ({ ...current, caption: event.target.value }))}
        />
      )}
    </ReplyForm>
  );
}

export function SimComposer({ trigger, onReply }: { trigger: boolean; onReply: (reply: SimCustomerReply) => void }) {
  const t = useTranslations("workflowDebug.chat");
  const [mode, setMode] = useState<ComposerMode>("text");
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === "text") inputRef.current?.focus();
  }, [mode, trigger]);

  const send = (reply: SimCustomerReply) => {
    onReply(reply);
    setMode("text");
  };

  const sendText = () => {
    const value = text.trim();
    if (!value) return;
    onReply({ kind: "text", text: value });
    setText("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    sendText();
  };

  const close = () => setMode("text");

  return (
    <div className="border-t border-border px-3 py-2 flex-shrink-0">
      {mode === "location" && <LocationForm onSend={send} onCancel={close} />}
      {mode === "media" && <MediaForm onSend={send} onCancel={close} />}
      {mode === "text" && (
        <div className="flex items-center gap-1">
          <button type="button" aria-label={t("sendLocation")} title={t("sendLocation")} onClick={() => setMode("location")} className={TOOL_BUTTON}>
            <MapPin size={15} />
          </button>
          <button type="button" aria-label={t("sendMedia")} title={t("sendMedia")} onClick={() => setMode("media")} className={TOOL_BUTTON}>
            <Paperclip size={15} />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={trigger ? "Envie a mensagem inicial..." : "Escreva uma resposta..."}
            className="ml-1 min-w-0 flex-1 text-sm bg-muted border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="button"
            onClick={sendText}
            disabled={!text.trim()}
            aria-label="Enviar"
            className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            <PaperPlaneRight size={14} weight="fill" />
          </button>
        </div>
      )}
    </div>
  );
}
