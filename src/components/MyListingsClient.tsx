
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createListing, updateListing, deleteListing } from "@/app/dashboard/listings/actions";
import Link from "next/link";

type Listing = {
  id: string;
  title: string;
  category: string;
  description: string | null;

  license_required: boolean;
  license_type: string | null;

  city?: string | null;
  state?: string | null;

  price_per_day: number | null;
  price_per_week: number | null;
  price_per_month: number | null;

  security_deposit: number | null;
  is_published: boolean;

  delivery_enabled: boolean;
  delivery_miles: number | null;
  delivery_price: number | null;

  operator_enabled: boolean;
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

function rateLabel(unit: string | null | undefined) {
  return unit === "hour" ? "/hr" : "/day";
}

export default function MyListingsClient({ listings }: { listings: Listing[] }) {
  const router = useRouter();
  const supabase = createClient();

  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  const [openId, setOpenId] = useState<string | null>(null);

  const [photosByListing, setPhotosByListing] = useState<Record<string, ListingPhoto[]>>({});
  const [photoMsgByListing, setPhotoMsgByListing] = useState<Record<string, string>>({});

  // controlled so the unit label doesn’t feel stale in the edit UI
  const [editOperatorRateUnit, setEditOperatorRateUnit] = useState<Record<string, "day" | "hour">>({});

  function storageUrl(path: string) {
    const { data } = supabase.storage.from("listing-photos").getPublicUrl(path);
    return data.publicUrl;
  }

  function getThumb(listingId: string) {
    const arr = photosByListing[listingId] ?? [];
    const sorted = arr.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return sorted[0]?.path ? storageUrl(sorted[0].path) : null;
  }

  async function uploadQueuedCreatePhotos(listingId: string, files: FileList | null) {
  if (!files || files.length === 0) return;

  for (const file of Array.from(files)) {
    const fd = new FormData();
    fd.set("listing_id", listingId);
    fd.set("file", file);

    const res = await fetch("/api/listing-photos", { method: "POST", body: fd });
    if (!res.ok) {
      let msg = `Upload failed (${res.status})`;
      try {
        const j = await res.json();
        msg = j?.error || msg;
      } catch {}
      throw new Error(msg);
    }
  }
}

  async function refreshPhotos(listingId: string) {
    setPhotoMsgByListing((p) => ({ ...p, [listingId]: "Refreshing..." }));
    try {
      const res = await fetch(`/api/listing-photos?listing_id=${encodeURIComponent(listingId)}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhotoMsgByListing((p) => ({ ...p, [listingId]: j?.error ?? "Refresh failed." }));
        return;
      }
      setPhotosByListing((p) => ({ ...p, [listingId]: (j.photos ?? []) as ListingPhoto[] }));
      setPhotoMsgByListing((p) => ({ ...p, [listingId]: "" }));
    } catch (e: any) {
      setPhotoMsgByListing((p) => ({ ...p, [listingId]: e?.message ?? "Refresh failed." }));
    }
  }

  async function uploadPhotos(listingId: string, files: FileList | null) {
    if (!files || files.length === 0) return;

    setPhotoMsgByListing((p) => ({ ...p, [listingId]: `Uploading ${files.length}...` }));

    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("listing_id", listingId);
      fd.append("photo", file);

      const res = await fetch("/api/listing-photos", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhotoMsgByListing((p) => ({
          ...p,
          [listingId]: `Upload failed (${res.status}) — ${j?.error ?? "Unknown error"}`,
        }));
        return;
      }
    }

    await refreshPhotos(listingId);
    setPhotoMsgByListing((p) => ({ ...p, [listingId]: "" }));
  }

  async function deletePhoto(photoId: string, listingId: string) {
    if (!confirm("Delete this photo?")) return;

    setPhotoMsgByListing((p) => ({ ...p, [listingId]: "Deleting..." }));
    const res = await fetch(`/api/listing-photos?photo_id=${encodeURIComponent(photoId)}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPhotoMsgByListing((p) => ({ ...p, [listingId]: j?.error ?? "Delete failed." }));
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
      setPhotoMsgByListing((p) => ({ ...p, [listingId]: j?.error ?? "Save order failed." }));
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

    fd.set("price_per_day", numStr(x.price_per_day ?? 0));
    fd.set("price_per_week", numStr(x.price_per_week));
    fd.set("price_per_month", numStr(x.price_per_month));
    fd.set("security_deposit", numStr(x.security_deposit));

    fd.set("is_published", boolStr(x.is_published));

    fd.set("delivery_enabled", boolStr(x.delivery_enabled));
    fd.set("delivery_miles", numStr(x.delivery_miles));
    fd.set("delivery_price", numStr(x.delivery_price));

    fd.set("operator_enabled", boolStr(x.operator_enabled));
    fd.set("operator_rate", numStr(x.operator_rate));
    fd.set("operator_rate_unit", (x.operator_rate_unit ?? "day").toString());
    fd.set("operator_max_hours", numStr(x.operator_max_hours ?? 24));

    fd.set("driver_enabled", boolStr(x.driver_enabled));
    fd.set("driver_daily_enabled", boolStr(x.driver_daily_enabled));
    fd.set("driver_hourly_enabled", boolStr(x.driver_hourly_enabled));
    fd.set("driver_day_rate", numStr(x.driver_day_rate));
    fd.set("driver_hour_rate", numStr(x.driver_hour_rate));
    fd.set("driver_max_hours", numStr(x.driver_max_hours ?? 24));

    fd.set("driver_labor_enabled", boolStr(x.driver_labor_enabled));
    fd.set("driver_labor_daily_enabled", boolStr(x.driver_labor_daily_enabled));
    fd.set("driver_labor_hourly_enabled", boolStr(x.driver_labor_hourly_enabled));
    fd.set("driver_labor_day_rate", numStr(x.driver_labor_day_rate));
    fd.set("driver_labor_hour_rate", numStr(x.driver_labor_hour_rate));
    fd.set("driver_labor_max_hours", numStr(x.driver_labor_max_hours ?? 24));

    fd.set("turnaround_days", numStr(x.turnaround_days ?? 0));
    fd.set("min_rental_days", numStr(x.min_rental_days ?? 1));
    fd.set("max_rental_days", x.max_rental_days == null ? "" : numStr(x.max_rental_days));

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
            const res = await fetch(`/api/listing-photos?listing_id=${encodeURIComponent(id)}`, { cache: "no-store" });
            const j = await res.json().catch(() => ({}));
            if (res.ok) obj[id] = (j.photos ?? []) as ListingPhoto[];
          })
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
      {/* CREATE */} 
       <form
        className="rounded-lg border bg-white p-4 grid gap-3"
      action={(fd) => {
  setMsg("");
  startTransition(async () => {
    try {
      const res: any = await createListing(fd);
      setMsg(res?.message ?? "Created.");
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message ?? "Create failed.");
    }
  });
}}

      >
        <div className="flex items-center justify-between">
  <h1 className="text-xl font-semibold">Dashboard</h1>
  <Link href="/dashboard" className="rounded-lg border px-3 py-2">
    Dashboard
  </Link>
</div>

        <div className="text-lg font-semibold">Create listing</div>

        <div className="grid gap-1">
          <label className="text-sm">Title</label>
          <input className="rounded-md border px-3 py-2" name="title" required />
        </div>

        <div className="grid gap-1">
          <label className="text-sm">Category</label>
          <select className="rounded-md border px-3 py-2" name="category" required defaultValue="other">
            <option value="heavy_equipment">Heavy equipment</option>
            <option value="lifts">Lifts</option>
            <option value="trailers">Trailers</option>
            <option value="vans_covered">Vans_covered</option>
            <option value="trucks">Trucks</option>
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

        <div className="grid gap-1">
          <label className="text-sm">Description</label>
          <textarea className="rounded-md border px-3 py-2" name="description" rows={3} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="grid gap-1">
            <label className="text-sm">$ / day</label>
            <input
              className="rounded-md border px-3 py-2"
              name="price_per_day"
              type="number"
              min="1"
              step="1"
              required
              defaultValue={1}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm">$ / week</label>
            <input className="rounded-md border px-3 py-2" name="price_per_week" type="number" min="0" step="1" />
          </div>
          <div className="grid gap-1">
            <label className="text-sm">$ / month</label>
            <input className="rounded-md border px-3 py-2" name="price_per_month" type="number" min="0" step="1" />
          </div>
        </div>

        <div className="grid gap-1">
          <label className="text-sm">Security deposit</label>
          <input className="rounded-md border px-3 py-2" name="security_deposit" type="number" min="0" step="1" />
        </div>
{/* License (create) */}
<div className="grid gap-2">
  <label className="text-sm font-semibold">Required license</label>

  <label className="flex items-center gap-2 text-sm">
    <input type="checkbox" name="license_required" value="true" />
    This listing requires a license
  </label>

  <div className="grid gap-1">
    <label className="text-sm text-slate-600">License type / note (shown to renter)</label>
    <input
      className="rounded-md border px-3 py-2"
      name="license_type"
      placeholder="e.g., CDL, OSHA forklift, excavator certification"
    />
  </div>
</div>

        {/* Delivery */}
        <div className="rounded-lg border bg-slate-50 p-4 grid gap-2">
          <div className="text-sm font-medium">Delivery</div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="delivery_enabled" value="true" /> Offer delivery
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1">
              <label className="text-sm">Delivery miles</label>
              <input className="rounded-md border px-3 py-2" name="delivery_miles" type="number" min="0" step="1" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Delivery price</label>
              <input className="rounded-md border px-3 py-2" name="delivery_price" type="number" min="0" step="1" />
            </div>
          </div>
        </div>

        {/* Operator */}
        <div className="rounded-lg border bg-slate-50 p-4 grid gap-2">
          <div className="text-sm font-medium">Operator</div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="operator_enabled" value="true" /> Offer operator
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1">
              <label className="text-sm">Operator rate</label>
              <input className="rounded-md border px-3 py-2" name="operator_rate" type="number" min="0" step="1" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Rate unit</label>
              <select className="rounded-md border px-3 py-2" name="operator_rate_unit" defaultValue="day">
                <option value="day">Per day</option>
                <option value="hour">Per hour</option>
              </select>
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Max hours (if hourly)</label>
              <input className="rounded-md border px-3 py-2" name="operator_max_hours" type="number" min="0" step="1" />
            </div>
          </div>
        </div>

        {/* Driver */}
        <div className="rounded-lg border bg-slate-50 p-4 grid gap-2">
          <div className="text-sm font-medium">Driver</div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="driver_enabled" value="true" /> Offer driver
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="driver_daily_enabled" value="true" /> Daily rate
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="driver_hourly_enabled" value="true" /> Hourly rate
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1">
              <label className="text-sm">Driver day rate</label>
              <input className="rounded-md border px-3 py-2" name="driver_day_rate" type="number" min="0" step="1" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Driver hour rate</label>
              <input className="rounded-md border px-3 py-2" name="driver_hour_rate" type="number" min="0" step="1" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Max hours (if hourly)</label>
              <input className="rounded-md border px-3 py-2" name="driver_max_hours" type="number" min="0" step="1" />
            </div>
          </div>
        </div>

        {/* Driver + Labor */}
        <div className="rounded-lg border bg-slate-50 p-4 grid gap-2">
          <div className="text-sm font-medium">Driver + Labor</div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="driver_labor_enabled" value="true" /> Offer driver + labor
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="driver_labor_daily_enabled" value="true" /> Daily rate
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="driver_labor_hourly_enabled" value="true" /> Hourly rate
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1">
              <label className="text-sm">Driver+Labor day rate</label>
              <input className="rounded-md border px-3 py-2" name="driver_labor_day_rate" type="number" min="0" step="1" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Driver+Labor hour rate</label>
              <input className="rounded-md border px-3 py-2" name="driver_labor_hour_rate" type="number" min="0" step="1" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Max hours (if hourly)</label>
              <input className="rounded-md border px-3 py-2" name="driver_labor_max_hours" type="number" min="0" step="1" />
            </div>
          </div>
        </div>

        {/* Min/Max + Turnaround */}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="grid gap-1">
            <label className="text-sm">Min rental days</label>
            <input className="rounded-md border px-3 py-2" name="min_rental_days" type="number" min="1" step="1" defaultValue={1} />
          </div>
          <div className="grid gap-1">
            <label className="text-sm">Max rental days</label>
            <input className="rounded-md border px-3 py-2" name="max_rental_days" type="number" min="1" step="1" />
          </div>
          <div className="grid gap-1">
            <label className="text-sm">Turnaround days</label>
            <input className="rounded-md border px-3 py-2" name="turnaround_days" type="number" min="0" step="1" defaultValue={0} />
          </div>
        </div>

        <button disabled={isPending} className="rounded-md bg-black text-white px-4 py-2 w-fit">
          {isPending ? "Creating..." : "Create listing"}
        </button>

        {msg ? <p className="text-sm">{msg}</p> : null}
      </form>

      {/* LIST */}
      <div className="grid gap-3">
        <h2 className="text-lg font-semibold">My listings</h2>

        {listings.map((l) => {
          const isOpen = openId === l.id;
          const thumb = getThumb(l.id);

          const unit = editOperatorRateUnit[l.id] ?? ((l.operator_rate_unit ?? "day") as "day" | "hour");
          const operatorEnabled = Boolean(l.operator_enabled);
          const operatorRate = Number(l.operator_rate ?? 0);

          const driverSummary = l.driver_enabled
            ? [
                l.driver_daily_enabled ? `Daily ${money(l.driver_day_rate)}` : null,
                l.driver_hourly_enabled ? `Hourly ${money(l.driver_hour_rate)} (cap ${l.driver_max_hours ?? 24})` : null,
              ]
                .filter(Boolean)
                .join(" • ")
            : "Not offered";

          const driverLaborSummary = l.driver_labor_enabled
            ? [
                l.driver_labor_daily_enabled ? `Daily ${money(l.driver_labor_day_rate)}` : null,
                l.driver_labor_hourly_enabled
                  ? `Hourly ${money(l.driver_labor_hour_rate)} (cap ${l.driver_labor_max_hours ?? 24})`
                  : null,
              ]
                .filter(Boolean)
                .join(" • ")
            : "Not offered";

          return (
            <div key={l.id} className="rounded-lg border bg-white p-4 grid gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  {thumb ? (
                    <img src={thumb} alt="" className="h-16 w-24 rounded object-cover border" />
                  ) : (
                    <div className="h-16 w-24 rounded border bg-slate-100 grid place-items-center text-xs text-slate-500">
                      No photo
                    </div>
                  )}

                  <div>
                    <div className="font-semibold">{l.title}</div>
                    <div className="text-xs text-slate-500">Category: {l.category}</div>

                    {(l.city || l.state) ? (
                      <div className="text-xs text-slate-500">
                        Location: {l.city ?? ""}
                        {l.city && l.state ? ", " : ""}
                        {l.state ?? ""}
                      </div>
                    ) : null}

                    <div className="text-xs text-slate-500">
                      Price: {money(l.price_per_day)} /day • Deposit: {money(l.security_deposit)}
                    </div>

                    <div className="text-xs text-slate-500">
                      Operator:{" "}
                      {operatorEnabled ? `Available (${money(operatorRate)}${rateLabel(unit)})` : "Not available"}
                      {operatorEnabled && unit === "hour" ? (
                        <span>
                          {" "}
                          • Hour cap: <span className="font-medium">{l.operator_max_hours ?? 24}</span>
                        </span>
                      ) : null}
                    </div>

                    <div className="text-xs text-slate-500">Driver: {driverSummary}</div>
                    <div className="text-xs text-slate-500">Driver + Labor: {driverLaborSummary}</div>
                  </div>
                </div>

                {/* ACTIONS (ONLY ONE publish button) */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-lg border px-3 py-2"
                    disabled={isPending}
                    onClick={() => {
                      setOpenId(isOpen ? null : l.id);
                      setEditOperatorRateUnit((p) => ({ ...p, [l.id]: unit }));
                      if (!isOpen) refreshPhotos(l.id);
                    }}
                  >
                    {isOpen ? "Close" : "Edit"}
                  </button>

                  <button
                    type="button"
                    className="rounded-lg border px-3 py-2"
                    disabled={isPending}
                    onClick={() => {
                      setMsg("");
                      startTransition(async () => {
                        try {
                          const nextPublished = !l.is_published;
                          const fd = buildUpdateFD(l, { is_published: nextPublished });
                          const res: any = await updateListing(fd);
                          setMsg(res?.message ?? (nextPublished ? "Published." : "Unpublished."));
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
                    className="rounded-lg border px-3 py-2 text-red-600"
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
              </div>

              {/* PHOTOS (LOCKED unless Edit open) */}
              {isOpen ? (
                <div className="rounded-lg border bg-slate-50 p-4 grid gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Photos</div>
                    <button
                      type="button"
                      className="rounded-md border px-3 py-1.5 text-sm hover:bg-white"
                      onClick={() => refreshPhotos(l.id)}
                    >
                      Refresh
                    </button>
                  </div>

                  {photoMsgByListing[l.id] ? (
                    <div className="text-sm text-slate-600">{photoMsgByListing[l.id]}</div>
                  ) : null}

                  <input type="file" multiple accept="image/*" onChange={(e) => uploadPhotos(l.id, e.target.files)} />

                  {(photosByListing[l.id] ?? []).length > 0 ? (
                    <>
                      <div className="grid gap-2">
                        {(photosByListing[l.id] ?? [])
                          .slice()
                          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                          .map((p, idx, arr) => (
                            <div key={p.id} className="flex items-center gap-3 rounded-md border bg-white p-2">
                              <img src={storageUrl(p.path)} alt="" className="h-16 w-24 rounded object-cover border" />
                              <div className="flex-1 text-sm text-slate-600 break-all">{p.path}</div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="rounded-md border px-2 py-1 text-xs hover:bg-white"
                                  onClick={() => {
                                    if (idx <= 0) return;
                                    setPhotosByListing((prev) => {
                                      const list = (prev[l.id] ?? [])
                                        .slice()
                                        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
                                      const tmp = list[idx - 1];
                                      list[idx - 1] = list[idx];
                                      list[idx] = tmp;
                                      const normalized = list.map((x, i) => ({ ...x, sort_order: i }));
                                      return { ...prev, [l.id]: normalized };
                                    });
                                  }}
                                >
                                  ↑
                                </button>

                                <button
                                  type="button"
                                  className="rounded-md border px-2 py-1 text-xs hover:bg-white"
                                  onClick={() => {
                                    if (idx >= arr.length - 1) return;
                                    setPhotosByListing((prev) => {
                                      const list = (prev[l.id] ?? [])
                                        .slice()
                                        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
                                      const tmp = list[idx + 1];
                                      list[idx + 1] = list[idx];
                                      list[idx] = tmp;
                                      const normalized = list.map((x, i) => ({ ...x, sort_order: i }));
                                      return { ...prev, [l.id]: normalized };
                                    });
                                  }}
                                >
                                  ↓
                                </button>

                                <button
                                  type="button"
                                  className="rounded-md border px-2 py-1 text-xs text-red-600 hover:bg-white"
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
                        className="rounded-md border px-3 py-1.5 text-sm w-fit hover:bg-white"
                        onClick={() => savePhotoOrder(l.id)}
                      >
                        Save photo order
                      </button>
                    </>
                  ) : (
                    <div className="text-sm text-slate-500">No photos yet.</div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border bg-slate-50 p-4 grid gap-1">
                  <div className="text-sm font-medium">Photos</div>
                  <div className="text-sm text-slate-600">Click “Edit” to upload, delete, or reorder photos.</div>
                </div>
              )}

              {/* EDIT FORM */}
              {isOpen ? (
                <form
                  className="rounded-lg border bg-slate-50 p-4 grid gap-3"
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
                    <input className="rounded-md border px-3 py-2" name="title" defaultValue={l.title} required />
                  </div>

                  <div className="grid gap-1">
                    <label className="text-sm">Category</label>
                    <select className="rounded-md border px-3 py-2" name="category" defaultValue={l.category}>
                      <option value="heavy_equipment">Heavy equipment</option>
                      <option value="lifts">Lifts</option>
                      <option value="trailers">Trailers</option>
                      <option value="vans_covered">Vans_covered</option>
                      <option value="trucks">Trucks</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-1">
                      <label className="text-sm">City</label>
                      <input className="rounded-md border px-3 py-2" name="city" defaultValue={l.city ?? ""} />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-sm">State</label>
                      <input className="rounded-md border px-3 py-2" name="state" defaultValue={l.state ?? ""} />
                    </div>
                  </div>

                  <div className="grid gap-1">
                    <label className="text-sm">Description</label>
                    <textarea className="rounded-md border px-3 py-2" name="description" rows={3} defaultValue={l.description ?? ""} />
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="grid gap-1">
                      <label className="text-sm">$ / day</label>
                      <input className="rounded-md border px-3 py-2" name="price_per_day" type="number" min="1" step="1" required defaultValue={l.price_per_day ?? 1} />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-sm">$ / week</label>
                      <input className="rounded-md border px-3 py-2" name="price_per_week" type="number" min="0" step="1" defaultValue={l.price_per_week ?? 0} />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-sm">$ / month</label>
                      <input className="rounded-md border px-3 py-2" name="price_per_month" type="number" min="0" step="1" defaultValue={l.price_per_month ?? 0} />
                    </div>
                  </div>

                  <div className="grid gap-1">
                    <label className="text-sm">Security deposit</label>
                    <input className="rounded-md border px-3 py-2" name="security_deposit" type="number" min="0" step="1" defaultValue={l.security_deposit ?? 0} />
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="is_published" value="true" defaultChecked={Boolean(l.is_published)} />
                    Published
                  </label>

                  {/* Delivery */}
                  <div className="rounded-lg border bg-white p-4 grid gap-2">
                    <div className="text-sm font-medium">Delivery</div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="delivery_enabled" value="true" defaultChecked={Boolean(l.delivery_enabled)} /> Offer delivery
                    </label>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="grid gap-1">
                        <label className="text-sm">Delivery miles</label>
                        <input className="rounded-md border px-3 py-2" name="delivery_miles" type="number" min="0" step="1" defaultValue={l.delivery_miles ?? 0} />
                      </div>
                      <div className="grid gap-1">
                        <label className="text-sm">Delivery price</label>
                        <input className="rounded-md border px-3 py-2" name="delivery_price" type="number" min="0" step="1" defaultValue={l.delivery_price ?? 0} />
                      </div>
                    </div>
                  </div>

                  {/* Operator */}
                  <div className="rounded-lg border bg-white p-4 grid gap-2">
                    <div className="text-sm font-medium">Operator</div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="operator_enabled" value="true" defaultChecked={Boolean(l.operator_enabled)} /> Offer operator
                    </label>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="grid gap-1">
                        <label className="text-sm">Operator rate</label>
                        <input className="rounded-md border px-3 py-2" name="operator_rate" type="number" min="0" step="1" defaultValue={l.operator_rate ?? 0} />
                      </div>

                      <div className="grid gap-1">
                        <label className="text-sm">Rate unit</label>
                        <select
                          className="rounded-md border px-3 py-2"
                          name="operator_rate_unit"
                          value={editOperatorRateUnit[l.id] ?? ((l.operator_rate_unit ?? "day") as any)}
                          onChange={(e) => setEditOperatorRateUnit((p) => ({ ...p, [l.id]: e.target.value as any }))}
                        >
                          <option value="day">Per day</option>
                          <option value="hour">Per hour</option>
                        </select>
                      </div>

                      <div className="grid gap-1">
                        <label className="text-sm">Max hours (if hourly)</label>
                        <input className="rounded-md border px-3 py-2" name="operator_max_hours" type="number" min="0" step="1" defaultValue={l.operator_max_hours ?? 24} />
                      </div>
                    </div>
                  </div>

                  {/* Driver */}
                  <div className="rounded-lg border bg-white p-4 grid gap-2">
                    <div className="text-sm font-medium">Driver</div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="driver_enabled" value="true" defaultChecked={Boolean(l.driver_enabled)} /> Offer driver
                    </label>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="driver_daily_enabled" value="true" defaultChecked={Boolean(l.driver_daily_enabled)} /> Daily rate
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="driver_hourly_enabled" value="true" defaultChecked={Boolean(l.driver_hourly_enabled)} /> Hourly rate
                      </label>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="grid gap-1">
                        <label className="text-sm">Driver day rate</label>
                        <input className="rounded-md border px-3 py-2" name="driver_day_rate" type="number" min="0" step="1" defaultValue={l.driver_day_rate ?? 0} />
                      </div>
                      <div className="grid gap-1">
                        <label className="text-sm">Driver hour rate</label>
                        <input className="rounded-md border px-3 py-2" name="driver_hour_rate" type="number" min="0" step="1" defaultValue={l.driver_hour_rate ?? 0} />
                      </div>
                      <div className="grid gap-1">
                        <label className="text-sm">Max hours (if hourly)</label>
                        <input className="rounded-md border px-3 py-2" name="driver_max_hours" type="number" min="0" step="1" defaultValue={l.driver_max_hours ?? 24} />
                      </div>
                    </div>
                  </div>

                  {/* Driver + Labor */}
                  <div className="rounded-lg border bg-white p-4 grid gap-2">
                    <div className="text-sm font-medium">Driver + Labor</div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="driver_labor_enabled" value="true" defaultChecked={Boolean(l.driver_labor_enabled)} /> Offer driver + labor
                    </label>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="driver_labor_daily_enabled" value="true" defaultChecked={Boolean(l.driver_labor_daily_enabled)} /> Daily rate
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="driver_labor_hourly_enabled" value="true" defaultChecked={Boolean(l.driver_labor_hourly_enabled)} /> Hourly rate
                      </label>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="grid gap-1">
                        <label className="text-sm">Driver+Labor day rate</label>
                        <input className="rounded-md border px-3 py-2" name="driver_labor_day_rate" type="number" min="0" step="1" defaultValue={l.driver_labor_day_rate ?? 0} />
                      </div>
                      <div className="grid gap-1">
                        <label className="text-sm">Driver+Labor hour rate</label>
                        <input className="rounded-md border px-3 py-2" name="driver_labor_hour_rate" type="number" min="0" step="1" defaultValue={l.driver_labor_hour_rate ?? 0} />
                      </div>
                      <div className="grid gap-1">
                        <label className="text-sm">Max hours (if hourly)</label>
                        <input className="rounded-md border px-3 py-2" name="driver_labor_max_hours" type="number" min="0" step="1" defaultValue={l.driver_labor_max_hours ?? 24} />
                      </div>
                    </div>
                  </div>

                  {/* Min/Max + Turnaround */}
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="grid gap-1">
                      <label className="text-sm">Min rental days</label>
                      <input className="rounded-md border px-3 py-2" name="min_rental_days" type="number" min="1" step="1" defaultValue={l.min_rental_days ?? 1} />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-sm">Max rental days</label>
                      <input className="rounded-md border px-3 py-2" name="max_rental_days" type="number" min="1" step="1" defaultValue={(l.max_rental_days as any) ?? ""} />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-sm">Turnaround days</label>
                      <input className="rounded-md border px-3 py-2" name="turnaround_days" type="number" min="0" step="1" defaultValue={l.turnaround_days ?? 0} />
                    </div>
                  </div>

                  <button disabled={isPending} className="rounded-md bg-black text-white px-4 py-2 w-fit">
                    {isPending ? "Saving..." : "Save"}
                  </button>

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
