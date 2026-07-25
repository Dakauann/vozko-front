"use client";

import { ChartBar, ChatCircle, Funnel, X } from "@phosphor-icons/react";
import { useCallback, useMemo, useState } from "react";

import AnalysisFilters, {
  type AnalysisFilterValues,
} from "@/components/dashboard/AnalysisFilters";
import ConversationFilters, {
  type ConversationFilterValues,
} from "@/components/dashboard/ConversationFilters";
import Button from "@/components/elevated-design/button";
import { IconBox } from "@/components/elevated-design/listing-card";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export type FilterMode = "analysis" | "conversation";

export interface CombinedFilterValues {
  mode: FilterMode;
  analysis: AnalysisFilterValues;
  conversation: ConversationFilterValues;
}

interface CampaignFiltersProps {
  values: CombinedFilterValues;
  onChange: (values: CombinedFilterValues) => void;
  onApply: (
    mode: FilterMode,
    filters: AnalysisFilterValues | ConversationFilterValues,
  ) => void;
  onClear: () => void;
  analysisTranslations: {
    title: string;
    clear: string;
    apply: string;
    hasAnalysis: string;
    hasAnalysisYes: string;
    hasAnalysisNo: string;
    attendanceQuality: string;
    minQuality: string;
    maxQuality: string;
    interest: {
      label: string;
      interested: string;
      not_interested: string;
      undecided: string;
    };
    disposition: {
      label: string;
      sale: string;
      callback: string;
      declined: string;
      no_answer: string;
      voicemail: string;
      pending: string;
    };
    sentiment: {
      label: string;
      positive: string;
      neutral: string;
      negative: string;
    };
    qualification: {
      label: string;
      hot_lead: string;
      warm_lead: string;
      cold_lead: string;
    };
  };
  conversationTranslations: {
    title: string;
    clear: string;
    apply: string;
    hasWhatsAppMessages: string;
    hasWhatsAppMessagesYes: string;
    hasWhatsAppMessagesNo: string;
    hasToolCalls: string;
    hasToolCallsYes: string;
    hasToolCallsNo: string;
    toolName: string;
    toolNamePlaceholder: string;
    messageType: {
      label: string;
      user_message: string;
      ai_response: string;
      tool_call: string;
      tool_result: string;
      audio: string;
      system: string;
    };
    channel: {
      label: string;
      voice: string;
      whatsapp: string;
    };
    minMessageCount: string;
    maxMessageCount: string;
  };
  modeTranslations: {
    title: string;
    subtitle: string;
    analysisMode: string;
    analysisDescription: string;
    conversationMode: string;
    conversationDescription: string;
    clearAll: string;
  };
  className?: string;
  showWhatsAppFilter?: boolean;
  showChannelFilter?: boolean;
}

