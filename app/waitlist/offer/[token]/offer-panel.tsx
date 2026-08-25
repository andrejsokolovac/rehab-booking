"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";

type DatabaseId = number | string;

type AcceptedAppointment = {
  appointmentId: DatabaseId;
  cancelToken: string;
};

type OfferPanelProps = {
  offerToken: string;
  offer: {
    serviceName: string;
    therapistName: string;
    formattedDate: string;
    formattedStartTime: string;
    formattedEndTime: string;
    formattedExpiration: string;
    expiresAt: string;
  };
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getRemainingSeconds(expiresAt: string) {
  const expirationTime = new Date(expiresAt).getTime();

  if (Number.isNaN(expirationTime)) {
    return 0;
  }

  return Math.max(0, Math.ceil((expirationTime - Date.now()) / 1000));
}

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getAcceptedAppointment(data: unknown): AcceptedAppointment | null {
  const value = Array.isArray(data) ? data[0] : data;

  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const appointmentId = row.appointment_id;
  const cancelToken = row.cancel_token;
  const appointmentIdIsValid =
    (typeof appointmentId === "number" &&
      Number.isSafeInteger(appointmentId) &&
      appointmentId > 0) ||
    (typeof appointmentId === "string" && /^[1-9]\d*$/.test(appointmentId));

  if (
    !appointmentIdIsValid ||
    typeof cancelToken !== "string" ||
    !UUID_PATTERN.test(cancelToken)
  ) {
    return null;
  }

  return { appointmentId, cancelToken } as AcceptedAppointment;
}

async function sendParentConfirmation(
  appointment: AcceptedAppointment,
) {
  try {
    const response = await fetch("/api/send-booking-confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(appointment),
    });

    if (!response.ok) {
      return false;
    }

    const result: unknown = await response.json();

    return Boolean(
      result &&
        typeof result === "object" &&
        (result as Record<string, unknown>).success === true,
    );
  } catch {
    return false;
  }
}

async function sendTherapistNotification(
  appointment: AcceptedAppointment,
) {
  try {
    const response = await fetch(
      "/api/send-therapist-booking-notification",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appointment),
      },
    );

    if (!response.ok) {
      return false;
    }

    const result: unknown = await response.json();

    return Boolean(
      result &&
        typeof result === "object" &&
        (result as Record<string, unknown>).success === true,
    );
  } catch {
    return false;
  }
}

