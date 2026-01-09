
"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (mode === "signup" && password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      try {
        if (!email || !password) {
          setMessage("Email and password are required.");
          return;
        }

        if (mode === "signin") {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            setMessage(error.message || "Sign in failed.");
            return;
          }

          router.push("/dashboard");
          router.refresh();
          return;
        }

        // SIGN UP
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setMessage(error.message || "Sign up failed.");
          return;
        }

        setMessage(
          "Account created. Please check your email (if confirmation is required), then sign in."
        );
        setMode("signin");
        setConfirm("");
      } catch (err: any) {
        setMessage(err?.message ?? "Something went wrong.");
      }
    });
  }

  const title = mode === "signin" ? "Sign in to RentRig" : "Create your RentRig account";
  const cta = mode === "signin" ? "Sign in" : "Sign up";

  return (
    <div className="min-h-screen bg-[#f97316] flex flex-col items-center justify-center px-4">
      {/* Brand header */}
      <div className="mb-6 text-center">
        <div
          className="
            text-5xl font-extrabold text-black
            [text-shadow:_3px_3px_0_#fff,_-3px_3px_0_#fff,_3px_-3px_0_#fff,_-3px_-3px_0_#fff]
          "
        >
          RentRig
        </div>
        <p className="mt-2 text-sm text-black/80">
          Heavy equipment & rig rentals made simple.
        </p>
      </div>

      {/* Auth card */}
      <div className="w-full max-w-md rounded-2xl border border-black bg-gradient-to-b from-white to-slate-100 shadow-[0_8px_0_#000] p-6 rr-card">
        {/* Tabs */}
        <div className="mb-4 flex rounded-full bg-slate-200 p-1 text-xs font-semibold uppercase tracking-wide">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setMessage(null);
            }}
            className={`flex-1 rounded-full px-3 py-2 ${
              mode === "signin"
                ? "bg-black text-white shadow-[0_2px_0_#000]"
                : "text-slate-700"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setMessage(null);
            }}
            className={`flex-1 rounded-full px-3 py-2 ${
              mode === "signup"
                ? "bg-black text-white shadow-[0_2px_0_#000]"
                : "text-slate-700"
            }`}
          >
            Sign up
          </button>
        </div>

        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-xs text-slate-600">
          Use the same email for both owner and renter activity.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 grid gap-4">
          <div className="grid gap-1 text-sm">
            <label className="font-medium">Email</label>
            <input
              type="email"
              autoComplete="email"
              className="rr-input w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="grid gap-1 text-sm">
            <label className="font-medium">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              className="rr-input w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
            />
          </div>

          {mode === "signup" && (
            <div className="grid gap-1 text-sm">
              <label className="font-medium">Confirm password</label>
              <input
                type="password"
                autoComplete="new-password"
                className="rr-input w-full"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="********"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="rr-btn rr-btn-primary mt-2 w-full"
          >
            {isPending ? "Working..." : cta}
          </button>

          {message && (
            <p className="mt-1 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {message}
            </p>
          )}
        </form>

        <p className="mt-4 text-[11px] text-slate-500">
          By continuing, you agree that all rentals are subject to your own rental
          agreement and local regulations. RentRig is a marketplace-style tool;
          you control your listings and contracts.
        </p>
      </div>
    </div>
  );
}
