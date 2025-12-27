"use client";

import { useState, useTransition } from "react";
import { createListing, deleteListing, togglePublish } from "@/app/dashboard/listings/actions";

type Listing = {
  id: string;
  title: string;
  description: string | null;
  city: string | null;
  state: string | null;
  price_per_day: number;
  is_published: boolean;
  created_at: string;
};

export default function MyListingsClient({ listings }: { listings: Listing[] }) {
  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mt-8 grid gap-8">
      <form
        className="rounded-xl border bg-white p-5 shadow-sm grid gap-3 max-w-2xl"
        action={(fd) => {
          setMsg("");
          startTransition(async () => {
            const res = await createListing(fd);
            setMsg(res.message);
          });
        }}
      >
        <h2 className="text-lg font-semibold">Create a listing</h2>

        <label className="grid gap-1">
          <span className="text-sm text-slate-600">Title</span>
          <input name="title" className="border rounded-lg p-2" placeholder="e.g. 2020 Ford F-250" />
        </label>

        <label className="grid gap-1">
          <span className="text-sm text-slate-600">Description</span>
          <textarea name="description" className="border rounded-lg p-2" placeholder="Details (optional)" />
        </label>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1">
            <span className="text-sm text-slate-600">City</span>
            <input name="city" className="border rounded-lg p-2" placeholder="Orlando" />
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-slate-600">State</span>
            <input name="state" className="border rounded-lg p-2" placeholder="FL" />
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-slate-600">Price / day</span>
            <input name="price_per_day" className="border rounded-lg p-2" defaultValue="0" />
          </label>
        </div>

        <button className="rounded-lg border px-4 py-2 w-fit" disabled={isPending}>
          {isPending ? "Working..." : "Create"}
        </button>

        {msg && <p className="text-sm">{msg}</p>}
      </form>

      <div className="grid gap-3">
        <h2 className="text-lg font-semibold">My listings</h2>

        {listings.length === 0 ? (
          <p className="text-slate-600">No listings yet.</p>
        ) : (
          <div className="grid gap-3">
            {listings.map((l) => (
              <div key={l.id} className="rounded-xl border bg-white p-5 shadow-sm grid gap-2">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold">{l.title}</div>
                    <div className="text-sm text-slate-600">
                      ${Number(l.price_per_day).toFixed(2)}/day
                      {l.city || l.state ? ` • ${[l.city, l.state].filter(Boolean).join(", ")}` : ""}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      className="rounded-lg border px-3 py-2"
                      onClick={() => {
                        setMsg("");
                        startTransition(async () => {
                          const res = await togglePublish(l.id, !l.is_published);
                          setMsg(res.message);
                        });
                      }}
                      disabled={isPending}
                    >
                      {l.is_published ? "Unpublish" : "Publish"}
                    </button>

                    <button
                      className="rounded-lg border px-3 py-2"
                      onClick={() => {
                        setMsg("");
                        startTransition(async () => {
                          const res = await deleteListing(l.id);
                          setMsg(res.message);
                        });
                      }}
                      disabled={isPending}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {l.description && <div className="text-sm text-slate-700">{l.description}</div>}
                <div className="text-xs text-slate-500 break-all">ID: {l.id}</div>
              </div>
            ))}
          </div>
        )}

        {msg && <p className="text-sm">{msg}</p>}
      </div>
    </div>
  );
}
