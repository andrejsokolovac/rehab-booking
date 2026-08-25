"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";

import { supabase } from "@/lib/supabase";

const BELGRADE_TIME_ZONE = "Europe/Belgrade";

type DatabaseId = number | string;

type TherapistOption = {
  id: DatabaseId;
  name: string;
};

type UnavailabilityValues = {
  therapistId: string;
  startDate: string;
  endDate: string;
  fullWorkingDays: boolean;
  startTime: string;
  endTime: string;
  reason: string;
};

type FieldName =
  | "therapistId"
  | "startDate"
  | "endDate"
  | "startTime"
  | "endTime";

type WorkingHour = {
  startMinutes: number;
  endMinutes: number;
};

type UnavailabilityConflict = {
  childName: string;
  date: string;
  startTime: string;
  endTime: string;
};

type ConflictRpcParameters = {
  p_therapist_id: DatabaseId;
  p_start_date: string;
  p_end_date: string;
  p_full_working_days: boolean;
  p_start_time: string | null;
  p_end_time: string | null;
};

type TherapistUnavailabilityModalProps = {
  therapists: TherapistOption[];
  onClose: () => void;
  onCreated: () => void;
};

const initialValues: UnavailabilityValues = {
  therapistId: "",
  startDate: "",
  endDate: "",
  fullWorkingDays: true,
  startTime: "",
  endTime: "",
  reason: "",
};

const belgradeCalendarDateFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: BELGRADE_TIME_ZONE,
});

const conflictDateFormatter = new Intl.DateTimeFormat("sr-Latn-RS", {
  weekday: "short",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: BELGRADE_TIME_ZONE,
});

const conflictTimeFormatter = new Intl.DateTimeFormat("sr-Latn-RS", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: BELGRADE_TIME_ZONE,
});

function getFormatterParts(date: Date, formatter: Intl.DateTimeFormat) {
  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

function getCurrentBelgradeCalendarDate() {
  const parts = getFormatterParts(
    new Date(),
    belgradeCalendarDateFormatter,
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function parseCalendarDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, 12),
  );

  if (
    date.getUTCFullYear() !== parts.year ||
    date.getUTCMonth() !== parts.month - 1 ||
    date.getUTCDate() !== parts.day
  ) {
    return null;
  }

  return parts;
}

function getCalendarDayOfWeek(value: string) {
  const parts = parseCalendarDate(value);

  if (!parts) {
    return null;
  }

  const day = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, 12),
  ).getUTCDay();

  return day === 0 ? 7 : day;
}

function formatCalendarDate(value: string) {
  const parts = parseCalendarDate(value);

  if (!parts) {
    return null;
  }

  const safeInstant = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, 12),
  );
  const formatted = conflictDateFormatter.format(safeInstant);

  return (
    formatted.charAt(0).toLocaleUpperCase("sr-Latn-RS") + formatted.slice(1)
  );
}

function parseTime(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? 0);

  if (hours > 23 || minutes > 59 || seconds !== 0) {
    return null;
  }

  return hours * 60 + minutes;
}

function formatTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function idsMatch(first: DatabaseId, second: DatabaseId) {
  return String(first) === String(second);
}

function getNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getWorkingHours(data: unknown): WorkingHour[] | null {
  if (!Array.isArray(data)) {
    return null;
  }

  const workingHours: WorkingHour[] = [];

  for (const value of data) {
    if (!value || typeof value !== "object") {
      return null;
    }

    const row = value as Record<string, unknown>;
    const startMinutes = parseTime(row.start_time);
    const endMinutes = parseTime(row.end_time);

    if (
      startMinutes === null ||
      endMinutes === null ||
      endMinutes <= startMinutes
    ) {
      return null;
    }

    workingHours.push({ startMinutes, endMinutes });
  }

  return workingHours;
}

function getConflictFromInstants(
  row: Record<string, unknown>,
): UnavailabilityConflict | null {
  if (typeof row.start_at !== "string" || typeof row.end_at !== "string") {
    return null;
  }

  const start = new Date(row.start_at);
  const end = new Date(row.end_at);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    return null;
  }

  const formattedDate = conflictDateFormatter.format(start);

  return {
    childName: "",
    date:
      formattedDate.charAt(0).toLocaleUpperCase("sr-Latn-RS") +
      formattedDate.slice(1),
    startTime: conflictTimeFormatter.format(start),
    endTime: conflictTimeFormatter.format(end),
  };
}

