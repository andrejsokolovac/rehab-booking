const BELGRADE_TIME_ZONE = "Europe/Belgrade";

export const APPOINTMENT_BUFFER_MINUTES = 15;

export type WorkingHour = {
  start_time: string;
  end_time: string;
};

export type BookedSlot = {
  start_at: string;
  end_at: string;
  blocked_until: string;
};

export type UnavailabilityBlock = {
  start_at: string;
  end_at: string;
};

export type WaitlistHold = {
  start_at: string;
  blocked_until: string;
};

export type TherapistSchedule = {
  therapistId: number;
  workingHours: WorkingHour[];
  bookedSlots: BookedSlot[];
  unavailabilityBlocks: UnavailabilityBlock[];
  waitlistHolds: WaitlistHold[];
};

const blockedDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: BELGRADE_TIME_ZONE,
});

export function parseTime(value?: string) {
  const match = value?.match(/^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);

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

function formatTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");

  return `${hours}:${minutes}`;
}

function getLocalCalendarTimestamp(dateValue: string, totalMinutes: number) {
  const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;

  return (
    Date.UTC(Number(year), Number(month) - 1, Number(day)) +
    totalMinutes * 60_000
  );
}

function getBlockedCalendarTimestamp(value: string) {
  const localTimestampMatch = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/,
  );

  if (localTimestampMatch) {
    const [, year, month, day, hour, minute, second = "0"] =
      localTimestampMatch;

    return Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
  }

  const instant = new Date(value);

  if (Number.isNaN(instant.getTime())) {
    return null;
  }

  const parts = Object.fromEntries(
    blockedDateTimeFormatter
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );

  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
}

function candidateBlockedInterval(
  dateValue: string,
  startMinutes: number,
  durationMinutes: number,
) {
  const start = getLocalCalendarTimestamp(dateValue, startMinutes);

  if (start === null) {
    return null;
  }

  return {
    start,
    blockedUntil:
      start +
      (durationMinutes + APPOINTMENT_BUFFER_MINUTES) * 60_000,
  };
}

function intervalOverlaps(
  candidateStart: number,
  candidateBlockedUntil: number,
  blockedStartValue: string,
  blockedEndValue: string,
) {
  const blockedStart = getBlockedCalendarTimestamp(blockedStartValue);
  const blockedEnd = getBlockedCalendarTimestamp(blockedEndValue);

  if (blockedStart === null || blockedEnd === null || blockedEnd <= blockedStart) {
    return true;
  }

  return (
    candidateStart < blockedEnd && candidateBlockedUntil > blockedStart
  );
}

function conflictsWithBookedSlot(
  dateValue: string,
  startMinutes: number,
  durationMinutes: number,
  bookedSlots: BookedSlot[],
) {
  const candidate = candidateBlockedInterval(
    dateValue,
    startMinutes,
    durationMinutes,
  );

  if (!candidate) {
    return true;
  }

  return bookedSlots.some((bookedSlot) =>
    intervalOverlaps(
      candidate.start,
      candidate.blockedUntil,
      bookedSlot.start_at,
      bookedSlot.blocked_until,
    ),
  );
}

export function conflictsWithUnavailability(
  dateValue: string,
  startMinutes: number,
  durationMinutes: number,
  unavailabilityBlocks: UnavailabilityBlock[],
) {
  const candidate = candidateBlockedInterval(
    dateValue,
    startMinutes,
    durationMinutes,
  );

  if (!candidate) {
    return true;
  }

  return unavailabilityBlocks.some((unavailability) =>
    intervalOverlaps(
      candidate.start,
      candidate.blockedUntil,
      unavailability.start_at,
      unavailability.end_at,
    ),
  );
}

export function conflictsWithWaitlistHolds(
  dateValue: string,
  startMinutes: number,
  durationMinutes: number,
  waitlistHolds: WaitlistHold[],
) {
  const candidate = candidateBlockedInterval(
    dateValue,
    startMinutes,
    durationMinutes,
  );

  if (!candidate) {
    return true;
  }

  return waitlistHolds.some((hold) =>
    intervalOverlaps(
      candidate.start,
      candidate.blockedUntil,
      hold.start_at,
      hold.blocked_until,
    ),
  );
}

export function isTimeAvailableForSchedule(
  schedule: TherapistSchedule,
  durationMinutes: number,
  dateValue: string,
  startMinutes: number,
) {
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    return false;
  }

  const fitsWorkingHours = schedule.workingHours.some((workingHour) => {
    const intervalStart = parseTime(workingHour.start_time);
    const intervalEnd = parseTime(workingHour.end_time);

    if (
      intervalStart === null ||
      intervalEnd === null ||
      intervalEnd <= intervalStart
    ) {
      return false;
    }

    return (
      startMinutes >= intervalStart &&
      startMinutes + durationMinutes <= intervalEnd &&
      (startMinutes - intervalStart) %
        (durationMinutes + APPOINTMENT_BUFFER_MINUTES) ===
        0
    );
  });

  return (
    fitsWorkingHours &&
    !conflictsWithBookedSlot(
      dateValue,
      startMinutes,
      durationMinutes,
      schedule.bookedSlots,
    ) &&
    !conflictsWithUnavailability(
      dateValue,
      startMinutes,
      durationMinutes,
      schedule.unavailabilityBlocks,
    ) &&
    !conflictsWithWaitlistHolds(
      dateValue,
      startMinutes,
      durationMinutes,
      schedule.waitlistHolds,
    )
  );
}

export function generateTimeSlots(
  therapistSchedules: TherapistSchedule[],
  durationMinutes: number,
  dateValue?: string,
) {
  if (
    !dateValue ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes <= 0
  ) {
    return [];
  }

  const starts = new Set<number>();
  const startIntervalMinutes =
    durationMinutes + APPOINTMENT_BUFFER_MINUTES;

  therapistSchedules.forEach((schedule) => {
    schedule.workingHours.forEach((workingHour) => {
      const intervalStart = parseTime(workingHour.start_time);
      const intervalEnd = parseTime(workingHour.end_time);

      if (
        intervalStart === null ||
        intervalEnd === null ||
        intervalEnd <= intervalStart
      ) {
        return;
      }

      for (
        let start = intervalStart;
        start + durationMinutes <= intervalEnd;
        start += startIntervalMinutes
      ) {
        if (
          !conflictsWithBookedSlot(
            dateValue,
            start,
            durationMinutes,
            schedule.bookedSlots,
          ) &&
          !conflictsWithUnavailability(
            dateValue,
            start,
            durationMinutes,
            schedule.unavailabilityBlocks,
          ) &&
          !conflictsWithWaitlistHolds(
            dateValue,
            start,
            durationMinutes,
            schedule.waitlistHolds,
          )
        ) {
          starts.add(start);
        }
      }
    });
  });

  return [...starts].sort((first, second) => first - second).map(formatTime);
}
