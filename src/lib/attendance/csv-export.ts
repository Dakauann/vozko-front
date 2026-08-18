/**
 * CSV export of the attendance metrics dashboard.
 *
 * Built in the BROWSER from the overview already in state, not from a second
 * request. Three reasons, in order of weight:
 *
 *  1. Load. The dashboard aggregates over conversations, messages, queue and
 *     presence events; an export endpoint would re-run all of it, and an
 *     operator clicking "export" a few times on a 90-day range would cost the
 *     database as much as a dozen page loads. Exporting what is already on
 *     screen costs zero queries.
 *  2. Truth. The file matches the numbers the operator is looking at, exactly.
 *     A re-query can return different data than the screen (the range is
 *     relative, records keep arriving) and produce an export that contradicts
 *     the dashboard it came from.
 *  3. The payload is already complete: GET /attendance/overview returns every
 *     section the page renders, so there is nothing extra to fetch.
 *
 * The row counts are in the hundreds (24 hourly points, departments, members),
 * which is why this is the right trade here and NOT for the leads export,
 * where thousands of rows are streamed from the server precisely because the
 * browser never had them.
 */

import type {
    AttendanceOverview,
    ChannelSlice,
    DepartmentRow,
    MemberRow,
} from "@/lib/attendance/types";
import { buildCsvDocument, csvFilename, type CsvSection } from "@/lib/csv/csv";

/**
 * The filter recorded in the file's header.
 *
 * Display values, never ids: an export whose provenance reads
 * "department: 7f3a-91c…" cannot be interpreted a week later, which defeats
 * the point of recording the filter at all.
 */
export interface AttendanceCsvFilters {
    dateFrom: string;
    dateTo: string;
    departmentLabel: string;
    memberLabel: string;
    channelLabel: string;
    includeAi: boolean;
    campaignId?: string;
    campaignType?: string;
    workspaceName?: string;
}

/** Key lookup, bound by the caller to the metricsOps.export namespace. */
export type CsvTranslate = (key: string) => string;

/**
 * The dashboard's own label functions, passed in rather than reimplemented.
 *
 * Without them the file printed raw enum keys — "unofficial_whatsapp",
 * "human", "online" — where the screen shows "WhatsApp (não oficial)",
 * "Humano", "Online". An export that renames the things it exports is a
 * different report from the one the operator was reading.
 */
export interface AttendanceCsvDisplay {
    channel: (channel: string) => string;
    actorKind: (kind: string) => string;
    presence: (presence: string) => string;
}

export interface AttendanceCsvInput {
    overview: AttendanceOverview;
    filters: AttendanceCsvFilters;
    t: CsvTranslate;
    display: AttendanceCsvDisplay;
    /** Injected so the output is deterministic under test. */
    generatedAt?: Date;
}

/** One "metric,value" row. */
type Metric = [key: string, value: number | string | null | undefined];

/**
 * metricRows distinguishes the two kinds of "no value", because they mean
 * different things to whoever opens the file:
 *
 *   null      the metric exists and was not measured in this period → the row
 *             is emitted with an EMPTY cell. Dropping it instead made the
 *             file's shape change between exports (a period with no handle
 *             time was simply missing "Atendimento médio", which reads as a
 *             bug), and writing 0 would invent a measurement that never
 *             happened.
 *   undefined the backend did not send the field at all → no row, since there
 *             is nothing to report on.
 */
function metricRows(t: CsvTranslate, metrics: Metric[]): (string | number | null)[][] {
    const rows: (string | number | null)[][] = [];
    for (const [key, value] of metrics) {
        if (value === undefined) continue;
        rows.push([t(key), value]);
    }
    return rows;
}

/**
 * labelOrKey tolerates a missing translation.
 *
 * next-intl throws on an unknown key, and the definition keys come from the
 * backend, so a newly added one would otherwise break the whole export rather
 * than print one unlabelled row.
 */
