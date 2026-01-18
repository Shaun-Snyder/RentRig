"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

type ThreadRental = {
  id: string;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  listing?: { id: string; title: string; owner_id?: string | null; thumb_url?: string | null } | null;
  renter?: { id: string; email?: string | null } | null;
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
  return s.slice(0, 10);
}

export default function MessageThreadClient({ rental }: { rental: ThreadRental }) {
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  const [me, setMe] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<MsgRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendText, setSendText] = useState("");

  const title = rental?.listing?.title ?? "Thread";
  const thumb = rental?.listing?.thumb_url ?? "";

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMe(data?.user?.id ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMessages() {
    if (!rental?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("rental_messages")
        .select("id, rental_id, sender_id, body, created_at")
        .eq("rental_id", rental.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMsgs((data ?? []) as MsgRow[]);
    } catch (e: any) {
      alert(e?.message ?? "Failed to load messages.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rental?.id]);

  async function sendMessage() {
    const body = sendText.trim();
    if (!rental?.id || !body) return;
    if (!me) {
      alert("You must be signed in.");
      return;
    }

    startTransition(async () => {
      try {
        const { error } = await supabase.from("rental_messages").insert({
          rental_id: rental.id,
          sender_id: me,
          body,
        });

        if (error) throw error;

        setSendText("");
        await loadMessages();
      } catch (e: any) {
        alert(e?.message ?? "Send failed.");
      }
    });
  }

  const headerLine = useMemo(() => {
    const d = `${fmtDate(rental.start_date)} → ${fmtDate(rental.end_date)}`;
    return rental.status ? `${d} • ${rental.status}` : d;
  }, [rental.start_date, rental.end_date, rental.status]);

  return (
    <div className="rr-card p-4 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3 min-w-0">
          <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border bg-slate-50">
            {thumb ? (
              <img src={thumb} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                Photo
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">{title}</div>
            <div className="text-xs text-slate-600">{headerLine}</div>
            {rental.renter?.email ? (
              <div className="text-[11px] text-slate-500 truncate">Renter: {rental.renter.email}</div>
            ) : null}
          </div>
        </div>

        <div className="flex gap-2">
          <Link href="/dashboard/messages" className="rr-btn rr-btn-secondary rr-btn-sm">
            Back
          </Link>
          <button
            type="button"
            className="rr-btn rr-btn-secondary rr-btn-sm"
            onClick={loadMessages}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-lg border bg-white">
        <div className="p-4 overflow-auto max-h-[60vh]">
          {loading && msgs.length === 0 ? (
            <div className="text-sm text-slate-500">Loading…</div>
          ) : msgs.length === 0 ? (
            <div className="text-sm text-slate-500">No messages yet.</div>
          ) : (
            <div className="grid gap-2">
              {msgs.map((m) => {
                const mine = me && m.sender_id === me;
                return (
                  <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                    <div className="flex items-end gap-2 max-w-[85%]">
                      {!mine ? (
                        <div className="h-7 w-7 rounded-full bg-slate-200 border flex items-center justify-center text-[10px] text-slate-700">
                          U
                        </div>
                      ) : null}

                      <div
                        className={[
                          "rounded-lg border px-3 py-2 text-sm",
                          mine
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-slate-50 text-slate-900",
                        ].join(" ")}
                      >
                        <div>{m.body}</div>
                        <div className={mine ? "text-white/70" : "text-slate-500"} style={{ fontSize: 11 }}>
                          {m.created_at?.replace("T", " ").slice(0, 16)}
                        </div>
                      </div>

                      {mine ? (
                        <div className="h-7 w-7 rounded-full bg-slate-900 border border-slate-900 flex items-center justify-center text-[10px] text-white">
                          Me
                        </div>
                      ) : null}
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
            disabled={isPending || !sendText.trim()}
            onClick={sendMessage}
          >
            {isPending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
