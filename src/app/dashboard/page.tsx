import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  // If not logged in, go to login
  if (error || !data?.user) {
    redirect("/login");
  }

  const user = data.user;

  return (
    <>
      <Header />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-slate-600">Welcome.</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Signed in as</div>
            <div className="mt-2 font-medium">{user.email}</div>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">User ID</div>
            <div className="mt-2 font-mono text-sm">{user.id}</div>
          </div>
        </div>

        <p className="mt-6 text-sm text-slate-500">
          Next: roles, profile table, and deployment hardening.
        </p>
      </main>
    </>
  );
}

