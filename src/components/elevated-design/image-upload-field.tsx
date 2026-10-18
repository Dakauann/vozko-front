"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import Button from "@/components/elevated-design/button";
import { CircleNotch, ImageSquare, Trash, UploadSimple } from "@/components/icons";

export interface ImageUploadLabels {
  title: string;
  add: string;
  replace: string;
  remove: string;
  uploading: string;
  hint: string;
}

export type ImageUploadAnswer<T> = { value: T } | { error: string };

export interface ImageUploadFieldProps<T> {
  labels: ImageUploadLabels;
  previewUrl: string;
  accept: readonly string[];
  check: (file: File) => string | null;
  upload: (file: File) => Promise<ImageUploadAnswer<T>>;
  onUploaded: (value: T) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function ImageUploadField<T>({ labels, previewUrl, accept, check, upload, onUploaded, onRemove, disabled = false }: ImageUploadFieldProps<T>) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (file: File) => {
    const problem = check(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setUploading(true);
    const answer = await upload(file);
    setUploading(false);
    if ("error" in answer) {
      setError(answer.error);
      return;
    }
    onUploaded(answer.value);
  };

  return (
    <div className="space-y-2">
      <p className="legend">{labels.title}</p>
      <div className="flex items-center gap-3">
        <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[--radius] border border-border bg-muted text-muted-foreground">
          {uploading ? (
            <CircleNotch aria-hidden className="h-5 w-5 animate-spin" />
          ) : previewUrl ? (
            <Image src={previewUrl} alt="" fill unoptimized sizes="64px" className="object-cover" />
          ) : (
            <ImageSquare aria-hidden className="h-6 w-6" />
          )}
        </span>
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<UploadSimple className="h-3.5 w-3.5" />}
              iconVisible
              disabled={uploading || disabled}
              title={uploading ? labels.uploading : previewUrl ? labels.replace : labels.add}
              onClick={() => input.current?.click()}
            />
            {previewUrl && !uploading && !disabled ? (
              <Button variant="ghost" size="sm" icon={<Trash className="h-3.5 w-3.5" />} iconVisible title={labels.remove} onClick={onRemove} />
            ) : null}
          </div>
          <p className="text-2xs text-muted-foreground">{labels.hint}</p>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive-ink">
          {error}
        </p>
      ) : null}
      <input
        ref={input}
        type="file"
        accept={accept.join(",")}
        aria-label={labels.add}
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void send(file);
        }}
      />
    </div>
  );
}
