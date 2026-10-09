"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import {
  ArrowRight,
  CalendarBlank,
  ChartBar,
  ChatsCircle,
  ChatText,
  FileText,
  FilmStrip,
  type Icon,
  Kanban,
  Megaphone,
  PaintBrush,
  PaperPlaneTilt,
  Robot,
  Sparkle,
  UsersThree,
} from "@/components/icons";
import { cn } from "@/lib/utils";

import type { StarterGroup, StarterGroupKey } from "./starter-groups";

const GROUP_ICON: Record<StarterGroupKey, Icon> = {
  start: Sparkle,
  attendance: ChartBar,
  conversations: ChatText,
  funnels: Kanban,
  campaigns: PaperPlaneTilt,
  customers: ChatsCircle,
  knowledge: FileText,
  schedule: CalendarBlank,
  team: UsersThree,
  agents: Robot,
  ads: Megaphone,
  studioVideo: FilmStrip,
  studioImage: PaintBrush,
};

const TOPIC =
  "inline-flex h-8 items-center gap-1.5 rounded-[--radius] border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors duration-DEFAULT hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const TOPIC_ON = "border-transparent bg-primary text-primary-foreground shadow-button-primary hover:bg-primary-hover";

interface Picker {
  onPick: (question: string) => void;
  disabled: boolean;
}

function Questions({ group, onPick, disabled, id }: Picker & { group: StarterGroup; id?: string }) {
  const t = useTranslations("aiChatPage.dock.groups");
  return (
    <ul id={id} className="divide-y divide-border">
      {group.items.map((item) => {
        const question = t(`${group.key}.items.${item}`);
        return (
          <li key={item}>
            <button
              type="button"
              onClick={() => onPick(question)}
              disabled={disabled}
              className="group flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm text-foreground transition-colors duration-DEFAULT hover:bg-muted disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="min-w-0 flex-1">{question}</span>
              <ArrowRight
                aria-hidden
                className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-[color,transform] duration-DEFAULT group-hover:translate-x-0.5 group-hover:text-primary-ink"
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function FeaturedGroup({ group, onPick, disabled }: Picker & { group: StarterGroup }) {
  const t = useTranslations("aiChatPage.dock.groups");
  const GroupIcon = GROUP_ICON[group.key];
  const title = t(`${group.key}.title`);
  return (
    <section aria-label={title} data-live={group.live} className={cn("relative rounded-xl", group.live && "vz-ai-card")}>
      {group.live ? (
        <>
          <span aria-hidden className="vz-ai-halo" />
          <span aria-hidden className="vz-ai-ring" />
        </>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-border-strong bg-card shadow-sm">
        <header className="flex items-center gap-2.5 px-3.5 py-3">
          <span aria-hidden className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[--radius] border border-border bg-muted">
            <GroupIcon className="h-4 w-4 text-primary-ink" />
          </span>
          <h3 className="min-w-0 flex-1 truncate font-display text-base font-semibold leading-tight text-foreground">{title}</h3>
        </header>
        <div className="border-t border-border">
          <Questions group={group} onPick={onPick} disabled={disabled} />
        </div>
      </div>
    </section>
  );
}

function OtherTopics({ groups, onPick, disabled }: Picker & { groups: StarterGroup[] }) {
  const t = useTranslations("aiChatPage.dock");
  const baseId = useId();
  const [chosen, setChosen] = useState<StarterGroupKey | null>(null);
  const selected = groups.find((group) => group.key === chosen) ?? null;
  const panelId = `${baseId}-questions`;
  return (
    <section aria-labelledby={`${baseId}-title`} className="flex flex-col gap-2">
      <h3 id={`${baseId}-title`} className="text-xs font-semibold text-muted-foreground">
        {t("otherTopics")}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {groups.map((group) => {
          const GroupIcon = GROUP_ICON[group.key];
          const on = chosen === group.key;
          return (
            <button
              key={group.key}
              type="button"
              aria-pressed={on}
              aria-controls={on ? panelId : undefined}
              onClick={() => setChosen(on ? null : group.key)}
              className={cn(TOPIC, on && TOPIC_ON)}
            >
              <GroupIcon aria-hidden className={cn("h-3.5 w-3.5 flex-shrink-0", on ? "text-primary-foreground" : "text-muted-foreground")} />
              {t(`groups.${group.key}.title`)}
            </button>
          );
        })}
      </div>
      {selected ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Questions id={panelId} group={selected} onPick={onPick} disabled={disabled} />
        </div>
      ) : null}
    </section>
  );
}

export function StarterList({
  groups,
  initialOpen,
  onPick,
  disabled,
}: {
  groups: StarterGroup[];
  initialOpen: StarterGroupKey | null;
  onPick: (question: string) => void;
  disabled: boolean;
}) {
  const featured = groups.find((group) => group.key === initialOpen) ?? groups[0];
  if (!featured) return null;
  const rest = groups.filter((group) => group !== featured);
  return (
    <div className="flex flex-col gap-5">
      <FeaturedGroup group={featured} onPick={onPick} disabled={disabled} />
      {rest.length > 0 ? <OtherTopics groups={rest} onPick={onPick} disabled={disabled} /> : null}
    </div>
  );
}
