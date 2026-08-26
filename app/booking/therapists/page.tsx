import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Service = {
  id: number;
  name: string;
  slug: string;
};

type Therapist = {
  id: number;
  name: string;
  slug: string;
  specialty: string;
};

type TherapistPageData = {
  selectedService: Service | null;
  availableTherapists: Therapist[];
  hasError: boolean;
};

async function loadTherapistsForService(
  serviceSlug?: string,
): Promise<TherapistPageData> {
  if (!serviceSlug) {
    return {
      selectedService: null,
      availableTherapists: [],
      hasError: false,
    };
  }

  const { data: selectedService, error: serviceError } = await supabase
    .from("services")
    .select("id, name, slug")
    .eq("slug", serviceSlug)
    .maybeSingle();

  if (serviceError) {
    return {
      selectedService: null,
      availableTherapists: [],
      hasError: true,
    };
  }

  if (!selectedService) {
    return {
      selectedService: null,
      availableTherapists: [],
      hasError: false,
    };
  }

  const { data: serviceLinks, error: linksError } = await supabase
    .from("therapist_services")
    .select("therapist_id")
    .eq("service_id", selectedService.id);

  if (linksError) {
    return {
      selectedService,
      availableTherapists: [],
      hasError: true,
    };
  }

  const therapistIds = [
    ...new Set((serviceLinks ?? []).map((link) => link.therapist_id)),
  ];

  if (therapistIds.length === 0) {
    return {
      selectedService,
      availableTherapists: [],
      hasError: false,
    };
  }

  const { data: availableTherapists, error: therapistsError } = await supabase
    .from("therapists")
    .select("id, name, slug, specialty:speciality")
    .in("id", therapistIds)
    .eq("is_active", true)
    .order("id", { ascending: true });

  return {
    selectedService,
    availableTherapists: availableTherapists ?? [],
    hasError: Boolean(therapistsError),
  };
}

export const metadata: Metadata = {
  title: "Izaberite terapeuta | Centar za razvoj i rehabilitaciju",
  description: "Izaberite terapeuta za odabranu uslugu.",
};

type TherapistsPageProps = {
  searchParams: Promise<{ service?: string | string[] }>;
};

export default async function TherapistsPage({
  searchParams,
}: TherapistsPageProps) {
  const serviceParam = (await searchParams).service;
  const serviceSlug = Array.isArray(serviceParam)
    ? serviceParam[0]
    : serviceParam;
  const { selectedService, availableTherapists, hasError } =
    await loadTherapistsForService(serviceSlug);

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
            href="/booking"
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-[#397267] transition hover:bg-white/70 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#397267] sm:px-4"
          >
            <span aria-hidden="true">←</span>
            Nazad na izbor usluge
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex flex-1">
        <section className="mx-auto w-full max-w-4xl px-6 py-16 sm:px-8 sm:py-24 lg:px-10">
          <div className="text-center sm:text-left">
            <p className="mb-4 text-sm font-semibold tracking-[0.12em] text-[#397267] uppercase">
              Drugi korak
            </p>
            <h1 className="text-4xl leading-tight font-semibold tracking-[-0.035em] text-[#243c38] sm:text-5xl">
              Izaberite terapeuta
            </h1>
            {selectedService ? (
              <p className="mt-4 text-lg text-[#526b66] sm:text-xl">
                Izabrana usluga:{" "}
                <span className="font-semibold text-[#397267]">
                  {selectedService.name}
                </span>
              </p>
            ) : !hasError ? (
              <p className="mt-4 text-lg text-[#526b66] sm:text-xl">
                Usluga nije izabrana. Vratite se i izaberite željenu uslugu.
              </p>
            ) : null}
          </div>

          {hasError ? (
            <div
              role="alert"
              className="mt-10 rounded-3xl border border-[#b45745]/20 bg-white/75 p-6 text-[#8f4033] shadow-[0_12px_35px_rgba(36,60,56,0.05)]"
            >
              Terapeute trenutno nije moguće učitati. Pokušajte ponovo kasnije.
            </div>
          ) : selectedService && availableTherapists.length === 0 ? (
            <div className="mt-10 rounded-3xl border border-[#397267]/12 bg-white/75 p-6 text-[#526b66] shadow-[0_12px_35px_rgba(36,60,56,0.05)]">
              Trenutno nema dostupnih terapeuta za izabranu uslugu.
            </div>
          ) : selectedService ? (
            <div className="mt-10">
              <Link
                href={{
                  pathname: "/booking/date",
                  query: {
                    service: selectedService.slug,
                    therapist: "any",
                  },
                }}
                className="group flex w-full cursor-pointer items-center justify-between gap-5 rounded-3xl bg-[#397267] p-6 text-left text-white shadow-[0_14px_35px_rgba(57,114,103,0.2)] transition hover:-translate-y-0.5 hover:bg-[#2f6158] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#397267] sm:p-7"
              >
                <span>
                  <span className="block text-lg font-semibold sm:text-xl">
                    Prvi slobodan terapeut
                  </span>
                  <span className="mt-2 block text-sm text-white/75">
                    Izaberite najraniji raspoloživi termin
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15 text-xl transition group-hover:bg-white group-hover:text-[#397267]"
                >
                  →
                </span>
              </Link>

              <h2 className="mt-12 text-sm font-semibold tracking-[0.12em] text-[#526b66] uppercase">
                Dostupni terapeuti
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 sm:gap-5">
                {availableTherapists.map((therapist) => (
                  <Link
                    key={therapist.id}
                    href={{
                      pathname: "/booking/date",
                      query: {
                        service: selectedService.slug,
                        therapist: therapist.slug,
                      },
                    }}
                    className="group flex min-h-32 cursor-pointer items-center gap-5 rounded-3xl border border-[#397267]/12 bg-white/80 p-6 text-left shadow-[0_12px_35px_rgba(36,60,56,0.06)] transition hover:-translate-y-0.5 hover:border-[#397267]/30 hover:bg-white hover:shadow-[0_16px_40px_rgba(36,60,56,0.1)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#397267]"
                  >
                    <span
                      aria-hidden="true"
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e2f0e7] text-base font-semibold text-[#397267]"
                    >
                      {therapist.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-semibold text-[#243c38]">
                        {therapist.name}
                      </span>
                      <span className="mt-2 block text-sm leading-5 font-medium text-[#6b807c]">
                        {therapist.specialty}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-xl text-[#397267] transition group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
