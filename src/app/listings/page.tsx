export const dynamic = "force-dynamic";

import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";

export default async function ListingsPage() {
  const supabase = await createClient();

  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, description, city, state, price_per_day, created_at")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  return (
    <>
      <ServerHeader />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold">Listings</h1>
        <p className="mt-2 text-slate-600">Browse available rigs.</p>

        <div className="mt-8 grid gap-4">
          {(listings ?? []).length === 0 ? (
            <p className="text-slate-600">No published listings yet.</p>
          ) : (
            (listings ?? []).map((l) => (
              <div key={l.id} className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <a className="font-semibold underline" href={`/listings/${l.id}`}>
  {l.title}
</a>
                    <div className="text-sm text-slate-600">
                      ${Number(l.price_per_day).toFixed(2)}/day
                      {l.city || l.state ? ` • ${[l.city, l.state].filter(Boolean).join(", ")}` : ""}
                    </div>
                  </div>
                </div>

                {l.description && <div className="mt-2 text-sm text-slate-700">{l.description}</div>}
              </div>
            ))
          )}
        </div>
      </main>
    </>
  );
}
