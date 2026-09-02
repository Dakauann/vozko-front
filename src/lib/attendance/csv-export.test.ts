import { describe, expect, it } from "vitest";

import type { AttendanceOverview } from "@/lib/attendance/types";
import { buildAttendanceOverviewCsv, type AttendanceCsvFilters } from "./csv-export";

/** Identity translator: assertions read against stable keys, not copy. */
const t = (key: string) => key;

const FILTERS: AttendanceCsvFilters = {
    dateFrom: "2026-08-01",
    dateTo: "2026-08-17",
    departmentLabel: "Suporte",
    memberLabel: "Todos",
    channelLabel: "WhatsApp",
    includeAi: true,
    workspaceName: "Vozko",
};

function overview(partial: Partial<AttendanceOverview> = {}): AttendanceOverview {
    return {
        kpis: {
            engaged: 142,
            finished: 90,
            ongoing: 30,
            pending: 22,
            new_leads: 40,
            unassigned_backlog: 5,
            avg_handle_mins: 12.345,
            avg_wait_mins: 3.2,
            avg_frt_mins: 1.5,
            avg_rating: null,
            csat_available: false,
            frt_sla_percent: null,
            resolution_sla_percent: null,
            sla_available: false,
        },
        hourly: [{ hour: 0, count: 3 }, { hour: 9, count: 21 }],
        status_distribution: { finished: 90, ongoing: 30, pending: 22, total: 142 },
        by_department: [],
        by_member: [],
        frt: {
            avg_mins: null, median_mins: null, human_avg_mins: null, ai_avg_mins: null,
            sample_count: 0, human_samples: 0, ai_samples: 0, available: false,
        },
        ai: {
            sessions: 0, contained: 0, handed_off: 0, abandoned: 0, open_sessions: 0,
            containment_rate: 0, handoff_rate: 0, avg_ai_messages: 0, available: false,
        },
        queue: {
            enqueued: 0, connected: 0, abandoned: 0, overflow: 0, queue_full: 0,
            cancelled: 0, avg_asa_mins: null, abandon_rate: 0, available: false,
        },
        occupancy: {
            avg_occupancy_pct: null, agents_sampled: 0, online_ms: 0, on_call_ms: 0,
            team_occupancy_pct: null, team_idle_pct: null, available: false,
        },
        live: { online: 0, in_call: 0, free: 0, idle_rate_pct: null, busy_rate_pct: null, has_data: false, as_of: "" },
        channel_mix: [],
        messaging: {
            avg_messages_per_conversation: null, avg_inbound: null, avg_outbound: null,
            conversations_with_messages: 0, available: false,
        },
        reopen: { reopened_count: 0, finished_event_count: 0, reopen_rate: null, available: false },
        finished_by_source: { human: 0, ai: 0, system: 0, total: 0, available: false },
        definitions: {
            period_scope: "", status_mapping: "", wait_time: "", handle_time: "",
            resolution: "", csat: "", sla: "",
        },
        ...partial,
    } as AttendanceOverview;
}

/** Stands in for the dashboard's label functions. */
const display = {
    channel: (c: string) => (c === "unofficial_whatsapp" ? "WhatsApp (não oficial)" : c),
    actorKind: (k: string) => (k === "ai" ? "IA" : "Humano"),
    presence: (p: string) => (p === "online" ? "Online" : "Offline"),
};

function build(o = overview(), f = FILTERS) {
    return buildAttendanceOverviewCsv({
        overview: o,
        filters: f,
        t,
        display,
        generatedAt: new Date("2026-08-17T12:00:00.000Z"),
    });
}

