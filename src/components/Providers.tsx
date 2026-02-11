"use client";

import React, { ReactNode } from "react";
import { WalletProvider } from "../context/WalletContext";

export function Providers({ children }: { children: ReactNode }) {
    return <WalletProvider>{children}</WalletProvider>;
}
