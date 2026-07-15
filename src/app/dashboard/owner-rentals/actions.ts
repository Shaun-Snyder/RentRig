"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";
import { sendInvoiceEmail } from "@/lib/email";

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

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

async function generateInvoicePdfBytes(opts: {
  rentalId: string;
  renterName: string;
  ownerName: string;
  renterEmail: string;
  listingTitle: string;
  city?: string | null;
  state?: string | null;
  start: string;
  end: string;
  status: string;
  pricePerDay: number;
  days: number;
  rentalSubtotal: number;
  deliveryCharge: number;
  discount: number;
  discountNote?: string | null;
  serviceName?: string | null;
  serviceUnit?: "day" | "hour" | null;
  serviceRate: number;
  serviceQuantity: number;
  serviceCharge: number;
  serviceFee: number;
  total: number;
  deposit: number;
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const { height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Logo (optional)
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
    page.drawText(text, { x: left, y, size, font: bold ? fontBold : font });
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

  // Header
  draw("RentRig Invoice", 18, true);
  y -= 4;

  draw(`Invoice #: ${makeInvoiceNumber(opts.rentalId)}`, 10);
  draw(`Issued: ${formatDate(new Date().toISOString().slice(0, 10))}`, 10);
  draw(`Rental ID: ${opts.rentalId}`, 9);

  draw(`Billed To: ${opts.renterName}`, 10);
  draw(`Issued By: ${opts.ownerName}`, 10);
  draw(`Email: ${opts.renterEmail}`, 9);

  y -= 10;

  // Listing
  draw("Listing", 12, true);
  draw(opts.listingTitle, 11);
  const loc = [opts.city, opts.state].filter(Boolean).join(", ");
  if (loc) draw(loc, 10);
  y -= 6;

  // Dates
  draw("Rental Dates", 12, true);
  draw(`Start: ${formatDate(opts.start)}`, 11);
  draw(`End: ${formatDate(opts.end)}`, 11);
  draw(`Status: ${opts.status}`, 11);
  y -= 6;

  // Charges
  draw("Charges (estimate)", 12, true);
  draw(`Rental period: ${opts.days} day${opts.days === 1 ? "" : "s"}`, 10);

  drawChargeRow(
    `Equipment rental — ${opts.days} day${opts.days === 1 ? "" : "s"} @ ${money(opts.pricePerDay)}/day`,
    opts.rentalSubtotal,
  );

  if (opts.serviceCharge > 0 && opts.serviceName && opts.serviceUnit) {
    const quantityLabel =
      opts.serviceUnit === "day"
        ? `${opts.serviceQuantity} day${opts.serviceQuantity === 1 ? "" : "s"}`
        : `${opts.serviceQuantity} hour${opts.serviceQuantity === 1 ? "" : "s"}`;

    drawChargeRow(
      `${opts.serviceName} — ${quantityLabel} @ ${money(opts.serviceRate)}/${opts.serviceUnit}`,
      opts.serviceCharge,
    );
  }

  if (opts.deliveryCharge > 0) {
    drawChargeRow("Delivery fee", opts.deliveryCharge);
  }

  if (opts.discount > 0) {
    drawChargeRow(
      opts.discountNote
        ? `Owner discount — ${opts.discountNote}`
        : "Owner discount",
      opts.discount,
      {
        negative: true,
      },
    );
  }

  y -= 4;
  drawChargeRow("RentRig service fee (10%)", opts.serviceFee);

  y -= 4;
  drawChargeRow("Total before security deposit", opts.total, {
    bold: true,
  });

  if (opts.deposit > 0) {
    y -= 8;
    drawChargeRow("Refundable security deposit", opts.deposit);

    y -= 4;
    drawChargeRow("Total due", opts.total + opts.deposit, {
      bold: true,
    });
  } else {
    y -= 4;
    drawChargeRow("Total due", opts.total, {
      bold: true,
    });
  }

  y -= 12;
  draw("Notes:", 11, true);
  draw("- Taxes not included.", 10);
  draw("- Deposit shown for transparency (payments not implemented yet).", 10);

  return await pdfDoc.save();
}

export async function approveRentalAndEmail(rentalId: string) {
  // Authenticated owner context
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return { ok: false, error: "Not authenticated" as const };
  }

  // Fetch rental + listing (RLS should ensure owner-only visibility)
  const { data: rental, error: rentalErr } = await supabase
    .from("rentals")
    .select(
      `
      id,
      renter_id,
      start_date,
      end_date,
      status,
      listing_id,

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
        security_deposit
      )
    `,
    )
    .eq("id", rentalId)
    .single();

  if (rentalErr || !rental) {
    return {
      ok: false,
      error: rentalErr?.message || ("Rental not found" as const),
    };
  }

  const listing: any = (rental as any).listings;

  // Extra safety: make sure caller is the owner
  if (!listing?.owner_id || listing.owner_id !== user.id) {
    return { ok: false, error: "Forbidden" as const };
  }

  // Update status -> approved
  const { error: updErr } = await supabase
    .from("rentals")
    .update({ status: "approved" })
    .eq("id", rentalId);

  if (updErr) {
    return { ok: false, error: updErr.message as const };
  }

  // Admin client for renter email + profile names (bypass RLS safely server-side)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const renterId = rental.renter_id as string;
  const ownerId = listing.owner_id as string;

  // renter email from auth admin
  const { data: renterUserRes, error: renterUserErr } =
    await admin.auth.admin.getUserById(renterId);
  if (renterUserErr) {
    // Still approved; just report email failure
    revalidatePath("/dashboard/owner-rentals");
    return {
      ok: true,
      emailed: false,
      error: `Approved, but email failed: ${renterUserErr.message}` as const,
    };
  }

  const renterEmail = renterUserRes?.user?.email || "";
  if (!renterEmail) {
    revalidatePath("/dashboard/owner-rentals");
    return {
      ok: true,
      emailed: false,
      error: "Approved, but renter has no email" as const,
    };
  }

  const [{ data: renterProfile }, { data: ownerProfile }] = await Promise.all([
    admin.from("profiles").select("full_name").eq("id", renterId).maybeSingle(),
    admin.from("profiles").select("full_name").eq("id", ownerId).maybeSingle(),
  ]);

  const renterName =
    renterProfile?.full_name?.trim() || `User ${renterId.slice(0, 8)}`;
  const ownerName =
    ownerProfile?.full_name?.trim() || `User ${ownerId.slice(0, 8)}`;

  // Pricing math (same as invoice)
  const pricePerDay = Math.max(0, Number(listing.price_per_day ?? 0) || 0);

  const start = rental.start_date as string;
  const end = rental.end_date as string;

  const dateDifference =
    Math.round(
      (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
        86400000,
    ) || 0;

  const days = Math.max(1, dateDifference + 1);
  const rentalSubtotal = days * pricePerDay;

  const deliverySelected = Boolean(rental.delivery_selected);
  const deliveryFee = Math.max(0, Number(rental.delivery_fee ?? 0) || 0);
  const deliveryCharge = deliverySelected ? deliveryFee : 0;

  const serviceChoice = String(rental.service_choice ?? "none");
  const serviceUnit: "day" | "hour" =
    rental.service_unit === "hour" ? "hour" : "day";

  const serviceRate = Math.max(0, Number(rental.service_rate ?? 0) || 0);
  const serviceDays = Math.max(0, Number(rental.service_days ?? 0) || 0);
  const serviceHours = Math.max(0, Number(rental.service_hours ?? 0) || 0);
  const storedServiceTotal = Math.max(
    0,
    Number(rental.service_total ?? 0) || 0,
  );

  const operatorSelected = Boolean(rental.operator_selected);
  const operatorRateUnit: "day" | "hour" =
    rental.operator_rate_unit === "hour" ? "hour" : "day";
  const operatorRate = Math.max(0, Number(rental.operator_rate ?? 0) || 0);
  const operatorDays = Math.max(0, Number(rental.operator_days ?? 0) || 0);
  const operatorHours = Math.max(0, Number(rental.operator_hours ?? 0) || 0);
  const operatorTotal = Math.max(0, Number(rental.operator_total ?? 0) || 0);

  const hasUnifiedService = serviceChoice !== "none" && storedServiceTotal > 0;

  const serviceCharge = hasUnifiedService
    ? storedServiceTotal
    : operatorSelected
      ? operatorTotal
      : 0;

  const serviceName = hasUnifiedService
    ? serviceChoice === "driver_labor"
      ? "Driver + Labor"
      : serviceChoice === "driver"
        ? "Driver"
        : serviceChoice === "operator"
          ? "Operator"
          : "Service"
    : operatorSelected
      ? "Operator"
      : null;

  const invoiceServiceUnit = hasUnifiedService
    ? serviceUnit
    : operatorSelected
      ? operatorRateUnit
      : null;

  const invoiceServiceRate = hasUnifiedService
    ? serviceRate
    : operatorSelected
      ? operatorRate
      : 0;

  const invoiceServiceQuantity =
    invoiceServiceUnit === "hour"
      ? hasUnifiedService
        ? serviceHours
        : operatorHours
      : hasUnifiedService
        ? serviceDays
        : operatorDays;

  const preDiscount = rentalSubtotal + deliveryCharge + serviceCharge;

  const rawDiscount = Math.max(
    0,
    Number(rental.owner_discount_amount ?? 0) || 0,
  );
  const discount = Math.min(rawDiscount, preDiscount);

  const preFee = preDiscount - discount;
  const serviceFee = Math.round(preFee * 0.1 * 100) / 100;
  const total = preFee + serviceFee;

  const discountNote = String(rental.owner_discount_note ?? "").trim();

  const deposit = Math.max(0, Number(listing.security_deposit ?? 0) || 0);

  // Build PDF
  const pdfBytes = await generateInvoicePdfBytes({
    rentalId,
    renterName,
    ownerName,
    renterEmail,
    listingTitle: listing.title ?? "Listing",
    city: listing.city ?? null,
    state: listing.state ?? null,
    start,
    end,
    status: "approved",
    pricePerDay,
    days,
    rentalSubtotal,
    deliveryCharge,
    discount,
    discountNote,
    serviceName,
    serviceUnit: invoiceServiceUnit,
    serviceRate: invoiceServiceRate,
    serviceQuantity: invoiceServiceQuantity,
    serviceCharge,
    serviceFee,
    total,
    deposit,
  });

  // Email it
  await sendInvoiceEmail({
    to: renterEmail,
    subject: `Your RentRig invoice (${makeInvoiceNumber(rentalId)})`,
    text:
      `Hi ${renterName},\n\n` +
      `Attached is your RentRig invoice for ${listing.title ?? "your rental"}.\n\n` +
      `Start: ${formatDate(start)}\n` +
      `End: ${formatDate(end)}\n` +
      `Total (pre-tax estimate): ${money(total)}\n\n` +
      `Thanks,\nRentRig`,
    pdfBytes,
    filename: `rentrig-invoice-${makeInvoiceNumber(rentalId)}.pdf`,
  });

  revalidatePath("/dashboard/owner-rentals");
  revalidatePath("/dashboard/rentals");

  return { ok: true, emailed: true as const };
}

export async function rejectRental(rentalId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) return { ok: false, error: "Not authenticated" as const };

  // Update status -> rejected (RLS should enforce ownership)
  const { error } = await supabase
    .from("rentals")
    .update({ status: "rejected" })
    .eq("id", rentalId);
  if (error) return { ok: false, error: error.message as const };

  revalidatePath("/dashboard/owner-rentals");
  revalidatePath("/dashboard/rentals");
  return { ok: true };
}
export async function markRentalCompleted(rentalId: string) {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) return { ok: false, error: "Not authenticated" as const };

  // Verify ownership (same pattern as approve)
  const { data: rental } = await supabase
    .from("rentals")
    .select("id, listing:listings(owner_id)")
    .eq("id", rentalId)
    .single();

  const ownerId = (rental as any)?.listing?.owner_id;

  if (!rental || ownerId !== user.id) {
    return { ok: false, error: "Forbidden" as const };
  }

  // Only allow from approved → completed
  const { error } = await supabase
    .from("rentals")
    .update({ status: "completed" })
    .eq("id", rentalId)
    .eq("status", "approved");

  if (error) return { ok: false, error: error.message as const };

  revalidatePath("/dashboard/owner-rentals");
  revalidatePath("/dashboard/rentals");

  return { ok: true };
}