function getConflictFromCalendarValues(
  row: Record<string, unknown>,
): UnavailabilityConflict | null {
  const dateValue =
    getNonEmptyString(row.appointment_date) ?? getNonEmptyString(row.date);
  const startMinutes = parseTime(row.start_time);
  const endMinutes = parseTime(row.end_time);
  const date = dateValue ? formatCalendarDate(dateValue) : null;

  if (
    !date ||
    startMinutes === null ||
    endMinutes === null ||
    endMinutes <= startMinutes
  ) {
    return null;
  }

  return {
    childName: "",
    date,
    startTime: formatTime(startMinutes),
    endTime: formatTime(endMinutes),
  };
}

function getUnavailabilityConflicts(
  data: unknown,
): UnavailabilityConflict[] | null {
  if (!Array.isArray(data)) {
    return null;
  }

  const conflicts: UnavailabilityConflict[] = [];

  for (const value of data) {
    if (!value || typeof value !== "object") {
      return null;
    }

    const row = value as Record<string, unknown>;
    const childName = getNonEmptyString(row.child_name);
    const conflict =
      getConflictFromInstants(row) ?? getConflictFromCalendarValues(row);

    if (!childName || !conflict) {
      return null;
    }

    conflicts.push({ ...conflict, childName });
  }

  return conflicts;
}

function isExistingUnavailabilityConflict(message: string) {
  const normalizedMessage = message.toLocaleLowerCase("sr-Latn-RS");

  return (
    normalizedMessage.includes("preklap") ||
    normalizedMessage.includes("overlap") ||
    normalizedMessage.includes("nedostup")
  );
}

