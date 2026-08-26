import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const BELGRADE_TIME_ZONE = "Europe/Belgrade";
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

type Service = {
  id: number;
  name: string;
  slug: string;
};

type TherapistChoice = {
  id?: number;
  name: string;
  slug: string;
};

type AvailabilityData = {
  selectedService: Service | null;
  selectedTherapist: TherapistChoice | null;
  availableDays: Set<number>;
  hasError: boolean;
};

const calendarDateFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: BELGRADE_TIME_ZONE,
});

const weekdayFormatter = new Intl.DateTimeFormat("sr-Latn-RS", {
  weekday: "long",
  timeZone: BELGRADE_TIME_ZONE,
});

const weekdayKeyFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: BELGRADE_TIME_ZONE,
});

const dayFormatter = new Intl.DateTimeFormat("sr-Latn-RS", {
  day: "numeric",
  timeZone: BELGRADE_TIME_ZONE,
});

const monthFormatter = new Intl.DateTimeFormat("sr-Latn-RS", {
  month: "long",
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

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase("sr-Latn-RS") + value.slice(1);
}

function getCalendarParts(date: Date) {
  const parts = calendarDateFormatter.formatToParts(date);

  return {
    year: parts.find((part) => part.type === "year")?.value ?? "",
    month: parts.find((part) => part.type === "month")?.value ?? "",
    day: parts.find((part) => part.type === "day")?.value ?? "",
  };
}

function getUpcomingDates(availableDays: Set<number>) {
  const today = getCalendarParts(new Date());
  const calendarAnchor = Date.UTC(
    Number(today.year),
    Number(today.month) - 1,
    Number(today.day),
    12,
  );

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(calendarAnchor + index * MILLISECONDS_PER_DAY);
    const parts = getCalendarParts(date);
    const dayOfWeek = databaseDayByWeekday[weekdayKeyFormatter.format(date)];

    return {
      value: `${parts.year}-${parts.month}-${parts.day}`,
      weekday: capitalize(weekdayFormatter.format(date)),
      day: dayFormatter.format(date),
      month: monthFormatter.format(date),
      isAvailable: availableDays.has(dayOfWeek),
    };
  });
}

function getAvailableDays(rows: Array<{ day_of_week: number }>) {
  return new Set(
    rows
      .map((row) => Number(row.day_of_week))
      .filter((day) => day >= 1 && day <= 7),
  );
}

async function loadAvailability(
  serviceSlug?: string,
  therapistSlug?: string,
): Promise<AvailabilityData> {
  const emptyResult = {
    selectedService: null,
    selectedTherapist: null,
    availableDays: new Set<number>(),
    hasError: false,
  };

  if (!serviceSlug || !therapistSlug) {
    return emptyResult;
  }

  const { data: selectedService, error: serviceError } = await supabase
    .from("services")
    .select("id, name, slug")
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
        availableDays: new Set<number>(),
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
        availableDays: new Set<number>(),
        hasError: false,
      };
    }

    const { data: activeTherapists, error: activeTherapistsError } =
      await supabase
        .from("therapists")
        .select("id")
        .in("id", therapistIds)
        .eq("is_active", true);

    if (activeTherapistsError) {
      return {
        selectedService,
        selectedTherapist,
        availableDays: new Set<number>(),
        hasError: true,
      };
    }

    const activeTherapistIds = (activeTherapists ?? []).map(
      (therapist) => therapist.id,
    );

    if (activeTherapistIds.length === 0) {
      return {
        selectedService,
        selectedTherapist,
        availableDays: new Set<number>(),
        hasError: false,
      };
    }

    const { data: workingHours, error: workingHoursError } = await supabase
      .from("working_hours")
      .select("day_of_week")
      .in("therapist_id", activeTherapistIds);

    return {
      selectedService,
      selectedTherapist,
      availableDays: getAvailableDays(workingHours ?? []),
      hasError: Boolean(workingHoursError),
    };
  }

  const { data: selectedTherapist, error: therapistError } = await supabase
    .from("therapists")
    .select("id, name, slug")
    .eq("slug", therapistSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (therapistError) {
    return {
      selectedService,
      selectedTherapist: null,
      availableDays: new Set<number>(),
      hasError: true,
    };
  }

  if (!selectedTherapist) {
    return {
      selectedService,
      selectedTherapist: null,
      availableDays: new Set<number>(),
      hasError: false,
    };
  }

  const { data: workingHours, error: workingHoursError } = await supabase
    .from("working_hours")
    .select("day_of_week")
    .eq("therapist_id", selectedTherapist.id);

  return {
    selectedService,
    selectedTherapist,
    availableDays: getAvailableDays(workingHours ?? []),
    hasError: Boolean(workingHoursError),
  };
}

export const metadata: Metadata = {
  title: "Izaberite datum | Centar za razvoj i rehabilitaciju",
  description: "Izaberite datum za željeni termin.",
};

type DatePageProps = {
  searchParams: Promise<{
    service?: string | string[];
    therapist?: string | string[];
    date?: string | string[];
  }>;
};

