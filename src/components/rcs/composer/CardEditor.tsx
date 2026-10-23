"use client";

import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ArrowLeft, ArrowRight, Copy, FileText, Image as ImageGlyph, Play, Plus, Trash, Waveform } from "@/components/icons";
import { addCard, canAddCard, canRemoveCard, duplicateCard, moveCard, removeCard, updateCard } from "@/lib/rcs/content-edit";
import { cardPath, issuesUnder } from "@/lib/rcs/issues";
import { RCS_LIMITS } from "@/lib/rcs/limits";
import type { RcsCard, RcsContent } from "@/lib/rcs/types";
import { cn } from "@/lib/utils";

import { ButtonListEditor } from "./ButtonEditor";
import { useComposer, useFieldIssue } from "./composer-context";
import { RcsMediaField } from "./RcsMediaField";
import { RcsTextField } from "./RcsTextField";

export function CardEditor({ card, index, onChange }: { card: RcsCard; index: number; onChange: (card: RcsCard) => void }) {
  const t = useTranslations("rcs.composer.card");
  const { variables, disabled } = useComposer();
  const issue = useFieldIssue();
  const path = (field: string) => cardPath(index, field);
  const ownIssue = issue(cardPath(index));

  return (
    <div className="space-y-4">
      {ownIssue ? <p className="text-xs font-medium text-destructive-ink">{ownIssue}</p> : null}
      <RcsMediaField
        label={t("media")}
        optional
        value={card.media}
        onChange={(media) => onChange({ ...card, media })}
        error={issue(path("media"), true)}
      />
      <RcsTextField
        label={t("title")}
        value={card.title ?? ""}
        onChange={(title) => onChange({ ...card, title })}
        max={RCS_LIMITS.maxCardTitleRunes}
        error={issue(path("title"))}
        variables={variables}
        disabled={disabled}
      />
      <RcsTextField
        label={t("description")}
        multiline
        value={card.description ?? ""}
        onChange={(description) => onChange({ ...card, description })}
        max={RCS_LIMITS.maxCardDescriptionRunes}
        error={issue(path("description"))}
        variables={variables}
        variableStyle="chips"
        disabled={disabled}
      />
      <ButtonListEditor
        suggestions={card.suggestions ?? []}
        onChange={(suggestions) => onChange({ ...card, suggestions })}
        card={index}
        max={RCS_LIMITS.maxCardSuggestions}
        title={t("buttons")}
        hint={t("buttonsHint", { max: RCS_LIMITS.maxCardSuggestions })}
      />
    </div>
  );
}

function CardThumb({ card }: { card: RcsCard }) {
  const media = card.media;
  const base = "relative flex h-full w-full items-center justify-center overflow-hidden bg-muted text-muted-foreground";
  if (media?.kind === "image") {
    return (
      <span className={base}>
        <Image src={media.url} alt="" fill unoptimized sizes="96px" className="object-cover" />
      </span>
    );
  }
  const Glyph = media?.kind === "video" ? Play : media?.kind === "audio" ? Waveform : media?.kind === "pdf" ? FileText : ImageGlyph;
  return (
    <span className={base}>
      <Glyph aria-hidden className="h-4 w-4" />
    </span>
  );
}

export function CarouselEditor({ content, onChange }: { content: RcsContent; onChange: (content: RcsContent) => void }) {
  const t = useTranslations("rcs.composer.carousel");
  const { issues, disabled } = useComposer();
  const cards = content.cards ?? [];
  const [chosen, setChosen] = useState(0);
  const active = Math.min(chosen, Math.max(cards.length - 1, 0));
  const card = cards[active] ?? {};

  const change = (next: RcsContent, focus: number) => {
    onChange(next);
    setChosen(focus);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t("hint", { min: RCS_LIMITS.minCarouselCards, max: RCS_LIMITS.maxCarouselCards })}</p>
        <span className="readout text-2xs tabular-nums text-muted-foreground">{t("count", { count: cards.length, max: RCS_LIMITS.maxCarouselCards })}</span>
      </div>
      <div role="tablist" aria-label={t("label")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {cards.map((item, index) => {
          const selected = index === active;
          const flagged = issuesUnder(issues, cardPath(index)).length > 0;
          return (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={t("card", { index: index + 1 })}
              onClick={() => setChosen(index)}
              className={cn(
                "relative flex w-24 shrink-0 flex-col overflow-hidden rounded-[--radius] border bg-card text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "border-primary-edge ring-2 ring-primary/20" : "border-border hover:border-border-strong",
              )}
            >
              <span className="block h-12 w-full">
                <CardThumb card={item} />
              </span>
              <span className="flex items-center gap-1 px-2 py-1.5">
                <span className="readout text-2xs font-semibold text-muted-foreground">{index + 1}</span>
                <span className="min-w-0 truncate text-2xs font-medium text-foreground">{item.title?.trim() || t("untitled")}</span>
              </span>
              {flagged ? <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" /> : null}
            </button>
          );
        })}
        <button
          type="button"
          disabled={disabled || !canAddCard(content)}
          onClick={() => change(addCard(content), cards.length)}
          className="flex w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-[--radius] border border-dashed border-control-edge text-2xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus aria-hidden className="h-4 w-4" weight="bold" />
          {t("add")}
        </button>
      </div>
      <div role="tabpanel" aria-label={t("card", { index: active + 1 })} className="rounded-[--radius] border border-border bg-card">
        <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted px-3 py-1.5">
          <p className="min-w-0 flex-1 text-xs font-semibold text-foreground">{t("position", { index: active + 1, count: cards.length })}</p>
          <Button variant="ghost" size="icon" aria-label={t("moveLeft")} icon={<ArrowLeft className="h-3.5 w-3.5" />} iconVisible disabled={disabled || active === 0} onClick={() => change(moveCard(content, active, active - 1), active - 1)} />
          <Button variant="ghost" size="icon" aria-label={t("moveRight")} icon={<ArrowRight className="h-3.5 w-3.5" />} iconVisible disabled={disabled || active === cards.length - 1} onClick={() => change(moveCard(content, active, active + 1), active + 1)} />
          <Button variant="ghost" size="icon" aria-label={t("duplicate")} icon={<Copy className="h-3.5 w-3.5" />} iconVisible disabled={disabled || !canAddCard(content)} onClick={() => change(duplicateCard(content, active), active + 1)} />
          <Button variant="ghost" size="icon" aria-label={t("remove")} icon={<Trash className="h-3.5 w-3.5" />} iconVisible disabled={disabled || !canRemoveCard(content)} onClick={() => change(removeCard(content, active), Math.max(active - 1, 0))} />
        </div>
        <div className="p-4">
          <CardEditor key={active} card={card} index={active} onChange={(next) => onChange(updateCard(content, active, next))} />
        </div>
      </div>
    </div>
  );
}
