"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const BELGRADE_TIME_ZONE = "Europe/Belgrade";
const PIXELS_PER_MINUTE = 1.6;
const WEEKDAY_NAMES = [
  "Ponedeljak",
  "Utorak",
  "Sreda",
  "Četvrtak",
  "Petak",
];

type DatabaseId = number | string;

type WorkingHour = {
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
};

type TherapistContext = {
  id: DatabaseId;
  name: string;
  workingHours: WorkingHour[];
};

type CalendarAppointment = {
  id: DatabaseId;
  childName: string;
  serviceName: string;
  calendarDate: string;
  startMinutes: number;
  durationMinutes: number;
  formattedStartTime: string;
};

type CalendarUnavailability = {
  id: DatabaseId;
  calendarDate: string;
  startMinutes: number;
  durationMinutes: number;
  reason: string | null;
};

type AppointmentDetails = {
  childName: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  serviceName: string;
  startAt: string;
  endAt: string;
  status: string;
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

const weekRangeDateFormatter = new Intl.DateTimeFormat("sr-Latn-RS", {
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
    return 1;
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

function getCurrentWeekStart() {
  const today = getCurrentBelgradeCalendarDate();
  return addCalendarDays(today, 1 - getCalendarDayOfWeek(today));
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

function getTherapistId(profile: unknown) {
  if (!profile || typeof profile !== "object") {
    return null;
  }

  const row = profile as Record<string, unknown>;

  return row.role === "therapist"
    ? getDatabaseId(row.therapist_id)
    : null;
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
    const dayOfWeek = row.day_of_week;
    const startMinutes = parseTime(row.start_time);
    const endMinutes = parseTime(row.end_time);

    if (
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

    workingHours.push({ dayOfWeek, startMinutes, endMinutes });
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
    const childName = getNonEmptyString(row.child_name);
    const serviceName = getNonEmptyString(row.service_name);

    if (
      id === null ||
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
  const serviceName = getNonEmptyString(row.service_name);
  const status = getNonEmptyString(row.status);

  if (
    appointmentId === null ||
    String(appointmentId) !== String(expectedAppointmentId) ||
    !childName ||
    !parentName ||
    !parentEmail ||
    !parentPhone ||
    !serviceName ||
    !status ||
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

  return {
    childName,
    parentName,
    parentEmail,
    parentPhone,
    serviceName,
    startAt: row.start_at,
    endAt: row.end_at,
    status,
  };
}

function getMyUnavailability(
  data: unknown,
  weekStart: string,
): CalendarUnavailability[] | null {
  if (!Array.isArray(data)) {
    return null;
  }

  const intervals: CalendarUnavailability[] = [];

  for (const value of data) {
    if (!value || typeof value !== "object") {
      return null;
    }

    const row = value as Record<string, unknown>;
    const id = getDatabaseId(row.unavailability_id);

    if (
      id === null ||
      typeof row.start_at !== "string" ||
      typeof row.end_at !== "string"
    ) {
      return null;
    }

    const intervalStart = new Date(row.start_at);
    const intervalEnd = new Date(row.end_at);

    if (
      Number.isNaN(intervalStart.getTime()) ||
      Number.isNaN(intervalEnd.getTime()) ||
      intervalEnd <= intervalStart
    ) {
      return null;
    }

    for (let dayIndex = 0; dayIndex < WEEKDAY_NAMES.length; dayIndex += 1) {
      const calendarDate = addCalendarDays(weekStart, dayIndex);
      const dayStartValue = toBelgradeInstant(calendarDate, 0);
      const dayEndValue = toBelgradeInstant(
        addCalendarDays(calendarDate, 1),
        0,
      );

      if (!dayStartValue || !dayEndValue) {
        return null;
      }

      const dayStart = new Date(dayStartValue);
      const dayEnd = new Date(dayEndValue);
      const clippedStart = new Date(
        Math.max(intervalStart.getTime(), dayStart.getTime()),
      );
      const clippedEnd = new Date(
        Math.min(intervalEnd.getTime(), dayEnd.getTime()),
      );

      if (clippedEnd <= clippedStart) {
        continue;
      }

      const startParts = getZonedDateTimeParts(clippedStart);
      const endParts = getZonedDateTimeParts(clippedEnd);
      const startMinutes =
        clippedStart.getTime() === dayStart.getTime()
          ? 0
          : startParts.hour * 60 +
            startParts.minute +
            startParts.second / 60;
      const endMinutes =
        clippedEnd.getTime() === dayEnd.getTime()
          ? 24 * 60
          : endParts.hour * 60 + endParts.minute + endParts.second / 60;

      if (endMinutes <= startMinutes) {
        return null;
      }

      intervals.push({
        id,
        calendarDate,
        startMinutes,
        durationMinutes: endMinutes - startMinutes,
        reason: getNonEmptyString(row.reason),
      });
    }
  }

  return intervals;
}

function getVisibleTimeRange(workingHours: WorkingHour[]) {
  const weekdayHours = workingHours.filter(
    (workingHour) => workingHour.dayOfWeek <= 5,
  );

  if (weekdayHours.length === 0) {
    return { startMinutes: 8 * 60, endMinutes: 18 * 60 };
  }

  const earliestStart = Math.min(
    ...weekdayHours.map((workingHour) => workingHour.startMinutes),
  );
  const latestEnd = Math.max(
    ...weekdayHours.map((workingHour) => workingHour.endMinutes),
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

function getCalendarDateAsSafeInstant(value: string) {
  const parts = parseCalendarDate(value);

  return parts
    ? new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12))
    : null;
}

function formatWeekRange(weekStart: string) {
  const monday = getCalendarDateAsSafeInstant(weekStart);
  const friday = getCalendarDateAsSafeInstant(addCalendarDays(weekStart, 4));

  if (!monday || !friday) {
    return "Izabrana nedelja";
  }

  return `${weekRangeDateFormatter.format(monday)} – ${weekRangeDateFormatter.format(friday)}`;
}

function formatDayDate(value: string) {
  const parts = parseCalendarDate(value);

  return parts
    ? `${String(parts.day).padStart(2, "0")}.${String(parts.month).padStart(2, "0")}.`
    : "";
}

function formatDetailsDate(value: string) {
  return detailDateFormatter.format(new Date(value));
}

function formatDetailsTime(startAt: string, endAt: string) {
  return `${appointmentTimeFormatter.format(new Date(startAt))}–${appointmentTimeFormatter.format(new Date(endAt))}`;
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

function WeeklyCalendar({
  weekStart,
  workingHours,
  appointments,
  unavailability,
  onAppointmentClick,
}: {
  weekStart: string;
  workingHours: WorkingHour[];
  appointments: CalendarAppointment[];
  unavailability: CalendarUnavailability[];
  onAppointmentClick: (appointmentId: DatabaseId) => void;
}) {
  const weekDays = WEEKDAY_NAMES.map((name, index) => ({
    name,
    date: addCalendarDays(weekStart, index),
    dayOfWeek: index + 1,
  }));
  const visibleRange = getVisibleTimeRange(workingHours);
  const calendarHeight =
    (visibleRange.endMinutes - visibleRange.startMinutes) * PIXELS_PER_MINUTE;
  const timeLabels: number[] = [];

  for (
    let minute = visibleRange.startMinutes;
    minute <= visibleRange.endMinutes;
    minute += 60
  ) {
    timeLabels.push(minute);
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-[#397267]/12 bg-white/80 shadow-[0_14px_38px_rgba(36,60,56,0.07)]">
      <div className="min-w-[980px]">
        <div className="grid grid-cols-[76px_repeat(5,minmax(170px,1fr))] border-b border-[#397267]/12 bg-[#f8f5ef]">
          <div className="flex items-center justify-center border-r border-[#397267]/12 px-2 py-4 text-xs font-semibold tracking-[0.1em] text-[#6b807c] uppercase">
            Vreme
          </div>
          {weekDays.map((day) => (
            <div
              key={day.date}
              className="border-r border-[#397267]/12 px-3 py-3 text-center last:border-r-0"
            >
              <p className="text-sm font-semibold text-[#243c38]">
                {day.name}
              </p>
              <p className="mt-1 text-xs text-[#6b807c]">
                {formatDayDate(day.date)}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[76px_repeat(5,minmax(170px,1fr))]">
          <div
            className="relative border-r border-[#397267]/12 bg-[#f8f5ef]"
            style={{ height: calendarHeight }}
          >
            {timeLabels.map((minute) => (
              <span
                key={minute}
                className="absolute right-3 -translate-y-1/2 text-xs font-medium text-[#6b807c]"
                style={{
                  top:
                    (minute - visibleRange.startMinutes) *
                    PIXELS_PER_MINUTE,
                }}
              >
                {formatTime(minute)}
              </span>
            ))}
          </div>

          {weekDays.map((day) => {
            const dayWorkingHours = workingHours.filter(
              (workingHour) => workingHour.dayOfWeek === day.dayOfWeek,
            );
            const dayAppointments = appointments.filter(
              (appointment) => appointment.calendarDate === day.date,
            );
            const dayUnavailability = unavailability.filter(
              (interval) => interval.calendarDate === day.date,
            );

            return (
              <div
                key={day.date}
                className="relative border-r border-[#397267]/12 bg-[#eee9e1] last:border-r-0"
                style={{ height: calendarHeight }}
              >
                {dayWorkingHours.map((workingHour, index) => {
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
                        (minute - visibleRange.startMinutes) *
                        PIXELS_PER_MINUTE,
                    }}
                  />
                ))}

                {dayWorkingHours.length === 0 && (
                  <div className="absolute inset-x-3 top-5 z-20 rounded-2xl border border-[#8a7f70]/15 bg-white/55 px-3 py-2 text-center text-xs font-semibold text-[#7b746b]">
                    Neradni dan
                  </div>
                )}

                {dayUnavailability.map((interval) => {
                  const intervalStart = Math.max(
                    interval.startMinutes,
                    visibleRange.startMinutes,
                  );
                  const intervalEnd = Math.min(
                    interval.startMinutes + interval.durationMinutes,
                    visibleRange.endMinutes,
                  );

                  if (intervalEnd <= intervalStart) {
                    return null;
                  }

                  return (
                    <div
                      key={`${String(interval.id)}-${interval.calendarDate}`}
                      className="absolute inset-x-1.5 z-20 overflow-hidden rounded-xl border border-[#71807c]/30 bg-[#e2e6e3] px-2 py-1 text-[11px] leading-3 text-[#40534f] shadow-[0_4px_12px_rgba(64,83,79,0.08)]"
                      style={{
                        top:
                          (intervalStart - visibleRange.startMinutes) *
                          PIXELS_PER_MINUTE,
                        height:
                          (intervalEnd - intervalStart) * PIXELS_PER_MINUTE,
                        backgroundImage:
                          "repeating-linear-gradient(135deg, rgba(64, 83, 79, 0.06) 0, rgba(64, 83, 79, 0.06) 6px, transparent 6px, transparent 12px)",
                      }}
                      title={
                        interval.reason
                          ? `Nedostupan · ${interval.reason}`
                          : "Nedostupan"
                      }
                    >
                      <p className="font-bold">Nedostupan</p>
                      {interval.reason && (
                        <p className="mt-0.5 truncate text-[#5f706c]">
                          {interval.reason}
                        </p>
                      )}
                    </div>
                  );
                })}

                {dayAppointments.map((appointment) => {
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
                          (appointmentStart - visibleRange.startMinutes) *
                          PIXELS_PER_MINUTE,
                        height:
                          (appointmentEnd - appointmentStart) *
                          PIXELS_PER_MINUTE,
                      }}
                      title={`${appointment.formattedStartTime} · ${appointment.childName} · ${appointment.serviceName}`}
                    >
                      <p className="font-bold">{appointment.formattedStartTime}</p>
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

export default function TherapistPage() {
  const router = useRouter();
  const signOutInProgress = useRef(false);
  const detailsRequestId = useRef(0);
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart);
  const [therapist, setTherapist] = useState<TherapistContext>();
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [unavailability, setUnavailability] = useState<
    CalendarUnavailability[]
  >([]);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isScheduleLoading, setIsScheduleLoading] = useState(true);
  const [pageError, setPageError] = useState<string>();
  const [scheduleError, setScheduleError] = useState<string>();
  const [unavailabilityWarning, setUnavailabilityWarning] = useState<string>();
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

    async function verifyAccessAndLoadTherapist() {
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
        const therapistId = getTherapistId(profile);

        if (profileError || therapistId === null) {
          await signOutWithoutThrowing();

          if (isActive) {
            router.replace("/staff/login");
          }
          return;
        }

        const [therapistResult, workingHoursResult] = await Promise.all([
          supabase
            .from("therapists")
            .select("name")
            .eq("id", therapistId)
            .maybeSingle(),
          supabase
            .from("working_hours")
            .select("day_of_week, start_time, end_time")
            .eq("therapist_id", therapistId)
            .order("day_of_week", { ascending: true })
            .order("start_time", { ascending: true }),
        ]);
        const therapistName = getNonEmptyString(therapistResult.data?.name);
        const workingHours = getWorkingHours(workingHoursResult.data);

        if (
          therapistResult.error ||
          workingHoursResult.error ||
          !therapistName ||
          !workingHours
        ) {
          if (isActive) {
            setIsAuthorized(true);
            setPageError(
              "Raspored trenutno nije moguće učitati. Pokušajte ponovo kasnije.",
            );
          }
          return;
        }

        if (isActive) {
          setTherapist({
            id: therapistId,
            name: therapistName,
            workingHours,
          });
          setIsAuthorized(true);
        }
      } catch {
        await signOutWithoutThrowing();

        if (isActive) {
          router.replace("/staff/login");
        }
      }
    }

    void verifyAccessAndLoadTherapist();

    return () => {
      isActive = false;
    };
  }, [router]);

  useEffect(() => {
    if (!therapist) {
      return;
    }

    let isActive = true;

    async function loadAppointments() {
      const from = toBelgradeInstant(weekStart, 0);
      const to = toBelgradeInstant(addCalendarDays(weekStart, 5), 0);

      if (!from || !to) {
        if (isActive) {
          setScheduleError("Izabrana nedelja nije ispravna.");
          setIsScheduleLoading(false);
        }
        return;
      }

      try {
        const unavailabilityRequest = (async () => {
          try {
            return await supabase.rpc("get_my_unavailability", {
              p_from: from,
              p_to: to,
            });
          } catch {
            return null;
          }
        })();
        const [appointmentsResult, unavailabilityResult] = await Promise.all([
          supabase.rpc("get_my_appointments", {
            p_from: from,
            p_to: to,
          }),
          unavailabilityRequest,
        ]);
        const confirmedAppointments = getConfirmedAppointments(
          appointmentsResult.data,
        );

        if (appointmentsResult.error || !confirmedAppointments) {
          if (isActive) {
            setAppointments([]);
            setUnavailability([]);
            setUnavailabilityWarning(undefined);
            setScheduleError(
              "Termine trenutno nije moguće učitati. Pokušajte ponovo.",
            );
          }
          return;
        }

        if (isActive) {
          setAppointments(confirmedAppointments);
          const loadedUnavailability = unavailabilityResult
            ? getMyUnavailability(unavailabilityResult.data, weekStart)
            : null;

          if (unavailabilityResult?.error || !loadedUnavailability) {
            setUnavailability([]);
            setUnavailabilityWarning(
              "Nedostupnost trenutno nije moguće učitati.",
            );
          } else {
            setUnavailability(loadedUnavailability);
            setUnavailabilityWarning(undefined);
          }

          setScheduleError(undefined);
        }
      } catch {
        if (isActive) {
          setAppointments([]);
          setUnavailability([]);
          setUnavailabilityWarning(undefined);
          setScheduleError(
            "Došlo je do neočekivane greške pri učitavanju termina.",
          );
        }
      } finally {
        if (isActive) {
          setIsScheduleLoading(false);
        }
      }
    }

    void loadAppointments();

    return () => {
      isActive = false;
    };
  }, [reloadKey, therapist, weekStart]);

  async function openAppointmentDetails(appointmentId: DatabaseId) {
    const requestId = detailsRequestId.current + 1;
    detailsRequestId.current = requestId;
    setSelectedAppointmentId(appointmentId);
    setAppointmentDetails(undefined);
    setDetailsError(undefined);
    setIsDetailsLoading(true);

    try {
      const { data, error } = await supabase.rpc(
        "get_my_appointment_details",
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

  function showWeek(nextWeekStart: string) {
    setScheduleError(undefined);
    setUnavailabilityWarning(undefined);
    setIsScheduleLoading(true);

    if (nextWeekStart === weekStart) {
      setReloadKey((currentKey) => currentKey + 1);
    } else {
      setWeekStart(nextWeekStart);
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
          ) : therapist ? (
            <>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-sm font-semibold tracking-[0.12em] text-[#397267] uppercase">
                    Terapeut panel
                  </p>
                  <h1 className="mt-3 text-4xl leading-tight font-semibold tracking-[-0.035em] text-[#243c38] sm:text-5xl">
                    Moj raspored
                  </h1>
                  <p className="mt-3 text-base text-[#526b66]">
                    {therapist.name}
                  </p>
                </div>

                <div className="flex flex-col gap-3 lg:items-end">
                  <p className="text-sm font-semibold text-[#526b66]">
                    {formatWeekRange(weekStart)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        showWeek(addCalendarDays(weekStart, -7))
                      }
                      disabled={isScheduleLoading}
                      className="min-h-11 rounded-full border border-[#397267]/20 bg-white/80 px-4 py-2 text-sm font-semibold text-[#397267] transition hover:border-[#397267]/35 hover:bg-white disabled:cursor-wait disabled:opacity-55"
                    >
                      Prethodna nedelja
                    </button>
                    <button
                      type="button"
                      onClick={() => showWeek(getCurrentWeekStart())}
                      disabled={isScheduleLoading}
                      className="min-h-11 rounded-full bg-[#397267] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2f6158] disabled:cursor-wait disabled:opacity-55"
                    >
                      Danas
                    </button>
                    <button
                      type="button"
                      onClick={() => showWeek(addCalendarDays(weekStart, 7))}
                      disabled={isScheduleLoading}
                      className="min-h-11 rounded-full border border-[#397267]/20 bg-white/80 px-4 py-2 text-sm font-semibold text-[#397267] transition hover:border-[#397267]/35 hover:bg-white disabled:cursor-wait disabled:opacity-55"
                    >
                      Sledeća nedelja
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
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-sm border border-[#71807c]/30 bg-[#e2e6e3]"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(135deg, rgba(64, 83, 79, 0.08) 0, rgba(64, 83, 79, 0.08) 2px, transparent 2px, transparent 4px)",
                    }}
                  />
                  Nedostupnost
                </span>
              </div>

              {unavailabilityWarning && (
                <div
                  role="status"
                  className="mt-5 rounded-2xl border border-[#d89a58]/20 bg-[#fff8ec] px-5 py-3 text-sm font-medium text-[#815a2d]"
                >
                  {unavailabilityWarning}
                </div>
              )}

              {isScheduleLoading ? (
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
                    onClick={() => showWeek(weekStart)}
                    className="mt-5 min-h-11 rounded-full bg-[#397267] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#2f6158]"
                  >
                    Pokušaj ponovo
                  </button>
                </div>
              ) : (
                <>
                  {appointments.length === 0 && (
                    <p className="mt-6 rounded-2xl border border-[#397267]/12 bg-white/70 px-5 py-4 text-sm font-medium text-[#526b66]">
                      Nema zakazanih termina ove nedelje.
                    </p>
                  )}
                  <div className="mt-6">
                    <WeeklyCalendar
                      weekStart={weekStart}
                      workingHours={therapist.workingHours}
                      appointments={appointments}
                      unavailability={unavailability}
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
            aria-labelledby="therapist-appointment-details-title"
            className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/80 bg-[#fffaf3] p-6 shadow-[0_28px_90px_rgba(23,43,39,0.28)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold tracking-[0.12em] text-[#397267] uppercase">
                  Terapeut panel
                </p>
                <h2
                  id="therapist-appointment-details-title"
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
                  className="mt-5 min-h-11 rounded-full bg-[#397267] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#2f6158] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#397267]"
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
                  <div className="border-b border-[#397267]/10 pb-4 sm:col-span-2">
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
