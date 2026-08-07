"use client";

import {
  ChartBar,
  Funnel,
  MagnifyingGlass,
  SmileyWink,
  ThermometerSimple,
  UserCheck,
  X,
} from "@/components/icons";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { useCallback, useMemo, useState } from "react";

import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";

export type AnalysisInterest = "interested" | "not_interested" | "undecided";
export type AnalysisDisposition =
  | "sale"
  | "callback"
  | "declined"
  | "no_answer"
  | "voicemail"
  | "pending";
export type AnalysisSentiment = "positive" | "neutral" | "negative";
export type AnalysisQualification = "hot_lead" | "warm_lead" | "cold_lead";

export interface AnalysisFilterValues {
  interest?: AnalysisInterest;
  disposition?: AnalysisDisposition;
  sentiment?: AnalysisSentiment;
  qualification?: AnalysisQualification;
  attendanceQualityMin?: number;
  attendanceQualityMax?: number;
  hasAnalysis?: boolean;
}

interface AnalysisFiltersProps {
  values: AnalysisFilterValues;
  onChange: (values: AnalysisFilterValues) => void;
  onApply: () => void;
  onClear: () => void;
  translations: {
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
  className?: string;
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
  hideActions?: boolean;
}

export default function AnalysisFilters({
  values,
  onChange,
  onApply,
  onClear,
  translations: t,
  className,
  isCollapsible = true,
  defaultExpanded = false,
  hideActions = false,
}: AnalysisFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const hasActiveFilters = useMemo(() => {
    return (
      values.interest !== undefined ||
      values.disposition !== undefined ||
      values.sentiment !== undefined ||
      values.qualification !== undefined ||
      values.attendanceQualityMin !== undefined ||
      values.attendanceQualityMax !== undefined ||
      values.hasAnalysis !== undefined
    );
  }, [values]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (values.interest) count++;
    if (values.disposition) count++;
    if (values.sentiment) count++;
    if (values.qualification) count++;
    if (values.attendanceQualityMin !== undefined) count++;
    if (values.attendanceQualityMax !== undefined) count++;
    if (values.hasAnalysis !== undefined) count++;
    return count;
  }, [values]);

