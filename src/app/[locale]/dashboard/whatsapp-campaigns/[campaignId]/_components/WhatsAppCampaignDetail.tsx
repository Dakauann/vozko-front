"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowClockwise,
  CalendarCheck,
  CaretDown,
  ChatCircle,
  CheckCircle,
  Clock,
  DownloadSimple,
  Eye,
  GearSix,
  Info,
  Lightning,
  ListDashes,
  PaperPlaneTilt,
  ShieldWarning,
  Trash,
  UserCircle,
  Warning,
  WhatsappLogo,
  X,
} from "@/components/icons";
import type {
  WhatsAppCampaign,
  WhatsAppCampaignEntryWithLead,
  WhatsAppCampaignPhoneNumber,
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
  startWhatsAppCampaignAction,
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
import EntryStageBadge from "@/components/dashboard/EntryStageBadge";
import CampaignHeader from "@/components/dashboard/CampaignHeader";
import { type ConversationFilterValues } from "@/components/dashboard/ConversationFilters";
import Button from "@/components/elevated-design/button";
import CrmDialog from "@/components/crm/CrmDialog";
import CrmStageManager from "@/components/crm/CrmStageManager";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import EntryConversationDialog from "@/components/dashboard/EntryConversationDialog";
import MonitoringMode from "@/components/dashboard/MonitoringMode";
import type { MonitoringEntry } from "@/components/dashboard/MonitoringMode";
import { cn } from "@/lib/utils";
import { getWhatsAppCampaignStatsAction } from "@/app/actions/analysis";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";
import { useExportEntries } from "@/hooks/use-export-entries";
import { resolveWhatsAppCampaignErrorDisplay } from "@/lib/whatsapp-campaigns/error-display";
import TourGuide from "@/components/TourGuide";
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

const campaignStatusStyles: Record<string, string> = {
  STOPPED: "bg-muted text-muted-foreground",
  RUNNING: "bg-healthy text-healthy-foreground",
  PAUSED: "bg-warning text-warning-foreground",
  COMPLETED: "bg-primary text-primary-foreground",
};

const phoneStatusStyles: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  SENT: "bg-primary text-primary-foreground",
  DELIVERED: "bg-healthy text-healthy-foreground",
  READ: "bg-healthy text-healthy-foreground",
  FAILED: "bg-destructive text-destructive-foreground",
  NOT_ELIGIBLE_POSSIBLE_SPAM: "bg-warning text-warning-foreground",
};

const statusKeys: Record<string, string> = {
  STOPPED: "stopped",
  RUNNING: "running",
  PAUSED: "paused",
  COMPLETED: "completed",
};

