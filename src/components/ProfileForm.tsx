
"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/app/dashboard/actions";

export default function ProfileForm({
  initialFullName,
  initialPhone,
}: {
  initialFullName: string;
  initialPhone: string;
}) {
  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        setMsg("");
        startTransition(async () => {
          const res = await updateProfile(fd);
          setMsg(res.message);
        });
      }}
      className="rr-card grid gap-4 max-w-xl p-6"
    >
      <h2 className="text-xl font-semibold">Profile</h2>

      <div className="grid gap-1">
        <label className="text-sm font-medium" htmlFor="full_name">
          Full name
        </label>
        <input
          id="full_name"
          name="full_name"
          defaultValue={initialFullName}
          placeholder="Your name"
          className="rr-input w-full"
        />
      </div>

      <div className="grid gap-1">
        <label className="text-sm font-medium" htmlFor="phone">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          defaultValue={initialPhone}
          placeholder="(optional)"
          className="rr-input w-full"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rr-btn rr-btn-primary w-full"
      >
        {isPending ? "Saving..." : "Save profile"}
      </button>

      {msg && (
        <p className="text-sm text-slate-700 mt-1">
          {msg}
        </p>
      )}
    </form>
  );
}

