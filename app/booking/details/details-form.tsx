"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type TherapistCandidate = {
  id: number;
  name: string;
  slug: string;
};

type BookingParameters = {
  serviceId: number;
  serviceName: string;
  serviceSlug: string;
  therapistCandidates: TherapistCandidate[];
  date: string;
  formattedDate: string;
  time: string;
  startAt: string;
};

type DetailsFormProps = {
  booking: BookingParameters;
};

type FieldName = "parentName" | "childName" | "email" | "phone";

type FormValues = Record<FieldName, string>;

type CreatedAppointmentResult = {
  appointmentId: string;
  cancelToken: string;
};

const fields: Array<{
  name: FieldName;
  label: string;
  type: "text" | "email" | "tel";
  autoComplete: string;
}> = [
  {
    name: "parentName",
    label: "Ime i prezime roditelja",
    type: "text",
    autoComplete: "name",
  },
  {
    name: "childName",
    label: "Ime i prezime deteta",
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

const initialValues: FormValues = {
  parentName: "",
  childName: "",
  email: "",
  phone: "",
};

const BOOKING_CONFLICT_ERROR = "Termin je u međuvremenu rezervisan.";
const BOOKING_CONFLICT_MESSAGE =
  "Termin je u međuvremenu rezervisan. Izaberite drugi termin.";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getCreatedAppointmentResult(
  data: unknown,
): CreatedAppointmentResult | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const row = data as Record<string, unknown>;
  const appointmentId = row.appointment_id;
  const cancelToken = row.cancel_token;
  const appointmentIdIsValid =
    (typeof appointmentId === "number" &&
      Number.isInteger(appointmentId) &&
      appointmentId > 0) ||
    (typeof appointmentId === "string" && /^[1-9]\d*$/.test(appointmentId));

  if (
    !appointmentIdIsValid ||
    typeof cancelToken !== "string" ||
    !UUID_PATTERN.test(cancelToken)
  ) {
    return null;
  }

  return {
    appointmentId: String(appointmentId),
    cancelToken,
  };
}

function getFieldError(name: FieldName, value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    const requiredMessages: Record<FieldName, string> = {
      parentName: "Unesite ime i prezime roditelja.",
      childName: "Unesite ime i prezime deteta.",
      email: "Unesite email adresu.",
      phone: "Unesite broj telefona.",
    };

    return requiredMessages[name];
  }

  if (name === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)) {
    return "Unesite ispravnu email adresu.";
  }

  return undefined;
}

