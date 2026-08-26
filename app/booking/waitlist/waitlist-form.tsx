"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";

import { supabase } from "@/lib/supabase";

type WaitlistSelection = {
  serviceId: number;
  therapistId: number | null;
};

type WaitlistFormProps = {
  selection: WaitlistSelection;
  today: string;
  defaultValidUntil: string;
};

type FormValues = {
  parentName: string;
  childName: string;
  email: string;
  phone: string;
  preferredStartTime: string;
  preferredEndTime: string;
  validFrom: string;
  validUntil: string;
};

type FieldName = keyof FormValues;
type ErrorName = FieldName | "preferredDays";

type WaitlistCreationResult = {
  waitlistId: number | string;
  waitlistToken: string;
};

const WEEKDAYS = [
  { value: 1, label: "Ponedeljak" },
  { value: 2, label: "Utorak" },
  { value: 3, label: "Sreda" },
  { value: 4, label: "Četvrtak" },
  { value: 5, label: "Petak" },
];

const PERSONAL_FIELDS: Array<{
  name: "parentName" | "childName" | "email" | "phone";
  label: string;
  type: "text" | "email" | "tel";
  autoComplete: string;
}> = [
  {
    name: "parentName",
    label: "Ime roditelja",
    type: "text",
    autoComplete: "name",
  },
  {
    name: "childName",
    label: "Ime deteta",
    type: "text",
    autoComplete: "off",
  },
  {
    name: "email",
    label: "Email",
    type: "email",
    autoComplete: "email",
  },
  {
    name: "phone",
    label: "Telefon",
    type: "tel",
    autoComplete: "tel",
  },
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseTime(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})$/);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
}

function isValidCalendarDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function getPersonalFieldError(
  field: "parentName" | "childName" | "email" | "phone",
  value: string,
) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    const requiredMessages = {
      parentName: "Unesite ime roditelja.",
      childName: "Unesite ime deteta.",
      email: "Unesite email adresu.",
      phone: "Unesite broj telefona.",
    };

    return requiredMessages[field];
  }

  if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)) {
    return "Unesite ispravnu email adresu.";
  }

  if (
    field === "phone" &&
    !/^\+?[0-9][0-9\s()./-]{5,}$/.test(trimmedValue)
  ) {
    return "Unesite ispravan broj telefona.";
  }

  return undefined;
}

function getWaitlistResult(data: unknown): WaitlistCreationResult | null {
  const value = Array.isArray(data) ? data[0] : data;

  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const waitlistId = row.waitlist_id;
  const waitlistToken = row.waitlist_token;
  const idIsValid =
    (typeof waitlistId === "number" &&
      Number.isSafeInteger(waitlistId) &&
      waitlistId > 0) ||
    (typeof waitlistId === "string" && /^[1-9]\d*$/.test(waitlistId));

  if (
    !idIsValid ||
    typeof waitlistToken !== "string" ||
    !UUID_PATTERN.test(waitlistToken)
  ) {
    return null;
  }

  return { waitlistId, waitlistToken } as WaitlistCreationResult;
}

