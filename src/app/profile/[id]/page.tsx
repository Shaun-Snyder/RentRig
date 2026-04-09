import ServerHeader from "@/components/ServerHeader";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

    const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, company_name, avatar_url, profile_summary")
    .eq("id", params.id)
    .single();

  const { data: ratings } = await supabase
    .from("profile_ratings")
    .select("stars")
    .eq("reviewed_user_id", params.id);

    if (!profile) notFound();

  const ratingCount = ratings?.length ?? 0;

let averageRating: string | null = null;

if (ratingCount > 0) {
  const total = ratings!.reduce(
    (sum, row) => sum + Number(row.stars ?? 0),
    0
  );
  averageRating = (total / ratingCount).toFixed(1);
}

  return (
    <div>
      <ServerHeader />

      <div className="mx-auto max-w-3xl px-6 py-6">
        <PageHeader title={profile.full_name || "User Profile"} />

        <div className="rr-card mt-4 p-4 rounded-none border shadow-sm">

                    <div className="flex items-center gap-4">
            <div className="h-24 w-24 border-4 border-black bg-slate-200 overflow-hidden">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : null}
            </div>

            <div>
              <div className="font-semibold text-lg">
                {profile.full_name || "No name"}
              </div>

              {profile.company_name ? (
                <div className="mt-1 text-sm text-slate-600">
                  {profile.company_name}
                </div>
              ) : null}

              <div className="mt-1 text-sm text-slate-600">
                {averageRating
                  ? `★ ${averageRating} (${ratingCount} review${ratingCount === 1 ? "" : "s"})`
                  : "No reviews yet"}
              </div>
            </div>
          </div>
          
          {profile.profile_summary && (
            <div className="mt-4 text-sm text-slate-700 whitespace-pre-wrap">
              {profile.profile_summary}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}