"use client";

import * as React from "react";

import {
  ArrowLeft,
  CalendarBlank,
  CalendarCheck,
  CircleNotch,
  Clock,
  MapPin,
  Palette,
  PencilSimple,
  Plus,
  TextAlignLeft,
  Trash,
  UserCircle,
  Users,
  VideoCamera,
} from "@phosphor-icons/react";
import type {
  CalendarEvent,
  CreateEventInput,
  UpdateEventInput,
} from "@/lib/calendar/types";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarEvents,
  fetchGoogleConnection,
  updateCalendarEvent,
} from "@/lib/calendar/client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

const EVENT_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];

interface CalendarSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CalendarSheet({ open, onOpenChange }: CalendarSheetProps) {
  const t = useTranslations("calendarSheet");
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [view, setView] = React.useState<"list" | "form">("list");
  const [editingEvent, setEditingEvent] = React.useState<CalendarEvent | null>(
    null,
  );
  const [connected, setConnected] = React.useState<boolean | null>(null);

  const loadEvents = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    const to = new Date(now);
    to.setMonth(to.getMonth() + 3);
    const result = await fetchCalendarEvents({
      pageSize: 50,
      from: from.toISOString(),
      to: to.toISOString(),
    });
    if (result.error) {
      setError(result.error);
    } else {
      setEvents(result.items);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    if (open) {
      setView("list");
      setEditingEvent(null);
      fetchGoogleConnection().then((res) => {
        setConnected(res.connected);
        if (res.connected) {
          loadEvents();
        }
      });
    }
  }, [open, loadEvents]);

  const openCreate = () => {
    setEditingEvent(null);
    setView("form");
  };

  const openEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setView("form");
  };

  const handleSave = async (input: CreateEventInput | UpdateEventInput) => {
    if (editingEvent) {
      const result = await updateCalendarEvent(
        editingEvent.id,
        input as UpdateEventInput,
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("eventUpdated") || "Event updated");
    } else {
      const result = await createCalendarEvent(input as CreateEventInput);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("eventCreated") || "Event created");
    }
    setView("list");
    setEditingEvent(null);
    loadEvents();
  };

  const handleDelete = async (id: string) => {
    const result = await deleteCalendarEvent(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(t("eventDeleted") || "Event deleted");
    setEvents((prev) => prev.filter((e) => e.id !== id));
    if (editingEvent?.id === id) {
      setView("list");
      setEditingEvent(null);
    }
  };

  const viewTitle =
    view === "form"
      ? editingEvent
        ? t("editEvent") || "Edit Event"
        : t("newEvent")
      : t("title");

  return (
    <ElevatedSheet open={open} onOpenChange={onOpenChange}>
      <ElevatedSheetContent side="right" className="sm:max-w-md w-full">
        <ElevatedSheetHeader>
          <div className="flex items-center gap-3">
            {view === "form" && (
              <button
                onClick={() => {
                  setView("list");
                  setEditingEvent(null);
                }}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-5 w-5" weight="bold" />
              </button>
            )}
            <div className="flex-1">
              <ElevatedSheetTitle>{viewTitle}</ElevatedSheetTitle>
              <ElevatedSheetDescription>
                {t("description")}
              </ElevatedSheetDescription>
            </div>
            {view === "list" && connected !== false && (
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" weight="bold" />
                {t("newEvent")}
              </button>
            )}
          </div>
        </ElevatedSheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {connected === false ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-2xl bg-muted/50 p-4 mb-4">
                <CalendarBlank
                  className="h-10 w-10 text-muted-foreground"
                  weight="duotone"
                />
              </div>
              <p className="text-sm font-semibold">{t("notConnected")}</p>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-[220px] leading-relaxed">
                {t("notConnectedDescription")}
              </p>
              <Link
                href="/dashboard/integrations"
                className="mt-5 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {t("goToIntegrations")}
              </Link>
            </div>
          ) : view === "form" ? (
            <EventForm
              event={editingEvent}
              onSave={handleSave}
              onDelete={
                editingEvent ? () => handleDelete(editingEvent.id) : undefined
              }
              onCancel={() => {
                setView("list");
                setEditingEvent(null);
              }}
            />
          ) : (
            <EventList
              events={events}
              loading={loading}
              error={error}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          )}
        </div>
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}