async function sendBookingConfirmationEmail({
  email,
  serviceName,
  therapistName,
  date,
  time,
  cancelToken,
}: {
  email: string;
  serviceName: string;
  therapistName: string;
  date: string;
  time: string;
  cancelToken: string;
}) {
  try {
    const response = await fetch("/api/send-booking-confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        serviceName,
        therapistName,
        date,
        time,
        cancelToken,
      }),
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

export default function DetailsForm({ booking }: DetailsFormProps) {
  const router = useRouter();
  const submissionInProgress = useRef(false);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [submitError, setSubmitError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  function finishSubmitting() {
    submissionInProgress.current = false;
    setIsSubmitting(false);
    setIsSendingEmail(false);
  }

  function setFieldError(name: FieldName, value: string) {
    const error = getFieldError(name, value);

    setErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };

      if (error) {
        nextErrors[name] = error;
      } else {
        delete nextErrors[name];
      }

      return nextErrors;
    });
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const name = event.target.name as FieldName;
    const value = event.target.value;

    setValues((currentValues) => ({ ...currentValues, [name]: value }));

    if (errors[name]) {
      setFieldError(name, value);
    }
  }

  function handleBlur(event: ChangeEvent<HTMLInputElement>) {
    setFieldError(event.target.name as FieldName, event.target.value);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submissionInProgress.current) {
      return;
    }

    const nextErrors: Partial<Record<FieldName, string>> = {};

    fields.forEach((field) => {
      const error = getFieldError(field.name, values[field.name]);

      if (error) {
        nextErrors[field.name] = error;
      }
    });

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitError(undefined);
    submissionInProgress.current = true;
    setIsSubmitting(true);

    try {
      let bookingConflictOccurred = false;

      for (const therapist of booking.therapistCandidates) {
        const { data, error } = await supabase
          .rpc("create_appointment", {
            p_therapist_id: therapist.id,
            p_service_id: booking.serviceId,
            p_start_at: booking.startAt,
            p_parent_name: values.parentName.trim(),
            p_child_name: values.childName.trim(),
            p_email: values.email.trim(),
            p_phone: values.phone.trim(),
          })
          .single();
        const createdAppointment = getCreatedAppointmentResult(data);

        if (!error && createdAppointment) {
          setIsSendingEmail(true);
          const emailWasSent = await sendBookingConfirmationEmail({
            email: values.email.trim(),
            serviceName: booking.serviceName,
            therapistName: therapist.name,
            date: booking.formattedDate,
            time: booking.time,
            cancelToken: createdAppointment.cancelToken,
          });
          const confirmationParams = new URLSearchParams({
            service: booking.serviceSlug,
            therapist: therapist.slug,
            date: booking.date,
            time: booking.time,
            notification: emailWasSent ? "sent" : "failed",
          });

          router.push(
            `/booking/confirmation?${confirmationParams.toString()}`,
          );
          return;
        }

        if (!error) {
          setSubmitError(
            "Termin je kreiran, ali potvrdu trenutno nije moguće prikazati. Kontaktirajte centar pre ponovnog pokušaja.",
          );
          finishSubmitting();
          return;
        }

        if (error.message.includes(BOOKING_CONFLICT_ERROR)) {
          bookingConflictOccurred = true;
          continue;
        }

        setSubmitError(
          "Termin trenutno nije moguće zakazati. Pokušajte ponovo kasnije.",
        );
        finishSubmitting();
        return;
      }

      setSubmitError(
        bookingConflictOccurred
          ? BOOKING_CONFLICT_MESSAGE
          : "Za izabrani termin nema slobodnog terapeuta. Izaberite drugi termin.",
      );
    } catch {
      setSubmitError(
        "Termin trenutno nije moguće zakazati. Pokušajte ponovo kasnije.",
      );
    }

    finishSubmitting();
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="mt-8 rounded-3xl border border-[#397267]/12 bg-white/80 p-6 shadow-[0_14px_38px_rgba(36,60,56,0.07)] sm:p-8"
    >
      <div className="grid gap-6 sm:grid-cols-2">
        {fields.map((field) => {
          const error = errors[field.name];
          const errorId = `${field.name}-error`;

          return (
            <div key={field.name}>
              <label
                htmlFor={field.name}
                className="block text-sm font-semibold text-[#243c38]"
              >
                {field.label}
                <span className="ml-1 text-[#b45745]" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id={field.name}
                name={field.name}
                type={field.type}
                autoComplete={field.autoComplete}
                required
                value={values[field.name]}
                onChange={handleChange}
                onBlur={handleBlur}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                className={`mt-2 min-h-13 w-full rounded-2xl border bg-[#fffdf9] px-4 py-3 text-base text-[#243c38] outline-none transition placeholder:text-[#8a9996] focus:ring-3 ${
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

      {submitError && (
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-5 py-4 text-sm font-medium leading-6 text-[#8f4033]"
        >
          {submitError}
        </div>
      )}

      <div className="mt-8 flex flex-col gap-5 border-t border-[#397267]/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-sm leading-6 text-[#6b807c]">
          Sva polja su obavezna. Podaci se koriste samo za zakazivanje ovog
          termina.
        </p>
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="inline-flex min-h-13 w-full cursor-pointer items-center justify-center rounded-full bg-[#397267] px-8 py-3.5 text-base font-semibold text-white shadow-[0_12px_30px_rgba(57,114,103,0.22)] transition hover:bg-[#2f6158] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#397267] disabled:cursor-wait disabled:opacity-65 sm:w-auto"
        >
          {isSendingEmail
            ? "Slanje potvrde..."
            : isSubmitting
              ? "Zakazivanje..."
              : "Potvrdi termin"}
        </button>
      </div>
    </form>
  );
}
