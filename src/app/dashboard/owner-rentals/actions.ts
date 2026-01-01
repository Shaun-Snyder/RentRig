"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";
import { sendInvoiceEmail } from "@/lib/email";

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
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
  endExclusive: string;
  status: string;
  pricePerDay: number;
  days: number;
  subtotal: number;
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
  draw(`End (exclusive): ${formatDate(opts.endExclusive)}`, 11);
  draw(`Status: ${opts.status}`, 11);
  y -= 6;

  // Charges
  draw("Charges (estimate)", 12, true);
  draw(`Daily rate: ${money(opts.pricePerDay)}`, 11);
  draw(`Days: ${opts.days}`, 11);
  draw(`Subtotal: ${money(opts.subtotal)}`, 11);
  draw(`Service fee (10%): ${money(opts.serviceFee)}`, 11);
  draw(`Total (pre-tax estimate): ${money(opts.total)}`, 11);

  if (opts.deposit > 0) {
    y -= 6;
    draw(`Security deposit (refundable): ${money(opts.deposit)}`, 11);
    draw(`Total + deposit: ${money(opts.total + opts.deposit)}`, 11);
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
      listings (
        id,
        owner_id,
        title,
        city,
        state,
        price_per_day,
        security_deposit
      )
    `
    )
    .eq("id", rentalId)
    .single();

  if (rentalErr || !rental) {
    return { ok: false, error: rentalErr?.message || "Rental not found" as const };
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
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const renterId = rental.renter_id as string;
  const ownerId = listing.owner_id as string;

  // renter email from auth admin
  const { data: renterUserRes, error: renterUserErr } = await admin.auth.admin.getUserById(renterId);
  if (renterUserErr) {
    // Still approved; just report email failure
    revalidatePath("/dashboard/owner-rentals");
    return { ok: true, emailed: false, error: `Approved, but email failed: ${renterUserErr.message}` as const };
  }

  const renterEmail = renterUserRes?.user?.email || "";
  if (!renterEmail) {
    revalidatePath("/dashboard/owner-rentals");
    return { ok: true, emailed: false, error: "Approved, but renter has no email" as const };
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
  const pricePerDay = Number(listing.price_per_day ?? 0);
  const start = rental.start_date as string;
  const endExclusive = rental.end_date as string;

  const days =
    Math.max(
      0,
      Math.round(
        (Date.parse(`${endExclusive}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000
      )
    ) || 0;

  const subtotal = days * pricePerDay;
  const serviceFee = Math.round(subtotal * 0.1 * 100) / 100;
  const total = subtotal + serviceFee;

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
    endExclusive,
    status: "approved",
    pricePerDay,
    days,
    subtotal,
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
      `End: ${formatDate(endExclusive)}\n` +
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
  const { error } = await supabase.from("rentals").update({ status: "rejected" }).eq("id", rentalId);
  if (error) return { ok: false, error: error.message as const };

  revalidatePath("/dashboard/owner-rentals");
  revalidatePath("/dashboard/rentals");
  return { ok: true };
}
