
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

function NavLink({
  href,
  label,
  badge,
}: {
  href: string;
  label: string;
  badge?: number;
}) {
  const pathname = usePathname();
  const active = pathname === href;

  const baseClasses = active ? "rr-btn rr-btn-primary" : "rr-btn rr-btn-secondary";

  return (
    <Link
      href={href}
      className={`${baseClasses} flex items-center gap-2`}
      aria-current={active ? "page" : undefined}
    >
      <span>{label}</span>
      {badge && badge > 0 && (
        <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-[0.65rem] font-semibold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

export default function Header({
  role,
  pendingCount,
}: {
  role?: string;
  pendingCount?: number;
}) {

  const title = role === "admin" ? "Admin" : "Dashboard";
  const subtitle =
    role === "admin"
      ? "Admin controls and system management"
      : "Manage your listings and rentals";

  return (
    <header
      className="
        sticky top-0 z-30 
        border-b border-slate-900/40
        bg-gradient-to-b from-slate-900/80 via-slate-800/70 to-slate-700/70
        backdrop-blur-sm
      "
    >
      {/* Light header bar on top of dark strip */}
      <div className="mx-auto max-w-5xl px-6 py-1">
        <div
  className="
    rounded-b-xl
    bg-gradient-to-b from-slate-50 via-white to-slate-100
    shadow-[0_18px_40px_rgba(15,23,42,0.45)]
    px-6 py-2.5
    flex flex-col gap-2
  "
>
          {/* TOP ROW: NAV | BRAND | LOGOUT */}
          <div className="grid items-center gap-2 md:grid-cols-[1fr_auto_1fr]">
            {/* Left: Nav */}
            <nav className="flex items-center gap-2 justify-start">
              <NavLink href="/dashboard" label="Dashboard" />
              {role === "admin" && <NavLink href="/admin" label="Admin" />}
            </nav>

            {/* Center: Brand */}
            <div className="relative flex flex-col items-center justify-center">
              <div
                className="
                  text-4xl md:text-5xl 
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

              <div className="text-[0.70rem] md:text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                Heavy Equipment Rentals
              </div>
            </div>

            {/* Right: Logout */}
            <div className="flex justify-end">
              <LogoutButton />
            </div>
          </div>

          {/* PAGE TITLE + SUBTITLE (small, clean, modern) */}
          <div className="flex flex-col gap-0.5 text-sm md:flex-row md:items-baseline md:justify-between mt-1">
            <div className="text-base font-semibold text-slate-900">{title}</div>
            <div className="text-xs font-medium text-slate-600">{subtitle}</div>
          </div>
          {/* GLOBAL NAV ROW: visible on every page that uses ServerHeader */}
          <div className="mt-2 flex flex-wrap gap-2 text-xs md:text-sm">
            <NavLink href="/dashboard/listings" label="My Listings" />
            <NavLink href="/dashboard/listings/new" label="Create Listing" />
            <NavLink href="/dashboard/rentals" label="My Rentals" />
            <NavLink
              href="/dashboard/owner-rentals"
              label="Owner Requests"
              badge={pendingCount}
            />
            <NavLink href="/listings" label="Browse Listings" />
          </div>

        </div>
      </div>
    </header>
  );
}