async function sendWaitlistRegistrationConfirmation(
  result: WaitlistCreationResult,
) {
  try {
    await fetch("/api/send-waitlist-registration-confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });
  } catch {
    // Registration already succeeded, so email delivery is non-blocking.
  }
}

export default function WaitlistForm({
  selection,
  today,
  defaultValidUntil,
}: WaitlistFormProps) {
  const submissionInProgress = useRef(false);
  const [values, setValues] = useState<FormValues>({
    parentName: "",
    childName: "",
    email: "",
    phone: "",
    preferredStartTime: "08:00",
    preferredEndTime: "12:00",
    validFrom: today,
    validUntil: defaultValidUntil,
  });
  const [preferredDays, setPreferredDays] = useState<number[]>([]);
  const [errors, setErrors] = useState<
    Partial<Record<ErrorName, string>>
  >({});
  const [submitError, setSubmitError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  function clearErrors(...fields: ErrorName[]) {
    setErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };

      fields.forEach((field) => delete nextErrors[field]);

      return nextErrors;
    });
    setSubmitError(undefined);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const field = event.target.name as FieldName;
    const value = event.target.value;

    setValues((currentValues) => ({ ...currentValues, [field]: value }));

    if (field === "preferredStartTime" || field === "preferredEndTime") {
      clearErrors("preferredStartTime", "preferredEndTime");
    } else if (field === "validFrom" || field === "validUntil") {
      clearErrors("validFrom", "validUntil");
    } else {
      clearErrors(field);
    }
  }

  function handlePersonalBlur(event: ChangeEvent<HTMLInputElement>) {
    const field = event.target.name as
      | "parentName"
      | "childName"
      | "email"
      | "phone";
    const error = getPersonalFieldError(field, event.target.value);

    setErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };

      if (error) {
        nextErrors[field] = error;
      } else {
        delete nextErrors[field];
      }

      return nextErrors;
    });
  }

  function togglePreferredDay(day: number) {
    setPreferredDays((currentDays) =>
      currentDays.includes(day)
        ? currentDays.filter((currentDay) => currentDay !== day)
        : [...currentDays, day].sort((first, second) => first - second),
    );
    clearErrors("preferredDays");
  }

  function validateForm() {
    const nextErrors: Partial<Record<ErrorName, string>> = {};

    PERSONAL_FIELDS.forEach((field) => {
      const error = getPersonalFieldError(field.name, values[field.name]);

      if (error) {
        nextErrors[field.name] = error;
      }
    });

    if (preferredDays.length === 0) {
      nextErrors.preferredDays = "Izaberite najmanje jedan dan.";
    }

    const startMinutes = parseTime(values.preferredStartTime);
    const endMinutes = parseTime(values.preferredEndTime);

    if (startMinutes === null) {
      nextErrors.preferredStartTime = "Izaberite ispravno početno vreme.";
    }

    if (endMinutes === null) {
      nextErrors.preferredEndTime = "Izaberite ispravno završno vreme.";
    } else if (startMinutes !== null && endMinutes <= startMinutes) {
      nextErrors.preferredEndTime =
        "Završno vreme mora biti posle početnog vremena.";
    }

    const validFromIsValid = isValidCalendarDate(values.validFrom);
    const validUntilIsValid = isValidCalendarDate(values.validUntil);

    if (!validFromIsValid) {
      nextErrors.validFrom = "Izaberite ispravan početni datum.";
    }

    if (!validUntilIsValid) {
      nextErrors.validUntil = "Izaberite ispravan završni datum.";
    } else if (validFromIsValid && values.validUntil < values.validFrom) {
      nextErrors.validUntil = "Završni datum ne može biti pre početnog.";
    } else if (values.validUntil < today) {
      nextErrors.validUntil = "Izabrani period ne može biti u prošlosti.";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submissionInProgress.current || !validateForm()) {
      return;
    }

    submissionInProgress.current = true;
    setIsSubmitting(true);
    setSubmitError(undefined);

    try {
      const { data, error } = await supabase
        .rpc("create_waitlist_entry", {
          p_service_id: selection.serviceId,
          p_therapist_id: selection.therapistId,
          p_parent_name: values.parentName.trim(),
          p_child_name: values.childName.trim(),
          p_email: values.email.trim(),
          p_phone: values.phone.trim(),
          p_preferred_days: preferredDays,
          p_preferred_start_time: values.preferredStartTime,
          p_preferred_end_time: values.preferredEndTime,
          p_valid_from: values.validFrom,
          p_valid_until: values.validUntil,
        })
        .single();

      const waitlistResult = getWaitlistResult(data);

      if (error || !waitlistResult) {
        setSubmitError(
          "Prijavu trenutno nije moguće sačuvati. Pokušajte ponovo kasnije.",
        );
        return;
      }

      await sendWaitlistRegistrationConfirmation(waitlistResult);
      setIsSuccess(true);
    } catch {
      setSubmitError(
        "Došlo je do neočekivane greške. Pokušajte ponovo kasnije.",
      );
    } finally {
      submissionInProgress.current = false;
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
    return (
      <div
        role="status"
        className="mt-8 rounded-3xl border border-[#397267]/18 bg-[#edf7f1] p-7 text-center shadow-[0_14px_38px_rgba(36,60,56,0.07)] sm:p-10"
      >
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#397267] text-2xl text-white">
          <span aria-hidden="true">✓</span>
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-[-0.025em] text-[#243c38] sm:text-3xl">
          Uspešno ste prijavljeni na listu čekanja.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#526b66] sm:text-base">
          Kontaktiraćemo vas ako se pojavi slobodan termin koji odgovara
          izabranim danima, vremenu i periodu važenja prijave.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-[#397267] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#2f6158] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#397267]"
        >
          Nazad na početnu
        </Link>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="mt-8 rounded-3xl border border-[#397267]/12 bg-white/80 p-6 shadow-[0_14px_38px_rgba(36,60,56,0.07)] sm:p-8"
    >
      <div className="grid gap-6 sm:grid-cols-2">
        {PERSONAL_FIELDS.map((field) => {
          const error = errors[field.name];
          const errorId = `waitlist-${field.name}-error`;

          return (
            <div key={field.name}>
              <label
                htmlFor={`waitlist-${field.name}`}
                className="block text-sm font-semibold text-[#243c38]"
              >
                {field.label}
                <span className="ml-1 text-[#b45745]" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id={`waitlist-${field.name}`}
                name={field.name}
                type={field.type}
                autoComplete={field.autoComplete}
                required
                value={values[field.name]}
                onChange={handleChange}
                onBlur={handlePersonalBlur}
                disabled={isSubmitting}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                className={`mt-2 min-h-13 w-full rounded-2xl border bg-[#fffdf9] px-4 py-3 text-base text-[#243c38] outline-none transition focus:ring-3 disabled:cursor-wait disabled:opacity-60 ${
                  error
                    ? "border-[#b45745] focus:border-[#b45745] focus:ring-[#b45745]/15"
                    : "border-[#397267]/18 focus:border-[#397267]/45 focus:ring-[#397267]/12"
                }`}
              />
              {error && (
                <p
                  id={errorId}
                  role="alert"
                  className="mt-2 text-sm font-medium text-[#a34838]"
                >
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <fieldset className="mt-8 border-t border-[#397267]/10 pt-7">
        <legend className="text-sm font-semibold text-[#243c38]">
          Dani koji vam odgovaraju
          <span className="ml-1 text-[#b45745]" aria-hidden="true">
            *
          </span>
        </legend>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {WEEKDAYS.map((day) => {
            const isSelected = preferredDays.includes(day.value);

            return (
              <label
                key={day.value}
                className={`flex min-h-12 cursor-pointer items-center justify-center rounded-2xl border px-3 py-2 text-center text-sm font-semibold transition ${
                  isSelected
                    ? "border-[#397267] bg-[#397267] text-white"
                    : "border-[#397267]/15 bg-[#fffdf9] text-[#526b66] hover:border-[#397267]/35"
                }`}
              >
                <input
                  type="checkbox"
                  value={day.value}
                  checked={isSelected}
                  onChange={() => togglePreferredDay(day.value)}
                  disabled={isSubmitting}
                  className="sr-only"
                />
                {day.label}
              </label>
            );
          })}
        </div>
        {errors.preferredDays && (
          <p role="alert" className="mt-3 text-sm font-medium text-[#a34838]">
            {errors.preferredDays}
          </p>
        )}
      </fieldset>

      <div className="mt-8 grid gap-6 border-t border-[#397267]/10 pt-7 sm:grid-cols-2">
        <div>
          <label
            htmlFor="waitlist-preferred-start-time"
            className="block text-sm font-semibold text-[#243c38]"
          >
            Od vremena <span className="text-[#b45745]">*</span>
          </label>
          <input
            id="waitlist-preferred-start-time"
            name="preferredStartTime"
            type="time"
            required
            value={values.preferredStartTime}
            onChange={handleChange}
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.preferredStartTime)}
            className="mt-2 min-h-13 w-full rounded-2xl border border-[#397267]/18 bg-[#fffdf9] px-4 py-3 text-base text-[#243c38] outline-none transition focus:border-[#397267]/45 focus:ring-3 focus:ring-[#397267]/12 disabled:cursor-wait disabled:opacity-60"
          />
          {errors.preferredStartTime && (
            <p role="alert" className="mt-2 text-sm font-medium text-[#a34838]">
              {errors.preferredStartTime}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="waitlist-preferred-end-time"
            className="block text-sm font-semibold text-[#243c38]"
          >
            Do vremena <span className="text-[#b45745]">*</span>
          </label>
          <input
            id="waitlist-preferred-end-time"
            name="preferredEndTime"
            type="time"
            required
            value={values.preferredEndTime}
            onChange={handleChange}
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.preferredEndTime)}
            className="mt-2 min-h-13 w-full rounded-2xl border border-[#397267]/18 bg-[#fffdf9] px-4 py-3 text-base text-[#243c38] outline-none transition focus:border-[#397267]/45 focus:ring-3 focus:ring-[#397267]/12 disabled:cursor-wait disabled:opacity-60"
          />
          {errors.preferredEndTime && (
            <p role="alert" className="mt-2 text-sm font-medium text-[#a34838]">
              {errors.preferredEndTime}
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 border-t border-[#397267]/10 pt-7 sm:grid-cols-2">
        <div>
          <label
            htmlFor="waitlist-valid-from"
            className="block text-sm font-semibold text-[#243c38]"
          >
            Važi od <span className="text-[#b45745]">*</span>
          </label>
          <input
            id="waitlist-valid-from"
            name="validFrom"
            type="date"
            required
            value={values.validFrom}
            onChange={handleChange}
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.validFrom)}
            className="mt-2 min-h-13 w-full rounded-2xl border border-[#397267]/18 bg-[#fffdf9] px-4 py-3 text-base text-[#243c38] outline-none transition focus:border-[#397267]/45 focus:ring-3 focus:ring-[#397267]/12 disabled:cursor-wait disabled:opacity-60"
          />
          {errors.validFrom && (
            <p role="alert" className="mt-2 text-sm font-medium text-[#a34838]">
              {errors.validFrom}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="waitlist-valid-until"
            className="block text-sm font-semibold text-[#243c38]"
          >
            Važi do <span className="text-[#b45745]">*</span>
          </label>
          <input
            id="waitlist-valid-until"
            name="validUntil"
            type="date"
            required
            min={values.validFrom > today ? values.validFrom : today}
            value={values.validUntil}
            onChange={handleChange}
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.validUntil)}
            className="mt-2 min-h-13 w-full rounded-2xl border border-[#397267]/18 bg-[#fffdf9] px-4 py-3 text-base text-[#243c38] outline-none transition focus:border-[#397267]/45 focus:ring-3 focus:ring-[#397267]/12 disabled:cursor-wait disabled:opacity-60"
          />
          {errors.validUntil && (
            <p role="alert" className="mt-2 text-sm font-medium text-[#a34838]">
              {errors.validUntil}
            </p>
          )}
        </div>
      </div>

      {submitError && (
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-5 py-4 text-sm font-medium leading-6 text-[#8f4033]"
        >
          {submitError}
        </div>
      )}

      <div className="mt-8 flex flex-col gap-5 border-t border-[#397267]/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm leading-6 text-[#6b807c]">
          Podaci se koriste samo za prijavu na listu čekanja i kontaktiranje u
          vezi sa odgovarajućim terminom.
        </p>
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="inline-flex min-h-13 w-full cursor-pointer items-center justify-center rounded-full bg-[#397267] px-8 py-3.5 text-base font-semibold text-white shadow-[0_12px_30px_rgba(57,114,103,0.22)] transition hover:bg-[#2f6158] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#397267] disabled:cursor-wait disabled:opacity-65 sm:w-auto"
        >
          {isSubmitting ? "Prijavljivanje..." : "Prijavi me na listu čekanja"}
        </button>
      </div>
    </form>
  );
}
