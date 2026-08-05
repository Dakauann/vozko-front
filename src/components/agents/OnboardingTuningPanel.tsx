"use client";


import type {
  Agent,
  AgentOptions,
  ModelPricingInfo,
  UpdateAgentPayload,
} from "@/lib/agents/types";
import {
  ChatCircle,
  Check,
  Eye,
  EyeSlash,
  FloppyDisk,
  GraduationCap,
  Sliders,
} from "@/components/icons";
import { getAgentOptionsAction, updateAgentAction } from "@/app/actions/agents";
import { useEffect, useMemo, useState, useTransition } from "react";

import { AIModelSelector } from "@/components/elevated-design/ai-model-selector";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { PromptRefinerPanel } from "@/components/agents/PromptRefinerPanel";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

interface OnboardingTuningPanelProps {
  agent: Agent;
}

type TabId = "settings" | "messagingPrompt" | "initialMessage";

export function OnboardingTuningPanel({ agent }: OnboardingTuningPanelProps) {
  const t = useTranslations("agents.tuning");
  const { toast } = useToast();
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const [collapsed, setCollapsed] = useState(false);

  const [tab, setTab] = useState<TabId>("settings");
  const [messagingPrompt, setMessagingPrompt] = useState(
    agent.messagingPrompt ?? "",
  );
  const [initialMessage, setInitialMessage] = useState(
    agent.initialMessage ?? "",
  );
  const [messagingModel, setMessagingModel] = useState(
    agent.messagingModel ?? "",
  );

  const [options, setOptions] = useState<AgentOptions | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getAgentOptionsAction();
      if (!cancelled && res.options) setOptions(res.options);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setMessagingPrompt(agent.messagingPrompt ?? "");
    setInitialMessage(agent.initialMessage ?? "");
    setMessagingModel(agent.messagingModel ?? "");
  }, [
    agent.id,
    agent.messagingPrompt,
    agent.initialMessage,
    agent.messagingModel,
  ]);

  const dirty = useMemo(
    () =>
      messagingPrompt !== (agent.messagingPrompt ?? "") ||
      initialMessage !== (agent.initialMessage ?? "") ||
      messagingModel !== (agent.messagingModel ?? ""),
    [
      agent,
      messagingPrompt,
      initialMessage,
      messagingModel,
    ],
  );

  const currentValue =
    tab === "messagingPrompt"
        ? messagingPrompt
        : tab === "initialMessage"
          ? initialMessage
          : "";

  const setCurrentValue = (next: string) => {
    if (tab === "messagingPrompt") setMessagingPrompt(next);
    else if (tab === "initialMessage") setInitialMessage(next);
  };

  const messagingModelIds = useMemo<string[]>(
    () => options?.messaging ?? [],
    [options],
  );

  const handleSave = () => {
    if (!dirty) return;
    startSaving(async () => {
      const payload: UpdateAgentPayload = {
        name: agent.name,
        description: agent.description,
        provider: agent.provider,
        messagingModel,
        internalTools: agent.internalTools ?? [],
        whatsappTemplateId: agent.whatsappTemplateId,
        businessPhoneId: agent.businessPhoneId,
        mediaIds: agent.mediaIds,
        avatarUrl: agent.avatarUrl,
        tags: agent.tags,
        metadata: agent.metadata as Record<string, string> | undefined,
        ragEnabled: agent.ragEnabled,
        ragConfig: agent.ragConfig,
        useInitialMessage: agent.useInitialMessage,
        isActive: agent.isActive ?? true,
        messagingPrompt,
        initialMessage,
      };

      const res = await updateAgentAction(agent.id, payload);
      if (res.error || !res.agent) {
        toast({
          title: t("save.error.title"),
          description: res.error ?? t("save.error.description"),
          variant: "destructive",
        });
        return;
      }
      toast({
        title: t("save.success.title"),
        description: t("save.success.description"),
      });
      router.refresh();
    });
  };

  const handleFinish = () => {
    router.push(`/dashboard/agents/${agent.id}`);
  };

  if (collapsed) {
    return (
      <div className="rounded-[--radius] border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground shadow-lg">
              <GraduationCap className="h-5 w-5" weight="fill" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t("collapsed.title")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("collapsed.description")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="inline-flex items-center gap-2 rounded-[--radius] border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:bg-muted"
          >
            <Eye className="h-4 w-4" weight="bold" />
            {t("collapsed.expand")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-[--radius] border border-border bg-card p-5 shadow-sm">
      {/* Banner */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground shadow-lg">
            <GraduationCap className="h-6 w-6" weight="fill" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {t("title")}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {t("description")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="inline-flex items-center gap-2 rounded-[--radius] border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
          >
            <EyeSlash className="h-4 w-4" weight="bold" />
            {t("collapse")}
          </button>
          <button
            type="button"
            onClick={handleFinish}
            className="inline-flex items-center gap-2 rounded-[--radius] border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:bg-muted"
          >
            <Check className="h-4 w-4" weight="bold" />
            {t("finish")}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <TabButton
          active={tab === "settings"}
          onClick={() => setTab("settings")}
          label={t("tabs.settings")}
          withIcon
        />
        <TabButton
          active={tab === "messagingPrompt"}
          onClick={() => setTab("messagingPrompt")}
          label={t("tabs.messagingPrompt")}
        />
        <TabButton
          active={tab === "initialMessage"}
          onClick={() => setTab("initialMessage")}
          label={t("tabs.initialMessage")}
        />
        <div className="ml-auto flex items-center gap-2">
          {dirty ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-warning-ink">
              {t("unsaved")}
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || isSaving}
            className={cn(
              "inline-flex items-center gap-2 rounded-[--radius] bg-muted px-3.5 py-2 text-xs font-semibold text-muted-foreground shadow-md transition-all",
              "hover:brightness-110 active:scale-[0.98]",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <FloppyDisk className="h-4 w-4" weight="fill" />
            {isSaving ? t("save.saving") : t("save.save")}
          </button>
        </div>
      </div>

      {/* Tab content */}
      {tab === "settings" ? (
        <SettingsTab
          intro={t("settings.intro")}
          loading={!options}
          loadingLabel={t("settings.loading")}
          messagingLabel={t("settings.messagingModelLabel")}
          messagingModelIds={messagingModelIds}
          messagingModelValue={messagingModel}
          onMessagingModelChange={setMessagingModel}
          modelPricing={options?.modelPricing}
        />
      ) : (
        <div className="mt-4 flex flex-1 flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              {t("editorLabel")}
            </label>
            <ElevatedTextarea
              rows={tab === "initialMessage" ? 4 : 10}
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              placeholder={t(`placeholders.${tab}`)}
              className="mt-2"
            />
          </div>
          <PromptRefinerPanel
            title={t(`refinerTitle.${tab}`)}
            helper={t(`refinerHelper.${tab}`)}
            value={currentValue}
            kind={
               tab === "messagingPrompt"
                  ? "messaging_prompt"
                  : "initial_message"
            }
            onApply={(next) => setCurrentValue(next)}
          />
        </div>
      )}

    </div>
  );
}

function SettingsTab(props: {
  intro: string;
  loading: boolean;
  loadingLabel: string;
  messagingLabel: string;
  messagingModelIds: string[];
  messagingModelValue: string;
  onMessagingModelChange: (v: string) => void;
  modelPricing?: ModelPricingInfo[];
}) {
  return (
    <div className="mt-4 space-y-4">
      <p className="text-xs text-muted-foreground">{props.intro}</p>

      {props.loading ? (
        <div className="rounded-[--radius] border border-dashed border-border bg-muted p-6 text-center text-xs text-muted-foreground">
          {props.loadingLabel}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {/* Messaging LLM */}
          <AIModelSelector
            label={props.messagingLabel}
            value={props.messagingModelValue}
            onValueChange={props.onMessagingModelChange}
            models={props.messagingModelIds}
            modelPricing={props.modelPricing}
          />
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  withIcon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  withIcon?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[--radius] px-3.5 py-2 text-xs font-semibold transition-all",
        active
          ? "bg-primary text-primary-foreground shadow"
          : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {withIcon ? <Sliders className="h-3.5 w-3.5" weight="bold" /> : null}
      {label}
    </button>
  );
}
