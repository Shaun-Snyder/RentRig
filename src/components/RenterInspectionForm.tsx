"use client";

import React, { useState, useTransition } from "react";
import { createRentalInspection } from "@/app/rentals/actions";

type RentalRow = {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  buffer_days: number | null;
  message: string | null;
  created_at: string;
  renter_id: string;
  listing: {
    id: string;
    title: string;
  } | null;
};

// Same-style client-side normalizer used elsewhere:
// HEIC/HEIF -> JPEG + compress large images.
async function normalizeUploadFile(file: File): Promise<File> {
  // Extra safety on server/SSR
  if (typeof window === "undefined") return file;

  const nameLower = (file.name || "").toLowerCase();
  const typeLower = (file.type || "").toLowerCase();

  // ---------- HEIC/HEIF -> JPEG ----------
  const isHeic =
    nameLower.endsWith(".heic") ||
    nameLower.endsWith(".heif") ||
    typeLower === "image/heic" ||
    typeLower === "image/heif" ||
    typeLower === "image/heic-sequence" ||
    typeLower === "image/heif-sequence";

  if (isHeic) {
    type Heic2AnyFn = (opts: {
      blob: Blob;
      toType: string;
      quality?: number;
    }) => Promise<Blob | Blob[]>;

    // Dynamic import so it never runs on the server
    const mod = (await import("heic2any")) as unknown as {
      default?: Heic2AnyFn;
    };

    const heic2any = (mod.default ?? (mod as unknown as Heic2AnyFn)) as Heic2AnyFn;

    const out = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.9,
    });

    const blob: Blob = Array.isArray(out) ? out[0] : out;
    const base = file.name ? file.name.replace(/\.(heic|heif)$/i, "") : "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  }

  // ---------- Compress very large images ----------
  if (!typeLower.startsWith("image/")) return file;

  const MAX_BYTES = 6 * 1024 * 1024; // 6MB
  const MAX_DIM = 2400; // cap longest edge
  if (file.size <= MAX_BYTES) return file;

  // Keep PNG as PNG; otherwise JPEG
  const outType = typeLower.includes("png") ? "image/png" : "image/jpeg";
  const quality = outType === "image/jpeg" ? 0.82 : undefined;

  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });

    const srcW = bitmap.width;
    const srcH = bitmap.height;
    if (!srcW || !srcH) return file;

    const scale = Math.min(1, MAX_DIM / Math.max(srcW, srcH));
    const outW = Math.max(1, Math.round(srcW * scale));
    const outH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, outW, outH);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), outType, quality);
    });

    if (!blob) return file;
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(
      /\.[a-z0-9]+$/i,
      outType === "image/png" ? ".png" : ".jpg"
    );

    return new File([blob], newName, {
      type: outType,
      lastModified: Date.now(),
    });
  } catch (e) {
    console.warn("Client compress failed; uploading original:", e);
    return file;
  }
}

export default function RenterInspectionForm({ rental }: { rental: RentalRow }) {
  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    // Normalize photos (HEIC → JPEG + compress) before sending
    const rawPhotos = fd.getAll("photos");
    const normalizedPhotos: File[] = [];

    for (const value of rawPhotos) {
      if (value instanceof File && value.size > 0) {
        const safeFile = await normalizeUploadFile(value);
        normalizedPhotos.push(safeFile);
      }
    }

    fd.delete("photos");
    for (const file of normalizedPhotos) {
      fd.append("photos", file);
    }

    startTransition(async () => {
      const res = await createRentalInspection(fd);
      if (!res.ok) {
        const m = res.message || "Could not save inspection.";
        alert(m);
        setMsg(m);
      } else {
        const m = res.message || "Inspection saved.";
        alert(m);
        setMsg(m);
        form.reset();
      }
    });
  }

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm grid gap-3">
      {/* Rental summary */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold">
            {rental.listing?.title ?? "Listing"}
          </div>

          <div className="text-sm text-slate-600">
            {rental.start_date} → {rental.end_date}
          </div>

          <div className="text-xs text-slate-500 mt-1">
            Status: {rental.status}
            {typeof rental.buffer_days === "number"
              ? ` • Buffer: ${rental.buffer_days}d`
              : ""}
          </div>
        </div>

        <div className="flex gap-2">
          <a
            href={`/api/invoice?rental_id=${encodeURIComponent(rental.id)}`}
            target="_blank"
            rel="noreferrer"
            className="rr-btn rr-btn-secondary"
          >
            Download invoice
          </a>
        </div>
      </div>

      {rental.message && (
        <div className="text-sm text-slate-700">
          <span className="font-medium">Your message:</span>{" "}
          {rental.message}
        </div>
      )}

      {/* Renter condition check-in / check-out form */}
      <div className="mt-3 border-t pt-3">
        <h3 className="text-sm font-semibold">Record condition (renter)</h3>
        <p className="mt-1 text-xs text-slate-600">
          Take photos and note condition before pickup and after return.
          All fields are optional so this works for trucks, cars, trailers,
          lifts, and other equipment.
        </p>

        <form
          onSubmit={handleSubmit}
          encType="multipart/form-data"
          className="mt-3 space-y-3"
        >
          {/* Hidden fields required by server action */}
          <input type="hidden" name="rental_id" value={rental.id} />
          <input type="hidden" name="role" value="renter" />

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1">
              <label className="text-xs font-medium">Phase</label>
              <select
                name="phase"
                className="rr-input w-full text-sm"
                defaultValue="checkin"
              >
                <option value="checkin">Check-in (before rental)</option>
                <option value="checkout">Check-out (after rental)</option>
              </select>
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-medium">
                Odometer (miles)
              </label>
              <input
                name="odometer"
                type="number"
                step="0.1"
                placeholder="Optional"
                className="rr-input w-full text-sm"
              />
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-medium">
                Hours used (equipment)
              </label>
              <input
                name="hours_used"
                type="number"
                step="0.1"
                placeholder="Optional"
                className="rr-input w-full text-sm"
              />
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-medium">
                Fuel level (%)
              </label>
              <input
                name="fuel_percent"
                type="number"
                min={0}
                max={100}
                step={1}
                placeholder="Optional"
                className="rr-input w-full text-sm"
              />
            </div>
          </div>

          <div className="grid gap-1">
            <label className="text-xs font-medium">
              Photos (condition, damage, odometer, fuel, etc.)
            </label>
            <input
              name="photos"
              type="file"
              multiple
              accept="image/*,.heic,.heif"
              className="text-xs"
            />
            <p className="text-[10px] text-slate-500">
              Attach clear photos of all sides, existing damage,
              odometer / hour meter, and fuel gauge as needed.
              HEIC/HEIF photos will be converted to JPEG and large
              images compressed.
            </p>
          </div>

          <div className="grid gap-1">
            <label className="text-xs font-medium">Notes</label>
            <textarea
              name="notes"
              placeholder="Optional notes about condition, damage, or anything unusual."
              className="rr-input w-full text-sm min-h-[64px]"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="rr-btn rr-btn-secondary mt-1"
          >
            {isPending ? "Saving..." : "Save inspection"}
          </button>
        </form>

        {msg && <p className="text-sm mt-2">{msg}</p>}
      </div>
    </div>
  );
}
