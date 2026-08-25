import type { Metadata } from "next";
import Link from "next/link";

import { supabase } from "@/lib/supabase";
import OfferPanel from "./offer-panel";

const BELGRADE_TIME_ZONE = "Europe/Belgrade";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OFFER_STATUSES = new Set([
  "pending",
  "accepted",
  "expired",
  "cancelled",
]);

type WaitlistOffer = {
  serviceName: string;
  therapistName: string;
  startAt: string;
  endAt: string;
  expiresAt: string;
  status: string;
};

type FormattedOffer = {
  formattedDate: string;
  formattedStartTime: string;
  formattedEndTime: string;
  formattedExpiration: string;
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

const expirationFormatter = new Intl.DateTimeFormat("sr-Latn-RS", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: BELGRADE_TIME_ZONE,
});

function getOfferRow(data: unknown): WaitlistOffer | null {
  const value = Array.isArray(data) ? data[0] : data;

  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const status =
    typeof row.status === "string" ? row.status.toLowerCase() : "";

  if (
    typeof row.service_name !== "string" ||
    typeof row.therapist_name !== "string" ||
    typeof row.start_at !== "string" ||
    typeof row.end_at !== "string" ||
    typeof row.expires_at !== "string" ||
    !OFFER_STATUSES.has(status)
  ) {
    return null;
  }

  return {
    serviceName: row.service_name,
    therapistName: row.therapist_name,
    startAt: row.start_at,
    endAt: row.end_at,
    expiresAt: row.expires_at,
    status,
  };
}

function formatOffer(offer: WaitlistOffer): FormattedOffer | null {
  const start = new Date(offer.startAt);
  const end = new Date(offer.endAt);
  const expiration = new Date(offer.expiresAt);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    Number.isNaN(expiration.getTime()) ||
    end <= start
  ) {
    return null;
  }

  const formattedDate = dateFormatter.format(start);

  return {
    formattedDate:
      formattedDate.charAt(0).toLocaleUpperCase("sr-Latn-RS") +
      formattedDate.slice(1),
    formattedStartTime: timeFormatter.format(start),
    formattedEndTime: timeFormatter.format(end),
    formattedExpiration: expirationFormatter.format(expiration),
  };
}

function getStatusMessage(status: string) {
  switch (status) {
    case "accepted":
      return "Ovaj termin je već prihvaćen.";
    case "expired":
      return "Ova ponuda je istekla.";
    case "cancelled":
      return "Ova ponuda više nije dostupna.";
    default:
      return "Ponuda nije pronađena ili link nije validan.";
  }
}

export const metadata: Metadata = {
  title: "Ponuda termina | Centar za razvoj i rehabilitaciju",
  description: "Pregled ponude termina sa liste čekanja.",
};

type WaitlistOfferPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function WaitlistOfferPage({
  params,
}: WaitlistOfferPageProps) {
  const { token } = await params;
  const tokenIsValid = UUID_PATTERN.test(token);
  const result = tokenIsValid
    ? await supabase.rpc("get_waitlist_offer", {
        p_offer_token: token,
      })
    : null;
  const offer = getOfferRow(result?.data);
  const formattedOffer = offer ? formatOffer(offer) : null;
  const hasLoadingError = Boolean(result?.error);
  const activeOfferIsValid = Boolean(
    offer?.status === "pending" && formattedOffer,
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
        <section className="mx-auto w-full max-w-3xl px-6 py-14 text-center sm:px-8 sm:py-20 lg:px-10">
          <p className="text-sm font-semibold tracking-[0.12em] text-[#397267] uppercase">
            Lista čekanja
          </p>
          <h1 className="mt-4 text-4xl leading-tight font-semibold tracking-[-0.035em] text-[#243c38] sm:text-5xl">
            {activeOfferIsValid ? "Oslobodio se termin" : "Ponuda termina"}
          </h1>

          {activeOfferIsValid && offer && formattedOffer ? (
            <OfferPanel
              offerToken={token}
              offer={{
                serviceName: offer.serviceName,
                therapistName: offer.therapistName,
                expiresAt: offer.expiresAt,
                ...formattedOffer,
              }}
            />
          ) : (
            <>
              <div
                role={hasLoadingError ? "alert" : undefined}
                className={`mt-8 rounded-3xl border bg-white/80 p-6 text-base leading-7 shadow-[0_14px_38px_rgba(36,60,56,0.07)] sm:p-8 ${
                  hasLoadingError
                    ? "border-[#b45745]/20 text-[#8f4033]"
                    : "border-[#397267]/12 text-[#526b66]"
                }`}
              >
                {hasLoadingError
                  ? "Ponudu trenutno nije moguće učitati. Pokušajte ponovo kasnije."
                  : getStatusMessage(offer?.status ?? "")}
              </div>
              <Link
                href="/"
                className="mt-8 inline-flex min-h-13 w-full items-center justify-center rounded-full bg-[#397267] px-8 py-3.5 text-base font-semibold text-white shadow-[0_12px_30px_rgba(57,114,103,0.22)] transition hover:bg-[#2f6158] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#397267] sm:w-auto"
              >
                Nazad na početnu
              </Link>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
