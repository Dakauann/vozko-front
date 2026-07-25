
import { apiClient } from "@/lib/api/browser-client";
import type {
    CalendarEvent,
    CreateEventInput,
    GoogleCalendarConnection,
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


export async function fetchCalendarEvent(id: string): Promise<{
    event: CalendarEvent | null;
    error?: string;
}> {
    const res = await apiClient<{ event?: CalendarEvent }>(`/calendar/events/${id}`, {
        method: "GET",
    });

    if (res.error) {
        return { event: null, error: res.error.message || "Failed to fetch event" };
    }

    return { event: res.data?.event ?? null };
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


export async function fetchGoogleAuthURL(): Promise<{
    authUrl: string | null;
    error?: string;
}> {
    const res = await apiClient<{ authUrl?: string }>("/calendar/google/auth-url", {
        method: "GET",
    });

    if (res.error) {
        return { authUrl: null, error: res.error.message || "Failed to get auth URL" };
    }

    return { authUrl: res.data?.authUrl ?? null };
}


export async function fetchGoogleConnection(): Promise<{
    connected: boolean;
    connection: GoogleCalendarConnection | null;
    error?: string;
}> {
    const res = await apiClient<{
        connected?: boolean;
        connection?: GoogleCalendarConnection;
    }>("/calendar/google/status", { method: "GET" });

    if (res.error) {
        return { connected: false, connection: null, error: res.error.message || "Failed to get status" };
    }

    return {
        connected: res.data?.connected ?? false,
        connection: res.data?.connection ?? null,
    };
}


export async function connectGoogleCalendar(code: string, redirectUri: string): Promise<{
    connection: GoogleCalendarConnection | null;
    error?: string;
}> {
    const res = await apiClient<{ connection?: GoogleCalendarConnection }>(
        "/calendar/google/connect",
        {
            method: "POST",
            body: JSON.stringify({ code, redirectUri }),
        },
    );

    if (res.error) {
        return { connection: null, error: res.error.message || "Failed to connect" };
    }

    return { connection: res.data?.connection ?? null };
}


export async function disconnectGoogleCalendar(): Promise<{
    error?: string;
}> {
    const res = await apiClient<unknown>("/calendar/google/disconnect", {
        method: "DELETE",
    });

    if (res.error) {
        return { error: res.error.message || "Failed to disconnect" };
    }

    return {};
}
