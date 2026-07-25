"use client";

import { AnimatePresence, motion } from "framer-motion";
import type {
  CallRecording,
  CallRecordingsListMeta,
} from "@/lib/call-recordings/types";
import { Clock, Funnel, Phone, Waveform, X } from "@phosphor-icons/react";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import Button from "@/components/elevated-design/button";
import CallRecordingPlayer from "@/components/dashboard/CallRecordingPlayer";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { listCallRecordingsAction } from "@/app/actions/call-recordings";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function RecordingsPage() {
  const t = useTranslations("recordingsPage");
  const { currentWorkspace } = useWorkspace();
  const [isPending, startTransition] = useTransition();

  const [recordings, setRecordings] = useState<CallRecording[]>([]);
  const [meta, setMeta] = useState<CallRecordingsListMeta>({
    page: 1,
    pageSize: 20,
    totalPages: 1,
    totalItems: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [durationFilter, setDurationFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<string>("desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);

  const loadRecordings = useCallback(() => {
    startTransition(async () => {
      setError(null);

      let minDuration: number | undefined;
      let maxDuration: number | undefined;
      if (durationFilter === "short") {
        maxDuration = 30;
      } else if (durationFilter === "medium") {
        minDuration = 30;
        maxDuration = 180;
      } else if (durationFilter === "long") {
        minDuration = 180;
      }

      const result = await listCallRecordingsAction({
        page,
        pageSize,
        minDuration,
        maxDuration,
        sortBy: sortBy as "created_at" | "duration" | "call_start",
        sortOrder: sortOrder as "asc" | "desc",
      });

      if (result.error) {
        setError(result.error);
      } else {
        setRecordings(result.recordings);
        setMeta(result.meta);
      }
    });
  }, [page, pageSize, durationFilter, sortBy, sortOrder]);

  useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);

  const clearFilters = () => {
    setDurationFilter("all");
    setSortBy("created_at");
    setSortOrder("desc");
    setPage(1);
  };

  const hasActiveFilters =
    durationFilter !== "all" ||
    sortBy !== "created_at" ||
    sortOrder !== "desc";

  const columns = useMemo<DashboardTableColumn<CallRecording>[]>(
    () => [
      {
        key: "callId",
        header: t("callId") ?? "Call ID",
        render: (row) => (
          <span className="text-sm font-medium text-foreground truncate max-w-[180px] block">
            {row.callId}
          </span>
        ),
      },
      {
        key: "duration",
        header: t("sortDuration") ?? "Duration",
        render: (row) => (
          <span className="text-sm font-bold tabular-nums text-foreground">
            {formatDuration(row.durationSec)}
          </span>
        ),
      },
      {
        key: "callStart",
        header: t("sortCallStart") ?? "Start",
        render: (row) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {formatDate(row.callStart)}
          </span>
        ),
      },
      {
        key: "callEnd",
        header: t("callEnd") ?? "End",
        render: (row) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {formatDate(row.callEnd)}
          </span>
        ),
      },
      {
        key: "player",
        header: t("player") ?? "Player",
        render: (row) => (
          <div onClick={(e) => e.stopPropagation()} className="min-w-[200px]">
            <CallRecordingPlayer
              recordingUrl={row.recordingUrl}
              durationSec={row.durationSec}
              callStart={row.callStart}
              className="border-0 bg-transparent p-0 shadow-none"
            />
          </div>
        ),
      },
    ],
    [t],
  );

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-4"
    >
      <DashboardPageHeader
        icon={<Waveform className="h-6 w-6" weight="fill" />}
        badge={t("title") ?? "Gravações de Chamadas"}
        description={
          t("subtitle") ??
          "Acesse todas as gravações de chamadas das suas campanhas"
        }
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant={showFilters ? "primary" : "ghost"}
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Funnel
                weight={showFilters ? "fill" : "regular"}
                className="h-4 w-4"
              />
              {t("filters") ?? "Filtros"}
              {hasActiveFilters && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  !
                </span>
              )}
            </Button>
          </div>
        }
      />

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ElevatedContainer className="p-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[180px]">
                  <ElevatedSelect
                    label={t("filterDuration") ?? "Duração"}
                    value={durationFilter}
                    onValueChange={(v) => {
                      setDurationFilter(v);
                      setPage(1);
                    }}
                  >
                    <ElevatedSelectItem value="all">
                      {t("allDurations") ?? "Todas as durações"}
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="short">
                      {t("shortCalls") ?? "Curtas (< 30s)"}
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="medium">
                      {t("mediumCalls") ?? "Médias (30s - 3min)"}
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="long">
                      {t("longCalls") ?? "Longas (> 3min)"}
                    </ElevatedSelectItem>
                  </ElevatedSelect>
                </div>

                <div className="min-w-[180px]">
                  <ElevatedSelect
                    label={t("sortBy") ?? "Ordenar por"}
                    value={sortBy}
                    onValueChange={setSortBy}
                  >
                    <ElevatedSelectItem value="created_at">
                      {t("sortCreatedAt") ?? "Data de criação"}
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="call_start">
                      {t("sortCallStart") ?? "Início da chamada"}
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="duration">
                      {t("sortDuration") ?? "Duração"}
                    </ElevatedSelectItem>
                  </ElevatedSelect>
                </div>

                <div className="min-w-[150px]">
                  <ElevatedSelect
                    label={t("sortOrder") ?? "Ordem"}
                    value={sortOrder}
                    onValueChange={setSortOrder}
                  >
                    <ElevatedSelectItem value="desc">
                      {t("descending") ?? "Decrescente"}
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="asc">
                      {t("ascending") ?? "Crescente"}
                    </ElevatedSelectItem>
                  </ElevatedSelect>
                </div>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    onClick={clearFilters}
                    className="flex items-center gap-1.5 text-muted-foreground"
                  >
                    <X weight="bold" className="h-4 w-4" />
                    {t("clearFilters") ?? "Limpar filtros"}
                  </Button>
                )}
              </div>
            </ElevatedContainer>
          </motion.div>
        )}
      </AnimatePresence>

      <DashboardTable<CallRecording>
        data={recordings}
        columns={columns}
        rowKey={(row) => row.callId}
        loading={isPending}
        stats={[
          {
            label: t("recordings") ?? "Gravações",
            value: isPending ? "..." : meta.totalItems,
          },
        ]}
        pagination={
          meta.totalPages > 1
            ? {
                currentPage: page,
                totalPages: meta.totalPages,
                pageSize,
                totalItems: meta.totalItems,
                onPageChange: setPage,
              }
            : undefined
        }
        emptyState={
          error
            ? {
                icon: (
                  <Waveform className="h-7 w-7 text-red-600" weight="fill" />
                ),
                title: t("noRecordings") ?? "Nenhuma gravação encontrada",
                description: error,
              }
            : {
                icon: (
                  <Waveform
                    className="h-7 w-7 text-muted-foreground/40"
                    weight="fill"
                  />
                ),
                title: t("noRecordings") ?? "Nenhuma gravação encontrada",
                description:
                  t("noRecordingsHint") ??
                  "Tente ajustar os filtros ou aguarde novas chamadas",
              }
        }
      />
    </motion.main>
  );
}