export async function updateRentalDeposit(formData: FormData) {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return { ok: false, error: "Not authenticated" as const };
  }

  const rentalId = String(formData.get("rental_id") ?? "").trim();

  if (!rentalId) {
    return { ok: false, error: "Missing rental ID" as const };
  }

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select(
      `
      id,
      listing:listings (
        owner_id,
        security_deposit
      )
    `,
    )
    .eq("id", rentalId)
    .single();

  if (rentalError || !rental) {
    return {
      ok: false,
      error: rentalError?.message || "Rental not found",
    };
  }

  const listing: any = rental.listing;

  if (!listing?.owner_id || listing.owner_id !== user.id) {
    return { ok: false, error: "Forbidden" as const };
  }

  const depositAmount = Math.max(0, Number(listing.security_deposit ?? 0) || 0);

  const damageDeduction = Math.max(
    0,
    Number(formData.get("deposit_damage_deduction") ?? 0) || 0,
  );
  const cleaningDeduction = Math.max(
    0,
    Number(formData.get("deposit_cleaning_deduction") ?? 0) || 0,
  );
  const fuelDeduction = Math.max(
    0,
    Number(formData.get("deposit_fuel_deduction") ?? 0) || 0,
  );
  const lateReturnDeduction = Math.max(
    0,
    Number(formData.get("deposit_late_return_deduction") ?? 0) || 0,
  );
  const otherDeduction = Math.max(
    0,
    Number(formData.get("deposit_other_deduction") ?? 0) || 0,
  );

  const totalDeductions = Math.min(
    depositAmount,
    damageDeduction +
      cleaningDeduction +
      fuelDeduction +
      lateReturnDeduction +
      otherDeduction,
  );

  const refundAmount = Math.max(0, depositAmount - totalDeductions);

  let depositStatus = "collected";

  if (depositAmount <= 0) {
    depositStatus = "fully_refunded";
  } else if (refundAmount === depositAmount) {
    depositStatus = "fully_refunded";
  } else if (refundAmount > 0) {
    depositStatus = "partially_refunded";
  } else {
    depositStatus = "retained";
  }

  const otherReason = String(formData.get("deposit_other_reason") ?? "").trim();
  const ownerNotes = String(formData.get("deposit_owner_notes") ?? "").trim();
  const renterExplanation = String(
    formData.get("deposit_renter_explanation") ?? "",
  ).trim();

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("rentals")
    .update({
      deposit_status: depositStatus,
      deposit_collected_at: now,
      deposit_damage_deduction: damageDeduction,
      deposit_cleaning_deduction: cleaningDeduction,
      deposit_fuel_deduction: fuelDeduction,
      deposit_late_return_deduction: lateReturnDeduction,
      deposit_other_deduction: otherDeduction,
      deposit_other_reason: otherReason || null,
      deposit_owner_notes: ownerNotes || null,
      deposit_renter_explanation: renterExplanation || null,
      deposit_refund_amount: refundAmount,
      deposit_refunded_at:
        depositStatus === "fully_refunded" ||
        depositStatus === "partially_refunded"
          ? now
          : null,
    })
    .eq("id", rentalId);

  if (updateError) {
    return { ok: false, error: updateError.message as const };
  }

  revalidatePath(`/dashboard/owner-rentals/${rentalId}`);
  revalidatePath(`/dashboard/rentals/${rentalId}`);

  return { ok: true };
}
