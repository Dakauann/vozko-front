"use client";

import {
  CaretRight,
  GraduationCap,
  Robot,
  Sparkle,
  Wrench,
} from "@/components/icons";

import BeginnerAgentWizard from "./BeginnerAgentWizard";
import CreateNewAgentForm from "./CreateNewAgentForm";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

type Mode = "chooser" | "beginner" | "professional";

export default function NewAgentPage() {
  const router = useRouter();
  const t = useTranslations("agents.new");
  const tChooser = useTranslations("agents.new.chooser");
  const [mode, setMode] = useState<Mode>("chooser");

  return (
    <main className="w-full space-y-6">
      <div>
        <DashboardPageHeader
          back={{
            onClick: () => {
              if (mode === "chooser") {
                router.push("/dashboard/agents");
              } else {
                setMode("chooser");
              }
            },
            label:
              mode === "chooser" ? t("backButton") : tChooser("backToChooser"),
          }}
          icon={<Robot className="h-5 w-5" weight="fill" />}
          badge={t("badge")}
          title={t("title")}
          description={
            mode === "chooser" ? tChooser("description") : t("description")
          }
        />
      </div>

      {mode === "chooser" && (
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center sm:gap-5">
          <ChooserCard
            Icon={GraduationCap}
            iconGradient="tile-info"
            title={tChooser("beginner.title")}
            badge={tChooser("beginner.badge")}
            description={tChooser("beginner.description")}
            bullets={[
              tChooser("beginner.bullets.0"),
              tChooser("beginner.bullets.1"),
              tChooser("beginner.bullets.2"),
            ]}
            cta={tChooser("beginner.cta")}
            onClick={() => setMode("beginner")}
            recommended
            recommendedLabel={tChooser("beginner.recommended")}
          />
          <ChooserCard
            Icon={Wrench}
            iconGradient="tile-brand"
            title={tChooser("professional.title")}
            badge={tChooser("professional.badge")}
            description={tChooser("professional.description")}
            bullets={[
              tChooser("professional.bullets.0"),
              tChooser("professional.bullets.1"),
              tChooser("professional.bullets.2"),
            ]}
            cta={tChooser("professional.cta")}
            onClick={() => setMode("professional")}
          />
        </div>
      )}

      {mode === "beginner" && (
        <div>
          <BeginnerAgentWizard
            onSwitchMode={() => setMode("professional")}
            onSaved={(agent) => {
              router.push(`/dashboard/agents/${agent.id}`);
            }}
          />
        </div>
      )}

      {mode === "professional" && (
        <div>
          <CreateNewAgentForm />
        </div>
      )}
    </main>
  );
}

interface ChooserCardProps {
  Icon: typeof Robot;
  iconGradient: string;
  title: string;
  badge: string;
  description: string;
  bullets: string[];
  cta: string;
  onClick: () => void;
  recommended?: boolean;
  recommendedLabel?: string;
}

function ChooserCard({
  Icon,
  iconGradient,
  title,
  badge,
  description,
  bullets,
  cta,
  onClick,
  recommended,
  recommendedLabel,
}: ChooserCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex h-full max-w-xl flex-col rounded-lg border border-border bg-card p-6 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {recommended && recommendedLabel ? (
        <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-[--radius] bg-primary px-3 py-1 text-2xs font-semibold text-primary-foreground shadow">
          <Sparkle className="h-3 w-3" weight="fill" />
          {recommendedLabel}
        </span>
      ) : null}
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconGradient}`}
      >
        <Icon className="h-5 w-5" weight="fill" />
      </div>
      <p className="mt-5 text-xs font-semibold text-muted-foreground">
        {badge}
      </p>
      <h2 className="mt-1 font-display text-2xl font-semibold tracking-[0.01em] text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <ul className="mt-4 space-y-2">
        {bullets.map((b, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-sm text-foreground"
          >
            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex items-center justify-between pt-6">
        <span className="text-sm font-semibold text-primary-ink">{cta}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground shadow-md transition-transform group-hover:translate-x-1">
          <CaretRight className="h-4 w-4" weight="bold" />
        </span>
      </div>
    </button>
  );
}
