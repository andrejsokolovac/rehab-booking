import type { Metadata } from "next";
import Link from "next/link";
import {
  isTimeAvailableForSchedule,
  parseTime,
  type BookedSlot,
  type TherapistSchedule,
  type UnavailabilityBlock,
  type WaitlistHold,
  type WorkingHour,
} from "@/lib/booking-availability";
import { supabase } from "@/lib/supabase";
import DetailsForm from "./details-form";

const BELGRADE_TIME_ZONE = "Europe/Belgrade";

type Service = {
  id: number;
  name: string;
  slug: string;
  duration_minutes: number;
};

type Therapist = {
  id: number;
  name: string;
  slug: string;
};

type TherapistWorkingHour = WorkingHour & {
  therapist_id: number;
};

type SelectedDate = {
  formatted: string;
  dayOfWeek: number;
};

type BookingSelection = {
  selectedService: Service | null;
  selectedTherapist: Omit<Therapist, "id"> | Therapist | null;
  therapistCandidates: Therapist[];
  formattedDate: string | null;
  startAt: string | null;
  hasError: boolean;
};

const dateFormatter = new Intl.DateTimeFormat("sr-Latn-RS", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: BELGRADE_TIME_ZONE,
});

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
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

const databaseDayByWeekday: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function getSelectedDate(value?: string): SelectedDate | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const date = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), 12),
  );

  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  const formatted = dateFormatter.format(date);

  return {
    formatted:
      formatted.charAt(0).toLocaleUpperCase("sr-Latn-RS") + formatted.slice(1),
    dayOfWeek: databaseDayByWeekday[weekdayFormatter.format(date)],
  };
}

