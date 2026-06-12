"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ThreadRental = {
  id: string;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  is_unread?: boolean | null;

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
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function deleteThread(rentalId: string) {
   

    setDeletingId(rentalId);

    const res = await fetch("/api/messages/thread", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rentalId }),
    });

    setDeletingId(null);

    if (!res.ok) {
  const data = await res.json().catch(() => null);
  alert(data?.error ?? "Failed to delete thread.");
  return;
}

    router.refresh();
  }

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
                  <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md border bg-slate-50">
                    {thumb ? (
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                        Photo
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900 flex-1">
                        {r.listing?.title ?? "Listing"}
                      </span>

                      {r.is_unread ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-orange-500 text-white">
                          New
                        </span>
                      ) : null}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          deleteThread(r.id);
                        }}
                        disabled={deletingId === r.id}
                        className="rr-btn rr-btn-secondary rr-btn-sm text-xs border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingId === r.id ? "Deleting..." : "Delete"}
                      </button>
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