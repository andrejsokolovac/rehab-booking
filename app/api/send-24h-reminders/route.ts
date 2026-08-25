import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const APP_BASE_URL = "http://localhost:3000";
const BELGRADE_TIME_ZONE = "Europe/Belgrade";
const CENTER_ADDRESS = "Bulevar vojvode Stepe 133, Novi Sad";
const GOOGLE_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  CENTER_ADDRESS,
)}`;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AppointmentId = number | string;

type ClaimedReminder = {
  appointmentId: AppointmentId;
  email: string;
  serviceName: string;
  therapistName: string;
  startAt: string;
  cancelToken: string;
};

type FormattedAppointmentStart = {
  date: string;
  time: string;
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getAppointmentId(value: unknown): AppointmentId | null {
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

function getNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getClaimedReminder(value: unknown): ClaimedReminder | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const appointmentId = getAppointmentId(row.appointment_id);
  const email = getNonEmptyString(row.email);
  const serviceName = getNonEmptyString(row.service_name);
  const therapistName = getNonEmptyString(row.therapist_name);
  const startAt = getNonEmptyString(row.start_at);
  const cancelToken = getNonEmptyString(row.cancel_token);

  if (
    appointmentId === null ||
    !email ||
    !EMAIL_PATTERN.test(email) ||
    !serviceName ||
    !therapistName ||
    !startAt ||
    !cancelToken ||
    !UUID_PATTERN.test(cancelToken)
  ) {
    return null;
  }

  return {
    appointmentId,
    email,
    serviceName,
    therapistName,
    startAt,
    cancelToken,
  };
}

function getAppointmentIdFromClaim(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return getAppointmentId(
    (value as Record<string, unknown>).appointment_id,
  );
}

function formatAppointmentStart(
  startAt: string,
): FormattedAppointmentStart | null {
  const instant = new Date(startAt);

  if (Number.isNaN(instant.getTime())) {
    return null;
  }

  const formattedDate = dateFormatter.format(instant);

  return {
    date:
      formattedDate.charAt(0).toLocaleUpperCase("sr-Latn-RS") +
      formattedDate.slice(1),
    time: timeFormatter.format(instant),
  };
}

function createReminderEmailHtml(
  appointment: ClaimedReminder,
  appointmentStart: FormattedAppointmentStart,
  cancellationUrl: string,
) {
  const serviceName = escapeHtml(appointment.serviceName);
  const therapistName = escapeHtml(appointment.therapistName);
  const appointmentDate = escapeHtml(appointmentStart.date);
  const appointmentTime = escapeHtml(appointmentStart.time);
  const centerAddress = escapeHtml(CENTER_ADDRESS);
  const safeGoogleMapsUrl = escapeHtml(GOOGLE_MAPS_URL);
  const safeCancellationUrl = escapeHtml(cancellationUrl);

  return `
    <!doctype html>
    <html lang="sr">
      <body style="margin:0;background:#fffaf3;color:#243c38;font-family:Arial,sans-serif;">
        <div style="padding:32px 16px;">
          <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e1e8e5;border-radius:24px;overflow:hidden;">
            <div style="background:#397267;padding:28px 32px;color:#ffffff;">
              <p style="margin:0;font-size:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Centar za razvoj i rehabilitaciju</p>
              <h1 style="margin:14px 0 0;font-size:28px;line-height:1.25;">Podsetnik na zakazani termin</h1>
            </div>
            <div style="padding:32px;">
              <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#526b66;">Podsećamo vas da je vaš zakazani termin sutra.</p>
              <h2 style="margin:0 0 8px;font-size:18px;line-height:1.4;color:#243c38;">Podaci o terminu</h2>
              <table role="presentation" style="width:100%;border-collapse:collapse;font-size:16px;">
                <tr>
                  <td style="padding:12px 0;color:#6b807c;">Usluga</td>
                  <td style="padding:12px 0;text-align:right;font-weight:700;">${serviceName}</td>
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
                  <td style="padding:12px 0;border-top:1px solid #edf1ef;text-align:right;font-weight:700;">${appointmentTime}</td>
                </tr>
              </table>
              <div style="margin-top:28px;padding-top:24px;border-top:1px solid #edf1ef;">
                <h2 style="margin:0 0 10px;font-size:18px;line-height:1.4;color:#243c38;">Lokacija</h2>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#526b66;">${centerAddress}</p>
                <a href="${safeGoogleMapsUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#397267;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 22px;border-radius:999px;">Kako do nas</a>
              </div>
              <div style="margin-top:28px;padding-top:24px;border-top:1px solid #edf1ef;">
                <h2 style="margin:0 0 10px;font-size:18px;line-height:1.4;color:#243c38;">Otkazivanje termina</h2>
                <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#6b807c;">Ukoliko niste u mogućnosti da dođete na zakazani termin, možete ga otkazati putem sledećeg linka.</p>
                <a href="${safeCancellationUrl}" style="display:inline-block;background:#b45745;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 22px;border-radius:999px;">Otkaži termin</a>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

