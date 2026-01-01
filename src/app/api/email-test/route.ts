export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { sendInvoiceEmail } from "@/lib/email";

export async function GET() {
  try {
    // simple tiny PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    page.drawText("RentRig SMTP Test OK", { x: 60, y: 720, size: 18, font });
    const pdfBytes = await pdfDoc.save();

    // send to yourself (SMTP_USER)
    const to = process.env.SMTP_USER!;
    await sendInvoiceEmail({
      to,
      subject: "RentRig SMTP Test",
      text: "If you received this, Gmail SMTP is working.",
      pdfBytes,
      filename: "rentrig-smtp-test.pdf",
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "error" }, { status: 500 });
  }
}
