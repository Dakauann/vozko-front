"use client";

import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { Copy } from "@/components/icons";
import { ProgressPanel } from "@/components/ui/progress-panel";
import type { Json } from "@/lib/json/guards";
import type { Preview } from "@/lib/whatsapp-forms/types";

export type Loadable<T> = { status: "loading" } | { status: "ready"; value: T } | { status: "failed"; message: string };

export function CompiledJsonDialog({ state, onClose }: { state: Loadable<Json>; onClose: () => void }) {
  const t = useTranslations("whatsappForms.builder.json");
  const text = state.status === "ready" ? JSON.stringify(state.value, null, 2) : "";
  const copy = () => {
    navigator.clipboard.writeText(text).then(
      () => toast.success(t("copied")),
      () => toast.error(t("copyFailed")),
    );
  };
  return (
    <ElevatedDialog open onOpenChange={(open) => !open && onClose()}>
      <ElevatedDialogContent className="max-w-3xl">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("description")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody className="space-y-3">
          {state.status === "loading" ? <ProgressPanel label={t("loading")} style={{ height: 240 }} /> : null}
          {state.status === "failed" ? <p className="text-sm text-foreground">{state.message}</p> : null}
          {state.status === "ready" ? (
            <>
              <div className="flex justify-end">
                <Button variant="secondary" size="sm" title={t("copy")} icon={<Copy className="h-3.5 w-3.5" />} iconVisible iconSide="left" onClick={copy} />
              </div>
              <pre aria-label={t("title")} tabIndex={0} className="max-h-[60vh] overflow-auto rounded-[--radius] border border-border bg-muted p-3 text-xs leading-relaxed text-foreground">
                {text}
              </pre>
            </>
          ) : null}
        </ElevatedDialogBody>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}

export function MetaPreviewDialog({ state, onClose }: { state: Loadable<Preview>; onClose: () => void }) {
  const t = useTranslations("whatsappForms.builder.meta");
  const format = useFormatter();
  const expires = state.status === "ready" && state.value.expiresAt ? new Date(state.value.expiresAt) : null;
  return (
    <ElevatedDialog open onOpenChange={(open) => !open && onClose()}>
      <ElevatedDialogContent className="max-w-md">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>
            {expires && !Number.isNaN(expires.getTime()) ? t("expires", { time: format.dateTime(expires, { dateStyle: "short", timeStyle: "short" }) }) : t("description")}
          </ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody>
          {state.status === "loading" ? <ProgressPanel label={t("loading")} style={{ height: 480 }} /> : null}
          {state.status === "failed" ? <p className="text-sm text-foreground">{state.message}</p> : null}
          {state.status === "ready" ? (
            <iframe title={t("title")} src={state.value.previewUrl} className="h-[600px] w-full rounded-[--radius] border border-border bg-card" sandbox="allow-scripts allow-same-origin allow-forms" />
          ) : null}
        </ElevatedDialogBody>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
