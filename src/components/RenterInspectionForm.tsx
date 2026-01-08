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
  damages: string | null;
  photos?: InspectionPhoto[] | null;
};

// Client-side image normalizer (same behavior as owner):
// - HEIC/HEIF -> JPEG
// - Compress very large images
async function normalizeUploadFile(file: File): Promise<File> {
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

  // Not an image -> pass through
  if (!typeLower.startsWith("image/")) return file;

  // ---------- Compress large images ----------
  const MAX_BYTES = 6 * 1024 * 1024; // 6MB
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

    let newName = file.name || "photo";
    if (!/\.(jpe?g|png)$/i.test(newName)) {
      newName += outType === "image/png" ? ".png" : ".jpg";
    } else {
      newName = newName.replace(
        /\.[a-z0-9]+$/i,
        outType === "image/png" ? ".png" : ".jpg"
      );
    }

    return new File([blob], newName, {
      type: outType,
      lastModified: Date.now(),
    });
  } catch (e) {
    console.warn("Client compress failed; uploading original:", e);
    return file;
  }
}

export default function RenterInspectionForm({
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
      {/* Rental summary + form card */}
      <div className="rr-card grid gap-3 p-5">
        {/* Rental summary */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-semibold">
              {rental.listing?.title ?? "Listing"}
            </div>

            <div className="text-sm text-slate-600">
              {rental.start_date} → {rental.end_date}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {/* Status bubble */}
              <span
                className="
                  inline-flex items-center
                  rounded-full border border-black
                  bg-white
                  px-3 py-1
                  text-[11px] font-semibold uppercase
                  shadow-sm
                "
              >
                {rental.status}
              </span>

              {typeof rental.buffer_days === "number" && (
                <span
                  className="
                    inline-flex items-center
                    rounded-full border border-black
                    bg-white
                    px-3 py-1
                    text-[11px]
                    shadow-sm
                  "
                >
                  Buffer: {rental.buffer_days}d
                </span>
              )}
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
            Take photos and note condition before pickup and after return. All
            fields are optional so this works for trucks, cars, trailers, lifts,
            and other equipment.
          </p>

          <form
            onSubmit={handleSubmit}
            encType="multipart/form-data"
            className="mt-3 space-y-3"
          >
            {/* Hidden fields required by server action */}
            <input type="hidden" name="rental_id" value={rental.id} />
            <input type="hidden" name="role" value="renter" />

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
                <label className="text-xs font-medium">
                  Hours used (equipment)
                </label>
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
                  <option value="" disabled>
                    Select
                  </option>
                  <option value="100">Full</option>
                  <option value="75">3/4</option>
                  <option value="50">Half</option>
                  <option value="25">1/4</option>
                  <option value="0">Empty</option>
                </select>
              </div>
            </div>

            {/* NEW: Damages field (renter) */}
            <div className="grid gap-1">
              <label className="text-xs font-medium text-rose-800">
                Damages (scratches, dents, broken parts, etc.)
              </label>
              <textarea
                name="damages"
                className="rr-input w-full min-h-[64px] text-sm"
                placeholder="Describe any damage you notice before or after the rental."
              />
              <p className="text-[10px] text-slate-500">
                Be as specific as possible (location, size, severity). This
                protects both you and the owner by documenting condition.
              </p>
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
                Attach clear photos of all sides, any damage, odometer / hour
                meter, and fuel gauge as needed. HEIC/HEIF photos will be
                converted to JPEG and large images compressed.
              </p>
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-medium">Notes</label>
              <textarea
                name="notes"
                className="rr-input w-full min-h-[64px] text-sm"
                placeholder="Any extra notes about condition, issues, or expectations."
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="rr-btn rr-btn-secondary mt-1"
            >
              {isPending ? "Saving..." : "Save inspection"}
            </button>

            {msg && <p className="mt-2 text-sm">{msg}</p>}
          </form>
        </div>
      </div>

      {/* Inspection history – rr-card + bubbles, newest first */}
      {inspectionList.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">
            Inspection history
          </h2>

          <div className="space-y-3">
            {inspectionList.map((ins) => (
              <article key={ins.id} className="rr-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 text-xs text-slate-700">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Role bubble */}
                      <span
                        className="
                          inline-flex items-center
                          rounded-full border border-black
                          bg-white
                          px-3 py-1
                          text-[11px] font-semibold uppercase
                          shadow-sm
                        "
                      >
                        {ins.role === "owner" ? "Owner" : "Renter"}
                      </span>

                      {/* Phase bubble */}
                      <span
                        className="
                          inline-flex items-center
                          rounded-full border border-black
                          bg-white
                          px-3 py-1
                          text-[11px]
                          shadow-sm
                        "
                      >
                        {ins.phase === "checkin" ? "Check-in" : "Check-out"}
                      </span>

                      {ins.created_at && (
                        <span className="text-[11px] text-slate-500">
                          {new Date(ins.created_at).toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="grid gap-1">
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
                      {ins.damages && (
                        <div className="mt-1 text-rose-700">
                          <span className="font-medium">Damages:</span>{" "}
                          {ins.damages}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Photo thumbnails */}
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
            className="relative w-full max-w-3xl px-4"
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
