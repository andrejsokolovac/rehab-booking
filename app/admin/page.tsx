"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";

const BELGRADE_TIME_ZONE = "Europe/Belgrade";
const PIXELS_PER_MINUTE = 1.5;
const CALENDAR_VERTICAL_PADDING = 16;

type DatabaseId = number | string;

type Therapist = {
  id: DatabaseId;
  name: string;
};

type WorkingHour = {
  therapistId: DatabaseId;
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
};

type CalendarAppointment = {
  id: DatabaseId;
  therapistId: DatabaseId;
  childName: string;
  serviceName: string;
  calendarDate: string;
  startMinutes: number;
  durationMinutes: number;
  formattedStartTime: string;
};

type AppointmentDetails = {
  childName: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  therapistName: string;
  serviceName: string;
  startAt: string;
  endAt: string;
  status: string;
  createdAt: string;
};

type CalendarDateParts = {
  year: number;
  month: number;
  day: number;
};

const belgradeCalendarDateFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: BELGRADE_TIME_ZONE,
});

const zonedDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: BELGRADE_TIME_ZONE,
});

const appointmentTimeFormatter = new Intl.DateTimeFormat("sr-Latn-RS", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: BELGRADE_TIME_ZONE,
});

const selectedDateFormatter = new Intl.DateTimeFormat("sr-Latn-RS", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: BELGRADE_TIME_ZONE,
});

const detailDateFormatter = new Intl.DateTimeFormat("sr-Latn-RS", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: BELGRADE_TIME_ZONE,
});

const detailDateTimeFormatter = new Intl.DateTimeFormat("sr-Latn-RS", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: BELGRADE_TIME_ZONE,
});

function getDatabaseId(value: unknown): DatabaseId | null {
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  ) {
    return value;
  }

  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
    return value;
  }

  return null;
}

function getNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getFormatterParts(date: Date, formatter: Intl.DateTimeFormat) {
  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
}

