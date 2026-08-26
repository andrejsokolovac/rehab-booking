import { Resend } from "resend";

import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const APP_BASE_URL = (
  process.env.APP_BASE_URL || "http://localhost:3000"
).replace(/\/+$/, "");
const BELGRADE_TIME_ZONE = "Europe/Belgrade";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_FIELDS = new Set(["waitlistId", "waitlistToken"]);
const WEEKDAY_NAMES: Record<number, string> = {
  1: "Ponedeljak",
  2: "Utorak",
  3: "Sreda",
  4: "Četvrtak",
  5: "Petak",
};

type DatabaseId = number | string;

type WaitlistRegistrationRequest = {
  waitlistId: DatabaseId;
  waitlistToken: string;
};

type WaitlistRegistrationEmailDetails = {
  childName: string;
  serviceName: string;
  therapistName: string;
  preferredDays: string;
  preferredTime: string;
  validPeriod: string;
  cancellationUrl: string;
};

const calendarDateFormatter = new Intl.DateTimeFormat("sr-Latn-RS", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: BELGRADE_TIME_ZONE,
});

function getDatabaseId(value: unknown): DatabaseId | null {
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  ) {
    return value;
  }

  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
    return value;
  }

  return null;
}

function getRequestPayload(body: unknown): WaitlistRegistrationRequest | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const data = body as Record<string, unknown>;
  const fields = Object.keys(data);

  if (
    fields.length !== REQUEST_FIELDS.size ||
    fields.some((field) => !REQUEST_FIELDS.has(field))
  ) {
    return null;
  }

  const waitlistId = getDatabaseId(data.waitlistId);
  const waitlistToken =
    typeof data.waitlistToken === "string" ? data.waitlistToken.trim() : "";

  if (waitlistId === null || !UUID_PATTERN.test(waitlistToken)) {
    return null;
  }

  return { waitlistId, waitlistToken };
}

function getNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getPreferredDays(value: unknown) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some(
      (day) =>
        typeof day !== "number" ||
        !Number.isInteger(day) ||
        !WEEKDAY_NAMES[day],
    )
  ) {
    return null;
  }

  return value.map((day) => WEEKDAY_NAMES[day]).join(", ");
}

function formatTime(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(
    /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/,
  );

  return match ? `${match[1]}:${match[2]}` : null;
}

function formatCalendarDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return calendarDateFormatter.format(date);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createEmailHtml(details: WaitlistRegistrationEmailDetails) {
  const childName = escapeHtml(details.childName);
  const serviceName = escapeHtml(details.serviceName);
  const therapistName = escapeHtml(details.therapistName);
  const preferredDays = escapeHtml(details.preferredDays);
  const preferredTime = escapeHtml(details.preferredTime);
  const validPeriod = escapeHtml(details.validPeriod);
  const cancellationUrl = escapeHtml(details.cancellationUrl);

  return `
    <!doctype html>
    <html lang="sr">
      <body style="margin:0;background:#fffaf3;color:#243c38;font-family:Arial,sans-serif;">
        <div style="padding:32px 16px;">
          <div style="max-width:600px;margin:0 auto;overflow:hidden;border:1px solid #e1e8e5;border-radius:24px;background:#ffffff;">
            <div style="background:#397267;padding:28px 32px;color:#ffffff;">
              <p style="margin:0;font-size:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Centar za razvoj i rehabilitaciju</p>
              <h1 style="margin:14px 0 0;font-size:28px;line-height:1.25;">Prijavljeni ste na listu čekanja</h1>
            </div>
            <div style="padding:32px;">
              <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#526b66;">Vaša prijava je uspešno sačuvana. Kontaktiraćemo vas kada se pojavi termin koji odgovara izabranim uslovima.</p>
              <h2 style="margin:0 0 8px;font-size:18px;line-height:1.4;color:#243c38;">Podaci o prijavi</h2>
              <table role="presentation" style="width:100%;border-collapse:collapse;font-size:16px;">
                <tr><td style="padding:12px 0;color:#6b807c;">Dete</td><td style="padding:12px 0;text-align:right;font-weight:700;">${childName}</td></tr>
                <tr><td style="padding:12px 0;border-top:1px solid #edf1ef;color:#6b807c;">Usluga</td><td style="padding:12px 0;border-top:1px solid #edf1ef;text-align:right;font-weight:700;">${serviceName}</td></tr>
                <tr><td style="padding:12px 0;border-top:1px solid #edf1ef;color:#6b807c;">Terapeut</td><td style="padding:12px 0;border-top:1px solid #edf1ef;text-align:right;font-weight:700;">${therapistName}</td></tr>
                <tr><td style="padding:12px 0;border-top:1px solid #edf1ef;color:#6b807c;">Dani</td><td style="padding:12px 0;border-top:1px solid #edf1ef;text-align:right;font-weight:700;">${preferredDays}</td></tr>
                <tr><td style="padding:12px 0;border-top:1px solid #edf1ef;color:#6b807c;">Vreme</td><td style="padding:12px 0;border-top:1px solid #edf1ef;text-align:right;font-weight:700;">${preferredTime}</td></tr>
                <tr><td style="padding:12px 0;border-top:1px solid #edf1ef;color:#6b807c;">Period važenja</td><td style="padding:12px 0;border-top:1px solid #edf1ef;text-align:right;font-weight:700;">${validPeriod}</td></tr>
              </table>

              <div style="margin-top:28px;padding-top:24px;border-top:1px solid #edf1ef;">
                <h2 style="margin:0 0 10px;font-size:18px;line-height:1.4;color:#243c38;">Odustajanje od liste čekanja</h2>
                <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#6b807c;">Ako više ne želite da dobijate ponude za slobodne termine, prijavu možete otkazati putem sigurnog linka.</p>
                <a href="${cancellationUrl}" style="display:inline-block;border-radius:999px;background:#b45745;padding:13px 22px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">Odustani od liste čekanja</a>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: "Telo zahteva mora biti ispravan JSON." },
      { status: 400 },
    );
  }

  const payload = getRequestPayload(body);

  if (!payload) {
    return Response.json(
      { success: false, error: "Zahtev ne sadrži ispravne podatke." },
      { status: 400 },
    );
  }

  const { data: waitlistEntry, error: waitlistError } = await supabaseAdmin
    .from("waitlist_entries")
    .select(
      "service_id, therapist_id, email, child_name, preferred_days, preferred_start_time, preferred_end_time, valid_from, valid_until",
    )
    .eq("id", payload.waitlistId)
    .eq("waitlist_token", payload.waitlistToken)
    .maybeSingle();

  if (waitlistError) {
    return Response.json(
      { success: false, error: "Potvrdu trenutno nije moguće pripremiti." },
      { status: 500 },
    );
  }

  if (!waitlistEntry) {
    return Response.json(
      { success: false, error: "Prijava nije pronađena." },
      { status: 404 },
    );
  }

  const serviceId = getDatabaseId(waitlistEntry.service_id);
  const therapistId =
    waitlistEntry.therapist_id === null
      ? null
      : getDatabaseId(waitlistEntry.therapist_id);
  const parentEmail = getNonEmptyString(waitlistEntry.email);
  const childName = getNonEmptyString(waitlistEntry.child_name);
  const preferredDays = getPreferredDays(waitlistEntry.preferred_days);
  const preferredStartTime = formatTime(waitlistEntry.preferred_start_time);
  const preferredEndTime = formatTime(waitlistEntry.preferred_end_time);
  const validFrom = formatCalendarDate(waitlistEntry.valid_from);
  const validUntil = formatCalendarDate(waitlistEntry.valid_until);

  if (
    serviceId === null ||
    (waitlistEntry.therapist_id !== null && therapistId === null) ||
    !parentEmail ||
    !EMAIL_PATTERN.test(parentEmail) ||
    !childName ||
    !preferredDays ||
    !preferredStartTime ||
    !preferredEndTime ||
    !validFrom ||
    !validUntil
  ) {
    return Response.json(
      { success: false, error: "Podaci za potvrdu nisu ispravni." },
      { status: 500 },
    );
  }

  const serviceQuery = supabaseAdmin
    .from("services")
    .select("name")
    .eq("id", serviceId)
    .maybeSingle();
  const therapistQuery =
    therapistId === null
      ? Promise.resolve({ data: null, error: null })
      : supabaseAdmin
          .from("therapists")
          .select("name")
          .eq("id", therapistId)
          .maybeSingle();
  const [serviceResult, therapistResult] = await Promise.all([
    serviceQuery,
    therapistQuery,
  ]);

  if (serviceResult.error || therapistResult.error) {
    return Response.json(
      { success: false, error: "Podatke za potvrdu nije moguće učitati." },
      { status: 500 },
    );
  }

  const serviceName = getNonEmptyString(serviceResult.data?.name);
  const therapistName =
    therapistId === null
      ? "Prvi slobodan terapeut"
      : getNonEmptyString(therapistResult.data?.name);

  if (!serviceName || !therapistName) {
    return Response.json(
      { success: false, error: "Podaci za potvrdu nisu ispravni." },
      { status: 500 },
    );
  }

  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    return Response.json(
      { success: false, error: "Serverska konfiguracija nije dostupna." },
      { status: 500 },
    );
  }

  const cancellationUrl = `${APP_BASE_URL}/waitlist/cancel/${encodeURIComponent(
    payload.waitlistToken,
  )}`;
  const resend = new Resend(resendApiKey);

  try {
    const response = await resend.emails.send(
      {
        from: "onboarding@resend.dev",
        to: parentEmail,
        subject: "Prijavljeni ste na listu čekanja",
        html: createEmailHtml({
          childName,
          serviceName,
          therapistName,
          preferredDays,
          preferredTime: `${preferredStartTime}–${preferredEndTime}`,
          validPeriod: `${validFrom} – ${validUntil}`,
          cancellationUrl,
        }),
      },
      {
        idempotencyKey: `waitlist-registration/${payload.waitlistId}`,
      },
    );

    if (response.error) {
      return Response.json(
        { success: false, error: "Potvrdu trenutno nije moguće poslati." },
        { status: 502 },
      );
    }

    return Response.json({ success: true });
  } catch {
    return Response.json(
      { success: false, error: "Potvrdu trenutno nije moguće poslati." },
      { status: 502 },
    );
  }
}