export default function OfferPanel({
  offerToken,
  offer,
}: OfferPanelProps) {
  const router = useRouter();
  const submissionInProgress = useRef(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptanceSucceeded, setAcceptanceSucceeded] = useState(false);
  const [acceptanceError, setAcceptanceError] = useState<string>();
  const [notificationStatus, setNotificationStatus] = useState<
    "idle" | "sending" | "sent" | "warning"
  >("idle");

  useEffect(() => {
    if (acceptanceSucceeded) {
      return;
    }

    function updateCountdown() {
      setRemainingSeconds(getRemainingSeconds(offer.expiresAt));
    }

    const initialUpdateId = window.setTimeout(updateCountdown, 0);
    const intervalId = window.setInterval(updateCountdown, 1000);

    return () => {
      window.clearTimeout(initialUpdateId);
      window.clearInterval(intervalId);
    };
  }, [acceptanceSucceeded, offer.expiresAt]);

  async function handleAcceptance() {
    if (
      submissionInProgress.current ||
      isAccepting ||
      acceptanceSucceeded ||
      remainingSeconds === null ||
      remainingSeconds <= 0
    ) {
      return;
    }

    submissionInProgress.current = true;
    setAcceptanceError(undefined);
    setIsAccepting(true);

    try {
      const { data, error } = await supabase.rpc("accept_waitlist_offer", {
        p_offer_token: offerToken,
      });
      const acceptedAppointment = getAcceptedAppointment(data);

      if (error || !acceptedAppointment) {
        setAcceptanceError(
          "Ponudu trenutno nije moguće prihvatiti. Možda je istekla ili termin više nije dostupan.",
        );
        setIsAccepting(false);
        submissionInProgress.current = false;
        router.refresh();
        return;
      }

      setAcceptanceSucceeded(true);
      setIsAccepting(false);
      setNotificationStatus("sending");
      submissionInProgress.current = false;

      const [parentEmailWasSent, therapistEmailWasSent] = await Promise.all([
        sendParentConfirmation(acceptedAppointment),
        sendTherapistNotification(acceptedAppointment),
      ]);

      setNotificationStatus(
        parentEmailWasSent && therapistEmailWasSent ? "sent" : "warning",
      );
    } catch {
      setAcceptanceError(
        "Ponudu trenutno nije moguće prihvatiti. Pokušajte ponovo.",
      );
      setIsAccepting(false);
      submissionInProgress.current = false;
      router.refresh();
    }
  }

  if (acceptanceSucceeded) {
    return (
      <div className="mt-8 rounded-3xl border border-[#397267]/15 bg-white/80 p-6 text-center shadow-[0_14px_38px_rgba(36,60,56,0.07)] sm:p-8">
        <span
          aria-hidden="true"
          className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#397267] text-3xl font-semibold text-white shadow-[0_12px_30px_rgba(57,114,103,0.22)]"
        >
          ✓
        </span>
        <h2 className="mt-6 text-3xl font-semibold tracking-[-0.03em] text-[#243c38] sm:text-4xl">
          Termin je uspešno rezervisan.
        </h2>

        {notificationStatus === "sending" && (
          <p className="mt-4 text-base leading-7 text-[#526b66]">
            Rezervacija je sačuvana. Šaljemo potvrdu putem emaila...
          </p>
        )}

        {notificationStatus === "sent" && (
          <p className="mt-4 text-base leading-7 text-[#526b66]">
            Potvrda termina poslata je putem emaila.
          </p>
        )}

        {notificationStatus === "warning" && (
          <p
            role="status"
            className="mt-5 rounded-2xl border border-[#b8863b]/20 bg-[#fff9ed] px-5 py-4 text-sm font-medium leading-6 text-[#805b24]"
          >
            Termin je rezervisan, ali jedno ili više email obaveštenja trenutno
            nije bilo moguće poslati.
          </p>
        )}

        <Link
          href="/"
          className="mt-8 inline-flex min-h-13 w-full items-center justify-center rounded-full bg-[#397267] px-8 py-3.5 text-base font-semibold text-white shadow-[0_12px_30px_rgba(57,114,103,0.22)] transition hover:bg-[#2f6158] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#397267] sm:w-auto"
        >
          Nazad na početnu
        </Link>
      </div>
    );
  }

  if (remainingSeconds === 0) {
    return (
      <div className="mt-8 rounded-3xl border border-[#397267]/12 bg-white/80 p-6 text-center shadow-[0_14px_38px_rgba(36,60,56,0.07)] sm:p-8">
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#243c38] sm:text-3xl">
          Ponuda je istekla.
        </h2>
        <p className="mt-4 text-base leading-7 text-[#526b66]">
          Ovaj termin više nije rezervisan i može biti ponuđen drugoj osobi sa
          liste čekanja.
        </p>
        <div
          aria-disabled="true"
          className="mt-7 inline-flex min-h-13 w-full cursor-not-allowed items-center justify-center rounded-full bg-[#dfe8e5] px-7 py-3.5 text-sm font-semibold text-[#6b807c] sm:w-auto sm:text-base"
        >
          Ponuda više nije aktivna
        </div>
      </div>
    );
  }

  const formattedCountdown =
    remainingSeconds === null ? "--:--" : formatCountdown(remainingSeconds);

  return (
    <>
      <div className="mt-8 grid gap-4 rounded-3xl border border-[#397267]/12 bg-white/80 p-6 text-left shadow-[0_14px_38px_rgba(36,60,56,0.07)] sm:grid-cols-2 sm:p-8">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[#6b807c] uppercase">
            Usluga
          </p>
          <p className="mt-2 font-semibold text-[#243c38]">
            {offer.serviceName}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[#6b807c] uppercase">
            Terapeut
          </p>
          <p className="mt-2 font-semibold text-[#243c38]">
            {offer.therapistName}
          </p>
        </div>
        <div className="border-t border-[#397267]/10 pt-4 sm:border-t-0">
          <p className="text-xs font-semibold tracking-[0.12em] text-[#6b807c] uppercase">
            Datum
          </p>
          <p className="mt-2 font-semibold text-[#243c38]">
            {offer.formattedDate}
          </p>
        </div>
        <div className="border-t border-[#397267]/10 pt-4 sm:border-t-0">
          <p className="text-xs font-semibold tracking-[0.12em] text-[#6b807c] uppercase">
            Vreme
          </p>
          <p className="mt-2 font-semibold text-[#243c38]">
            {offer.formattedStartTime}–{offer.formattedEndTime}
          </p>
        </div>
        <div className="border-t border-[#397267]/10 pt-4 sm:col-span-2">
          <p className="text-xs font-semibold tracking-[0.12em] text-[#6b807c] uppercase">
            Ponuda važi do
          </p>
          <p className="mt-2 font-semibold text-[#243c38]">
            {offer.formattedExpiration}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-[#397267]/15 bg-[#edf7f1] p-6 text-center sm:p-8">
        <p className="text-sm font-semibold tracking-[0.08em] text-[#397267] uppercase">
          Ponuda ističe za
        </p>
        <p
          role="timer"
          aria-label={`Ponuda ističe za ${formattedCountdown}`}
          className="mt-3 text-4xl font-semibold tabular-nums tracking-[-0.03em] text-[#243c38]"
        >
          {formattedCountdown}
        </p>
      </div>

      <div className="mt-6 rounded-3xl border border-[#397267]/12 bg-white/70 p-6 text-center shadow-[0_12px_35px_rgba(36,60,56,0.04)] sm:p-8">
        {acceptanceError && (
          <p
            role="alert"
            className="mb-5 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-5 py-4 text-sm font-medium leading-6 text-[#8f4033]"
          >
            {acceptanceError}
          </p>
        )}
        <button
          type="button"
          onClick={handleAcceptance}
          disabled={
            isAccepting ||
            remainingSeconds === null ||
            remainingSeconds <= 0
          }
          aria-busy={isAccepting}
          className="inline-flex min-h-13 w-full cursor-pointer items-center justify-center rounded-full bg-[#397267] px-8 py-3.5 text-base font-semibold text-white shadow-[0_12px_30px_rgba(57,114,103,0.22)] transition hover:bg-[#2f6158] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#397267] disabled:cursor-wait disabled:opacity-65 sm:w-auto"
        >
          {isAccepting ? "Rezervišem termin..." : "Prihvati termin"}
        </button>
      </div>

      <Link
        href="/"
        className="mt-8 inline-flex min-h-13 w-full items-center justify-center rounded-full border border-[#397267]/20 bg-white/80 px-8 py-3.5 text-base font-semibold text-[#397267] transition hover:border-[#397267]/35 hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#397267] sm:w-auto"
      >
        Nazad na početnu
      </Link>
    </>
  );
}