function EventList({
  events,
  loading,
  error,
  onEdit,
  onDelete,
}: {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations("calendarSheet");

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <CircleNotch className="h-6 w-6 animate-spin" />
        <p className="mt-2 text-sm">{t("loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-destructive">
        <p className="text-sm">{t("error")}</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div className="rounded-2xl bg-muted/50 p-4 mb-4">
          <CalendarCheck className="h-10 w-10" weight="duotone" />
        </div>
        <p className="text-sm font-medium">{t("noEvents")}</p>
      </div>
    );
  }

  const now = new Date();
  const todayEvents = events.filter((e) => {
    const start = new Date(e.startTime);
    return start.toDateString() === now.toDateString();
  });
  const upcomingEvents = events.filter((e) => {
    const start = new Date(e.startTime);
    return start > now && start.toDateString() !== now.toDateString();
  });
  const pastEvents = events.filter((e) => {
    const end = new Date(e.endTime);
    return (
      end < now && new Date(e.startTime).toDateString() !== now.toDateString()
    );
  });

  return (
    <div className="space-y-5">
      {todayEvents.length > 0 && (
        <EventSection
          label={t("today")}
          events={todayEvents}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
      {upcomingEvents.length > 0 && (
        <EventSection
          label={t("upcoming")}
          events={upcomingEvents}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
      {pastEvents.length > 0 && (
        <EventSection
          label={t("past")}
          events={pastEvents}
          onEdit={onEdit}
          onDelete={onDelete}
          muted
        />
      )}
    </div>
  );
}

function EventSection({
  label,
  events,
  onEdit,
  onDelete,
  muted,
}: {
  label: string;
  events: CalendarEvent[];
  onEdit: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
  muted?: boolean;
}) {
  return (
    <div>
      <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </h3>
      <div className="divide-y divide-border/40">
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onEdit={onEdit}
            onDelete={onDelete}
            muted={muted}
          />
        ))}
      </div>
    </div>
  );
}

function EventCard({
  event,
  onEdit,
  onDelete,
  muted,
}: {
  event: CalendarEvent;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
  muted?: boolean;
}) {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const color = event.color || "#3b82f6";

  const timeStr = event.allDay
    ? "All day"
    : `${formatTimeShort(start)} – ${formatTimeShort(end)}`;

  const dateStr = start.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className={cn(
        "group flex gap-3 py-3 cursor-pointer transition-colors hover:bg-muted/30 rounded-lg px-2 -mx-2",
        muted && "opacity-50",
      )}
      onClick={() => onEdit(event)}
    >
      {/* Color bar */}
      <div
        className="w-1 rounded-full shrink-0 self-stretch"
        style={{ backgroundColor: color }}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {event.title}
        </p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          <span>
            {dateStr} · {timeStr}
          </span>
        </div>
        {event.location && (
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground/70">
            <MapPin className="h-3 w-3 shrink-0" weight="fill" />
            <span className="truncate">{event.location}</span>
          </div>
        )}
        {event.meetingLink && (
          <a
            href={event.meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-1 text-xs text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <VideoCamera className="h-3 w-3" weight="fill" />
            Meet
          </a>
        )}
        {event.attendees && event.attendees.length > 0 && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {event.attendees.slice(0, 3).map((a) => (
              <div
                key={a.email}
                className="flex items-center gap-1 rounded-full bg-muted/60 pl-1 pr-2 py-0.5"
              >
                <UserCircle
                  size={12}
                  weight="duotone"
                  className="text-muted-foreground shrink-0"
                />
                <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                  {a.email}
                </span>
              </div>
            ))}
            {event.attendees.length > 3 && (
              <span className="text-[10px] text-muted-foreground/60">
                +{event.attendees.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(event);
          }}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <PencilSimple className="h-3.5 w-3.5" weight="bold" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(event.id);
          }}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive hover:text-white transition-colors"
        >
          <Trash className="h-3.5 w-3.5" weight="bold" />
        </button>
      </div>
    </div>
  );
}


function toLocalDateTimeString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

function formatTimeShort(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}


function EventForm({
  event,
  onSave,
  onDelete,
  onCancel,
}: {
  event: CalendarEvent | null;
  onSave: (input: CreateEventInput | UpdateEventInput) => Promise<void>;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("calendarSheet");
  const [submitting, setSubmitting] = React.useState(false);
  const [title, setTitle] = React.useState(event?.title ?? "");
  const [description, setDescription] = React.useState(
    event?.description ?? "",
  );
  const [location, setLocation] = React.useState(event?.location ?? "");
  const [startTime, setStartTime] = React.useState(
    event ? toLocalDateTimeString(new Date(event.startTime)) : "",
  );
  const [endTime, setEndTime] = React.useState(
    event ? toLocalDateTimeString(new Date(event.endTime)) : "",
  );
  const [allDay, setAllDay] = React.useState(event?.allDay ?? false);
  const [color, setColor] = React.useState(event?.color || EVENT_COLORS[0]);
  const [attendees, setAttendees] = React.useState(
    event?.attendees?.map((a) => a.email).join(", ") ?? "",
  );
  const [createMeet, setCreateMeet] = React.useState(false);
  const [guestsCanModify, setGuestsCanModify] = React.useState(
    event?.guestsCanModify ?? false,
  );
  const [guestsCanInviteOthers, setGuestsCanInviteOthers] = React.useState(
    event?.guestsCanInviteOthers ?? true,
  );
  const [guestsCanSeeOtherGuests, setGuestsCanSeeOtherGuests] = React.useState(
    event?.guestsCanSeeOtherGuests ?? true,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startTime || !endTime) return;
    setSubmitting(true);

    const attendeeList = attendees
      .split(",")
      .map((em) => em.trim())
      .filter(Boolean)
      .map((email) => ({ email }));

    const payload = {
      title,
      description: description || undefined,
      location: location || undefined,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      allDay,
      color,
      attendees: attendeeList.length > 0 ? attendeeList : undefined,
      createGoogleMeet: !event && createMeet ? true : undefined,
      guestsCanModify,
      guestsCanInviteOthers,
      guestsCanSeeOtherGuests,
    };

    await onSave(payload);
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-0">
      {/* Color strip */}
      <div
        className="h-1.5 w-full rounded-full mb-4"
        style={{ backgroundColor: color }}
      />

      {/* Title, prominent borderless input */}
      <div className="pb-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("form.titlePlaceholder")}
          className="w-full text-lg font-semibold bg-transparent border-0 border-b-2 border-border focus:border-primary outline-none pb-2 placeholder:text-muted-foreground/40 transition-colors"
          autoFocus
          required
        />
      </div>

      {/* Icon-row fields */}
      <div className="space-y-0.5">
        {/* Date & Time */}
        <div className="flex items-center gap-3 py-2.5 rounded-lg hover:bg-muted/30 px-2 -mx-2 transition-colors">
          <Clock
            size={18}
            weight="duotone"
            className="text-muted-foreground shrink-0"
          />
          <div className="flex-1 min-w-0">
            {!allDay ? (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm flex-1 min-w-0"
                  required
                />
                <span className="text-xs text-muted-foreground font-medium">
                  –
                </span>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm flex-1 min-w-0"
                  required
                />
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">
                {t("form.allDay")}
              </span>
            )}
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs text-muted-foreground">
                {t("form.allDay")}
              </span>
            </label>
          </div>
        </div>

        {/* Google Meet */}
        <div className="flex items-center gap-3 py-2.5 rounded-lg hover:bg-muted/30 px-2 -mx-2 transition-colors">
          <VideoCamera
            size={18}
            weight="duotone"
            className="text-muted-foreground shrink-0"
          />
          <div className="flex-1">
            {!event ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createMeet}
                  onChange={(e) => setCreateMeet(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">
                  {t("form.createGoogleMeet") || "Create Google Meet"}
                </span>
              </label>
            ) : event.meetingLink ? (
              <a
                href={event.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1.5"
              >
                <VideoCamera size={14} weight="fill" />
                {t("form.joinMeeting") || "Join meeting"}
              </a>
            ) : (
              <span className="text-sm text-muted-foreground">
                {t("form.noMeetingLink") || "No meeting link"}
              </span>
            )}
          </div>
        </div>

        {/* Location */}
        <div className="flex items-center gap-3 py-2.5 rounded-lg hover:bg-muted/30 px-2 -mx-2 transition-colors">
          <MapPin
            size={18}
            weight="duotone"
            className="text-muted-foreground shrink-0"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t("form.locationPlaceholder")}
            className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground/40"
          />
        </div>

        {/* Guests */}
        <div className="flex items-center gap-3 py-2.5 rounded-lg hover:bg-muted/30 px-2 -mx-2 transition-colors">
          <Users
            size={18}
            weight="duotone"
            className="text-muted-foreground shrink-0"
          />
          <input
            value={attendees}
            onChange={(e) => setAttendees(e.target.value)}
            placeholder={
              t("form.guestsPlaceholder") ||
              "email1@example.com, email2@example.com"
            }
            className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground/40"
          />
        </div>

        {/* Guest permissions */}
        {attendees.trim() && (
          <div className="ml-[30px] space-y-1.5 py-2 pl-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t("form.guestPermissions") || "Guest Permissions"}
            </p>
            {[
              {
                checked: guestsCanModify,
                onChange: setGuestsCanModify,
                label: t("form.modifyEvent") || "Modify event",
              },
              {
                checked: guestsCanInviteOthers,
                onChange: setGuestsCanInviteOthers,
                label: t("form.inviteOthers") || "Invite others",
              },
              {
                checked: guestsCanSeeOtherGuests,
                onChange: setGuestsCanSeeOtherGuests,
                label: t("form.seeGuestList") || "See guest list",
              },
            ].map(({ checked, onChange, label }) => (
              <label
                key={label}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onChange(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        )}

        {/* Description */}
        <div className="flex items-start gap-3 py-2.5 rounded-lg hover:bg-muted/30 px-2 -mx-2 transition-colors">
          <TextAlignLeft
            size={18}
            weight="duotone"
            className="text-muted-foreground shrink-0 mt-0.5"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("form.descriptionPlaceholder")}
            rows={2}
            className="flex-1 bg-transparent border-0 outline-none text-sm resize-none placeholder:text-muted-foreground/40"
          />
        </div>

        {/* Color */}
        <div className="flex items-center gap-3 py-2.5 rounded-lg hover:bg-muted/30 px-2 -mx-2 transition-colors">
          <Palette
            size={18}
            weight="duotone"
            className="text-muted-foreground shrink-0"
          />
          <div className="flex gap-1.5">
            {EVENT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={cn(
                  "w-5 h-5 rounded-full transition-all border-2",
                  color === c
                    ? "border-foreground scale-110"
                    : "border-transparent hover:scale-105",
                )}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 mt-2 border-t border-border/50">
        <div>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 transition-colors"
            >
              <Trash size={14} />
              {t("form.delete") || "Delete"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded-lg hover:bg-muted transition-colors"
          >
            {t("form.cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting || !title || !startTime || !endTime}
            className="px-4 py-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {submitting && <CircleNotch className="h-3.5 w-3.5 animate-spin" />}
            {event ? t("form.update") || "Update" : t("form.save")}
          </button>
        </div>
      </div>
    </form>
  );
}
