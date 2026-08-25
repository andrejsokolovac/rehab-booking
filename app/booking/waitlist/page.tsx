import type { Metadata } from "next";
import Link from "next/link";

import { supabase } from "@/lib/supabase";
import WaitlistForm from "./waitlist-form";

const BELGRADE_TIME_ZONE = "Europe/Belgrade";

type Service = {
  id: number;
  name: string;
  slug: string;
};

type TherapistChoice = {
  id: number | null;
  name: string;
  slug: string;
};

type WaitlistSelection = {
  service: Service | null;
  therapist: TherapistChoice | null;
  hasError: boolean;
};

const calendarDateFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: BELGRADE_TIME_ZONE,
});

function getCurrentBelgradeDate() {
  const parts = Object.fromEntries(
    calendarDateFormatter
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addCalendarDays(value: string, amount: number) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return value;
  }

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + amount),
  );

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

async function loadWaitlistSelection(
  serviceSlug?: string,
  therapistSlug?: string,
): Promise<WaitlistSelection> {
  const emptySelection: WaitlistSelection = {
    service: null,
    therapist: null,
    hasError: false,
  };

  if (!serviceSlug || !therapistSlug) {
    return emptySelection;
  }

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, name, slug")
    .eq("slug", serviceSlug)
    .maybeSingle();

  if (serviceError) {
    return { ...emptySelection, hasError: true };
  }

  if (!service) {
    return emptySelection;
  }

  if (therapistSlug === "any") {
    return {
      service,
      therapist: {
        id: null,
        name: "Bilo koji slobodan terapeut",
        slug: "any",
      },
      hasError: false,
    };
  }

  const { data: therapist, error: therapistError } = await supabase
    .from("therapists")
    .select("id, name, slug")
    .eq("slug", therapistSlug)
    .maybeSingle();

  if (therapistError) {
    return { service, therapist: null, hasError: true };
  }

  if (!therapist) {
    return { service, therapist: null, hasError: false };
  }

  const { data: serviceLink, error: serviceLinkError } = await supabase
    .from("therapist_services")
    .select("id")
    .eq("service_id", service.id)
    .eq("therapist_id", therapist.id)
    .limit(1)
    .maybeSingle();

  if (serviceLinkError) {
    return { service, therapist: null, hasError: true };
  }

  return {
    service,
    therapist: serviceLink ? therapist : null,
    hasError: false,
  };
}

export const metadata: Metadata = {
  title: "Lista čekanja | Centar za razvoj i rehabilitaciju",
  description: "Prijavite se na listu čekanja za željeni termin.",
};

type WaitlistPageProps = {
  searchParams: Promise<{
    service?: string | string[];
    therapist?: string | string[];
  }>;
};

export default async function WaitlistPage({
  searchParams,
}: WaitlistPageProps) {
  const params = await searchParams;
  const serviceSlug = Array.isArray(params.service)
    ? params.service[0]
    : params.service;
  const therapistSlug = Array.isArray(params.therapist)
    ? params.therapist[0]
    : params.therapist;
  const { service, therapist, hasError } = await loadWaitlistSelection(
    serviceSlug,
    therapistSlug,
  );
  const selectionIsValid = Boolean(service && therapist);
  const today = getCurrentBelgradeDate();
  const backHref = service
    ? {
        pathname: "/booking/therapists",
        query: { service: service.slug },
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
        <section className="mx-auto w-full max-w-5xl px-6 py-16 sm:px-8 sm:py-24 lg:px-10">
          <div className="text-center sm:text-left">
            <p className="mb-4 text-sm font-semibold tracking-[0.12em] text-[#397267] uppercase">
              Lista čekanja
            </p>
            <h1 className="text-4xl leading-tight font-semibold tracking-[-0.035em] text-[#243c38] sm:text-5xl">
              Prijava na listu čekanja
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#526b66]">
              Navedite dane i period koji vam odgovaraju, pa ćemo vas
              kontaktirati ako se oslobodi odgovarajući termin.
            </p>
          </div>

          {selectionIsValid && service && therapist ? (
            <>
              <div className="mt-8 grid gap-3 rounded-3xl border border-[#397267]/12 bg-white/70 p-5 shadow-[0_12px_35px_rgba(36,60,56,0.05)] sm:grid-cols-2 sm:p-6">
                <div>
                  <p className="text-xs font-semibold tracking-[0.12em] text-[#6b807c] uppercase">
                    Usluga
                  </p>
                  <p className="mt-2 font-semibold text-[#243c38]">
                    {service.name}
                  </p>
                </div>
                <div className="border-t border-[#397267]/10 pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
                  <p className="text-xs font-semibold tracking-[0.12em] text-[#6b807c] uppercase">
                    Terapeut
                  </p>
                  <p className="mt-2 font-semibold text-[#243c38]">
                    {therapist.name}
                  </p>
                </div>
              </div>

              <WaitlistForm
                selection={{
                  serviceId: service.id,
                  therapistId: therapist.id,
                }}
                today={today}
                defaultValidUntil={addCalendarDays(today, 30)}
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
                ? "Podatke za listu čekanja trenutno nije moguće učitati. Pokušajte ponovo kasnije."
                : "Nedostaju podaci o usluzi ili terapeutu. Vratite se na prethodni korak i ponovite izbor."}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
