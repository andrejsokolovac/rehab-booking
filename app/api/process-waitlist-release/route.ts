import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_FIELDS = new Set(["appointmentId", "cancelToken"]);
const APP_BASE_URL = (
  process.env.APP_BASE_URL || "http://localhost:3000"
).replace(/\/+$/, "");

type DatabaseId = number | string;

type ProcessReleaseRequest = {
  appointmentId: DatabaseId;
  cancelToken: string;
};

type CreatedOffer = {
  offerId: DatabaseId;
  offerToken: string;
};

type OfferResult =
  | { kind: "none" }
  | { kind: "offer"; offer: CreatedOffer }
  | { kind: "invalid" };

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

function getRequestPayload(body: unknown): ProcessReleaseRequest | null {
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

function getOfferResult(data: unknown): OfferResult {
  const value = Array.isArray(data) ? data[0] : data;

  if (value === null || value === undefined) {
    return { kind: "none" };
  }

  if (typeof value !== "object") {
    return { kind: "invalid" };
  }

  const row = value as Record<string, unknown>;

  if (row.offer_id == null && row.offer_token == null) {
    return { kind: "none" };
  }

  const offerId = getDatabaseId(row.offer_id);
  const offerToken =
    typeof row.offer_token === "string" ? row.offer_token.trim() : "";

  if (offerId === null || !UUID_PATTERN.test(offerToken)) {
    return { kind: "invalid" };
  }

  return {
    kind: "offer",
    offer: { offerId, offerToken },
  };
}

async function sendWaitlistOfferEmail(offer: CreatedOffer) {
  try {
    const response = await fetch(
      `${APP_BASE_URL}/api/send-waitlist-offer`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(offer),
        cache: "no-store",
      },
    );

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
    .select("id")
    .eq("id", payload.appointmentId)
    .eq("cancel_token", payload.cancelToken)
    .eq("status", "cancelled")
    .maybeSingle();

  if (appointmentError) {
    return Response.json(
      { success: false, error: "Termin trenutno nije moguće proveriti." },
      { status: 500 },
    );
  }

  const verifiedAppointmentId = getDatabaseId(appointment?.id);

  if (verifiedAppointmentId === null) {
    return Response.json(
      { success: false, error: "Termin nije pronađen ili nije dostupan." },
      { status: 404 },
    );
  }

  const { data: offerData, error: offerError } = await supabaseAdmin.rpc(
    "create_next_waitlist_offer",
    {
      p_appointment_id: verifiedAppointmentId,
    },
  );

  if (offerError) {
    return Response.json(
      { success: false, error: "Ponudu trenutno nije moguće kreirati." },
      { status: 500 },
    );
  }

  const offerResult = getOfferResult(offerData);

  if (offerResult.kind === "none") {
    return Response.json({ success: true, offered: false });
  }

  if (offerResult.kind === "invalid") {
    return Response.json(
      { success: false, error: "Rezultat kreiranja ponude nije ispravan." },
      { status: 500 },
    );
  }

  const emailSent = await sendWaitlistOfferEmail(offerResult.offer);

  return Response.json({
    success: true,
    offered: true,
    emailSent,
  });
}