function labelOrKey(t: CsvTranslate, key: string, fallback: string): string {
    try {
        const label = t(key);
        return label && label !== key ? label : fallback;
    } catch {
        return fallback;
    }
}

function pct(part: number, total: number): number | null {
    if (!total) return null;
    return Number(((part / total) * 100).toFixed(1));
}

function filtersSection(t: CsvTranslate, f: AttendanceCsvFilters, generatedAt: Date): CsvSection {
    const rows: (string | number | null)[][] = [
        [t("filters.generatedAt"), generatedAt.toISOString()],
        [t("filters.dateFrom"), f.dateFrom],
        [t("filters.dateTo"), f.dateTo],
        [t("filters.department"), f.departmentLabel],
        [t("filters.member"), f.memberLabel],
        [t("filters.channel"), f.channelLabel],
        [t("filters.includeAi"), f.includeAi ? t("yes") : t("no")],
    ];
    if (f.workspaceName) {
        rows.unshift([t("filters.workspace"), f.workspaceName]);
    }
    if (f.campaignId) {
        rows.push([t("filters.campaign"), f.campaignId]);
        if (f.campaignType) rows.push([t("filters.campaignType"), f.campaignType]);
    }
    return { title: t("sections.filters"), header: [t("columns.filter"), t("columns.value")], rows };
}

function kpiSection(t: CsvTranslate, overview: AttendanceOverview): CsvSection {
    const k = overview.kpis;
    const metrics: Metric[] = [
        ["kpi.engaged", k.engaged],
        ["kpi.shellBacklog", k.shell_backlog],
        ["kpi.totalScoped", k.total_scoped],
        ["kpi.entriesCreated", k.entries_created],
        ["kpi.finished", k.finished],
        ["kpi.ongoing", k.ongoing],
        ["kpi.pending", k.pending],
        ["kpi.newContacts", k.new_contacts],
        ["kpi.unassignedBacklog", k.unassigned_backlog],
        ["kpi.avgWaitMins", k.avg_wait_mins],
        ["kpi.avgHandleMins", k.avg_handle_mins],
        ["kpi.avgFrtMins", k.avg_frt_mins],
    ];
    // Availability flags gate their metrics: a workspace without CSAT
    // configured would otherwise export "rating 0" as if every customer
    // scored it zero.
    if (k.csat_available) metrics.push(["kpi.avgRating", k.avg_rating]);
    if (k.sla_available) {
        metrics.push(["kpi.frtSlaPercent", k.frt_sla_percent]);
        metrics.push(["kpi.resolutionSlaPercent", k.resolution_sla_percent]);
    }
    return {
        title: t("sections.kpis"),
        header: [t("columns.metric"), t("columns.value")],
        rows: metricRows(t, metrics),
    };
}

function statusSection(t: CsvTranslate, overview: AttendanceOverview): CsvSection {
    const s = overview.status_distribution;
    return {
        title: t("sections.status"),
        header: [t("columns.status"), t("columns.count"), t("columns.percent")],
        rows: [
            [t("status.finished"), s.finished, pct(s.finished, s.total)],
            [t("status.ongoing"), s.ongoing, pct(s.ongoing, s.total)],
            [t("status.pending"), s.pending, pct(s.pending, s.total)],
            [t("columns.total"), s.total, s.total ? 100 : null],
        ],
    };
}

function hourlySection(t: CsvTranslate, overview: AttendanceOverview): CsvSection | null {
    if (!overview.hourly?.length) return null;
    return {
        title: t("sections.hourly"),
        header: [t("columns.hour"), t("columns.conversations")],
        // Zero-padded so the hour sorts as a label and is not read as a number
        // with a lost leading zero.
        rows: overview.hourly.map((p) => [String(p.hour).padStart(2, "0"), p.count]),
    };
}

