import Link from "next/link";

export default function SignupPage() {
  return (
    <div
      className="
        min-h-screen
        flex items-center justify-center
        bg-cover bg-center bg-fixed
      "
      style={{ backgroundImage: "url('/diamond-plate.png')" }}
    >
      <div
        className="
          w-full max-w-md
          rounded-2xl
          bg-gradient-to-b from-slate-50 via-white to-slate-100
          shadow-[0_18px_45px_rgba(15,23,42,0.7)]
          border border-slate-200/80
          px-8 py-8
        "
      >
        {/* BRAND / TITLE */}
        <div className="mb-6 text-center">
          <div
            className="
              text-5xl
              font-extrabold
              tracking-tight
              text-black
            "
            style={{
              WebkitTextStroke: "1px white",
              textShadow:
                "0 1px 3px rgba(0,0,0,0.45), 0 4px 12px rgba(0,0,0,0.25)",
            }}
          >
            RentRig
          </div>
          <div className="mt-1 text-[0.70rem] font-semibold uppercase tracking-[0.25em] text-slate-500">
            Heavy Equipment Rentals
          </div>
        </div>

        <h1 className="text-xl font-semibold text-slate-900">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Sign up to start listing and managing your equipment rentals.
        </p>

        <form
          method="POST"
          action="/api/signup"
          className="mt-6 grid gap-4"
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
              autoComplete="new-password"
              className="rounded-lg border border-slate-500 px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 bg-white"
            />
          </div>

          <button
            type="submit"
            className="
              mt-2 inline-flex items-center justify-center
              w-full rounded-lg
              bg-slate-900 text-white text-sm font-semibold
              px-4 py-2.5
              shadow-[0_10px_30px_rgba(15,23,42,0.7)]
              hover:bg-black
            "
          >
            Create account
          </button>
        </form>

        <p className="mt-4 text-[0.8rem] text-slate-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-slate-800 hover:underline"
          >
            Sign in
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

