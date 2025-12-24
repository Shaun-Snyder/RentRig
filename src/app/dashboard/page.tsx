import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-6">
        <p>You are not logged in.</p>
      </div>
    );
  }

  const email = user.email ?? "(no email)";
  const name =
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    null;

  return (
    <div className="min-h-screen bg-gray-50">
      <ServerHeader />

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-2 text-gray-700">
            Welcome{ name ? `, ${name}` : "" }.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="text-sm text-gray-500">Signed in as</div>
              <div className="mt-1 font-medium">{email}</div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="text-sm text-gray-500">User ID</div>
              <div className="mt-1 font-mono text-sm break-all">{user.id}</div>
            </div>
          </div>

          <div className="mt-6 text-sm text-gray-500">
            Next: roles, profile table, and deployment hardening.
          </div>
        </div>
      </main>
    </div>
  );
}

