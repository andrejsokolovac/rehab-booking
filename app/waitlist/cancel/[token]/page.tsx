"use client";

import Link from "next/link";
import { use, useRef, useState } from "react";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CancellationPageProps = {
  params: Promise<{
    token: string;
  }>;
};

type CancellationState = "confirmation" | "success" | "unavailable";

function cancellationSucceeded(data: unknown) {
  if (!data || typeof data !== "object") {
    return false;
  }

  const result = data as Record<string, unknown>;

  return result.success === true && result.cancelled === true;
}

export default function WaitlistCancellationPage({
  params,
}: CancellationPageProps) {
  const { token } = use(params);
  const tokenIsValid = UUID_PATTERN.test(token);
  const submissionInProgress = useRef(false);
  const [cancellationState, setCancellationState] =
    useState<CancellationState>("confirmation");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string>();
  const cancellationIsUnavailable =
    !tokenIsValid || cancellationState === "unavailable";

  async function handleCancellation() {
    if (
      submissionInProgress.current ||
      isSubmitting ||
      !tokenIsValid ||
      cancellationState !== "confirmation"
    ) {
      return;
    }

    submissionInProgress.current = true;
    setIsSubmitting(true);
    setRequestError(undefined);

    try {
      const response = await fetch("/api/cancel-waitlist-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waitlistToken: token }),
      });
      let result: unknown;

      try {
        result = await response.json();
      } catch {
        setRequestError(
          "Zahtev trenutno nije moguće obraditi. Pokušajte ponovo.",
        );
        return;
      }

      if (response.ok && cancellationSucceeded(result)) {
        setCancellationState("success");
        return;
      }

      if (response.status >= 500) {
        setRequestError(
          "Zahtev trenutno nije moguće obraditi. Pokušajte ponovo.",
        );
        return;
      }

      setCancellationState("unavailable");
    } catch {
      setRequestError(
        "Zahtev trenutno nije moguće obraditi. Proverite vezu i pokušajte ponovo.",
      );
    } finally {
      submissionInProgress.current = false;
      setIsSubmitting(false);
    }
  }

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
        <section className="mx-auto w-full max-w-2xl px-6 py-16 text-center sm:px-8 sm:py-24 lg:px-10">
          <p className="text-sm font-semibold tracking-[0.12em] text-[#397267] uppercase">
            Lista čekanja
          </p>

          {cancellationState === "success" ? (
            <div className="mt-5 rounded-3xl border border-[#397267]/15 bg-white/80 p-6 shadow-[0_14px_38px_rgba(36,60,56,0.07)] sm:p-9">
              <span
                aria-hidden="true"
                className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#397267] text-3xl font-semibold text-white shadow-[0_12px_30px_rgba(57,114,103,0.22)]"
              >
                ✓
              </span>
              <h1 className="mt-6 text-3xl leading-tight font-semibold tracking-[-0.03em] text-[#243c38] sm:text-4xl">
                Uspešno ste odustali od liste čekanja.
              </h1>
              <p className="mt-4 text-base leading-7 text-[#526b66]">
                Više nećete dobijati ponude za slobodne termine iz ove prijave.
              </p>
              <Link
                href="/"
                className="mt-8 inline-flex min-h-13 w-full items-center justify-center rounded-full bg-[#397267] px-8 py-3.5 text-base font-semibold text-white shadow-[0_12px_30px_rgba(57,114,103,0.22)] transition hover:bg-[#2f6158] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#397267] sm:w-auto"
              >
                Početna stranica
              </Link>
            </div>
          ) : cancellationIsUnavailable ? (
            <div className="mt-5 rounded-3xl border border-[#397267]/12 bg-white/80 p-6 shadow-[0_14px_38px_rgba(36,60,56,0.07)] sm:p-9">
              <h1 className="text-3xl leading-tight font-semibold tracking-[-0.03em] text-[#243c38] sm:text-4xl">
                Prijava nije dostupna
              </h1>
              <p className="mt-4 text-base leading-7 text-[#526b66]">
                Ova prijava na listu čekanja više nije aktivna ili link nije
                važeći.
              </p>
              <Link
                href="/"
                className="mt-8 inline-flex min-h-13 w-full items-center justify-center rounded-full bg-[#397267] px-8 py-3.5 text-base font-semibold text-white shadow-[0_12px_30px_rgba(57,114,103,0.22)] transition hover:bg-[#2f6158] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#397267] sm:w-auto"
              >
                Početna stranica
              </Link>
            </div>
          ) : (
            <>
              <h1 className="mt-4 text-4xl leading-tight font-semibold tracking-[-0.035em] text-[#243c38] sm:text-5xl">
                Odustajanje od liste čekanja
              </h1>
              <div className="mt-8 rounded-3xl border border-[#b45745]/15 bg-white/80 p-6 shadow-[0_14px_38px_rgba(36,60,56,0.07)] sm:p-9">
                <h2 className="text-2xl leading-tight font-semibold tracking-[-0.02em] text-[#243c38] sm:text-3xl">
                  Da li ste sigurni da želite da odustanete od liste čekanja?
                </h2>
                <p className="mt-4 text-base leading-7 text-[#526b66]">
                  Nakon odustajanja više nećete dobijati ponude za slobodne
                  termine.
                </p>

                {requestError && (
                  <p
                    role="alert"
                    className="mt-5 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-5 py-4 text-sm font-medium leading-6 text-[#8f4033]"
                  >
                    {requestError}
                  </p>
                )}

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={handleCancellation}
                    disabled={isSubmitting}
                    aria-busy={isSubmitting}
                    className="inline-flex min-h-13 w-full cursor-pointer items-center justify-center rounded-full bg-[#b45745] px-8 py-3.5 text-base font-semibold text-white shadow-[0_12px_30px_rgba(180,87,69,0.2)] transition hover:bg-[#9e4939] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#b45745] disabled:cursor-wait disabled:opacity-65 sm:w-auto"
                  >
                    {isSubmitting
                      ? "Obrađujem zahtev..."
                      : requestError
                        ? "Pokušaj ponovo"
                        : "Odustani od liste čekanja"}
                  </button>
                  <Link
                    href="/booking"
                    className="inline-flex min-h-13 w-full items-center justify-center rounded-full border border-[#397267]/20 bg-white px-8 py-3.5 text-base font-semibold text-[#397267] transition hover:border-[#397267]/35 hover:bg-[#f8fbfa] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#397267] sm:w-auto"
                  >
                    Ne odustajem
                  </Link>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
