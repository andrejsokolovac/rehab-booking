"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

function getStaffDestination(profile: unknown): "/therapist" | "/admin" | null {
  if (!profile || typeof profile !== "object") {
    return null;
  }

  const row = profile as Record<string, unknown>;

  if (row.role === "admin") {
    return "/admin";
  }

  const therapistId = row.therapist_id;
  const therapistIdIsValid =
    (typeof therapistId === "number" &&
      Number.isSafeInteger(therapistId) &&
      therapistId > 0) ||
    (typeof therapistId === "string" && /^[1-9]\d*$/.test(therapistId));

  return row.role === "therapist" && therapistIdIsValid
    ? "/therapist"
    : null;
}

async function signOutWithoutThrowing() {
  try {
    await supabase.auth.signOut();
  } catch {
    // The authentication error shown to the user remains generic.
  }
}

export default function StaffLoginPage() {
  const router = useRouter();
  const submissionInProgress = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submissionInProgress.current) {
      return;
    }

    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      setFormError("Unesite email i lozinku.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setFormError("Unesite ispravnu email adresu.");
      return;
    }

    submissionInProgress.current = true;
    setIsSubmitting(true);
    setFormError(undefined);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (signInError) {
        setFormError(
          signInError.code === "invalid_credentials"
            ? "Email ili lozinka nisu ispravni."
            : "Prijava trenutno nije moguća. Pokušajte ponovo kasnije.",
        );
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        await signOutWithoutThrowing();
        setFormError("Pristup trenutno nije moguće potvrditi.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("staff_profiles")
        .select("role, therapist_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const staffDestination = getStaffDestination(profile);

      if (profileError || !staffDestination) {
        await signOutWithoutThrowing();
        setFormError("Nalog nema pristup panelu za zaposlene.");
        return;
      }

      router.replace(staffDestination);
      router.refresh();
    } catch {
      await signOutWithoutThrowing();
      setFormError("Došlo je do neočekivane greške. Pokušajte ponovo.");
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
              className="grid h-10 w-10 place-items-center rounded-2xl bg-[#397267] text-lg font-semibold text-white shadow-sm"
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
        <section className="mx-auto w-full max-w-lg px-6 py-16 sm:px-8 sm:py-24">
          <div className="text-center">
            <p className="mb-4 text-sm font-semibold tracking-[0.12em] text-[#397267] uppercase">
              Pristup za zaposlene
            </p>
            <h1 className="text-4xl leading-tight font-semibold tracking-[-0.035em] text-[#243c38] sm:text-5xl">
              Prijava
            </h1>
            <p className="mt-4 text-base leading-7 text-[#526b66]">
              Unesite podatke svog naloga za pristup panelu za zaposlene.
            </p>
          </div>

          <form
            noValidate
            onSubmit={handleSubmit}
            className="mt-8 rounded-3xl border border-[#397267]/12 bg-white/80 p-6 shadow-[0_14px_38px_rgba(36,60,56,0.07)] sm:p-8"
          >
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-[#243c38]"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 min-h-13 w-full rounded-2xl border border-[#397267]/18 bg-[#fffdf9] px-4 py-3 text-base text-[#243c38] outline-none transition focus:border-[#397267]/45 focus:ring-3 focus:ring-[#397267]/12"
              />
            </div>

            <div className="mt-5">
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-[#243c38]"
              >
                Lozinka
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 min-h-13 w-full rounded-2xl border border-[#397267]/18 bg-[#fffdf9] px-4 py-3 text-base text-[#243c38] outline-none transition focus:border-[#397267]/45 focus:ring-3 focus:ring-[#397267]/12"
              />
            </div>

            {formError && (
              <div
                role="alert"
                className="mt-5 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-5 py-4 text-sm font-medium leading-6 text-[#8f4033]"
              >
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="mt-7 inline-flex min-h-13 w-full cursor-pointer items-center justify-center rounded-full bg-[#397267] px-8 py-3.5 text-base font-semibold text-white shadow-[0_12px_30px_rgba(57,114,103,0.22)] transition hover:bg-[#2f6158] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#397267] disabled:cursor-wait disabled:opacity-65"
            >
              {isSubmitting ? "Prijavljivanje..." : "Prijavi se"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
