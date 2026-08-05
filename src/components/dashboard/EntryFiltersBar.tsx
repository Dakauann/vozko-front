"use client";

import { AnimatePresence, motion } from "framer-motion";
import ElevatedSelect, {
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { Funnel, MagnifyingGlass, Tag, X } from "@/components/icons";
import { useCallback, useEffect, useRef, useState } from "react";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import type { ReactNode } from "react";
import type { Stage as StageType } from "@/lib/conversations/types";
import type { WhatsAppCampaignPhoneStatus } from "@/lib/whatsapp-campaigns/types";
import { cn } from "@/lib/utils";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";


export interface EntryFilterValues {
  search: string;
  status: string;
  stageId: string;
  errorCode?: string;
}

type CampaignType = "voice" | "whatsapp";

interface StatusOption {
  value: string;
  label: string;
}

interface EntryFiltersBarTranslations {
  searchPlaceholder: string;
  statusLabel: string;
  statusAll: string;
  tagLabel: string;
  tagAll: string;
  tagNone: string;
  clearFilters: string;
  activeFilters: string;
  errorCodePlaceholder?: string;
}

interface EntryFiltersBarProps {
  campaignType: CampaignType;
  values: EntryFilterValues;
  onChange: (values: EntryFilterValues) => void;
  stages: StageType[];
  stagesLoading?: boolean;
  statusOptions: StatusOption[];
  translations: EntryFiltersBarTranslations;
  canFilterByStage?: boolean;
  renderActions?: ReactNode;
  className?: string;
}


export default function EntryFiltersBar({
  campaignType,
  values,
  onChange,
  stages,
  stagesLoading = false,
  statusOptions,
  translations: t,
  canFilterByStage = true,
  renderActions,
  className,
}: EntryFiltersBarProps) {
  const [localSearch, setLocalSearch] = useState(values.search);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    setLocalSearch(values.search);
  }, [values.search]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (localSearch !== values.search) {
        onChange({ ...values, search: localSearch });
      }
    }, 400);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [localSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatusChange = useCallback(
    (status: string) => {
      onChange({ ...values, status: status === "__all__" ? "" : status });
    },
    [values, onChange],
  );

  const handleStageChange = useCallback(
    (stageId: string) => {
      onChange({ ...values, stageId: stageId === "__all__" ? "" : stageId });
    },
    [values, onChange],
  );

  const hasActiveFilters =
    values.search !== "" ||
    values.status !== "" ||
    values.stageId !== "" ||
    (values.errorCode ?? "") !== "";

  const activeFilterCount = [
    values.search,
    values.status,
    values.stageId,
    values.errorCode,
  ].filter(Boolean).length;

  const handleClearAll = useCallback(() => {
    setLocalSearch("");
    onChange({ search: "", status: "", stageId: "", errorCode: "" });
  }, [onChange]);

  return (
    <div
      className={cn(
        "rounded-[--radius] border border-border bg-card p-5",
        className,
      )}
      style={{ boxShadow: softSurfaceShadow }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-[--radius] bg-muted">
          <Funnel weight="bold" className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {t.activeFilters}
            </h3>
            <AnimatePresence>
              {hasActiveFilters && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="inline-flex h-5 min-w-5 items-center justify-center rounded-[--radius] bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground"
                >
                  {activeFilterCount}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
        <AnimatePresence>
          {hasActiveFilters && (
            <motion.button
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onClick={handleClearAll}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X weight="bold" className="h-3 w-3" />
              {t.clearFilters}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {/* Phone search */}
        <div className="flex-1 min-w-[200px]">
          <ElevatedInput
            placeholder={t.searchPlaceholder}
            icon={<MagnifyingGlass weight="bold" className="h-4 w-4" />}
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            controlSize="sm"
            className="w-full"
          />
        </div>

        {/* Status filter */}
        <div className="min-w-[160px]">
          <ElevatedSelect
            value={values.status || "__all__"}
            onValueChange={handleStatusChange}
            placeholder={t.statusAll}
          >
            <ElevatedSelectItem value="__all__">
              {t.statusAll}
            </ElevatedSelectItem>
            {statusOptions.map((opt) => (
              <ElevatedSelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
        </div>

        {/* Stage filter */}
        {canFilterByStage && (
          <div className="min-w-[160px]">
            <ElevatedSelect
              value={values.stageId || "__all__"}
              onValueChange={handleStageChange}
              placeholder={t.tagAll}
              icon={<Tag weight="bold" className="h-3.5 w-3.5" />}
            >
              <ElevatedSelectItem value="__all__">
                {t.tagAll}
              </ElevatedSelectItem>
              {stages.map((stage) => (
                <ElevatedSelectItem key={stage.id} value={stage.id}>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span>{stage.name}</span>
                  </div>
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
          </div>
        )}

        {/* Optional actions slot (e.g. manage tags button) */}
        {renderActions}

        {/* Error code filter – WhatsApp campaigns only */}
        {campaignType === "whatsapp" && (
          <div className="min-w-[130px]">
            <ElevatedInput
              placeholder={t.errorCodePlaceholder ?? "Error code"}
              value={values.errorCode ?? ""}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                onChange({ ...values, errorCode: val });
              }}
              controlSize="sm"
              className="w-full"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export type { EntryFiltersBarTranslations, EntryFiltersBarProps };
