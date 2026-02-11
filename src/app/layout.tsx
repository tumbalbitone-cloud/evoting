import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Next 14 uses font/google
import "./globals.css";
import { Providers } from "@/components/Providers";
import Navbar from "@/components/Navbar";

// const inter = Inter({ subsets: ["latin"] }); 

export const metadata: Metadata = {
  title: "E-Voting DID",
  description: "Secure Digital Identity Voting System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-dark-900 text-white selection:bg-blue-500/30">
        <Providers>
          <Navbar />
          <main className="pt-16">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
