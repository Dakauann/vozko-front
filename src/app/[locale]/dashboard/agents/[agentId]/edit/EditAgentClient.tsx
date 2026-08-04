"use client";


import {
  ArrowLeft,
  CaretRight,
  GraduationCap,
  Robot,
  Sparkle,
  Wrench,
} from "@/components/icons";

import type { Agent } from "@/lib/agents/types";
import BeginnerAgentWizard from "@/app/[locale]/dashboard/agents/new/BeginnerAgentWizard";
import CreateNewAgentForm from "@/app/[locale]/dashboard/agents/new/CreateNewAgentForm";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedButton from "@/components/elevated-design/button";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

type Mode = "chooser" | "beginner" | "professional";

export default function EditAgentClient({ agent }: { agent: Agent }) {
  const router = useRouter();
  const { can, permissionsLoading } = useWorkspace();
  const tEdit = useTranslations("agents.edit");
  const tAgents = useTranslations("agents");
  const tChooser = useTranslations("agents.edit.chooser");
  const [mode, setMode] = useState<Mode>("chooser");

  if (permissionsLoading) {
    return (
      <main className="w-full space-y-6">
        <p className="text-sm text-muted-foreground">{tAgents("loading")}</p>
      </main>
    );
  }

  if (!can("agents", "update")) {
    return (
      <main className="w-full space-y-6">
        <ElevatedButton
          variant="ghost"
          title={tEdit("breadcrumb")}
          icon={<ArrowLeft className="h-4 w-4" weight="bold" />}
          iconVisible
          iconSide="left"
          onClick={() => router.push(`/dashboard/agents/${agent.id}`)}
        />
        <div className="rounded-[--radius] border border-border bg-card p-6">
          <h1 className="text-xl font-semibold text-foreground">
            {tAgents("error.noPermissionTitle")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {tAgents("error.noUpdatePermission")}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full space-y-6">
      <DashboardPageHeader
        back={{
          onClick: () => {
            if (mode === "chooser") {
              router.push(`/dashboard/agents/${agent.id}`);
            } else {
              setMode("chooser");
            }
          },
          label:
            mode === "chooser" ? tEdit("breadcrumb") : tChooser("backToChooser"),
        }}
        icon={<Robot className="h-5 w-5" weight="fill" />}
        badge={tEdit("breadcrumb")}
        title={tEdit("title")}
        description={
          mode === "chooser" ? tChooser("description") : tEdit("description")
        }
      />

      {mode === "chooser" && (
        <div className="flex gap-5 justify-center">
          <EditChooserCard
            Icon={GraduationCap}
            iconGradient="from-emerald-500 to-teal-700"
            badge={tChooser("beginner.badge")}
            title={tChooser("beginner.title")}
            description={tChooser("beginner.description")}
            bullets={[
              tChooser("beginner.bullets.0"),
              tChooser("beginner.bullets.1"),
              tChooser("beginner.bullets.2"),
            ]}
            cta={tChooser("beginner.cta")}
            recommended
            recommendedLabel={tChooser("beginner.recommended")}
            onClick={() => setMode("beginner")}
          />
          <EditChooserCard
            Icon={Wrench}
            iconGradient="from-violet-500 to-fuchsia-700"
            badge={tChooser("professional.badge")}
            title={tChooser("professional.title")}
            description={tChooser("professional.description")}
            bullets={[
              tChooser("professional.bullets.0"),
              tChooser("professional.bullets.1"),
              tChooser("professional.bullets.2"),
            ]}
            cta={tChooser("professional.cta")}
            onClick={() => setMode("professional")}
          />
          <EditChooserCard
            Icon={Sparkle}
            iconGradient="from-orange-500 to-amber-600"
            badge={tChooser("refine.badge")}
            title={tChooser("refine.title")}
            description={tChooser("refine.description")}
            bullets={[
              tChooser("refine.bullets.0"),
              tChooser("refine.bullets.1"),
              tChooser("refine.bullets.2"),
            ]}
            cta={tChooser("refine.cta")}
            onClick={() =>
              router.push(`/dashboard/agents/${agent.id}/tune`)
            }
          />
        </div>
      )}

      {mode === "beginner" && (
        <BeginnerAgentWizard
          mode="edit"
          initialAgent={agent}
          onSwitchMode={() => setMode("professional")}
          onSaved={(saved) => router.push(`/dashboard/agents/${saved.id}`)}
        />
      )}

      {mode === "professional" && (
        <CreateNewAgentForm mode="edit" initialAgent={agent} />
      )}
    </main>
  );
}

interface EditChooserCardProps {
  Icon: typeof GraduationCap;
  iconGradient: string;
  badge: string;
  title: string;
  description: string;
  bullets: string[];
  cta: string;
  onClick: () => void;
  recommended?: boolean;
  recommendedLabel?: string;
}

function EditChooserCard({
  Icon,
  iconGradient,
  badge,
  title,
  description,
  bullets,
  cta,
  onClick,
  recommended,
  recommendedLabel,
}: EditChooserCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="group relative flex h-full flex-col rounded-[--radius] border border-border bg-card p-7 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-lg max-w-xl"
    >
      {recommended && recommendedLabel ? (
        <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-[--radius] bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground shadow">
          <Sparkle className="h-3 w-3" weight="fill" />
          {recommendedLabel}
        </span>
      ) : null}
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-[--radius] bg-gradient-to-br ${iconGradient} text-white shadow-lg`}
      >
        <Icon className="h-5 w-5" weight="fill" />
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {badge}
      </p>
      <h2 className="mt-1 text-2xl font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <ul className="mt-4 space-y-2">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground">
            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex items-center justify-between pt-6">
        <span className="text-sm font-semibold text-lamp-ink">{cta}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground shadow-md transition-transform group-hover:translate-x-1">
          <CaretRight className="h-4 w-4" weight="bold" />
        </span>
      </div>
    </motion.button>
  );
}
