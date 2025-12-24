(
echo import Header from "@/components/Header";
echo import { createClient } from "@/lib/supabase/server";
echo.
echo export default async function DashboardPage() {
echo   const supabase = await createClient();
echo.
echo   const {
echo     data: { user },
echo   } = await supabase.auth.getUser();
echo.
echo   if (!user) {
echo     return (
echo       ^<div className="p-6"^>
echo         ^<p^>You are not logged in.^</p^>
echo       ^</div^>
echo     );
echo   }
echo.
echo   const email = user.email ?? "(no email)";
echo   const name =
echo     (user.user_metadata?.full_name as string) ^
echo     ^|^| (user.user_metadata?.name as string) ^
echo     ^|^| null;
echo.
echo   return (
echo     ^<div className="min-h-screen bg-gray-50"^>
echo       ^<Header /^>
echo.
echo       ^<main className="mx-auto max-w-5xl px-4 py-8"^>
echo         ^<div className="rounded-xl border bg-white p-6 shadow-sm"^>
echo           ^<h1 className="text-2xl font-semibold"^>Dashboard^</h1^>
echo           ^<p className="mt-2 text-gray-700"^>
echo             Welcome{ name ? `, ${name}` : "" }.
echo           ^</p^>
echo.
echo           ^<div className="mt-6 grid gap-4 md:grid-cols-2"^>
echo             ^<div className="rounded-lg border p-4"^>
echo               ^<div className="text-sm text-gray-500"^>Signed in as^</div^>
echo               ^<div className="mt-1 font-medium"^>{email}^</div^>
echo             ^</div^>
echo.
echo             ^<div className="rounded-lg border p-4"^>
echo               ^<div className="text-sm text-gray-500"^>User ID^</div^>
echo               ^<div className="mt-1 font-mono text-sm break-all"^>
echo                 {user.id}
echo               ^</div^>
echo             ^</div^>
echo           ^</div^>
echo.
echo           ^<div className="mt-6 text-sm text-gray-500"^>
echo             Next: roles, profile table, and deployment hardening.
echo           ^</div^>
echo         ^</div^>
echo       ^</main^>
echo     ^</div^>
echo   );
echo }
) > src\app\dashboard\page.tsx
