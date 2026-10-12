"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { CircleNotch, Palette } from "@/components/icons";
import { useAccess } from "@/hooks/use-access";
import { useStudioProjectCreator, type StudioProjectOrder } from "@/hooks/use-studio-project-creator";
import { Link, usePathname } from "@/i18n/routing";
import { openDock } from "@/lib/aichat/dock-state";
import type { StudioProjectCard } from "@/lib/aichat/types";
import { editorPathFor } from "@/lib/studio/project";

import { studioOrderFrom } from "./studio-project-order";

const ACTION =
  "inline-flex items-center gap-1.5 self-start rounded-[--radius] bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-DEFAULT hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:self-auto";

export function studioOrderFromCard(card: StudioProjectCard): StudioProjectOrder | null {
  return studioOrderFrom(card.studioProject);
}

function CreatedProjectAction({ path }: { path: string }) {
  const t = useTranslations("aiChatPage.studioProject");
  const here = usePathname() === path;
  if (here) {
    return (
      <button type="button" disabled className={ACTION}>
        {t("opened")}
      </button>
    );
  }
  return (
    <Link href={path} onClick={openDock} className={ACTION}>
      {t("open")}
    </Link>
  );
}

function OrderAction({ order, onError }: { order: StudioProjectOrder; onError: (error: string | null) => void }) {
  const t = useTranslations("aiChatPage.studioProject");
  const { create, busy } = useStudioProjectCreator();
  const [opened, setOpened] = useState(false);
  const started = useRef(false);

  const start = async () => {
    if (started.current) return;
    started.current = true;
    onError(null);
    openDock();
    const outcome = await create(order, "card");
    if (outcome.ok) {
      setOpened(true);
      return;
    }
    started.current = false;
    onError(outcome.error);
  };

  return (
    <button type="button" onClick={() => void start()} disabled={busy !== null || opened} aria-busy={busy !== null} className={ACTION}>
      {busy !== null ? <CircleNotch className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {opened ? t("opened") : t("open")}
    </button>
  );
}

export function StudioProjectCardView({ card }: { card: StudioProjectCard }) {
  const t = useTranslations("aiChatPage.studioProject");
  const tStudio = useTranslations("studio");
  const { decideScreen } = useAccess();
  const [error, setError] = useState<string | null>(null);
  const order = useMemo(() => studioOrderFromCard(card), [card]);
  const { kind, projectId } = card.studioProject;
  const allowed = decideScreen(kind === "image" ? "studio_image" : "studio_video").status === "allowed";
  const path = projectId ? editorPathFor({ id: projectId, kind }) : null;

  const sizes = card.studioProject.sizes?.length ?? 0;
  const media = card.studioProject.media?.length ?? 0;
  const detail =
    kind === "image"
      ? t("imageDetail", { artboards: Math.max(1, sizes), media })
      : order?.aspect
        ? t("videoDetailAspect", { aspect: tStudio(`aspects.${order.aspect}`), media })
        : t("videoDetail", { media });
  return (
    <section className="rounded-lg border border-border bg-card p-3.5 shadow-sm" aria-label={t("title")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[--radius] border border-border bg-muted">
            <Palette weight="duotone" className="h-5 w-5 text-primary-ink" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug text-foreground">{card.studioProject.name || t("title")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{detail}</p>
          </div>
        </div>
        {!order ? (
          <span className="text-xs font-medium text-destructive-ink">{t("invalid")}</span>
        ) : !allowed ? (
          <span className="text-xs font-medium text-muted-foreground">{t("noAccess")}</span>
        ) : path ? (
          <CreatedProjectAction path={path} />
        ) : (
          <OrderAction order={order} onError={setError} />
        )}
      </div>
      {error ? (
        <p className="mt-3 border-t border-border pt-3 text-xs text-destructive-ink" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
