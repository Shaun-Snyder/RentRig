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
  listing_id: string;
  listing: {
    id: string;
    title: string;
  } | null;
  renter: {
    id: string;
    email?: string | null;
  } | null;
};

type InspectionPhoto = {
  url: string;
};

type InspectionRow = {
  id: string;
  created_at: string;
  role: "owner" | "renter";
  phase: "checkin" | "checkout";
  odometer: number | null;
  hours_used: number | null;
  fuel_percent: number | null;
  notes: string | null;
  photos?: InspectionPhoto[] | null;
};

// Same HEIC/large-image normalizer
async function normalizeUploadFile(file: File): Promise<File> {
  if (typeof window === "undefined") return file;

  const nameLower = (file.name || "").toLowerCase();
  const typeLower = (file.type || "").toLowerCase();

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

  if (!typeLower.startsWith("image/")) return file;

  const MAX_BYTES = 6 * 1024 * 1024;
  const MAX_DIM = 2400;
  if (file.size <= MAX_BYTES) return file;

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

    return new File([blob], {
      type: outType,
      lastModified: Date.now(),
    });
  } catch (e) {
    console.warn("Client compress failed; uploading original:", e);
    return file;
  }
}

export default function OwnerInspectionForm({
  rental,
  inspections,
}: {
  rental: RentalRow;
  inspections?: InspectionRow[];
}) {
  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();
  const [photoModalUrl, setPhotoModalUrl] = useState<string | null>(null);

  const inspectionList: InspectionRow[] = Array.isArray(inspections)
    ? [...inspections].sort(
        (a, b) =>
          new Date(b.created_at || "").getTime() -
          new Date(a.created_at || "").getTime()
      )
    : [];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

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
    <>
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

            {rental.renter?.email && (
              <div className="text-xs text-slate-500 mt-1">
                Renter: {rental.renter.email}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <a
              href={`/api/invoice?rental_id=${encodeURIComponent(rental.id)}`}
              target="_blank"
              rel="noreferrer"
              className="rr-btn rr-btn-primary"
            >
              Invoice
            </a>

            <a
              href="/dashboard/owner-rentals"
              className="rr-btn rr-btn-secondary text-xs"
            >
              ← Back to requests
            </a>
          </div>
        </div>

        {rental.message && (
          <div className="text-sm text-slate-700">
            <span className="font-medium">Renter message:</span>{" "}
            {rental.message}
          </div>
        )}

        {/* Owner check-in/check-out form */}
        <div className="mt-3 border-t pt-3">
          <h3 className="text-sm font-semibold">Record condition (owner)</h3>
          <p className="mt-1 text-xs text-slate-600">
            Take photos and note condition at pickup and return. Use this for
            full inspection documentation and dispute protection.
          </p>

          <form
            onSubmit={handleSubmit}
            encType="multipart/form-data"
            className="mt-3 space-y-3"
          >
            <input type="hidden" name="rental_id" value={rental.id} />
            <input type="hidden" name="role" value="owner" />

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

            <div className="grid gap-3 md:grid-cols-2">
  <div className="grid gap-1">
    <label className="text-xs font-medium">Odometer (miles)</label>
    <input
      name="odometer"
      type="number"
      step="0.1"
      className="rr-input w-full text-sm"
    />
  </div>

  <div className="grid gap-1">
    <label className="text-xs font-medium">Hours used (equipment)</label>
    <input
      name="hours_used"
      type="number"
      step="0.1"
      className="rr-input w-full text-sm"
    />
  </div>

  <div className="grid gap-1">
    <label className="text-xs font-medium">Fuel level</label>
    <select
      name="fuel_percent"
      className="rr-input w-full text-sm"
      defaultValue=""
    >
      <option value="" disabled>Select</option>
      <option value="100">Full</option>
      <option value="75">3/4</option>
      <option value="50">Half</option>
      <option value="25">1/4</option>
      <option value="0">Empty</option>
    </select>
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
                Attach clear photos of all sides, undercarriage if needed,
                existing damage, odometer / hour meter, and fuel gauge. HEIC
                photos will be converted to JPEG and large images compressed.
              </p>
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-medium">Notes</label>
              <textarea
  name="notes"
  className="rr-input w-full text-sm min-h-[64px]"
/>
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="rr-btn rr-btn-secondary mt-1"
            >
              {isPending ? "Saving..." : "Save inspection"}
            </button>

            {msg && <p className="text-sm mt-2">{msg}</p>}
          </form>
        </div>
      </div>

      {/* Inspection history – bubbles, newest first */}
      {inspectionList.length > 0 && (
        <section className="mt-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-2">
            Inspection history
          </h2>

          <div className="space-y-3">
            {inspectionList.map((ins) => (
              <article
                key={ins.id}
                className="rounded-xl border bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      {ins.role === "owner" ? "Owner" : "Renter"} •{" "}
                      {ins.phase === "checkin"
                        ? "Check-in"
                        : "Check-out"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {ins.created_at
                        ? new Date(ins.created_at).toLocaleString()
                        : ""}
                    </div>

                    <div className="mt-2 grid gap-1 text-xs text-slate-700">
                      {ins.odometer != null && (
                        <div>Odometer: {ins.odometer} mi</div>
                      )}
                      {ins.hours_used != null && (
                        <div>Hours used: {ins.hours_used}</div>
                      )}
                      {ins.fuel_percent != null && (
                        <div>Fuel: {ins.fuel_percent}%</div>
                      )}
                      {ins.notes && (
                        <div className="mt-1">
                          <span className="font-medium">Notes:</span>{" "}
                          {ins.notes}
                        </div>
                      )}
                    </div>
                  </div>

                  {ins.photos && ins.photos.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {ins.photos.map((p, idx) => (
                        <button
                          key={`${ins.id}-${idx}`}
                          type="button"
                          onClick={() => setPhotoModalUrl(p.url)}
                          className="overflow-hidden rounded-md border bg-slate-100 hover:opacity-90"
                        >
                          <img
                            src={p.url}
                            alt=""
                            className="h-16 w-24 object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Fullscreen photo modal */}
      {photoModalUrl && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70"
          onClick={() => setPhotoModalUrl(null)}
        >
          <div
            className="relative max-w-3xl w-full px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute -top-2 right-4 rr-btn rr-btn-secondary text-xs"
              onClick={() => setPhotoModalUrl(null)}
            >
              Close
            </button>
            <img
              src={photoModalUrl}
              alt=""
              className="max-h-[80vh] w-full rounded-lg bg-black object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
