export interface CalendarEvent {
    id: string;
    workspaceId: string;
    userId: string;
    googleEventId?: string;
    title: string;
    description?: string;
    location?: string;
    startTime: string;
    endTime: string;
    allDay: boolean;
    timeZone?: string;
    color?: string;
    attendees?: Attendee[];
    meetingLink?: string;
    status: string;
    guestsCanModify: boolean;
    guestsCanInviteOthers: boolean;
    guestsCanSeeOtherGuests: boolean;
    visibility?: string;
    transparency?: string;
    recurrence?: string[];
    remindersUseDefault: boolean;
    reminderOverrides?: ReminderOverride[];
    createdAt: string;
    updatedAt: string;
}

export interface Attendee {
    email: string;
    name?: string;
    status?: string;
}

export interface ReminderOverride {
    method: string; 
    minutes: number;
}

export interface GoogleCalendarConnection {
    id: string;
    workspaceId: string;
    email: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateEventInput {
    title: string;
    description?: string;
    location?: string;
    startTime: string;
    endTime: string;
    allDay?: boolean;
    timeZone?: string;
    color?: string;
    attendees?: Attendee[];
    meetingLink?: string;
    createGoogleMeet?: boolean;
    guestsCanModify?: boolean;
    guestsCanInviteOthers?: boolean;
    guestsCanSeeOtherGuests?: boolean;
    visibility?: string;
    transparency?: string;
    recurrence?: string[];
    remindersUseDefault?: boolean;
    reminderOverrides?: ReminderOverride[];
    sendUpdates?: string;
}

export interface UpdateEventInput {
    title?: string;
    description?: string;
    location?: string;
    startTime?: string;
    endTime?: string;
    allDay?: boolean;
    timeZone?: string;
    color?: string;
    attendees?: Attendee[];
    meetingLink?: string;
    guestsCanModify?: boolean;
    guestsCanInviteOthers?: boolean;
    guestsCanSeeOtherGuests?: boolean;
    visibility?: string;
    transparency?: string;
    recurrence?: string[];
    remindersUseDefault?: boolean;
    reminderOverrides?: ReminderOverride[];
    sendUpdates?: string;
}

export interface ListEventsParams {
    page?: number;
    pageSize?: number;
    search?: string;
    from?: string;
    to?: string;
}