describe("buildAttendanceOverviewCsv", () => {
    // The filter is the file's provenance: without it the numbers cannot be
    // interpreted, or reproduced, a week after the download.
    it("records the applied filter in the file", () => {
        const { csvText } = build();
        expect(csvText).toContain("filters.dateFrom;2026-08-01");
        expect(csvText).toContain("filters.dateTo;2026-08-17");
        expect(csvText).toContain("filters.department;Suporte");
        expect(csvText).toContain("filters.channel;WhatsApp");
        expect(csvText).toContain("filters.includeAi;yes");
        expect(csvText).toContain("filters.workspace;Vozko");
        expect(csvText).toContain("filters.generatedAt;2026-08-17T12:00:00.000Z");
    });

    it("names the file after the exported range", () => {
        expect(build().filename).toBe("atendimento-2026-08-01-2026-08-17.csv");
    });

    it("writes KPIs and computes status percentages", () => {
        const { csvText } = build();
        expect(csvText).toContain("kpi.engaged;142");
        expect(csvText).toContain("kpi.avgHandleMins;12,35");
        expect(csvText).toContain("status.finished;90;63,4");
        expect(csvText).toContain("columns.total;142;100");
    });

    // A workspace without CSAT would otherwise export "rating 0" as though
    // every customer had scored it zero.
    it("omits unavailable metrics rather than exporting zeros", () => {
        const { csvText } = build();
        expect(csvText).not.toContain("kpi.avgRating");
        expect(csvText).not.toContain("sections.queue");
        expect(csvText).not.toContain("sections.ai");
        expect(csvText).not.toContain("kpi.frtSlaPercent");
    });

    // A period with no handle time still has the row: dropping it made the
    // file's columns change shape between exports, which reads as a bug.
    it("keeps a measured-but-empty metric as a row with a blank value", () => {
        const { csvText } = build(
            overview({
                kpis: { ...overview().kpis, avg_handle_mins: null },
            }),
        );
        expect(csvText).toContain("kpi.avgHandleMins;\r\n");
    });

    it("uses the dashboard's labels instead of raw enum keys", () => {
        const { csvText } = build(
            overview({
                channel_mix: [{ channel: "unofficial_whatsapp", count: 1, pct: 100 }],
                by_member: [{
                    actor_id: "u1", actor_kind: "human", display_name: "Ana",
                    presence: "online", avg_response_mins: 1, rating: null,
                    resolution_pct: 0, open: 1, pending: 0, resolved: 0,
                }],
            }),
        );
        expect(csvText).toContain("WhatsApp (não oficial);1;100");
        expect(csvText).toContain("Ana;;Humano;Online;");
        expect(csvText).not.toContain("unofficial_whatsapp");
    });

    // Without the glossary the file's own totals look contradictory: status
    // counts engaged threads while "total in scope" includes empty shells.
    it("appends the backend's metric definitions under their label", () => {
        const { csvText } = buildAttendanceOverviewCsv({
            overview: overview({
                definitions: {
                    period_scope: "Conversas criadas no período",
                    status_mapping: "", wait_time: "", handle_time: "",
                    resolution: "", csat: "", sla: "",
                },
            }),
            filters: FILTERS,
            display,
            t: (key) =>
                key === "definitions.period_scope" ? "Recorte do período" : key,
            generatedAt: new Date("2026-08-17T12:00:00.000Z"),
        });
        expect(csvText).toContain("sections.definitions");
        expect(csvText).toContain("Recorte do período;Conversas criadas no período");
        // Empty definitions are not emitted as blank rows.
        expect(csvText).not.toContain("status_mapping;");
    });

    // The definition keys come from the backend, so one it adds before the
    // label exists must print unlabelled, not break the export.
    it("falls back to the raw key when a definition has no label", () => {
        const { csvText } = buildAttendanceOverviewCsv({
            overview: overview({
                definitions: { brand_new_metric: "Explicação nova" } as never,
            }),
            filters: FILTERS,
            display,
            t: (key) => {
                if (key === "definitions.brand_new_metric") throw new Error("MISSING_MESSAGE");
                return key;
            },
            generatedAt: new Date("2026-08-17T12:00:00.000Z"),
        });
        expect(csvText).toContain("brand_new_metric;Explicação nova");
    });

    it("includes a detail section once the backend marks it available", () => {
        const { csvText } = build(
            overview({
                queue: {
                    enqueued: 10, connected: 8, abandoned: 2, overflow: 0, queue_full: 0,
                    cancelled: 0, avg_asa_mins: 1.25, abandon_rate: 20, available: true,
                },
            }),
        );
        expect(csvText).toContain("sections.queue");
        expect(csvText).toContain("queue.enqueued;10");
        expect(csvText).toContain("queue.avgAsaMins;1,25");
    });

    it("pads the hour so a leading zero survives the spreadsheet", () => {
        expect(build().csvText).toContain("00;3");
    });

    it("emits department and member tables when present", () => {
        const { csvText } = build(
            overview({
                by_department: [{
                    department_id: "d1", department_name: "Vendas", avg_wait_mins: 2,
                    avg_handle_mins: 9, finished: 5, ongoing: 1, pending: 0,
                }],
                by_member: [{
                    actor_id: "u1", actor_kind: "user", display_name: "Ana, Silva",
                    email: "ana@x.com", presence: "online", avg_response_mins: 4.5,
                    rating: 4.8, resolution_pct: 91, open: 2, pending: 1, resolved: 12,
                }],
            }),
        );
        expect(csvText).toContain("Vendas;2;9;5;;;;1;0");
        // The comma in the name must be quoted, not shift every later column.
        expect(csvText).toContain('Ana, Silva;ana@x.com;Humano;Online;4,5;4,8;91;2;1;12');
    });

    // Names come from operator input and land in a spreadsheet.
    it("defuses a formula injected through a department name", () => {
        const { csvText } = build(
            overview({
                by_department: [{
                    department_id: "d1", department_name: '=cmd|"/c calc"!A1',
                    avg_wait_mins: null, avg_handle_mins: null, finished: 0, ongoing: 0, pending: 0,
                }],
            }),
        );
        expect(csvText).toContain("'=cmd|");
        expect(csvText).not.toMatch(/(^|\n)=cmd/);
    });

    it("starts with a BOM so Excel reads the accents", () => {
        expect(build().csvText.charCodeAt(0)).toBe(0xfeff);
    });

    it("carries the campaign scope when the page is deep-linked", () => {
        const { csvText } = build(overview(), {
            ...FILTERS,
            campaignId: "camp-1",
            campaignType: "whatsapp",
        });
        expect(csvText).toContain("filters.campaign;camp-1");
        expect(csvText).toContain("filters.campaignType;whatsapp");
    });
});
