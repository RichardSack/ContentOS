import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ContentOS",
  description: "Plattformagnostische Social-Content-Suchmaschine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className="bg-black text-white min-h-screen antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
