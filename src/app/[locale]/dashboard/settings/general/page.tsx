"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CaretDown,
  CaretUp,
  FloppyDisk,
  GearSix,
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
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import type { SystemConfig } from "@/lib/system-config/types";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

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
        className="-mx-1 flex min-h-[34px] items-center gap-1 px-1 text-xs text-muted-foreground transition-colors hover:text-foreground sm:min-h-0"
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
    <main className="w-full space-y-6">
      <div>
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
      </div>

      {isLoading ? (
        <div>
          <ElevatedContainer className="rounded-lg border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">
              {t("messages.loading")}
            </p>
          </ElevatedContainer>
        </div>
      ) : null}

      <section>
        <ElevatedContainer className="rounded-lg border border-border bg-card p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Robot className="h-5 w-5 text-primary-ink" weight="fill" />
            <h2 className="font-display text-lg font-semibold tracking-[0.01em] text-foreground">
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
      </section>

      <div className="flex justify-end">
        <Button
          variant="action"
          title={isSaving ? t("buttons.saving") : t("buttons.save")}
          icon={<FloppyDisk className="h-4 w-4" weight="bold" />}
          iconVisible
          iconSide="left"
          onClick={onSave}
          disabled={!hasChanges || isSaving || isLoading}
        />
      </div>
    </main>
  );
}
