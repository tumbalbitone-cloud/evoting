"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "../../context/WalletContext";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { clearAuth, isMockToken } from "../../utils/auth";
import { authApiFetch } from "../../utils/api";
import { getBlockExplorerTxUrl } from "../../utils/explorer";

export default function BindWallet() {
    const { account, isConnected, connectWallet, walletBlocked, walletBlockedMessage, isConnecting, provider } = useWallet();
    const [chainId, setChainId] = useState<bigint | null>(null);
    const [studentId, setStudentId] = useState<string | null>(null);
    const [status, setStatus] = useState("");
    const [vc, setVc] = useState<any>(null);
    const [alreadyBound, setAlreadyBound] = useState<boolean>(false);
    const [usedByOther, setUsedByOther] = useState<boolean>(false);
    const [nftClaimed, setNftClaimed] = useState<boolean>(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        if (!provider) {
            setChainId(null);
            return;
        }
        provider.getNetwork().then((n) => setChainId(n.chainId)).catch(() => setChainId(null));
    }, [provider]);

    useEffect(() => {
        // Get user info from localStorage
        const storedStudentId = localStorage.getItem("username");
        const token = localStorage.getItem("token");
        const role = localStorage.getItem("role");

        if (!token || !storedStudentId) {
            router.push("/login");
            return;
        }

        // Admin accounts are not student identities — block DID student flow.
        if (role === "admin") {
            toast.error("Akun admin tidak dapat menautkan wallet sebagai mahasiswa.");
            router.push("/admin");
            return;
        }

        // Check if token is old mock token
        if (isMockToken(token)) {
            console.warn("Token mock lama terdeteksi. Silakan login kembali.");
            clearAuth();
            router.push("/login");
            return;
        }

        setStudentId(storedStudentId);
    }, [router]);

    const checkStatus = useCallback(async () => {
        if (!account) return;

        try {
            const res = await authApiFetch(`/api/did/status/${account}`);
            if (res.status === 401) {
                // Refresh juga gagal — perlu login ulang
                clearAuth();
                router.push("/login");
                return;
            }
            if (res.status === 403) {
                setStatus("Wallet sudah tertaut ke akun lain.");
                setAlreadyBound(false);
                setUsedByOther(true);
                setNftClaimed(false);
                setVc(null);
                return;
            }
            const data = await res.json();
            if (data.claimed) {
                if (data.studentId === studentId) {
                    setAlreadyBound(true);
                    setUsedByOther(false);

                    if (data.nftClaimed) {
                        setNftClaimed(true);
                        setTxHash(data.txHash || null);
                        setStatus("Wallet sudah tertaut dan Student NFT sudah diklaim.");
                    } else {
                        if (data.vc) {
                            setVc(data);
                            setStatus("Wallet sudah tertaut. Silakan klaim NFT Anda.");
                        } else {
                            setStatus("Wallet sudah tertaut ke akun Anda.");
                        }
                    }
                } else {
                    setStatus(`Wallet sudah tertaut ke NIM lain: ${data.studentId}`);
                    setAlreadyBound(false);
                    setUsedByOther(true);
                }
            } else {
                setAlreadyBound(false);
                setUsedByOther(false);
                setNftClaimed(false);
                setVc(null);
            }
        } catch (error: any) {
            // authApiFetch melempar error ketika token + refresh keduanya gagal
            if (
                error?.message?.includes("Tidak ada token autentikasi yang valid") ||
                error?.message?.includes("Autentikasi gagal")
            ) {
                clearAuth();
                router.push("/login");
            } else {
                console.error(error);
            }
        }
    }, [account, router, studentId]);

    useEffect(() => {
        if (account && studentId) {
            checkStatus();
        }
    }, [account, studentId, checkStatus]);

    const bindWallet = async () => {
        if (!account) {
            toast.error("Hubungkan wallet terlebih dahulu");
            return;
        }
        if (usedByOther || walletBlocked) {
            toast.error("Wallet tersebut sudah digunakan oleh akun lain.");
            return;
        }
        if (!studentId) return;
        if (!provider) {
            toast.error("Provider wallet tidak tersedia. Coba hubungkan ulang MetaMask.");
            return;
        }

        setStatus("Meminta persetujuan tanda tangan wallet...");

        try {
            const challengeRes = await authApiFetch("/api/did/bind/challenge", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ studentId, userAddress: account }),
            });

            if (!challengeRes.ok) {
                const errorData = await challengeRes.json().catch(() => ({}));
                if (challengeRes.status === 401) {
                    clearAuth();
                    setStatus("Kesalahan: Sesi berakhir. Mengalihkan ke halaman login...");
                    setTimeout(() => {
                        router.push("/login");
                    }, 2000);
                    return;
                }
                throw new Error(errorData.error || `HTTP error! status: ${challengeRes.status}`);
            }

            const challengeData = await challengeRes.json();
            if (!challengeData.success || !challengeData.challengeToken || !challengeData.message) {
                throw new Error("Challenge wallet tidak valid. Silakan coba lagi.");
            }

            const signer = await provider.getSigner();
            const signerAddress = await signer.getAddress();
            if (signerAddress.toLowerCase() !== account.toLowerCase()) {
                throw new Error("Wallet aktif berubah. Silakan hubungkan ulang wallet yang ingin ditautkan.");
            }

            const signature = await signer.signMessage(challengeData.message);

            setStatus("Memverifikasi tanda tangan wallet...");

            const res = await authApiFetch("/api/did/bind", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    studentId,
                    userAddress: account,
                    signature,
                    challengeToken: challengeData.challengeToken,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                if (res.status === 401) {
                    clearAuth();
                    setStatus("Kesalahan: Sesi berakhir. Mengalihkan ke halaman login...");
                    setTimeout(() => {
                        router.push("/login");
                    }, 2000);
                    return;
                }
                throw new Error(data.error || `HTTP error! status: ${res.status}`);
            }

            if (!data.success) {
                throw new Error(data.error || "Gagal menautkan wallet");
            }

            // Store VC data (both vc object and vcJwt)
            setVc(data);
            setAlreadyBound(true);
            setStatus("Berhasil! Wallet tertaut ke akun mahasiswa.");
        } catch (err: any) {
            const msg = err?.message || "Gagal menautkan wallet";
            if (
                msg.includes("Tidak ada token autentikasi yang valid") ||
                msg.includes("Autentikasi gagal")
            ) {
                setStatus("Kesalahan: Silakan login kembali. Sesi Anda sudah berakhir.");
                clearAuth();
                setTimeout(() => router.push("/login"), 2000);
                return;
            }
            setStatus("Kesalahan: " + msg);
            console.error("Kesalahan saat menautkan wallet:", err);
        }
    };

    const registerForElection = async () => {
        if (!vc || !account) return;
        setStatus("Memverifikasi & menerbitkan Student NFT...");

        try {
            if (!vc.vcJwt) {
                throw new Error("JWT Verifiable Credential tidak ditemukan. Silakan tautkan wallet lagi.");
            }

            const res = await authApiFetch("/api/did/verify-and-register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    userAddress: account,
                    vcJwt: vc.vcJwt,
                }),
            });

            if (!res.ok) {
                let errorData: { error?: string };
                try {
                    errorData = await res.json();
                } catch {
                    errorData = { error: `HTTP ${res.status} error` };
                }
                console.error("Register election error:", errorData, "Status:", res.status);
                throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
            }

            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || "Gagal verifikasi dan pendaftaran");
            }

            setTxHash(data.txHash || null);
            setStatus("Berhasil! Student NFT berhasil diklaim.");
            setNftClaimed(true);
            setVc(null);
            setTimeout(() => router.push("/vote"), 4000);
        } catch (err: any) {
            const msg = err?.message || "Gagal mendaftar";
            if (
                msg.includes("Tidak ada token autentikasi yang valid") ||
                msg.includes("Autentikasi gagal")
            ) {
                clearAuth();
                setStatus("Kesalahan: Sesi berakhir. Silakan login kembali.");
                setTimeout(() => router.push("/login"), 2000);
                return;
            }
            setStatus("Kesalahan: " + msg);
            console.error("Kesalahan pendaftaran:", err);
        }
    };

    if (!studentId) return <div className="min-h-screen flex items-center justify-center text-white">Memuat...</div>;

    return (
        <div className="min-h-screen bg-dark-900 pt-20 px-4">
            <div className="max-w-md mx-auto bg-white/5 p-8 rounded-2xl backdrop-blur-xl border border-white/10 text-center">
                <h1 className="text-2xl font-bold mb-6 text-white">Hubungkan Wallet</h1>

                <div className="mb-6 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
                    <p className="text-sm text-blue-200 uppercase tracking-wider mb-1">Login sebagai</p>
                    <p className="text-xl font-mono text-white">{studentId}</p>
                </div>

                {!isConnected ? (
                    <div className="space-y-4">
                        <p className="text-white/60">Hubungkan wallet Ethereum Anda untuk ditautkan ke akun mahasiswa.</p>
                        <button
                            onClick={connectWallet}
                            disabled={walletBlocked || isConnecting}
                            className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition"
                        >
                            {isConnecting ? "Menghubungkan..." : "Hubungkan Wallet"}
                        </button>
                        {(walletBlockedMessage || status.includes("Wallet sudah tertaut ke NIM lain")) && (
                            <div className="p-3 rounded-lg text-sm bg-red-500/20 text-red-200 border border-red-500/30">
                                {walletBlockedMessage || status}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="p-3 bg-black/40 rounded-lg text-sm font-mono text-white/80 break-all border border-white/5">
                            {account}
                        </div>

                        {!alreadyBound && !vc && !nftClaimed && !usedByOther && !walletBlocked && (
                            <button
                                onClick={bindWallet}
                                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition shadow-lg shadow-blue-600/20"
                            >
                                Hubungkan Wallet
                            </button>
                        )}
                        {(usedByOther || walletBlocked) && (
                            <div className="p-4 bg-red-500/20 text-red-200 rounded-xl border border-red-500/30">
                                {walletBlockedMessage || status || "Wallet tersebut sudah digunakan oleh akun lain."}
                            </div>
                        )}

                        {nftClaimed && (
                            <div className="p-4 bg-purple-500/20 text-purple-200 rounded-xl border border-purple-500/30 space-y-2">
                                <div className="font-semibold px-2 py-1">✓ NFT Sudah Diklaim</div>
                                {txHash && (
                                    <div className="text-xs bg-black/40 p-2 rounded-lg border border-purple-500/20 font-mono flex flex-col items-center gap-1.5">
                                        <span className="text-purple-300">Hash Transaksi:</span>
                                        <a
                                            href={getBlockExplorerTxUrl(txHash, chainId)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:text-blue-300 underline break-all inline-block px-1"
                                        >
                                            {txHash}
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}

                        {alreadyBound && !vc && !nftClaimed && (
                            <div className="p-4 bg-green-500/20 text-green-200 rounded-xl border border-green-500/30">
                                ✓ Wallet Sudah terhubung
                            </div>
                        )}

                        {vc && !nftClaimed && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                                <div className="p-4 bg-green-500/20 text-green-200 rounded-xl border border-green-500/30">
                                    ✓ Wallet Berhasil Dihubungkan
                                </div>
                                <button
                                    onClick={registerForElection}
                                    className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition shadow-lg shadow-purple-600/20"
                                >
                                    Klaim NFT (Wajib untuk Voting)
                                </button>
                            </div>
                        )}

                        {status && (
                            <div className={`mt-4 p-3 rounded-lg text-sm ${status.includes("Kesalahan") ? "bg-red-500/20 text-red-200" : "bg-white/10 text-white"}`}>
                                {status}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
