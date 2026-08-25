"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const APP_BASE_URL = (
  process.env.APP_BASE_URL || "http://localhost:3000"
).replace(/\/+$/, "");

type DatabaseId = number | string;

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

export async function processPublicCancellationForWaitlist(
  cancelToken: string,
) {
  if (!UUID_PATTERN.test(cancelToken)) {
    return false;
  }

  try {
    const { data: appointment, error } = await supabaseAdmin
      .from("appointments")
      .select("id")
      .eq("cancel_token", cancelToken)
      .eq("status", "cancelled")
      .maybeSingle();
    const appointmentId = getDatabaseId(appointment?.id);

    if (error || appointmentId === null) {
      return false;
    }

    const response = await fetch(
      `${APP_BASE_URL}/api/process-waitlist-release`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, cancelToken }),
        cache: "no-store",
      },
    );

    return response.ok;
  } catch {
    return false;
  }
}
