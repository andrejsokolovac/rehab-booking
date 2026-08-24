import type { Metadata } from "next";
import Link from "next/link";

const BELGRADE_TIME_ZONE = "Europe/Belgrade";

const services = [
  { name: "Logopedski tretman", slug: "logopedski-tretman" },
  { name: "Defektološki tretman", slug: "defektoloski-tretman" },
  { name: "Inicijalna procena", slug: "inicijalna-procena" },
  { name: "Kontrolni pregled", slug: "kontrolni-pregled" },
];

const therapists = [
  {
    name: "Jelena Petrović",
    slug: "jelena-petrovic",
    services: [
      "logopedski-tretman",
      "inicijalna-procena",
      "kontrolni-pregled",
    ],
  },
  {
    name: "Marko Jovanović",
    slug: "marko-jovanovic",
    services: [
      "defektoloski-tretman",
      "inicijalna-procena",
      "kontrolni-pregled",
    ],
  },
  {
    name: "Milica Nikolić",
    slug: "milica-nikolic",
    services: [
      "logopedski-tretman",
      "defektoloski-tretman",
      "inicijalna-procena",
    ],
  },
];

const weekdayFormatter = new Intl.DateTimeFormat("sr-Latn-RS", {
  weekday: "long",
  timeZone: BELGRADE_TIME_ZONE,
});

const monthFormatter = new Intl.DateTimeFormat("sr-Latn-RS", {
  month: "long",
  timeZone: BELGRADE_TIME_ZONE,
});

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase("sr-Latn-RS") + value.slice(1);
}

function getUpcomingDates() {
  const dateParts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: BELGRADE_TIME_ZONE,
    })
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  const todayAtNoon = new Date(
    Date.UTC(
      Number(dateParts.year),
      Number(dateParts.month) - 1,
      Number(dateParts.day),
      12,
    ),
  );

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(todayAtNoon);
    date.setUTCDate(todayAtNoon.getUTCDate() + index);

    return {
      value: date.toISOString().slice(0, 10),
      weekday: capitalize(weekdayFormatter.format(date)),
      day: date.getUTCDate(),
      month: monthFormatter.format(date),
      isSunday: date.getUTCDay() === 0,
    };
  });
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

  const selectedService = services.find(
    (service) => service.slug === serviceSlug,
  );
  const selectedTherapist =
    therapistSlug === "any"
      ? { name: "Prvi slobodan terapeut", slug: "any" }
      : therapists.find(
          (therapist) =>
            therapist.slug === therapistSlug &&
            selectedService &&
            therapist.services.includes(selectedService.slug),
        );
  const upcomingDates = getUpcomingDates();
  const selectionIsValid = Boolean(selectedService && selectedTherapist);
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

              <h2 className="mt-12 text-sm font-semibold tracking-[0.12em] text-[#526b66] uppercase">
                Narednih sedam dana
              </h2>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {upcomingDates.map((date) => {
                  const isSelected =
                    !date.isSunday && selectedDateValue === date.value;

                  if (date.isSunday) {
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
            </>
          ) : (
            <div className="mt-8 rounded-3xl border border-[#397267]/12 bg-white/70 p-6 text-[#526b66] shadow-[0_12px_35px_rgba(36,60,56,0.05)]">
              Nedostaju podaci o usluzi ili terapeutu. Vratite se na prethodni
              korak i ponovite izbor.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
