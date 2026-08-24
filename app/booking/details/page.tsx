import type { Metadata } from "next";
import Link from "next/link";
import DetailsForm from "./details-form";

const BELGRADE_TIME_ZONE = "Europe/Belgrade";
const OCCUPIED_TIMES = new Set(["09:30", "11:45", "14:00"]);

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

const dateFormatter = new Intl.DateTimeFormat("sr-Latn-RS", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: BELGRADE_TIME_ZONE,
});

function formatSelectedDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const date = new Date(`${value}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  const formatted = dateFormatter.format(date);
  return formatted.charAt(0).toLocaleUpperCase("sr-Latn-RS") + formatted.slice(1);
}

function isAvailableTime(value?: string) {
  if (!value || !/^\d{2}:\d{2}$/.test(value) || OCCUPIED_TIMES.has(value)) {
    return false;
  }

  const [hours, minutes] = value.split(":").map(Number);
  const totalMinutes = hours * 60 + minutes;

  return (
    totalMinutes >= 8 * 60 &&
    totalMinutes + 45 <= 16 * 60 &&
    (totalMinutes - 8 * 60) % 45 === 0
  );
}

export const metadata: Metadata = {
  title: "Podaci za zakazivanje | Centar za razvoj i rehabilitaciju",
  description: "Unesite osnovne podatke za probnu potvrdu termina.",
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
  const formattedDate = formatSelectedDate(dateValue);
  const selectionIsValid = Boolean(
    selectedService &&
      selectedTherapist &&
      dateValue &&
      formattedDate &&
      timeValue &&
      isAvailableTime(timeValue),
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
                  service: selectedService?.slug ?? "",
                  therapist: selectedTherapist?.slug ?? "",
                  date: dateValue ?? "",
                  time: timeValue ?? "",
                }}
              />
            </>
          ) : (
            <div className="mt-8 rounded-3xl border border-[#397267]/12 bg-white/70 p-6 text-[#526b66] shadow-[0_12px_35px_rgba(36,60,56,0.05)]">
              Nedostaju podaci o izabranom terminu. Vratite se na prethodni
              korak i ponovite izbor.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
