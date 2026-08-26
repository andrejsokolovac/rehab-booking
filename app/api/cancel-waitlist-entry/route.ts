import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_FIELDS = new Set(["waitlistToken"]);
const APP_BASE_URL = (
  process.env.APP_BASE_URL || "http://localhost:3000"
).replace(/\/+$/, "");

type DatabaseId = number | string;

type CancellationResult =
  | { kind: "not-cancelled" }
  | { kind: "cancelled"; releasedAppointmentId: DatabaseId | null }
  | { kind: "invalid" };

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

function getWaitlistToken(body: unknown) {
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

  const waitlistToken =
    typeof data.waitlistToken === "string"
      ? data.waitlistToken.trim()
      : "";

  return UUID_PATTERN.test(waitlistToken) ? waitlistToken : null;
}

function getCancellationResult(data: unknown): CancellationResult {
  const value = Array.isArray(data) ? data[0] : data;

  if (!value || typeof value !== "object") {
    return { kind: "invalid" };
  }

  const row = value as Record<string, unknown>;

  if (row.cancelled === false) {
    return { kind: "not-cancelled" };
  }

  if (row.cancelled !== true) {
    return { kind: "invalid" };
  }

  if (row.released_appointment_id == null) {
    return { kind: "cancelled", releasedAppointmentId: null };
  }

  const releasedAppointmentId = getDatabaseId(
    row.released_appointment_id,
  );

  if (releasedAppointmentId === null) {
    return { kind: "invalid" };
  }

  return { kind: "cancelled", releasedAppointmentId };
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
      { success: false, cancelled: false },
      { status: 400 },
    );
  }

  const waitlistToken = getWaitlistToken(body);

  if (!waitlistToken) {
    return Response.json(
      { success: false, cancelled: false },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin.rpc(
    "cancel_waitlist_entry",
    {
      p_waitlist_token: waitlistToken,
    },
  );

  if (error) {
    return Response.json(
      { success: false, cancelled: false },
      { status: 500 },
    );
  }

  const cancellationResult = getCancellationResult(data);

  if (cancellationResult.kind === "not-cancelled") {
    return Response.json({ success: false, cancelled: false });
  }

  if (cancellationResult.kind === "invalid") {
    return Response.json(
      { success: false, cancelled: false },
      { status: 500 },
    );
  }

  if (cancellationResult.releasedAppointmentId === null) {
    return Response.json({
      success: true,
      cancelled: true,
      nextOfferCreated: false,
    });
  }

  let offerData: unknown;

  try {
    const result = await supabaseAdmin.rpc("create_next_waitlist_offer", {
      p_appointment_id: cancellationResult.releasedAppointmentId,
    });

    if (result.error) {
      return Response.json({
        success: true,
        cancelled: true,
        nextOfferCreated: false,
        nextOfferProcessingFailed: true,
      });
    }

    offerData = result.data;
  } catch {
    return Response.json({
      success: true,
      cancelled: true,
      nextOfferCreated: false,
      nextOfferProcessingFailed: true,
    });
  }

  const offerResult = getOfferResult(offerData);

  if (offerResult.kind === "none") {
    return Response.json({
      success: true,
      cancelled: true,
      nextOfferCreated: false,
    });
  }

  if (offerResult.kind === "invalid") {
    return Response.json({
      success: true,
      cancelled: true,
      nextOfferCreated: false,
      nextOfferProcessingFailed: true,
    });
  }

  const emailSent = await sendWaitlistOfferEmail(offerResult.offer);

  return Response.json({
    success: true,
    cancelled: true,
    nextOfferCreated: true,
    emailSent,
  });
}
