"use client";

import { useTransition } from "react";

export default function LoginPage() {
  const [isPending, startTransition] = useTransition();
  const year = new Date().getFullYear();

  return (
    <div
      className="
        min-h-screen 
        flex items-center justify-center 
        bg-cover bg-center bg-fixed
      "
      style={{ backgroundImage: "url('/diamond-plate.png')" }}
    >
      {/* Chrome edge wrapper */}
      <div
        className="
          w-full max-w-md
          rounded-2xl
          bg-gradient-to-br from-slate-500 via-slate-300 to-slate-600
          p-[2px]
          shadow-[0_22px_60px_rgba(15,23,42,0.9)]
        "
      >
        {/* Inner card */}
        <div
          className="
            rounded-2xl 
            bg-gradient-to-b from-slate-50 via-white to-slate-100
            border border-slate-200/80
            px-8 py-8
          "
        >
          {/* BRAND / TITLE */}
          <div className="mb-6 text-center">
            <div
              className="
                text-6xl 
                font-extrabold 
                tracking-tight 
                text-black
              "
              style={{
                WebkitTextStroke: "1.3px white",
                textShadow:
                  "0 1px 3px rgba(0,0,0,0.55), 0 4px 14px rgba(0,0,0,0.35)",
              }}
            >
              RentRig
            </div>

            <div className="mt-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-600">
              Heavy Equipment Rentals
            </div>
          </div>

          {/* LOGIN FORM */}
          <h1 className="text-xl font-semibold text-slate-900">
            Sign in to your account
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Access your dashboard to manage listings and rentals.
          </p>

          <form
            method="POST"
            className="mt-6 grid gap-4"
            onSubmit={() => startTransition(() => {})}
          >
            <div className="grid gap-1">
              <label
                htmlFor="email"
                className="text-sm font-medium text-slate-800"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="rounded-lg border border-slate-500 px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 bg-white"
              />
            </div>

            <div className="grid gap-1">
              <label
                htmlFor="password"
                className="text-sm font-medium text-slate-800"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="rounded-lg border border-slate-500 px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 bg-white"
              />
            </div>

            {/* Two-button layout: Sign In / Sign Up */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              {/* SIGN IN BUTTON */}
              <button
                type="submit"
                disabled={isPending}
                className="
                  inline-flex items-center justify-center
                  w-full rounded-md
                  bg-slate-900 text-white text-sm font-semibold
                  px-4 py-2.5
                  shadow-[0_10px_30px_rgba(15,23,42,0.7)]
                  hover:bg-black
                  disabled:opacity-70 disabled:cursor-not-allowed
                "
              >
                {isPending ? "Signing in..." : "Sign In"}
              </button>

              {/* SIGN UP BUTTON */}
              <a
                href="/signup"
                className="
                  inline-flex items-center justify-center
                  w-full rounded-md
                  bg-gradient-to-b from-white via-slate-100 to-slate-200
                  border border-slate-500
                  text-slate-900 text-sm font-semibold
                  px-4 py-2.5
                  shadow-[0_6px_14px_rgba(0,0,0,0.25)]
                  hover:bg-white
                "
              >
                Sign Up
              </a>
            </div>
          </form>

          <p className="mt-4 text-[0.8rem] text-slate-500 text-center">
            Having trouble signing in? Contact support.
          </p>

          {/* FOOTER BAR */}
          <footer className="mt-4 border-t border-slate-300/70 pt-3 text-[0.7rem] text-slate-500 text-center">
            © {year} RentRig • Internal Beta v0.1
          </footer>
        </div>
      </div>
    </div>
  );
}
