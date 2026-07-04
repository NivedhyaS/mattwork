import type { Metadata } from "next";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";

export const metadata: Metadata = {
  title: "Mattwork",
  description: "Production-ready management platform for post-production agencies.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-950 dark:text-slate-50 transition-colors duration-150">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
