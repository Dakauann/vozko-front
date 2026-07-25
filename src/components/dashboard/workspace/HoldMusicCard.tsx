"use client";

import * as React from "react";
import {
  CaretDown,
  CircleNotch,
  MusicNotes,
  Pause,
  Play,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { WorkspaceConfig, BuiltinHoldTrack } from "@/lib/workspace/workspace-config/types";
import type { Media } from "@/lib/medias/types";
import { updateWorkspaceConfigAction } from "@/app/actions/workspace-config";
import {
  deleteHoldMusicAction,
  getHoldMusicBuiltinPreviewAction,
  listHoldMusicBuiltinsAction,
  listMediasAction,
  uploadMediaAction,
} from "@/app/actions/medias";
import { cn } from "@/lib/utils";

const HOLD_MUSIC_HARD_CAP = 10;

interface HoldMusicCardProps {
  workspaceId: string;
  config: WorkspaceConfig | null;
  onConfigChange: (config: WorkspaceConfig) => void;
}

/**
 * Música de espera do workspace: o que o cliente ouve enquanto aguarda em
 * transferências (chamada estacionada, consulta, retorno). Opções: padrão do
 * sistema, faixas inclusas (builtin:<key>) e músicas enviadas pelo workspace
 * (medias hold_music, limitadas pelo plano com teto de 10).
 */
export function HoldMusicCard({ workspaceId, config, onConfigChange }: HoldMusicCardProps) {
  const [open, setOpen] = React.useState(false);
  const [builtins, setBuiltins] = React.useState<BuiltinHoldTrack[]>([]);
  const [tracks, setTracks] = React.useState<Media[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [playingKey, setPlayingKey] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const builtinDataUris = React.useRef<Map<string, string>>(new Map());
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const selected = config?.holdMusicTrack ?? "";

  const load = React.useCallback(async () => {
    const [builtinsRes, mediasRes] = await Promise.all([
      listHoldMusicBuiltinsAction(),
      listMediasAction(),
    ]);
    setBuiltins(builtinsRes.tracks);
    setTracks(mediasRes.medias.filter((m) => m.type === "hold_music"));
    setLoading(false);
  }, []);

  // Lazy: the card ships collapsed and only fetches when first expanded.
  const loadedRef = React.useRef(false);
  React.useEffect(() => {
    if (open && !loadedRef.current) {
      loadedRef.current = true;
      void load();
    }
  }, [open, load]);

  React.useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const stopPreview = React.useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingKey(null);
  }, []);

  const playSrc = React.useCallback(
    (key: string, src: string) => {
      stopPreview();
      const audio = new Audio(src);
      audio.onended = () => setPlayingKey(null);
      audioRef.current = audio;
      setPlayingKey(key);
      void audio.play().catch(() => setPlayingKey(null));
    },
    [stopPreview],
  );

  // rowKey identifies the row for play/stop state; builtinKey is the BARE
  // catalog key the preview endpoint expects (never the "builtin:" prefixed
  // selection value); directUrl serves uploaded tracks straight from the CDN.
  const handlePreview = React.useCallback(
    async (rowKey: string, builtinKey?: string, directUrl?: string) => {
      if (playingKey === rowKey) {
        stopPreview();
        return;
      }
      if (directUrl) {
        playSrc(rowKey, directUrl);
        return;
      }
      if (!builtinKey) return;
      const cached = builtinDataUris.current.get(builtinKey);
      if (cached) {
        playSrc(rowKey, cached);
        return;
      }
      setPlayingKey(`loading:${rowKey}`);
      const res = await getHoldMusicBuiltinPreviewAction(workspaceId, builtinKey);
      if (!res.dataUri) {
        setPlayingKey(null);
        toast.error("Não foi possível carregar a pré-escuta.");
        return;
      }
      builtinDataUris.current.set(builtinKey, res.dataUri);
      playSrc(rowKey, res.dataUri);
    },
    [playingKey, playSrc, stopPreview, workspaceId],
  );

  const applySelection = React.useCallback(
    async (track: string) => {
      if (saving || track === selected) return;
      setSaving(true);
      const result = await updateWorkspaceConfigAction(workspaceId, {
        holdMusicTrack: track,
      });
      if (result.error || !result.config) {
        toast.error(result.error ?? "Não foi possível salvar a seleção.");
      } else {
        onConfigChange(result.config);
        toast.success("Música de espera atualizada.");
      }
      setSaving(false);
    },
    [onConfigChange, saving, selected, workspaceId],
  );

  const handleUpload = React.useCallback(
    async (file: File) => {
      setUploading(true);
      const formData = new FormData();
      formData.append("media", file);
      formData.append("mediaType", "hold_music");
      formData.append("description", file.name.replace(/\.[^.]+$/, ""));
      const res = await uploadMediaAction(formData);
      if (res.error || !res.mediaId) {
        toast.error(res.error ?? "Falha ao enviar a música.");
      } else {
        toast.success("Música enviada e otimizada para telefonia.");
        await load();
      }
      setUploading(false);
    },
    [load],
  );

  const handleDelete = React.useCallback(
    async (mediaId: string) => {
      setDeletingId(mediaId);
      const res = await deleteHoldMusicAction(mediaId);
      if (!res.ok) {
        toast.error(res.error ?? "Não foi possível excluir a faixa.");
      } else {
        toast.success("Faixa excluída; vaga liberada.");
        if (selected === mediaId && config) {
          onConfigChange({ ...config, holdMusicTrack: "" });
        }
        await load();
      }
      setDeletingId(null);
    },
    [config, load, onConfigChange, selected],
  );

  const optionRow = (opts: {
    key: string;
    value: string;
    label: string;
    hint?: string;
    previewUrl?: string;
    builtinKey?: string;
    previewable?: boolean;
    deletable?: boolean;
  }) => {
    const isSelected = selected === opts.value;
    const isPlaying = playingKey === opts.key;
    const isLoadingPreview = playingKey === `loading:${opts.key}`;
    return (
      <div
        key={opts.key}
        className={cn(
          "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
          isSelected
            ? "border-primary bg-primary/5"
            : "border-border hover:bg-muted/50",
        )}
      >
        <button
          type="button"
          onClick={() => applySelection(opts.value)}
          disabled={saving}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            className={cn(
              "h-3.5 w-3.5 shrink-0 rounded-full border",
              isSelected ? "border-primary bg-primary" : "border-muted-foreground/50",
            )}
            aria-hidden
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">
              {opts.label}
            </span>
            {opts.hint ? (
              <span className="block text-[11px] text-muted-foreground">
                {opts.hint}
              </span>
            ) : null}
          </span>
        </button>
        {opts.previewable !== false ? (
          <button
            type="button"
            onClick={() => handlePreview(opts.key, opts.builtinKey, opts.previewUrl)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label={isPlaying ? "Parar pré-escuta" : "Ouvir prévia"}
            title={isPlaying ? "Parar" : "Ouvir prévia"}
          >
            {isLoadingPreview ? (
              <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
            ) : isPlaying ? (
              <Pause className="h-4 w-4" weight="fill" />
            ) : (
              <Play className="h-4 w-4" weight="fill" />
            )}
          </button>
        ) : null}
        {opts.deletable ? (
          <button
            type="button"
            onClick={() => handleDelete(opts.value)}
            disabled={deletingId === opts.value}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
            aria-label="Excluir faixa"
            title="Excluir faixa"
          >
            {deletingId === opts.value ? (
              <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
            ) : (
              <Trash className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>
    );
  };

  const toggleOpen = () => {
    setOpen((prev) => {
      if (prev) stopPreview();
      return !prev;
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-5 space-y-4">
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow">
            <MusicNotes weight="fill" className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Música de espera
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
              O que o cliente ouve enquanto aguarda em transferências. Envios
              são convertidos automaticamente para um MP3 leve otimizado para
              telefonia.
            </p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          {open ? (
            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              {tracks.length}/{HOLD_MUSIC_HARD_CAP} personalizadas
            </span>
          ) : null}
          <CaretDown
            weight="bold"
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </span>
      </button>

      {!open ? null : loading ? (
        <div className="flex items-center justify-center py-6">
          <CircleNotch className="h-5 w-5 animate-spin text-primary" weight="bold" />
        </div>
      ) : (
        <div className="space-y-2">
          {optionRow({
            key: "default",
            value: "",
            label: "Padrão do sistema",
            hint: "Tom de conforto gerado (ou o áudio global configurado no servidor)",
            previewable: false,
          })}
          {builtins.map((b) =>
            optionRow({
              key: `builtin:${b.key}`,
              value: `builtin:${b.key}`,
              label: b.label,
              hint: "Faixa inclusa",
              builtinKey: b.key,
            }),
          )}
          {tracks.map((m) =>
            optionRow({
              key: m.id,
              value: m.id,
              label: m.description || "Faixa personalizada",
              hint: "Enviada pelo workspace",
              previewUrl: m.url,
              deletable: true,
            }),
          )}
        </div>
      )}

      {open ? (
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handleUpload(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading || tracks.length >= HOLD_MUSIC_HARD_CAP}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg"
          >
            {uploading ? (
              <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" />
            ) : (
              <UploadSimple weight="bold" className="h-3.5 w-3.5" />
            )}
            Enviar música
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Limite conforme o seu plano (máx. {HOLD_MUSIC_HARD_CAP}); duração máxima de 5 minutos por faixa.
          </p>
        </div>
      ) : null}
    </div>
  );
}
