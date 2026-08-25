import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  generateTimeSlots,
  type BookedSlot,
  type TherapistSchedule,
  type UnavailabilityBlock,
  type WaitlistHold,
  type WorkingHour,
} from "@/lib/booking-availability";

const BELGRADE_TIME_ZONE = "Europe/Belgrade";

type Service = {
  id: number;
  name: string;
  slug: string;
  duration_minutes: number;
};

type TherapistChoice = {
  id?: number;
  name: string;
  slug: string;
};

type TherapistWorkingHour = WorkingHour & {
  therapist_id: number;
};

type TimeAvailabilityData = {
  selectedService: Service | null;
  selectedTherapist: TherapistChoice | null;
  therapistSchedules: TherapistSchedule[];
  hasError: boolean;
};

type SelectedDate = {
  value: string;
  formatted: string;
  dayOfWeek: number;
};

const calendarDateFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: BELGRADE_TIME_ZONE,
});

const dateFormatter = new Intl.DateTimeFormat("sr-Latn-RS", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: BELGRADE_TIME_ZONE,
});

const weekdayKeyFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
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

function getCalendarParts(date: Date) {
  const parts = calendarDateFormatter.formatToParts(date);

  return {
    year: parts.find((part) => part.type === "year")?.value ?? "",
    month: parts.find((part) => part.type === "month")?.value ?? "",
    day: parts.find((part) => part.type === "day")?.value ?? "",
  };
}

function getSelectedDate(value?: string): SelectedDate | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const date = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), 12),
  );
  const calendarParts = getCalendarParts(date);
  const normalizedValue = `${calendarParts.year}-${calendarParts.month}-${calendarParts.day}`;

  if (normalizedValue !== value) {
    return null;
  }

  const formatted = dateFormatter.format(date);

  return {
    value,
    formatted:
      formatted.charAt(0).toLocaleUpperCase("sr-Latn-RS") + formatted.slice(1),
    dayOfWeek: databaseDayByWeekday[weekdayKeyFormatter.format(date)],
  };
}

async function loadTimeAvailability(
  serviceSlug?: string,
  therapistSlug?: string,
  selectedDate?: SelectedDate | null,
): Promise<TimeAvailabilityData> {
  const emptyResult = {
    selectedService: null,
    selectedTherapist: null,
    therapistSchedules: [],
    hasError: false,
  };

  if (!serviceSlug || !therapistSlug || !selectedDate) {
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

  if (therapistSlug === "any") {
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
        selectedService,
        selectedTherapist,
        therapistSchedules: [],
        hasError: true,
      };
    }

    const therapistIds = [
      ...new Set((serviceLinks ?? []).map((link) => link.therapist_id)),
    ];

    if (therapistIds.length === 0) {
      return {
        selectedService,
        selectedTherapist,
        therapistSchedules: [],
        hasError: false,
      };
    }

    const workingHoursRequest = supabase
      .from("working_hours")
      .select("therapist_id, start_time, end_time")
      .in("therapist_id", therapistIds)
      .eq("day_of_week", selectedDate.dayOfWeek)
      .order("start_time", { ascending: true });

    const bookedSlotsRequest = Promise.all(
      therapistIds.map((therapistId) =>
        supabase.rpc("get_booked_slots", {
          p_therapist_id: therapistId,
          p_date: selectedDate.value,
        }),
      ),
    );
    const unavailabilityRequest = Promise.all(
      therapistIds.map((therapistId) =>
        supabase.rpc("get_therapist_unavailability", {
          p_therapist_id: therapistId,
          p_date: selectedDate.value,
        }),
      ),
    );
    const waitlistHoldsRequest = Promise.all(
      therapistIds.map((therapistId) =>
        supabase.rpc("get_active_waitlist_holds", {
          p_therapist_id: therapistId,
          p_date: selectedDate.value,
        }),
      ),
    );

    const [
      workingHoursResult,
      bookedSlotsResults,
      unavailabilityResults,
      waitlistHoldsResults,
    ] = await Promise.all([
      workingHoursRequest,
      bookedSlotsRequest,
      unavailabilityRequest,
      waitlistHoldsRequest,
    ]);

    const workingHours =
      (workingHoursResult.data as TherapistWorkingHour[] | null) ?? [];
    const hasBookedSlotsError = bookedSlotsResults.some(
      (result) => result.error,
    );
    const hasUnavailabilityError = unavailabilityResults.some(
      (result) => result.error,
    );
    const hasWaitlistHoldsError = waitlistHoldsResults.some(
      (result) => result.error,
    );
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

    return {
      selectedService,
      selectedTherapist,
      therapistSchedules,
      hasError: Boolean(
        workingHoursResult.error ||
          hasBookedSlotsError ||
          hasUnavailabilityError ||
          hasWaitlistHoldsError,
      ),
    };
  }

  const { data: selectedTherapist, error: therapistError } = await supabase
    .from("therapists")
    .select("id, name, slug")
    .eq("slug", therapistSlug)
    .maybeSingle();

  if (therapistError) {
    return {
      selectedService,
      selectedTherapist: null,
      therapistSchedules: [],
      hasError: true,
    };
  }

  if (!selectedTherapist) {
    return {
      selectedService,
      selectedTherapist: null,
      therapistSchedules: [],
      hasError: false,
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
        .eq("day_of_week", selectedDate.dayOfWeek)
        .order("start_time", { ascending: true }),
      supabase.rpc("get_booked_slots", {
        p_therapist_id: selectedTherapist.id,
        p_date: selectedDate.value,
      }),
      supabase.rpc("get_therapist_unavailability", {
        p_therapist_id: selectedTherapist.id,
        p_date: selectedDate.value,
      }),
      supabase.rpc("get_active_waitlist_holds", {
        p_therapist_id: selectedTherapist.id,
        p_date: selectedDate.value,
      }),
    ]);

  return {
    selectedService,
    selectedTherapist,
    therapistSchedules: [
      {
        therapistId: selectedTherapist.id,
        workingHours: workingHoursResult.data ?? [],
        bookedSlots: (bookedSlotsResult.data ?? []) as BookedSlot[],
        unavailabilityBlocks: (unavailabilityResult.data ??
          []) as UnavailabilityBlock[],
        waitlistHolds: (waitlistHoldsResult.data ?? []) as WaitlistHold[],
      },
    ],
    hasError: Boolean(
      workingHoursResult.error ||
      bookedSlotsResult.error ||
        unavailabilityResult.error ||
        waitlistHoldsResult.error,
    ),
  };
}

