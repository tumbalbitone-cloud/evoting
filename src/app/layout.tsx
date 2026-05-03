import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import Navbar from "@/components/Navbar";

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
    <html lang="id">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
try {
  var until = Number(localStorage.getItem("wallet-bind-return-until") || "0");
  if (location.pathname === "/" && until > Date.now()) {
    history.replaceState(null, "", "/bind-wallet");
  }
} catch (_) {}
`,
          }}
        />
      </head>
      <body className="min-h-screen bg-dark-900 text-white selection:bg-blue-500/30">
        <Providers>
          <Navbar />
          <main className="pt-16">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
