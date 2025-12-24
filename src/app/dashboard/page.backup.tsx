"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleLogout() {
    await fetch("/logout", { method: "POST" });

    startTransition(() => {
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Dashboard</h1>

      <button onClick={handleLogout} disabled={isPending}>
        {isPending ? "Logging out..." : "Log out"}
      </button>
    </div>
  );
}