export default function CampaignFilters({
  values,
  onChange,
  onApply,
  onClear,
  analysisTranslations,
  conversationTranslations,
  modeTranslations,
  className,
  showWhatsAppFilter = true,
  showChannelFilter = true,
}: CampaignFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters = useMemo(() => {
    if (values.mode === "analysis") {
      return (
        values.analysis.interest !== undefined ||
        values.analysis.disposition !== undefined ||
        values.analysis.sentiment !== undefined ||
        values.analysis.qualification !== undefined ||
        values.analysis.attendanceQualityMin !== undefined ||
        values.analysis.attendanceQualityMax !== undefined ||
        values.analysis.hasAnalysis !== undefined
      );
    }
    return (
      values.conversation.hasWhatsAppMessages !== undefined ||
      values.conversation.hasToolCalls !== undefined ||
      values.conversation.toolName !== undefined ||
      values.conversation.messageType !== undefined ||
      values.conversation.channel !== undefined ||
      values.conversation.minMessageCount !== undefined ||
      values.conversation.maxMessageCount !== undefined
    );
  }, [values]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (values.mode === "analysis") {
      if (values.analysis.interest) count++;
      if (values.analysis.disposition) count++;
      if (values.analysis.sentiment) count++;
      if (values.analysis.qualification) count++;
      if (values.analysis.attendanceQualityMin !== undefined) count++;
      if (values.analysis.attendanceQualityMax !== undefined) count++;
      if (values.analysis.hasAnalysis !== undefined) count++;
    } else {
      if (values.conversation.hasWhatsAppMessages !== undefined) count++;
      if (values.conversation.hasToolCalls !== undefined) count++;
      if (values.conversation.toolName) count++;
      if (values.conversation.messageType) count++;
      if (values.conversation.channel) count++;
      if (values.conversation.minMessageCount !== undefined) count++;
      if (values.conversation.maxMessageCount !== undefined) count++;
    }
    return count;
  }, [values]);

  const activeFilterLabels = useMemo(() => {
    const labels: string[] = [];
    if (values.mode === "analysis") {
      if (values.analysis.hasAnalysis !== undefined)
        labels.push(
          values.analysis.hasAnalysis
            ? analysisTranslations.hasAnalysisYes
            : analysisTranslations.hasAnalysisNo,
        );
      if (values.analysis.interest)
        labels.push(
          analysisTranslations.interest[
            values.analysis
              .interest as keyof typeof analysisTranslations.interest
          ] || values.analysis.interest,
        );
      if (values.analysis.disposition)
        labels.push(
          analysisTranslations.disposition[
            values.analysis
              .disposition as keyof typeof analysisTranslations.disposition
          ] || values.analysis.disposition,
        );
      if (values.analysis.sentiment)
        labels.push(
          analysisTranslations.sentiment[
            values.analysis
              .sentiment as keyof typeof analysisTranslations.sentiment
          ] || values.analysis.sentiment,
        );
      if (values.analysis.qualification)
        labels.push(
          analysisTranslations.qualification[
            values.analysis
              .qualification as keyof typeof analysisTranslations.qualification
          ] || values.analysis.qualification,
        );
      if (
        values.analysis.attendanceQualityMin !== undefined ||
        values.analysis.attendanceQualityMax !== undefined
      )
        labels.push(
          `${analysisTranslations.attendanceQuality}: ${values.analysis.attendanceQualityMin ?? 0}%-${values.analysis.attendanceQualityMax ?? 100}%`,
        );
    } else {
      if (values.conversation.hasWhatsAppMessages !== undefined)
        labels.push(
          values.conversation.hasWhatsAppMessages
            ? conversationTranslations.hasWhatsAppMessagesYes
            : conversationTranslations.hasWhatsAppMessagesNo,
        );
      if (values.conversation.hasToolCalls !== undefined)
        labels.push(
          values.conversation.hasToolCalls
            ? conversationTranslations.hasToolCallsYes
            : conversationTranslations.hasToolCallsNo,
        );
      if (values.conversation.toolName)
        labels.push(
          `${conversationTranslations.toolName}: ${values.conversation.toolName}`,
        );
      if (values.conversation.messageType)
        labels.push(
          conversationTranslations.messageType[
            values.conversation
              .messageType as keyof typeof conversationTranslations.messageType
          ] || values.conversation.messageType,
        );
      if (values.conversation.channel)
        labels.push(
          conversationTranslations.channel[
            values.conversation
              .channel as keyof typeof conversationTranslations.channel
          ] || values.conversation.channel,
        );
      if (
        values.conversation.minMessageCount !== undefined ||
        values.conversation.maxMessageCount !== undefined
      )
        labels.push(
          `${conversationTranslations.minMessageCount.replace(":", "")}: ${values.conversation.minMessageCount ?? 0}-${values.conversation.maxMessageCount ?? "∞"}`,
        );
    }
    return labels;
  }, [values, analysisTranslations, conversationTranslations]);

  const handleModeChange = useCallback(
    (mode: FilterMode) => {
      onChange({
        ...values,
        mode,
        analysis: mode === "analysis" ? values.analysis : {},
        conversation: mode === "conversation" ? values.conversation : {},
      });
    },
    [values, onChange],
  );

  const handleAnalysisChange = useCallback(
    (analysis: AnalysisFilterValues) => {
      onChange({ ...values, analysis });
    },
    [values, onChange],
  );

  const handleConversationChange = useCallback(
    (conversation: ConversationFilterValues) => {
      onChange({ ...values, conversation });
    },
    [values, onChange],
  );

  const handleApply = useCallback(() => {
    if (values.mode === "analysis") {
      onApply("analysis", values.analysis);
    } else {
      onApply("conversation", values.conversation);
    }
  }, [values, onApply]);

  const handleClearAll = useCallback(() => {
    onChange({
      mode: values.mode,
      analysis: {},
      conversation: {},
    });
    onClear();
  }, [values.mode, onChange, onClear]);

  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-card overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <IconBox color="blue" size="sm">
            <Funnel className="h-5 w-5" weight="fill" />
          </IconBox>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {modeTranslations.title}
              </h3>
              {hasActiveFilters && (
                <span className="inline-flex items-center justify-center rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </div>
            {hasActiveFilters && !isExpanded ? (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="text-[10px] font-medium text-primary uppercase tracking-wide">
                  {values.mode === "analysis"
                    ? modeTranslations.analysisMode
                    : modeTranslations.conversationMode}
                  :
                </span>
                {activeFilterLabels.slice(0, 3).map((label, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-medium text-white border border-primary"
                  >
                    {label}
                  </span>
                ))}
                {activeFilterLabels.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{activeFilterLabels.length - 3} mais
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {hasActiveFilters ? (
                  <span className="text-primary font-medium">
                    {activeFilterCount} filtro
                    {activeFilterCount !== 1 ? "s" : ""} ativo
                    {activeFilterCount !== 1 ? "s" : ""} •{" "}
                    {values.mode === "analysis"
                      ? modeTranslations.analysisMode
                      : modeTranslations.conversationMode}
                  </span>
                ) : (
                  modeTranslations.subtitle
                )}
              </p>
            )}
          </div>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-muted flex-shrink-0"
        >
          <svg
            className="h-4 w-4 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </motion.div>
      </div>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Mode Selector Tabs */}
              <div className="flex items-center rounded-xl border border-border bg-card p-1">
                <button
                  type="button"
                  onClick={() => handleModeChange("analysis")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors",
                    values.mode === "analysis"
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <ChartBar
                    className="h-4 w-4"
                    weight={values.mode === "analysis" ? "fill" : "regular"}
                  />
                  <span className="text-sm font-medium">
                    {modeTranslations.analysisMode}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("conversation")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors",
                    values.mode === "conversation"
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <ChatCircle
                    className="h-4 w-4"
                    weight={values.mode === "conversation" ? "fill" : "regular"}
                  />
                  <span className="text-sm font-medium">
                    {modeTranslations.conversationMode}
                  </span>
                </button>
              </div>

              {/* Filter Content based on Mode */}
              <AnimatePresence mode="wait">
                {values.mode === "analysis" ? (
                  <motion.div
                    key="analysis"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <AnalysisFilters
                      values={values.analysis}
                      onChange={handleAnalysisChange}
                      onApply={handleApply}
                      onClear={handleClearAll}
                      translations={analysisTranslations}
                      isCollapsible={false}
                      defaultExpanded
                      hideActions
                      className="border-0 p-0 shadow-none bg-transparent"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="conversation"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ConversationFilters
                      values={values.conversation}
                      onChange={handleConversationChange}
                      onApply={handleApply}
                      onClear={handleClearAll}
                      translations={conversationTranslations}
                      isCollapsible={false}
                      defaultExpanded
                      showWhatsAppFilter={showWhatsAppFilter}
                      showChannelFilter={showChannelFilter}
                      hideActions
                      className="border-0 p-0 shadow-none bg-transparent"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Clear All Button */}
              {hasActiveFilters && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-center pt-2"
                >
                  <Button
                    variant="ghost"
                    title={modeTranslations.clearAll}
                    onClick={handleClearAll}
                    icon={<X className="h-4 w-4" weight="bold" />}
                    iconVisible
                    iconSide="left"
                    className="text-muted-foreground hover:text-rose-600"
                  />
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
