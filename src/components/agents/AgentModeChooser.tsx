"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { ArrowRight, ChatCircle, Files, GraduationCap, PlugsConnected, Sliders, WhatsappLogo, Wrench, type Icon } from "@/components/icons";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from "@/components/ui/button-surfaces";
import type { AgentEditMode, AgentModeLead } from "@/lib/agents/edit-mode";
import { cn } from "@/lib/utils";

type AgentModeOption = {
  mode: AgentEditMode;
  title: string;
  description: string;
  cta: string;
  href: string;
};

const GUIDED_STEPS = ["identity", "models", "prompts", "whatsapp", "review"] as const;

const COMPLETE_TABS: { key: string; icon: Icon }[] = [
  { key: "geral", icon: Sliders },
  { key: "conversa", icon: ChatCircle },
  { key: "habilidades", icon: PlugsConnected },
  { key: "conhecimento", icon: Files },
  { key: "whatsapp", icon: WhatsappLogo },
];

const MODE_ART = {
  beginner: { icon: GraduationCap, explainer: "agents.guided" },
  professional: { icon: Wrench, explainer: "agents.complete" },
} as const;

export function AgentModeChooser({
  legend,
  options,
  lead,
  leadLabels,
}: {
  legend: string;
  options: AgentModeOption[];
  lead: AgentModeLead | null;
  leadLabels: { remembered: string; suggested: string };
}) {
  return (
    <section aria-label={legend} className="w-full max-w-4xl">
      <ul className="grid gap-4 md:grid-cols-2">
        {options.map((option) => (
          <li key={option.mode} className="flex">
            <ModeCard
              option={option}
              leadLabel={lead?.mode === option.mode ? (lead.remembered ? leadLabels.remembered : leadLabels.suggested) : null}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ModeCard({ option, leadLabel }: { option: AgentModeOption; leadLabel: string | null }) {
  const art = MODE_ART[option.mode];
  const Mark = art.icon;
  const isLead = leadLabel !== null;

  return (
    <article
      className={cn(
        "group relative flex w-full flex-col rounded-lg border bg-card p-5 shadow-sm transition-[border-color,box-shadow] duration-150 sm:p-6",
        "hover:border-border-strong hover:shadow-md focus-within:border-border-strong",
        isLead ? "border-border-strong" : "border-border",
      )}
    >
      <header className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-control-edge bg-card text-foreground">
          <Mark className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="font-display text-base font-semibold leading-6 text-foreground">
              <Link
                href={option.href}
                className="rounded-[--radius] after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
              >
                {option.title}
              </Link>
            </h2>
            {leadLabel ? (
              <StatusChip
                tone="outline"
                className="px-2 text-2xs"
                icon={<span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                label={leadLabel}
              />
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-snug text-muted-foreground">{option.description}</p>
        </div>
        <ExplainerHint id={art.explainer} align="end" className="relative z-10 -mr-1 -mt-0.5" />
      </header>

      <div className="mt-5 border-t border-border pt-4">
        {option.mode === "beginner" ? <GuidedOutline label={option.title} /> : <CompleteOutline label={option.title} />}
      </div>

      <div className="mt-auto pt-6">
        <span
          aria-hidden
          className={cn(
            "inline-flex min-h-[34px] items-center gap-1.5 rounded-[--radius] px-3 text-sm font-medium sm:min-h-[32px]",
            isLead ? BUTTON_PRIMARY : BUTTON_SECONDARY,
          )}
        >
          {option.cta}
          <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transform-none" weight="bold" />
        </span>
      </div>
    </article>
  );
}

function GuidedOutline({ label }: { label: string }) {
  const t = useTranslations("agents.new.beginner.steps");
  return (
    <ol aria-label={label}>
      {GUIDED_STEPS.map((id, index) => (
        <li key={id} className="relative flex items-center gap-3 pb-2.5 last:pb-0">
          <span className="relative z-[1] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-control-edge bg-card text-2xs font-semibold tabular-nums text-muted-foreground">
            {index + 1}
          </span>
          {index < GUIDED_STEPS.length - 1 ? <span aria-hidden className="absolute bottom-0 left-2.5 top-5 w-px bg-border-strong" /> : null}
          <span className="text-sm text-foreground">{t(`${id}.title`)}</span>
        </li>
      ))}
    </ol>
  );
}

function CompleteOutline({ label }: { label: string }) {
  const t = useTranslations("agents.form.tabs");
  return (
    <ul aria-label={label}>
      {COMPLETE_TABS.map(({ key, icon: Glyph }) => (
        <li key={key} className="flex items-center gap-3 pb-2.5 last:pb-0">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border border-control-edge bg-card text-muted-foreground">
            <Glyph className="h-3 w-3" />
          </span>
          <span className="text-sm text-foreground">{t(key)}</span>
        </li>
      ))}
    </ul>
  );
}
