"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { ethers, BrowserProvider } from "ethers";
import toast from "react-hot-toast";
import { getRpcErrorMessage } from "../utils/rpcError";
import { getApiBaseUrl } from "../utils/api";

interface WalletContextType {
    account: string | null;
    connectWallet: () => Promise<void>;
    disconnectWallet: () => void;
    isConnected: boolean;
    provider: BrowserProvider | null;
    isConnecting: boolean;
    walletBlocked: boolean;
    walletBlockedMessage: string | null;
}

const WalletContext = createContext<WalletContextType>({
    account: null,
    connectWallet: async () => { },
    disconnectWallet: () => { },
    isConnected: false,
    provider: null,
    isConnecting: false,
    walletBlocked: false,
    walletBlockedMessage: null,
});

export const useWallet = () => useContext(WalletContext);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
    const [account, setAccount] = useState<string | null>(null);
    const [provider, setProvider] = useState<BrowserProvider | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [walletBlocked, setWalletBlocked] = useState(false);
    const [walletBlockedMessage, setWalletBlockedMessage] = useState<string | null>(null);
    const targetChainId = BigInt(process.env.NEXT_PUBLIC_CHAIN_ID || "31337");
    const targetChainHex = `0x${targetChainId.toString(16)}`;
    const targetChainName = process.env.NEXT_PUBLIC_CHAIN_NAME || (targetChainId === 31337n ? "Hardhat Localhost" : "Custom Network");
    const targetRpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545/";
    const targetBlockExplorerUrl = process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL;

    const getInjectedProvider = () => {
        if (typeof window === "undefined") return null;
        return (window as any).ethereum;
    };

    const checkNetwork = useCallback(async (provider: BrowserProvider) => {
        const network = await provider.getNetwork();
        if (network.chainId !== targetChainId) {
            try {
                await provider.send("wallet_switchEthereumChain", [{ chainId: targetChainHex }]);
            } catch (switchError: any) {
                if (switchError.code === 4902) {
                    try {
                        await provider.send("wallet_addEthereumChain", [
                            {
                                chainId: targetChainHex,
                                chainName: targetChainName,
                                rpcUrls: [targetRpcUrl],
                                nativeCurrency: {
                                    name: "ETH",
                                    symbol: "ETH",
                                    decimals: 18,
                                },
                                ...(targetBlockExplorerUrl ? { blockExplorerUrls: [targetBlockExplorerUrl] } : {}),
                            },
                        ]);
                        await provider.send("wallet_switchEthereumChain", [{ chainId: targetChainHex }]);
                    } catch (addError) {
                        console.error(addError);
                        toast.error(getRpcErrorMessage(addError));
                        throw addError;
                    }
                } else {
                    toast.error(getRpcErrorMessage(switchError));
                    throw switchError;
                }
            }
        }
    }, [targetBlockExplorerUrl, targetChainHex, targetChainId, targetChainName, targetRpcUrl]);

    const evaluateWalletOwnership = useCallback(async (address: string) => {
        // If user isn't logged in, we can't verify "used by other account" safely.
        // Allow wallet connection but don't block.
        if (typeof window === "undefined") return true;

        const token = localStorage.getItem("token");
        const currentStudentId = localStorage.getItem("username");
        if (!token || !currentStudentId) {
            setWalletBlocked(false);
            setWalletBlockedMessage(null);
            return true;
        }

        try {
            const apiUrl = getApiBaseUrl();

            const res = await fetch(`${apiUrl}/api/did/status/${address}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                // Backend deliberately returns 403 when a non-admin tries to check an address
                // bound to another studentId. Treat it as "wallet already used".
                if (res.status === 403) {
                    const msg = "Wallet tersebut sudah digunakan (tertaut ke akun lain). Silakan ganti akun wallet.";
                    setWalletBlocked(true);
                    setWalletBlockedMessage(msg);
                    return false;
                }

                // If status can't be checked (network/500/etc), don't block connection.
                setWalletBlocked(false);
                setWalletBlockedMessage(null);
                return true;
            }

            const data = await res.json();
            const usedByOther =
                !!data?.claimed &&
                !!data?.studentId &&
                String(data.studentId) !== String(currentStudentId);

            if (usedByOther) {
                const msg = `Wallet tersebut sudah digunakan (tertaut ke NIM lain: ${data.studentId}). Silakan ganti akun wallet.`;
                setWalletBlocked(true);
                setWalletBlockedMessage(msg);
                return false;
            }

            setWalletBlocked(false);
            setWalletBlockedMessage(null);
            return true;
        } catch (err) {
            console.warn("Could not verify wallet ownership:", err);
            setWalletBlocked(false);
            setWalletBlockedMessage(null);
            return true;
        }
    }, []);

    useEffect(() => {
        const injectedProvider = getInjectedProvider();
        if (!injectedProvider) return;

        const browserProvider = new ethers.BrowserProvider(injectedProvider);
        setProvider(browserProvider);

        const syncWalletState = async () => {
            try {
                const accounts = await browserProvider.listAccounts();
                if (accounts.length > 0) {
                    await checkNetwork(browserProvider);
                    setAccount(accounts[0].address);
                    return;
                }
                setAccount(null);
            } catch (error) {
                console.error("Gagal menyinkronkan wallet", error);
            }
        };

        const handleAccountsChanged = (accounts: string[]) => {
            const next = accounts[0] || null;
            if (!next) {
                setAccount(null);
                setWalletBlocked(false);
                setWalletBlockedMessage(null);
                return;
            }
            // Re-evaluate when user switches accounts in MetaMask.
            evaluateWalletOwnership(next).then((ok) => {
                setAccount(ok ? next : null);
                if (!ok) toast.error(`Wallet tersebut sudah digunakan. Silakan ganti akun wallet.`);
            });
        };

        const handleChainChanged = async () => {
            const nextProvider = new ethers.BrowserProvider(injectedProvider);
            setProvider(nextProvider);

            try {
                const accounts = await nextProvider.send("eth_accounts", []);
                if (accounts.length > 0) {
                    await checkNetwork(nextProvider);
                    const ok = await evaluateWalletOwnership(accounts[0]);
                    setAccount(ok ? accounts[0] : null);
                    if (!ok) toast.error(`Wallet tersebut sudah digunakan. Silakan ganti akun wallet.`);
                } else {
                    setAccount(null);
                }
            } catch (error) {
                console.error("Gagal memperbarui chain wallet", error);
            }
        };

        syncWalletState();
        injectedProvider.on?.("accountsChanged", handleAccountsChanged);
        injectedProvider.on?.("chainChanged", handleChainChanged);

        return () => {
            injectedProvider.removeListener?.("accountsChanged", handleAccountsChanged);
            injectedProvider.removeListener?.("chainChanged", handleChainChanged);
        };
    }, [checkNetwork]);

    const connectWallet = async () => {
        const injectedProvider = getInjectedProvider();
        if (!provider || !injectedProvider) {
            toast.error("Silakan pasang MetaMask terlebih dahulu");
            return;
        }
        try {
            setIsConnecting(true);
            const accounts = await provider.send("eth_requestAccounts", []);
            await checkNetwork(provider);
            const next = accounts[0];
            const ok = await evaluateWalletOwnership(next);
            if (!ok) {
                setAccount(null);
                toast.error("Wallet tersebut sudah digunakan oleh akun lain.");
                return;
            }
            setAccount(next);
        } catch (error) {
            console.error("Koneksi ditolak", error);
            toast.error(getRpcErrorMessage(error));
        } finally {
            setIsConnecting(false);
        }
    };

    const disconnectWallet = () => {
        setAccount(null);
        setWalletBlocked(false);
        setWalletBlockedMessage(null);
    };

    return (
        <WalletContext.Provider value={{
            account,
            connectWallet,
            disconnectWallet,
            isConnected: !!account,
            provider,
            isConnecting,
            walletBlocked,
            walletBlockedMessage
        }}>
            {children}
        </WalletContext.Provider>
    );
};
