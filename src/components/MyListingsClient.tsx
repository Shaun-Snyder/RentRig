"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  createListing,
  updateListing,
  deleteListing,
} from "@/app/dashboard/listings/actions";
import Link from "next/link";
import heic2any from "heic2any";

type Listing = {
  id: string;
  title: string;
  category: string;
  description: string | null;

  license_required: boolean;
  license_type: string | null;

  city?: string | null;
  state?: string | null;
  zip?: string | null;

  price_per_day: number | null;
  price_per_week: number | null;
  price_per_month: number | null;

  security_deposit: number | null;
  is_published: boolean;

  delivery_mode?:
    "pickup_only" | "pickup_or_delivery" | "delivery_only" | string | null;
  delivery_miles?: number | null;
  delivery_fee?: number | null;
  delivery_service_discount_enabled?: boolean | null;
  delivery_service_discount_amount?: number | null;

  rental_hourly_enabled?: boolean | null;
  rental_hour_rate?: number | null;

  operator_enabled: boolean;

  operator_daily_enabled?: boolean | null;
  operator_hourly_enabled?: boolean | null;
  operator_day_rate?: number | null;
  operator_hour_rate?: number | null;

  // Legacy fields kept temporarily for compatibility
  operator_rate: number | null;
  operator_rate_unit: "day" | "hour" | string | null;
  operator_max_hours: number | null;

  driver_enabled: boolean;
  driver_daily_enabled: boolean;
  driver_hourly_enabled: boolean;
  driver_day_rate: number | null;
  driver_hour_rate: number | null;
  driver_max_hours: number | null;

  driver_labor_enabled: boolean;
  driver_labor_daily_enabled: boolean;
  driver_labor_hourly_enabled: boolean;
  driver_labor_day_rate: number | null;
  driver_labor_hour_rate: number | null;
  driver_labor_max_hours: number | null;

  turnaround_days: number | null;
  min_rental_days: number | null;
  max_rental_days: number | null;
};

type ListingPhoto = {
  id: string;
  listing_id: string;
  path: string;
  sort_order: number | null;
  created_at?: string;
  thumb_url?: string | null;
};

function money(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `$${n.toFixed(0)}`;
}

function boolStr(b: any) {
  return b ? "true" : "false";
}

function numStr(v: any) {
  if (v === null || v === undefined) return "";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "";
}

