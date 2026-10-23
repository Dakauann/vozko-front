
import { apiClient } from "@/lib/api/browser-client";
import type {
    CalendarEvent,
    CreateEventInput,
    ListEventsParams,
    UpdateEventInput,
} from "@/lib/calendar/types";

export async function fetchCalendarEvents(opts?: ListEventsParams): Promise<{
    items: CalendarEvent[];
    page?: number;
    pageSize?: number;
    totalItems?: number;
    totalPages?: number;
    error?: string;
}> {
    const params = new URLSearchParams();
    if (opts?.page) params.set("page", String(opts.page));
    if (opts?.pageSize) params.set("pageSize", String(opts.pageSize));
    if (opts?.search) params.set("search", opts.search);
    if (opts?.from) params.set("from", opts.from);
    if (opts?.to) params.set("to", opts.to);
    const qs = params.toString();

    const res = await apiClient<{
        data?: CalendarEvent[];
        meta?: {
            page?: number;
            pageSize?: number;
            totalItems?: number;
            totalPages?: number;
        };
    }>(`/calendar/events${qs ? `?${qs}` : ""}`, { method: "GET" });

    if (res.error) {
        return { items: [], error: res.error.message || "Failed to fetch events" };
    }

    return {
        items: res.data?.data ?? [],
        page: res.data?.meta?.page,
        pageSize: res.data?.meta?.pageSize,
        totalItems: res.data?.meta?.totalItems,
        totalPages: res.data?.meta?.totalPages,
    };
}

export async function createCalendarEvent(input: CreateEventInput): Promise<{
    event: CalendarEvent | null;
    error?: string;
}> {
    const res = await apiClient<{ event?: CalendarEvent }>("/calendar/events", {
        method: "POST",
        body: JSON.stringify(input),
    });

    if (res.error) {
        return { event: null, error: res.error.message || "Failed to create event" };
    }

    return { event: res.data?.event ?? null };
}

export async function updateCalendarEvent(
    id: string,
    input: UpdateEventInput,
): Promise<{
    event: CalendarEvent | null;
    error?: string;
}> {
    const res = await apiClient<{ event?: CalendarEvent }>(`/calendar/events/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
    });

    if (res.error) {
        return { event: null, error: res.error.message || "Failed to update event" };
    }

    return { event: res.data?.event ?? null };
}

export async function deleteCalendarEvent(id: string): Promise<{
    error?: string;
}> {
    const res = await apiClient<unknown>(`/calendar/events/${id}`, {
        method: "DELETE",
    });

    if (res.error) {
        return { error: res.error.message || "Failed to delete event" };
    }

    return {};
}

