"use client";

import Link from "next/link";

type ThreadRental = {
  id: string;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;

  listing?: {
    id: string;
    title: string;
    owner_id?: string | null;
    thumb_url?: string | null;
  } | null;

  latest_message_body?: string | null;
  latest_message_at?: string | null;
};

function fmtDate(s?: string | null) {
  if (!s) return "";
  return s.slice(0, 10);
}

export default function ThreadsListClient({
  rentals,
}: {
  rentals: ThreadRental[];
}) {
  if (!rentals || rentals.length === 0) {
    return (
      <div className="rr-card p-6 text-slate-600">
        No message threads yet. Messages appear after a rental request exists.
      </div>
    );
  }

  return (
  <div className="grid gap-3">
    <div className="rounded-lg border bg-white">
        <div className="border-b px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">Messages</div>
          <div className="text-xs text-slate-500">By rental</div>
        </div>

        <div>
  {rentals.map((r) => {
            const thumb = r.listing?.thumb_url ?? "";

            return (
              <Link
                key={r.id}
                href={`/dashboard/messages/${r.id}`}
                prefetch={false}
                className="block px-4 py-3 border-b hover:bg-slate-50 transition"
              >
                <div className="flex gap-3">
                  {/* Thumbnail */}
                  <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md border bg-slate-50">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                        Photo
                      </div>
                    )}
                  </div>

                  {/* Text */}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {r.listing?.title ?? "Listing"}
                    </div>

                    <div className="mt-0.5 text-xs text-slate-600">
                      {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
                      {r.status ? ` • ${r.status}` : ""}
                    </div>

                    {r.latest_message_body ? (
                      <div className="mt-1 text-xs text-slate-500 truncate">
                        {r.latest_message_body}
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-slate-400 italic">
                        No messages yet
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
