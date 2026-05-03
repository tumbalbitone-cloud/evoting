"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { ethers, BrowserProvider } from "ethers";
import toast from "react-hot-toast";
import { getRpcErrorMessage } from "../utils/rpcError";
import { authApiFetch } from "../utils/api";
import { getStoredUsername, getStoredRole } from "../utils/auth";

interface WalletContextType {
    account: string | null;
    connectWallet: () => Promise<string | null>;
    disconnectWallet: () => void;
    isConnected: boolean;
    provider: BrowserProvider | null;
    isConnecting: boolean;
    walletBlocked: boolean;
    walletBlockedMessage: string | null;
}

const WalletContext = createContext<WalletContextType>({
    account: null,
    connectWallet: async () => null,
    disconnectWallet: () => { },
    isConnected: false,
    provider: null,
    isConnecting: false,
    walletBlocked: false,
    walletBlockedMessage: null,
});

class WalletNetworkError extends Error {
    userMessage: string;

    constructor(message: string) {
        super(message);
        this.name = "WalletNetworkError";
        this.userMessage = message;
    }
}

const getErrorCode = (error: any) =>
    error?.code ?? error?.error?.code ?? error?.data?.originalError?.code ?? error?.info?.error?.code;

const isUserRejected = (error: any) => {
    const code = getErrorCode(error);
    const message = `${error?.message || ""} ${error?.shortMessage || ""} ${error?.info?.error?.message || ""}`.toLowerCase();
    return code === 4001 || code === "ACTION_REJECTED" || message.includes("user rejected") || message.includes("user denied");
};

