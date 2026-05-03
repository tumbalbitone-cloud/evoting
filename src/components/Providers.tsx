"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Toaster } from "react-hot-toast";
import { WalletProvider } from "@/context/WalletContext";
import { hasWalletBindIntent } from "@/utils/walletBindIntent";

const toasterOptions = {
  duration: 4000,
  style: {
    background: "rgb(30 41 59)",
    color: "#e2e8f0",
    border: "1px solid rgb(51 65 85)",
  },
  success: {
    iconTheme: { primary: "#22c55e", secondary: "#e2e8f0" },
  },
  error: {
    iconTheme: { primary: "#ef4444", secondary: "#e2e8f0" },
  },
} as const;

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === "/" && hasWalletBindIntent()) {
      router.replace("/bind-wallet");
    }
  }, [pathname, router]);

  return (
    <WalletProvider>
      {children}
      <Toaster position="top-center" toastOptions={toasterOptions} />
    </WalletProvider>
  );
}