function getZonedParts(date: Date) {
  const parts = Object.fromEntries(
    zonedDateTimeFormatter
      .formatToParts(date)
      .map((part) => [part.type, Number(part.value)]),
  );

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
  const parts = getZonedParts(instant);

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

function toBelgradeInstant(dateValue?: string, timeValue?: string) {
  const dateMatch = dateValue?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const totalMinutes = parseTime(timeValue);

  if (!dateMatch || totalMinutes === null) {
    return null;
  }

  const [, year, month, day] = dateMatch;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const localTimestamp = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
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
  const zonedParts = getZonedParts(instant);

  if (
    zonedParts.year !== Number(year) ||
    zonedParts.month !== Number(month) ||
    zonedParts.day !== Number(day) ||
    zonedParts.hour !== hour ||
    zonedParts.minute !== minute
  ) {
    return null;
  }

  return instant.toISOString();
}

async function loadBookingSelection(
  serviceSlug?: string,
  therapistSlug?: string,
  dateValue?: string,
  timeValue?: string,
): Promise<BookingSelection> {
  const selectedDate = getSelectedDate(dateValue);
  const startAt = toBelgradeInstant(dateValue, timeValue);
  const startMinutes = parseTime(timeValue);
  const emptyResult: BookingSelection = {
    selectedService: null,
    selectedTherapist: null,
    therapistCandidates: [],
    formattedDate: selectedDate?.formatted ?? null,
    startAt,
    hasError: false,
  };

  if (
    !serviceSlug ||
    !therapistSlug ||
    !dateValue ||
    !selectedDate ||
    !startAt ||
    startMinutes === null
  ) {
    return emptyResult;
  }

  const { data: selectedService, error: serviceError } = await supabase
    .from("services")
    .select("id, name, slug, duration_minutes")
    .eq("slug", serviceSlug)
    .maybeSingle();

  if (serviceError) {
    return { ...emptyResult, hasError: true };
  }

  if (!selectedService) {
    return emptyResult;
  }

  if (therapistSlug !== "any") {
    const { data: selectedTherapist, error: therapistError } = await supabase
      .from("therapists")
      .select("id, name, slug")
      .eq("slug", therapistSlug)
      .maybeSingle();

    if (therapistError) {
      return {
        ...emptyResult,
        selectedService,
        hasError: true,
      };
    }

    if (!selectedTherapist) {
      return {
        ...emptyResult,
        selectedService,
      };
    }

    const [
      workingHoursResult,
      bookedSlotsResult,
      unavailabilityResult,
      waitlistHoldsResult,
    ] = await Promise.all([
        supabase
          .from("working_hours")
          .select("start_time, end_time")
          .eq("therapist_id", selectedTherapist.id)
          .eq("day_of_week", selectedDate.dayOfWeek),
        supabase.rpc("get_booked_slots", {
          p_therapist_id: selectedTherapist.id,
          p_date: dateValue,
        }),
        supabase.rpc("get_therapist_unavailability", {
          p_therapist_id: selectedTherapist.id,
          p_date: dateValue,
        }),
        supabase.rpc("get_active_waitlist_holds", {
          p_therapist_id: selectedTherapist.id,
          p_date: dateValue,
        }),
      ]);
    const schedule: TherapistSchedule = {
      therapistId: selectedTherapist.id,
      workingHours: workingHoursResult.data ?? [],
      bookedSlots: (bookedSlotsResult.data ?? []) as BookedSlot[],
      unavailabilityBlocks: (unavailabilityResult.data ??
        []) as UnavailabilityBlock[],
      waitlistHolds: (waitlistHoldsResult.data ?? []) as WaitlistHold[],
    };
    const hasAvailabilityError = Boolean(
      workingHoursResult.error ||
        bookedSlotsResult.error ||
        unavailabilityResult.error ||
        waitlistHoldsResult.error,
    );
    const isAvailable =
      !hasAvailabilityError &&
      isTimeAvailableForSchedule(
        schedule,
        selectedService.duration_minutes,
        dateValue,
        startMinutes,
      );

    return {
      selectedService,
      selectedTherapist,
      therapistCandidates: isAvailable ? [selectedTherapist] : [],
      formattedDate: selectedDate.formatted,
      startAt,
      hasError: hasAvailabilityError,
    };
  }

  const selectedTherapist = {
    name: "Prvi slobodan terapeut",
    slug: "any",
  };
  const { data: serviceLinks, error: linksError } = await supabase
    .from("therapist_services")
    .select("therapist_id")
    .eq("service_id", selectedService.id);

  if (linksError) {
    return {
      ...emptyResult,
      selectedService,
      selectedTherapist,
      hasError: true,
    };
  }

  const therapistIds = [
    ...new Set((serviceLinks ?? []).map((link) => link.therapist_id)),
  ];

  if (therapistIds.length === 0) {
    return {
      ...emptyResult,
      selectedService,
      selectedTherapist,
    };
  }

  const [
    workingHoursResult,
    bookedSlotsResults,
    unavailabilityResults,
    waitlistHoldsResults,
  ] = await Promise.all([
      supabase
        .from("working_hours")
        .select("therapist_id, start_time, end_time")
        .in("therapist_id", therapistIds)
        .eq("day_of_week", selectedDate.dayOfWeek),
      Promise.all(
        therapistIds.map((therapistId) =>
          supabase.rpc("get_booked_slots", {
            p_therapist_id: therapistId,
            p_date: dateValue,
          }),
        ),
      ),
      Promise.all(
        therapistIds.map((therapistId) =>
          supabase.rpc("get_therapist_unavailability", {
            p_therapist_id: therapistId,
            p_date: dateValue,
          }),
        ),
      ),
      Promise.all(
        therapistIds.map((therapistId) =>
          supabase.rpc("get_active_waitlist_holds", {
            p_therapist_id: therapistId,
            p_date: dateValue,
          }),
        ),
      ),
    ]);
  const hasAvailabilityError = Boolean(
    workingHoursResult.error ||
      bookedSlotsResults.some((result) => result.error) ||
      unavailabilityResults.some((result) => result.error) ||
      waitlistHoldsResults.some((result) => result.error),
  );

  if (hasAvailabilityError) {
    return {
      ...emptyResult,
      selectedService,
      selectedTherapist,
      hasError: true,
    };
  }

  const workingHours =
    (workingHoursResult.data as TherapistWorkingHour[] | null) ?? [];
  const therapistSchedules = therapistIds.map((therapistId, index) => ({
    therapistId,
    workingHours: workingHours.filter(
      (workingHour) => workingHour.therapist_id === therapistId,
    ),
    bookedSlots: (bookedSlotsResults[index].data ?? []) as BookedSlot[],
    unavailabilityBlocks: (unavailabilityResults[index].data ??
      []) as UnavailabilityBlock[],
    waitlistHolds: (waitlistHoldsResults[index].data ?? []) as WaitlistHold[],
  }));
  const eligibleTherapistIds = therapistSchedules
    .filter((schedule) =>
      isTimeAvailableForSchedule(
        schedule,
        selectedService.duration_minutes,
        dateValue,
        startMinutes,
      ),
    )
    .map((schedule) => schedule.therapistId);

  if (eligibleTherapistIds.length === 0) {
    return {
      ...emptyResult,
      selectedService,
      selectedTherapist,
    };
  }

  const { data: therapists, error: therapistsError } = await supabase
    .from("therapists")
    .select("id, name, slug")
    .in("id", eligibleTherapistIds);
  const therapistCandidates = eligibleTherapistIds.flatMap((therapistId) => {
    const therapist = (therapists ?? []).find(
      (candidate) => candidate.id === therapistId,
    );

    return therapist ? [therapist] : [];
  });

  return {
    selectedService,
    selectedTherapist,
    therapistCandidates,
    formattedDate: selectedDate.formatted,
    startAt,
    hasError: Boolean(therapistsError),
  };
}

export const metadata: Metadata = {
  title: "Podaci za zakazivanje | Centar za razvoj i rehabilitaciju",
  description: "Unesite osnovne podatke i potvrdite izabrani termin.",
};

type DetailsPageProps = {
  searchParams: Promise<{
    service?: string | string[];
    therapist?: string | string[];
    date?: string | string[];
    time?: string | string[];
  }>;
};

export default async function DetailsPage({ searchParams }: DetailsPageProps) {
  const params = await searchParams;
  const serviceSlug = Array.isArray(params.service)
    ? params.service[0]
    : params.service;
  const therapistSlug = Array.isArray(params.therapist)
    ? params.therapist[0]
    : params.therapist;
  const dateValue = Array.isArray(params.date) ? params.date[0] : params.date;
  const timeValue = Array.isArray(params.time) ? params.time[0] : params.time;
  const {
    selectedService,
    selectedTherapist,
    therapistCandidates,
    formattedDate,
    startAt,
    hasError,
  } = await loadBookingSelection(
    serviceSlug,
    therapistSlug,
    dateValue,
    timeValue,
  );
  const hasEligibleTherapist = therapistCandidates.length > 0;
  const selectionIsValid = Boolean(
    selectedService &&
      selectedTherapist &&
      dateValue &&
      formattedDate &&
      timeValue &&
      startAt &&
      hasEligibleTherapist,
  );
  const backHref =
    selectedService && selectedTherapist && dateValue
      ? {
          pathname: "/booking/time",
          query: {
            service: selectedService.slug,
            therapist: selectedTherapist.slug,
            date: dateValue,
            time: timeValue,
          },
        }
      : "/booking";

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
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-5 sm:px-8 lg:px-10">
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

          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-[#397267] transition hover:bg-white/70 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#397267] sm:px-4"
          >
            <span aria-hidden="true">←</span>
            Nazad na izbor termina
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex flex-1">
        <section className="mx-auto w-full max-w-5xl px-6 py-16 sm:px-8 sm:py-24 lg:px-10">
          <div className="text-center sm:text-left">
            <p className="mb-4 text-sm font-semibold tracking-[0.12em] text-[#397267] uppercase">
              Peti korak
            </p>
            <h1 className="text-4xl leading-tight font-semibold tracking-[-0.035em] text-[#243c38] sm:text-5xl">
              Podaci za zakazivanje
            </h1>
          </div>

          {selectionIsValid ? (
            <>
              <div className="mt-8 grid gap-3 rounded-3xl border border-[#397267]/12 bg-white/70 p-5 shadow-[0_12px_35px_rgba(36,60,56,0.05)] sm:grid-cols-2 lg:grid-cols-4 sm:p-6">
                <div>
                  <p className="text-xs font-semibold tracking-[0.12em] text-[#6b807c] uppercase">
                    Usluga
                  </p>
                  <p className="mt-2 font-semibold text-[#243c38]">
                    {selectedService?.name}
                  </p>
                </div>
                <div className="border-t border-[#397267]/10 pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
                  <p className="text-xs font-semibold tracking-[0.12em] text-[#6b807c] uppercase">
                    Terapeut
                  </p>
                  <p className="mt-2 font-semibold text-[#243c38]">
                    {selectedTherapist?.name}
                  </p>
                </div>
                <div className="border-t border-[#397267]/10 pt-3 sm:border-l sm:pt-3 sm:pl-5 lg:border-t-0 lg:pt-0">
                  <p className="text-xs font-semibold tracking-[0.12em] text-[#6b807c] uppercase">
                    Datum
                  </p>
                  <p className="mt-2 font-semibold text-[#243c38]">
                    {formattedDate}
                  </p>
                </div>
                <div className="border-t border-[#397267]/10 pt-3 sm:border-l sm:pt-3 sm:pl-5 lg:border-t-0 lg:pt-0">
                  <p className="text-xs font-semibold tracking-[0.12em] text-[#6b807c] uppercase">
                    Vreme
                  </p>
                  <p className="mt-2 font-semibold text-[#243c38]">
                    {timeValue}
                  </p>
                </div>
              </div>

              <DetailsForm
                booking={{
                  serviceId: selectedService?.id ?? 0,
                  serviceName: selectedService?.name ?? "",
                  serviceSlug: selectedService?.slug ?? "",
                  serviceDurationMinutes:
                    selectedService?.duration_minutes ?? 0,
                  therapistCandidates,
                  date: dateValue ?? "",
                  formattedDate: formattedDate ?? "",
                  time: timeValue ?? "",
                  startAt: startAt ?? "",
                }}
              />
            </>
          ) : (
            <div
              role={hasError ? "alert" : undefined}
              className={`mt-8 rounded-3xl border bg-white/70 p-6 shadow-[0_12px_35px_rgba(36,60,56,0.05)] ${
                hasError
                  ? "border-[#b45745]/20 text-[#8f4033]"
                  : "border-[#397267]/12 text-[#526b66]"
              }`}
            >
              {hasError
                ? "Podatke o terminu trenutno nije moguće učitati. Pokušajte ponovo kasnije."
                : selectedService &&
                    selectedTherapist &&
                    formattedDate &&
                    startAt &&
                    !hasEligibleTherapist
                  ? "Izabrani termin više nije dostupan. Vratite se i izaberite drugi termin."
                  : "Nedostaju podaci o izabranom terminu. Vratite se na prethodni korak i ponovite izbor."}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