function departmentSection(t: CsvTranslate, rows: DepartmentRow[]): CsvSection | null {
    if (!rows?.length) return null;
    return {
        title: t("sections.departments"),
        header: [
            t("columns.department"),
            t("columns.avgWaitMins"),
            t("columns.avgHandleMins"),
            t("columns.finished"),
            t("columns.finishedHuman"),
            t("columns.finishedAi"),
            t("columns.finishedSystem"),
            t("columns.ongoing"),
            t("columns.pending"),
        ],
        rows: rows.map((d) => [
            d.department_name || t("noDepartment"),
            d.avg_wait_mins,
            d.avg_handle_mins,
            d.finished,
            d.finished_human ?? null,
            d.finished_ai ?? null,
            d.finished_system ?? null,
            d.ongoing,
            d.pending,
        ]),
    };
}

function memberSection(
    t: CsvTranslate,
    display: AttendanceCsvDisplay,
    rows: MemberRow[],
): CsvSection | null {
    if (!rows?.length) return null;
    return {
        title: t("sections.members"),
        header: [
            t("columns.member"),
            t("columns.email"),
            t("columns.kind"),
            t("columns.presence"),
            t("columns.avgResponseMins"),
            t("columns.rating"),
            t("columns.resolutionPct"),
            t("columns.open"),
            t("columns.pending"),
            t("columns.resolved"),
        ],
        rows: rows.map((m) => [
            m.display_name,
            m.email ?? "",
            display.actorKind(m.actor_kind),
            display.presence(m.presence),
            m.avg_response_mins,
            m.rating,
            m.resolution_pct,
            m.open,
            m.pending,
            m.resolved,
        ]),
    };
}

function channelSection(
    t: CsvTranslate,
    display: AttendanceCsvDisplay,
    slices: ChannelSlice[],
): CsvSection | null {
    if (!slices?.length) return null;
    return {
        title: t("sections.channels"),
        header: [t("columns.channel"), t("columns.conversations"), t("columns.percent")],
        rows: slices.map((c) => [display.channel(c.channel), c.count, c.pct]),
    };
}

/**
 * The backend already ships the glossary the dashboard shows on hover. In the
 * file that context is otherwise lost, and the numbers invite exactly the
 * wrong reading: "Total no recorte" counts campaign shells while "Situação das
 * conversas" counts only threads with messages, so the two totals legitimately
 * disagree and look like an error without the definition next to them.
 */
function definitionsSection(t: CsvTranslate, o: AttendanceOverview): CsvSection | null {
    const defs = o.definitions;
    if (!defs) return null;
    const rows = Object.entries(defs)
        .filter(([, text]) => typeof text === "string" && text.trim() !== "")
        // Falls back to the raw key: the backend can add a definition before
        // the label exists, and an unlabelled row still carries its text,
        // which is the part that matters.
        .map(([key, text]) => [labelOrKey(t, `definitions.${key}`, key), text as string]);
    if (rows.length === 0) return null;
    return {
        title: t("sections.definitions"),
        header: [t("columns.metric"), t("columns.definition")],
        rows,
    };
}

/**
 * Sections that the backend marks unavailable are omitted, not zero-filled.
 * A workspace with no queue would otherwise export a full queue block of
 * zeros, which reads as "measured, and it was zero".
 */
