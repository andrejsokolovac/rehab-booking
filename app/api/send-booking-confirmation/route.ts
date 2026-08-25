import { Resend } from "resend";

export const runtime = "nodejs";

const APP_BASE_URL = "http://localhost:3000";
const CENTER_ADDRESS = "Bulevar Vojvode Stepe 133, Novi Sad";
const GOOGLE_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  CENTER_ADDRESS,
)}`;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type BookingConfirmationPayload = {
  email: string;
  serviceName: string;
  therapistName: string;
  date: string;
  time: string;
  cancelToken: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Nepoznata greška.";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPayload(body: unknown): BookingConfirmationPayload | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const data = body as Record<string, unknown>;
  const fields = [
    "email",
    "serviceName",
    "therapistName",
    "date",
    "time",
    "cancelToken",
  ] as const;
  const values = Object.fromEntries(
    fields.map((field) => [
      field,
      typeof data[field] === "string" ? data[field].trim() : "",
    ]),
  ) as Record<(typeof fields)[number], string>;

  if (fields.some((field) => !values[field])) {
    return null;
  }

  return values;
}

function createEmailHtml(
  payload: BookingConfirmationPayload,
  cancellationUrl: string,
) {
  const serviceName = escapeHtml(payload.serviceName);
  const therapistName = escapeHtml(payload.therapistName);
  const appointmentDate = escapeHtml(payload.date);
  const appointmentTime = escapeHtml(payload.time);
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
              <h1 style="margin:14px 0 0;font-size:28px;line-height:1.25;">Termin je uspešno zakazan</h1>
            </div>
            <div style="padding:32px;">
              <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#526b66;">Hvala vam na ukazanom poverenju. U nastavku su detalji vašeg termina.</p>
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

  const payload = getPayload(body);

  if (!payload) {
    return Response.json(
      { success: false, error: "Nedostaju obavezni podaci." },
      { status: 400 },
    );
  }

  if (!EMAIL_PATTERN.test(payload.email) || !UUID_PATTERN.test(payload.cancelToken)) {
    return Response.json(
      { success: false, error: "Email adresa ili token za otkazivanje nisu ispravni." },
      { status: 400 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return Response.json(
      { success: false, error: "RESEND_API_KEY nije podešen." },
      { status: 500 },
    );
  }

  const cancellationUrl = new URL(
    `/cancel/${encodeURIComponent(payload.cancelToken)}`,
    APP_BASE_URL,
  ).toString();
  const resend = new Resend(apiKey);

  try {
    const response = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: payload.email,
      subject: "Potvrda zakazanog termina",
      html: createEmailHtml(payload, cancellationUrl),
    });

    if (response.error) {
      return Response.json(
        { success: false, error: response.error.message },
        { status: 502 },
      );
    }

    return Response.json({ success: true, response });
  } catch (error) {
    return Response.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
