"use client";

import {
  ChatCircle,
  Funnel,
  Hash,
  MagnifyingGlass,
  WhatsappLogo,
  Wrench,
  X,
} from "@/components/icons";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import {
  ElevatedCommandSelect,
  type ElevatedCommandOption,
} from "@/components/elevated-design/elevated-command-select";
import { useCallback, useEffect, useMemo, useState } from "react";

import Button from "@/components/elevated-design/button";
import { IconBox } from "@/components/elevated-design/listing-card";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { getAgentToolsAction } from "@/app/actions/agents";
import type { AgentToolDefinition } from "@/lib/agents/types";

export type MessageType =
  | "user_message"
  | "ai_response"
  | "tool_call"
  | "tool_result"
  | "audio"
  | "system";
export type ChannelType = "voice" | "whatsapp";

export interface ConversationFilterValues {
  hasWhatsAppMessages?: boolean;
  hasToolCalls?: boolean;
  toolName?: string;
  messageType?: MessageType;
  channel?: ChannelType;
  minMessageCount?: number;
  maxMessageCount?: number;
}

interface ConversationFiltersProps {
  values: ConversationFilterValues;
  onChange: (values: ConversationFilterValues) => void;
  onApply: () => void;
  onClear: () => void;
  translations: {
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
  className?: string;
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
  showWhatsAppFilter?: boolean;
  showChannelFilter?: boolean;
  hideActions?: boolean;
}

export default function ConversationFilters({
  values,
  onChange,
  onApply,
  onClear,
  translations: t,
  className,
  isCollapsible = true,
  defaultExpanded = false,
  showWhatsAppFilter = true,
  showChannelFilter = true,
  hideActions = false,
}: ConversationFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [availableTools, setAvailableTools] = useState<AgentToolDefinition[]>(
    [],
  );
  const [toolsLoading, setToolsLoading] = useState(true);

  useEffect(() => {
    async function fetchTools() {
      setToolsLoading(true);
      const { tools, error } = await getAgentToolsAction();
      if (!error && tools) {
        setAvailableTools(tools);
      }
      setToolsLoading(false);
    }
    fetchTools();
  }, []);

  const toolOptions: ElevatedCommandOption[] = useMemo(() => {
    return availableTools.map((tool) => ({
      value: tool.name,
      label: tool.displayName || tool.name,
      description: tool.displayDescription || tool.description,
      icon: <Wrench className="h-4 w-4" weight="fill" />,
      keywords: [
        tool.displayName,
        tool.name,
        tool.displayDescription,
        tool.description,
        tool.category,
      ].filter(Boolean),
    }));
  }, [availableTools]);

  const hasActiveFilters = useMemo(() => {
    return (
      values.hasWhatsAppMessages !== undefined ||
      values.hasToolCalls !== undefined ||
      values.toolName !== undefined ||
      values.messageType !== undefined ||
      values.channel !== undefined ||
      values.minMessageCount !== undefined ||
      values.maxMessageCount !== undefined
    );
  }, [values]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (values.hasWhatsAppMessages !== undefined) count++;
    if (values.hasToolCalls !== undefined) count++;
    if (values.toolName) count++;
    if (values.messageType) count++;
    if (values.channel) count++;
    if (values.minMessageCount !== undefined) count++;
    if (values.maxMessageCount !== undefined) count++;
    return count;
  }, [values]);

  const handleChange = useCallback(
    <K extends keyof ConversationFilterValues>(
      key: K,
      value: ConversationFilterValues[K] | undefined,
    ) => {
      const newValues = { ...values };
      if (value === undefined || value === "") {
        delete newValues[key];
      } else {
        newValues[key] = value;
      }
      onChange(newValues);
    },
    [values, onChange],
  );

  const handleClear = useCallback(() => {
    onChange({});
    onClear();
  }, [onChange, onClear]);

  const handleApplyFilters = useCallback(() => {
    onApply();
  }, [onApply]);

