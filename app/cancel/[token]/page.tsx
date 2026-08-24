import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import CancellationPanel from "./cancellation-panel";

const BELGRADE_TIME_ZONE = "Europe/Belgrade";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CancellationAppointment = {
  service_name: string;
  therapist_name: string;
  start_at: string;
  status: string;
};

const dateFormatter = new Intl.DateTimeFormat("sr-Latn-RS", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: BELGRADE_TIME_ZONE,
});

const timeFormatter = new Intl.DateTimeFormat("sr-Latn-RS", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: BELGRADE_TIME_ZONE,
});

function getAppointmentRow(data: unknown): CancellationAppointment | null {
  const value = Array.isArray(data) ? data[0] : data;

  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;

  if (
    typeof row.service_name !== "string" ||
    typeof row.therapist_name !== "string" ||
    typeof row.start_at !== "string" ||
    typeof row.status !== "string"
  ) {
    return null;
  }

  return {
    service_name: row.service_name,
    therapist_name: row.therapist_name,
    start_at: row.start_at,
    status: row.status,
  };
}

function formatAppointmentDateTime(startAt: string) {
  const date = new Date(startAt);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const formattedDate = dateFormatter.format(date);

  return {
    formattedDate:
      formattedDate.charAt(0).toLocaleUpperCase("sr-Latn-RS") +
      formattedDate.slice(1),
    formattedTime: timeFormatter.format(date),
  };
}

export const metadata: Metadata = {
  title: "Otkazivanje termina | Centar za razvoj i rehabilitaciju",
  description: "Pregledajte i otkažite zakazani termin.",
};

type CancellationPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function CancellationPage({
  params,
}: CancellationPageProps) {
  const { token } = await params;
  const tokenIsValid = UUID_PATTERN.test(token);
  const result = tokenIsValid
    ? await supabase.rpc("get_appointment_for_cancellation", {
        p_cancel_token: token,
      })
    : null;
  const appointment = getAppointmentRow(result?.data);
  const formattedDateTime = appointment
    ? formatAppointmentDateTime(appointment.start_at)
    : null;
  const hasLoadingError = Boolean(result?.error);
  const appointmentIsAvailable = Boolean(appointment && formattedDateTime);

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
          <p className="text-sm font-semibold tracking-[0.12em] text-[#397267] uppercase">
            Upravljanje terminom
          </p>
          <h1 className="mt-4 text-4xl leading-tight font-semibold tracking-[-0.035em] text-[#243c38] sm:text-5xl">
            Otkazivanje termina
          </h1>

          {appointmentIsAvailable && appointment && formattedDateTime ? (
            <CancellationPanel
              token={token}
              appointment={{
                serviceName: appointment.service_name,
                therapistName: appointment.therapist_name,
                formattedDate: formattedDateTime.formattedDate,
                formattedTime: formattedDateTime.formattedTime,
                status: appointment.status,
              }}
            />
          ) : (
            <div
              role={hasLoadingError ? "alert" : undefined}
              className={`mt-8 rounded-3xl border bg-white/75 p-6 shadow-[0_12px_35px_rgba(36,60,56,0.05)] sm:p-8 ${
                hasLoadingError
                  ? "border-[#b45745]/20 text-[#8f4033]"
                  : "border-[#397267]/12 text-[#526b66]"
              }`}
            >
              {hasLoadingError
                ? "Podatke o terminu trenutno nije moguće učitati. Pokušajte ponovo kasnije."
                : "Termin nije pronađen ili link nije važeći."}
            </div>
          )}

          {!appointmentIsAvailable && (
            <Link
              href="/"
              className="mt-8 inline-flex min-h-13 w-full items-center justify-center rounded-full bg-[#397267] px-8 py-3.5 text-base font-semibold text-white shadow-[0_12px_30px_rgba(57,114,103,0.22)] transition hover:bg-[#2f6158] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#397267] sm:w-auto"
            >
              Nazad na početnu
            </Link>
          )}
        </section>
      </main>
    </div>
  );
}
