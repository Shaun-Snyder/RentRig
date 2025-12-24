"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

type HeaderProps = {
  isAdmin?: boolean;
  isAuthed?: boolean;
};

export default function Header({ isAdmin = false, isAuthed = false }: HeaderProps) {
  const pathname = usePathname();

  const linkClass = (href: string) =>
    `px-3 py-2 rounded-md text-sm font-medium ${
      pathname === href
        ? "bg-gray-900 text-white"
        : "text-gray-700 hover:bg-gray-100"
    }`;

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight">RentRig</span>

          <nav className="flex items-center gap-1">
            {isAuthed ? (
              <>
                <Link className={linkClass("/dashboard")} href="/dashboard">
                  Dashboard
                </Link>

                {isAdmin ? (
                  <Link className={linkClass("/admin")} href="/admin">
                    Admin
                  </Link>
                ) : null}
              </>
            ) : (
              <Link className={linkClass("/login")} href="/login">
                Login
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {isAuthed ? <LogoutButton /> : null}
        </div>
      </div>
    </header>
  );
}