  const FilterHeader = (
    <div
      className={cn(
        "flex items-center justify-between cursor-pointer",
        isCollapsible && "py-2",
      )}
      onClick={() => isCollapsible && setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center gap-3">
        <IconBox color="blue" size="sm">
          <ChatCircle weight="fill" />
        </IconBox>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t.title}</h3>
          {hasActiveFilters && (
            <p className="text-xs text-primary-ink font-medium">
              {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""}{" "}
              active
            </p>
          )}
        </div>
      </div>
      {isCollapsible && (
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <MagnifyingGlass
            className="h-5 w-5 text-muted-foreground"
            weight="bold"
          />
        </motion.div>
      )}
    </div>
  );

  const FilterContent = (
    <motion.div
      initial={isCollapsible ? { height: 0, opacity: 0 } : false}
      animate={{
        height: isExpanded || !isCollapsible ? "auto" : 0,
        opacity: isExpanded || !isCollapsible ? 1 : 0,
      }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="overflow-hidden"
    >
      <div
        className={cn(
          "grid gap-4 pt-4",
          "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
        )}
      >
        {/* Has WhatsApp Messages Toggle (for voice campaigns) */}
        {showWhatsAppFilter && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground">
                {t.hasWhatsAppMessages}
              </label>
              {values.hasWhatsAppMessages !== undefined && (
                <button
                  type="button"
                  onClick={() => handleChange("hasWhatsAppMessages", undefined)}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                >
                  <X className="h-3 w-3" weight="bold" />
                </button>
              )}
            </div>
            <ElevatedSelect
              value={
                values.hasWhatsAppMessages === undefined
                  ? ""
                  : values.hasWhatsAppMessages
                    ? "yes"
                    : "no"
              }
              onValueChange={(val) => {
                if (val === "") {
                  handleChange("hasWhatsAppMessages", undefined);
                } else {
                  handleChange("hasWhatsAppMessages", val === "yes");
                }
              }}
              placeholder={t.hasWhatsAppMessages}
              icon={<WhatsappLogo className="h-4 w-4" weight="fill" />}
            >
              <ElevatedSelectItem value="yes">
                {t.hasWhatsAppMessagesYes}
              </ElevatedSelectItem>
              <ElevatedSelectItem value="no">
                {t.hasWhatsAppMessagesNo}
              </ElevatedSelectItem>
            </ElevatedSelect>
          </div>
        )}

        {/* Has Tool Calls Toggle */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground">
              {t.hasToolCalls}
            </label>
            {values.hasToolCalls !== undefined && (
              <button
                type="button"
                onClick={() => handleChange("hasToolCalls", undefined)}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
              >
                <X className="h-3 w-3" weight="bold" />
              </button>
            )}
          </div>
          <ElevatedSelect
            value={
              values.hasToolCalls === undefined
                ? ""
                : values.hasToolCalls
                  ? "yes"
                  : "no"
            }
            onValueChange={(val) => {
              if (val === "") {
                handleChange("hasToolCalls", undefined);
              } else {
                handleChange("hasToolCalls", val === "yes");
              }
            }}
            placeholder={t.hasToolCalls}
            icon={<Wrench className="h-4 w-4" weight="fill" />}
          >
            <ElevatedSelectItem value="yes">
              {t.hasToolCallsYes}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="no">
              {t.hasToolCallsNo}
            </ElevatedSelectItem>
          </ElevatedSelect>
        </div>

        {/* Tool Name Selection */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground">
              {t.toolName}
            </label>
            {values.toolName && (
              <button
                type="button"
                onClick={() => handleChange("toolName", undefined)}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
              >
                <X className="h-3 w-3" weight="bold" />
              </button>
            )}
          </div>
          <ElevatedCommandSelect
            label=""
            options={toolOptions}
            value={values.toolName ?? null}
            onValueChange={(val) => {
              handleChange("toolName", val || undefined);
            }}
            searchPlaceholder={t.toolNamePlaceholder}
            emptyMessage={
              toolsLoading ? "Carregando..." : "Nenhuma ferramenta encontrada"
            }
            disabled={toolsLoading}
          />
        </div>

        {/* Message Type Filter */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground">
              {t.messageType.label}
            </label>
            {values.messageType && (
              <button
                type="button"
                onClick={() => handleChange("messageType", undefined)}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
              >
                <X className="h-3 w-3" weight="bold" />
              </button>
            )}
          </div>
          <ElevatedSelect
            value={values.messageType ?? ""}
            onValueChange={(val) =>
              handleChange(
                "messageType",
                val === "" ? undefined : (val as MessageType),
              )
            }
            placeholder={t.messageType.label}
            icon={<ChatCircle className="h-4 w-4" weight="fill" />}
          >
            <ElevatedSelectItem value="user_message">
              {t.messageType.user_message}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="ai_response">
              {t.messageType.ai_response}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="tool_call">
              {t.messageType.tool_call}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="tool_result">
              {t.messageType.tool_result}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="audio">
              {t.messageType.audio}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="system">
              {t.messageType.system}
            </ElevatedSelectItem>
          </ElevatedSelect>
        </div>

        {/* Channel Filter */}
        {showChannelFilter && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground">
                {t.channel.label}
              </label>
              {values.channel && (
                <button
                  type="button"
                  onClick={() => handleChange("channel", undefined)}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                >
                  <X className="h-3 w-3" weight="bold" />
                </button>
              )}
            </div>
            <ElevatedSelect
              value={values.channel ?? ""}
              onValueChange={(val) =>
                handleChange(
                  "channel",
                  val === "" ? undefined : (val as ChannelType),
                )
              }
              placeholder={t.channel.label}
            >
              <ElevatedSelectItem value="voice">
                {t.channel.voice}
              </ElevatedSelectItem>
              <ElevatedSelectItem value="whatsapp">
                {t.channel.whatsapp}
              </ElevatedSelectItem>
            </ElevatedSelect>
          </div>
        )}

        {/* Min Message Count */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground">
              {t.minMessageCount}
            </label>
            {values.minMessageCount !== undefined && (
              <button
                type="button"
                onClick={() => handleChange("minMessageCount", undefined)}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
              >
                <X className="h-3 w-3" weight="bold" />
              </button>
            )}
          </div>
          <ElevatedInput
            type="number"
            min={0}
            value={values.minMessageCount ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              handleChange(
                "minMessageCount",
                val === "" ? undefined : Math.max(0, Number(val)),
              );
            }}
            placeholder="0"
            controlSize="default"
            variant="outline"
            icon={<Hash className="h-4 w-4" weight="bold" />}
          />
        </div>

        {/* Max Message Count */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground">
              {t.maxMessageCount}
            </label>
            {values.maxMessageCount !== undefined && (
              <button
                type="button"
                onClick={() => handleChange("maxMessageCount", undefined)}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
              >
                <X className="h-3 w-3" weight="bold" />
              </button>
            )}
          </div>
          <ElevatedInput
            type="number"
            min={0}
            value={values.maxMessageCount ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              handleChange(
                "maxMessageCount",
                val === "" ? undefined : Math.max(0, Number(val)),
              );
            }}
            placeholder="∞"
            controlSize="default"
            variant="outline"
            icon={<Hash className="h-4 w-4" weight="bold" />}
          />
        </div>

        {/* Action Buttons */}
        {!hideActions && (
          <div className="flex flex-col gap-2 justify-end">
            <div className="flex gap-2">
              <Button
                variant="ghost"
                title={t.clear}
                onClick={handleClear}
                icon={<X className="h-4 w-4" weight="bold" />}
                iconVisible
                iconSide="left"
                className="flex-1"
                disabled={!hasActiveFilters}
              />
              <Button
                variant="action"
                title={t.apply}
                onClick={handleApplyFilters}
                icon={<Funnel className="h-4 w-4" weight="fill" />}
                iconVisible
                iconSide="left"
                className="flex-1"
              />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <div
      className={cn(
        "rounded-[--radius] border border-border bg-card p-4",
        className,
      )}
    >
      {FilterHeader}
      {FilterContent}
    </div>
  );
}
