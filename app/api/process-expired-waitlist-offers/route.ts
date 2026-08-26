import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const MAX_EXPIRED_OFFERS_PER_RUN = 50;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const APP_BASE_URL = (
  process.env.APP_BASE_URL || "http://localhost:3000"
).replace(/\/+$/, "");

type DatabaseId = number | string;

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

function getReleasedAppointmentId(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return getDatabaseId(
    (value as Record<string, unknown>).released_appointment_id,
  );
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

  const { data, error } = await supabaseAdmin
    .from("waitlist_offers")
    .select("released_appointment_id")
    .eq("status", "pending")
    .lte("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true })
    .limit(MAX_EXPIRED_OFFERS_PER_RUN);

  if (error || (data !== null && !Array.isArray(data))) {
    return Response.json(
      { success: false, error: "Istekle ponude trenutno nije moguće učitati." },
      { status: 500 },
    );
  }

  const releasedAppointments = new Map<string, DatabaseId>();
  let invalidRows = 0;

  for (const row of data ?? []) {
    const appointmentId = getReleasedAppointmentId(row);

    if (appointmentId === null) {
      invalidRows += 1;
      continue;
    }

    releasedAppointments.set(String(appointmentId), appointmentId);
  }

  const summary = {
    success: true,
    expiredAppointmentsProcessed: 0,
    newOffersCreated: 0,
    emailsSent: 0,
    emailFailures: 0,
    processingFailures: invalidRows,
  };

  for (const releasedAppointmentId of releasedAppointments.values()) {
    summary.expiredAppointmentsProcessed += 1;

    try {
      const { data: offerData, error: offerError } = await supabaseAdmin.rpc(
        "create_next_waitlist_offer",
        {
          p_appointment_id: releasedAppointmentId,
        },
      );

      if (offerError) {
        summary.processingFailures += 1;
        continue;
      }

      const offerResult = getOfferResult(offerData);

      if (offerResult.kind === "none") {
        continue;
      }

      if (offerResult.kind === "invalid") {
        summary.processingFailures += 1;
        continue;
      }

      summary.newOffersCreated += 1;

      const emailWasSent = await sendWaitlistOfferEmail(offerResult.offer);

      if (emailWasSent) {
        summary.emailsSent += 1;
      } else {
        summary.emailFailures += 1;
      }
    } catch {
      summary.processingFailures += 1;
    }
  }

  return Response.json(summary);
}
