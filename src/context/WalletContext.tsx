"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { ethers, BrowserProvider } from "ethers";
import toast from "react-hot-toast";
import { getRpcErrorMessage } from "../utils/rpcError";

interface WalletContextType {
    account: string | null;
    connectWallet: () => Promise<void>;
    disconnectWallet: () => void;
    isConnected: boolean;
    provider: BrowserProvider | null;
}

const WalletContext = createContext<WalletContextType>({
    account: null,
    connectWallet: async () => { },
    disconnectWallet: () => { },
    isConnected: false,
    provider: null,
});

export const useWallet = () => useContext(WalletContext);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
    const [account, setAccount] = useState<string | null>(null);
    const [provider, setProvider] = useState<BrowserProvider | null>(null);
    const targetChainId = BigInt(process.env.NEXT_PUBLIC_CHAIN_ID || "31337");
    const targetChainHex = `0x${targetChainId.toString(16)}`;
    const targetChainName = process.env.NEXT_PUBLIC_CHAIN_NAME || (targetChainId === 31337n ? "Hardhat Localhost" : "Custom Network");
    const targetRpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545/";

    useEffect(() => {
        // Check if window.ethereum is available
        if (typeof window !== "undefined" && (window as any).ethereum) {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            setProvider(provider);

            // Check if already connected
            provider.listAccounts().then((accounts) => {
                if (accounts.length > 0) {
                    setAccount(accounts[0].address);
                }
            });
        }
    }, []);

    const checkNetwork = async (provider: BrowserProvider) => {
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
                            },
                        ]);
                    } catch (addError) {
                        console.error(addError);
                        toast.error(getRpcErrorMessage(addError));
                    }
                } else {
                    toast.error(getRpcErrorMessage(switchError));
                }
            }
        }
    };

    const connectWallet = async () => {
        if (!provider) {
            toast.error("Please install MetaMask!");
            return;
        }
        try {
            await checkNetwork(provider);
            const accounts = await provider.send("eth_requestAccounts", []);
            setAccount(accounts[0]);
        } catch (error) {
            console.error("Connection rejected", error);
            toast.error(getRpcErrorMessage(error));
        }
    };

    const disconnectWallet = () => {
        setAccount(null);
    };

    return (
        <WalletContext.Provider value={{ account, connectWallet, disconnectWallet, isConnected: !!account, provider }}>
            {children}
        </WalletContext.Provider>
    );
};