const phoneStatusKeys: Record<string, string> = {
  PENDING: "pending",
  SENT: "sent",
  DELIVERED: "delivered",
  READ: "read",
  FAILED: "failed",
  NOT_ELIGIBLE_POSSIBLE_SPAM: "notEligiblePossibleSpam",
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

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
  const { toast } = useToast();
  const t = useTranslations("whatsappCampaignsPage.detail.reset");

  const handlePrepare = () => {
    startTransition(async () => {
      const { data, error } =
        await prepareResetWhatsAppCampaignAction(campaignId);

      if (error) {
        toast({
          title: t("errorTitle"),
          description: error,
          variant: "destructive",
        });
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
      toast({
        title: t("invalidCodeTitle"),
        description: t("invalidCodeDescription"),
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      const { data, error } = await confirmResetWhatsAppCampaignAction(
        campaignId,
        inputCode.toUpperCase(),
      );

      if (error) {
        toast({
          title: t("errorTitle"),
          description: error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: t("successTitle"),
        description: t("successDescription", {
          count: data?.numbersReset ?? 0,
        }),
      });

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
                    <h3 className="text-lg font-semibold text-foreground">
                      {t("title")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {campaignName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/8 bg-card text-muted-foreground transition-colors duration-150 hover:bg-black/5 hover:text-foreground"
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
  const { toast } = useToast();
  const t = useTranslations("whatsappCampaignsPage.detail.clearHistory");

  const handlePrepare = () => {
    startTransition(async () => {
      const { data, error } =
        await prepareClearHistoryWhatsAppCampaignAction(campaignId);

      if (error) {
        toast({
          title: t("errorTitle"),
          description: error,
          variant: "destructive",
        });
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
      toast({
        title: t("invalidCodeTitle"),
        description: t("invalidCodeDescription"),
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      const { data, error } = await confirmClearHistoryWhatsAppCampaignAction(
        campaignId,
        inputCode.toUpperCase(),
      );

      if (error) {
        toast({
          title: t("errorTitle"),
          description: error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: t("successTitle"),
        description: t("successDescription", {
          count: data?.deletedCount ?? 0,
        }),
      });

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
                    className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-destructive/10"
                    style={{ boxShadow: softSurfaceShadow }}
                  >
                    <Trash className="h-5 w-5 text-destructive" weight="bold" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {t("title")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {campaignName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/8 bg-card text-muted-foreground transition-colors duration-150 hover:bg-black/5 hover:text-foreground"
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
                        className="rounded-[--radius] bg-destructive/10 border border-destructive/50 p-5"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                      >
                        <div className="flex gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-destructive/10 flex-shrink-0">
                            <Warning
                              className="h-5 w-5 text-destructive"
                              weight="fill"
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-destructive-ink mb-1">
                              {t("warningTitle")}
                            </p>
                            <p className="text-sm text-destructive">
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
  const { toast } = useToast();
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
  const canManageStages = can("stages", "update");
  const canReadStages = can("stages", "read");
  const { exporting, exportEntries } = useExportEntries("whatsapp");

  const prevMetricsRef = useRef<{
    pending: number;
    sent: number;
    delivered: number;
    read: number;
  } | null>(null);

  const animationIdRef = useRef(0);

  const [floatingMessages, setFloatingMessages] = useState<
    Array<{
      id: string;
      fromIndex: number;
      toIndex: number;
      color: string;
    }>
  >([]);

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

  const shouldAutoRefresh = campaign.status === "RUNNING";

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
        pageSize: 20,
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
    const result = await exportEntries(campaign.id, {
      ...filterParams,
      ...(currentEntryFilters.search
        ? { search: currentEntryFilters.search }
        : {}),
      ...(currentEntryFilters.status
        ? { status: currentEntryFilters.status }
        : {}),
      ...(currentEntryFilters.stageId
        ? { stageId: currentEntryFilters.stageId }
        : {}),
    });
    if (result.error) {
      const msg =
        result.error === "noEntries"
          ? t("detail.export.noEntries")
          : t("detail.export.error");
      toast({
        title: t("detail.toast.error"),
        description: msg,
        variant: "destructive",
      });
    } else {
      toast({ title: t("detail.export.success") });
    }
  }, [campaign.id, exportEntries, toast, t]);

  useEffect(() => {
    if (!shouldAutoRefresh) return;
    const interval = setInterval(() => {
      refreshCampaign();
      loadEntries(entriesPage, false); 
      if (canReadAnalysis) loadAnalysisStats(false);
    }, 15000); 
    return () => clearInterval(interval);
  }, [
    shouldAutoRefresh,
    refreshCampaign,
    loadEntries,
    entriesPage,
    loadAnalysisStats,
    canReadAnalysis,
  ]);

  useEffect(() => {
    setCampaign(initialCampaign);
  }, [initialCampaign]);

  const status = campaign.status ?? "STOPPED";
  const statusKey = statusKeys[status] ?? "stopped";
  const statusLabel = t(`status.${statusKey}`);
  const statusClass =
    campaignStatusStyles[status] ?? "bg-muted text-muted-foreground";

  const metrics = campaign.metrics ?? {
    totalNumbers: 0,
    pending: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    notEligiblePossibleSpam: 0,
    dispatches: 0,
    completionRate: 0,
    successRate: 0,
  };

  const handleLifecycle = (action: "start" | "pause" | "stop") => {
    startTransition(async () => {
      const actionMap = {
        start: startWhatsAppCampaignAction,
        pause: pauseWhatsAppCampaignAction,
        stop: stopWhatsAppCampaignAction,
      } as const;

      const toastTitleMap = {
        start: t("detail.toast.started"),
        pause: t("detail.toast.paused"),
        stop: t("detail.toast.stopped"),
      } as const;

      const { error } = await actionMap[action](campaign.id);

      if (error) {
        toast({
          title: t("detail.toast.error"),
          description: error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: toastTitleMap[action],
        description: `${campaign.name} atualizado`,
      });

      router.refresh();
    });
  };

  const canStart =
    status === "STOPPED" || status === "PAUSED" || status === "COMPLETED";
  const canPause = status === "RUNNING";
  const canStop = status === "RUNNING" || status === "PAUSED";
  const canReset =
    status === "STOPPED" || status === "PAUSED" || status === "COMPLETED";

  useEffect(() => {
    const currentMetrics = {
      pending: metrics.pending,
      sent: metrics.sent,
      delivered: metrics.delivered,
      read: metrics.read,
    };

    const prev = prevMetricsRef.current;
    if (prev) {
      const stageKeys = ["pending", "sent", "delivered", "read"] as const;
      const stageColors = ["#64748b", "#3b82f6", "#14b8a6", "#8b5cf6"];
      const newFloatingMessages: typeof floatingMessages = [];

      for (let i = 0; i < stageKeys.length - 1; i++) {
        const currentKey = stageKeys[i];
        const nextKey = stageKeys[i + 1];
        const prevCurrent = prev[currentKey];
        const nowCurrent = currentMetrics[currentKey];
        const prevNext = prev[nextKey];
        const nowNext = currentMetrics[nextKey];

        const decrease = prevCurrent - nowCurrent;
        const increase = nowNext - prevNext;

        if (decrease > 0 && increase > 0) {
          const transfers = Math.min(decrease, increase, 5); 
          for (let j = 0; j < transfers; j++) {
            animationIdRef.current += 1;
            newFloatingMessages.push({
              id: `flow-${animationIdRef.current}-${i}-${j}`,
              fromIndex: i + 1, // +1 because Total card is at index 0
              toIndex: i + 2,
              color: stageColors[i],
            });
          }
        }
      }

      if (newFloatingMessages.length > 0) {
        setFloatingMessages((prev) => [...prev, ...newFloatingMessages]);

        setTimeout(() => {
          setFloatingMessages((prev) =>
            prev.filter(
              (p) => !newFloatingMessages.some((np) => np.id === p.id),
            ),
          );
        }, 1200);
      }
    }

    prevMetricsRef.current = currentMetrics;
  }, [metrics.pending, metrics.sent, metrics.delivered, metrics.read]);

  const displayEntries = useMemo(() => {
    return entries.map(
      (entry) =>
        ({
          id: entry.entry.id,
          number: entry.number,
          name: entry.name,
          variables: entry.entry.variables,
          metadata: entry.metadata,
          status: entry.entry.status,
          errorCode: entry.entry.errorCode,
          errorMessage: entry.entry.errorMessage,
          updatedAt: entry.entry.updatedAt,
        }) as WhatsAppCampaignPhoneNumber,
    );
  }, [entries]);

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
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        data-tour="wd-header"
      >
        <CampaignHeader
          name={campaign.name}
          status={status}
          campaignType="whatsapp"
          backLink="/dashboard/whatsapp-campaigns"
          editLink={`/dashboard/whatsapp-campaigns/${campaign.id}/edit`}
          isPending={isPending}
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
            reset: "RESETAR",
            clearHistory: t("detail.clearHistory.buttonLabel"),
            stop: t("detail.actions.stop"),
            pause: t("detail.actions.pause"),
            start: t("detail.actions.start"),
            restart: "REINICIAR",
            actions: "AÇÕES",
            dangerZone: "Zona de Risco",
            wsConnected: "Conectado",
            wsConnecting: "Conectando...",
            wsDisconnected: "Desconectado",
            noPermissionStart: t("detail.noPermissionStart"),
            noPermissionUpdate: t("detail.noPermissionUpdate"),
          }}
        />
      </motion.div>

      {/* Dashboard Grid Layout - Campaign Info + AI Analysis */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className={cn("grid gap-4", canReadAnalysis ? "lg:grid-cols-3" : "")}
      >
        {/* Campaign Info - Takes 2 columns */}
        <div
          className={cn(
            "rounded-[--radius] max-h-max border border-border bg-card p-6",
            canReadAnalysis ? "lg:col-span-2" : "lg:col-span-1",
          )}
          style={{ boxShadow: softSurfaceShadow }}
          data-tour="wd-info"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[--radius] bg-healthy">
                <WhatsappLogo className="h-6 w-6 text-white" weight="fill" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {campaign.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Template: {templateName || campaign.templateId}</span>
                  {campaign.businessPhone && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span>
                        Telefone:{" "}
                        {campaign.businessPhone.verifiedName ||
                          campaign.businessPhone.displayPhoneNumber}
                      </span>
                    </>
                  )}
                  {campaign.enableAgentResponses && agentName && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-healthy">
                        Agente: {agentName}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[--radius] px-2.5 py-1 text-[11px] font-medium",
                statusClass,
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {statusLabel}
            </span>
          </div>

          <div className="relative">
            {/* Floating message animations */}
            <AnimatePresence>
              {floatingMessages.map((msg, msgIdx) => {
                const cardCount = 6;
                const cardWidth = 100 / cardCount;
                const fromX = msg.fromIndex * cardWidth + cardWidth / 2;
                const toX = msg.toIndex * cardWidth + cardWidth / 2;
                const delayOffset = msgIdx * 0.1;

                return (
                  <motion.div
                    key={msg.id}
                    className="absolute z-20 pointer-events-none"
                    initial={{
                      left: `${fromX}%`,
                      top: "50%",
                      x: "-50%",
                      y: "-50%",
                      opacity: 1,
                      scale: 1,
                    }}
                    animate={{
                      left: [`${fromX}%`, `${(fromX + toX) / 2}%`, `${toX}%`],
                      top: ["50%", "-20%", "50%"],
                      opacity: [1, 1, 0],
                      scale: [1, 1.2, 0.8],
                    }}
                    exit={{ opacity: 0, scale: 0 }}
                    transition={{
                      duration: 1,
                      delay: delayOffset,
                      ease: "easeInOut",
                      times: [0, 0.5, 1],
                    }}
                  >
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full shadow-lg"
                      style={{ backgroundColor: msg.color }}
                    >
                      <ChatCircle
                        weight="fill"
                        className="h-4 w-4 text-white"
                      />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" data-tour="wd-metrics">
              {/* Total */}
              <div className="group relative flex items-center gap-3 p-4 rounded-[--radius] border border-border bg-card overflow-hidden">
                <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-healthy opacity-[0.06] blur-2xl" />
                <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-muted shadow-lg">
                  <WhatsappLogo weight="fill" className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {t("detail.metrics.total")}
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    {metrics.totalNumbers.toLocaleString()}
                  </p>
                </div>
              </div>
              {/* Pending */}
              <div className="group relative flex items-center gap-3 p-4 rounded-[--radius] border border-border bg-card overflow-hidden">
                <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-muted opacity-[0.06] blur-2xl" />
                <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-muted shadow-lg">
                  <Clock weight="fill" className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {t("detail.metrics.pending")}
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    {metrics.pending.toLocaleString()}
                  </p>
                </div>
              </div>
              {/* Sent */}
              <div className="group relative flex items-center gap-3 p-4 rounded-[--radius] border border-border bg-card overflow-hidden">
                <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-muted opacity-[0.06] blur-2xl" />
                <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-muted shadow-lg">
                  <PaperPlaneTilt
                    weight="fill"
                    className="h-5 w-5 text-white"
                  />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {t("detail.metrics.sent")}
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    {metrics.sent.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {metrics.completionRate.toFixed(1)}%
                  </p>
                </div>
              </div>
              {/* Delivered */}
              <div className="group relative flex items-center gap-3 p-4 rounded-[--radius] border border-border bg-card overflow-hidden">
                <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-muted opacity-[0.06] blur-2xl" />
                <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-muted shadow-lg">
                  <CheckCircle weight="fill" className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {t("detail.metrics.delivered")}
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    {metrics.delivered.toLocaleString()}
                  </p>
                </div>
              </div>
              {/* Read */}
              <div className="group relative flex items-center gap-3 p-4 rounded-[--radius] border border-border bg-card overflow-hidden">
                <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-muted opacity-[0.06] blur-2xl" />
                <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-muted shadow-lg">
                  <Eye weight="fill" className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {t("detail.metrics.read")}
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    {metrics.read.toLocaleString()}
                  </p>
                </div>
              </div>
              {/* Failed */}
              <div className="group relative flex items-center gap-3 p-4 rounded-[--radius] border border-border bg-card overflow-hidden">
                <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-destructive opacity-[0.06] blur-2xl" />
                <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-muted shadow-lg">
                  <Warning weight="fill" className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {t("detail.metrics.failed")}
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    {metrics.failed.toLocaleString()}
                  </p>
                </div>
              </div>
              {/* Not Eligible (Possible Spam) */}
              <div className="group relative flex items-center gap-3 p-4 rounded-[--radius] border border-border bg-card overflow-hidden">
                <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-warning opacity-[0.06] blur-2xl" />
                <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-muted shadow-lg">
                  <ShieldWarning weight="fill" className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {t("detail.metrics.notEligiblePossibleSpam")}
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    {metrics.notEligiblePossibleSpam.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 min-h-[42px]" data-tour="wd-filters">
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
                  no_answer: t("detail.filters.disposition.no_answer"),
                  voicemail: t("detail.filters.disposition.voicemail"),
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
                  voice: t("detail.conversationFilters.channel.voice"),
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
            />
          </div>
        </div>

        {canReadAnalysis && (
          <AnalysisStatsPanel data-tour="wd-analysis"
            stats={analysisStats}
            loading={analysisLoading}
            error={analysisError}
            translationNamespace="whatsappCampaignsPage"
            compact
          />
        )}
        {/* AI Analysis Stats - Compact */}
      </motion.div>

      {/* Combined Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      ></motion.div>

      {/* Entry Filters Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.28 }}
        data-tour="wd-entry-filters"
      >
        <EntryFiltersBar
          campaignType="whatsapp"
          values={entryFilters}
          onChange={handleEntryFiltersChange}
          stages={stages}
          stagesLoading={stagesLoading}
          canFilterByStage={canReadStages}
          statusOptions={[
            { value: "PENDING", label: t("status.pending") },
            { value: "SENT", label: t("status.sent") },
            { value: "DELIVERED", label: t("status.delivered") },
            { value: "READ", label: t("status.read") },
            { value: "FAILED", label: t("status.failed") },
            {
              value: "NOT_ELIGIBLE_POSSIBLE_SPAM",
              label: t("status.notEligiblePossibleSpam"),
            },
          ]}
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
            canManageStages ? (
              <CrmStageManager
                stages={stages}
                onStagesChange={setStages}
                campaignId={campaign.id}
                campaignType="whatsapp"
                trigger={
                  <button className="inline-flex items-center gap-2 rounded-[--radius] border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 ease-out hover:bg-muted">
                    <GearSix weight="bold" className="h-4 w-4" />
                    Tags
                  </button>
                }
              />
            ) : undefined
          }
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        data-tour="wd-contacts"
      >
        <div
          className="rounded-[--radius] border border-border bg-card p-8"
          style={{ boxShadow: softSurfaceShadow }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-healthy text-healthy-foreground">
                <UserCircle weight="bold" className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {t("detail.contactsTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("detail.contactsDescription")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 rounded-[--radius] bg-healthy px-3 py-1.5 text-xs font-semibold text-healthy-foreground">
                <CheckCircle weight="fill" className="h-4 w-4" />
                {entriesTotalItems} {t("detail.records")}
              </span>
              <Button
                variant="outline-subtle"
                title={
                  exporting
                    ? t("detail.export.exporting")
                    : t("detail.export.button")
                }
                icon={<DownloadSimple weight="bold" className="h-4 w-4" />}
                iconVisible
                iconSide="left"
                onClick={handleExportCSV}
                disabled={exporting}
              />
            </div>
          </div>

          {entriesLoading ? (
            <div className="min-h-[400px] flex items-center justify-center rounded-[--radius] border border-border bg-muted px-6 py-8 text-sm text-muted-foreground">
              <div className="flex flex-col items-center gap-3">
                <div className="h-6 w-6 animate-spin rounded-full border border-foreground/20 border-t-emerald-500" />
                <span>{t("detail.loading")}</span>
              </div>
            </div>
          ) : (
            <div className="min-h-[400px]">
              <div className="grid gap-4 lg:grid-cols-2">
                {displayEntries.map((contact, index) => {
                  const statusCode = contact.status ?? "PENDING";
                  const badgeClass =
                    phoneStatusStyles[statusCode] ??
                    "bg-muted text-muted-foreground";
                  const statusKey = phoneStatusKeys[statusCode] ?? "pending";
                  const statusLabel = t(`status.${statusKey}`);
                  const errorDisplay =
                    statusCode === "FAILED"
                      ? resolveWhatsAppCampaignErrorDisplay({
                          errorCode: contact.errorCode,
                          errorMessage: contact.errorMessage,
                          hasTranslation: t.has,
                          translate: t,
                          unknownMessage: t("detail.metaErrors.0"),
                        })
                      : null;

                  return (
                    <motion.div
                      key={contact.id || contact.number}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: Math.min(0.5 + index * 0.02, 1.5),
                      }}
                      className="group relative rounded-[--radius] border border-border bg-card p-5 transition-all duration-200 hover:shadow-md hover:border-foreground/20"
                    >
                      {/* Header Row */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          {contact.id && (
                            <EntryConversationDialog
                              entryId={contact.id}
                              entryType="whatsapp"
                              phoneNumber={contact.number}
                              contactName={contact.name}
                              trigger={
                                <button
                                  type="button"
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-[--radius] bg-healthy text-healthy-foreground transition-all hover:bg-healthy hover:scale-105"
                                  title="Ver conversa"
                                >
                                  <ChatCircle
                                    weight="fill"
                                    className="h-5 w-5"
                                  />
                                </button>
                              }
                            />
                          )}
                          <div>
                            <p className="text-lg font-semibold text-foreground tracking-wide">
                              {contact.number}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {contact.name ? (
                                <span className="text-sm font-medium text-muted-foreground">
                                  {contact.name}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground italic">
                                  {t("detail.noName")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold",
                            badgeClass,
                          )}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {statusLabel}
                        </span>
                      </div>

                      {/* Error info for failed entries */}
                      {errorDisplay?.show ? (
                        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 dark:border-destructive/30 dark:bg-destructive/10">
                          {errorDisplay.code !== null ? (
                            <p className="text-[11px] font-semibold text-destructive dark:text-destructive">
                              {t("detail.errorCode")}: {errorDisplay.code}
                            </p>
                          ) : null}
                          <p className="mt-0.5 text-[11px] text-destructive dark:text-destructive line-clamp-2">
                            {errorDisplay.description}
                          </p>
                        </div>
                      ) : null}

                      {/* Stage */}
                      {contact.id && (
                        <div className="flex items-center gap-2 mb-3">
                          <EntryStageBadge
                            entryId={contact.id}
                            entryType="whatsapp"
                            currentStage={entryStages[contact.id]}
                            stages={stages}
                            canManage={canManageStages}
                            canRead={canReadStages}
                            translations={{
                              addStage: t("detail.EntryStageBadge.addTag"),
                              removeStage: t(
                                "detail.EntryStageBadge.removeTag",
                              ),
                              noStages: t("detail.EntryStageBadge.noTags"),
                              changeStage: t(
                                "detail.EntryStageBadge.changeTag",
                              ),
                            }}
                            onAssign={handleAssignStage}
                            onRemove={handleRemoveStage}
                          />
                        </div>
                      )}

                      {/* Variables */}
                      {contact.variables && contact.variables.length > 0 && (
                        <details className="mb-3 group/vars">
                          <summary className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                            <ListDashes weight="bold" className="h-3.5 w-3.5" />
                            {t("detail.variables")}
                            <CaretDown
                              weight="bold"
                              className="h-3 w-3 transition-transform duration-200 group-open/vars:rotate-180"
                            />
                          </summary>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {contact.variables.map((variable, vi) => (
                              <span
                                key={vi}
                                className="inline-flex items-center gap-1 rounded-md bg-healthy border border-healthy px-2 py-1 text-[11px] text-healthy-foreground"
                              >
                                <span className="font-semibold text-white">
                                  {`{{${vi + 1}}}`}
                                </span>
                                <span>{variable}</span>
                              </span>
                            ))}
                          </div>
                        </details>
                      )}

                      {/* Metadata */}
                      {contact.metadata &&
                        Object.entries(contact.metadata).filter(
                          ([, v]) =>
                            v !== null &&
                            v !== undefined &&
                            String(v).trim() !== "",
                        ).length > 0 && (
                          <details className="mb-3 group/meta">
                            <summary className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                              <Info weight="fill" className="h-3.5 w-3.5" />
                              {t("detail.metadata")}
                              <CaretDown
                                weight="bold"
                                className="h-3 w-3 transition-transform duration-200 group-open/meta:rotate-180"
                              />
                            </summary>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {Object.entries(contact.metadata)
                                .filter(
                                  ([, v]) =>
                                    v !== null &&
                                    v !== undefined &&
                                    String(v).trim() !== "",
                                )
                                .map(([key, value]) => (
                                  <span
                                    key={key}
                                    className="inline-flex items-center gap-1 rounded-md bg-muted border border-border px-2 py-1 text-[11px] text-muted-foreground"
                                  >
                                    <span className="font-semibold text-muted-foreground">
                                      {key}:
                                    </span>
                                    <span>{String(value)}</span>
                                  </span>
                                ))}
                            </div>
                          </details>
                        )}

                      {/* Footer */}
                      <div className="flex items-center gap-2 pt-3 border-t border-border">
                        <CalendarCheck
                          weight="fill"
                          className="h-3.5 w-3.5 text-muted-foreground"
                        />
                        <span suppressHydrationWarning>
                          {formatDate(campaign.updatedAt)}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
                {!displayEntries.length && (
                  <div className="col-span-2 rounded-[--radius] border border-border bg-muted px-6 py-8 text-center text-sm text-muted-foreground">
                    {t("detail.noContacts")}
                  </div>
                )}
              </div>

              {/* Pagination */}
              {entriesTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={entriesPage <= 1 || entriesLoading}
                    onClick={() =>
                      loadEntries(
                        entriesPage - 1,
                        true,
                        combinedFilters,
                        entryFiltersRef.current,
                      )
                    }
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {entriesPage} / {entriesTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      entriesPage >= entriesTotalPages || entriesLoading
                    }
                    onClick={() =>
                      loadEntries(
                        entriesPage + 1,
                        true,
                        combinedFilters,
                        entryFiltersRef.current,
                      )
                    }
                  >
                    Próximo
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

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
            sendButton: t("detail.crm.input.sendButton"),
            attachFile: t("detail.crm.input.attachFile"),
            recording: t("detail.crm.input.recording"),
            uploading: t("detail.crm.input.uploading"),
            windowExpires: t("detail.crm.input.windowExpires"),
            noPermissionSend: t("detail.crm.input.noPermissionSend"),
          },
        }}
      />

      {/* Monitoring Mode Overlay */}
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
            isRunning={campaign.status === "RUNNING"}
            onClose={() => setIsMonitoring(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
    </>
  );
}