export default function TherapistUnavailabilityModal({
  therapists,
  onClose,
  onCreated,
}: TherapistUnavailabilityModalProps) {
  const submissionInProgress = useRef(false);
  const [values, setValues] = useState<UnavailabilityValues>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [conflicts, setConflicts] = useState<UnavailabilityConflict[]>([]);
  const [submitError, setSubmitError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
  const today = getCurrentBelgradeCalendarDate();

  function clearFieldError(field: FieldName) {
    setErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  }

  function handleSelectChange(event: ChangeEvent<HTMLSelectElement>) {
    setValues((currentValues) => ({
      ...currentValues,
      therapistId: event.target.value,
    }));
    clearFieldError("therapistId");
    setConflicts([]);
    setSubmitError(undefined);
  }

  function handleStartDateChange(event: ChangeEvent<HTMLInputElement>) {
    const startDate = event.target.value;

    setValues((currentValues) => ({
      ...currentValues,
      startDate,
      endDate: currentValues.fullWorkingDays
        ? currentValues.endDate
        : startDate,
    }));
    clearFieldError("startDate");
    setConflicts([]);
    setSubmitError(undefined);
  }

  function handleEndDateChange(event: ChangeEvent<HTMLInputElement>) {
    setValues((currentValues) => ({
      ...currentValues,
      endDate: event.target.value,
    }));
    clearFieldError("endDate");
    setConflicts([]);
    setSubmitError(undefined);
  }

  function handleFullWorkingDaysChange(event: ChangeEvent<HTMLInputElement>) {
    const fullWorkingDays = event.target.checked;

    setValues((currentValues) => ({
      ...currentValues,
      fullWorkingDays,
      endDate: fullWorkingDays
        ? currentValues.endDate
        : currentValues.startDate,
      startTime: fullWorkingDays ? "" : currentValues.startTime,
      endTime: fullWorkingDays ? "" : currentValues.endTime,
    }));
    setErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors.endDate;
      delete nextErrors.startTime;
      delete nextErrors.endTime;
      return nextErrors;
    });
    setConflicts([]);
    setSubmitError(undefined);
  }

  function handleTimeChange(event: ChangeEvent<HTMLInputElement>) {
    const field = event.target.name as "startTime" | "endTime";

    setValues((currentValues) => ({
      ...currentValues,
      [field]: event.target.value,
    }));
    clearFieldError(field);
    setConflicts([]);
    setSubmitError(undefined);
  }

  function validateValues() {
    const nextErrors: Partial<Record<FieldName, string>> = {};
    const therapist = therapists.find((currentTherapist) =>
      idsMatch(currentTherapist.id, values.therapistId),
    );
    const startDateIsValid = Boolean(parseCalendarDate(values.startDate));
    const endDateIsValid = Boolean(parseCalendarDate(values.endDate));

    if (!therapist) {
      nextErrors.therapistId = "Izaberite terapeuta.";
    }

    if (!startDateIsValid) {
      nextErrors.startDate = "Izaberite ispravan početni datum.";
    } else if (values.startDate < today) {
      nextErrors.startDate = "Početni datum ne može biti u prošlosti.";
    }

    if (!endDateIsValid) {
      nextErrors.endDate = "Izaberite ispravan završni datum.";
    } else if (startDateIsValid && values.endDate < values.startDate) {
      nextErrors.endDate = "Završni datum ne može biti pre početnog.";
    }

    if (
      !values.fullWorkingDays &&
      startDateIsValid &&
      endDateIsValid &&
      values.startDate !== values.endDate
    ) {
      nextErrors.endDate =
        "Delimično blokiranje vremena dozvoljeno je samo za jedan datum.";
    }

    if (!values.fullWorkingDays) {
      const startMinutes = parseTime(values.startTime);
      const endMinutes = parseTime(values.endTime);

      if (startMinutes === null) {
        nextErrors.startTime = "Izaberite ispravno početno vreme.";
      }

      if (endMinutes === null) {
        nextErrors.endTime = "Izaberite ispravno završno vreme.";
      } else if (startMinutes !== null && endMinutes <= startMinutes) {
        nextErrors.endTime = "Završno vreme mora biti posle početnog.";
      }
    }

    setErrors(nextErrors);

    return {
      isValid: Object.keys(nextErrors).length === 0,
      therapist,
    };
  }

  async function partialIntervalIsWithinWorkingHours(
    therapistId: DatabaseId,
  ) {
    const dayOfWeek = getCalendarDayOfWeek(values.startDate);
    const startMinutes = parseTime(values.startTime);
    const endMinutes = parseTime(values.endTime);

    if (
      dayOfWeek === null ||
      startMinutes === null ||
      endMinutes === null
    ) {
      return { isValid: false, hasError: false };
    }

    const { data, error } = await supabase
      .from("working_hours")
      .select("start_time, end_time")
      .eq("therapist_id", therapistId)
      .eq("day_of_week", dayOfWeek)
      .order("start_time", { ascending: true });
    const workingHours = getWorkingHours(data);

    if (error || !workingHours) {
      return { isValid: false, hasError: true };
    }

    return {
      isValid: workingHours.some(
        (workingHour) =>
          startMinutes >= workingHour.startMinutes &&
          endMinutes <= workingHour.endMinutes,
      ),
      hasError: false,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submissionInProgress.current) {
      return;
    }

    const validation = validateValues();

    if (!validation.isValid || !validation.therapist) {
      return;
    }

    submissionInProgress.current = true;
    setIsSubmitting(true);
    setIsCheckingConflicts(true);
    setSubmitError(undefined);
    setConflicts([]);

    try {
      if (!values.fullWorkingDays) {
        const workingHoursValidation =
          await partialIntervalIsWithinWorkingHours(validation.therapist.id);

        if (workingHoursValidation.hasError) {
          setSubmitError(
            "Radno vreme terapeuta trenutno nije moguće proveriti.",
          );
          return;
        }

        if (!workingHoursValidation.isValid) {
          setSubmitError(
            "Izabrano vreme nije unutar radnog vremena terapeuta.",
          );
          return;
        }
      }

      const conflictParameters: ConflictRpcParameters = {
        p_therapist_id: validation.therapist.id,
        p_start_date: values.startDate,
        p_end_date: values.endDate,
        p_full_working_days: values.fullWorkingDays,
        p_start_time: values.fullWorkingDays ? null : values.startTime,
        p_end_time: values.fullWorkingDays ? null : values.endTime,
      };
      const { data: conflictsData, error: conflictsError } =
        await supabase.rpc(
          "get_unavailability_conflicts",
          conflictParameters,
        );
      const loadedConflicts = getUnavailabilityConflicts(conflictsData);

      if (conflictsError || !loadedConflicts) {
        setSubmitError(
          "Konflikte sa zakazanim terminima trenutno nije moguće proveriti.",
        );
        return;
      }

      if (loadedConflicts.length > 0) {
        setConflicts(loadedConflicts);
        return;
      }

      setIsCheckingConflicts(false);
      const { error: createError } = await supabase.rpc(
        "create_therapist_unavailability",
        {
          ...conflictParameters,
          p_reason: values.reason.trim() || null,
        },
      );

      if (createError) {
        setSubmitError(
          isExistingUnavailabilityConflict(createError.message)
            ? "Izabrani period se preklapa sa postojećom nedostupnošću terapeuta."
            : "Nedostupnost trenutno nije moguće sačuvati. Pokušajte ponovo.",
        );
        return;
      }

      onCreated();
    } catch {
      setSubmitError(
        "Došlo je do neočekivane greške. Pokušajte ponovo kasnije.",
      );
    } finally {
      submissionInProgress.current = false;
      setIsSubmitting(false);
      setIsCheckingConflicts(false);
    }
  }

  function requestClose() {
    if (!submissionInProgress.current) {
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#172b27]/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="therapist-unavailability-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/80 bg-[#fffaf3] p-6 shadow-[0_28px_90px_rgba(23,43,39,0.28)] sm:p-8"
      >
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-[#397267] uppercase">
              Admin panel
            </p>
            <h2
              id="therapist-unavailability-title"
              className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#243c38] sm:text-3xl"
            >
              Blokiraj vreme
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#6b807c]">
              Označite period tokom kog terapeut neće biti dostupan.
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={isSubmitting}
            aria-label="Zatvori formu za blokiranje vremena"
            className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border border-[#397267]/15 bg-white text-xl leading-none text-[#397267] transition hover:border-[#397267]/30 hover:bg-[#edf5f0] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#397267] disabled:cursor-wait disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit} className="mt-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label
                htmlFor="unavailability-therapist"
                className="block text-sm font-semibold text-[#243c38]"
              >
                Terapeut <span className="text-[#b45745]">*</span>
              </label>
              <select
                id="unavailability-therapist"
                value={values.therapistId}
                onChange={handleSelectChange}
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.therapistId)}
                className="mt-2 min-h-12 w-full rounded-2xl border border-[#397267]/18 bg-[#fffdf9] px-4 py-3 text-[#243c38] outline-none focus:border-[#397267]/45 focus:ring-3 focus:ring-[#397267]/12 disabled:opacity-60"
              >
                <option value="">Izaberite terapeuta</option>
                {therapists.map((therapist) => (
                  <option key={String(therapist.id)} value={String(therapist.id)}>
                    {therapist.name}
                  </option>
                ))}
              </select>
              {errors.therapistId && (
                <p role="alert" className="mt-2 text-sm text-[#a34838]">
                  {errors.therapistId}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="unavailability-start-date"
                className="block text-sm font-semibold text-[#243c38]"
              >
                Od datuma <span className="text-[#b45745]">*</span>
              </label>
              <input
                id="unavailability-start-date"
                type="date"
                min={today}
                value={values.startDate}
                onChange={handleStartDateChange}
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.startDate)}
                className="mt-2 min-h-12 w-full rounded-2xl border border-[#397267]/18 bg-[#fffdf9] px-4 py-3 text-[#243c38] outline-none focus:border-[#397267]/45 focus:ring-3 focus:ring-[#397267]/12 disabled:opacity-60"
              />
              {errors.startDate && (
                <p role="alert" className="mt-2 text-sm text-[#a34838]">
                  {errors.startDate}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="unavailability-end-date"
                className="block text-sm font-semibold text-[#243c38]"
              >
                Do datuma <span className="text-[#b45745]">*</span>
              </label>
              <input
                id="unavailability-end-date"
                type="date"
                min={values.startDate || today}
                value={values.endDate}
                onChange={handleEndDateChange}
                disabled={isSubmitting || !values.fullWorkingDays}
                aria-invalid={Boolean(errors.endDate)}
                className="mt-2 min-h-12 w-full rounded-2xl border border-[#397267]/18 bg-[#fffdf9] px-4 py-3 text-[#243c38] outline-none focus:border-[#397267]/45 focus:ring-3 focus:ring-[#397267]/12 disabled:cursor-not-allowed disabled:opacity-60"
              />
              {errors.endDate && (
                <p role="alert" className="mt-2 text-sm text-[#a34838]">
                  {errors.endDate}
                </p>
              )}
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#397267]/12 bg-white/65 px-4 py-3 sm:col-span-2">
              <input
                type="checkbox"
                checked={values.fullWorkingDays}
                onChange={handleFullWorkingDaysChange}
                disabled={isSubmitting}
                className="h-5 w-5 accent-[#397267]"
              />
              <span className="font-semibold text-[#243c38]">
                Celi radni dani
              </span>
            </label>

            {!values.fullWorkingDays && (
              <>
                <div>
                  <label
                    htmlFor="unavailability-start-time"
                    className="block text-sm font-semibold text-[#243c38]"
                  >
                    Od vremena <span className="text-[#b45745]">*</span>
                  </label>
                  <input
                    id="unavailability-start-time"
                    name="startTime"
                    type="time"
                    value={values.startTime}
                    onChange={handleTimeChange}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(errors.startTime)}
                    className="mt-2 min-h-12 w-full rounded-2xl border border-[#397267]/18 bg-[#fffdf9] px-4 py-3 text-[#243c38] outline-none focus:border-[#397267]/45 focus:ring-3 focus:ring-[#397267]/12 disabled:opacity-60"
                  />
                  {errors.startTime && (
                    <p role="alert" className="mt-2 text-sm text-[#a34838]">
                      {errors.startTime}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="unavailability-end-time"
                    className="block text-sm font-semibold text-[#243c38]"
                  >
                    Do vremena <span className="text-[#b45745]">*</span>
                  </label>
                  <input
                    id="unavailability-end-time"
                    name="endTime"
                    type="time"
                    value={values.endTime}
                    onChange={handleTimeChange}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(errors.endTime)}
                    className="mt-2 min-h-12 w-full rounded-2xl border border-[#397267]/18 bg-[#fffdf9] px-4 py-3 text-[#243c38] outline-none focus:border-[#397267]/45 focus:ring-3 focus:ring-[#397267]/12 disabled:opacity-60"
                  />
                  {errors.endTime && (
                    <p role="alert" className="mt-2 text-sm text-[#a34838]">
                      {errors.endTime}
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="sm:col-span-2">
              <label
                htmlFor="unavailability-reason"
                className="block text-sm font-semibold text-[#243c38]"
              >
                Razlog <span className="font-normal text-[#6b807c]">(opciono)</span>
              </label>
              <textarea
                id="unavailability-reason"
                rows={3}
                maxLength={300}
                value={values.reason}
                onChange={(event) =>
                  setValues((currentValues) => ({
                    ...currentValues,
                    reason: event.target.value,
                  }))
                }
                disabled={isSubmitting}
                placeholder="Na primer: godišnji odmor, sastanak, odsustvo..."
                className="mt-2 w-full resize-y rounded-2xl border border-[#397267]/18 bg-[#fffdf9] px-4 py-3 text-[#243c38] outline-none placeholder:text-[#8a9996] focus:border-[#397267]/45 focus:ring-3 focus:ring-[#397267]/12 disabled:opacity-60"
              />
            </div>
          </div>

          {conflicts.length > 0 && (
            <div
              role="alert"
              className="mt-6 rounded-2xl border border-[#d89a58]/30 bg-[#fff7e9] px-5 py-4 text-[#815a2d]"
            >
              <p className="font-semibold">
                U izabranom periodu postoje zakazani termini.
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {conflicts.map((conflict, index) => (
                  <li
                    key={`${conflict.date}-${conflict.startTime}-${index}`}
                    className="rounded-xl bg-white/65 px-3 py-2"
                  >
                    <span className="font-semibold">{conflict.childName}</span>
                    <span className="text-[#6b604f]">
                      {" "}· {conflict.date} · {conflict.startTime}–
                      {conflict.endTime}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {submitError && (
            <div
              role="alert"
              className="mt-6 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-5 py-4 text-sm font-medium leading-6 text-[#8f4033]"
            >
              {submitError}
            </div>
          )}

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[#397267]/10 pt-6 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={requestClose}
              disabled={isSubmitting}
              className="min-h-12 rounded-full border border-[#397267]/20 bg-white px-6 py-3 text-sm font-semibold text-[#397267] transition hover:border-[#397267]/35 disabled:cursor-wait disabled:opacity-50"
            >
              Zatvori
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="min-h-12 rounded-full bg-[#397267] px-7 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(57,114,103,0.2)] transition hover:bg-[#2f6158] disabled:cursor-wait disabled:opacity-60"
            >
              {isCheckingConflicts
                ? "Provera konflikata..."
                : isSubmitting
                  ? "Čuvanje..."
                  : "Sačuvaj blokadu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
