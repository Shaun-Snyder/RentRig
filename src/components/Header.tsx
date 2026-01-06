"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

function NavLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={
        active
          ? "rr-btn rr-btn-primary"
          : "rr-btn rr-btn-secondary"
      }
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );
}

export default function Header({ role }: { role?: string }) {
  const title = role === "admin" ? "Admin" : "Dashboard";
  const subtitle =
    role === "admin"
      ? "Admin controls and system management"
      : "Manage your listings and rentals";
return (
  <header className="border-b border-black/20 bg-transparent">
    <div className="mx-auto max-w-5xl px-6 py-5 grid gap-4">
      
     {/* TOP ROW: Nav | Brand | Logout */}
<div className="grid grid-cols-3 items-center">
  {/* Left: Nav */}
  <nav className="flex items-center gap-2 justify-start">
    <NavLink href="/dashboard" label="Dashboard" />
    {role === "admin" && <NavLink href="/admin" label="Admin" />}
  </nav>

  {/* Center: Brand */}
  <div className="flex justify-center">
    <div
      className="text-4xl font-extrabold tracking-tight text-black"
      style={{
        WebkitTextStroke: "1.5px white",
        textShadow:
          "0 1px 2px rgba(0,0,0,0.35), 0 4px 10px rgba(0,0,0,0.35)",
      }}
    >
      RentRig
    </div>
  </div>

  {/* Right: Logout */}
  <div className="flex justify-end">
    <LogoutButton />
  </div>
</div>



      {/* PAGE TITLE */}
      <div className="text-center">
        <div className="text-2xl font-extrabold tracking-tight text-black drop-shadow-sm">
          {title}
        </div>
        <div className="text-sm font-medium text-slate-800">
          {subtitle}
        </div>
      </div>

    </div>
  </header>
);

  
}