function formatCalendarDate(parts: CalendarDateParts) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day,
  ).padStart(2, "0")}`;
}

function parseCalendarDate(value: string): CalendarDateParts | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, 12),
  );

  if (
    date.getUTCFullYear() !== parts.year ||
    date.getUTCMonth() !== parts.month - 1 ||
    date.getUTCDate() !== parts.day
  ) {
    return null;
  }

  return parts;
}

function addCalendarDays(value: string, amount: number) {
  const parts = parseCalendarDate(value);

  if (!parts) {
    return value;
  }

  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + amount, 12),
  );

  return formatCalendarDate({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

function getCalendarDayOfWeek(value: string) {
  const parts = parseCalendarDate(value);

  if (!parts) {
    return null;
  }

  const day = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, 12),
  ).getUTCDay();

  return day === 0 ? 7 : day;
}

function getCurrentBelgradeCalendarDate() {
  const parts = getFormatterParts(
    new Date(),
    belgradeCalendarDateFormatter,
  );

  return formatCalendarDate({
    year: parts.year,
    month: parts.month,
    day: parts.day,
  });
}

function getZonedDateTimeParts(date: Date) {
  const parts = getFormatterParts(date, zonedDateTimeFormatter);

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function getTimeZoneOffset(instant: Date) {
  const parts = getZonedDateTimeParts(instant);

  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) - instant.getTime()
  );
}

function toBelgradeInstant(calendarDate: string, totalMinutes: number) {
  const parts = parseCalendarDate(calendarDate);

  if (!parts || totalMinutes < 0 || totalMinutes >= 24 * 60) {
    return null;
  }

  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const localTimestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    hour,
    minute,
  );
  let instantTimestamp = localTimestamp;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offset = getTimeZoneOffset(new Date(instantTimestamp));
    const adjustedTimestamp = localTimestamp - offset;

    if (adjustedTimestamp === instantTimestamp) {
      break;
    }

    instantTimestamp = adjustedTimestamp;
  }

  const instant = new Date(instantTimestamp);
  const zonedParts = getZonedDateTimeParts(instant);

  if (
    zonedParts.year !== parts.year ||
    zonedParts.month !== parts.month ||
    zonedParts.day !== parts.day ||
    zonedParts.hour !== hour ||
    zonedParts.minute !== minute
  ) {
    return null;
  }

  return instant.toISOString();
}

function parseTime(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? 0);

  if (hours > 23 || minutes > 59 || seconds !== 0) {
    return null;
  }

  return hours * 60 + minutes;
}

function getTherapists(data: unknown): Therapist[] | null {
  if (!Array.isArray(data)) {
    return null;
  }

  const therapists: Therapist[] = [];

  for (const value of data) {
    if (!value || typeof value !== "object") {
      return null;
    }

    const row = value as Record<string, unknown>;
    const id = getDatabaseId(row.id);
    const name = getNonEmptyString(row.name);

    if (id === null || !name) {
      return null;
    }

    therapists.push({ id, name });
  }

  return therapists;
}

function getWorkingHours(data: unknown): WorkingHour[] | null {
  if (!Array.isArray(data)) {
    return null;
  }

  const workingHours: WorkingHour[] = [];

  for (const value of data) {
    if (!value || typeof value !== "object") {
      return null;
    }

    const row = value as Record<string, unknown>;
    const therapistId = getDatabaseId(row.therapist_id);
    const dayOfWeek = row.day_of_week;
    const startMinutes = parseTime(row.start_time);
    const endMinutes = parseTime(row.end_time);

    if (
      therapistId === null ||
      typeof dayOfWeek !== "number" ||
      !Number.isInteger(dayOfWeek) ||
      dayOfWeek < 1 ||
      dayOfWeek > 7 ||
      startMinutes === null ||
      endMinutes === null ||
      endMinutes <= startMinutes
    ) {
      return null;
    }

    workingHours.push({
      therapistId,
      dayOfWeek,
      startMinutes,
      endMinutes,
    });
  }

  return workingHours;
}

function getConfirmedAppointments(data: unknown): CalendarAppointment[] | null {
  if (!Array.isArray(data)) {
    return null;
  }

  const appointments: CalendarAppointment[] = [];

  for (const value of data) {
    if (!value || typeof value !== "object") {
      return null;
    }

    const row = value as Record<string, unknown>;

    if (row.status !== "confirmed") {
      continue;
    }

    const id = getDatabaseId(row.appointment_id);
    const therapistId = getDatabaseId(row.therapist_id);
    const childName = getNonEmptyString(row.child_name);
    const serviceName = getNonEmptyString(row.service_name);

    if (
      id === null ||
      therapistId === null ||
      !childName ||
      !serviceName ||
      typeof row.start_at !== "string" ||
      typeof row.end_at !== "string"
    ) {
      return null;
    }

    const start = new Date(row.start_at);
    const end = new Date(row.end_at);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      return null;
    }

    const startParts = getZonedDateTimeParts(start);

    appointments.push({
      id,
      therapistId,
      childName,
      serviceName,
      calendarDate: formatCalendarDate({
        year: startParts.year,
        month: startParts.month,
        day: startParts.day,
      }),
      startMinutes: startParts.hour * 60 + startParts.minute,
      durationMinutes: (end.getTime() - start.getTime()) / 60_000,
      formattedStartTime: appointmentTimeFormatter.format(start),
    });
  }

  return appointments;
}

function getAppointmentDetails(
  data: unknown,
  expectedAppointmentId: DatabaseId,
): AppointmentDetails | null {
  const value = Array.isArray(data) ? data[0] : data;

  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const appointmentId = getDatabaseId(row.appointment_id);
  const childName = getNonEmptyString(row.child_name);
  const parentName = getNonEmptyString(row.parent_name);
  const parentEmail = getNonEmptyString(row.parent_email);
  const parentPhone = getNonEmptyString(row.parent_phone);
  const therapistName = getNonEmptyString(row.therapist_name);
  const serviceName = getNonEmptyString(row.service_name);
  const status = getNonEmptyString(row.status);

  if (
    appointmentId === null ||
    !idsMatch(appointmentId, expectedAppointmentId) ||
    !childName ||
    !parentName ||
    !parentEmail ||
    !parentPhone ||
    !therapistName ||
    !serviceName ||
    !status ||
    typeof row.start_at !== "string" ||
    typeof row.end_at !== "string" ||
    typeof row.created_at !== "string"
  ) {
    return null;
  }

  const start = new Date(row.start_at);
  const end = new Date(row.end_at);
  const created = new Date(row.created_at);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    Number.isNaN(created.getTime()) ||
    end <= start
  ) {
    return null;
  }

  return {
    childName,
    parentName,
    parentEmail,
    parentPhone,
    therapistName,
    serviceName,
    startAt: row.start_at,
    endAt: row.end_at,
    status,
    createdAt: row.created_at,
  };
}

function getVisibleTimeRange(workingHours: WorkingHour[]) {
  if (workingHours.length === 0) {
    return { startMinutes: 8 * 60, endMinutes: 18 * 60 };
  }

  const earliestStart = Math.min(
    ...workingHours.map((workingHour) => workingHour.startMinutes),
  );
  const latestEnd = Math.max(
    ...workingHours.map((workingHour) => workingHour.endMinutes),
  );

  return {
    startMinutes: Math.floor(earliestStart / 60) * 60,
    endMinutes: Math.ceil(latestEnd / 60) * 60,
  };
}

function formatTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatSelectedDate(value: string) {
  const parts = parseCalendarDate(value);

  if (!parts) {
    return "Izabrani dan";
  }

  const safeInstant = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, 12),
  );

  return selectedDateFormatter.format(safeInstant);
}

function idsMatch(first: DatabaseId, second: DatabaseId) {
  return String(first) === String(second);
}

function formatDetailsDate(value: string) {
  return detailDateFormatter.format(new Date(value));
}

function formatDetailsTime(startAt: string, endAt: string) {
  return `${appointmentTimeFormatter.format(new Date(startAt))}–${appointmentTimeFormatter.format(new Date(endAt))}`;
}

function formatCreatedAt(value: string) {
  return detailDateTimeFormatter.format(new Date(value));
}

function getFriendlyStatus(status: string) {
  if (status === "confirmed") {
    return "Potvrđen";
  }

  if (status === "cancelled") {
    return "Otkazan";
  }

  return "Nepoznat";
}

function DailyCalendar({
  therapists,
  workingHours,
  appointments,
  onAppointmentClick,
}: {
  therapists: Therapist[];
  workingHours: WorkingHour[];
  appointments: CalendarAppointment[];
  onAppointmentClick: (appointmentId: DatabaseId) => void;
}) {
  const visibleRange = getVisibleTimeRange(workingHours);
  const calendarHeight =
    (visibleRange.endMinutes - visibleRange.startMinutes) * PIXELS_PER_MINUTE +
    CALENDAR_VERTICAL_PADDING * 2;
  const timeLabels: number[] = [];
  const minimumWidth = 76 + therapists.length * 190;
  const gridTemplateColumns = `76px repeat(${therapists.length}, minmax(190px, 1fr))`;

  for (
    let minute = visibleRange.startMinutes;
    minute <= visibleRange.endMinutes;
    minute += 60
  ) {
    timeLabels.push(minute);
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-[#397267]/12 bg-white/80 shadow-[0_14px_38px_rgba(36,60,56,0.07)]">
      <div style={{ minWidth: minimumWidth }}>
        <div
          className="grid border-b border-[#397267]/12 bg-[#f8f5ef]"
          style={{ gridTemplateColumns }}
        >
          <div className="sticky left-0 z-30 flex items-center justify-center border-r border-[#397267]/12 bg-[#f8f5ef] px-2 py-4 text-xs font-semibold tracking-[0.1em] text-[#6b807c] uppercase">
            Vreme
          </div>
          {therapists.map((therapist) => (
            <div
              key={String(therapist.id)}
              className="border-r border-[#397267]/12 px-3 py-4 text-center last:border-r-0"
            >
              <p className="text-sm font-semibold text-[#243c38]">
                {therapist.name}
              </p>
            </div>
          ))}
        </div>

        <div className="grid" style={{ gridTemplateColumns }}>
          <div
            className="sticky left-0 z-20 border-r border-[#397267]/12 bg-[#f8f5ef]"
            style={{ height: calendarHeight }}
          >
            {timeLabels.map((minute) => (
              <span
                key={minute}
                className="absolute right-3 -translate-y-1/2 text-xs font-medium text-[#6b807c]"
                style={{
                  top:
                    CALENDAR_VERTICAL_PADDING +
                    (minute - visibleRange.startMinutes) * PIXELS_PER_MINUTE,
                }}
              >
                {formatTime(minute)}
              </span>
            ))}
          </div>

          {therapists.map((therapist) => {
            const therapistWorkingHours = workingHours.filter((workingHour) =>
              idsMatch(workingHour.therapistId, therapist.id),
            );
            const therapistAppointments = appointments.filter((appointment) =>
              idsMatch(appointment.therapistId, therapist.id),
            );

            return (
              <div
                key={String(therapist.id)}
                className="relative border-r border-[#397267]/12 bg-[#eee9e1] last:border-r-0"
                style={{ height: calendarHeight }}
              >
                {therapistWorkingHours.map((workingHour, index) => {
                  const intervalStart = Math.max(
                    workingHour.startMinutes,
                    visibleRange.startMinutes,
                  );
                  const intervalEnd = Math.min(
                    workingHour.endMinutes,
                    visibleRange.endMinutes,
                  );

                  if (intervalEnd <= intervalStart) {
                    return null;
                  }

                  return (
                    <div
                      key={`${workingHour.startMinutes}-${workingHour.endMinutes}-${index}`}
                      aria-hidden="true"
                      className="absolute inset-x-0 bg-[#fbfdfb]"
                      style={{
                        top:
                          CALENDAR_VERTICAL_PADDING +
                          (intervalStart - visibleRange.startMinutes) *
                          PIXELS_PER_MINUTE,
                        height:
                          (intervalEnd - intervalStart) * PIXELS_PER_MINUTE,
                      }}
                    />
                  );
                })}

                {timeLabels.map((minute) => (
                  <div
                    key={minute}
                    aria-hidden="true"
                    className="absolute inset-x-0 z-10 border-t border-[#397267]/10"
                    style={{
                      top:
                        CALENDAR_VERTICAL_PADDING +
                        (minute - visibleRange.startMinutes) *
                        PIXELS_PER_MINUTE,
                    }}
                  />
                ))}

                {therapistWorkingHours.length === 0 && (
                  <div className="absolute inset-x-3 top-5 z-20 rounded-2xl border border-[#8a7f70]/15 bg-white/55 px-3 py-2 text-center text-xs font-semibold text-[#7b746b]">
                    Ne radi ovog dana
                  </div>
                )}

                {therapistAppointments.map((appointment) => {
                  const appointmentStart = Math.max(
                    appointment.startMinutes,
                    visibleRange.startMinutes,
                  );
                  const appointmentEnd = Math.min(
                    appointment.startMinutes + appointment.durationMinutes,
                    visibleRange.endMinutes,
                  );

                  if (appointmentEnd <= appointmentStart) {
                    return null;
                  }

                  return (
                    <button
                      type="button"
                      key={String(appointment.id)}
                      onClick={() => onAppointmentClick(appointment.id)}
                      className="absolute inset-x-1.5 z-30 cursor-pointer overflow-hidden rounded-xl border border-[#397267]/25 bg-[#dceee5] px-2 py-1 text-left text-[11px] leading-3 text-[#243c38] shadow-[0_5px_14px_rgba(36,60,56,0.1)] transition hover:border-[#397267]/45 hover:bg-[#d2e9dd] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#397267]"
                      style={{
                        top:
                          CALENDAR_VERTICAL_PADDING +
                          (appointmentStart - visibleRange.startMinutes) *
                          PIXELS_PER_MINUTE,
                        height:
                          (appointmentEnd - appointmentStart) *
                          PIXELS_PER_MINUTE,
                      }}
                      title={`${appointment.formattedStartTime} · ${appointment.childName} · ${appointment.serviceName}`}
                    >
                      <p className="font-bold">
                        {appointment.formattedStartTime}
                      </p>
                      <p className="truncate font-semibold">
                        {appointment.childName}
                      </p>
                      <p className="truncate text-[#526b66]">
                        {appointment.serviceName}
                      </p>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

async function signOutWithoutThrowing() {
  try {
    await supabase.auth.signOut();
  } catch {
    // Access is denied even if the remote sign-out request cannot complete.
  }
}

export default function AdminPage() {
  const router = useRouter();
  const signOutInProgress = useRef(false);
  const detailsRequestId = useRef(0);
  const [selectedDate, setSelectedDate] = useState(
    getCurrentBelgradeCalendarDate,
  );
  const [therapists, setTherapists] = useState<Therapist[]>();
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([]);
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isScheduleLoading, setIsScheduleLoading] = useState(true);
  const [pageError, setPageError] = useState<string>();
  const [scheduleError, setScheduleError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string>();
  const [selectedAppointmentId, setSelectedAppointmentId] =
    useState<DatabaseId | null>(null);
  const [appointmentDetails, setAppointmentDetails] =
    useState<AppointmentDetails>();
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string>();

  useEffect(() => {
    let isActive = true;

    async function verifyAccessAndLoadTherapists() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          if (isActive) {
            router.replace("/staff/login");
          }
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("staff_profiles")
          .select("role, therapist_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError || profile?.role !== "admin") {
          await signOutWithoutThrowing();

          if (isActive) {
            router.replace("/staff/login");
          }
          return;
        }

        if (isActive) {
          setIsAuthorized(true);
        }

        const { data, error } = await supabase
          .from("therapists")
          .select("id, name")
          .order("id", { ascending: true });
        const loadedTherapists = getTherapists(data);

        if (error || !loadedTherapists) {
          if (isActive) {
            setPageError(
              "Raspored trenutno nije moguće učitati. Pokušajte ponovo kasnije.",
            );
          }
          return;
        }

        if (isActive) {
          setTherapists(loadedTherapists);
        }
      } catch {
        await signOutWithoutThrowing();

        if (isActive) {
          router.replace("/staff/login");
        }
      }
    }

    void verifyAccessAndLoadTherapists();

    return () => {
      isActive = false;
    };
  }, [router]);

  useEffect(() => {
    if (!isAuthorized || !therapists) {
      return;
    }

    let isActive = true;

    async function loadDaySchedule() {
      const dayOfWeek = getCalendarDayOfWeek(selectedDate);
      const from = toBelgradeInstant(selectedDate, 0);
      const to = toBelgradeInstant(addCalendarDays(selectedDate, 1), 0);

      if (dayOfWeek === null || !from || !to) {
        if (isActive) {
          setScheduleError("Izabrani datum nije ispravan.");
          setIsScheduleLoading(false);
        }
        return;
      }

      try {
        const [workingHoursResult, appointmentsResult] = await Promise.all([
          supabase
            .from("working_hours")
            .select("therapist_id, day_of_week, start_time, end_time")
            .eq("day_of_week", dayOfWeek)
            .order("start_time", { ascending: true }),
          supabase.rpc("get_admin_appointments", {
            p_from: from,
            p_to: to,
          }),
        ]);
        const loadedWorkingHours = getWorkingHours(workingHoursResult.data);
        const loadedAppointments = getConfirmedAppointments(
          appointmentsResult.data,
        );

        if (
          workingHoursResult.error ||
          appointmentsResult.error ||
          !loadedWorkingHours ||
          !loadedAppointments
        ) {
          if (isActive) {
            setWorkingHours([]);
            setAppointments([]);
            setScheduleError(
              "Raspored za izabrani dan trenutno nije moguće učitati.",
            );
          }
          return;
        }

        if (isActive) {
          setWorkingHours(loadedWorkingHours);
          setAppointments(
            loadedAppointments.filter(
              (appointment) => appointment.calendarDate === selectedDate,
            ),
          );
          setScheduleError(undefined);
        }
      } catch {
        if (isActive) {
          setWorkingHours([]);
          setAppointments([]);
          setScheduleError(
            "Došlo je do neočekivane greške pri učitavanju rasporeda.",
          );
        }
      } finally {
        if (isActive) {
          setIsScheduleLoading(false);
        }
      }
    }

    void loadDaySchedule();

    return () => {
      isActive = false;
    };
  }, [isAuthorized, reloadKey, selectedDate, therapists]);

  async function openAppointmentDetails(appointmentId: DatabaseId) {
    const requestId = detailsRequestId.current + 1;
    detailsRequestId.current = requestId;
    setSelectedAppointmentId(appointmentId);
    setAppointmentDetails(undefined);
    setDetailsError(undefined);
    setIsDetailsLoading(true);

    try {
      const { data, error } = await supabase.rpc(
        "get_admin_appointment_details",
        {
          p_appointment_id: appointmentId,
        },
      );
      const loadedDetails = getAppointmentDetails(data, appointmentId);

      if (detailsRequestId.current !== requestId) {
        return;
      }

      if (error || !loadedDetails) {
        setDetailsError(
          "Detalje termina trenutno nije moguće učitati. Pokušajte ponovo.",
        );
        return;
      }

      setAppointmentDetails(loadedDetails);
    } catch {
      if (detailsRequestId.current === requestId) {
        setDetailsError(
          "Došlo je do neočekivane greške pri učitavanju detalja.",
        );
      }
    } finally {
      if (detailsRequestId.current === requestId) {
        setIsDetailsLoading(false);
      }
    }
  }

  function closeAppointmentDetails() {
    detailsRequestId.current += 1;
    setSelectedAppointmentId(null);
    setAppointmentDetails(undefined);
    setDetailsError(undefined);
    setIsDetailsLoading(false);
  }

  function showDay(nextDate: string) {
    setScheduleError(undefined);
    setIsScheduleLoading(true);

    if (nextDate === selectedDate) {
      setReloadKey((currentKey) => currentKey + 1);
    } else {
      setSelectedDate(nextDate);
    }
  }

  async function handleSignOut() {
    if (signOutInProgress.current) {
      return;
    }

    signOutInProgress.current = true;
    setIsSigningOut(true);
    setSignOutError(undefined);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setSignOutError("Odjava trenutno nije moguća. Pokušajte ponovo.");
        return;
      }

      router.replace("/staff/login");
      router.refresh();
    } catch {
      setSignOutError("Došlo je do neočekivane greške pri odjavi.");
    } finally {
      signOutInProgress.current = false;
      setIsSigningOut(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#fffaf3] text-[#243c38]">
      <div
        aria-hidden="true"
        className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#e2f0e7] sm:h-96 sm:w-96"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-28 -left-28 h-64 w-64 rounded-full bg-[#f9dfcb] sm:h-80 sm:w-80"
      />

      <header className="relative z-10 border-b border-[#243c38]/8">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-5 sm:px-8 lg:px-10">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-md focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#397267]"
          >
            <span
              aria-hidden="true"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#397267] text-lg font-semibold text-white shadow-sm"
            >
              C
            </span>
            <span className="hidden text-sm leading-snug font-semibold tracking-tight text-[#243c38] sm:block sm:text-base">
              Centar za razvoj i rehabilitaciju
            </span>
          </Link>

          {isAuthorized && (
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              aria-busy={isSigningOut}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-[#397267]/20 bg-white/75 px-5 py-2.5 text-sm font-semibold text-[#397267] transition hover:border-[#397267]/35 hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#397267] disabled:cursor-wait disabled:opacity-65"
            >
              {isSigningOut ? "Odjavljivanje..." : "Odjavi se"}
            </button>
          )}
        </div>
      </header>

      <main className="relative z-10 flex-1">
        <section className="mx-auto w-full max-w-7xl px-6 py-12 sm:px-8 sm:py-16 lg:px-10">
          {!isAuthorized ? (
            <div
              role="status"
              className="mx-auto mt-16 max-w-md rounded-3xl border border-[#397267]/12 bg-white/80 p-8 text-center shadow-[0_14px_38px_rgba(36,60,56,0.07)]"
            >
              <p className="font-semibold text-[#243c38]">Provera pristupa...</p>
              <p className="mt-2 text-sm leading-6 text-[#6b807c]">
                Molimo sačekajte trenutak.
              </p>
            </div>
          ) : pageError ? (
            <div
              role="alert"
              className="mx-auto mt-16 max-w-xl rounded-3xl border border-[#b45745]/20 bg-white/80 p-8 text-center text-[#8f4033] shadow-[0_14px_38px_rgba(36,60,56,0.07)]"
            >
              {pageError}
            </div>
          ) : therapists ? (
            <>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-sm font-semibold tracking-[0.12em] text-[#397267] uppercase">
                    Admin panel
                  </p>
                  <h1 className="mt-3 text-4xl leading-tight font-semibold tracking-[-0.035em] text-[#243c38] sm:text-5xl">
                    Raspored centra
                  </h1>
                </div>

                <div className="flex flex-col gap-3 lg:items-end">
                  <p className="text-base font-semibold capitalize text-[#526b66]">
                    {formatSelectedDate(selectedDate)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => showDay(addCalendarDays(selectedDate, -1))}
                      disabled={isScheduleLoading}
                      className="min-h-11 rounded-full border border-[#397267]/20 bg-white/80 px-4 py-2 text-sm font-semibold text-[#397267] transition hover:border-[#397267]/35 hover:bg-white disabled:cursor-wait disabled:opacity-55"
                    >
                      Prethodni dan
                    </button>
                    <button
                      type="button"
                      onClick={() => showDay(getCurrentBelgradeCalendarDate())}
                      disabled={isScheduleLoading}
                      className="min-h-11 rounded-full bg-[#397267] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2f6158] disabled:cursor-wait disabled:opacity-55"
                    >
                      Danas
                    </button>
                    <button
                      type="button"
                      onClick={() => showDay(addCalendarDays(selectedDate, 1))}
                      disabled={isScheduleLoading}
                      className="min-h-11 rounded-full border border-[#397267]/20 bg-white/80 px-4 py-2 text-sm font-semibold text-[#397267] transition hover:border-[#397267]/35 hover:bg-white disabled:cursor-wait disabled:opacity-55"
                    >
                      Sledeći dan
                    </button>
                  </div>
                </div>
              </div>

              {signOutError && (
                <div
                  role="alert"
                  className="mt-6 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-5 py-4 text-sm font-medium leading-6 text-[#8f4033]"
                >
                  {signOutError}
                </div>
              )}

              <div className="mt-7 flex flex-wrap gap-5 text-xs font-medium text-[#6b807c]">
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm border border-[#397267]/15 bg-[#fbfdfb]" />
                  Radno vreme
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm bg-[#eee9e1]" />
                  Van radnog vremena
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm border border-[#397267]/25 bg-[#dceee5]" />
                  Zakazan termin
                </span>
              </div>

              {therapists.length === 0 ? (
                <p className="mt-6 rounded-2xl border border-[#397267]/12 bg-white/70 px-5 py-4 text-sm font-medium text-[#526b66]">
                  Trenutno nema unetih terapeuta.
                </p>
              ) : isScheduleLoading ? (
                <div
                  role="status"
                  className="mt-6 rounded-3xl border border-[#397267]/12 bg-white/80 p-8 text-center text-[#526b66] shadow-[0_14px_38px_rgba(36,60,56,0.07)]"
                >
                  Učitavanje rasporeda...
                </div>
              ) : scheduleError ? (
                <div
                  role="alert"
                  className="mt-6 rounded-3xl border border-[#b45745]/20 bg-white/80 p-7 text-center text-[#8f4033] shadow-[0_14px_38px_rgba(36,60,56,0.07)]"
                >
                  <p>{scheduleError}</p>
                  <button
                    type="button"
                    onClick={() => showDay(selectedDate)}
                    className="mt-5 min-h-11 rounded-full bg-[#397267] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#2f6158]"
                  >
                    Pokušaj ponovo
                  </button>
                </div>
              ) : (
                <>
                  {appointments.length === 0 && (
                    <p className="mt-6 rounded-2xl border border-[#397267]/12 bg-white/70 px-5 py-4 text-sm font-medium text-[#526b66]">
                      Nema zakazanih termina za izabrani dan.
                    </p>
                  )}
                  <div className="mt-6">
                    <DailyCalendar
                      therapists={therapists}
                      workingHours={workingHours}
                      appointments={appointments}
                      onAppointmentClick={openAppointmentDetails}
                    />
                  </div>
                </>
              )}
            </>
          ) : null}
        </section>
      </main>

      {selectedAppointmentId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#172b27]/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAppointmentDetails();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="appointment-details-title"
            className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/80 bg-[#fffaf3] p-6 shadow-[0_28px_90px_rgba(23,43,39,0.28)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold tracking-[0.12em] text-[#397267] uppercase">
                  Admin panel
                </p>
                <h2
                  id="appointment-details-title"
                  className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#243c38] sm:text-3xl"
                >
                  Detalji termina
                </h2>
              </div>
              <button
                type="button"
                onClick={closeAppointmentDetails}
                aria-label="Zatvori detalje termina"
                className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border border-[#397267]/15 bg-white text-xl leading-none text-[#397267] transition hover:border-[#397267]/30 hover:bg-[#edf5f0] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#397267]"
              >
                ×
              </button>
            </div>

            {isDetailsLoading ? (
              <div
                role="status"
                className="mt-8 rounded-2xl border border-[#397267]/12 bg-white/70 px-5 py-8 text-center text-sm font-medium text-[#526b66]"
              >
                Učitavanje detalja termina...
              </div>
            ) : detailsError ? (
              <div
                role="alert"
                className="mt-8 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-5 py-6 text-center text-sm text-[#8f4033]"
              >
                <p>{detailsError}</p>
                <button
                  type="button"
                  onClick={() =>
                    void openAppointmentDetails(selectedAppointmentId)
                  }
                  className="mt-5 min-h-11 rounded-full bg-[#397267] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#2f6158]"
                >
                  Pokušaj ponovo
                </button>
              </div>
            ) : appointmentDetails ? (
              <>
                <dl className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  <div className="border-b border-[#397267]/10 pb-4">
                    <dt className="text-xs font-semibold tracking-wide text-[#6b807c] uppercase">
                      Dete
                    </dt>
                    <dd className="mt-1.5 font-semibold text-[#243c38]">
                      {appointmentDetails.childName}
                    </dd>
                  </div>
                  <div className="border-b border-[#397267]/10 pb-4">
                    <dt className="text-xs font-semibold tracking-wide text-[#6b807c] uppercase">
                      Roditelj
                    </dt>
                    <dd className="mt-1.5 font-semibold text-[#243c38]">
                      {appointmentDetails.parentName}
                    </dd>
                  </div>
                  <div className="border-b border-[#397267]/10 pb-4">
                    <dt className="text-xs font-semibold tracking-wide text-[#6b807c] uppercase">
                      Telefon
                    </dt>
                    <dd className="mt-1.5 font-medium text-[#243c38]">
                      {appointmentDetails.parentPhone}
                    </dd>
                  </div>
                  <div className="border-b border-[#397267]/10 pb-4">
                    <dt className="text-xs font-semibold tracking-wide text-[#6b807c] uppercase">
                      Email
                    </dt>
                    <dd className="mt-1.5 break-all font-medium text-[#243c38]">
                      {appointmentDetails.parentEmail}
                    </dd>
                  </div>
                  <div className="border-b border-[#397267]/10 pb-4">
                    <dt className="text-xs font-semibold tracking-wide text-[#6b807c] uppercase">
                      Terapeut
                    </dt>
                    <dd className="mt-1.5 font-medium text-[#243c38]">
                      {appointmentDetails.therapistName}
                    </dd>
                  </div>
                  <div className="border-b border-[#397267]/10 pb-4">
                    <dt className="text-xs font-semibold tracking-wide text-[#6b807c] uppercase">
                      Usluga
                    </dt>
                    <dd className="mt-1.5 font-medium text-[#243c38]">
                      {appointmentDetails.serviceName}
                    </dd>
                  </div>
                  <div className="border-b border-[#397267]/10 pb-4">
                    <dt className="text-xs font-semibold tracking-wide text-[#6b807c] uppercase">
                      Datum
                    </dt>
                    <dd className="mt-1.5 capitalize font-medium text-[#243c38]">
                      {formatDetailsDate(appointmentDetails.startAt)}
                    </dd>
                  </div>
                  <div className="border-b border-[#397267]/10 pb-4">
                    <dt className="text-xs font-semibold tracking-wide text-[#6b807c] uppercase">
                      Vreme
                    </dt>
                    <dd className="mt-1.5 font-medium text-[#243c38]">
                      {formatDetailsTime(
                        appointmentDetails.startAt,
                        appointmentDetails.endAt,
                      )}
                    </dd>
                  </div>
                  <div className="pb-2 sm:col-span-2">
                    <dt className="text-xs font-semibold tracking-wide text-[#6b807c] uppercase">
                      Status
                    </dt>
                    <dd className="mt-2">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                          appointmentDetails.status === "cancelled"
                            ? "bg-[#f7dfd7] text-[#914b3b]"
                            : "bg-[#dceee5] text-[#2f6158]"
                        }`}
                      >
                        {getFriendlyStatus(appointmentDetails.status)}
                      </span>
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 rounded-2xl bg-white/70 px-4 py-3 text-xs text-[#6b807c]">
                  Termin je kreiran: {formatCreatedAt(appointmentDetails.createdAt)}
                </div>

                <div className="mt-7 flex justify-end">
                  <button
                    type="button"
                    onClick={closeAppointmentDetails}
                    className="min-h-11 rounded-full bg-[#397267] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[#2f6158] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#397267]"
                  >
                    Zatvori
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
