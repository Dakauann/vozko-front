"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowClockwise,
  CheckCircle,
  GearSix,
  Lightning,
  Trash,
  Warning,
  X,
} from "@/components/icons";
import type {
  WhatsAppCampaign,
  WhatsAppCampaignEntryWithLead,
  WhatsAppCampaignPhoneStatus,
} from "@/lib/whatsapp-campaigns/types";
import {
  confirmClearHistoryWhatsAppCampaignAction,
  confirmResetWhatsAppCampaignAction,
  getWhatsAppCampaignByIdAction,
  listWhatsAppCampaignEntriesAction,
  pauseWhatsAppCampaignAction,
  prepareClearHistoryWhatsAppCampaignAction,
  prepareResetWhatsAppCampaignAction,
  stopWhatsAppCampaignAction,
} from "@/app/actions/whatsapp-campaigns";
import { listStagesAction } from "@/app/actions/stages";
import {
  assignStageToEntryAction,
  removeStageFromEntryAction,
  getBatchEntryStagesAction,
} from "@/app/actions/stages";
import type { Stage, EntryStage, EntryType } from "@/lib/conversations/types";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import type { AnalysisStats } from "@/lib/analysis/types";
import { type AnalysisFilterValues } from "@/components/dashboard/AnalysisFilters";
import AnalysisStatsPanel from "@/components/dashboard/AnalysisStatsPanel";
import CampaignFilters, {
  type CombinedFilterValues,
} from "@/components/dashboard/CampaignFilters";
import EntryFiltersBar, {
  type EntryFilterValues,
} from "@/components/dashboard/EntryFiltersBar";
import CampaignHeader from "@/components/dashboard/CampaignHeader";
import { SelectionSendNote, useSelectionSendRefusalText } from "@/components/campaigns/SelectionSendNote";
import { selectionSendControls } from "@/lib/campaigns/selection-send";
import { type ConversationFilterValues } from "@/components/dashboard/ConversationFilters";
import Button from "@/components/elevated-design/button";
import CrmDialog from "@/components/crm/CrmDialog";
import CrmStageManager from "@/components/crm/CrmStageManager";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import MonitoringMode from "@/components/dashboard/MonitoringMode";
import type { MonitoringEntry } from "@/components/dashboard/MonitoringMode";
import { getWhatsAppCampaignStatsAction } from "@/app/actions/analysis";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { useCampaignProgress, useLiveFollowUp } from "@/hooks/use-campaign-live";
import { EMPTY_CAMPAIGN_METRICS } from "@/lib/campaigns/metrics";
import { CampaignLiveOverview } from "@/components/campaigns/detail/CampaignLiveOverview";
import { CampaignTimelinePanel } from "@/components/campaigns/detail/CampaignTimelinePanel";
import { CampaignContactsTable, type CampaignContactRow } from "@/components/campaigns/detail/CampaignContactsTable";
import { resolveWhatsAppCampaignErrorDisplay } from "@/lib/whatsapp-campaigns/error-display";
import { CampaignFailuresPanel, CampaignFullReportLink, CampaignFunnelPanel, useCampaignReport } from "./CampaignDeliveryCharts";
import { CampaignSettingsPanel } from "./CampaignSettingsPanel";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";
import { useExportEntries } from "@/hooks/use-export-entries";
import { exportErrorKey } from "@/lib/whatsapp-campaigns/export-errors";
import { SEND_STATUSES } from "@/lib/whatsapp-campaigns/statuses";
import TourGuide from "@/components/TourGuide";
import { SmartCampaignPanel } from "@/components/whatsapp/smart/SmartCampaignPanel";
import { useSmartRefusal } from "@/components/whatsapp/smart/use-smart-refusal";
import { LaunchCheckDialog } from "@/components/whatsapp/launch-check/LaunchCheckDialog";
import { useLaunchCheck, type LaunchRefusal } from "@/components/whatsapp/launch-check/use-launch-check";
import {
  whatsappDetailTourSteps,
  whatsappDetailTourPalette,
  whatsappDetailTourSeed,
} from "@/data/tour-whatsapp-campaign-detail";
import type { AbstractIntlMessages } from "next-intl";

interface WhatsAppCampaignDetailProps {
  campaign: WhatsAppCampaign;
  agentName?: string;
  templateName?: string;
  token?: string;
  messages: AbstractIntlMessages;
  locale: string;
}

type WhatsAppCampaignDetailContentProps = Omit<
  WhatsAppCampaignDetailProps,
  "messages"
>;

export default function WhatsAppCampaignDetail({
  messages,
  locale,
  ...rest
}: WhatsAppCampaignDetailProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <WhatsAppCampaignDetailContent {...rest} locale={locale} />
    </NextIntlClientProvider>
  );
}

const ENTRIES_PAGE_SIZE = 20;

const statusKeys: Record<string, string> = {
  STOPPED: "stopped",
  RUNNING: "running",
  PAUSED: "paused",
  COMPLETED: "completed",
};