export const metadata: Metadata = {
  title: "Izaberite termin | Centar za razvoj i rehabilitaciju",
  description: "Izaberite raspoloživo vreme za željeni termin.",
};

type TimePageProps = {
  searchParams: Promise<{
    service?: string | string[];
    therapist?: string | string[];
    date?: string | string[];
    time?: string | string[];
  }>;
};

export default async function TimePage({ searchParams }: TimePageProps) {
  const params = await searchParams;
  const serviceSlug = Array.isArray(params.service)
    ? params.service[0]
    : params.service;
  const therapistSlug = Array.isArray(params.therapist)
    ? params.therapist[0]
    : params.therapist;
  const dateValue = Array.isArray(params.date) ? params.date[0] : params.date;
  const timeValue = Array.isArray(params.time) ? params.time[0] : params.time;
  const selectedDate = getSelectedDate(dateValue);
  const {
    selectedService,
    selectedTherapist,
    therapistSchedules,
    hasError,
  } =
    await loadTimeAvailability(
      serviceSlug,
      therapistSlug,
      selectedDate,
    );
  const timeSlots = generateTimeSlots(
    therapistSchedules,
    selectedService?.duration_minutes ?? 0,
    selectedDate?.value,
  );
  const selectedTime = timeSlots.find((time) => time === timeValue);
  const selectionIsValid = Boolean(
    selectedService && selectedTherapist && selectedDate,
  );
  const backHref =
    selectedService && selectedTherapist && selectedDate
      ? {
          pathname: "/booking/date",
          query: {
            service: selectedService.slug,
            therapist: selectedTherapist.slug,
            date: selectedDate.value,
          },
        }
      : "/booking";
  const waitlistHref =
    selectedService && selectedTherapist
      ? {
          pathname: "/booking/waitlist",
          query: {
            service: selectedService.slug,
            therapist: selectedTherapist.slug,
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
            Nazad na izbor datuma
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex flex-1">
        <section className="mx-auto w-full max-w-5xl px-6 py-16 sm:px-8 sm:py-24 lg:px-10">
          <div className="text-center sm:text-left">
            <p className="mb-4 text-sm font-semibold tracking-[0.12em] text-[#397267] uppercase">
              Četvrti korak
            </p>
            <h1 className="text-4xl leading-tight font-semibold tracking-[-0.035em] text-[#243c38] sm:text-5xl">
              Izaberite termin
            </h1>
          </div>

          {selectionIsValid ? (
            <>
              <div className="mt-8 grid gap-3 rounded-3xl border border-[#397267]/12 bg-white/70 p-5 shadow-[0_12px_35px_rgba(36,60,56,0.05)] sm:grid-cols-3 sm:p-6">
                <div>
                  <p className="text-xs font-semibold tracking-[0.12em] text-[#6b807c] uppercase">
                    Usluga
                  </p>
                  <p className="mt-2 font-semibold text-[#243c38]">
                    {selectedService?.name}
                  </p>
                </div>
                <div className="border-t border-[#397267]/10 pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
                  <p className="text-xs font-semibold tracking-[0.12em] text-[#6b807c] uppercase">
                    Terapeut
                  </p>
                  <p className="mt-2 font-semibold text-[#243c38]">
                    {selectedTherapist?.name}
                  </p>
                </div>
                <div className="border-t border-[#397267]/10 pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
                  <p className="text-xs font-semibold tracking-[0.12em] text-[#6b807c] uppercase">
                    Datum
                  </p>
                  <p className="mt-2 font-semibold text-[#243c38]">
                    {selectedDate?.formatted}
                  </p>
                </div>
              </div>

              {hasError ? (
                <div
                  role="alert"
                  className="mt-10 rounded-3xl border border-[#b45745]/20 bg-white/75 p-6 text-[#8f4033] shadow-[0_12px_35px_rgba(36,60,56,0.05)]"
                >
                  Termine trenutno nije moguće učitati. Pokušajte ponovo
                  kasnije.
                </div>
              ) : timeSlots.length === 0 ? (
                <div className="mt-10 rounded-3xl border border-[#397267]/12 bg-white/75 p-6 text-[#526b66] shadow-[0_12px_35px_rgba(36,60,56,0.05)]">
                  Za izabrani datum nema dostupnih termina.
                </div>
              ) : (
                <>
                  <div className="mt-12 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <h2 className="text-sm font-semibold tracking-[0.12em] text-[#526b66] uppercase">
                      Dostupni termini
                    </h2>
                    <p className="text-sm text-[#6b807c]">
                      Trajanje termina je {selectedService?.duration_minutes}{" "}
                      minuta
                    </p>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {timeSlots.map((time) => {
                      const isSelected = selectedTime === time;

                      return (
                        <Link
                          key={time}
                          href={{
                            pathname: "/booking/time",
                            query: {
                              service: selectedService?.slug,
                              therapist: selectedTherapist?.slug,
                              date: selectedDate?.value,
                              time,
                            },
                          }}
                          replace
                          aria-current={isSelected ? "time" : undefined}
                          className={`flex min-h-28 flex-col items-center justify-center rounded-3xl border px-4 py-5 shadow-[0_10px_28px_rgba(36,60,56,0.05)] transition hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#397267] ${
                            isSelected
                              ? "border-[#397267] bg-[#397267] text-white shadow-[0_14px_32px_rgba(57,114,103,0.2)]"
                              : "border-[#397267]/12 bg-white/80 text-[#243c38] hover:border-[#397267]/30 hover:bg-white"
                          }`}
                        >
                          <span className="text-2xl font-semibold">{time}</span>
                          <span
                            className={`mt-2 text-xs font-semibold uppercase ${isSelected ? "text-white" : "text-[#397267]"}`}
                          >
                            {isSelected ? "Izabrano" : "Slobodno"}
                          </span>
                        </Link>
                      );
                    })}
                  </div>

                  {selectedTime && (
                    <div className="mt-8 flex justify-center sm:justify-end">
                      <Link
                        href={{
                          pathname: "/booking/details",
                          query: {
                            service: selectedService?.slug,
                            therapist: selectedTherapist?.slug,
                            date: selectedDate?.value,
                            time: selectedTime,
                          },
                        }}
                        className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-[#397267] px-8 py-3.5 text-base font-semibold text-white shadow-[0_12px_30px_rgba(57,114,103,0.22)] transition hover:bg-[#2f6158] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#397267] sm:w-auto"
                      >
                        Nastavi
                        <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  )}
                </>
              )}

              <div
                className={`mt-10 rounded-3xl border p-6 shadow-[0_12px_35px_rgba(36,60,56,0.05)] sm:flex sm:items-center sm:justify-between sm:gap-8 ${
                  !hasError && timeSlots.length === 0
                    ? "border-[#d89a58]/30 bg-[#fff4e5]"
                    : "border-[#397267]/12 bg-white/65"
                }`}
              >
                <div>
                  <h2 className="text-lg font-semibold text-[#243c38]">
                    Nema termina koji vam odgovara?
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b807c]">
                    Prijavite se na listu čekanja i kontaktiraćemo vas ako se
                    pojavi termin koji odgovara vašim željama.
                  </p>
                </div>
                <Link
                  href={waitlistHref}
                  className="mt-5 inline-flex min-h-12 w-full shrink-0 items-center justify-center rounded-full border border-[#397267]/25 bg-white px-6 py-3 text-sm font-semibold text-[#397267] transition hover:border-[#397267]/45 hover:bg-[#edf5f0] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#397267] sm:mt-0 sm:w-auto"
                >
                  Prijavi me na listu čekanja
                </Link>
              </div>
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
                ? "Termine trenutno nije moguće učitati. Pokušajte ponovo kasnije."
                : "Nedostaju podaci o usluzi, terapeutu ili datumu. Vratite se na prethodni korak i ponovite izbor."}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
