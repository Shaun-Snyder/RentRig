import Header from "./Header";
import { createClient } from "@/lib/supabase/server";

export default async function ServerHeader() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Logged out
  if (!user) {
    return <Header isAuthed={false} isAdmin={false} />;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  return <Header isAuthed={true} isAdmin={isAdmin} />;
}
