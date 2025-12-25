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
      className={`rounded-md px-3 py-2 text-sm font-medium ${
        active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      {label}
    </Link>
  );
}

export default function Header({ role }: { role?: string }) {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="text-lg font-bold">RentRig</div>
          <nav className="flex items-center gap-2">
            <NavLink href="/dashboard" label="Dashboard" />
            {role === "admin" && <NavLink href="/admin" label="Admin" />}
          </nav>
        </div>

        <LogoutButton />
      </div>
    </header>
  );
}
