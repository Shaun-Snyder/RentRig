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

rental_rate_unit,
rental_rate,
rental_quantity,
rental_subtotal,
security_deposit_amount,

        delivery_selected,
        delivery_fee,

        owner_discount_amount,
        owner_discount_note,

        service_choice,
        service_unit,
        service_rate,
        service_days,
        service_hours,
        service_total,

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
      `,
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
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const renterId = rental.renter_id;
    const ownerId = listing.owner_id;

    const [{ data: renterProfile }, { data: ownerProfile }] = await Promise.all(
      [
        admin
          .from("profiles")
          .select("full_name")
          .eq("id", renterId)
          .maybeSingle(),
        admin
          .from("profiles")
          .select("full_name")
          .eq("id", ownerId)
          .maybeSingle(),
      ],
    );

    const renterName =
      renterProfile?.full_name?.trim() || `User ${renterId.slice(0, 8)}`;
    const ownerName =
      ownerProfile?.full_name?.trim() || `User ${ownerId.slice(0, 8)}`;

    /* -------- Pricing -------- */

    const start = rental.start_date;
    const end = rental.end_date;

    const dateDifference =
      Math.round(
        (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
          86400000,
      ) || 0;

    const fallbackDays = Math.max(1, dateDifference);

    const pricePerDay = Math.max(
      0,
      Number(rental.rental_rate ?? listing.price_per_day ?? 0) || 0,
    );

    const days = Math.max(
      1,
      Number(rental.rental_quantity ?? fallbackDays) || fallbackDays,
    );

    const rentalSubtotal = Math.max(
      0,
      Number(rental.rental_subtotal ?? days * pricePerDay) || 0,
    );

    // Delivery snapshot
    const deliverySelected = Boolean(rental.delivery_selected);
    const deliveryFee = Math.max(0, Number(rental.delivery_fee ?? 0) || 0);
    const deliveryCharge = deliverySelected ? deliveryFee : 0;

    // Unified service snapshot
    const serviceChoice = String(rental.service_choice ?? "none");
    const serviceUnit = rental.service_unit === "hour" ? "hour" : "day";

    const serviceRate = Math.max(0, Number(rental.service_rate ?? 0) || 0);
    const serviceDays = Math.max(0, Number(rental.service_days ?? 0) || 0);
    const serviceHours = Math.max(0, Number(rental.service_hours ?? 0) || 0);
    const storedServiceTotal = Math.max(
      0,
      Number(rental.service_total ?? 0) || 0,
    );

    // Legacy operator fallback for rentals created before unified service fields.
    const operatorSelected = Boolean(rental.operator_selected);
    const operatorRateUnit: "day" | "hour" =
      rental.operator_rate_unit === "hour" ? "hour" : "day";
    const operatorRate = Math.max(0, Number(rental.operator_rate ?? 0) || 0);
    const operatorDays = Math.max(0, Number(rental.operator_days ?? 0) || 0);
    const operatorHours = Math.max(0, Number(rental.operator_hours ?? 0) || 0);
    const operatorTotal = Math.max(0, Number(rental.operator_total ?? 0) || 0);

    const hasUnifiedService =
      serviceChoice !== "none" && storedServiceTotal > 0;

    const serviceCharge = hasUnifiedService
      ? storedServiceTotal
      : operatorSelected
        ? operatorTotal
        : 0;

    // Charges before owner discount
    const preDiscount = rentalSubtotal + deliveryCharge + serviceCharge;

    const rawDiscount = Math.max(
      0,
      Number(rental.owner_discount_amount ?? 0) || 0,
    );
    const discount = Math.min(rawDiscount, preDiscount);

    const preFee = preDiscount - discount;

    // Customer total does not include RentRig's marketplace fee.
    // RentRig's fee will be deducted from the transaction/payout later.
    const total = preFee;

    const deposit = Math.max(
      0,
      Number(rental.security_deposit_amount ?? listing.security_deposit ?? 0) ||
        0,
    );

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

    const drawChargeRow = (
      label: string,
      amount: number,
      options?: {
        bold?: boolean;
        negative?: boolean;
      },
    ) => {
      const size = 11;
      const rowFont = options?.bold ? fontBold : font;
      const formattedAmount = `${options?.negative ? "-" : ""}${money(amount)}`;
      const right = 552;

      page.drawText(label, {
        x: left,
        y,
        size,
        font: rowFont,
      });

      page.drawText(formattedAmount, {
        x: right - rowFont.widthOfTextAtSize(formattedAmount, size),
        y,
        size,
        font: rowFont,
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
    draw(`End: ${formatDate(end)}`, 11);
    draw(`Status: ${rental.status}`, 11);
    y -= 6;

    draw("Charges (estimate)", 12, true);
    draw(`Rental period: ${days} day${days === 1 ? "" : "s"}`, 10);
    drawChargeRow(
      `Equipment rental — ${days} day${days === 1 ? "" : "s"} @ ${money(pricePerDay)}/day`,
      rentalSubtotal,
    );

    if (discount > 0) {
      const note = String(rental.owner_discount_note ?? "").trim();

      drawChargeRow(
        note ? `Owner discount — ${note}` : "Owner discount",
        discount,
        {
          negative: true,
        },
      );
    }

    if (serviceCharge > 0) {
      if (hasUnifiedService) {
        const serviceName =
          serviceChoice === "driver_labor"
            ? "Driver + Labor"
            : serviceChoice === "driver"
              ? "Driver"
              : serviceChoice === "operator"
                ? "Operator"
                : "Service";

        const serviceQuantity =
          serviceUnit === "day"
            ? `${serviceDays} day${serviceDays === 1 ? "" : "s"}`
            : `${serviceHours} hour${serviceHours === 1 ? "" : "s"}`;

        drawChargeRow(
          `${serviceName} — ${serviceQuantity} @ ${money(serviceRate)}/${serviceUnit}`,
          serviceCharge,
        );
      } else if (operatorSelected) {
        const operatorQuantity =
          operatorRateUnit === "day"
            ? `${operatorDays} day${operatorDays === 1 ? "" : "s"}`
            : `${operatorHours} hour${operatorHours === 1 ? "" : "s"}`;

        drawChargeRow(
          `Operator — ${operatorQuantity} @ ${money(operatorRate)}/${operatorRateUnit}`,
          serviceCharge,
        );
      }
    }

    if (deliverySelected && deliveryCharge > 0) {
      drawChargeRow("Delivery fee", deliveryCharge);
    }

    y -= 4;
    drawChargeRow("Total before security deposit", total, {
      bold: true,
    });

    y -= 4;
    drawChargeRow("Total before security deposit", total, {
      bold: true,
    });

    if (deposit > 0) {
      y -= 8;
      drawChargeRow("Refundable security deposit", deposit);

      y -= 4;
      drawChargeRow("Total due", total + deposit, {
        bold: true,
      });
    } else {
      y -= 4;
      drawChargeRow("Total due", total, {
        bold: true,
      });
    }

    y -= 12;
    draw("Notes:", 11, true);
    draw("- Taxes not included.", 10);
    draw(
      "- Deposit shown for transparency (payments not implemented yet).",
      10,
    );

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
      { status: 500 },
    );
  }
}
