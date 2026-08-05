"use client";

import {
  CalendarBlank,
  CalendarCheck,
  CaretLeft,
  CaretRight,
  Clock,
  MapPin,
  Palette,
  ArrowsClockwise,
  PencilSimple,
  Plus,
  TextAlignLeft,
  Trash,
  UserCircle,
  Users,
  VideoCamera,
  Warning,
} from "@/components/icons";
import type {
  CalendarEvent,
  CreateEventInput,
  UpdateEventInput,
} from "@/lib/calendar/types";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarEvents,
  fetchGoogleConnection,
  updateCalendarEvent,
} from "@/lib/calendar/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

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

export default function CalendarPage() {
  const t = useTranslations("calendarPage");
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  // Reagendamento: a focused "move to a new date/time" flow that keeps the original
  // duration and all other fields, distinct from the full edit dialog.
  const [reschedulingEvent, setReschedulingEvent] =
    useState<CalendarEvent | null>(null);
  const [rescheduleStart, setRescheduleStart] = useState("");
  const [rescheduleSaving, setRescheduleSaving] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formStartTime, setFormStartTime] = useState("");
  const [formEndTime, setFormEndTime] = useState("");
  const [formAllDay, setFormAllDay] = useState(false);
  const [formColor, setFormColor] = useState(EVENT_COLORS[0]);
  const [formCreateMeet, setFormCreateMeet] = useState(false);
  const [formAttendees, setFormAttendees] = useState("");
  const [formGuestsCanModify, setFormGuestsCanModify] = useState(false);
  const [formGuestsCanInviteOthers, setFormGuestsCanInviteOthers] =
    useState(true);
  const [formGuestsCanSeeOtherGuests, setFormGuestsCanSeeOtherGuests] =
    useState(true);
  const [formVisibility, setFormVisibility] = useState("default");
  const [formTransparency, setFormTransparency] = useState("opaque");
  const [saving, setSaving] = useState(false);

  const monthNames = useMemo(() => t("monthNames").split(","), [t]);
  const dayNames = useMemo(() => t("dayNames").split(","), [t]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = useMemo(() => new Date(year, month, 1), [year, month]);
  const lastDay = useMemo(() => new Date(year, month + 1, 0), [year, month]);
  const startOffset = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  useEffect(() => {
    if (!currentWorkspace) return;
    fetchGoogleConnection().then((res) => {
      setConnected(res.connected);
    });
  }, [currentWorkspace]);

  const loadEvents = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    const from = new Date(year, month, 1).toISOString();
    const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    const res = await fetchCalendarEvents({ from, to, pageSize: 200 });
    if (!res.error) {
      setEvents(res.items);
    }
    setLoading(false);
  }, [currentWorkspace, year, month]);

  useEffect(() => {
    void loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace, year, month]);

  const getEventsForDay = useCallback(
    (day: number) => {
      const dayStart = new Date(year, month, day);
      const dayEnd = new Date(year, month, day, 23, 59, 59);
      return events
        .filter((e) => {
          const start = new Date(e.startTime);
          const end = new Date(e.endTime);
          return start <= dayEnd && end >= dayStart;
        })
        .sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        );
    },
    [events, year, month],
  );

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return getEventsForDay(selectedDate.getDate());
  }, [selectedDate, getEventsForDay]);

  const agendaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    agendaRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedDate]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const openCreateDialog = (day?: number) => {
    setEditingEvent(null);
    const date = day ? new Date(year, month, day) : new Date();
    const start = new Date(date);
    start.setHours(9, 0, 0, 0);
    const end = new Date(date);
    end.setHours(10, 0, 0, 0);
    setFormTitle("");
    setFormDescription("");
    setFormLocation("");
    setFormStartTime(toLocalDateTimeString(start));
    setFormEndTime(toLocalDateTimeString(end));
    setFormAllDay(false);
    setFormColor(EVENT_COLORS[0]);
    setFormCreateMeet(false);
    setFormAttendees("");
    setFormGuestsCanModify(false);
    setFormGuestsCanInviteOthers(true);
    setFormGuestsCanSeeOtherGuests(true);
    setFormVisibility("default");
    setFormTransparency("opaque");
    setDialogOpen(true);
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    setFormTitle(event.title);
    setFormDescription(event.description || "");
    setFormLocation(event.location || "");
    setFormStartTime(toLocalDateTimeString(new Date(event.startTime)));
    setFormEndTime(toLocalDateTimeString(new Date(event.endTime)));
    setFormAllDay(event.allDay);
    setFormColor(event.color || EVENT_COLORS[0]);
    setFormCreateMeet(false);
    setFormAttendees(event.attendees?.map((a) => a.email).join(", ") || "");
    setFormGuestsCanModify(event.guestsCanModify ?? false);
    setFormGuestsCanInviteOthers(event.guestsCanInviteOthers ?? true);
    setFormGuestsCanSeeOtherGuests(event.guestsCanSeeOtherGuests ?? true);
    setFormVisibility(event.visibility || "default");
    setFormTransparency(event.transparency || "opaque");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) return;
    setSaving(true);

    const attendees = formAttendees
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean)
      .map((email) => ({ email }));

    const payload = {
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      location: formLocation.trim() || undefined,
      startTime: new Date(formStartTime).toISOString(),
      endTime: new Date(formEndTime).toISOString(),
      allDay: formAllDay,
      color: formColor,
      attendees: attendees.length > 0 ? attendees : undefined,
      createGoogleMeet: formCreateMeet || undefined,
      guestsCanModify: formGuestsCanModify,
      guestsCanInviteOthers: formGuestsCanInviteOthers,
      guestsCanSeeOtherGuests: formGuestsCanSeeOtherGuests,
      visibility: formVisibility !== "default" ? formVisibility : undefined,
      transparency:
        formTransparency !== "opaque" ? formTransparency : undefined,
    };

    if (editingEvent) {
      const res = await updateCalendarEvent(
        editingEvent.id,
        payload as UpdateEventInput,
      );
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("eventUpdated"));
        setDialogOpen(false);
        loadEvents();
      }
    } else {
      const res = await createCalendarEvent(payload as CreateEventInput);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("eventCreated"));
        setDialogOpen(false);
        loadEvents();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm(t("deleteConfirm"))) return;
    const res = await deleteCalendarEvent(eventId);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(t("eventDeleted"));
      setDialogOpen(false);
      loadEvents();
    }
  };

  const openRescheduleDialog = (event: CalendarEvent) => {
    setReschedulingEvent(event);
    setRescheduleStart(toLocalDateTimeString(new Date(event.startTime)));
  };

  const handleReschedule = async () => {
    if (!reschedulingEvent || !rescheduleStart) return;
    setRescheduleSaving(true);
    // Keep the original duration: the new end is the new start shifted by the same span.
    const durationMs =
      new Date(reschedulingEvent.endTime).getTime() -
      new Date(reschedulingEvent.startTime).getTime();
    const newStart = new Date(rescheduleStart);
    const newEnd = new Date(newStart.getTime() + Math.max(durationMs, 0));

    const res = await updateCalendarEvent(reschedulingEvent.id, {
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
    } as UpdateEventInput);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Evento reagendado");
      setReschedulingEvent(null);
      loadEvents();
    }
    setRescheduleSaving(false);
  };

  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === day;

  const isSelected = (day: number) =>
    selectedDate &&
    selectedDate.getFullYear() === year &&
    selectedDate.getMonth() === month &&
    selectedDate.getDate() === day;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-4">
      <DashboardPageHeader
        icon={<CalendarBlank size={20} weight="duotone" />}
        badge={t("badge")}
        description={t("description")}
        actions={
          connected !== false ? (
            <ElevatedButton
              title={t("createEvent")}
              icon={<Plus size={16} />}
              iconVisible
              onClick={() => openCreateDialog()}
            />
          ) : undefined
        }
      />

      {/* No connection alert */}
      {connected === false && (
        <ElevatedContainer className="border-warning/30 bg-warning/10 dark:bg-warning/20">
          <div className="flex items-start gap-3 p-4">
            <Warning
              size={24}
              weight="duotone"
              className="text-warning mt-0.5 shrink-0"
            />
            <div className="space-y-1">
              <p className="text-sm font-medium text-warning dark:text-warning">
                {t("noConnection")}
              </p>
              <p className="text-xs text-warning dark:text-warning">
                {t("noConnectionDescription")}
              </p>
              <ElevatedButton
                variant="outline"
                size="sm"
                className="mt-2"
                title={t("goToSettings")}
                onClick={() => router.push("/dashboard/integrations")}
              />
            </div>
          </div>
        </ElevatedContainer>
      )}

      {/* Main layout: Calendar grid + Agenda sidebar */}
      <div className="flex gap-4">
        {/* ── Calendar grid ──────────────────────────────────────── */}
        <ElevatedContainer className="p-0 overflow-hidden flex-1 min-w-0">
          {/* Month navigation */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-1">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <CaretLeft size={16} weight="bold" />
              </button>
              <h2 className="text-base font-semibold min-w-[160px] text-center">
                {monthNames[month]} {year}
              </h2>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <CaretRight size={16} weight="bold" />
              </button>
            </div>
            <button
              onClick={goToday}
              className="text-xs font-medium text-primary-ink hover:text-primary-ink/80 px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              {t("today")}
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7">
            {dayNames.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-[11px] font-semibold text-muted-foreground/70"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Day cells */}
          {loading && connected !== false ? (
            <div className="flex items-center justify-center h-80 text-sm text-muted-foreground">
              {t("loading")}
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {cells.map((day, idx) => {
                const dayEvents = day ? getEventsForDay(day) : [];
                const hasEvents = dayEvents.length > 0;
                const sel = day ? isSelected(day) : false;
                const tod = day ? isToday(day) : false;

                return (
                  <div
                    key={idx}
                    className={cn(
                      "min-h-[100px] border-b border-r border-border p-1 cursor-pointer transition-all",
                      !day && "bg-muted",
                      sel && "bg-primary/[0.04]",
                      idx % 7 === 0 && "border-l border-border",
                    )}
                    onClick={() => {
                      if (day) setSelectedDate(new Date(year, month, day));
                    }}
                    onDoubleClick={() => {
                      if (day && connected !== false) openCreateDialog(day);
                    }}
                  >
                    {day && (
                      <>
                        <div className="flex items-center justify-between px-0.5">
                          <div
                            className={cn(
                              "inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-medium transition-colors",
                              tod &&
                                "bg-primary text-primary-foreground font-semibold",
                              sel &&
                                !tod &&
                                "bg-primary text-primary-foreground font-semibold",
                              !tod && !sel && "text-foreground/80",
                            )}
                          >
                            {day}
                          </div>
                          {hasEvents && !sel && (
                            <div className="flex gap-0.5">
                              {dayEvents.slice(0, 3).map((e) => (
                                <span
                                  key={e.id}
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{
                                    backgroundColor: e.color || EVENT_COLORS[0],
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="mt-0.5 space-y-0.5">
                          {dayEvents.slice(0, 2).map((evt) => (
                            <button
                              key={evt.id}
                              className="w-full text-left flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] leading-tight truncate transition-colors hover:opacity-80"
                              style={{
                                backgroundColor: `${evt.color || EVENT_COLORS[0]}12`,
                                color: evt.color || EVENT_COLORS[0],
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(evt);
                              }}
                            >
                              <span
                                className="w-1 h-1 rounded-full shrink-0"
                                style={{
                                  backgroundColor: evt.color || EVENT_COLORS[0],
                                }}
                              />
                              <span className="truncate font-medium">
                                {evt.allDay
                                  ? evt.title
                                  : `${formatTimeShort(new Date(evt.startTime))} ${evt.title}`}
                              </span>
                            </button>
                          ))}
                          {dayEvents.length > 2 && (
                            <p className="text-[11px] text-muted-foreground/60 px-1.5 font-medium">
                              +{dayEvents.length - 2}
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ElevatedContainer>

        {/* ── Agenda Sidebar ─────────────────────────────────────── */}
        <div className="w-[320px] shrink-0 hidden lg:block">
          <ElevatedContainer className="p-0 overflow-hidden sticky top-4">
            {/* Sidebar header */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {selectedDate.toLocaleDateString(undefined, {
                      weekday: "long",
                    })}
                  </p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {selectedDate.getDate()}
                  </p>
                </div>
                {connected !== false && (
                  <button
                    onClick={() => openCreateDialog(selectedDate.getDate())}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Plus size={14} weight="bold" />
                    {t("createEvent")}
                  </button>
                )}
              </div>
            </div>

            {/* Sidebar event list */}
            <div
              ref={agendaRef}
              className="max-h-[calc(100vh-320px)] overflow-y-auto"
            >
              {selectedDayEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/60">
                  <CalendarBlank size={32} weight="duotone" className="mb-2" />
                  <p className="text-xs font-medium">{t("noEvents")}</p>
                  {connected !== false && (
                    <button
                      onClick={() => openCreateDialog(selectedDate.getDate())}
                      className="mt-3 text-xs text-primary-ink hover:underline"
                    >
                      {t("createEvent")}
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {selectedDayEvents.map((evt) => (
                    <AgendaEventCard
                      key={evt.id}
                      event={evt}
                      onEdit={() => openEditDialog(evt)}
                      onReschedule={() => openRescheduleDialog(evt)}
                      onDelete={() => handleDelete(evt.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </ElevatedContainer>
        </div>
      </div>

      {/* ── Create/Edit Event Dialog ────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
          {/* Header with color strip */}
          <div className="h-2 w-full" style={{ backgroundColor: formColor }} />

          {/* Title */}
          <div className="px-6 pt-4 pb-2">
            <input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder={t("titlePlaceholder")}
              className="w-full text-lg font-semibold bg-transparent border-0 border-b-2 border-border focus:border-primary outline-none pb-2 placeholder:text-muted-foreground/40 transition-colors"
              autoFocus
            />
          </div>

          <div className="px-6 py-3 space-y-0.5 max-h-[60vh] overflow-y-auto">
            {/* Date & Time */}
            <div className="flex items-center gap-3 py-2 rounded-lg hover:bg-muted px-2 -mx-2 transition-colors">
              <Clock
                size={18}
                weight="duotone"
                className="text-muted-foreground shrink-0"
              />
              <div className="flex-1">
                {!formAllDay ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="datetime-local"
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm flex-1 min-w-0"
                    />
                    <span className="text-xs text-muted-foreground font-medium">
                      –
                    </span>
                    <input
                      type="datetime-local"
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm flex-1 min-w-0"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {t("allDay")}
                  </span>
                )}
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formAllDay}
                    onChange={(e) => setFormAllDay(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-xs text-muted-foreground">
                    {t("allDay")}
                  </span>
                </label>
              </div>
            </div>

            {/* Google Meet */}
            <div className="flex items-center gap-3 py-2 rounded-lg hover:bg-muted px-2 -mx-2 transition-colors">
              <VideoCamera
                size={18}
                weight="duotone"
                className="text-muted-foreground shrink-0"
              />
              <div className="flex-1">
                {!editingEvent ? (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formCreateMeet}
                      onChange={(e) => setFormCreateMeet(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">{t("createGoogleMeet")}</span>
                  </label>
                ) : editingEvent?.meetingLink ? (
                  <a
                    href={editingEvent.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-ink hover:underline flex items-center gap-1.5"
                  >
                    <VideoCamera size={14} weight="fill" />
                    {t("joinMeeting")}
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {t("noMeetingLink")}
                  </span>
                )}
              </div>
            </div>

            {/* Location */}
            <div className="flex items-center gap-3 py-2 rounded-lg hover:bg-muted px-2 -mx-2 transition-colors">
              <MapPin
                size={18}
                weight="duotone"
                className="text-muted-foreground shrink-0"
              />
              <ElevatedInput
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                label={t("locationPlaceholder")}
                className="flex-1 border-0 bg-transparent shadow-none px-0 h-8 focus-visible:ring-0"
              />
            </div>

            {/* Guests */}
            <div className="flex items-center gap-3 py-2 rounded-lg hover:bg-muted px-2 -mx-2 transition-colors">
              <Users
                size={18}
                weight="duotone"
                className="text-muted-foreground shrink-0"
              />
              <ElevatedInput
                value={formAttendees}
                onChange={(e) => setFormAttendees(e.target.value)}
                label={t("attendeesPlaceholder")}
                className="flex-1 border-0 bg-transparent shadow-none px-0 h-8 focus-visible:ring-0"
              />
            </div>

            {/* Guest permissions */}
            {formAttendees.trim() && (
              <div className="ml-[30px] space-y-1.5 py-2 pl-1">
                <p className="text-[11px] font-semibold text-muted-foreground">
                  {t("guestPermissions")}
                </p>
                {[
                  {
                    checked: formGuestsCanModify,
                    onChange: setFormGuestsCanModify,
                    label: t("modifyEvent"),
                  },
                  {
                    checked: formGuestsCanInviteOthers,
                    onChange: setFormGuestsCanInviteOthers,
                    label: t("inviteOthers"),
                  },
                  {
                    checked: formGuestsCanSeeOtherGuests,
                    onChange: setFormGuestsCanSeeOtherGuests,
                    label: t("seeGuestList"),
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
            <div className="flex items-start gap-3 py-2 rounded-lg hover:bg-muted px-2 -mx-2 transition-colors">
              <TextAlignLeft
                size={18}
                weight="duotone"
                className="text-muted-foreground shrink-0 mt-1"
              />
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t("descriptionPlaceholder")}
                rows={2}
                className="flex-1 bg-transparent border-0 outline-none text-sm resize-none placeholder:text-muted-foreground/40"
              />
            </div>

            {/* Color */}
            <div className="flex items-center gap-3 py-2 rounded-lg hover:bg-muted px-2 -mx-2 transition-colors">
              <Palette
                size={18}
                weight="duotone"
                className="text-muted-foreground shrink-0"
              />
              <div className="flex gap-1.5">
                {EVENT_COLORS.map((c) => (
                  <button
                    key={c}
                    className={cn(
                      "w-5 h-5 rounded-full transition-all border",
                      formColor === c
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105",
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setFormColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-muted">
            <div>
              {editingEvent && (
                <button
                  onClick={() => handleDelete(editingEvent.id)}
                  className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 transition-colors"
                >
                  <Trash size={14} />
                  {t("deleteEvent") || "Excluir"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDialogOpen(false)}
                className="px-3 py-1.5 text-sm rounded-lg hover:bg-muted transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formTitle.trim()}
                className="px-4 py-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? "..." : t("save")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reagendamento: focused new-date/time dialog that preserves the duration. */}
      <Dialog
        open={!!reschedulingEvent}
        onOpenChange={(open) => {
          if (!open) setReschedulingEvent(null);
        }}
      >
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
              <ArrowsClockwise size={16} weight="fill" className="text-white" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">Reagendar</h2>
              <p className="truncate text-xs text-muted-foreground">
                {reschedulingEvent?.title}
              </p>
            </div>
          </div>
          <div className="space-y-2 px-5 py-4">
            <label
              htmlFor="reschedule-start"
              className="block text-xs font-medium text-muted-foreground"
            >
              Novo início
            </label>
            <input
              id="reschedule-start"
              type="datetime-local"
              value={rescheduleStart}
              onChange={(e) => setRescheduleStart(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring"
            />
            <p className="text-[11px] text-muted-foreground">
              A duração da reunião é mantida.
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
            <button
              type="button"
              onClick={() => setReschedulingEvent(null)}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleReschedule}
              disabled={rescheduleSaving || !rescheduleStart}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {rescheduleSaving ? "Reagendando..." : "Confirmar"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function AgendaEventCard({
  event,
  onEdit,
  onReschedule,
  onDelete,
}: {
  event: CalendarEvent;
  onEdit: () => void;
  onReschedule: () => void;
  onDelete: () => void;
}) {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const color = event.color || EVENT_COLORS[0];

  return (
    <div
      className="group flex gap-3 px-4 py-3 hover:bg-muted transition-colors cursor-pointer"
      onClick={onEdit}
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
        <p className="text-xs text-muted-foreground mt-0.5">
          {event.allDay
            ? "Dia inteiro"
            : `${formatTimeShort(start)} – ${formatTimeShort(end)}`}
        </p>
        {event.location && (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground/70">
            <MapPin size={11} weight="fill" />
            <span className="truncate">{event.location}</span>
          </div>
        )}
        {event.meetingLink && (
          <a
            href={event.meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1 text-xs text-primary-ink hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <VideoCamera size={11} weight="fill" />
            Entrar na reunião
          </a>
        )}
        {event.attendees && event.attendees.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {event.attendees.slice(0, 3).map((a) => (
              <div
                key={a.email}
                className="flex items-center gap-1 rounded-full bg-muted pl-1 pr-2 py-0.5"
              >
                <UserCircle
                  size={12}
                  weight="duotone"
                  className="text-muted-foreground shrink-0"
                />
                <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">
                  {a.email}
                </span>
              </div>
            ))}
            {event.attendees.length > 3 && (
              <span className="text-[11px] text-muted-foreground/60">
                +{event.attendees.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1 rounded hover:bg-muted"
          title="Editar"
          aria-label="Editar evento"
        >
          <PencilSimple size={13} className="text-muted-foreground" />
        </button>
        {!event.allDay && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReschedule();
            }}
            className="p-1 rounded hover:bg-muted"
            title="Reagendar"
            aria-label="Reagendar evento"
          >
            <ArrowsClockwise size={13} className="text-primary-ink" />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 rounded hover:bg-destructive/10"
          title="Excluir"
          aria-label="Excluir evento"
        >
          <Trash size={13} className="text-destructive" />
        </button>
      </div>
    </div>
  );
}

function formatTimeShort(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function toLocalDateTimeString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}
