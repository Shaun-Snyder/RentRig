"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type ThreadRental = {
  id: string; // rental_id
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;

  listing?: {
    id: string;
    title: string;
    owner_id?: string | null;
  } | null;

  renter?: {
    id: string;
    email?: string | null;
  } | null;
};

type MsgRow = {
  id: string;
  rental_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

function fmtDate(s?: string | null) {
  if (!s) return "";
  // keep simple; you can prettify later
  return s.slice(0, 10);
}

export default function MessagesClient({ rentals }: { rentals: ThreadRental[] }) {
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  const [me, setMe] = useState<string | null>(null);
  const [activeRentalId, setActiveRentalId] = useState<string | null>(
    rentals?.[0]?.id ?? null
  );

  const [messagesByRental, setMessagesByRental] = useState<Record<string, MsgRow[]>>({});
  const [loadingRental, setLoadingRental] = useState<string | null>(null);
  const [sendText, setSendText] = useState("");

  // who am I
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMe(data?.user?.id ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeRental = useMemo(
    () => rentals.find((r) => r.id === activeRentalId) ?? null,
    [rentals, activeRentalId]
  );

  async function loadMessages(rentalId: string) {
    setLoadingRental(rentalId);
    try {
      const { data, error } = await supabase
        .from("rental_messages")
        .select("id, rental_id, sender_id, body, created_at")
        .eq("rental_id", rentalId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setMessagesByRental((p) => ({ ...p, [rentalId]: (data ?? []) as MsgRow[] }));
    } catch (e: any) {
      alert(e?.message ?? "Failed to load messages.");
    } finally {
      setLoadingRental(null);
    }
  }

  // load messages when active changes (lazy)
  useEffect(() => {
    if (!activeRentalId) return;
    if (messagesByRental[activeRentalId]) return; // already loaded
    loadMessages(activeRentalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRentalId]);

  async function sendMessage() {
    const rentalId = activeRentalId;
    const body = sendText.trim();
    if (!rentalId || !body) return;
    if (!me) {
      alert("You must be signed in.");
      return;
    }

    startTransition(async () => {
      try {
        const { error } = await supabase.from("rental_messages").insert({
          rental_id: rentalId,
          sender_id: me,
          body,
        });

        if (error) throw error;

        setSendText("");
        // refresh that thread
        await loadMessages(rentalId);
      } catch (e: any) {
        alert(e?.message ?? "Send failed.");
      }
    });
  }

  if (!rentals || rentals.length === 0) {
    return (
      <div className="rr-card p-6 text-slate-600">
        No message threads yet. Messages appear after a rental request exists.
      </div>
    );
  }

  const activeMsgs = activeRentalId ? messagesByRental[activeRentalId] ?? [] : [];

  return (
    <div className="rr-card p-4 md:p-6">
      <div className="grid gap-4 md:grid-cols-[320px_minmax(0,1fr)]">
        {/* LEFT: Threads */}
        <div className="rounded-lg border bg-white">
          <div className="border-b px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">Messages</div>
            <div className="text-xs text-slate-500">By rental</div>
          </div>

          <div className="max-h-[70vh] overflow-auto">
            {rentals.map((r) => {
              const active = r.id === activeRentalId;
              return (
                <Link
  key={r.id}
  href={`/dashboard/messages/${encodeURIComponent(r.id)}`}
  onClick={() => setActiveRentalId(r.id)} // keeps your current behavior too
  className={[
    "w-full text-left px-4 py-3 border-b block",
    active ? "bg-slate-50" : "bg-white hover:bg-slate-50",
  ].join(" ")}
>
  <div className="text-sm font-semibold text-slate-900">
    {r.listing?.title ?? "Listing"}
  </div>
  <div className="mt-0.5 text-xs text-slate-600">
    {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
    {r.status ? ` • ${r.status}` : ""}
  </div>
</Link>

              );
            })}
          </div>
        </div>

        {/* RIGHT: Chat */}
        <div className="rounded-lg border bg-white flex flex-col">
          <div className="border-b px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">
                {activeRental?.listing?.title ?? "Thread"}
              </div>
              <div className="text-xs text-slate-500">
                Rental: {activeRental?.id ?? ""}
              </div>
            </div>

            <button
              type="button"
              className="rr-btn rr-btn-secondary rr-btn-sm"
              onClick={() => activeRentalId && loadMessages(activeRentalId)}
              disabled={!activeRentalId || loadingRental === activeRentalId}
            >
              {loadingRental === activeRentalId ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="flex-1 p-4 overflow-auto max-h-[60vh]">
            {loadingRental === activeRentalId && activeMsgs.length === 0 ? (
              <div className="text-sm text-slate-500">Loading…</div>
            ) : activeMsgs.length === 0 ? (
              <div className="text-sm text-slate-500">No messages yet.</div>
            ) : (
              <div className="grid gap-2">
                {activeMsgs.map((m) => {
                  const mine = me && m.sender_id === me;
                  return (
                    <div
                      key={m.id}
                      className={[
                        "max-w-[85%] rounded-lg border px-3 py-2 text-sm",
                        mine ? "ml-auto bg-slate-900 text-white border-slate-900" : "bg-slate-50",
                      ].join(" ")}
                    >
                      <div className={mine ? "text-white" : "text-slate-900"}>{m.body}</div>
                      <div className={mine ? "text-white/70" : "text-slate-500"} style={{ fontSize: 11 }}>
                        {m.created_at?.replace("T", " ").slice(0, 16)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t p-3 flex gap-2">
            <input
              className="rr-input flex-1"
              placeholder="Type a message…"
              value={sendText}
              onChange={(e) => setSendText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button
              type="button"
              className="rr-btn rr-btn-primary"
              disabled={isPending || !activeRentalId || !sendText.trim()}
              onClick={sendMessage}
            >
              {isPending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
