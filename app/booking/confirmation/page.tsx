import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const BELGRADE_TIME_ZONE = "Europe/Belgrade";

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

function isValidTime(value?: string) {
  const match = value?.match(/^(\d{2}):(\d{2})$/);

  return Boolean(
    match && Number(match[1]) <= 23 && Number(match[2]) <= 59,
  );
}

export const metadata: Metadata = {
  title: "Potvrda termina | Centar za razvoj i rehabilitaciju",
  description: "Potvrda uspešno zakazanog termina.",
};

type ConfirmationPageProps = {
  searchParams: Promise<{
    service?: string | string[];
    therapist?: string | string[];
    date?: string | string[];
    time?: string | string[];
    notification?: string | string[];
  }>;
};

export default async function ConfirmationPage({
  searchParams,
}: ConfirmationPageProps) {
  const params = await searchParams;
  const getValue = (value?: string | string[]) =>
    Array.isArray(value) ? value[0] : value;

  const serviceSlug = getValue(params.service);
  const therapistSlug = getValue(params.therapist);
  const dateValue = getValue(params.date);
  const timeValue = getValue(params.time);
  const notification = getValue(params.notification);
  const emailWasSent = notification === "sent";
  const emailFailed = notification === "failed";
  const formattedDate = formatSelectedDate(dateValue);
  const [serviceResult, therapistResult] =
    serviceSlug && therapistSlug
      ? await Promise.all([
          supabase
            .from("services")
            .select("name, slug")
            .eq("slug", serviceSlug)
            .maybeSingle(),
          supabase
            .from("therapists")
            .select("name, slug")
            .eq("slug", therapistSlug)
            .maybeSingle(),
        ])
      : [null, null];
  const selectedService = serviceResult?.data;
  const selectedTherapist = therapistResult?.data;
  const confirmationIsValid = Boolean(
    selectedService &&
      selectedTherapist &&
      formattedDate &&
      isValidTime(timeValue) &&
      !serviceResult?.error &&
      !therapistResult?.error,
  );

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
        <div className="mx-auto flex w-full max-w-6xl items-center px-6 py-5 sm:px-8 lg:px-10">
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
            <span className="text-sm leading-snug font-semibold tracking-tight text-[#243c38] sm:text-base">
              Centar za razvoj i rehabilitaciju
            </span>
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center">
        <section className="mx-auto w-full max-w-3xl px-6 py-16 text-center sm:px-8 sm:py-24 lg:px-10">
          {confirmationIsValid ? (
            <>
              <span
                aria-hidden="true"
                className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#397267] text-3xl font-semibold text-white shadow-[0_12px_30px_rgba(57,114,103,0.22)]"
              >
                ✓
              </span>
              <p className="mt-7 text-sm font-semibold tracking-[0.12em] text-[#397267] uppercase">
                Rezervacija potvrđena
              </p>
              <h1 className="mt-4 text-4xl leading-tight font-semibold tracking-[-0.035em] text-[#243c38] sm:text-5xl">
                Termin je uspešno zakazan
              </h1>
              <p className="mt-5 text-lg leading-8 text-[#526b66]">
                Vaš termin je sačuvan. U nastavku je pregled rezervacije.
              </p>

              <div className="mt-10 grid gap-4 rounded-3xl border border-[#397267]/12 bg-white/80 p-6 text-left shadow-[0_14px_38px_rgba(36,60,56,0.07)] sm:grid-cols-3 sm:p-8">
                <div>
                  <p className="text-xs font-semibold tracking-[0.12em] text-[#6b807c] uppercase">
                    Usluga
                  </p>
                  <p className="mt-2 font-semibold">{selectedService?.name}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-[0.12em] text-[#6b807c] uppercase">
                    Terapeut
                  </p>
                  <p className="mt-2 font-semibold">
                    {selectedTherapist?.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-[0.12em] text-[#6b807c] uppercase">
                    Datum i vreme
                  </p>
                  <p className="mt-2 font-semibold">
                    {formattedDate}, {timeValue}
                  </p>
                </div>
              </div>

              {emailWasSent && (
                <p className="mt-5 rounded-2xl border border-[#397267]/15 bg-[#edf7f1] px-5 py-4 text-sm font-medium leading-6 text-[#315f56]">
                  Potvrda termina poslata je na vašu email adresu.
                </p>
              )}

              {emailFailed && (
                <p
                  role="alert"
                  className="mt-5 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-5 py-4 text-sm font-medium leading-6 text-[#8f4033]"
                >
                  Termin je uspešno zakazan, ali potvrdu putem emaila trenutno
                  nije bilo moguće poslati.
                </p>
              )}
            </>
          ) : (
            <>
              <h1 className="text-4xl leading-tight font-semibold tracking-[-0.035em] text-[#243c38] sm:text-5xl">
                Potvrda nije dostupna
              </h1>
              <p className="mt-5 text-lg leading-8 text-[#526b66]">
                Nedostaju podaci o terminu. Vratite se na početnu stranicu i
                ponovite izbor.
              </p>
            </>
          )}

          <Link
            href="/"
            className="mt-10 inline-flex min-h-13 w-full items-center justify-center rounded-full bg-[#397267] px-8 py-3.5 text-base font-semibold text-white shadow-[0_12px_30px_rgba(57,114,103,0.22)] transition hover:bg-[#2f6158] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#397267] sm:w-auto"
          >
            Nazad na početnu
          </Link>
        </section>
      </main>
    </div>
  );
}
