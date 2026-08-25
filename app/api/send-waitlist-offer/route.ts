import { Resend } from "resend";

import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const BELGRADE_TIME_ZONE = "Europe/Belgrade";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_FIELDS = new Set(["offerId", "offerToken"]);
const APP_BASE_URL = (
  process.env.APP_BASE_URL || "http://localhost:3000"
).replace(/\/+$/, "");

type DatabaseId = number | string;

type WaitlistOfferRequest = {
  offerId: DatabaseId;
  offerToken: string;
};

type OfferDateTime = {
  date: string;
  startTime: string;
  endTime: string;
  expiresAt: string;
};

type WaitlistOfferEmailDetails = OfferDateTime & {
  childName: string;
  serviceName: string;
  therapistName: string;
  offerUrl: string;
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

function getRequestPayload(body: unknown): WaitlistOfferRequest | null {
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

  const offerId = getDatabaseId(data.offerId);
  const offerToken =
    typeof data.offerToken === "string" ? data.offerToken.trim() : "";

  if (offerId === null || !UUID_PATTERN.test(offerToken)) {
    return null;
  }

  return { offerId, offerToken };
}

function getNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatOfferDateTime(
  startAt: unknown,
  endAt: unknown,
  expiresAt: unknown,
): OfferDateTime | null {
  if (
    typeof startAt !== "string" ||
    typeof endAt !== "string" ||
    typeof expiresAt !== "string"
  ) {
    return null;
  }

  const start = new Date(startAt);
  const end = new Date(endAt);
  const expiration = new Date(expiresAt);

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
    date:
      formattedDate.charAt(0).toLocaleUpperCase("sr-Latn-RS") +
      formattedDate.slice(1),
    startTime: timeFormatter.format(start),
    endTime: timeFormatter.format(end),
    expiresAt: expirationFormatter.format(expiration),
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createWaitlistOfferEmailHtml(details: WaitlistOfferEmailDetails) {
  const childName = escapeHtml(details.childName);
  const serviceName = escapeHtml(details.serviceName);
  const therapistName = escapeHtml(details.therapistName);
  const appointmentDate = escapeHtml(details.date);
  const appointmentStartTime = escapeHtml(details.startTime);
  const appointmentEndTime = escapeHtml(details.endTime);
  const offerExpiresAt = escapeHtml(details.expiresAt);
  const offerUrl = escapeHtml(details.offerUrl);

  return `
    <!doctype html>
    <html lang="sr">
      <body style="margin:0;background:#fffaf3;color:#243c38;font-family:Arial,sans-serif;">
        <div style="padding:32px 16px;">
          <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e1e8e5;border-radius:24px;overflow:hidden;">
            <div style="background:#397267;padding:28px 32px;color:#ffffff;">
              <p style="margin:0;font-size:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Centar za razvoj i rehabilitaciju</p>
              <h1 style="margin:14px 0 0;font-size:28px;line-height:1.25;">Oslobodio se termin</h1>
            </div>
            <div style="padding:32px;">
              <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#526b66;">Oslobodio se termin koji odgovara vašoj prijavi na listu čekanja.</p>
              <table role="presentation" style="width:100%;border-collapse:collapse;font-size:16px;">
                <tr>
                  <td style="padding:12px 0;color:#6b807c;">Dete</td>
                  <td style="padding:12px 0;text-align:right;font-weight:700;">${childName}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-top:1px solid #edf1ef;color:#6b807c;">Usluga</td>
                  <td style="padding:12px 0;border-top:1px solid #edf1ef;text-align:right;font-weight:700;">${serviceName}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-top:1px solid #edf1ef;color:#6b807c;">Terapeut</td>
                  <td style="padding:12px 0;border-top:1px solid #edf1ef;text-align:right;font-weight:700;">${therapistName}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-top:1px solid #edf1ef;color:#6b807c;">Datum</td>
                  <td style="padding:12px 0;border-top:1px solid #edf1ef;text-align:right;font-weight:700;">${appointmentDate}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-top:1px solid #edf1ef;color:#6b807c;">Vreme</td>
                  <td style="padding:12px 0;border-top:1px solid #edf1ef;text-align:right;font-weight:700;">${appointmentStartTime}–${appointmentEndTime}</td>
                </tr>
              </table>

              <div style="margin-top:28px;padding:22px;border:1px solid #d8e5e1;border-radius:16px;background:#f4f8f7;">
                <h2 style="margin:0 0 10px;font-size:18px;line-height:1.4;">Ponuda važi ograničeno vreme</h2>
                <p style="margin:0;font-size:15px;line-height:1.7;color:#526b66;">Termin je privremeno rezervisan za vas na 15 minuta. Ponudu možete prihvatiti do ${offerExpiresAt}.</p>
                <div style="margin-top:20px;text-align:center;">
                  <a href="${offerUrl}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#397267;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;">Prihvati termin</a>
                </div>
              </div>

              <p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:#6b807c;">Ako ponudu ne prihvatite pre isteka, termin može biti ponuđen drugoj osobi sa liste čekanja.</p>
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

  const { data: offer, error: offerError } = await supabaseAdmin
    .from("waitlist_offers")
    .select(
      "id, waitlist_entry_id, released_appointment_id, status, expires_at, offer_email_sent_at",
    )
    .eq("id", payload.offerId)
    .eq("offer_token", payload.offerToken)
    .maybeSingle();

  if (offerError) {
    return Response.json(
      { success: false, error: "Ponudu trenutno nije moguće proveriti." },
      { status: 500 },
    );
  }

  const expiresAt =
    typeof offer?.expires_at === "string"
      ? new Date(offer.expires_at)
      : null;

  if (
    !offer ||
    offer.status !== "pending" ||
    !expiresAt ||
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt <= new Date()
  ) {
    return Response.json(
      { success: false, error: "Ponuda nije pronađena ili više nije dostupna." },
      { status: 404 },
    );
  }

  if (offer.offer_email_sent_at !== null) {
    return Response.json({
      success: true,
      skipped: true,
      reason: "already_sent",
    });
  }

  const offerId = getDatabaseId(offer.id);
  const waitlistEntryId = getDatabaseId(offer.waitlist_entry_id);
  const releasedAppointmentId = getDatabaseId(
    offer.released_appointment_id,
  );

  if (
    offerId === null ||
    waitlistEntryId === null ||
    releasedAppointmentId === null
  ) {
    return Response.json(
      { success: false, error: "Podaci o ponudi nisu ispravni." },
      { status: 500 },
    );
  }

  const [waitlistEntryResult, appointmentResult] = await Promise.all([
    supabaseAdmin
      .from("waitlist_entries")
      .select("email, child_name")
      .eq("id", waitlistEntryId)
      .maybeSingle(),
    supabaseAdmin
      .from("appointments")
      .select("therapist_id, service_id, start_at, end_at")
      .eq("id", releasedAppointmentId)
      .maybeSingle(),
  ]);

  if (waitlistEntryResult.error || appointmentResult.error) {
    return Response.json(
      { success: false, error: "Podatke o ponudi nije moguće učitati." },
      { status: 500 },
    );
  }

  const parentEmail = getNonEmptyString(waitlistEntryResult.data?.email);
  const childName = getNonEmptyString(waitlistEntryResult.data?.child_name);
  const therapistId = getDatabaseId(appointmentResult.data?.therapist_id);
  const serviceId = getDatabaseId(appointmentResult.data?.service_id);
  const offerDateTime = formatOfferDateTime(
    appointmentResult.data?.start_at,
    appointmentResult.data?.end_at,
    offer.expires_at,
  );

  if (
    !parentEmail ||
    !EMAIL_PATTERN.test(parentEmail) ||
    !childName ||
    therapistId === null ||
    serviceId === null ||
    !offerDateTime
  ) {
    return Response.json(
      { success: false, error: "Podaci za obaveštenje nisu ispravni." },
      { status: 500 },
    );
  }

  const [therapistResult, serviceResult] = await Promise.all([
    supabaseAdmin
      .from("therapists")
      .select("name")
      .eq("id", therapistId)
      .maybeSingle(),
    supabaseAdmin
      .from("services")
      .select("name")
      .eq("id", serviceId)
      .maybeSingle(),
  ]);

  if (therapistResult.error || serviceResult.error) {
    return Response.json(
      { success: false, error: "Podatke za obaveštenje nije moguće učitati." },
      { status: 500 },
    );
  }

  const therapistName = getNonEmptyString(therapistResult.data?.name);
  const serviceName = getNonEmptyString(serviceResult.data?.name);

  if (!therapistName || !serviceName) {
    return Response.json(
      { success: false, error: "Podaci za obaveštenje nisu ispravni." },
      { status: 500 },
    );
  }

  if (expiresAt <= new Date()) {
    return Response.json(
      { success: false, error: "Ponuda nije pronađena ili više nije dostupna." },
      { status: 404 },
    );
  }

  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    return Response.json(
      { success: false, error: "Serverska konfiguracija nije dostupna." },
      { status: 500 },
    );
  }

  const offerUrl = `${APP_BASE_URL}/waitlist/offer/${encodeURIComponent(payload.offerToken)}`;
  const resend = new Resend(resendApiKey);
  let emailWasSent = false;

  try {
    const response = await resend.emails.send(
      {
        from: "onboarding@resend.dev",
        to: parentEmail,
        subject: "Oslobodio se termin sa liste čekanja",
        html: createWaitlistOfferEmailHtml({
          childName,
          serviceName,
          therapistName,
          offerUrl,
          ...offerDateTime,
        }),
      },
      {
        idempotencyKey: `waitlist-offer/${offerId}`,
      },
    );

    emailWasSent = !response.error;
  } catch {
    emailWasSent = false;
  }

  if (!emailWasSent) {
    return Response.json(
      { success: false, error: "Ponudu trenutno nije moguće poslati." },
      { status: 502 },
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("waitlist_offers")
    .update({ offer_email_sent_at: new Date().toISOString() })
    .eq("id", offerId)
    .eq("offer_token", payload.offerToken)
    .eq("status", "pending")
    .is("offer_email_sent_at", null);

  if (updateError) {
    return Response.json(
      {
        success: false,
        error: "Email je poslat, ali status obaveštenja nije sačuvan.",
      },
      { status: 500 },
    );
  }

  return Response.json({ success: true, skipped: false });
}
