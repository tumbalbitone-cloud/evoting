"use client";

import React, { useState, useEffect } from "react";
import { useWallet } from "../../context/WalletContext";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { getValidToken, clearAuth, isMockToken, refreshAccessToken, isTokenExpired } from "../../utils/auth";

export default function BindWallet() {
    const { account, isConnected, connectWallet } = useWallet();
    const [studentId, setStudentId] = useState<string | null>(null);
    const [status, setStatus] = useState("");
    const [vc, setVc] = useState<any>(null);
    const [alreadyBound, setAlreadyBound] = useState<boolean>(false);
    const [nftClaimed, setNftClaimed] = useState<boolean>(false);
    const router = useRouter();

    useEffect(() => {
        // Get user info from localStorage
        const storedStudentId = localStorage.getItem("username");
        const token = localStorage.getItem("token");

        if (!token || !storedStudentId) {
            router.push("/login");
            return;
        }

        // Check if token is old mock token
        if (isMockToken(token)) {
            console.warn("Old mock token detected. Please login again.");
            clearAuth();
            router.push("/login");
            return;
        }

        setStudentId(storedStudentId);
    }, [router]);

    useEffect(() => {
        if (account && studentId) {
            checkStatus();
        }
    }, [account, studentId]);

    const checkStatus = async () => {
        try {
            const token = getValidToken();
            if (!token) return;
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/did/status/${account}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.status === 401) {
                clearAuth();
                router.push("/login");
                return;
            }
            const data = await res.json();
            if (data.claimed) {
                if (data.studentId === studentId) {
                    setAlreadyBound(true);

                    if (data.nftClaimed) {
                        setNftClaimed(true);
                        setStatus("Wallet Bound and Student NFT Claimed.");
                    } else {
                        // If bound but not claimed, backend might return VC
                        if (data.vc) {
                            setVc(data);
                            setStatus("Wallet Bound. Please claim your NFT.");
                        } else {
                            setStatus("Wallet already bound to your Student ID.");
                        }
                    }
                } else {
                    setStatus(`Wallet already bound to ANOTHER Student ID: ${data.studentId}`);
                }
            } else {
                setAlreadyBound(false);
                setNftClaimed(false);
                setVc(null);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const bindWallet = async () => {
        if (!account) {
            toast.error("Connect Wallet first");
            return;
        }
        if (!studentId) return;

        setStatus("Binding Wallet...");

        try {
            // Import auth utilities
            const { getValidToken, refreshAccessToken, isTokenExpired } = await import("../../utils/auth");

            // Try to get valid token
            let token = getValidToken();

            // Check if token is expired or about to expire, refresh if needed
            if (!token || isTokenExpired(token)) {
                setStatus("Refreshing session...");
                token = await refreshAccessToken();
            }

            if (!token) {
                setStatus("Error: Please login again. Your session has expired.");
                setTimeout(() => {
                    router.push("/login");
                }, 2000);
                return;
            }

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/did/bind`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ studentId, userAddress: account })
            });

            if (!res.ok) {
                const errorData = await res.json();

                // If 401, clear auth and redirect to login
                if (res.status === 401) {
                    clearAuth();
                    setStatus("Error: Session expired. Redirecting to login...");
                    setTimeout(() => {
                        router.push("/login");
                    }, 2000);
                    return;
                }

                throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
            }

            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || "Failed to bind wallet");
            }

            // Store VC data (both vc object and vcJwt)
            setVc(data);
            setAlreadyBound(true);
            setStatus("Success! Wallet bound to Student ID.");
        } catch (err: any) {
            setStatus("Error: " + err.message);
            console.error("Bind wallet error:", err);
        }
    };

    const registerForElection = async () => {
        if (!vc || !account) return;
        setStatus("Verifying & Minting Student NFT...");

        try {
            // Try to get valid token
            let token = getValidToken();

            // Check if token is expired or about to expire, refresh if needed
            if (!token || isTokenExpired(token)) {
                setStatus("Refreshing session...");
                token = await refreshAccessToken();
            }

            if (!token) {
                setStatus("Error: Please login again. Your session has expired.");
                setTimeout(() => {
                    router.push("/login");
                }, 2000);
                return;
            }

            // Use vcJwt instead of vc + signature
            if (!vc.vcJwt) {
                throw new Error("Verifiable Credential JWT not found. Please bind wallet again.");
            }

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/did/verify-and-register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    userAddress: account,
                    vcJwt: vc.vcJwt
                })
            });

            if (!res.ok) {
                let errorData;
                try {
                    errorData = await res.json();
                } catch {
                    errorData = { error: `HTTP ${res.status} error` };
                }

                console.error('Register election error:', errorData, 'Status:', res.status);

                // If 401, try to refresh token once more
                if (res.status === 401) {
                    setStatus("Session expired. Attempting to refresh...");
                    const newToken = await refreshAccessToken();

                    if (newToken) {
                        // Retry request with new token
                        setStatus("Retrying with refreshed token...");
                        const retryRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/did/verify-and-register`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${newToken}`
                            },
                            body: JSON.stringify({
                                userAddress: account,
                                vcJwt: vc.vcJwt
                            })
                        });

                        if (retryRes.ok) {
                            const retryData = await retryRes.json();
                            if (retryData.success) {
                                setStatus("Success! Student NFT Claimed.");
                                setTimeout(() => {
                                    router.push('/vote');
                                }, 2000);
                                return;
                            }
                        }
                    }

                    // If refresh failed, clear auth and redirect
                    clearAuth();
                    setStatus("Error: Session expired. Please login again.");
                    setTimeout(() => {
                        router.push("/login");
                    }, 2000);
                    return;
                }

                throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
            }

            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || "Failed to verify and register");
            }

            setStatus("Success! Student NFT Claimed.");
            setNftClaimed(true);
            setVc(null);
            setTimeout(() => router.push("/vote"), 1000);
        } catch (err: any) {
            setStatus("Error: " + err.message);
            console.error("Register error:", err);
        }
    };

    if (!studentId) return <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>;

    return (
        <div className="min-h-screen bg-dark-900 pt-20 px-4">
            <div className="max-w-md mx-auto bg-white/5 p-8 rounded-2xl backdrop-blur-xl border border-white/10 text-center">
                <h1 className="text-2xl font-bold mb-6 text-white">Bind Wallet</h1>

                <div className="mb-6 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
                    <p className="text-sm text-blue-200 uppercase tracking-wider mb-1">Authenticated as</p>
                    <p className="text-xl font-mono text-white">{studentId}</p>
                </div>

                {!isConnected ? (
                    <div className="space-y-4">
                        <p className="text-white/60">Connect your Ethereum wallet to bind it to your student account.</p>
                        <button
                            onClick={connectWallet}
                            className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold transition"
                        >
                            Connect Wallet
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="p-3 bg-black/40 rounded-lg text-sm font-mono text-white/80 break-all border border-white/5">
                            {account}
                        </div>

                        {!alreadyBound && !vc && !nftClaimed && (
                            <button
                                onClick={bindWallet}
                                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition shadow-lg shadow-blue-600/20"
                            >
                                Bind Wallet to Account
                            </button>
                        )}

                        {nftClaimed && (
                            <div className="p-4 bg-purple-500/20 text-purple-200 rounded-xl border border-purple-500/30">
                                ✓ Student NFT Claimed
                            </div>
                        )}

                        {alreadyBound && !vc && !nftClaimed && (
                            <div className="p-4 bg-green-500/20 text-green-200 rounded-xl border border-green-500/30">
                                ✓ Wallet Bound
                            </div>
                        )}

                        {vc && !nftClaimed && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                                <div className="p-4 bg-green-500/20 text-green-200 rounded-xl border border-green-500/30">
                                    ✓ Wallet Bound Successfully
                                </div>
                                <button
                                    onClick={registerForElection}
                                    className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition shadow-lg shadow-purple-600/20"
                                >
                                    Claim Student NFT (Required to Vote)
                                </button>
                            </div>
                        )}

                        {status && (
                            <div className={`mt-4 p-3 rounded-lg text-sm ${status.includes("Error") ? "bg-red-500/20 text-red-200" : "bg-white/10 text-white"}`}>
                                {status}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