export default function MyListingsClient({
  listings,
  showCreate = false,
}: {
  listings: Listing[];
  showCreate?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [zip, setZip] = useState("");
  const [createFiles, setCreateFiles] = useState<FileList | null>(null);
  const [createPhotoInputKey, setCreatePhotoInputKey] = useState(0);
  const [createFormKey, setCreateFormKey] = useState(0);
  const [createPreviewUrls, setCreatePreviewUrls] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  const [openId, setOpenId] = useState<string | null>(null);

  const [photosByListing, setPhotosByListing] = useState<
    Record<string, ListingPhoto[]>
  >({});
  const [photoMsgByListing, setPhotoMsgByListing] = useState<
    Record<string, string>
  >({});
  const [photoBusyByListing, setPhotoBusyByListing] = useState<
    Record<string, boolean>
  >({});

  // controlled so the unit label doesn’t feel stale in the edit UI

  function storageUrl(path: string) {
    const { data } = supabase.storage.from("listing-photos").getPublicUrl(path);
    return data.publicUrl;
  }

  function getThumb(listingId: string): string | null {
    const arr = photosByListing[listingId];
    if (!arr || arr.length === 0) return null;

    // Prefer primary photo when available, otherwise first
    const p =
      arr.find((x) => (x as any)?.is_primary === true) ??
      arr.find((x) => (x as any)?.is_primary === "true") ??
      arr[0];

    const path =
      (p as any)?.path ??
      (p as any)?.storage_path ??
      (p as any)?.file_path ??
      (p as any)?.photo_path ??
      null;

    if (!path) return null;

    return storageUrl(path);
  }

  async function normalizeUploadFile(file: File): Promise<File> {
    // Extra safety: if this ever runs somewhere unexpected
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

      const heic2any = mod.default ?? (mod as unknown as Heic2AnyFn);

      const out = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.9,
      });

      const blob: Blob = Array.isArray(out) ? out[0] : out;
      const base = file.name
        ? file.name.replace(/\.(heic|heif)$/i, "")
        : "photo";
      return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
    }

    // ---------- Compress very large images (mostly iPhone JPEGs) ----------
    if (!typeLower.startsWith("image/")) return file;

    const MAX_BYTES = 6 * 1024 * 1024; // 6MB
    const MAX_DIM = 2400; // cap longest edge
    if (file.size <= MAX_BYTES) return file;

    // Keep PNG as PNG; otherwise JPEG (same as your current behavior)
    const outType = typeLower.includes("png") ? "image/png" : "image/jpeg";
    const quality = outType === "image/jpeg" ? 0.82 : undefined;

    try {
      // Decode efficiently (no FileReader / dataURL)
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

      // if it didn't help, keep original
      if (blob.size >= file.size) return file;

      const newName = file.name.replace(
        /\.[a-z0-9]+$/i,
        outType === "image/png" ? ".png" : ".jpg",
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

  async function uploadQueuedCreatePhotos(
    listingId: string,
    files: FileList | null,
  ) {
    if (!files || files.length === 0) return;

    setPhotoBusyByListing((m) => ({ ...m, [listingId]: true }));
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("listing_id", listingId);

        // IMPORTANT: convert HEIC -> JPEG (and keep jpg/png as-is)
        const safeFile = await normalizeUploadFile(file);

        // Keep API field name as "photo" (your server logs show it expects "photo")
        fd.append("photo", safeFile, safeFile.name);

        const res = await fetch("/api/listing-photos", {
          method: "POST",
          body: fd,
        });

        // Handle JSON OR HTML error bodies safely
        const text = await res.text();
        let err = `Upload failed (${res.status})`;
        let j: any = {};

        try {
          j = JSON.parse(text);
          if (j?.error) err = j.error;
        } catch {
          // not JSON (often Next error HTML)
          err = `${err}: ${text.slice(0, 120)}`;
        }

        if (!res.ok) {
          setPhotoMsgByListing((p) => ({ ...p, [listingId]: err }));
          return;
        }
      }
    } finally {
      setPhotoBusyByListing((m) => ({ ...m, [listingId]: false }));
    }
  }

  async function refreshPhotos(listingId: string) {
    setPhotoMsgByListing((p) => ({ ...p, [listingId]: "Refreshing..." }));
    try {
      const res = await fetch(
        `/api/listing-photos?listing_id=${encodeURIComponent(listingId)}`,
        { cache: "no-store" },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhotoMsgByListing((p) => ({
          ...p,
          [listingId]: j?.error ?? "Refresh failed.",
        }));
        return;
      }
      setPhotosByListing((p) => ({
        ...p,
        [listingId]: (j.photos ?? []) as ListingPhoto[],
      }));
      setPhotoMsgByListing((p) => ({ ...p, [listingId]: "" }));
    } catch (e: any) {
      setPhotoMsgByListing((p) => ({
        ...p,
        [listingId]: e?.message ?? "Refresh failed.",
      }));
    }
  }

  async function uploadPhotos(listingId: string, files: FileList | null) {
    if (!files || files.length === 0) return;

    setPhotoMsgByListing((p) => ({
      ...p,
      [listingId]: `Uploading ${files.length}...`,
    }));

    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("listing_id", listingId);

      const safeFile = await normalizeUploadFile(file);
      fd.append("photo", safeFile); // <-- MUST be "photo"

      const res = await fetch("/api/listing-photos", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const text = await res.text(); // JSON or HTML
        let localMsg = `Upload failed (${res.status})`;
        try {
          const j = JSON.parse(text);
          localMsg = j?.error || localMsg;
        } catch {
          localMsg = `${localMsg}: ${text.slice(0, 120)}`;
        }
        setPhotoMsgByListing((p) => ({ ...p, [listingId]: localMsg }));
        return;
      }
    }

    await refreshPhotos(listingId);
    setPhotoMsgByListing((p) => ({ ...p, [listingId]: "" }));
  }

  async function deletePhoto(photoId: string, listingId: string) {
    if (!confirm("Delete this photo?")) return;

    setPhotoMsgByListing((p) => ({ ...p, [listingId]: "Deleting..." }));
    const res = await fetch(
      `/api/listing-photos?photo_id=${encodeURIComponent(photoId)}`,
      { method: "DELETE" },
    );
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPhotoMsgByListing((p) => ({
        ...p,
        [listingId]: j?.error ?? "Delete failed.",
      }));
      return;
    }

    await refreshPhotos(listingId);
    setPhotoMsgByListing((p) => ({ ...p, [listingId]: "" }));
  }

  async function savePhotoOrder(listingId: string) {
    setPhotoMsgByListing((p) => ({ ...p, [listingId]: "Saving order..." }));

    const photos = (photosByListing[listingId] ?? [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((p, idx) => ({ id: p.id, sort_order: idx }));

    const res = await fetch("/api/listing-photos/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listing_id: listingId, photos }),
    });

    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPhotoMsgByListing((p) => ({
        ...p,
        [listingId]: j?.error ?? "Save order failed.",
      }));
      return;
    }

    await refreshPhotos(listingId);
    setPhotoMsgByListing((p) => ({ ...p, [listingId]: "" }));
  }

  // IMPORTANT: Use updateListing with a FULL payload so we never wipe fields.
  function buildUpdateFD(l: Listing, override?: Partial<Listing>) {
    const x: Listing = { ...l, ...(override ?? {}) };

    const fd = new FormData();
    fd.set("id", x.id);

    fd.set("title", x.title ?? "");
    fd.set("category", x.category ?? "other");
    fd.set("description", x.description ?? "");

    fd.set("city", (x.city ?? "").toString());
    fd.set("state", (x.state ?? "").toString());
    fd.set("zip", (x.zip ?? "").toString());

    fd.set("price_per_day", numStr(x.price_per_day ?? 0));
    fd.set("price_per_week", numStr(x.price_per_week));
    fd.set("price_per_month", numStr(x.price_per_month));
    fd.set("rental_hourly_enabled", boolStr((x as any).rental_hourly_enabled));
    fd.set("rental_hour_rate", numStr((x as any).rental_hour_rate));
    fd.set("security_deposit", numStr(x.security_deposit));

    fd.set("license_required", boolStr(x.license_required));
    fd.set("license_type", (x.license_type ?? "").toString());

    fd.set("is_published", boolStr(x.is_published));

    fd.set(
      "delivery_mode",
      ((x as any).delivery_mode ?? "pickup_only").toString(),
    );
    fd.set("delivery_miles", numStr((x as any).delivery_miles));
    fd.set("delivery_fee", numStr((x as any).delivery_fee));
    fd.set(
      "delivery_service_discount_enabled",
      boolStr((x as any).delivery_service_discount_enabled),
    );
    fd.set(
      "delivery_service_discount_amount",
      numStr((x as any).delivery_service_discount_amount),
    );

    fd.set("operator_enabled", boolStr(x.operator_enabled));

    fd.set(
      "operator_daily_enabled",
      boolStr(Boolean(x.operator_daily_enabled)),
    );
    fd.set(
      "operator_hourly_enabled",
      boolStr(Boolean(x.operator_hourly_enabled)),
    );
    fd.set("operator_day_rate", numStr(x.operator_day_rate ?? 0));
    fd.set("operator_hour_rate", numStr(x.operator_hour_rate ?? 0));

    fd.set("operator_max_hours", numStr(x.operator_max_hours ?? 24));

    // Legacy compatibility fields
    const legacyOperatorUnit = x.operator_daily_enabled ? "day" : "hour";

    const legacyOperatorRate = x.operator_daily_enabled
      ? x.operator_day_rate
      : x.operator_hour_rate;

    fd.set("operator_rate_unit", legacyOperatorUnit);
    fd.set("operator_rate", numStr(legacyOperatorRate ?? 0));

    fd.set("driver_enabled", boolStr(x.driver_enabled));
    fd.set("driver_daily_enabled", boolStr(x.driver_daily_enabled));
    fd.set("driver_hourly_enabled", boolStr(x.driver_hourly_enabled));
    fd.set("driver_day_rate", numStr(x.driver_day_rate));
    fd.set("driver_hour_rate", numStr(x.driver_hour_rate));
    fd.set("driver_max_hours", numStr(x.driver_max_hours ?? 24));

    fd.set("driver_labor_enabled", boolStr(x.driver_labor_enabled));
    fd.set("driver_labor_daily_enabled", boolStr(x.driver_labor_daily_enabled));
    fd.set(
      "driver_labor_hourly_enabled",
      boolStr(x.driver_labor_hourly_enabled),
    );
    fd.set("driver_labor_day_rate", numStr(x.driver_labor_day_rate));
    fd.set("driver_labor_hour_rate", numStr(x.driver_labor_hour_rate));
    fd.set("driver_labor_max_hours", numStr(x.driver_labor_max_hours ?? 24));

    fd.set("turnaround_days", numStr(x.turnaround_days ?? 0));
    fd.set("min_rental_days", numStr(x.min_rental_days ?? 1));
    fd.set(
      "max_rental_days",
      x.max_rental_days == null ? "" : numStr(x.max_rental_days),
    );

    return fd;
  }

  // preload thumbnails
  useEffect(() => {
    (async () => {
      try {
        const ids = listings.map((l) => l.id);
        if (!ids.length) return;

        const obj: Record<string, ListingPhoto[]> = {};
        await Promise.all(
          ids.map(async (id) => {
            const res = await fetch(
              `/api/listing-photos?listing_id=${encodeURIComponent(id)}`,
              { cache: "no-store" },
            );
            const j = await res.json().catch(() => ({}));
            if (res.ok) obj[id] = (j.photos ?? []) as ListingPhoto[];
          }),
        );
        setPhotosByListing((prev) => ({ ...prev, ...obj }));
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid gap-6">
      {/* CREATE FORM (unchanged behavior) */}
      {showCreate && (
        <form
          key={createFormKey}
          className="rounded-lg border rr-card p-4 grid gap-3"
          action={(fd) => {
            setMsg("");
            startTransition(async () => {
              try {
                const res: any = await createListing(fd);
                const newId = res?.listingId;

                if (!res?.ok) {
                  setMsg(res?.message ?? "Create failed.");
                  return;
                }

                if (newId && createFiles) {
                  await uploadQueuedCreatePhotos(newId, createFiles);
                  await refreshPhotos(newId);
                }

                setMsg(res?.message ?? "Created.");
                setZip("");
                setCreateFiles(null);
                setCreatePhotoInputKey((k) => k + 1);
                setCreateFormKey((k) => k + 1);
                router.refresh();
              } catch (e: any) {
                setMsg(e?.message ?? "Create failed.");
              }
            });
          }}
        >
          <div className="text-lg font-semibold">Create listing</div>

          <div className="grid gap-1">
            <label className="text-sm">Title</label>
            <input
              className="rounded-md border px-3 py-2"
              name="title"
              required
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm">Category</label>
            <select
              className="rounded-md border px-3 py-2"
              name="category"
              required
              defaultValue="other"
            >
              <option value="trucks">Trucks</option>
              <option value="trailers">Trailers</option>
              <option value="vans_covered">Vans_covered</option>
              <option value="lifts">Lifts</option>
              <option value="heavy_equipment">Heavy equipment</option>
              <option value="agricultural">Agricultural</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1">
              <label className="text-sm">City</label>
              <input className="rounded-md border px-3 py-2" name="city" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm">State</label>
              <input className="rounded-md border px-3 py-2" name="state" />
            </div>
          </div>

          <label className="grid gap-1">
            <span className="text-sm text-slate-600">ZIP code (optional)</span>
            <input
              className="border rounded-lg p-2"
              name="zip"
              placeholder="e.g. 32817"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
            />
          </label>

          <div className="grid gap-1">
            <label className="text-sm">Description</label>
            <textarea
              className="rounded-md border px-3 py-2"
              name="description"
              rows={3}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1">
              <label className="text-sm">$ / day</label>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  $
                </span>

                <input
                  className="rounded-md border pl-8 pr-3 py-2 w-full"
                  name="price_per_day"
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  defaultValue={1}
                />
              </div>
            </div>

            <div className="grid gap-1">
              <label className="text-sm">$ / week</label>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  $
                </span>

                <input
                  className="rounded-md border pl-8 pr-3 py-2 w-full"
                  name="price_per_week"
                  type="number"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <div className="grid gap-1">
              <label className="text-sm">$ / month</label>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  $
                </span>

                <input
                  className="rounded-md border pl-8 pr-3 py-2 w-full"
                  name="price_per_month"
                  type="number"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>
          {/* Hourly Rental (NEW) */}
          <div className="rounded-lg border bg-slate-50 p-4 grid gap-2">
            <div className="text-sm font-medium">Hourly Rental (Equipment)</div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="rental_hourly_enabled"
                value="true"
              />
              Allow hourly rental
            </label>

            <div className="grid gap-1">
              <label className="text-sm">$ / hour</label>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  $
                </span>

                <input
                  className="rounded-md border pl-8 pr-3 py-2 w-full"
                  name="rental_hour_rate"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 75"
                />
              </div>
            </div>
          </div>
          <div className="grid gap-1">
            <label className="text-sm">Security deposit</label>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                $
              </span>

              <input
                className="rounded-md border pl-8 pr-3 py-2 w-full"
                name="security_deposit"
                type="number"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          {/* License (create) */}
          <div className="grid gap-2">
            <label className="text-sm font-semibold">Required license</label>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="license_required" value="true" />
              This listing requires a license
            </label>

            <div className="grid gap-1">
              <label className="text-sm text-slate-600">
                License type / note (shown to renter)
              </label>
              <input
                className="rounded-md border px-3 py-2"
                name="license_type"
                placeholder="e.g., CDL, OSHA forklift, excavator certification"
              />
            </div>
          </div>

          {/* Delivery */}
          {/* Delivery */}
          <div className="rounded-lg border bg-slate-50 p-4 grid gap-2">
            <div className="text-sm font-medium">Delivery</div>

            <div className="grid gap-1">
              <label className="text-sm">Delivery mode</label>
              <select
                className="rounded-md border px-3 py-2"
                name="delivery_mode"
                defaultValue="pickup_only"
              >
                <option value="pickup_only">Local pickup only</option>
                <option value="pickup_or_delivery">Pickup or delivery</option>
                <option value="delivery_only">Delivery only</option>
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1">
                <label className="text-sm">Delivery miles</label>
                <input
                  className="rounded-md border px-3 py-2"
                  name="delivery_miles"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={0}
                />
              </div>

              <div className="grid gap-1">
                <label className="text-sm">Delivery fee</label>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    $
                  </span>

                  <input
                    className="rounded-md border pl-8 pr-3 py-2 w-full"
                    name="delivery_fee"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={0}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Operator */}
          <div className="rounded-lg border bg-slate-50 p-4 grid gap-3">
            <div className="text-sm font-medium">Operator</div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="operator_enabled"
                value="true"
                defaultChecked={Boolean(l.operator_enabled)}
              />
              Offer operator
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="operator_daily_enabled"
                  value="true"
                  defaultChecked={Boolean(l.operator_daily_enabled)}
                />
                Daily rate
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="operator_hourly_enabled"
                  value="true"
                  defaultChecked={Boolean(l.operator_hourly_enabled)}
                />
                Hourly rate
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="grid gap-1">
                <label className="text-sm">Operator day rate</label>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    $
                  </span>

                  <input
                    className="rounded-md border pl-8 pr-3 py-2 w-full"
                    name="operator_day_rate"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={l.operator_hour_rate ?? 0}
                  />
                </div>
              </div>

              <div className="grid gap-1">
                <label className="text-sm">Operator hour rate</label>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    $
                  </span>

                  <input
                    className="rounded-md border pl-8 pr-3 py-2 w-full"
                    name="operator_hour_rate"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={l.operator_hour_rate ?? 0}
                  />
                </div>
              </div>

              <div className="grid gap-1">
                <label className="text-sm">Max hours (if hourly)</label>
                <input
                  className="rounded-md border px-3 py-2"
                  name="operator_max_hours"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={l.operator_max_hours ?? 24}
                />
              </div>
            </div>
          </div>

          {/* Driver */}
          <div className="rounded-lg border bg-slate-50 p-4 grid gap-2">
            <div className="text-sm font-medium">Driver</div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="driver_enabled" value="true" /> Offer
              driver
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="driver_daily_enabled"
                  value="true"
                />{" "}
                Daily rate
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="driver_hourly_enabled"
                  value="true"
                />{" "}
                Hourly rate
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="grid gap-1">
                <label className="text-sm">Driver day rate</label>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    $
                  </span>

                  <input
                    className="rounded-md border pl-8 pr-3 py-2 w-full"
                    name="driver_day_rate"
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="grid gap-1">
                <label className="text-sm">Driver hour rate</label>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    $
                  </span>

                  <input
                    className="rounded-md border pl-8 pr-3 py-2 w-full"
                    name="driver_hour_rate"
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="grid gap-1">
                <label className="text-sm">Max hours (if hourly)</label>
                <input
                  className="rounded-md border px-3 py-2"
                  name="driver_max_hours"
                  type="number"
                  min="0"
                  step="1"
                />
              </div>
            </div>
          </div>

          {/* Driver + Labor */}
          <div className="rounded-lg border bg-slate-50 p-4 grid gap-2">
            <div className="text-sm font-medium">Driver + Labor</div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="driver_labor_enabled" value="true" />{" "}
              Offer driver + labor
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="driver_labor_daily_enabled"
                  value="true"
                />{" "}
                Daily rate
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="driver_labor_hourly_enabled"
                  value="true"
                />{" "}
                Hourly rate
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="grid gap-1">
                <label className="text-sm">Driver+Labor day rate</label>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    $
                  </span>

                  <input
                    className="rounded-md border pl-8 pr-3 py-2 w-full"
                    name="driver_labor_day_rate"
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="grid gap-1">
                <label className="text-sm">Driver+Labor hour rate</label>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    $
                  </span>

                  <input
                    className="rounded-md border pl-8 pr-3 py-2 w-full"
                    name="driver_labor_hour_rate"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={0}
                  />
                </div>
              </div>
              <div className="grid gap-1">
                <label className="text-sm">Max hours (if hourly)</label>
                <input
                  className="rounded-md border px-3 py-2"
                  name="driver_labor_max_hours"
                  type="number"
                  min="0"
                  step="1"
                />
              </div>
            </div>
          </div>

          {/* Min/Max + Turnaround */}
          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1">
              <label className="text-sm">Min rental days</label>
              <input
                className="rounded-md border px-3 py-2"
                name="min_rental_days"
                type="number"
                min="1"
                step="1"
                defaultValue={1}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Max rental days</label>
              <input
                className="rounded-md border px-3 py-2"
                name="max_rental_days"
                type="number"
                min="1"
                step="1"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Turnaround days</label>
              <input
                className="rounded-md border px-3 py-2"
                name="turnaround_days"
                type="number"
                min="0"
                step="1"
                defaultValue={0}
              />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <label
              style={{ fontWeight: 600, display: "block", marginBottom: 6 }}
            >
              Photos
            </label>

            <input
              key={createPhotoInputKey}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = e.target.files;
                setCreateFiles(files);

                const urls = files
                  ? Array.from(files).map((f) => URL.createObjectURL(f))
                  : [];

                setCreatePreviewUrls(urls);
              }}
            />

            {createPreviewUrls.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                  gap: 12,
                  marginTop: 12,
                }}
              >
                {createPreviewUrls.map((url, i) => (
                  <img
                    key={`${url}-${i}`}
                    src={url}
                    alt={`Preview ${i + 1}`}
                    style={{
                      width: "100%",
                      height: 110,
                      objectFit: "cover",
                      border: "1px solid #d1d5db",
                      borderRadius: 8,
                    }}
                  />
                ))}
              </div>
            ) : null}

            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              Add photos now, or upload more later from Edit Listing.
            </div>
          </div>
          <button
            disabled={isPending}
            className="rounded-md bg-black text-white px-4 py-2 w-fit"
          >
            {isPending ? "Creating..." : "Create listing"}
          </button>

          {msg ? <p className="text-sm">{msg}</p> : null}
        </form>
      )}

      {/* LIST */}
      <div className="grid gap-4">
        <h2 className="text-lg font-semibold">My listings</h2>

        {listings.map((l) => {
          const isOpen = openId === l.id;
          const thumb = getThumb(l.id);

          const operatorSummary = l.operator_enabled
            ? [
                l.operator_daily_enabled
                  ? `Daily ${money(l.operator_day_rate)}`
                  : null,
                l.operator_hourly_enabled
                  ? `Hourly ${money(l.operator_hour_rate)} (cap ${
                      l.operator_max_hours ?? 24
                    })`
                  : null,
              ]
                .filter(Boolean)
                .join(" • ")
            : "Not offered";

          const driverSummary = l.driver_enabled
            ? [
                l.driver_daily_enabled
                  ? `Daily ${money(l.driver_day_rate)}`
                  : null,
                l.driver_hourly_enabled
                  ? `Hourly ${money(l.driver_hour_rate)} (cap ${
                      l.driver_max_hours ?? 24
                    })`
                  : null,
              ]
                .filter(Boolean)
                .join(" • ")
            : "Not offered";

          const driverLaborSummary = l.driver_labor_enabled
            ? [
                l.driver_labor_daily_enabled
                  ? `Daily ${money(l.driver_labor_day_rate)}`
                  : null,
                l.driver_labor_hourly_enabled
                  ? `Hourly ${money(l.driver_labor_hour_rate)} (cap ${
                      l.driver_labor_max_hours ?? 24
                    })`
                  : null,
              ]
                .filter(Boolean)
                .join(" • ")
            : "Not offered";

          return (
            <div
              key={l.id}
              className="
      border border-slate-200 rr-card
      px-5 py-4
      shadow-[0_18px_40px_rgba(15,23,42,0.22)]
      bg-white
    "
            >
              {/* TOP ROW: photo + summary */}
              <div className="flex flex-col md:flex-row items-start gap-4">
                {/* Left: big thumbnail and text */}
                <div className="flex flex-col md:flex-row gap-4 w-full">
                  <div className="flex flex-col flex-shrink-0">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="
  w-full md:w-80
  h-48 md:h-48
  object-cover
  border border-slate-200
"
                      />
                    ) : (
                      <div
                        className="
                        w-60 md:w-80
                        h-40 md:h-48
                        border border-dashed border-slate-300
                        bg-slate-50
                        grid place-items-center
                        text-xs text-slate-500
                      "
                      >
                        No photo
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="text-2xl md:text-xl font-extrabold text-slate-900">
                      {l.title}
                    </div>

                    {l.description && (
                      <div className="text-sm text-slate-700">
                        {l.description}
                      </div>
                    )}

                    <div className="text-sm text-slate-600">
                      <span className="font-semibold">Category:</span>{" "}
                      {l.category}
                    </div>

                    {(l.city || l.state) && (
                      <div className="text-sm text-slate-600">
                        <span className="font-semibold">Location:</span>{" "}
                        <span className="font-medium">
                          {l.city ?? ""}
                          {l.city && l.state ? ", " : ""}
                          {l.state ?? ""}
                        </span>
                      </div>
                    )}

                    <div className="text-sm text-slate-700">
                      <span className="font-semibold">
                        Price: {money(l.price_per_day)} /day
                      </span>{" "}
                      <span className="text-slate-500">
                        • Deposit: {money(l.security_deposit)}
                      </span>
                    </div>

                    <div className="text-sm text-slate-700">
                      <span className="font-semibold">License required:</span>{" "}
                      {l.license_required ? "Yes" : "No"}
                      {l.license_required && l.license_type
                        ? ` — ${l.license_type}`
                        : ""}
                    </div>

                    <div className="text-sm text-slate-700">
                      <span className="font-semibold">Operator:</span>{" "}
                      {operatorSummary || "Not included"}
                    </div>

                    <div className="text-sm text-slate-700">
                      <span className="font-semibold">Driver:</span>{" "}
                      {driverSummary || "Not included"}
                    </div>

                    <div className="text-sm text-slate-700">
                      <span className="font-semibold">Driver + Labor:</span>{" "}
                      {driverLaborSummary || "Not included"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                <button
                  type="button"
                  className="rr-btn rr-btn-secondary"
                  disabled={isPending}
                  onClick={() => {
                    setOpenId(isOpen ? null : l.id);
                    if (!isOpen) refreshPhotos(l.id);
                  }}
                >
                  {isOpen ? "Close" : "Edit"}
                </button>

                <button
                  type="button"
                  className="rr-btn rr-btn-primary"
                  disabled={isPending}
                  onClick={() => {
                    setMsg("");
                    startTransition(async () => {
                      try {
                        const nextPublished = !l.is_published;
                        const fd = buildUpdateFD(l, {
                          is_published: nextPublished,
                        });
                        const res: any = await updateListing(fd);
                        setMsg(
                          res?.message ??
                            (nextPublished ? "Published." : "Unpublished."),
                        );
                        router.refresh();
                      } catch (e: any) {
                        setMsg(e?.message ?? "Publish toggle failed.");
                      }
                    });
                  }}
                >
                  {l.is_published ? "Unpublish" : "Publish"}
                </button>

                <button
                  type="button"
                  className="rr-btn rr-btn-danger"
                  disabled={isPending}
                  onClick={() => {
                    if (!confirm("Delete this listing?")) return;
                    setMsg("");
                    startTransition(async () => {
                      try {
                        const fd = new FormData();
                        fd.set("id", l.id);
                        const res: any = await deleteListing(fd);
                        setMsg(res?.message ?? "Deleted.");
                        router.refresh();
                      } catch (e: any) {
                        setMsg(e?.message ?? "Delete failed.");
                      }
                    });
                  }}
                >
                  Delete
                </button>
              </div>

              {/* PHOTOS (only visible when Edit is open) */}
              {isOpen && (
                <div className="rounded-xl border bg-slate-50 p-4 grid gap-2 mt-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Photos</div>
                    <button
                      type="button"
                      className="rr-btn rr-btn-secondary px-3 py-1.5 text-xs rounded-full"
                      onClick={() => refreshPhotos(l.id)}
                    >
                      Refresh
                    </button>
                  </div>

                  {photoMsgByListing[l.id] ? (
                    <div className="text-sm text-slate-600">
                      {photoMsgByListing[l.id]}
                    </div>
                  ) : null}

                  <input
                    type="file"
                    multiple
                    accept="image/*,.heic,.heif"
                    onChange={(e) => uploadPhotos(l.id, e.target.files)}
                  />

                  {(photosByListing[l.id] ?? []).length > 0 ? (
                    <>
                      <div className="grid gap-2">
                        {(photosByListing[l.id] ?? [])
                          .slice()
                          .sort(
                            (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
                          )
                          .map((p, idx, arr) => (
                            <div
                              key={p.id}
                              className="grid grid-cols-[96px_1fr] md:grid-cols-[140px_1fr_auto] gap-3 items-center rounded-md border rr-card p-3"
                            >
                              <img
                                src={storageUrl(p.path)}
                                alt=""
                                className="h-16 w-24 rounded object-cover border"
                              />
                              <div className="flex-1 text-sm text-slate-600 truncate">
                                Photo {idx + 1}
                              </div>

                              <div className="col-span-2 md:col-span-1 flex flex-wrap justify-end gap-2">
                                <button
                                  type="button"
                                  className="rr-btn rr-btn-secondary rr-btn-sm"
                                  onClick={() => {
                                    if (idx === 0) return;
                                    setPhotosByListing((prev) => {
                                      const list = (prev[l.id] ?? [])
                                        .slice()
                                        .sort(
                                          (a, b) =>
                                            (a.sort_order ?? 0) -
                                            (b.sort_order ?? 0),
                                        );

                                      const picked = list[idx];
                                      const rest = list.filter(
                                        (x) => x.id !== picked.id,
                                      );
                                      const reordered = [picked, ...rest].map(
                                        (x, i) => ({
                                          ...x,
                                          sort_order: i,
                                        }),
                                      );

                                      return { ...prev, [l.id]: reordered };
                                    });
                                  }}
                                >
                                  Set cover
                                </button>
                                {/* move up */}
                                <button
                                  type="button"
                                  className="rr-btn rr-btn-secondary rr-btn-sm"
                                  onClick={() => {
                                    if (idx <= 0) return;
                                    setPhotosByListing((prev) => {
                                      const list = (prev[l.id] ?? [])
                                        .slice()
                                        .sort(
                                          (a, b) =>
                                            (a.sort_order ?? 0) -
                                            (b.sort_order ?? 0),
                                        );
                                      const tmp = list[idx - 1];
                                      list[idx - 1] = list[idx];
                                      list[idx] = tmp;
                                      const normalized = list.map((x, i) => ({
                                        ...x,
                                        sort_order: i,
                                      }));
                                      return { ...prev, [l.id]: normalized };
                                    });
                                  }}
                                >
                                  ↑
                                </button>

                                {/* move down */}
                                <button
                                  type="button"
                                  className="rr-btn rr-btn-secondary rr-btn-sm"
                                  onClick={() => {
                                    if (idx >= arr.length - 1) return;
                                    setPhotosByListing((prev) => {
                                      const list = (prev[l.id] ?? [])
                                        .slice()
                                        .sort(
                                          (a, b) =>
                                            (a.sort_order ?? 0) -
                                            (b.sort_order ?? 0),
                                        );
                                      const tmp = list[idx + 1];
                                      list[idx + 1] = list[idx];
                                      list[idx] = tmp;
                                      const normalized = list.map((x, i) => ({
                                        ...x,
                                        sort_order: i,
                                      }));
                                      return { ...prev, [l.id]: normalized };
                                    });
                                  }}
                                >
                                  ↓
                                </button>

                                {/* delete */}
                                <button
                                  type="button"
                                  className="rr-btn rr-btn-danger rr-btn-sm"
                                  onClick={() => deletePhoto(p.id, l.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>

                      <button
                        type="button"
                        className="rr-btn rr-btn-secondary rr-btn-sm w-fit"
                        onClick={() => savePhotoOrder(l.id)}
                      >
                        Save photo order
                      </button>
                    </>
                  ) : (
                    <div className="text-sm text-slate-500">No photos yet.</div>
                  )}
                </div>
              )}

              {/* EDIT FORM */}
              {isOpen ? (
                <form
                  className="rounded-lg border bg-slate-50 p-4 grid gap-3 mt-2"
                  action={(fd) => {
                    setMsg("");
                    startTransition(async () => {
                      try {
                        const res: any = await updateListing(fd);
                        setMsg(res?.message ?? "Saved.");
                        router.refresh();
                      } catch (e: any) {
                        setMsg(e?.message ?? "Save failed.");
                      }
                    });
                  }}
                >
                  <input type="hidden" name="id" value={l.id} />

                  <div className="grid gap-1">
                    <label className="text-sm">Title</label>
                    <input
                      className="rounded-md border px-3 py-2"
                      name="title"
                      defaultValue={l.title}
                      required
                    />
                  </div>

                  <div className="grid gap-1">
                    <label className="text-sm">Category</label>
                    <select
                      className="rounded-md border px-3 py-2"
                      name="category"
                      defaultValue={l.category}
                    >
                      <option value="trucks">Trucks</option>
                      <option value="trailers">Trailers</option>
                      <option value="vans_covered">Vans_covered</option>
                      <option value="lifts">Lifts</option>
                      <option value="heavy_equipment">Heavy equipment</option>
                      <option value="agricultural">Agricultural</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="grid gap-1">
                      <label className="text-sm">City</label>
                      <input
                        className="rounded-md border px-3 py-2"
                        name="city"
                        defaultValue={l.city ?? ""}
                      />
                    </div>

                    <div className="grid gap-1">
                      <label className="text-sm">State</label>
                      <input
                        className="rounded-md border px-3 py-2"
                        name="state"
                        defaultValue={l.state ?? ""}
                      />
                    </div>

                    <div className="grid gap-1">
                      <label className="text-sm">ZIP</label>
                      <input
                        className="rounded-md border px-3 py-2"
                        name="zip"
                        defaultValue={String(l.zip ?? "")}
                        placeholder="e.g. 32817"
                      />
                    </div>
                  </div>

                  <div className="grid gap-1">
                    <label className="text-sm">Description</label>
                    <textarea
                      className="rounded-md border px-3 py-2"
                      name="description"
                      rows={3}
                      defaultValue={l.description ?? ""}
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="grid gap-1">
                      <label className="text-sm">$ / day</label>

                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                          $
                        </span>

                        <input
                          className="rounded-md border pl-8 pr-3 py-2 w-full"
                          name="price_per_day"
                          type="number"
                          min="1"
                          step="0.01"
                          required
                          defaultValue={l.price_per_day ?? 1}
                        />
                      </div>
                    </div>
                    <div className="grid gap-1">
                      <label className="text-sm">$ / week</label>

                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                          $
                        </span>

                        <input
                          className="rounded-md border pl-8 pr-3 py-2 w-full"
                          name="price_per_week"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={l.price_per_week ?? 0}
                        />
                      </div>
                    </div>
                  </div>
                  {/* Hourly Rental (EDIT) */}
                  <div className="rounded-lg border rr-card p-4 grid gap-2">
                    <div className="text-sm font-medium">
                      Hourly Rental (Equipment)
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="rental_hourly_enabled"
                        value="true"
                        defaultChecked={Boolean(
                          (l as any).rental_hourly_enabled,
                        )}
                      />
                      Allow hourly rental
                    </label>

                    <div className="grid gap-1">
                      <label className="text-sm">$ / hour</label>

                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                          $
                        </span>

                        <input
                          className="rounded-md border pl-8 pr-3 py-2 w-full"
                          name="rental_hour_rate"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={(l as any).rental_hour_rate ?? ""}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <label className="text-sm">Security deposit</label>

                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                        $
                      </span>

                      <input
                        className="rounded-md border pl-8 pr-3 py-2 w-full"
                        name="security_deposit"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={l.security_deposit ?? 0}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-semibold">
                      Required license
                    </label>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="license_required"
                        value="true"
                        defaultChecked={Boolean(l.license_required)}
                      />
                      This listing requires a license
                    </label>

                    <div className="grid gap-1">
                      <label className="text-sm text-slate-600">
                        License type / note (shown to renter)
                      </label>
                      <input
                        className="rounded-md border px-3 py-2"
                        name="license_type"
                        defaultValue={l.license_type ?? ""}
                        placeholder="e.g., CDL, OSHA forklift, excavator certification"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="is_published"
                      value="true"
                      defaultChecked={Boolean(l.is_published)}
                    />
                    Published
                  </label>

                  {/* Delivery */}
                  <div className="rounded-lg border rr-card p-4 grid gap-2">
                    <div className="text-sm font-medium">Delivery</div>

                    <div className="grid gap-1">
                      <label className="text-sm">Delivery mode</label>
                      <select
                        className="rounded-md border px-3 py-2"
                        name="delivery_mode"
                        defaultValue={l.delivery_mode ?? "pickup_only"}
                      >
                        <option value="pickup_only">Local pickup only</option>
                        <option value="pickup_or_delivery">
                          Pickup or delivery
                        </option>
                        <option value="delivery_only">Delivery only</option>
                      </select>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="grid gap-1">
                        <label className="text-sm">Delivery miles</label>
                        <input
                          className="rounded-md border px-3 py-2"
                          name="delivery_miles"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={(l as any).delivery_miles ?? 0}
                        />
                      </div>

                      <div className="grid gap-1">
                        <label className="text-sm">Delivery fee</label>

                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                            $
                          </span>

                          <input
                            className="rounded-md border pl-8 pr-3 py-2 w-full"
                            name="delivery_fee"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={l.delivery_fee ?? 0}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Operator */}
                  <div className="rounded-lg border bg-slate-50 p-4 grid gap-3">
                    <div className="text-sm font-medium">Operator</div>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="operator_enabled"
                        value="true"
                      />
                      Offer operator
                    </label>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="operator_daily_enabled"
                          value="true"
                        />
                        Daily rate
                      </label>

                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="operator_hourly_enabled"
                          value="true"
                        />
                        Hourly rate
                      </label>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="grid gap-1">
                        <label className="text-sm">Operator day rate</label>

                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                            $
                          </span>

                          <input
                            className="rounded-md border pl-8 pr-3 py-2 w-full"
                            name="operator_day_rate"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={0}
                          />
                        </div>
                      </div>

                      <div className="grid gap-1">
                        <label className="text-sm">Operator hour rate</label>

                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                            $
                          </span>

                          <input
                            className="rounded-md border pl-8 pr-3 py-2 w-full"
                            name="operator_hour_rate"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={0}
                          />
                        </div>
                      </div>

                      <div className="grid gap-1">
                        <label className="text-sm">Max hours (if hourly)</label>
                        <input
                          className="rounded-md border px-3 py-2"
                          name="operator_max_hours"
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={24}
                        />
                      </div>
                    </div>
                  </div>
                  {/* Driver */}
                  <div className="rounded-lg border rr-card p-4 grid gap-2">
                    <div className="text-sm font-medium">Driver</div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="driver_enabled"
                        value="true"
                        defaultChecked={Boolean(l.driver_enabled)}
                      />{" "}
                      Offer driver
                    </label>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="driver_daily_enabled"
                          value="true"
                          defaultChecked={Boolean(l.driver_daily_enabled)}
                        />{" "}
                        Daily rate
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="driver_hourly_enabled"
                          value="true"
                          defaultChecked={Boolean(l.driver_hourly_enabled)}
                        />{" "}
                        Hourly rate
                      </label>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="grid gap-1">
                        <label className="text-sm">Driver day rate</label>

                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                            $
                          </span>

                          <input
                            className="rounded-md border pl-8 pr-3 py-2 w-full"
                            name="driver_day_rate"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={l.driver_day_rate ?? 0}
                          />
                        </div>
                      </div>
                      <div className="grid gap-1">
                        <label className="text-sm">Driver hour rate</label>

                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                            $
                          </span>

                          <input
                            className="rounded-md border pl-8 pr-3 py-2 w-full"
                            name="driver_hour_rate"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={l.driver_hour_rate ?? 0}
                          />
                        </div>
                      </div>
                      <div className="grid gap-1">
                        <label className="text-sm">Max hours (if hourly)</label>
                        <input
                          className="rounded-md border px-3 py-2"
                          name="driver_max_hours"
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={l.driver_max_hours ?? 24}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Driver + Labor */}
                  <div className="rounded-lg border rr-card p-4 grid gap-2">
                    <div className="text-sm font-medium">Driver + Labor</div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="driver_labor_enabled"
                        value="true"
                        defaultChecked={Boolean(l.driver_labor_enabled)}
                      />{" "}
                      Offer driver + labor
                    </label>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="driver_labor_daily_enabled"
                          value="true"
                          defaultChecked={Boolean(l.driver_labor_daily_enabled)}
                        />{" "}
                        Daily rate
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="driver_labor_hourly_enabled"
                          value="true"
                          defaultChecked={Boolean(
                            l.driver_labor_hourly_enabled,
                          )}
                        />{" "}
                        Hourly rate
                      </label>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="grid gap-1">
                        <label className="text-sm">Driver+Labor day rate</label>

                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                            $
                          </span>

                          <input
                            className="rounded-md border pl-8 pr-3 py-2 w-full"
                            name="driver_labor_day_rate"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={l.driver_labor_day_rate ?? 0}
                          />
                        </div>
                      </div>
                      <div className="grid gap-1">
                        <label className="text-sm">
                          Driver+Labor hour rate
                        </label>

                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                            $
                          </span>

                          <input
                            className="rounded-md border pl-8 pr-3 py-2 w-full"
                            name="driver_labor_hour_rate"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={l.driver_labor_hour_rate ?? 0}
                          />
                        </div>
                      </div>
                      <div className="grid gap-1">
                        <label className="text-sm">Max hours (if hourly)</label>
                        <input
                          className="rounded-md border px-3 py-2"
                          name="driver_labor_max_hours"
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={l.driver_labor_max_hours ?? 24}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Min/Max + Turnaround */}
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="grid gap-1">
                      <label className="text-sm">Min rental days</label>
                      <input
                        className="rounded-md border px-3 py-2"
                        name="min_rental_days"
                        type="number"
                        min="1"
                        step="1"
                        defaultValue={l.min_rental_days ?? 1}
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-sm">Max rental days</label>
                      <input
                        className="rounded-md border px-3 py-2"
                        name="max_rental_days"
                        type="number"
                        min="1"
                        step="1"
                        defaultValue={(l.max_rental_days as any) ?? ""}
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-sm">Turnaround days</label>
                      <input
                        className="rounded-md border px-3 py-2"
                        name="turnaround_days"
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={l.turnaround_days ?? 0}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 border-t pt-4">
                    <button
                      disabled={isPending}
                      className="rr-btn rr-btn-primary"
                    >
                      {isPending ? "Saving..." : "Save"}
                    </button>

                    <button
                      type="button"
                      className="rr-btn rr-btn-secondary"
                      onClick={() => setOpenId(null)}
                    >
                      Close
                    </button>
                  </div>

                  {msg ? <p className="text-sm">{msg}</p> : null}
                </form>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
