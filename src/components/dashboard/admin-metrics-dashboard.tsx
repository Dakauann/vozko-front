"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  ArrowClockwise,
  Calendar,
  ChartBar,
  ChartLine,
  ChartPie,
  Clock,
  DotsSixVertical,
  EnvelopeSimple,
  Funnel,
  PhoneCall,
  Plus,
  Pulse,
  Trash,
  TrendUp,
  User,
  Users,
  WhatsappLogo,
} from "@/components/icons";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import {
  MetricsListResponse,
  MetricsStatsResponse,
  MetricsTimeSeriesResponse,
  getBusinessMetricsAction,
  getBusinessMetricsStatsAction,
  getBusinessMetricsTimeSeriesAction,
} from "@/app/actions/business-metrics";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/elevated-design/elevated-tabs";
import { format, subDays } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";

import Button from "@/components/elevated-design/button";
import { EVENT_TYPES } from "@/lib/business-metrics/types";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { ElevatedDatePicker } from "@/components/elevated-design/elevated-date-picker";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import GradientText from "@/components/elevated-design/gradient-text";
import { ReadoutBar } from "@/components/console/page-shapes";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
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
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

const CHART_COLORS = {
  users: "#3b82f6", // blue
  campaigns: "#f59e0b", // amber
  calls: "#06b6d4", // cyan
  whatsapp: "#22c55e", // green
  email: "#ec4899", // pink
};

const EVENT_COLORS: Record<string, string> = {
  user_account_created: "#3b82f6",
  user_login: "#60a5fa",
  campaign_started: "#f59e0b",
  campaign_stopped: "#fbbf24",
  call_started: "#06b6d4",
  call_ended: "#22d3ee",
  whatsapp_message_sent: "#22c55e",
  whatsapp_template_message_sent: "#4ade80",
  email_sent: "#ec4899",
};

type DateRangePreset = "24h" | "7d" | "30d" | "90d" | "custom";
type IntervalType = "hour" | "day" | "week" | "month";

interface DateRange {
  start: string;
  end: string;
}

function getDateRangeFromPreset(preset: DateRangePreset): DateRange {
  const now = new Date();
  const end = now.toISOString();

  switch (preset) {
    case "24h":
      return { start: subDays(now, 1).toISOString(), end };
    case "7d":
      return { start: subDays(now, 7).toISOString(), end };
    case "30d":
      return { start: subDays(now, 30).toISOString(), end };
    case "90d":
      return { start: subDays(now, 90).toISOString(), end };
    default:
      return { start: subDays(now, 30).toISOString(), end };
  }
}

function getRecommendedInterval(preset: DateRangePreset): IntervalType {
  switch (preset) {
    case "24h":
      return "hour";
    case "7d":
      return "day";
    case "30d":
      return "day";
    case "90d":
      return "week";
    default:
      return "day";
  }
}

