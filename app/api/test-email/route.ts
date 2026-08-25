import { Resend } from "resend";

export const runtime = "nodejs";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Nepoznata greška.";
}

export async function POST() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return Response.json(
      { success: false, error: "RESEND_API_KEY nije podešen." },
      { status: 500 },
    );
  }

  const resend = new Resend(apiKey);

  try {
    const response = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "delivered@resend.dev",
      subject: "Rehab Booking - test email",
      html: "<p>Resend integracija uspešno radi.</p>",
    });

    if (response.error) {
      return Response.json(
        { success: false, error: response.error.message },
        { status: 500 },
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