async function releaseReminderClaim(appointmentId: AppointmentId) {
  try {
    const { error } = await supabaseAdmin.rpc(
      "release_24h_reminder_claim",
      { p_appointment_id: appointmentId },
    );

    if (error) {
      console.error("Claim podsetnika nije oslobođen.", {
        appointmentId: String(appointmentId),
      });
    }
  } catch {
    console.error("Claim podsetnika nije oslobođen.", {
      appointmentId: String(appointmentId),
    });
  }
}

async function getConfirmationStatus(appointmentId: AppointmentId) {
  try {
    const { data, error } = await supabaseAdmin
      .from("appointments")
      .select("status")
      .eq("id", appointmentId)
      .maybeSingle();

    if (error) {
      console.error("Status termina nije moguće proveriti.", {
        appointmentId: String(appointmentId),
      });
      return "error" as const;
    }

    return data?.status === "confirmed" ? ("confirmed" as const) : ("not-confirmed" as const);
  } catch {
    console.error("Status termina nije moguće proveriti.", {
      appointmentId: String(appointmentId),
    });
    return "error" as const;
  }
}

async function markReminderSent(appointmentId: AppointmentId) {
  try {
    const { error } = await supabaseAdmin.rpc("mark_24h_reminder_sent", {
      p_appointment_id: appointmentId,
    });

    if (error) {
      console.error(
        "Email je poslat, ali podsetnik nije označen kao poslat.",
        { appointmentId: String(appointmentId) },
      );
      return false;
    }

    return true;
  } catch {
    console.error("Email je poslat, ali podsetnik nije označen kao poslat.", {
      appointmentId: String(appointmentId),
    });
    return false;
  }
}

export async function POST(request: Request) {
  const cronSecret = process.env.REMINDER_CRON_SECRET;

  if (!cronSecret) {
    return Response.json(
      { success: false, error: "Serverska konfiguracija nije dostupna." },
      { status: 500 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json(
      { success: false, error: "Neovlašćen zahtev." },
      { status: 401 },
    );
  }

  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    return Response.json(
      { success: false, error: "Serverska konfiguracija nije dostupna." },
      { status: 500 },
    );
  }

  const { data, error } = await supabaseAdmin.rpc(
    "claim_due_24h_reminders",
  );

  if (error || (data !== null && !Array.isArray(data))) {
    return Response.json(
      { success: false, error: "Podsetnike trenutno nije moguće preuzeti." },
      { status: 500 },
    );
  }

  const claimedRows: unknown[] = data ?? [];
  const resend = new Resend(resendApiKey);
  const summary = {
    success: true,
    claimed: claimedRows.length,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  for (const claimedRow of claimedRows) {
    const appointment = getClaimedReminder(claimedRow);

    if (!appointment) {
      const appointmentId = getAppointmentIdFromClaim(claimedRow);

      if (appointmentId !== null) {
        await releaseReminderClaim(appointmentId);
      }

      console.error("Claim podsetnika sadrži neispravne podatke.", {
        appointmentId:
          appointmentId === null ? "unknown" : String(appointmentId),
      });
      summary.failed += 1;
      continue;
    }

    const confirmationStatus = await getConfirmationStatus(
      appointment.appointmentId,
    );

    if (confirmationStatus !== "confirmed") {
      await releaseReminderClaim(appointment.appointmentId);

      if (confirmationStatus === "not-confirmed") {
        summary.skipped += 1;
      } else {
        summary.failed += 1;
      }

      continue;
    }

    const appointmentStart = formatAppointmentStart(appointment.startAt);

    if (!appointmentStart) {
      await releaseReminderClaim(appointment.appointmentId);
      console.error("Vreme termina u claim-u nije ispravno.", {
        appointmentId: String(appointment.appointmentId),
      });
      summary.failed += 1;
      continue;
    }

    const cancellationUrl = new URL(
      `/cancel/${encodeURIComponent(appointment.cancelToken)}`,
      APP_BASE_URL,
    ).toString();
    let emailWasSent = false;

    try {
      const response = await resend.emails.send(
        {
          from: "onboarding@resend.dev",
          to: appointment.email,
          subject: "Podsetnik na zakazani termin",
          html: createReminderEmailHtml(
            appointment,
            appointmentStart,
            cancellationUrl,
          ),
        },
        {
          idempotencyKey: `24h-reminder/${appointment.appointmentId}`,
        },
      );

      emailWasSent = !response.error;
    } catch {
      emailWasSent = false;
    }

    if (!emailWasSent) {
      await releaseReminderClaim(appointment.appointmentId);
      summary.failed += 1;
      continue;
    }

    const reminderWasMarkedAsSent = await markReminderSent(
      appointment.appointmentId,
    );

    if (!reminderWasMarkedAsSent) {
      summary.failed += 1;
      continue;
    }

    summary.sent += 1;
  }

  return Response.json(summary);
}
