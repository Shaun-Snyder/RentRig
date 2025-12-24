import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error) {
    // If the user somehow doesn't have a profile row yet, send them back.
    redirect("/dashboard");
  }

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ServerHeader />

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Admin</h1>
          <p className="mt-2 text-gray-700">
            You have admin access. ✅
          </p>
        </div>
      </main>
    </div>
  );
}
