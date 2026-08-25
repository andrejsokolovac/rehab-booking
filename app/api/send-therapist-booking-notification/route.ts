import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const BELGRADE_TIME_ZONE = "Europe/Belgrade";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_FIELDS = new Set(["appointmentId", "cancelToken"]);

type DatabaseId = number | string;

type NotificationRequest = {
  appointmentId: DatabaseId;
  cancelToken: string;
};

type AppointmentDateTime = {
  date: string;
  startTime: string;
  endTime: string;
};

type TherapistNotificationDetails = AppointmentDateTime & {
  childName: string;
  serviceName: string;
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

function getRequestPayload(body: unknown): NotificationRequest | null {
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

  const appointmentId = getDatabaseId(data.appointmentId);
  const cancelToken =
    typeof data.cancelToken === "string" ? data.cancelToken.trim() : "";

  if (appointmentId === null || !UUID_PATTERN.test(cancelToken)) {
    return null;
  }

  return { appointmentId, cancelToken };
}

function getNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatAppointmentDateTime(
  startAt: unknown,
  endAt: unknown,
): AppointmentDateTime | null {
  if (typeof startAt !== "string" || typeof endAt !== "string") {
    return null;
  }

  const start = new Date(startAt);
  const end = new Date(endAt);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
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

function createNotificationEmailHtml(
  therapistName: string,
  details: TherapistNotificationDetails,
) {
  const safeTherapistName = escapeHtml(therapistName);
  const childName = escapeHtml(details.childName);
  const serviceName = escapeHtml(details.serviceName);
  const appointmentDate = escapeHtml(details.date);
  const appointmentStartTime = escapeHtml(details.startTime);
  const appointmentEndTime = escapeHtml(details.endTime);

  return `
    <!doctype html>
    <html lang="sr">
      <body style="margin:0;background:#fffaf3;color:#243c38;font-family:Arial,sans-serif;">
        <div style="padding:32px 16px;">
          <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e1e8e5;border-radius:24px;overflow:hidden;">
            <div style="background:#397267;padding:28px 32px;color:#ffffff;">
              <p style="margin:0;font-size:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Centar za razvoj i rehabilitaciju</p>
              <h1 style="margin:14px 0 0;font-size:28px;line-height:1.25;">Zakazan je novi termin</h1>
            </div>
            <div style="padding:32px;">
              <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#526b66;">Poštovani/a ${safeTherapistName}, zakazan vam je novi termin.</p>
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
                  <td style="padding:12px 0;border-top:1px solid #edf1ef;color:#6b807c;">Datum</td>
                  <td style="padding:12px 0;border-top:1px solid #edf1ef;text-align:right;font-weight:700;">${appointmentDate}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-top:1px solid #edf1ef;color:#6b807c;">Početak</td>
                  <td style="padding:12px 0;border-top:1px solid #edf1ef;text-align:right;font-weight:700;">${appointmentStartTime}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-top:1px solid #edf1ef;color:#6b807c;">Kraj</td>
                  <td style="padding:12px 0;border-top:1px solid #edf1ef;text-align:right;font-weight:700;">${appointmentEndTime}</td>
                </tr>
              </table>
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

  const { data: appointment, error: appointmentError } = await supabaseAdmin
    .from("appointments")
    .select(
      "id, therapist_id, service_id, child_name, start_at, end_at, status, therapist_booking_email_sent_at",
    )
    .eq("id", payload.appointmentId)
    .eq("cancel_token", payload.cancelToken)
    .maybeSingle();

  if (appointmentError) {
    return Response.json(
      { success: false, error: "Termin trenutno nije moguće proveriti." },
      { status: 500 },
    );
  }

  if (!appointment || appointment.status !== "confirmed") {
    return Response.json(
      { success: false, error: "Termin nije pronađen ili nije dostupan." },
      { status: 404 },
    );
  }

  if (appointment.therapist_booking_email_sent_at !== null) {
    return Response.json({
      success: true,
      skipped: true,
      reason: "already_sent",
    });
  }

  const therapistId = getDatabaseId(appointment.therapist_id);
  const serviceId = getDatabaseId(appointment.service_id);
  const childName = getNonEmptyString(appointment.child_name);
  const appointmentDateTime = formatAppointmentDateTime(
    appointment.start_at,
    appointment.end_at,
  );

  if (
    therapistId === null ||
    serviceId === null ||
    !childName ||
    !appointmentDateTime
  ) {
    return Response.json(
      { success: false, error: "Podaci o terminu nisu ispravni." },
      { status: 500 },
    );
  }

  const [therapistResult, serviceResult, contactResult] = await Promise.all([
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
    supabaseAdmin
      .from("therapist_contacts")
      .select("email")
      .eq("therapist_id", therapistId)
      .maybeSingle(),
  ]);

  if (therapistResult.error || serviceResult.error || contactResult.error) {
    return Response.json(
      { success: false, error: "Podatke za obaveštenje nije moguće učitati." },
      { status: 500 },
    );
  }

  if (!contactResult.data) {
    return Response.json({
      success: true,
      skipped: true,
      reason: "therapist_contact_not_configured",
    });
  }

  const therapistName = getNonEmptyString(therapistResult.data?.name);
  const serviceName = getNonEmptyString(serviceResult.data?.name);
  const therapistEmail = getNonEmptyString(contactResult.data.email);

  if (
    !therapistName ||
    !serviceName ||
    !therapistEmail ||
    !EMAIL_PATTERN.test(therapistEmail)
  ) {
    return Response.json(
      { success: false, error: "Podaci za obaveštenje nisu ispravni." },
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

  const resend = new Resend(resendApiKey);
  let emailWasSent = false;

  try {
    const response = await resend.emails.send(
      {
        from: "onboarding@resend.dev",
        to: therapistEmail,
        subject: "Novi zakazani termin",
        html: createNotificationEmailHtml(therapistName, {
          childName,
          serviceName,
          ...appointmentDateTime,
        }),
      },
      {
        idempotencyKey: `therapist-booking/${appointment.id}`,
      },
    );

    emailWasSent = !response.error;
  } catch {
    emailWasSent = false;
  }

  if (!emailWasSent) {
    return Response.json(
      {
        success: false,
        error: "Obaveštenje terapeutu trenutno nije moguće poslati.",
      },
      { status: 502 },
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("appointments")
    .update({ therapist_booking_email_sent_at: new Date().toISOString() })
    .eq("id", appointment.id)
    .is("therapist_booking_email_sent_at", null);

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
