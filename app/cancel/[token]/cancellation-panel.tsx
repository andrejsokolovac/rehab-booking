"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type CancellationPanelProps = {
  token: string;
  appointment: {
    serviceName: string;
    therapistName: string;
    formattedDate: string;
    formattedTime: string;
    status: string;
  };
};

function getStatusLabel(status: string) {
  switch (status) {
    case "confirmed":
      return "Potvrđen";
    case "cancelled":
      return "Otkazan";
    default:
      return "Nije moguće otkazati";
  }
}

function cancellationSucceeded(data: unknown) {
  if (data === true) {
    return true;
  }

  return Array.isArray(data) && data[0] === true;
}

async function sendTherapistCancellationNotification(cancelToken: string) {
  try {
    const response = await fetch(
      "/api/send-therapist-cancellation-notification",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelToken }),
      },
    );

    return response.ok;
  } catch {
    return false;
  }
}

export default function CancellationPanel({
  token,
  appointment,
}: CancellationPanelProps) {
  const submissionInProgress = useRef(false);
  const [status, setStatus] = useState(appointment.status.toLowerCase());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string>();
  const isConfirmed = status === "confirmed";
  const isCancelled = status === "cancelled";

  async function handleCancellation() {
    if (submissionInProgress.current || isSubmitting || !isConfirmed) {
      return;
    }

    submissionInProgress.current = true;
    setRequestError(undefined);
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.rpc("cancel_appointment", {
        p_cancel_token: token,
      });

      if (error || !cancellationSucceeded(data)) {
        setRequestError(
          "Termin nije moguće otkazati. Link nije važeći ili je termin već otkazan.",
        );
        submissionInProgress.current = false;
        setIsSubmitting(false);
        return;
      }

      setStatus("cancelled");
      await sendTherapistCancellationNotification(token);
    } catch {
      setRequestError(
        "Termin trenutno nije moguće otkazati. Pokušajte ponovo kasnije.",
      );
    }

    submissionInProgress.current = false;
    setIsSubmitting(false);
  }

  return (
    <div className="mt-8">
      <div className="grid gap-4 rounded-3xl border border-[#397267]/12 bg-white/80 p-6 text-left shadow-[0_14px_38px_rgba(36,60,56,0.07)] sm:grid-cols-2 sm:p-8">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[#6b807c] uppercase">
            Usluga
          </p>
          <p className="mt-2 font-semibold text-[#243c38]">
            {appointment.serviceName}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[#6b807c] uppercase">
            Terapeut
          </p>
          <p className="mt-2 font-semibold text-[#243c38]">
            {appointment.therapistName}
          </p>
        </div>
        <div className="border-t border-[#397267]/10 pt-4 sm:border-t-0">
          <p className="text-xs font-semibold tracking-[0.12em] text-[#6b807c] uppercase">
            Datum i vreme
          </p>
          <p className="mt-2 font-semibold text-[#243c38]">
            {appointment.formattedDate}, {appointment.formattedTime}
          </p>
        </div>
        <div className="border-t border-[#397267]/10 pt-4 sm:border-t-0">
          <p className="text-xs font-semibold tracking-[0.12em] text-[#6b807c] uppercase">
            Status
          </p>
          <p className="mt-2 font-semibold text-[#243c38]">
            {getStatusLabel(status)}
          </p>
        </div>
      </div>

      {isConfirmed ? (
        <div className="mt-8 rounded-3xl border border-[#b45745]/15 bg-white/75 p-6 shadow-[0_12px_35px_rgba(36,60,56,0.05)] sm:p-8">
          <h2 className="text-2xl leading-tight font-semibold tracking-[-0.02em] text-[#243c38] sm:text-3xl">
            Da li ste sigurni da želite da otkažete termin?
          </h2>

          {requestError && (
            <div
              role="alert"
              className="mt-5 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-5 py-4 text-sm font-medium leading-6 text-[#8f4033]"
            >
              {requestError}
            </div>
          )}

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={handleCancellation}
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="inline-flex min-h-13 w-full cursor-pointer items-center justify-center rounded-full bg-[#b45745] px-8 py-3.5 text-base font-semibold text-white shadow-[0_12px_30px_rgba(180,87,69,0.2)] transition hover:bg-[#9e4939] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#b45745] disabled:cursor-wait disabled:opacity-65 sm:w-auto"
            >
              {isSubmitting ? "Otkazivanje..." : "Da, otkaži termin"}
            </button>
            <Link
              href="/"
              className="inline-flex min-h-13 w-full items-center justify-center rounded-full border border-[#397267]/20 bg-white/80 px-8 py-3.5 text-base font-semibold text-[#397267] transition hover:border-[#397267]/35 hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#397267] sm:w-auto"
            >
              Ne, vrati se na početnu
            </Link>
          </div>
        </div>
      ) : isCancelled ? (
        <div className="mt-8 rounded-3xl border border-[#397267]/15 bg-white/75 p-6 shadow-[0_12px_35px_rgba(36,60,56,0.05)] sm:p-8">
          <h2 className="text-2xl leading-tight font-semibold tracking-[-0.02em] text-[#243c38] sm:text-3xl">
            {appointment.status.toLowerCase() === "cancelled"
              ? "Ovaj termin je već otkazan."
              : "Termin je uspešno otkazan."}
          </h2>
          {appointment.status.toLowerCase() !== "cancelled" && (
            <p className="mt-4 text-base leading-7 text-[#526b66]">
              Termin je sada ponovo dostupan za zakazivanje.
            </p>
          )}
          <Link
            href="/"
            className="mt-7 inline-flex min-h-13 w-full items-center justify-center rounded-full bg-[#397267] px-8 py-3.5 text-base font-semibold text-white shadow-[0_12px_30px_rgba(57,114,103,0.22)] transition hover:bg-[#2f6158] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#397267] sm:w-auto"
          >
            Nazad na početnu
          </Link>
        </div>
      ) : (
        <div className="mt-8 rounded-3xl border border-[#397267]/12 bg-white/75 p-6 text-[#526b66] shadow-[0_12px_35px_rgba(36,60,56,0.05)] sm:p-8">
          Ovaj termin trenutno nije moguće otkazati.
        </div>
      )}
    </div>
  );
}
