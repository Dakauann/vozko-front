"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import { CaretDown, ChartBar, ChatsCircle, type Icon, PaperPlaneTilt, Robot } from "@/components/icons";
import { cn } from "@/lib/utils";

import type { StarterGroup, StarterGroupKey } from "./starter-groups";

const GROUP_ICON: Record<StarterGroupKey, Icon> = {
  attendance: ChartBar,
  campaigns: PaperPlaneTilt,
  customers: ChatsCircle,
  agents: Robot,
};

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
  const t = useTranslations("aiChatPage.dock.groups");
  const baseId = useId();
  const [openKey, setOpenKey] = useState<StarterGroupKey | null>(initialOpen);
  const [followed, setFollowed] = useState(initialOpen);
  if (followed !== initialOpen) {
    setFollowed(initialOpen);
    setOpenKey(initialOpen);
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {groups.map((group) => {
        const open = openKey === group.key;
        const GroupIcon = GROUP_ICON[group.key];
        const panelId = `${baseId}-${group.key}`;
        return (
          <li key={group.key} className="rounded-lg border border-border">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpenKey(open ? null : group.key)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-foreground transition-colors duration-DEFAULT hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <GroupIcon weight="bold" className="h-4 w-4 flex-shrink-0 text-primary-ink" />
              <span className="min-w-0 flex-1 truncate">{t(`${group.key}.title`)}</span>
              <span className="text-2xs font-medium tabular-nums text-muted-foreground">{group.items.length}</span>
              <CaretDown
                weight="bold"
                className={cn("h-3 w-3 flex-shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
              />
            </button>
            {open ? (
              <ul id={panelId} className="flex flex-col gap-1 px-2 pb-2">
                {group.items.map((item) => {
                  const question = t(`${group.key}.items.${item}`);
                  return (
                    <li key={item}>
                      <button
                        type="button"
                        onClick={() => onPick(question)}
                        disabled={disabled}
                        className="w-full rounded-md px-2.5 py-1.5 text-left text-sm text-muted-foreground transition-colors duration-DEFAULT hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {question}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
