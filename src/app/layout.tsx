import "./globals.css";

export const metadata = {
  title: "RentRig",
  description: "Manage your equipment and rig rentals.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased font-sans tracking-tight">
        {/* Page background: soft light gradient, no watermark */}
        <div className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-slate-200 text-slate-900">
          {children}
        </div>
      </body>
    </html>
  );
}
