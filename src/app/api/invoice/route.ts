
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { PDFDocument, StandardFonts } from "pdf-lib";

/* ---------------- Helpers ---------------- */

function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function makeInvoiceNumber(rentalId: string) {
  const tail = rentalId.replace(/-/g, "").slice(-8).toUpperCase();
  return `RR-${tail}`;
}

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

/* ---------------- Route ---------------- */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rentalId = searchParams.get("rental_id")?.trim();

    if (!rentalId) {
      return NextResponse.json({ error: "Missing rental_id" }, { status: 400 });
    }

    // Authenticated user client
    const supabase = await createClient();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user;

    if (authErr || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: rental, error: rentalErr } = await supabase
      .from("rentals")
      .select(
        `
        id,
        renter_id,
        start_date,
        end_date,
        status,
        created_at,

        delivery_selected,
        delivery_fee,

        operator_selected,
        operator_rate,
        operator_rate_unit,
        operator_days,
        operator_hours,
        operator_total,

        listings (
          id,
          owner_id,
          title,
          city,
          state,
          price_per_day,
          security_deposit,
          cancellation_policy
        )
      `
      )
      .eq("id", rentalId)
      .single();

    if (rentalErr) {
      return NextResponse.json({ error: rentalErr.message }, { status: 400 });
    }
    if (!rental) {
      return NextResponse.json({ error: "Rental not found" }, { status: 404 });
    }

    const listing: any = rental.listings;

    // Permission check
    const isRenter = rental.renter_id === user.id;
    const isOwner = listing?.owner_id === user.id;
    if (!isRenter && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Service-role client for profile names
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const renterId = rental.renter_id;
    const ownerId = listing.owner_id;

    const [{ data: renterProfile }, { data: ownerProfile }] = await Promise.all([
      admin.from("profiles").select("full_name").eq("id", renterId).maybeSingle(),
      admin.from("profiles").select("full_name").eq("id", ownerId).maybeSingle(),
    ]);

    const renterName =
      renterProfile?.full_name?.trim() || `User ${renterId.slice(0, 8)}`;
    const ownerName =
      ownerProfile?.full_name?.trim() || `User ${ownerId.slice(0, 8)}`;

    /* -------- Pricing -------- */

    const pricePerDay = Number(listing.price_per_day ?? 0);
    const start = rental.start_date;
    const endExclusive = rental.end_date;

    const days =
      Math.max(
        0,
        Math.round(
          (Date.parse(`${endExclusive}T00:00:00Z`) -
            Date.parse(`${start}T00:00:00Z`)) /
            86400000
        )
      ) || 0;

    const rentalSubtotal = days * pricePerDay;

    // Delivery snapshot
    const deliverySelected = Boolean(rental.delivery_selected);
    const deliveryFee = Math.max(0, Number(rental.delivery_fee ?? 0) || 0);
    const deliveryCharge = deliverySelected ? deliveryFee : 0;

    // ✅ Operator snapshot (authoritative from rentals)
    const operatorSelected = Boolean(rental.operator_selected);
    const operatorRateUnit: "day" | "hour" = rental.operator_rate_unit === "hour" ? "hour" : "day";
    const operatorRate = Math.max(0, Number(rental.operator_rate ?? 0) || 0);
    const operatorDays = Math.max(0, Number(rental.operator_days ?? 0) || 0);
    const operatorHours = Math.max(0, Number(rental.operator_hours ?? 0) || 0);
    const operatorTotal = Math.max(0, Number(rental.operator_total ?? 0) || 0);

    const operatorCharge = operatorSelected ? operatorTotal : 0;

    // Service fee applied to (rental subtotal + add-ons)
    const preFee = rentalSubtotal + deliveryCharge + operatorCharge;
    const serviceFee = Math.round(preFee * 0.1 * 100) / 100;
    const total = preFee + serviceFee;

    const deposit = Math.max(0, Number(listing.security_deposit ?? 0) || 0);

    /* -------- PDF -------- */

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const { height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Logo
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    let y = height - 60;

    if (fs.existsSync(logoPath)) {
      const logoBytes = fs.readFileSync(logoPath);
      const logoImage = await pdfDoc.embedPng(logoBytes);

      const img = logoImage.scale(1);
      const maxW = 140;
      const maxH = 70;

      const scale = Math.min(maxW / img.width, maxH / img.height);
      const logoW = img.width * scale;
      const logoH = img.height * scale;

      const padding = 40;

      page.drawImage(logoImage, {
        x: padding,
        y: height - padding - logoH,
        width: logoW,
        height: logoH,
      });

      y = height - padding - logoH - 30;
    }

    const left = 60;

    const draw = (text: string, size = 11, bold = false) => {
      page.drawText(text, {
        x: left,
        y,
        size,
        font: bold ? fontBold : font,
      });
      y -= size + 10;
    };

    /* -------- Header -------- */

    draw("RentRig Invoice", 18, true);
    y -= 4;

    draw(`Invoice #: ${makeInvoiceNumber(rental.id)}`, 10);
    draw(`Issued: ${formatDate(new Date().toISOString().slice(0, 10))}`, 10);
    draw(`Rental ID: ${rental.id}`, 9);

    draw(`Billed To: ${renterName}`, 10);
    draw(`Issued By: ${ownerName}`, 10);

    y -= 10;

    /* -------- Body -------- */

    draw("Listing", 12, true);
    draw(listing.title, 11);
    const loc = [listing.city, listing.state].filter(Boolean).join(", ");
    if (loc) draw(loc, 10);
    y -= 6;

    draw("Rental Dates", 12, true);
    draw(`Start: ${formatDate(start)}`, 11);
    draw(`End (exclusive): ${formatDate(endExclusive)}`, 11);
    draw(`Status: ${rental.status}`, 11);
    y -= 6;

    draw("Charges (estimate)", 12, true);
    draw(`Daily rate: ${money(pricePerDay)}`, 11);
    draw(`Days: ${days}`, 11);
    draw(`Rental subtotal: ${money(rentalSubtotal)}`, 11);

    if (operatorSelected && operatorCharge > 0) {
      if (operatorRateUnit === "day") {
        draw(
          `Operator service: ${operatorDays} day(s) @ ${money(operatorRate)}/day = ${money(operatorCharge)}`,
          11
        );
      } else {
        draw(
          `Operator service: ${operatorHours} hour(s) @ ${money(operatorRate)}/hour = ${money(operatorCharge)}`,
          11
        );
      }
    }

    if (deliverySelected && deliveryCharge > 0) {
      draw(`Delivery fee: ${money(deliveryCharge)}`, 11);
    }

    draw(`Service fee (10%): ${money(serviceFee)}`, 11);
    draw(`Total (pre-tax estimate): ${money(total)}`, 11);

    if (deposit > 0) {
      y -= 6;
      draw(`Security deposit (refundable): ${money(deposit)}`, 11);
      draw(`Total + deposit: ${money(total + deposit)}`, 11);
    }

    y -= 12;
    draw("Notes:", 11, true);
    draw("- Taxes not included.", 10);
    draw("- Deposit shown for transparency (payments not implemented yet).", 10);

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="rentrig-invoice-${rental.id}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
