"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function ProfileForm({ initialFullName }: { initialFullName: string }) {
  const [fullName, setFullName] = useState(initialFullName);
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const res = await fetch("/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(data?.error || "Save failed");
      return;
    }

    setMsg("Saved!");
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">Full name</div>

      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        className="mt-2 w-full rounded-md border px-3 py-2 text-sm"
        placeholder="Your name"
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          disabled={isPending}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save"}
        </button>

        {msg ? <span className="text-sm text-slate-600">{msg}</span> : null}
      </div>
    </form>
  );
}
