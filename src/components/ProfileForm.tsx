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
      style={{
        display: "grid",
        gap: 12,
        maxWidth: 520,
        padding: 16,
        border: "1px solid #e5e5e5",
        borderRadius: 12,
      }}
    >
      <h2 style={{ margin: 0 }}>Profile</h2>

      <label>
        Full name
        <input
          name="full_name"
          defaultValue={initialFullName}
          placeholder="Your name"
          style={{ padding: 10, width: "100%" }}
        />
      </label>

      <label>
        Phone
        <input
          name="phone"
          defaultValue={initialPhone}
          placeholder="(optional)"
          style={{ padding: 10, width: "100%" }}
        />
      </label>

      <button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save profile"}
      </button>

      {msg && <p>{msg}</p>}
    </form>
  );
}