function detailSections(t: CsvTranslate, o: AttendanceOverview): CsvSection[] {
    const sections: CsvSection[] = [];
    const add = (titleKey: string, metrics: Metric[]) => {
        const rows = metricRows(t, metrics);
        if (rows.length > 0) {
            sections.push({
                title: t(titleKey),
                header: [t("columns.metric"), t("columns.value")],
                rows,
            });
        }
    };

    if (o.frt?.available) {
        add("sections.frt", [
            ["frt.avgMins", o.frt.avg_mins],
            ["frt.medianMins", o.frt.median_mins],
            ["frt.humanAvgMins", o.frt.human_avg_mins],
            ["frt.aiAvgMins", o.frt.ai_avg_mins],
            ["frt.sampleCount", o.frt.sample_count],
            ["frt.humanSamples", o.frt.human_samples],
            ["frt.aiSamples", o.frt.ai_samples],
        ]);
    }
    if (o.ai?.available) {
        add("sections.ai", [
            ["ai.sessions", o.ai.sessions],
            ["ai.contained", o.ai.contained],
            ["ai.handedOff", o.ai.handed_off],
            ["ai.abandoned", o.ai.abandoned],
            ["ai.openSessions", o.ai.open_sessions],
            ["ai.containmentRate", o.ai.containment_rate],
            ["ai.handoffRate", o.ai.handoff_rate],
            ["ai.avgAiMessages", o.ai.avg_ai_messages],
        ]);
    }
    if (o.queue?.available) {
        add("sections.queue", [
            ["queue.enqueued", o.queue.enqueued],
            ["queue.connected", o.queue.connected],
            ["queue.abandoned", o.queue.abandoned],
            ["queue.overflow", o.queue.overflow],
            ["queue.queueFull", o.queue.queue_full],
            ["queue.cancelled", o.queue.cancelled],
            ["queue.avgAsaMins", o.queue.avg_asa_mins],
            ["queue.abandonRate", o.queue.abandon_rate],
        ]);
    }
    if (o.occupancy?.available) {
        add("sections.occupancy", [
            ["occupancy.avgOccupancyPct", o.occupancy.avg_occupancy_pct],
            ["occupancy.agentsSampled", o.occupancy.agents_sampled],
            ["occupancy.teamOccupancyPct", o.occupancy.team_occupancy_pct],
            ["occupancy.teamIdlePct", o.occupancy.team_idle_pct],
        ]);
    }
    if (o.messaging?.available) {
        add("sections.messaging", [
            ["messaging.avgPerConversation", o.messaging.avg_messages_per_conversation],
            ["messaging.avgInbound", o.messaging.avg_inbound],
            ["messaging.avgOutbound", o.messaging.avg_outbound],
            ["messaging.avgTemplate", o.messaging.avg_template ?? null],
            ["messaging.templateMessages", o.messaging.template_messages ?? null],
            ["messaging.conversationsWithMessages", o.messaging.conversations_with_messages],
            ["messaging.conversationsWithTemplate", o.messaging.conversations_with_template ?? null],
            ["messaging.avgAllScoped", o.messaging.avg_messages_all_scoped ?? null],
        ]);
    }
    if (o.reopen?.available) {
        add("sections.reopen", [
            ["reopen.reopenedCount", o.reopen.reopened_count],
            ["reopen.finishedCount", o.reopen.finished_count ?? null],
            ["reopen.reopenRate", o.reopen.reopen_rate],
        ]);
    }
    if (o.finished_by_source?.available) {
        add("sections.finishedBySource", [
            ["finishedBySource.human", o.finished_by_source.human],
            ["finishedBySource.ai", o.finished_by_source.ai],
            ["finishedBySource.system", o.finished_by_source.system],
            ["finishedBySource.total", o.finished_by_source.total],
        ]);
    }
    return sections;
}

export interface AttendanceCsvOutput {
    csvText: string;
    filename: string;
}

export function buildAttendanceOverviewCsv({
    overview,
    filters,
    t,
    display,
    generatedAt = new Date(),
}: AttendanceCsvInput): AttendanceCsvOutput {
    const sections: CsvSection[] = [
        { rows: [[t("title")]] },
        filtersSection(t, filters, generatedAt),
        kpiSection(t, overview),
        statusSection(t, overview),
    ];

    for (const section of [
        hourlySection(t, overview),
        departmentSection(t, overview.by_department),
        memberSection(t, display, overview.by_member),
        channelSection(t, display, overview.channel_mix),
    ]) {
        if (section) sections.push(section);
    }

    sections.push(...detailSections(t, overview));

    // Last, so the numbers come first and the glossary explains them after.
    const definitions = definitionsSection(t, overview);
    if (definitions) sections.push(definitions);

    return {
        csvText: buildCsvDocument(sections),
        filename: csvFilename("atendimento", filters.dateFrom, filters.dateTo),
    };
}
