"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CaretDown,
  CaretUp,
  Clock,
  FloppyDisk,
  GearSix,
  Lightning,
  Phone,
  Robot,
} from "@/components/icons";
import {
  getSystemConfigAction,
  updateSystemConfigAction,
} from "@/app/actions/system-config";
import { useEffect, useMemo, useState, useTransition } from "react";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import type { SystemConfig } from "@/lib/system-config/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

function deepEqual(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function FieldDescription({
  description,
  defaultOpen = false,
}: {
  description: string;
  defaultOpen?: boolean;
}) {
  const t = useTranslations("systemConfig");
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {isOpen ? (
          <CaretUp className="h-3 w-3" weight="bold" />
        ) : (
          <CaretDown className="h-3 w-3" weight="bold" />
        )}
        <span>{isOpen ? t("hideDetails") : t("showDetails")}</span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 text-xs text-muted-foreground leading-relaxed bg-muted p-3 rounded-lg border border-border"
          >
            {description}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function GeneralSettingsPage() {
  const t = useTranslations("systemConfig");
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSaving] = useTransition();
  const [original, setOriginal] = useState<SystemConfig | null>(null);
  const [form, setForm] = useState<SystemConfig>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchConfig() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const result = await getSystemConfigAction();
        console.log("Fetched system config:", result);
        if (!active) return;

        if (result.error) {
          setLoadError(result.error);
          return;
        }

        if (result.config) {
          setOriginal(result.config);
          setForm(result.config);
        }
      } catch (err) {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    fetchConfig();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loadError) {
      toast({
        title: t("messages.loadError"),
        description: t("messages.loadErrorDescription"),
        variant: "destructive",
      });
    }
  }, [loadError, t, toast]);

  const hasChanges = useMemo(() => {
    if (!original) return false;
    return !deepEqual(original, form);
  }, [original, form]);

  const updateField = <K extends keyof SystemConfig>(
    key: K,
    value: SystemConfig[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const clampMin1 = (n: number | undefined) => {
    if (n === undefined || Number.isNaN(n)) return undefined;
    return Math.max(1, Math.round(n));
  };

  const onSave = () => {
    if (!hasChanges) return;
    startSaving(async () => {
      try {
        const result = await updateSystemConfigAction(form);

        if (result.error) {
          toast({
            title: t("messages.saveError"),
            description: t("messages.saveErrorDescription"),
            variant: "destructive",
          });
          return;
        }

        if (result.config) {
          setOriginal(result.config);
          setForm(result.config);
        }

        toast({
          title: t("messages.saveSuccess"),
          description: t("messages.saveSuccessDescription"),
        });
      } catch {
        toast({
          title: t("messages.saveError"),
          description: t("messages.saveErrorDescription"),
          variant: "destructive",
        });
      }
    });
  };

  return (
    <motion.main
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full space-y-6"
    >
      <motion.div variants={itemVariants}>
        <DashboardPageHeader
          icon={<GearSix className="h-6 w-6" weight="fill" />}
          badge={t("header.badge")}
          description={t("header.description")}
          actions={
            <Button
              variant="action"
              title={isSaving ? t("buttons.saving") : t("buttons.save")}
              icon={<FloppyDisk className="h-4 w-4" weight="bold" />}
              iconVisible
              iconSide="left"
              onClick={onSave}
              disabled={!hasChanges || isSaving || isLoading}
            />
          }
        />
      </motion.div>

      {isLoading ? (
        <motion.div variants={itemVariants}>
          <ElevatedContainer className="border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">
              {t("messages.loading")}
            </p>
          </ElevatedContainer>
        </motion.div>
      ) : null}

      <motion.section variants={itemVariants}>
        <ElevatedContainer className="border border-border bg-card p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Robot className="h-5 w-5 text-lamp-ink" weight="fill" />
            <h2 className="text-lg font-semibold text-foreground">
              {t("sections.ai")}
            </h2>
          </div>

          <div>
            <ElevatedTextarea
              label={t("fields.baseSystemPrompt.label")}
              placeholder={t("fields.baseSystemPrompt.placeholder")}
              rows={4}
              value={form.baseSystemPrompt ?? ""}
              onChange={(e) => updateField("baseSystemPrompt", e.target.value)}
            />
            <FieldDescription
              description={t("fields.baseSystemPrompt.description")}
            />
          </div>
        </ElevatedContainer>
      </motion.section>

      <motion.section variants={itemVariants}>
        <ElevatedContainer className="border border-border bg-card p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-lamp-ink" weight="fill" />
            <h2 className="text-lg font-semibold text-foreground">
              {t("sections.calls")}
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <ElevatedInput
                type="number"
                label={t("fields.maxConcurrentCalls.label")}
                placeholder={t("fields.maxConcurrentCalls.placeholder")}
                min={1}
                value={form.maxConcurrentCalls ?? ""}
                onChange={(e) =>
                  updateField(
                    "maxConcurrentCalls",
                    clampMin1(Number(e.target.value)),
                  )
                }
                icon={<Lightning className="h-4 w-4" weight="bold" />}
              />
              <FieldDescription
                description={t("fields.maxConcurrentCalls.description")}
              />
            </div>
          </div>
        </ElevatedContainer>
      </motion.section>

      <motion.section variants={itemVariants}>
        <ElevatedContainer className="border border-border bg-card p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-lamp-ink" weight="bold" />
            <h2 className="text-lg font-semibold text-foreground">
              {t("sections.workTime")}
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <ElevatedSwitch
                checked={Boolean(form.workTimeEnabled)}
                onCheckedChange={(checked) =>
                  updateField("workTimeEnabled", checked)
                }
                label={t("fields.workTimeEnabled.label")}
              />
              <FieldDescription
                description={t("fields.workTimeEnabled.description")}
              />
            </div>

            <div
              className={cn(
                "grid gap-6 md:grid-cols-2",
                !form.workTimeEnabled && "opacity-60",
              )}
            >
              <div>
                <ElevatedInput
                  type="time"
                  label={t("fields.workTimeStart.label")}
                  placeholder={t("fields.workTimeStart.placeholder")}
                  value={form.workTimeStart ?? ""}
                  onChange={(e) => updateField("workTimeStart", e.target.value)}
                  disabled={!form.workTimeEnabled}
                />
                <FieldDescription
                  description={t("fields.workTimeStart.description")}
                />
              </div>
              <div>
                <ElevatedInput
                  type="time"
                  label={t("fields.workTimeEnd.label")}
                  placeholder={t("fields.workTimeEnd.placeholder")}
                  value={form.workTimeEnd ?? ""}
                  onChange={(e) => updateField("workTimeEnd", e.target.value)}
                  disabled={!form.workTimeEnabled}
                />
                <FieldDescription
                  description={t("fields.workTimeEnd.description")}
                />
              </div>
            </div>
          </div>
        </ElevatedContainer>
      </motion.section>

      <motion.div variants={itemVariants} className="flex justify-end">
        <Button
          variant="action"
          title={isSaving ? t("buttons.saving") : t("buttons.save")}
          icon={<FloppyDisk className="h-4 w-4" weight="bold" />}
          iconVisible
          iconSide="left"
          onClick={onSave}
          disabled={!hasChanges || isSaving || isLoading}
        />
      </motion.div>
    </motion.main>
  );
}