function CategoryStatsGrid({
  stats,
  loading,
  t,
}: {
  stats: MetricsStatsResponse | null;
  loading: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const categoryStats = useMemo(() => {
    if (!stats) return [];

    const eventCounts = stats.event_counts;

    return [
      {
        category: "users",
        title: t("categories.users"),
        icon: Users,
        color: "bg-muted",
        total:
          (eventCounts[EVENT_TYPES.USER_ACCOUNT_CREATED] || 0) +
          (eventCounts[EVENT_TYPES.USER_LOGIN] || 0),
        breakdown: [
          {
            label: t("events.user_account_created"),
            value: eventCounts[EVENT_TYPES.USER_ACCOUNT_CREATED] || 0,
          },
          {
            label: t("events.user_login"),
            value: eventCounts[EVENT_TYPES.USER_LOGIN] || 0,
          },
        ],
      },
      {
        category: "calls",
        title: t("categories.calls"),
        icon: PhoneCall,
        color: "bg-muted",
        total:
          (eventCounts[EVENT_TYPES.CALL_STARTED] || 0) +
          (eventCounts[EVENT_TYPES.CALL_ENDED] || 0),
        breakdown: [
          {
            label: t("events.call_started"),
            value: eventCounts[EVENT_TYPES.CALL_STARTED] || 0,
          },
          {
            label: t("events.call_ended"),
            value: eventCounts[EVENT_TYPES.CALL_ENDED] || 0,
          },
        ],
      },
      {
        category: "whatsapp",
        title: t("categories.whatsapp"),
        icon: WhatsappLogo,
        color: "bg-healthy",
        total:
          (eventCounts[EVENT_TYPES.WHATSAPP_MESSAGE_SENT] || 0) +
          (eventCounts[EVENT_TYPES.WHATSAPP_TEMPLATE_MESSAGE_SENT] || 0),
        breakdown: [
          {
            label: t("events.whatsapp_message_sent"),
            value: eventCounts[EVENT_TYPES.WHATSAPP_MESSAGE_SENT] || 0,
          },
          {
            label: t("events.whatsapp_template_message_sent"),
            value: eventCounts[EVENT_TYPES.WHATSAPP_TEMPLATE_MESSAGE_SENT] || 0,
          },
        ],
      },
      {
        category: "email",
        title: t("categories.email"),
        icon: EnvelopeSimple,
        color: "bg-pink-500",
        total: eventCounts[EVENT_TYPES.EMAIL_SENT] || 0,
        breakdown: [
          {
            label: t("events.email_sent"),
            value: eventCounts[EVENT_TYPES.EMAIL_SENT] || 0,
          },
        ],
      },
    ];
  }, [stats, t]);

  // LEDGER. Six category totals are context for the charts below, not six
  // separate objects: they were six bordered cards with six coloured icon
  // tiles, which spent the top of an admin page — and the one accent this
  // interface has — on decoration. One engraved line reports the same numbers.
  return (
    <ReadoutBar
      legend={t("stats.legend")}
      readouts={categoryStats.map((cat) => ({
        label: cat.title,
        value: loading ? "—" : cat.total.toLocaleString(),
      }))}
    />
  );
}

function TimeSeriesChart({
  data,
  interval,
  loading,
  selectedEvents,
  t,
}: {
  data: MetricsTimeSeriesResponse | null;
  interval: IntervalType;
  loading: boolean;
  selectedEvents: string[];
  t: ReturnType<typeof useTranslations>;
}) {
  const chartData = useMemo(() => {
    if (!data?.data) return [];

    const timestampSet = new Set<string>();
    Object.values(data.data).forEach((series) => {
      series.forEach((point) => timestampSet.add(point.timestamp));
    });

    const timestamps = Array.from(timestampSet).sort();

    return timestamps.map((timestamp) => {
      const point: Record<string, number | string> = {
        timestamp,
        formattedTime: formatTimestamp(timestamp, interval),
      };

      Object.entries(data.data).forEach(([eventType, series]) => {
        const match = series.find((p) => p.timestamp === timestamp);
        point[eventType] = match?.count || 0;
      });

      return point;
    });
  }, [data, interval]);

  const visibleEventTypes = useMemo(() => {
    if (!data?.data) return [];
    return selectedEvents.length > 0
      ? selectedEvents.filter((e) => data.data[e])
      : Object.keys(data.data);
  }, [data, selectedEvents]);

  const chartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};
    visibleEventTypes.forEach((eventType) => {
      config[eventType] = {
        label: t(`events.${eventType}` as Parameters<typeof t>[0]),
        color: EVENT_COLORS[eventType] || "#8884d8",
      };
    });
    return config;
  }, [visibleEventTypes, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 400 }}>
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div
        className="flex flex-col items-center justify-center text-muted-foreground"
        style={{ height: 400 }}
      >
        <ChartLine className="h-12 w-12 mb-2 text-muted-foreground" weight="fill" />
        <p>{t("noDataAvailable")}</p>
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[400px] w-full">
      <AreaChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
      >
        <defs>
          {visibleEventTypes.map((eventType) => (
            <linearGradient
              key={eventType}
              id={`gradient-ts-${eventType}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={`var(--color-${eventType})`}
                stopOpacity={0.4}
              />
              <stop
                offset="100%"
                stopColor={`var(--color-${eventType})`}
                stopOpacity={0.02}
              />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="4 4" vertical={false} />
        <XAxis
          dataKey="formattedTime"
          tickLine={false}
          axisLine={false}
          fontSize={11}
        />
        <YAxis tickLine={false} axisLine={false} fontSize={11} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {chartConfig[name as string]?.label ?? name}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {(value as number).toLocaleString()}
                  </span>
                </div>
              )}
            />
          }
        />
        {visibleEventTypes.map((eventType) => (
          <Area
            key={eventType}
            type="monotoneX"
            dataKey={eventType}
            stroke={`var(--color-${eventType})`}
            strokeWidth={2.5}
            fill={`url(#gradient-ts-${eventType})`}
            dot={false}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}

function formatTimestamp(timestamp: string, interval: IntervalType): string {
  const date = new Date(timestamp);
  switch (interval) {
    case "hour":
      return format(date, "HH:mm");
    case "day":
      return format(date, "dd/MM");
    case "week":
      return format(date, "dd/MM");
    case "month":
      return format(date, "MMM yy");
    default:
      return format(date, "dd/MM HH:mm");
  }
}

function DistributionPieChart({
  stats,
  loading,
  t,
}: {
  stats: MetricsStatsResponse | null;
  loading: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const pieData = useMemo(() => {
    if (!stats?.event_counts) return [];

    return Object.entries(stats.event_counts)
      .filter(([, count]) => count > 0)
      .map(([eventType, count]) => ({
        name: eventType,
        value: count,
        color: EVENT_COLORS[eventType] || "#8884d8",
        fill: EVENT_COLORS[eventType] || "#8884d8",
      }))
      .sort((a, b) => b.value - a.value);
  }, [stats]);

  const pieConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};
    pieData.forEach((item) => {
      config[item.name] = {
        label: t(`events.${item.name}` as Parameters<typeof t>[0]),
        color: item.color,
      };
    });
    return config;
  }, [pieData, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 300 }}>
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!pieData.length) {
    return (
      <div
        className="flex flex-col items-center justify-center text-muted-foreground"
        style={{ height: 300 }}
      >
        <ChartPie className="h-12 w-12 mb-2 text-muted-foreground" weight="fill" />
        <p>{t("noDataAvailable")}</p>
      </div>
    );
  }

  return (
    <ChartContainer config={pieConfig} className="h-[300px] w-full">
      <PieChart>
        <Pie
          data={pieData}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={95}
          paddingAngle={3}
          dataKey="value"
          nameKey="name"
          cornerRadius={6}
          strokeWidth={2}
          stroke="hsl(var(--background))"
        >
          {pieData.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <ChartTooltip
          content={
            <ChartTooltipContent
              nameKey="name"
              formatter={(value, name) => (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {pieConfig[name as string]?.label ?? name}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {(value as number).toLocaleString()}
                  </span>
                </div>
              )}
            />
          }
        />
      </PieChart>
    </ChartContainer>
  );
}

function CategoryBarChart({
  stats,
  loading,
  t,
}: {
  stats: MetricsStatsResponse | null;
  loading: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const barData = useMemo(() => {
    if (!stats?.event_counts) return [];

    const eventCounts = stats.event_counts;

    return [
      {
        name: t("categories.users"),
        value:
          (eventCounts[EVENT_TYPES.USER_ACCOUNT_CREATED] || 0) +
          (eventCounts[EVENT_TYPES.USER_LOGIN] || 0),
        color: CHART_COLORS.users,
        fill: CHART_COLORS.users,
      },
      {
        name: t("categories.calls"),
        value:
          (eventCounts[EVENT_TYPES.CALL_STARTED] || 0) +
          (eventCounts[EVENT_TYPES.CALL_ENDED] || 0),
        color: CHART_COLORS.calls,
        fill: CHART_COLORS.calls,
      },
      {
        name: t("categories.whatsapp"),
        value:
          (eventCounts[EVENT_TYPES.WHATSAPP_MESSAGE_SENT] || 0) +
          (eventCounts[EVENT_TYPES.WHATSAPP_TEMPLATE_MESSAGE_SENT] || 0),
        color: CHART_COLORS.whatsapp,
        fill: CHART_COLORS.whatsapp,
      },
      {
        name: t("categories.email"),
        value: eventCounts[EVENT_TYPES.EMAIL_SENT] || 0,
        color: CHART_COLORS.email,
        fill: CHART_COLORS.email,
      },
    ].filter((item) => item.value > 0);
  }, [stats, t]);

  const barConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};
    barData.forEach((item) => {
      config[item.name] = { label: item.name, color: item.color };
    });
    config["value"] = { label: t("events.count") };
    return config;
  }, [barData, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 300 }}>
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!barData.length) {
    return (
      <div
        className="flex flex-col items-center justify-center text-muted-foreground"
        style={{ height: 300 }}
      >
        <ChartBar className="h-12 w-12 mb-2 text-muted-foreground" weight="fill" />
        <p>{t("noDataAvailable")}</p>
      </div>
    );
  }

  return (
    <ChartContainer config={barConfig} className="h-[300px] w-full">
      <BarChart
        data={barData}
        layout="vertical"
        margin={{ left: 90, right: 20, top: 10, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="4 4" horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          width={85}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <span className="font-semibold tabular-nums">
                  {(value as number).toLocaleString()}
                </span>
              )}
            />
          }
        />
        <Bar
          dataKey="value"
          name={t("events.count")}
          radius={[0, 8, 8, 0]}
          barSize={28}
        >
          {barData.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function RecentActivityList({
  data,
  loading,
  t,
}: {
  data: MetricsListResponse | null;
  loading: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case EVENT_TYPES.USER_ACCOUNT_CREATED:
      case EVENT_TYPES.USER_LOGIN:
        return User;
      case EVENT_TYPES.CAMPAIGN_STARTED:
      case EVENT_TYPES.CAMPAIGN_STOPPED:
        return TrendUp;
      case EVENT_TYPES.CALL_STARTED:
      case EVENT_TYPES.CALL_ENDED:
        return PhoneCall;
      case EVENT_TYPES.WHATSAPP_MESSAGE_SENT:
      case EVENT_TYPES.WHATSAPP_TEMPLATE_MESSAGE_SENT:
        return WhatsappLogo;
      case EVENT_TYPES.EMAIL_SENT:
        return EnvelopeSimple;
      default:
        return Pulse;
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="animate-pulse flex items-center gap-3 p-3 rounded-[--radius] bg-muted"
          >
            <div className="h-10 w-10 bg-border rounded-lg" />
            <div className="flex-1">
              <div className="h-4 w-32 bg-border rounded mb-2" />
              <div className="h-3 w-24 bg-border rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data?.metrics?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Clock className="h-12 w-12 mb-2 text-muted-foreground" />
        <p>{t("noRecentActivity")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {data.metrics.slice(0, 10).map((metric) => {
        const Icon = getEventIcon(metric.event_type);
        const eventColor = EVENT_COLORS[metric.event_type] || "#64748b";

        return (
          <div
            key={metric.id}
            className="flex items-center gap-3 p-3 rounded-[--radius] bg-muted hover:bg-muted transition-colors"
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${eventColor}15` }}
            >
              <Icon
                className="h-5 w-5"
                style={{ color: eventColor }}
                weight="fill"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {t(`events.${metric.event_type}` as Parameters<typeof t>[0])}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(metric.occurred_at), "dd/MM/yyyy HH:mm:ss")}
              </p>
            </div>
            {metric.metadata?.email && (
              <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                {metric.metadata.email}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EventFilterChips({
  selectedEvents,
  onToggle,
  t,
}: {
  selectedEvents: string[];
  onToggle: (eventType: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const eventTypes = Object.values(EVENT_TYPES);

  return (
    <div className="flex flex-wrap gap-2">
      {eventTypes.map((eventType) => {
        const isSelected = selectedEvents.includes(eventType);
        const color = EVENT_COLORS[eventType] || "#64748b";

        return (
          <button
            key={eventType}
            onClick={() => onToggle(eventType)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              isSelected
                ? "text-white shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-border",
            )}
            style={isSelected ? { backgroundColor: color } : undefined}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                !isSelected && "opacity-60",
              )}
              style={{ backgroundColor: isSelected ? "#fff" : color }}
            />
            {t(`events.${eventType}` as Parameters<typeof t>[0])}
          </button>
        );
      })}
    </div>
  );
}

type CustomChartType = "timeseries" | "pie" | "bar";

interface CustomChart {
  id: string;
  name: string;
  type: CustomChartType;
  eventTypes: string[];
  createdAt: string;
  gridColumn?: number; 
  gridRow?: number;
  width?: 1 | 2; 
}

const CUSTOM_CHARTS_STORAGE_KEY = "admin-metrics-custom-charts";

function loadCustomCharts(): CustomChart[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CUSTOM_CHARTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveCustomCharts(charts: CustomChart[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_CHARTS_STORAGE_KEY, JSON.stringify(charts));
  } catch (error) {
    console.error("Failed to save custom charts:", error);
  }
}

type MainSection = "business-metrics";

export default function AdminMetricsDashboard() {
  const t = useTranslations("businessMetrics");
  const tCommon = useTranslations("common");

  const [mainSection, setMainSection] =
    useState<MainSection>("business-metrics");

  const [loading, setLoading] = useState(true);
  const [dateRangePreset, setDateRangePreset] =
    useState<DateRangePreset>("30d");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [interval, setInterval] = useState<IntervalType>("day");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [customCharts, setCustomCharts] = useState<CustomChart[]>([]);
  const [showCreateChartDialog, setShowCreateChartDialog] = useState(false);
  const [newChartName, setNewChartName] = useState("");
  const [newChartType, setNewChartType] =
    useState<CustomChartType>("timeseries");
  const [newChartEvents, setNewChartEvents] = useState<string[]>([]);

  useEffect(() => {
    setCustomCharts(loadCustomCharts());
  }, []);

  useEffect(() => {
    if (customCharts.length > 0 || typeof window !== "undefined") {
      saveCustomCharts(customCharts);
    }
  }, [customCharts]);

  const [stats, setStats] = useState<MetricsStatsResponse | null>(null);
  const [timeSeries, setTimeSeries] =
    useState<MetricsTimeSeriesResponse | null>(null);
  const [recentMetrics, setRecentMetrics] =
    useState<MetricsListResponse | null>(null);

  const dateRange = useMemo(() => {
    if (dateRangePreset === "custom" && customStartDate && customEndDate) {
      return {
        start: new Date(customStartDate).toISOString(),
        end: new Date(customEndDate).toISOString(),
      };
    }
    return getDateRangeFromPreset(dateRangePreset);
  }, [dateRangePreset, customStartDate, customEndDate]);

  const handleEventToggle = useCallback((eventType: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventType)
        ? prev.filter((e) => e !== eventType)
        : [...prev, eventType],
    );
  }, []);

  const handleClearFilters = useCallback(() => {
    setSelectedEvents([]);
  }, []);

  const handleCreateChart = useCallback(() => {
    if (!newChartName.trim()) return;

    const newChart: CustomChart = {
      id: `chart-${Date.now()}`,
      name: newChartName.trim(),
      type: newChartType,
      eventTypes: newChartEvents.length > 0 ? newChartEvents : [],
      createdAt: new Date().toISOString(),
      width: newChartType === "timeseries" ? 2 : 1,
      gridRow: Math.floor(customCharts.length / 2),
      gridColumn: (customCharts.length % 2) + 1,
    };

    setCustomCharts((prev) => [...prev, newChart]);
    setShowCreateChartDialog(false);
    setNewChartName("");
    setNewChartType("timeseries");
    setNewChartEvents([]);
  }, [newChartName, newChartType, newChartEvents, customCharts.length]);

  const handleDeleteChart = useCallback((chartId: string) => {
    setCustomCharts((prev) => prev.filter((c) => c.id !== chartId));
  }, []);

  const handleToggleChartWidth = useCallback((chartId: string) => {
    setCustomCharts((prev) =>
      prev.map((chart) =>
        chart.id === chartId
          ? { ...chart, width: chart.width === 2 ? 1 : 2 }
          : chart,
      ),
    );
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, chartId: string) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("chartId", chartId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const draggedChartId = e.dataTransfer.getData("chartId");

    setCustomCharts((prev) => {
      const draggedIndex = prev.findIndex((c) => c.id === draggedChartId);
      if (draggedIndex === -1 || draggedIndex === targetIndex) return prev;

      const newCharts = [...prev];
      const [draggedChart] = newCharts.splice(draggedIndex, 1);
      newCharts.splice(targetIndex, 0, draggedChart);

      return newCharts;
    });
  }, []);

  const toggleNewChartEvent = useCallback((eventType: string) => {
    setNewChartEvents((prev) =>
      prev.includes(eventType)
        ? prev.filter((e) => e !== eventType)
        : [...prev, eventType],
    );
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const eventTypesParam =
      selectedEvents.length > 0 ? selectedEvents : undefined;

    console.log("[AdminMetricsDashboard] Fetching data with params:", {
      dateRange,
      interval,
      eventTypesParam,
    });

    try {
      const [statsResult, timeSeriesResult, recentResult] = await Promise.all([
        getBusinessMetricsStatsAction({
          start_date: dateRange.start,
          end_date: dateRange.end,
          event_types: eventTypesParam,
        }),
        getBusinessMetricsTimeSeriesAction({
          start_date: dateRange.start,
          end_date: dateRange.end,
          interval,
          event_types: eventTypesParam,
        }),
        getBusinessMetricsAction({
          start_date: dateRange.start,
          end_date: dateRange.end,
          page: 1,
          page_size: 20,
          sort_by: "occurred_at",
          sort_order: "desc",
          event_types: eventTypesParam,
        }),
      ]);

      console.log("[AdminMetricsDashboard] Results:", {
        statsResult,
        timeSeriesResult,
        recentResult,
      });

      if (statsResult.data) setStats(statsResult.data);
      if (timeSeriesResult.data) setTimeSeries(timeSeriesResult.data);
      if (recentResult.data) setRecentMetrics(recentResult.data);
    } catch (error) {
      console.error("Failed to fetch metrics:", error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, interval, selectedEvents]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (dateRangePreset !== "custom") {
      setInterval(getRecommendedInterval(dateRangePreset));
    }
  }, [dateRangePreset]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <GradientText
              as="h1"
              alignment="left"
              startColor="#6366f1"
              endColor="#8b5cf6"
              className="text-2xl font-semibold md:text-3xl"
            >
              {t("pageTitle")}
            </GradientText>
            <p className="text-sm text-muted-foreground">{t("pageSubtitle")}</p>
          </div>
          {mainSection === "business-metrics" && (
            <div className="flex items-center gap-2 mt-4 md:mt-0">
              <Button
                variant="secondary-cta"
                title={t("refresh")}
                icon={<ArrowClockwise className="h-4 w-4" />}
                iconVisible
                iconSide="left"
                onClick={fetchData}
                disabled={loading}
              />
            </div>
          )}
        </div>

        {}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMainSection("business-metrics")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-[--radius] text-sm font-medium transition-all",
              mainSection === "business-metrics"
                ? "bg-muted text-muted-foreground shadow-md"
                : "bg-muted text-muted-foreground hover:bg-border",
            )}
          >
            <ChartLine className="h-4 w-4" weight="fill" />
            {t("mainTabs.businessMetrics")}
          </button>
        </div>
      </motion.div>

      {mainSection === "business-metrics" && (
        <>
          <motion.div variants={itemVariants}>
            <ElevatedContainer className="border border-border bg-card p-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {t("filters.dateRange")}:
                  </span>
                  <div className="flex gap-1.5 flex-wrap">
                    {(["24h", "7d", "30d", "90d"] as DateRangePreset[]).map(
                      (preset) => (
                        <Button
                          key={preset}
                          variant={
                            dateRangePreset === preset
                              ? "primary"
                              : "outline-subtle"
                          }
                          size="sm"
                          onClick={() => setDateRangePreset(preset)}
                          title={t(`filters.presets.${preset}`)}
                        />
                      ),
                    )}
                    <Button
                      variant={
                        dateRangePreset === "custom"
                          ? "primary"
                          : "outline-subtle"
                      }
                      size="sm"
                      onClick={() => setDateRangePreset("custom")}
                      title={t("filters.presets.custom")}
                    />
                  </div>
                </div>

                {dateRangePreset === "custom" && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <ElevatedDatePicker
                      id="start-date"
                      label={t("filters.startDate")}
                      value={customStartDate}
                      onChange={setCustomStartDate}
                      inputClassName="min-w-[160px]"
                    />
                    <span className="text-muted-foreground">→</span>
                    <ElevatedDatePicker
                      id="end-date"
                      label={t("filters.endDate")}
                      value={customEndDate}
                      onChange={setCustomEndDate}
                      minDate={
                        customStartDate ? new Date(customStartDate) : undefined
                      }
                      inputClassName="min-w-[160px]"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 lg:ml-auto flex-wrap">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {t("filters.interval")}:
                  </span>
                  <div className="flex gap-1.5">
                    {(["hour", "day", "week", "month"] as IntervalType[]).map(
                      (intervalOption) => (
                        <Button
                          key={intervalOption}
                          variant={
                            interval === intervalOption
                              ? "primary"
                              : "outline-subtle"
                          }
                          size="sm"
                          onClick={() => setInterval(intervalOption)}
                          title={t(`filters.intervals.${intervalOption}`)}
                        />
                      ),
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Funnel className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {t("filters.eventTypes")}
                    </span>
                    {selectedEvents.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                        {selectedEvents.length} {t("filters.selected")}
                      </span>
                    )}
                  </div>
                  {selectedEvents.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilters}
                      title={t("filters.clearAll")}
                      className="text-lamp-ink hover:text-blue-800 hover:bg-muted"
                    />
                  )}
                </div>
                <EventFilterChips
                  selectedEvents={selectedEvents}
                  onToggle={handleEventToggle}
                  t={t}
                />
              </div>
            </ElevatedContainer>
          </motion.div>

          <motion.div variants={itemVariants}>
            <CategoryStatsGrid stats={stats} loading={loading} t={t} />
          </motion.div>

          <motion.div variants={itemVariants}>
            <ElevatedContainer className="border border-border bg-card p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList
                  className="mb-6 bg-muted border border-border shadow-none"
                  style={{ boxShadow: "none" }}
                >
                  <TabsTrigger
                    value="overview"
                    className="data-[state=active]:bg-card data-[state=active]:shadow-sm"
                    style={{ boxShadow: "none" }}
                  >
                    <ChartLine className="h-4 w-4 mr-2" />
                    {t("tabs.overview")}
                  </TabsTrigger>
                  <TabsTrigger
                    value="distribution"
                    className="data-[state=active]:bg-card data-[state=active]:shadow-sm"
                    style={{ boxShadow: "none" }}
                  >
                    <ChartPie className="h-4 w-4 mr-2" />
                    {t("tabs.distribution")}
                  </TabsTrigger>
                  <TabsTrigger
                    value="categories"
                    className="data-[state=active]:bg-card data-[state=active]:shadow-sm"
                    style={{ boxShadow: "none" }}
                  >
                    <ChartBar className="h-4 w-4 mr-2" />
                    {t("tabs.categories")}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-foreground">
                        {t("charts.timeSeries.title")}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t("charts.timeSeries.subtitle")}
                      </p>
                    </div>
                    <TimeSeriesChart
                      data={timeSeries}
                      interval={interval}
                      loading={loading}
                      selectedEvents={selectedEvents}
                      t={t}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="distribution">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-4">
                        {t("charts.distribution.title")}
                      </h3>
                      <DistributionPieChart
                        stats={stats}
                        loading={loading}
                        t={t}
                      />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-4">
                        {t("charts.distribution.legend")}
                      </h3>
                      {stats && (
                        <div className="space-y-2 max-h-[280px] overflow-y-auto">
                          {Object.entries(stats.event_counts)
                            .filter(([, count]) => count > 0)
                            .sort(([, a], [, b]) => b - a)
                            .map(([eventType, count]) => (
                              <div
                                key={eventType}
                                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted"
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className="h-3 w-3 rounded-full"
                                    style={{
                                      backgroundColor:
                                        EVENT_COLORS[eventType] || "#64748b",
                                    }}
                                  />
                                  <span className="text-sm text-foreground">
                                    {t(
                                      `events.${eventType}` as Parameters<
                                        typeof t
                                      >[0],
                                    )}
                                  </span>
                                </div>
                                <span className="text-sm font-semibold text-foreground">
                                  {count.toLocaleString()}
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="categories">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-foreground">
                        {t("charts.categories.title")}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t("charts.categories.subtitle")}
                      </p>
                    </div>
                    <CategoryBarChart stats={stats} loading={loading} t={t} />
                  </div>
                </TabsContent>
              </Tabs>
            </ElevatedContainer>
          </motion.div>

          {customCharts.length > 0 && (
            <motion.div variants={itemVariants}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {customCharts.map((chart, index) => (
                  <div
                    key={chart.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, chart.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className={cn(
                      "transition-all duration-200",
                      chart.width === 2 && "lg:col-span-2",
                    )}
                  >
                    <ElevatedContainer className="border border-border bg-card p-6 cursor-move hover:border-foreground/20 transition-colors">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <DotsSixVertical
                            className="h-5 w-5 text-muted-foreground cursor-grab active:cursor-grabbing"
                            weight="bold"
                          />
                          <h3 className="text-lg font-semibold text-foreground">
                            {chart.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleChartWidth(chart.id)}
                            className="px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-border rounded-lg transition-colors"
                            title={
                              chart.width === 2
                                ? "Reduzir largura"
                                : "Expandir largura"
                            }
                          >
                            {chart.width === 2 ? "½" : "⛶"}
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Trash className="h-4 w-4" />}
                            iconVisible
                            onClick={() => handleDeleteChart(chart.id)}
                            className="text-destructive hover:text-red-800 hover:bg-destructive/10"
                          />
                        </div>
                      </div>
                      {chart.type === "timeseries" && (
                        <TimeSeriesChart
                          data={timeSeries}
                          interval={interval}
                          loading={loading}
                          selectedEvents={chart.eventTypes}
                          t={t}
                        />
                      )}
                      {chart.type === "pie" && (
                        <DistributionPieChart
                          stats={stats}
                          loading={loading}
                          t={t}
                        />
                      )}
                      {chart.type === "bar" && (
                        <CategoryBarChart
                          stats={stats}
                          loading={loading}
                          t={t}
                        />
                      )}
                    </ElevatedContainer>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          <motion.div variants={itemVariants}>
            <Button
              variant="outline-subtle"
              icon={<Plus className="h-4 w-4" />}
              iconVisible
              iconSide="left"
              title={t("createCustomChart")}
              onClick={() => setShowCreateChartDialog(true)}
              className="w-full"
            />
          </motion.div>

          <ElevatedDialog
            open={showCreateChartDialog}
            onOpenChange={setShowCreateChartDialog}
          >
            <ElevatedDialogContent className="max-w-2xl">
              <ElevatedDialogHeader>
                <ElevatedDialogTitle>
                  {t("createCustomChart")}
                </ElevatedDialogTitle>
                <ElevatedDialogDescription>
                  Configure um novo gráfico personalizado para exibir as
                  métricas que você deseja acompanhar
                </ElevatedDialogDescription>
              </ElevatedDialogHeader>

              <div className="space-y-4">
                <ElevatedInput
                  id="chart-name"
                  type="text"
                  label="Nome do Gráfico"
                  placeholder="Ex: Análise de Logins"
                  value={newChartName}
                  onChange={(e) => setNewChartName(e.target.value)}
                  variant="outline"
                />

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Tipo de Gráfico
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant={
                        newChartType === "timeseries"
                          ? "primary"
                          : "outline-subtle"
                      }
                      size="sm"
                      icon={<ChartLine className="h-4 w-4" />}
                      iconVisible
                      iconSide="left"
                      title="Visão Geral"
                      onClick={() => setNewChartType("timeseries")}
                    />
                    <Button
                      variant={
                        newChartType === "pie" ? "primary" : "outline-subtle"
                      }
                      size="sm"
                      icon={<ChartPie className="h-4 w-4" />}
                      iconVisible
                      iconSide="left"
                      title="Distribuição"
                      onClick={() => setNewChartType("pie")}
                    />
                    <Button
                      variant={
                        newChartType === "bar" ? "primary" : "outline-subtle"
                      }
                      size="sm"
                      icon={<ChartBar className="h-4 w-4" />}
                      iconVisible
                      iconSide="left"
                      title="Categorias"
                      onClick={() => setNewChartType("bar")}
                    />
                  </div>
                </div>

                {newChartType === "timeseries" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Selecionar Métricas (opcional)
                    </label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Deixe em branco para mostrar todas as métricas
                    </p>
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 border border-border rounded-lg">
                      {Object.values(EVENT_TYPES).map((eventType) => {
                        const isSelected = newChartEvents.includes(eventType);
                        const color = EVENT_COLORS[eventType] || "#64748b";

                        return (
                          <button
                            key={eventType}
                            onClick={() => toggleNewChartEvent(eventType)}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                              isSelected
                                ? "text-white shadow-sm"
                                : "bg-muted text-muted-foreground hover:bg-border",
                            )}
                            style={
                              isSelected
                                ? { backgroundColor: color }
                                : undefined
                            }
                          >
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full",
                                !isSelected && "opacity-60",
                              )}
                              style={{
                                backgroundColor: isSelected ? "#fff" : color,
                              }}
                            />
                            {t(
                              `events.${eventType}` as Parameters<typeof t>[0],
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <ElevatedDialogFooter>
                <Button
                  variant="outline-subtle"
                  title={t("cancel")}
                  onClick={() => {
                    setShowCreateChartDialog(false);
                    setNewChartName("");
                    setNewChartType("timeseries");
                    setNewChartEvents([]);
                  }}
                />
                <Button
                  variant="primary"
                  title={t("createChart")}
                  onClick={handleCreateChart}
                  disabled={!newChartName.trim()}
                />
              </ElevatedDialogFooter>
            </ElevatedDialogContent>
          </ElevatedDialog>

          <motion.div variants={itemVariants}>
            <ElevatedContainer className="border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-lamp-ink" weight="fill" />
                  <h2 className="text-lg font-semibold text-foreground">
                    {t("recentActivity.title")}
                  </h2>
                </div>
                {recentMetrics?.total_count && (
                  <span className="text-sm text-muted-foreground">
                    {t("recentActivity.total")}:{" "}
                    {recentMetrics.total_count.toLocaleString()}
                  </span>
                )}
              </div>
              <RecentActivityList
                data={recentMetrics}
                loading={loading}
                t={t}
              />
            </ElevatedContainer>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
