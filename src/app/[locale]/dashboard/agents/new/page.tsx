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
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

type Mode = "chooser" | "beginner" | "professional";

export default function NewAgentPage() {
  const router = useRouter();
  const t = useTranslations("agents.new");
  const tChooser = useTranslations("agents.new.chooser");
  const [mode, setMode] = useState<Mode>("chooser");

  return (
    <motion.main
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full space-y-6"
    >
      <motion.div variants={itemVariants}>
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
      </motion.div>

      {mode === "chooser" && (
        <motion.div
          variants={itemVariants}
          className="flex gap-5 justify-center"
        >
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
        </motion.div>
      )}

      {mode === "beginner" && (
        <motion.div variants={itemVariants}>
          <BeginnerAgentWizard
            onSwitchMode={() => setMode("professional")}
            onSaved={(agent) => {
              router.push(`/dashboard/agents/${agent.id}`);
            }}
          />
        </motion.div>
      )}

      {mode === "professional" && (
        <motion.div
          variants={itemVariants}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.1,
            type: "spring",
            stiffness: 100,
            damping: 20,
          }}
        >
          <CreateNewAgentForm />
        </motion.div>
      )}
    </motion.main>
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
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="group relative flex h-full flex-col rounded-[--radius] border border-border bg-card p-7 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-lg max-w-xl"
    >
      {recommended && recommendedLabel ? (
        <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-[--radius] bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground shadow">
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
      <h2 className="mt-1 text-2xl font-semibold text-foreground">{title}</h2>
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
    </motion.button>
  );
}