const buildNetworkMessage = (targetChainName: string, targetChainId: bigint, detail: string) =>
    `${detail} Pilih atau tambahkan jaringan ${targetChainName} (Chain ID ${targetChainId.toString()}) di wallet.`;

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
        let network;
        try {
            network = await provider.getNetwork();
        } catch (error) {
            const message = buildNetworkMessage(
                targetChainName,
                targetChainId,
                "Tidak dapat membaca jaringan wallet."
            );
            setWalletBlockedMessage(message);
            throw new WalletNetworkError(message);
        }

        if (network.chainId !== targetChainId) {
            try {
                await provider.send("wallet_switchEthereumChain", [{ chainId: targetChainHex }]);
                setWalletBlockedMessage(null);
            } catch (switchError: any) {
                if (getErrorCode(switchError) === 4902) {
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
                        setWalletBlockedMessage(null);
                    } catch (addError) {
                        console.error(addError);
                        const detail = isUserRejected(addError)
                            ? `Jaringan ${targetChainName} belum ditambahkan karena permintaan dibatalkan.`
                            : `Jaringan ${targetChainName} belum ada di wallet atau gagal ditambahkan.`;
                        const message = buildNetworkMessage(targetChainName, targetChainId, detail);
                        setWalletBlockedMessage(message);
                        throw new WalletNetworkError(message);
                    }
                } else {
                    const detail = isUserRejected(switchError)
                        ? "Pergantian jaringan dibatalkan."
                        : `Wallet sedang berada di jaringan yang salah.`;
                    const message = buildNetworkMessage(targetChainName, targetChainId, detail);
                    setWalletBlockedMessage(message);
                    throw new WalletNetworkError(message);
                }
            }
        } else {
            setWalletBlockedMessage(null);
        }
    }, [targetBlockExplorerUrl, targetChainHex, targetChainId, targetChainName, targetRpcUrl]);

    const bindAdminWallet = useCallback(async (address: string, activeProvider: BrowserProvider | null) => {
        if (!activeProvider) {
            return true;
        }

        const statusRes = await authApiFetch(`/api/did/admin-wallet/status/${address}`);
        if (statusRes.ok) {
            const statusData = await statusRes.json().catch(() => ({}));
            if (statusData?.matches && statusData?.adminRoleGranted) {
                return true;
            }
        } else if (statusRes.status === 409) {
            const data = await statusRes.json().catch(() => ({}));
            throw new Error(data?.error || "Akun admin sudah tertaut ke wallet lain.");
        }

        const challengeRes = await authApiFetch("/api/did/admin-wallet/challenge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userAddress: address }),
        });

        const challengeData = await challengeRes.json().catch(() => ({}));
        if (!challengeRes.ok || !challengeData?.challengeToken || !challengeData?.message) {
            throw new Error(challengeData?.error || "Gagal membuat challenge wallet admin.");
        }

        const signer = await activeProvider.getSigner();
        const signerAddress = await signer.getAddress();
        if (signerAddress.toLowerCase() !== address.toLowerCase()) {
            throw new Error("Wallet aktif berubah. Silakan hubungkan ulang wallet admin.");
        }

        const signature = await signer.signMessage(challengeData.message);
        const bindRes = await authApiFetch("/api/did/admin-wallet/bind", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userAddress: address,
                signature,
                challengeToken: challengeData.challengeToken,
            }),
        });

        if (!bindRes.ok) {
            const data = await bindRes.json().catch(() => ({}));
            throw new Error(data?.error || "Gagal menautkan wallet admin.");
        }

        return true;
    }, []);

    const evaluateWalletOwnership = useCallback(async (address: string, activeProvider: BrowserProvider | null) => {
        // If user isn't logged in, we can't verify "used by other account" safely.
        // Allow wallet connection but don't block.
        if (typeof window === "undefined") return true;

        const currentUsername = getStoredUsername();
        const currentRole = getStoredRole();
        if (!currentUsername) {
            setWalletBlocked(false);
            setWalletBlockedMessage(null);
            return true;
        }

        try {
            if (currentRole === "admin") {
                await bindAdminWallet(address, activeProvider);
                setWalletBlocked(false);
                setWalletBlockedMessage(null);
                return true;
            }

            const res = await authApiFetch(`/api/did/status/${address}`);
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
                String(data.studentId) !== String(currentUsername);

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
            const msg = getRpcErrorMessage(err);
            console.warn("Could not verify wallet ownership:", err);
            if (currentRole === "admin") {
                setWalletBlocked(true);
                setWalletBlockedMessage(msg);
                return false;
            }
            setWalletBlocked(false);
            setWalletBlockedMessage(null);
            return true;
        }
    }, [bindAdminWallet]);

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
                    const addr = accounts[0].address;
                    const ok = await evaluateWalletOwnership(addr, browserProvider);
                    setAccount(ok ? addr : null);
                    if (!ok) {
                        toast.error("Wallet tersebut sudah digunakan. Silakan ganti akun wallet.");
                    }
                    return;
                }
                setAccount(null);
            } catch (error) {
                console.error("Gagal menyinkronkan wallet", error);
                if (error instanceof WalletNetworkError) {
                    setAccount(null);
                    toast.error(error.userMessage);
                }
            }
        };

        const handleAccountsChanged = async (accounts: string[]) => {
            const next = accounts[0] || null;
            if (!next) {
                setAccount(null);
                setWalletBlocked(false);
                setWalletBlockedMessage(null);
                return;
            }
            try {
                await checkNetwork(browserProvider);
                // Re-evaluate when user switches accounts in MetaMask.
                const ok = await evaluateWalletOwnership(next, browserProvider);
                setAccount(ok ? next : null);
                if (!ok) toast.error(`Wallet tersebut sudah digunakan. Silakan ganti akun wallet.`);
            } catch (error) {
                console.error("Gagal memperbarui akun wallet", error);
                setAccount(null);
                toast.error(getRpcErrorMessage(error));
            }
        };

        const handleChainChanged = async () => {
            const nextProvider = new ethers.BrowserProvider(injectedProvider);
            setProvider(nextProvider);

            try {
                const accounts = await nextProvider.send("eth_accounts", []);
                if (accounts.length > 0) {
                    await checkNetwork(nextProvider);
                    const ok = await evaluateWalletOwnership(accounts[0], nextProvider);
                    setAccount(ok ? accounts[0] : null);
                    if (!ok) toast.error(`Wallet tersebut sudah digunakan. Silakan ganti akun wallet.`);
                } else {
                    setAccount(null);
                }
            } catch (error) {
                console.error("Gagal memperbarui chain wallet", error);
                setAccount(null);
                toast.error(getRpcErrorMessage(error));
            }
        };

        syncWalletState();
        injectedProvider.on?.("accountsChanged", handleAccountsChanged);
        injectedProvider.on?.("chainChanged", handleChainChanged);

        return () => {
            injectedProvider.removeListener?.("accountsChanged", handleAccountsChanged);
            injectedProvider.removeListener?.("chainChanged", handleChainChanged);
        };
    }, [checkNetwork, evaluateWalletOwnership]);

    const connectWallet = async () => {
        const injectedProvider = getInjectedProvider();
        if (!provider || !injectedProvider) {
            toast.error("Silakan pasang MetaMask terlebih dahulu");
            return null;
        }
        try {
            setIsConnecting(true);
            const accounts = await provider.send("eth_requestAccounts", []);
            await checkNetwork(provider);
            const next = accounts[0];
            const ok = await evaluateWalletOwnership(next, provider);
            if (!ok) {
                setAccount(null);
                toast.error("Wallet tersebut sudah digunakan oleh akun lain.");
                return null;
            }
            setAccount(next);
            return next;
        } catch (error) {
            console.error("Koneksi ditolak", error);
            toast.error(getRpcErrorMessage(error));
            return null;
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