  const handleChange = useCallback(
    <K extends keyof AnalysisFilterValues>(
      key: K,
      value: AnalysisFilterValues[K] | undefined,
    ) => {
      const newValues = { ...values };
      if (value === undefined) {
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
        <div
          className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground"
          style={{ boxShadow: softSurfaceShadow }}
        >
          <Funnel className="h-5 w-5" weight="fill" />
        </div>
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
          <MagnifyingGlass className="h-5 w-5 text-muted-foreground" weight="bold" />
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
        {/* Has Analysis Toggle */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground">
              {t.hasAnalysis}
            </label>
            {values.hasAnalysis !== undefined && (
              <button
                type="button"
                onClick={() => handleChange("hasAnalysis", undefined)}
                className="text-xs text-muted-foreground hover:text-destructive-ink transition-colors flex items-center gap-1"
              >
                <X className="h-3 w-3" weight="bold" />
              </button>
            )}
          </div>
          <ElevatedSelect
            value={
              values.hasAnalysis === undefined
                ? ""
                : values.hasAnalysis
                  ? "yes"
                  : "no"
            }
            onValueChange={(val) => {
              if (val === "") {
                handleChange("hasAnalysis", undefined);
              } else {
                handleChange("hasAnalysis", val === "yes");
              }
            }}
            placeholder={t.hasAnalysis}
          >
            <ElevatedSelectItem value="yes">
              {t.hasAnalysisYes}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="no">
              {t.hasAnalysisNo}
            </ElevatedSelectItem>
          </ElevatedSelect>
        </div>

        {/* Interest Filter */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground">
              {t.interest.label}
            </label>
            {values.interest !== undefined && (
              <button
                type="button"
                onClick={() => handleChange("interest", undefined)}
                className="text-xs text-muted-foreground hover:text-destructive-ink transition-colors flex items-center gap-1"
              >
                <X className="h-3 w-3" weight="bold" />
              </button>
            )}
          </div>
          <ElevatedSelect
            value={values.interest ?? ""}
            onValueChange={(val) =>
              handleChange(
                "interest",
                val === "" ? undefined : (val as AnalysisInterest),
              )
            }
            placeholder={t.interest.label}
            icon={<UserCheck className="h-4 w-4" weight="fill" />}
          >
            <ElevatedSelectItem value="interested">
              {t.interest.interested}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="not_interested">
              {t.interest.not_interested}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="undecided">
              {t.interest.undecided}
            </ElevatedSelectItem>
          </ElevatedSelect>
        </div>

        {/* Disposition Filter */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground">
              {t.disposition.label}
            </label>
            {values.disposition !== undefined && (
              <button
                type="button"
                onClick={() => handleChange("disposition", undefined)}
                className="text-xs text-muted-foreground hover:text-destructive-ink transition-colors flex items-center gap-1"
              >
                <X className="h-3 w-3" weight="bold" />
              </button>
            )}
          </div>
          <ElevatedSelect
            value={values.disposition ?? ""}
            onValueChange={(val) =>
              handleChange(
                "disposition",
                val === "" ? undefined : (val as AnalysisDisposition),
              )
            }
            placeholder={t.disposition.label}
            icon={<ChartBar className="h-4 w-4" weight="fill" />}
          >
            <ElevatedSelectItem value="sale">
              {t.disposition.sale}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="callback">
              {t.disposition.callback}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="declined">
              {t.disposition.declined}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="no_answer">
              {t.disposition.no_answer}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="voicemail">
              {t.disposition.voicemail}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="pending">
              {t.disposition.pending}
            </ElevatedSelectItem>
          </ElevatedSelect>
        </div>

        {/* Sentiment Filter */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground">
              {t.sentiment.label}
            </label>
            {values.sentiment !== undefined && (
              <button
                type="button"
                onClick={() => handleChange("sentiment", undefined)}
                className="text-xs text-muted-foreground hover:text-destructive-ink transition-colors flex items-center gap-1"
              >
                <X className="h-3 w-3" weight="bold" />
              </button>
            )}
          </div>
          <ElevatedSelect
            value={values.sentiment ?? ""}
            onValueChange={(val) =>
              handleChange(
                "sentiment",
                val === "" ? undefined : (val as AnalysisSentiment),
              )
            }
            placeholder={t.sentiment.label}
            icon={<SmileyWink className="h-4 w-4" weight="fill" />}
          >
            <ElevatedSelectItem value="positive">
              {t.sentiment.positive}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="neutral">
              {t.sentiment.neutral}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="negative">
              {t.sentiment.negative}
            </ElevatedSelectItem>
          </ElevatedSelect>
        </div>

        {/* Qualification Filter */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground">
              {t.qualification.label}
            </label>
            {values.qualification !== undefined && (
              <button
                type="button"
                onClick={() => handleChange("qualification", undefined)}
                className="text-xs text-muted-foreground hover:text-destructive-ink transition-colors flex items-center gap-1"
              >
                <X className="h-3 w-3" weight="bold" />
              </button>
            )}
          </div>
          <ElevatedSelect
            value={values.qualification ?? ""}
            onValueChange={(val) =>
              handleChange(
                "qualification",
                val === "" ? undefined : (val as AnalysisQualification),
              )
            }
            placeholder={t.qualification.label}
            icon={<ThermometerSimple className="h-4 w-4" weight="fill" />}
          >
            <ElevatedSelectItem value="hot_lead">
              {t.qualification.hot_lead}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="warm_lead">
              {t.qualification.warm_lead}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="cold_lead">
              {t.qualification.cold_lead}
            </ElevatedSelectItem>
          </ElevatedSelect>
        </div>

        {/* Attendance Quality Min */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground">
              {t.minQuality}
            </label>
            {values.attendanceQualityMin !== undefined && (
              <button
                type="button"
                onClick={() => handleChange("attendanceQualityMin", undefined)}
                className="text-xs text-muted-foreground hover:text-destructive-ink transition-colors flex items-center gap-1"
              >
                <X className="h-3 w-3" weight="bold" />
              </button>
            )}
          </div>
          <ElevatedInput
            type="number"
            min={0}
            max={100}
            value={values.attendanceQualityMin ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              handleChange(
                "attendanceQualityMin",
                val === ""
                  ? undefined
                  : Math.max(0, Math.min(100, Number(val))),
              );
            }}
            placeholder="0"
            controlSize="default"
            variant="outline"
          />
        </div>

        {/* Attendance Quality Max */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground">
              {t.maxQuality}
            </label>
            {values.attendanceQualityMax !== undefined && (
              <button
                type="button"
                onClick={() => handleChange("attendanceQualityMax", undefined)}
                className="text-xs text-muted-foreground hover:text-destructive-ink transition-colors flex items-center gap-1"
              >
                <X className="h-3 w-3" weight="bold" />
              </button>
            )}
          </div>
          <ElevatedInput
            type="number"
            min={0}
            max={100}
            value={values.attendanceQualityMax ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              handleChange(
                "attendanceQualityMax",
                val === ""
                  ? undefined
                  : Math.max(0, Math.min(100, Number(val))),
              );
            }}
            placeholder="100"
            controlSize="default"
            variant="outline"
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

  const isTransparent = className?.includes("bg-transparent");

  return (
    <div
      className={cn(
        "rounded-[--radius] border border-border bg-card p-5",
        className,
      )}
      style={isTransparent ? undefined : { boxShadow: softSurfaceShadow }}
    >
      {FilterHeader}
      {FilterContent}
    </div>
  );
}