function ResetModal({
  isOpen,
  onClose,
  campaignId,
  campaignName,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  campaignName: string;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<"prepare" | "confirm">("prepare");
  const [generatedCode, setGeneratedCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("whatsappCampaignsPage.detail.reset");

  const handlePrepare = () => {
    startTransition(async () => {
      const { data, error } =
        await prepareResetWhatsAppCampaignAction(campaignId);

      if (error) {
        toast.error(t("errorTitle"), { description: error });
        return;
      }

      if (data?.resetCode) {
        setGeneratedCode(data.resetCode);
        setInputCode(data.resetCode);
        setStep("confirm");
      }
    });
  };

  const handleConfirm = () => {
    if (inputCode.toUpperCase() !== generatedCode.toUpperCase()) {
      toast.error(t("invalidCodeTitle"), { description: t("invalidCodeDescription") });
      return;
    }

    startTransition(async () => {
      const { data, error } = await confirmResetWhatsAppCampaignAction(
        campaignId,
        inputCode.toUpperCase(),
      );

      if (error) {
        toast.error(t("errorTitle"), { description: error });
        return;
      }

      toast(t("successTitle"), { description: t("successDescription", {
          count: data?.numbersReset ?? 0,
        }) });

      onSuccess();
      setStep("prepare");
      setGeneratedCode("");
      setInputCode("");
      onClose();
    });
  };

  const handleClose = () => {
    setStep("prepare");
    setGeneratedCode("");
    setInputCode("");
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="fixed inset-0 bg-black/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          <motion.div
            className="relative z-10 w-full max-w-lg mx-4"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <ElevatedContainer className="border border-border bg-card overflow-hidden shadow-2xl rounded-[--radius]">
              <div className="relative flex items-center justify-between px-7 pt-6 pb-2">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-muted"
                    style={{ boxShadow: softSurfaceShadow }}
                  >
                    <ArrowClockwise
                      className="h-5 w-5 text-foreground"
                      weight="bold"
                    />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold tracking-[0.01em] text-foreground">
                      {t("title")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {campaignName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                  style={{ boxShadow: softSurfaceShadow }}
                >
                  <X className="h-4 w-4" weight="bold" />
                </button>
              </div>

              <div className="px-7 pb-6 pt-4">
                <AnimatePresence mode="wait">
                  {step === "prepare" ? (
                    <motion.div
                      key="prepare"
                      className="space-y-5"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                    >
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {t("prepareDescription")}
                      </p>

                      <motion.div
                        className="rounded-[--radius] bg-muted border border-border p-5"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                      >
                        <div className="flex gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-muted flex-shrink-0">
                            <Warning
                              className="h-5 w-5 text-muted-foreground"
                              weight="fill"
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground mb-1">
                              {t("warningTitle")}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {t("warningDescription")}
                            </p>
                          </div>
                        </div>
                      </motion.div>

                      <div className="flex gap-3 justify-end pt-2">
                        <Button
                          variant="ghost"
                          title={t("cancelButton")}
                          onClick={handleClose}
                          disabled={isPending}
                        />
                        <Button
                          variant="action"
                          title={
                            isPending
                              ? t("generatingButton")
                              : t("generateButton")
                          }
                          onClick={handlePrepare}
                          disabled={isPending}
                          icon={<Lightning className="h-4 w-4" weight="fill" />}
                          iconVisible
                          iconSide="left"
                        />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="confirm"
                      className="space-y-5"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {t("confirmDescription")}
                      </p>

                      <motion.div
                        className="rounded-[--radius] bg-muted border border-border p-6 text-center relative overflow-hidden"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                      >
                        <p className="text-xs font-semibold text-muted-foreground mb-3">
                          {t("yourCode")}
                        </p>
                        <div className="flex justify-center gap-2">
                          {generatedCode.split("").map((char, i) => (
                            <motion.span
                              key={i}
                              className="w-10 h-12 flex items-center justify-center bg-card rounded-lg text-2xl font-mono font-semibold text-foreground border border-border"
                              style={{ boxShadow: softSurfaceShadow }}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.2 + i * 0.05 }}
                            >
                              {char}
                            </motion.span>
                          ))}
                        </div>
                      </motion.div>

                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-foreground">
                          {t("enterCodeLabel")}
                        </label>
                        <ElevatedInput
                          value={inputCode}
                          onChange={(e) =>
                            setInputCode(
                              e.target.value.toUpperCase().slice(0, 6),
                            )
                          }
                          className="text-center text-2xl font-mono font-semibold"
                          inputClassName="text-center"
                          placeholder={t("enterCodePlaceholder")}
                          maxLength={6}
                          variant="outline"
                          controlSize="lg"
                        />
                      </div>

                      <div className="flex gap-3 justify-end pt-2">
                        <Button
                          variant="ghost"
                          title={t("cancelButton")}
                          onClick={handleClose}
                          disabled={isPending}
                        />
                        <Button
                          variant="action"
                          title={
                            isPending
                              ? t("confirmingButton")
                              : t("confirmButton")
                          }
                          onClick={handleConfirm}
                          disabled={isPending || inputCode.length !== 6}
                          icon={
                            <CheckCircle className="h-4 w-4" weight="fill" />
                          }
                          iconVisible
                          iconSide="left"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ElevatedContainer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ClearHistoryModal({
  isOpen,
  onClose,
  campaignId,
  campaignName,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  campaignName: string;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<"prepare" | "confirm">("prepare");
  const [generatedCode, setGeneratedCode] = useState("");
  const [messageCount, setMessageCount] = useState(0);
  const [inputCode, setInputCode] = useState("");
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("whatsappCampaignsPage.detail.clearHistory");

  const handlePrepare = () => {
    startTransition(async () => {
      const { data, error } =
        await prepareClearHistoryWhatsAppCampaignAction(campaignId);

      if (error) {
        toast.error(t("errorTitle"), { description: error });
        return;
      }

      if (data?.clearCode) {
        setGeneratedCode(data.clearCode);
        setMessageCount(data.messageCount ?? 0);
        setStep("confirm");
      }
    });
  };

  const handleConfirm = () => {
    if (inputCode.toUpperCase() !== generatedCode.toUpperCase()) {
      toast.error(t("invalidCodeTitle"), { description: t("invalidCodeDescription") });
      return;
    }

    startTransition(async () => {
      const { data, error } = await confirmClearHistoryWhatsAppCampaignAction(
        campaignId,
        inputCode.toUpperCase(),
      );

      if (error) {
        toast.error(t("errorTitle"), { description: error });
        return;
      }

      toast(t("successTitle"), { description: t("successDescription", {
          count: data?.deletedCount ?? 0,
        }) });

      onSuccess();
      setStep("prepare");
      setGeneratedCode("");
      setMessageCount(0);
      setInputCode("");
      onClose();
    });
  };

  const handleClose = () => {
    setStep("prepare");
    setGeneratedCode("");
    setMessageCount(0);
    setInputCode("");
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="fixed inset-0 bg-black/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          <motion.div
            className="relative z-10 w-full max-w-lg mx-4"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <ElevatedContainer className="border border-border bg-card overflow-hidden shadow-2xl rounded-[--radius]">
              <div className="relative flex items-center justify-between px-7 pt-6 pb-2">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-[--radius] tile-fault"
                    style={{ boxShadow: softSurfaceShadow }}
                  >
                    <Trash className="h-5 w-5 text-destructive-ink" weight="bold" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold tracking-[0.01em] text-foreground">
                      {t("title")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {campaignName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                  style={{ boxShadow: softSurfaceShadow }}
                >
                  <X className="h-4 w-4" weight="bold" />
                </button>
              </div>

              <div className="px-7 pb-6 pt-4">
                <AnimatePresence mode="wait">
                  {step === "prepare" ? (
                    <motion.div
                      key="prepare"
                      className="space-y-5"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                    >
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {t("prepareDescription")}
                      </p>

                      <motion.div
                        className="rounded-[--radius] bg-muted border border-border p-5"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                      >
                        <div className="flex gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] tile-fault flex-shrink-0">
                            <Warning
                              className="h-5 w-5 text-destructive-ink"
                              weight="fill"
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-destructive-ink mb-1">
                              {t("warningTitle")}
                            </p>
                            <p className="text-sm text-destructive-ink">
                              {t("warningDescription")}
                            </p>
                          </div>
                        </div>
                      </motion.div>

                      <div className="flex gap-3 justify-end pt-2">
                        <Button
                          variant="ghost"
                          title={t("cancelButton")}
                          onClick={handleClose}
                          disabled={isPending}
                        />
                        <Button
                          variant="action"
                          title={
                            isPending
                              ? t("generatingButton")
                              : t("generateButton")
                          }
                          onClick={handlePrepare}
                          disabled={isPending}
                          icon={<Lightning className="h-4 w-4" weight="fill" />}
                          iconVisible
                          iconSide="left"
                          className="bg-destructive hover:bg-destructive"
                        />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="confirm"
                      className="space-y-5"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {t("confirmDescription", { count: messageCount })}
                      </p>

                      <motion.div
                        className="rounded-[--radius] bg-muted border border-border p-6 text-center relative overflow-hidden"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                      >
                        <p className="text-xs font-semibold text-muted-foreground mb-3">
                          {t("yourCode")}
                        </p>
                        <div className="flex justify-center gap-2">
                          {generatedCode.split("").map((char, i) => (
                            <motion.span
                              key={i}
                              className="w-10 h-12 flex items-center justify-center bg-card rounded-lg text-2xl font-mono font-semibold text-foreground border border-border"
                              style={{ boxShadow: softSurfaceShadow }}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.2 + i * 0.05 }}
                            >
                              {char}
                            </motion.span>
                          ))}
                        </div>
                      </motion.div>

                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-foreground">
                          {t("enterCodeLabel")}
                        </label>
                        <ElevatedInput
                          value={inputCode}
                          onChange={(e) =>
                            setInputCode(
                              e.target.value.toUpperCase().slice(0, 6),
                            )
                          }
                          className="text-center text-2xl font-mono font-semibold"
                          inputClassName="text-center"
                          placeholder={t("enterCodePlaceholder")}
                          maxLength={6}
                          variant="outline"
                          controlSize="lg"
                        />
                      </div>

                      <div className="flex gap-3 justify-end pt-2">
                        <Button
                          variant="ghost"
                          title={t("cancelButton")}
                          onClick={handleClose}
                          disabled={isPending}
                        />
                        <Button
                          variant="action"
                          title={
                            isPending
                              ? t("confirmingButton")
                              : t("confirmButton")
                          }
                          onClick={handleConfirm}
                          disabled={isPending || inputCode.length !== 6}
                          icon={
                            <CheckCircle className="h-4 w-4" weight="fill" />
                          }
                          iconVisible
                          iconSide="left"
                          className="bg-destructive hover:bg-destructive"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ElevatedContainer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function WhatsAppCampaignDetailContent({
  campaign: initialCampaign,
  agentName,
  templateName,
}: WhatsAppCampaignDetailContentProps) {
  const router = useRouter();
  const { can, currentWorkspace } = useWorkspace();
  const hasActiveSubscription =
    currentWorkspace?.subscriptionStatus === "active";
  const canReadAnalysis = can("analysis", "read");
  const [isPending, startTransition] = useTransition();
  const [showResetModal, setShowResetModal] = useState(false);
  const [showClearHistoryModal, setShowClearHistoryModal] = useState(false);
  const [showCrmDialog, setShowCrmDialog] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [campaign, setCampaign] = useState<WhatsAppCampaign>(initialCampaign);
  const [entries, setEntries] = useState<WhatsAppCampaignEntryWithLead[]>([]);
  const [entriesPage, setEntriesPage] = useState(1);
  const [entriesTotalPages, setEntriesTotalPages] = useState(1);
  const [entriesTotalItems, setEntriesTotalItems] = useState(0);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [analysisStats, setAnalysisStats] = useState<AnalysisStats | null>(
    null,
  );
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [combinedFilters, setCombinedFilters] = useState<CombinedFilterValues>({
    mode: "analysis",
    analysis: {},
    conversation: {},
  });
  const [entryFilters, setEntryFilters] = useState<EntryFilterValues>({
    search: "",
    status: "",
    stageId: "",
    errorCode: "",
  });
  const [stages, setStages] = useState<Stage[]>([]);
  const [stagesLoading, setStagesLoading] = useState(false);
  const [entryStages, setEntryStages] = useState<
    Record<string, EntryStage | null>
  >({});
  const filtersRef = useRef<CombinedFilterValues>(combinedFilters);
  const entryFiltersRef = useRef<EntryFilterValues>(entryFilters);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);
  const t = useTranslations("whatsappCampaignsPage");
  const tDetail = useTranslations("campaignDetail");
  const refusalText = useSelectionSendRefusalText();
  const smartRefusal = useSmartRefusal();
  const canManageStages = can("stages", "update");
  const canReadStages = can("stages", "read");
  const { exporting, exportEntries } = useExportEntries();

  const progress = useCampaignProgress("whatsapp", initialCampaign.id);

  useEffect(() => {
    filtersRef.current = combinedFilters;
  }, [combinedFilters]);

  useEffect(() => {
    entryFiltersRef.current = entryFilters;
  }, [entryFilters]);

  useEffect(() => {
    if (!canReadStages) return;
    setStagesLoading(true);
    listStagesAction(undefined, campaign.id, "whatsapp").then(
      ({ stages: fetchedStages }) => {
        setStages(fetchedStages);
        setStagesLoading(false);
      },
    );
  }, [canReadStages, campaign.id]);

  useEffect(() => {
    if (!canReadStages || !entries.length) return;
    const entryIds = entries.map((e) => e.entry.id).filter(Boolean) as string[];
    if (!entryIds.length) return;

    getBatchEntryStagesAction(entryIds, "whatsapp").then(
      ({ entryStages: batch }) => {
        const map: Record<string, EntryStage | null> = {};
        for (const id of entryIds) {
          map[id] = batch[id] ?? null;
        }
        setEntryStages(map);
      },
    );
  }, [entries, canReadStages]);

  const liveStatus = progress.data?.status ?? campaign.status ?? "STOPPED";
  const shouldAutoRefresh = liveStatus === "RUNNING";

  const refreshCampaign = useCallback(async () => {
    const { campaign: updatedCampaign, error } =
      await getWhatsAppCampaignByIdAction(campaign.id);
    if (!error && updatedCampaign) {
      setCampaign(updatedCampaign);
    }
  }, [campaign.id]);

  const loadEntries = useCallback(
    async (
      page: number,
      showLoading = true,
      filters?: CombinedFilterValues,
      entryF?: EntryFilterValues,
    ) => {
      const currentFilters = filters ?? filtersRef.current;
      const currentEntryFilters = entryF ?? entryFiltersRef.current;

      if (showLoading) setEntriesLoading(true);

      const filterParams =
        currentFilters.mode === "analysis"
          ? currentFilters.analysis
          : currentFilters.conversation;

      const {
        entries: fetchedEntries,
        meta,
        error,
      } = await listWhatsAppCampaignEntriesAction(campaign.id, {
        page,
        pageSize: ENTRIES_PAGE_SIZE,
        order: "desc",
        sort: "updatedAt",
        ...filterParams,
        ...(currentEntryFilters.search
          ? { search: currentEntryFilters.search }
          : {}),
        ...(currentEntryFilters.status
          ? {
              status: currentEntryFilters.status as WhatsAppCampaignPhoneStatus,
            }
          : {}),
        ...(currentEntryFilters.stageId
          ? { stageId: currentEntryFilters.stageId }
          : {}),
        ...(currentEntryFilters.errorCode
          ? { errorCode: parseInt(currentEntryFilters.errorCode, 10) }
          : {}),
      });
      if (!error) {
        setEntries(fetchedEntries);
        setEntriesPage(meta.page);
        setEntriesTotalPages(meta.totalPages);
        setEntriesTotalItems(meta.totalItems);
      }
      if (showLoading) setEntriesLoading(false);
    },
    [campaign.id],
  );

  const loadAnalysisStats = useCallback(
    async (showLoading = true) => {
      if (showLoading) setAnalysisLoading(true);
      setAnalysisError(null);
      const { stats, error } = await getWhatsAppCampaignStatsAction(
        campaign.id,
      );
      if (error) {
        setAnalysisError(error);
      } else {
        setAnalysisStats(stats);
      }
      if (showLoading) setAnalysisLoading(false);
    },
    [campaign.id],
  );

  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      loadEntries(1, true, combinedFilters);
      if (canReadAnalysis) loadAnalysisStats();
    }
  }, [loadEntries, loadAnalysisStats, canReadAnalysis]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isInitialLoadRef.current) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      loadEntries(1, true, combinedFilters, entryFilters);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [combinedFilters, loadEntries]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEntryFiltersChange = useCallback(
    (newFilters: EntryFilterValues) => {
      setEntryFilters(newFilters);
      loadEntries(1, true, combinedFilters, newFilters);
    },
    [loadEntries, combinedFilters],
  );

  const handleAssignStage = useCallback(
    async (stageId: string, entryId: string, entryType: EntryType) => {
      const { entryStage, error } = await assignStageToEntryAction(
        stageId,
        entryId,
        entryType,
      );
      if (!error && entryStage) {
        setEntryStages((prev) => ({ ...prev, [entryId]: entryStage }));
      }
    },
    [],
  );

  const handleRemoveStage = useCallback(
    async (stageId: string, entryId: string, entryType: EntryType) => {
      const { error } = await removeStageFromEntryAction(
        stageId,
        entryId,
        entryType,
      );
      if (!error) {
        setEntryStages((prev) => ({ ...prev, [entryId]: null }));
      }
    },
    [],
  );

  const handleExportCSV = useCallback(async () => {
    const currentFilters = filtersRef.current;
    const currentEntryFilters = entryFiltersRef.current;
    const filterParams =
      currentFilters.mode === "analysis"
        ? currentFilters.analysis
        : currentFilters.conversation;
    const result = await exportEntries(
      { kind: "campaign", campaignId: campaign.id },
      {
        ...filterParams,
        ...(currentEntryFilters.search
          ? { search: currentEntryFilters.search }
          : {}),
        ...(currentEntryFilters.status
          ? { statuses: [currentEntryFilters.status] }
          : {}),
        ...(currentEntryFilters.stageId
          ? { stageId: currentEntryFilters.stageId }
          : {}),
      },
    );
    if ("error" in result) {
      const msg = t(`detail.export.${exportErrorKey(result.error)}`);
      toast.error(t("detail.toast.error"), { description: msg });
    } else {
      toast(t("detail.export.success"));
    }
  }, [campaign.id, exportEntries, t]);

  const followSample = useCallback(() => {
    loadEntries(entriesPage, false);
    if (canReadAnalysis) loadAnalysisStats(false);
  }, [loadEntries, entriesPage, loadAnalysisStats, canReadAnalysis]);

  useLiveFollowUp({
    sampledAt: progress.data?.sampledAt,
    liveStatus: progress.data?.status,
    campaignStatus: campaign.status,
    onSample: followSample,
    onStatusChange: refreshCampaign,
  });

  useEffect(() => {
    setCampaign(initialCampaign);
  }, [initialCampaign]);

  const status = liveStatus;
  const statusLabel = t(`status.${statusKeys[status] ?? "stopped"}`);
  const followProgress = progress.refetch;
  const report = useCampaignReport(campaign.id, shouldAutoRefresh);

  const metrics = progress.data?.metrics ?? campaign.metrics ?? EMPTY_CAMPAIGN_METRICS;

  const launchStarted = useCallback(() => {
    toast(t("detail.toast.started"), { description: t("detail.toast.updatedName", { name: campaign.name }) });
    void followProgress();
    void refreshCampaign();
  }, [campaign.name, followProgress, refreshCampaign, t]);

  const launchRefused = useCallback(
    (refusal: LaunchRefusal) => {
      toast.error(t("detail.toast.error"), { description: smartRefusal(refusal.code, refusal.expected) ?? refusalText(refusal.code, refusal.message) });
    },
    [refusalText, smartRefusal, t],
  );

  const launch = useLaunchCheck({ campaignId: campaign.id, onStarted: launchStarted, onRefused: launchRefused });

  const handleLifecycle = (action: "start" | "pause" | "stop") => {
    if (action === "start") {
      void launch.request();
      return;
    }
    startTransition(async () => {
      const actionMap = {
        pause: pauseWhatsAppCampaignAction,
        stop: stopWhatsAppCampaignAction,
      } as const;

      const toastTitleMap = {
        pause: t("detail.toast.paused"),
        stop: t("detail.toast.stopped"),
      } as const;

      const { error, errorCode, errorExpected } = await actionMap[action](campaign.id);

      if (error) {
        toast.error(t("detail.toast.error"), { description: smartRefusal(errorCode, errorExpected) ?? refusalText(errorCode, error) });
        return;
      }

      toast(toastTitleMap[action], { description: t("detail.toast.updatedName", { name: campaign.name }) });

      await followProgress();
      await refreshCampaign();
    });
  };

  const selectionSend = selectionSendControls(campaign.source, status);
  const canStart =
    selectionSend.start && (status === "STOPPED" || status === "PAUSED" || status === "COMPLETED");
  const canPause = status === "RUNNING";
  const canStop = status === "RUNNING" || status === "PAUSED";
  const canReset =
    selectionSend.reset && (status === "STOPPED" || status === "PAUSED" || status === "COMPLETED");

  const contactRows: CampaignContactRow[] = useMemo(
    () =>
      entries.map((entry) => ({
        id: entry.entry.id,
        conversationId: entry.entry.id,
        number: entry.number,
        name: entry.name ?? undefined,
        status: entry.entry.status,
        variables: entry.entry.variables,
        metadata: entry.metadata,
        updatedAt: entry.entry.updatedAt,
      })),
    [entries],
  );
  const entryById = useMemo(() => new Map(entries.map((entry) => [entry.entry.id, entry.entry])), [entries]);
  const describeFailure = useCallback(
    (row: CampaignContactRow) => {
      const entry = entryById.get(row.id);
      if (!entry || entry.status !== "FAILED") return null;
      const display = resolveWhatsAppCampaignErrorDisplay({
        errorCode: entry.errorCode,
        errorMessage: entry.errorMessage,
        hasTranslation: t.has,
        translate: t,
        unknownMessage: t("detail.metaErrors.0"),
      });
      return { description: display.description, code: display.code };
    },
    [entryById, t],
  );

  const monitoringEntries: MonitoringEntry[] = useMemo(() => {
    return entries.map((entry) => ({
      id: entry.entry.id,
      number: entry.number,
      name: entry.name,
      status: entry.entry.status,
      updatedAt: entry.entry.updatedAt,
      analysis: entry.latestAnalysis
        ? {
            interest: entry.latestAnalysis.interest,
            disposition: entry.latestAnalysis.disposition,
            sentiment: entry.latestAnalysis.sentiment,
            qualification: entry.latestAnalysis.qualification,
            attendanceQuality: entry.latestAnalysis.attendanceQuality,
            summary: entry.latestAnalysis.summary,
          }
        : null,
    }));
  }, [entries]);

  const [monitoringAllEntries, setMonitoringAllEntries] = useState<
    MonitoringEntry[]
  >([]);

  const convertToMonitoring = useCallback(
    (fetchedEntries: typeof entries) =>
      fetchedEntries.map((entry) => ({
        id: entry.entry.id,
        number: entry.number,
        name: entry.name,
        status: entry.entry.status,
        updatedAt: entry.entry.updatedAt,
        analysis: entry.latestAnalysis
          ? {
              interest: entry.latestAnalysis.interest,
              disposition: entry.latestAnalysis.disposition,
              sentiment: entry.latestAnalysis.sentiment,
              qualification: entry.latestAnalysis.qualification,
              attendanceQuality: entry.latestAnalysis.attendanceQuality,
              summary: entry.latestAnalysis.summary,
            }
          : null,
      })),
    [],
  );

  useEffect(() => {
    if (isMonitoring) {
      const loadMonitoringEntries = async () => {
        const [recentResult, analyzedResult] = await Promise.all([
          listWhatsAppCampaignEntriesAction(campaign.id, {
            page: 1,
            pageSize: 100,
            order: "desc",
            sort: "updatedAt",
          }),
          listWhatsAppCampaignEntriesAction(campaign.id, {
            page: 1,
            pageSize: 50,
            order: "desc",
            sort: "updatedAt",
            hasAnalysis: true,
          }),
        ]);
        const recentConverted = convertToMonitoring(recentResult.entries);
        const analyzedConverted = convertToMonitoring(analyzedResult.entries);
        const seen = new Set(recentConverted.map((e) => e.id));
        const merged = [
          ...recentConverted,
          ...analyzedConverted.filter((e) => !seen.has(e.id)),
        ];
        setMonitoringAllEntries(merged);
      };
      loadMonitoringEntries();
    }
  }, [isMonitoring, campaign.id, convertToMonitoring]);

  useEffect(() => {
    if (!isMonitoring || !shouldAutoRefresh) return;
    const interval = setInterval(async () => {
      const [recentResult, analyzedResult] = await Promise.all([
        listWhatsAppCampaignEntriesAction(campaign.id, {
          page: 1,
          pageSize: 100,
          order: "desc",
          sort: "updatedAt",
        }),
        listWhatsAppCampaignEntriesAction(campaign.id, {
          page: 1,
          pageSize: 50,
          order: "desc",
          sort: "updatedAt",
          hasAnalysis: true,
        }),
      ]);
      const recentConverted = convertToMonitoring(recentResult.entries);
      const analyzedConverted = convertToMonitoring(analyzedResult.entries);
      const seen = new Set(recentConverted.map((e) => e.id));
      const merged = [
        ...recentConverted,
        ...analyzedConverted.filter((e) => !seen.has(e.id)),
      ];
      setMonitoringAllEntries(merged);
      refreshCampaign();
      if (canReadAnalysis) loadAnalysisStats(false);
    }, 20000);
    return () => clearInterval(interval);
  }, [
    isMonitoring,
    shouldAutoRefresh,
    campaign.id,
    refreshCampaign,
    loadAnalysisStats,
    convertToMonitoring,
    canReadAnalysis,
  ]);

  const handleToggleMonitoring = useCallback(() => {
    setIsMonitoring((prev) => !prev);
  }, []);

  return (
    <>
    <TourGuide
      steps={whatsappDetailTourSteps}
      storageKey="tour_dismissed_wcd_v1"
      i18nNamespace="tourWhatsappCampaignDetail"
      introPalette={whatsappDetailTourPalette}
      introSeed={whatsappDetailTourSeed}
    />
    <div className="space-y-4">
      <div data-tour="wd-header">
        <LaunchCheckDialog check={launch} links={{ templateId: campaign.templateId }} />
        <CampaignHeader
          name={campaign.name}
          status={status}
          statusLabel={statusLabel}
          campaignType="whatsapp"
          backLink="/dashboard/whatsapp-campaigns"
          editLink={`/dashboard/whatsapp-campaigns/${campaign.id}/edit`}
          isPending={isPending || launch.phase !== "idle"}
          canStart={canStart}
          canPause={canPause}
          canStop={canStop}
          canReset={canReset}
          hasPermissionStart={can("whatsapp_campaigns", "start")}
          hasPermissionUpdate={can("whatsapp_campaigns", "update")}
          onShowCrm={() => setShowCrmDialog(true)}
          onReset={() => setShowResetModal(true)}
          onClearHistory={() => setShowClearHistoryModal(true)}
          onLifecycle={handleLifecycle}
          isMonitoring={isMonitoring}
          onToggleMonitoring={handleToggleMonitoring}
          hasActiveSubscription={hasActiveSubscription}
          translations={{
            back: t("detail.backButton"),
            badge: t("header.badge"),
            crm: t("detail.actions.crm"),
            edit: t("detail.actions.edit"),
            reset: t("detail.header.reset"),
            clearHistory: t("detail.clearHistory.buttonLabel"),
            stop: t("detail.actions.stop"),
            pause: t("detail.actions.pause"),
            start: t("detail.actions.start"),
            restart: t("detail.header.restart"),
            actions: t("detail.header.actions"),
            dangerZone: t("detail.header.dangerZone"),
            wsConnected: t("detail.header.wsConnected"),
            wsConnecting: t("detail.header.wsConnecting"),
            wsDisconnected: t("detail.header.wsDisconnected"),
            noPermissionStart: t("detail.noPermissionStart"),
            noPermissionUpdate: t("detail.noPermissionUpdate"),
          }}
        />
      </div>

      {selectionSend.fromLeads ? <SelectionSendNote /> : null}

      <CampaignLiveOverview
        status={status}
        metrics={metrics}
        pace={progress.data?.pace}
        sampledAt={progress.data?.sampledAt}
        progressUnavailable={progress.isError && !progress.data}
        activeStatus={entryFilters.status}
        onFilterStatus={(next) => handleEntryFiltersChange({ ...entryFilters, status: next })}
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <CampaignFunnelPanel report={report} className="lg:col-span-4" />
        <CampaignTimelinePanel
          channel="whatsapp"
          campaignId={campaign.id}
          className="lg:col-span-8"
          actions={<CampaignFullReportLink campaignId={campaign.id} />}
        />
        <CampaignFailuresPanel report={report} className="lg:col-span-4" />
        <CampaignSettingsPanel
          campaign={campaign}
          templateName={templateName}
          agentName={agentName}
          canEdit={can("whatsapp_campaigns", "update")}
          className={canReadAnalysis ? "lg:col-span-4" : "lg:col-span-8"}
        />
        {canReadAnalysis ? (
          <div className="min-w-0 lg:col-span-4" data-tour="wd-analysis">
            <AnalysisStatsPanel
              stats={analysisStats}
              loading={analysisLoading}
              error={analysisError}
              translationNamespace="whatsappCampaignsPage"
              compact
            />
          </div>
        ) : null}
      </div>

      <SmartCampaignPanel campaignId={campaign.id} contacts={metrics.totalNumbers} refreshToken={campaign} />

      <CampaignContactsTable
        entryType="whatsapp"
        rows={contactRows}
        pageSize={ENTRIES_PAGE_SIZE}
        describeFailure={describeFailure}
        loading={entriesLoading}
        totalItems={entriesTotalItems}
        page={entriesPage}
        totalPages={entriesTotalPages}
        onPageChange={(page) => loadEntries(page, true, combinedFilters, entryFiltersRef.current)}
        stages={stages}
        entryStages={entryStages}
        canManageStages={canManageStages}
        canReadStages={canReadStages}
        onAssignStage={handleAssignStage}
        onRemoveStage={handleRemoveStage}
        exporting={exporting}
        onExport={handleExportCSV}
        toolbar={
          <div data-tour="wd-entry-filters">
            <EntryFiltersBar
              bare
              campaignType="whatsapp"
              values={entryFilters}
              onChange={handleEntryFiltersChange}
              stages={stages}
              stagesLoading={stagesLoading}
              canFilterByStage={canReadStages}
              statusOptions={SEND_STATUSES.map(({ value, labelKey }) => ({
                value,
                label: t(labelKey),
              }))}
              translations={{
                searchPlaceholder: t("detail.entryFilters.searchPlaceholder"),
                statusLabel: t("detail.entryFilters.statusLabel"),
                statusAll: t("detail.entryFilters.statusAll"),
                tagLabel: t("detail.entryFilters.tagLabel"),
                tagAll: t("detail.entryFilters.tagAll"),
                tagNone: t("detail.entryFilters.tagNone"),
                clearFilters: t("detail.entryFilters.clearFilters"),
                activeFilters: t("detail.entryFilters.activeFilters"),
                errorCodePlaceholder: t("detail.entryFilters.errorCodePlaceholder"),
              }}
              renderActions={
                <>
                  {canManageStages ? (
                    <CrmStageManager
                      stages={stages}
                      onStagesChange={setStages}
                      campaignId={campaign.id}
                      campaignType="whatsapp"
                      trigger={
                        <button
                          type="button"
                          className="inline-flex h-8 items-center gap-2 rounded-[--radius] border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                        >
                          <GearSix weight="bold" className="h-4 w-4 text-muted-foreground" />
                          {tDetail("contacts.manageTags")}
                        </button>
                      }
                    />
                  ) : null}
                  <div data-tour="wd-filters">
                  <CampaignFilters
                    values={combinedFilters}
                    onChange={setCombinedFilters}
                    onApply={(mode, filters) => {
                      const newCombinedFilters: CombinedFilterValues = {
                        mode,
                        analysis:
                          mode === "analysis"
                            ? (filters as AnalysisFilterValues)
                            : {},
                        conversation:
                          mode === "conversation"
                            ? (filters as ConversationFilterValues)
                            : {},
                      };
                      setCombinedFilters(newCombinedFilters);
                      loadEntries(1, true, newCombinedFilters, entryFilters);
                    }}
                    onClear={() => {
                      const clearedFilters: CombinedFilterValues = {
                        mode: combinedFilters.mode,
                        analysis: {},
                        conversation: {},
                      };
                      setCombinedFilters(clearedFilters);
                      loadEntries(1, true, clearedFilters, entryFilters);
                    }}
                    analysisTranslations={{
                      title: t("detail.filters.title"),
                      clear: t("detail.filters.clear"),
                      apply: t("detail.filters.apply"),
                      hasAnalysis: t("detail.filters.hasAnalysis"),
                      hasAnalysisYes: t("detail.filters.hasAnalysisYes"),
                      hasAnalysisNo: t("detail.filters.hasAnalysisNo"),
                      attendanceQuality: t("detail.filters.attendanceQuality"),
                      minQuality: t("detail.filters.minQuality"),
                      maxQuality: t("detail.filters.maxQuality"),
                      interest: {
                        label: t("detail.filters.interest.label"),
                        interested: t("detail.filters.interest.interested"),
                        not_interested: t("detail.filters.interest.not_interested"),
                        undecided: t("detail.filters.interest.undecided"),
                      },
                      disposition: {
                        label: t("detail.filters.disposition.label"),
                        sale: t("detail.filters.disposition.sale"),
                        callback: t("detail.filters.disposition.callback"),
                        declined: t("detail.filters.disposition.declined"),
                        pending: t("detail.filters.disposition.pending"),
                      },
                      sentiment: {
                        label: t("detail.filters.sentiment.label"),
                        positive: t("detail.filters.sentiment.positive"),
                        neutral: t("detail.filters.sentiment.neutral"),
                        negative: t("detail.filters.sentiment.negative"),
                      },
                      qualification: {
                        label: t("detail.filters.qualification.label"),
                        hot_lead: t("detail.filters.qualification.hot_lead"),
                        warm_lead: t("detail.filters.qualification.warm_lead"),
                        cold_lead: t("detail.filters.qualification.cold_lead"),
                      },
                    }}
                    conversationTranslations={{
                      title: t("detail.conversationFilters.title"),
                      clear: t("detail.filters.clear"),
                      apply: t("detail.filters.apply"),
                      hasWhatsAppMessages: t(
                        "detail.conversationFilters.hasWhatsAppMessages",
                      ),
                      hasWhatsAppMessagesYes: t(
                        "detail.conversationFilters.hasWhatsAppMessagesYes",
                      ),
                      hasWhatsAppMessagesNo: t(
                        "detail.conversationFilters.hasWhatsAppMessagesNo",
                      ),
                      hasToolCalls: t("detail.conversationFilters.hasToolCalls"),
                      hasToolCallsYes: t(
                        "detail.conversationFilters.hasToolCallsYes",
                      ),
                      hasToolCallsNo: t("detail.conversationFilters.hasToolCallsNo"),
                      toolName: t("detail.conversationFilters.toolName"),
                      toolNamePlaceholder: t(
                        "detail.conversationFilters.toolNamePlaceholder",
                      ),
                      messageType: {
                        label: t("detail.conversationFilters.messageType.label"),
                        user_message: t(
                          "detail.conversationFilters.messageType.user_message",
                        ),
                        ai_response: t(
                          "detail.conversationFilters.messageType.ai_response",
                        ),
                        tool_call: t(
                          "detail.conversationFilters.messageType.tool_call",
                        ),
                        tool_result: t(
                          "detail.conversationFilters.messageType.tool_result",
                        ),
                        audio: t("detail.conversationFilters.messageType.audio"),
                        system: t("detail.conversationFilters.messageType.system"),
                      },
                      channel: {
                        label: t("detail.conversationFilters.channel.label"),
                        whatsapp: t("detail.conversationFilters.channel.whatsapp"),
                      },
                      minMessageCount: t(
                        "detail.conversationFilters.minMessageCount",
                      ),
                      maxMessageCount: t(
                        "detail.conversationFilters.maxMessageCount",
                      ),
                    }}
                    modeTranslations={{
                      title: t("detail.filterMode.title"),
                      subtitle: t("detail.filterMode.subtitle"),
                      analysisMode: t("detail.filterMode.analysisMode"),
                      analysisDescription: t("detail.filterMode.analysisDescription"),
                      conversationMode: t("detail.filterMode.conversationMode"),
                      conversationDescription: t(
                        "detail.filterMode.conversationDescription",
                      ),
                      clearAll: t("detail.filterMode.clearAll"),
                    }}
                    showWhatsAppFilter={false}
                    showChannelFilter={false}
                    presentation="popover"
                  />
                  </div>
                </>
              }
            />
          </div>
        }
      />

      <ResetModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        campaignId={campaign.id}
        campaignName={campaign.name}
        onSuccess={() => router.refresh()}
      />

      <ClearHistoryModal
        isOpen={showClearHistoryModal}
        onClose={() => setShowClearHistoryModal(false)}
        campaignId={campaign.id}
        campaignName={campaign.name}
        onSuccess={() => router.refresh()}
      />

      <CrmDialog
        isOpen={showCrmDialog}
        onClose={() => setShowCrmDialog(false)}
        campaignId={campaign.id}
        campaignType="whatsapp"
        translations={{
          dialogTitle: t("detail.crm.dialogTitle"),
          dialogDescription: t("detail.crm.dialogDescription"),
          inbox: {
            title: t("detail.crm.inbox.title"),
            searchPlaceholder: t("detail.crm.inbox.searchPlaceholder"),
            noConversations: t("detail.crm.inbox.noConversations"),
            connecting: t("detail.crm.inbox.connecting"),
            disconnected: t("detail.crm.inbox.disconnected"),
            connected: t("detail.crm.inbox.connected"),
            loadingMore: t("detail.crm.inbox.loadingMore"),
          },
          conversation: {
            noConversationSelected: t(
              "detail.crm.conversation.noConversationSelected",
            ),
            noConversationDescription: t(
              "detail.crm.conversation.noConversationDescription",
            ),
            loadingMore: t("detail.crm.conversation.loadingMore"),
            windowClosed: t("detail.crm.conversation.windowClosed"),
            windowClosedDescription: t(
              "detail.crm.conversation.windowClosedDescription",
            ),
            noPermissionStageAssign: t(
              "detail.crm.conversation.noPermissionStageAssign",
            ),
          },
          input: {
            placeholder: t("detail.crm.input.placeholder"),
            windowClosed: t("detail.crm.input.windowClosed"),
            windowClosedDescription: t(
              "detail.crm.input.windowClosedDescription",
            ),
            windowClosedNoClock: t("detail.crm.input.windowClosedNoClock"),
            sendButton: t("detail.crm.input.sendButton"),
            attachFile: t("detail.crm.input.attachFile"),
            recording: t("detail.crm.input.recording"),
            uploading: t("detail.crm.input.uploading"),
            windowExpires: t("detail.crm.input.windowExpires"),
            noPermissionSend: t("detail.crm.input.noPermissionSend"),
          },
        }}
      />

      <AnimatePresence>
        {isMonitoring && (
          <MonitoringMode data-tour="wd-monitoring"
            campaignType="whatsapp"
            campaignId={campaign.id}
            entries={
              monitoringAllEntries.length > 0
                ? monitoringAllEntries
                : monitoringEntries
            }
            metrics={metrics}
            analysisStats={analysisStats}
            analysisLoading={analysisLoading}
            campaignName={campaign.name}
            isRunning={shouldAutoRefresh}
            onClose={() => setIsMonitoring(false)}
          />
        )}
      </AnimatePresence>
    </div>
    </>
  );
}
