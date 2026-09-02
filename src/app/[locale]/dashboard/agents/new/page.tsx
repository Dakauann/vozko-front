"use client";

import { CaretRight, GraduationCap, Robot, Wrench } from "@/components/icons";
import { type AgentEditMode, recallCreateMode } from "@/lib/agents/edit-mode";
import { useEffect, useState } from "react";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * The create-mode chooser as a page, matching the edit chooser it forks from.
 *
 * It used to be two side-by-side marketing cards — a "Recomendado" pill, a
 * feature bullet list each, a display-size heading and a solid CTA button per
 * card — inside a single page that swapped the wizard in with useState. Two
 * things were wrong with that. The pattern was a pricing table, and this is a
 * fork in an operator's workday: they are picking a door, not evaluating a
 * purchase, and the bullets sold a decision they make in a second and can undo
 * at any point. And keeping both editors behind component state meant the mode
 * was not addressable — no deep link into the wizard, no back button that meant
 * anything, and a refresh dumped you back at the chooser mid-form.
 *
 * Now it mirrors the edit flow exactly: two quiet task-named rows here, and a
 * real route per editor. The mode the operator used last leads as the marked
 * row, so the common path is one click and the choice is never re-reasoned.
 */
export default function NewAgentPage() {
  const router = useRouter();
  const t = useTranslations("agents.new");
  const tChooser = useTranslations("agents.new.chooser");

  return (
    <main className="w-full space-y-6">
      <DashboardPageHeader
        back={{
          onClick: () => router.push("/dashboard/agents"),
          label: t("backButton"),
        }}
        icon={<Robot className="h-5 w-5" weight="fill" />}
        badge={t("badge")}
        title={t("title")}
        description={tChooser("description")}
      />
      <ModeList />
    </main>
  );
}

function ModeList() {
  const tChooser = useTranslations("agents.new.chooser");

  // Remembered beats the default. Resolved client-side, so the marker appears
  // after mount — null during SSR keeps the markup stable.
  const [lead, setLead] = useState<{
    mode: AgentEditMode;
    remembered: boolean;
  } | null>(null);

  useEffect(() => {
    const remembered = recallCreateMode();
    setLead(
      remembered
        ? { mode: remembered, remembered: true }
        : // Nothing remembered: the guided door leads. It is the one that
          // explains itself, which is what a first agent needs.
          { mode: "beginner", remembered: false },
    );
  }, []);

  const modes: {
    mode: AgentEditMode;
    title: string;
    description: string;
    icon: React.ReactNode;
    tile: string;
  }[] = [
    {
      mode: "beginner",
      title: tChooser("beginner.title"),
      description: tChooser("beginner.description"),
      icon: <GraduationCap className="h-5 w-5" weight="bold" />,
      tile: "tile-info",
    },
    {
      mode: "professional",
      title: tChooser("professional.title"),
      description: tChooser("professional.description"),
      icon: <Wrench className="h-5 w-5" weight="bold" />,
      tile: "tile-brand",
    },
  ];

  // The lead mode renders first, so keyboard and reading order agree with the
  // visual emphasis instead of contradicting it.
  const ordered = lead
    ? [...modes].sort((a, b) =>
        a.mode === lead.mode ? -1 : b.mode === lead.mode ? 1 : 0,
      )
    : modes;

  return (
    <section aria-label={tChooser("legend")} className="mx-auto w-full max-w-2xl">
      <h2 className="legend mb-2">{tChooser("legend")}</h2>
      <ul className="flex flex-col gap-3">
        {ordered.map(({ mode, title, description, icon, tile }) => {
          const isLead = lead?.mode === mode;
          return (
            <li key={mode}>
              <Link
                href={`/dashboard/agents/new/${mode}`}
                className={cn(
                  "group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all duration-DEFAULT",
                  "hover:-translate-y-px hover:shadow motion-reduce:transform-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "max-sm:min-h-[34px] sm:p-5",
                  isLead ? "border-border-strong" : "border-border",
                )}
              >
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-[--radius] shadow-sm",
                    tile,
                  )}
                >
                  {icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "text-sm text-foreground",
                        isLead ? "font-semibold" : "font-medium",
                      )}
                    >
                      {title}
                    </span>
                    {isLead && lead ? (
                      <span className="rounded-[--radius] bg-muted px-2 py-0.5 text-2xs font-medium text-primary-ink">
                        {lead.remembered
                          ? tChooser("lastUsed")
                          : tChooser("suggested")}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {description}
                  </span>
                </span>
                <CaretRight
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-DEFAULT group-hover:translate-x-0.5 motion-reduce:transform-none"
                  weight="bold"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