export default async function DatePage({ searchParams }: DatePageProps) {
  const params = await searchParams;
  const serviceSlug = Array.isArray(params.service)
    ? params.service[0]
    : params.service;
  const therapistSlug = Array.isArray(params.therapist)
    ? params.therapist[0]
    : params.therapist;
  const selectedDateValue = Array.isArray(params.date)
    ? params.date[0]
    : params.date;
  const { selectedService, selectedTherapist, availableDays, hasError } =
    await loadAvailability(serviceSlug, therapistSlug);
  const upcomingDates = getUpcomingDates(availableDays);
  const selectedDate = upcomingDates.find(
    (date) => date.isAvailable && date.value === selectedDateValue,
  );
  const selectionIsValid = Boolean(selectedService && selectedTherapist);
  const hasAvailableDate = upcomingDates.some((date) => date.isAvailable);
  const backHref = selectedService
    ? {
        pathname: "/booking/therapists",
        query: { service: selectedService.slug },
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
            Nazad na izbor terapeuta
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex flex-1">
        <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 sm:py-24 lg:px-10">
          <div className="text-center sm:text-left">
            <p className="mb-4 text-sm font-semibold tracking-[0.12em] text-[#397267] uppercase">
              Treći korak
            </p>
            <h1 className="text-4xl leading-tight font-semibold tracking-[-0.035em] text-[#243c38] sm:text-5xl">
              Izaberite datum
            </h1>
          </div>

          {selectionIsValid ? (
            <>
              <div className="mt-8 grid gap-3 rounded-3xl border border-[#397267]/12 bg-white/70 p-5 shadow-[0_12px_35px_rgba(36,60,56,0.05)] sm:grid-cols-2 sm:p-6">
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
              </div>

              {hasError ? (
                <div
                  role="alert"
                  className="mt-10 rounded-3xl border border-[#b45745]/20 bg-white/75 p-6 text-[#8f4033] shadow-[0_12px_35px_rgba(36,60,56,0.05)]"
                >
                  Radno vreme trenutno nije moguće učitati. Pokušajte ponovo
                  kasnije.
                </div>
              ) : (
                <>
                  <h2 className="mt-12 text-sm font-semibold tracking-[0.12em] text-[#526b66] uppercase">
                    Narednih sedam dana
                  </h2>

                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                    {upcomingDates.map((date) => {
                      const isSelected =
                        date.isAvailable && selectedDateValue === date.value;

                      if (!date.isAvailable) {
                        return (
                          <button
                            key={date.value}
                            type="button"
                            disabled
                            className="flex min-h-40 cursor-not-allowed flex-col items-center justify-center rounded-3xl border border-[#243c38]/8 bg-[#f1eee8]/80 px-3 py-5 text-center text-[#83908d] opacity-75"
                          >
                            <span className="text-sm font-semibold">
                              {date.weekday}
                            </span>
                            <span className="mt-3 text-3xl font-semibold">
                              {date.day}
                            </span>
                            <span className="mt-1 text-sm">{date.month}</span>
                            <span className="mt-3 text-xs font-semibold uppercase">
                              Nedostupno
                            </span>
                          </button>
                        );
                      }

                      return (
                        <Link
                          key={date.value}
                          href={{
                            pathname: "/booking/date",
                            query: {
                              service: selectedService?.slug,
                              therapist: selectedTherapist?.slug,
                              date: date.value,
                            },
                          }}
                          replace
                          aria-current={isSelected ? "date" : undefined}
                          className={`flex min-h-40 flex-col items-center justify-center rounded-3xl border px-3 py-5 text-center shadow-[0_10px_28px_rgba(36,60,56,0.05)] transition hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#397267] ${
                            isSelected
                              ? "border-[#397267] bg-[#397267] text-white shadow-[0_14px_32px_rgba(57,114,103,0.2)]"
                              : "border-[#397267]/12 bg-white/80 text-[#243c38] hover:border-[#397267]/30 hover:bg-white"
                          }`}
                        >
                          <span className="text-sm font-semibold">
                            {date.weekday}
                          </span>
                          <span className="mt-3 text-3xl font-semibold">
                            {date.day}
                          </span>
                          <span
                            className={`mt-1 text-sm ${isSelected ? "text-white/75" : "text-[#6b807c]"}`}
                          >
                            {date.month}
                          </span>
                          <span
                            className={`mt-3 text-xs font-semibold uppercase ${isSelected ? "text-white" : "text-[#397267]"}`}
                          >
                            {isSelected ? "Izabrano" : "Izaberi"}
                          </span>
                        </Link>
                      );
                    })}
                  </div>

                  {!hasAvailableDate && (
                    <p className="mt-6 text-sm font-medium text-[#6b807c]">
                      Za narednih sedam dana nema dostupnih datuma.
                    </p>
                  )}

                  {selectedDate && (
                    <div className="mt-8 flex justify-center sm:justify-end">
                      <Link
                        href={{
                          pathname: "/booking/time",
                          query: {
                            service: selectedService?.slug,
                            therapist: selectedTherapist?.slug,
                            date: selectedDate.value,
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
                ? "Radno vreme trenutno nije moguće učitati. Pokušajte ponovo kasnije."
                : "Nedostaju podaci o usluzi ili terapeutu. Vratite se na prethodni korak i ponovite izbor."}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
