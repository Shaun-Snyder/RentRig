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
    .select("id, full_name, company_name, city, state, occupation, avatar_url, profile_summary")
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

        <div className="rr-card mt-4 p-5 rounded-none border shadow-sm space-y-3">

                    <div className="flex items-start gap-5">
            <div className="w-44 h-44 md:w-56 md:h-56 border border-slate-300 bg-slate-100 overflow-hidden">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : null}
            </div>

                     <div>
  <div className="text-xs text-slate-500 font-semibold tracking-wide">
    NAME
  </div>
  <div className="font-semibold text-lg">
    {profile.full_name || "No name"}
  </div>

  {profile.company_name ? (
    <>
      <div className="mt-2 text-xs text-slate-500 font-semibold tracking-wide">
        COMPANY
      </div>
      <div className="text-sm text-slate-800">
        {profile.company_name}
      </div>
    </>
  ) : null}

  {profile.occupation ? (
    <>
      <div className="mt-2 text-xs text-slate-500 font-semibold tracking-wide">
        OCCUPATION
      </div>
      <div className="text-sm text-slate-800">
        {profile.occupation}
      </div>
    </>
  ) : null}

  {(profile.city || profile.state) ? (
    <>
      <div className="mt-2 text-xs text-slate-500 font-semibold tracking-wide">
        LOCATION
      </div>
      <div className="text-sm text-slate-800">
        {[profile.city, profile.state].filter(Boolean).join(", ")}
      </div>
    </>
  ) : null}

  <div className="mt-2 text-xs text-slate-500 font-semibold tracking-wide">
    RATING
  </div>
  <div className="text-sm text-slate-800">
    {averageRating
      ? `★ ${averageRating} (${ratingCount} review${ratingCount === 1 ? "" : "s"})`
      : "No reviews yet"}
  </div>
</div>   
          </div>
          
                    {profile.profile_summary && (
            <div className="mt-4">
              <div className="text-xs text-slate-500 font-semibold tracking-wide">
                SUMMARY
              </div>
              <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                {profile.profile_summary}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}