import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const formData = await req.formData();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) {
    const url = new URL("/signup", req.url);
    url.searchParams.set("error", "Missing email or password.");
    return NextResponse.redirect(url);
  }

  // Create the user
  const { error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    const url = new URL("/signup", req.url);
    url.searchParams.set("error", error.message);
    return NextResponse.redirect(url);
  }

  // SUCCESS — send new users to the main dashboard (which shows ProfileForm)
  const url = new URL("/dashboard", req.url);
  return NextResponse.redirect(url);
}
