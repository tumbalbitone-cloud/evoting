"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import { useWallet } from "../../context/WalletContext";
import { getRpcErrorMessage } from "../../utils/rpcError";
import VotingArtifact from "../../contracts/VotingSystem.json";
import io from "socket.io-client"; // Import Socket.io
import { getValidImageUrl } from "../../utils/image";
import { getApiBaseUrl, publicApiFetch } from "../../utils/api";

const SESSION_ELIGIBILITY_ABI = [
    "function isEligibleForSession(uint256 _sessionId, address _voter) view returns (bool)",
] as const;

const FALLBACK_CANDIDATE_IMAGE =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' rx='80' fill='%23111827'/%3E%3Ccircle cx='80' cy='62' r='28' fill='%233b82f6' fill-opacity='0.85'/%3E%3Cpath d='M38 130c8-23 29-36 42-36s34 13 42 36' fill='%233b82f6' fill-opacity='0.55'/%3E%3C/svg%3E";


interface Session {
    id: number;
    name: string;
    description: string;
    startTime: number;
    endTime: number;
    isActive: boolean;
}

interface Candidate {
    id: number;
    name: string;
    photoUrl: string;
    vision: string;
    mission: string;
    voteCount: number;
}

export default function VotePage() {
    const { account, provider, isConnected } = useWallet();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasVotedInSession, setHasVotedInSession] = useState(false);
    const [isEligibleForSession, setIsEligibleForSession] = useState<boolean | null>(null);

    const [txHash, setTxHash] = useState<string | null>(null);
    const [chainId, setChainId] = useState<bigint | null>(null);
    const [hasNft, setHasNft] = useState<boolean | null>(null);
    const [refreshKey, setRefreshKey] = useState(0); // Trigger re-fetch
    const fetchSessionSeq = useRef(0);

    const getVotingContract = (runner: ethers.ContractRunner) => {
        return new ethers.Contract(
            process.env.NEXT_PUBLIC_VOTING_SYSTEM_ADDRESS!,
            [...VotingArtifact.abi, ...SESSION_ELIGIBILITY_ABI],
            runner
        );
    };

    // Initial fetch for all sessions
    const fetchSessions = useCallback(async () => {
        if (!provider) return;
        try {
            const signer = await provider.getSigner();
            const contract = getVotingContract(signer);

            // Fetch all sessions
            const sessionsRaw = await contract.getAllSessions();
            const loadedSessions = sessionsRaw.map((s: any) => ({
                id: Number(s.id),
                name: s.name,
                description: s.description,
                startTime: Number(s.startTime),
                endTime: Number(s.endTime),
                isActive: s.isActive
            }));

            setSessions(loadedSessions);

            // Get Network ChainId
            const network = await provider.getNetwork();
            setChainId(network.chainId);

        } catch (err) {
            console.error("Error fetching sessions:", err);
            toast.error(getRpcErrorMessage(err));
        }
    }, [provider]);

    // Fetch details when a session is selected
    const fetchSessionDetails = useCallback(async (sessionId: number) => {
        if (!provider || !account) return;
        const seq = ++fetchSessionSeq.current;
        setLoading(true);
        setIsEligibleForSession(null);
        try {
            const signer = await provider.getSigner();
            const contract = getVotingContract(signer);

            const candidatesResponse = await publicApiFetch(`/api/read-model/sessions/${sessionId}/results`);
            const candidatesPayload = await candidatesResponse.json().catch(() => ({}));
            if (!candidatesResponse.ok || !candidatesPayload.success) {
                throw new Error(candidatesPayload.error || "Gagal memuat kandidat");
            }
            if (seq !== fetchSessionSeq.current) return;

            const loadedCandidates = (candidatesPayload.candidates || []).map((c: any) => ({
                id: Number(c.id),
                name: String(c.name),
                photoUrl: String(c.photoUrl || ""),
                vision: String(c.vision || ""),
                mission: String(c.mission || ""),
                voteCount: Number(c.voteCount)
            }));
            setCandidates(loadedCandidates);

            // Check if user voted in this session
            const hasVoted = await contract.hasVotedInSession(sessionId, account);
            if (seq !== fetchSessionSeq.current) return;
            setHasVotedInSession(hasVoted);

            // Check if user has Student NFT (eligible to vote)
            const balance = await contract.balanceOf(account);
            if (seq !== fetchSessionSeq.current) return;
            setHasNft(Number(balance) > 0);

            try {
                const sessionEligible = await contract.isEligibleForSession(sessionId, account);
                if (seq !== fetchSessionSeq.current) return;
                setIsEligibleForSession(sessionEligible);
            } catch (eligibilityErr) {
                console.warn("isEligibleForSession not available, fallback to open access:", eligibilityErr);
                if (seq === fetchSessionSeq.current) {
                    setIsEligibleForSession(true);
                }
            }
        } catch (err) {
            if (seq !== fetchSessionSeq.current) return;
            console.error(err);
            setHasNft(null);
            setIsEligibleForSession(null);
            toast.error(getRpcErrorMessage(err));
        } finally {
            if (seq === fetchSessionSeq.current) {
                setLoading(false);
            }
        }
    }, [account, provider]);

    useEffect(() => {
        if (isConnected) fetchSessions();
    }, [isConnected, refreshKey, fetchSessions]);

    useEffect(() => {
        if (selectedSessionId && isConnected && account) {
            fetchSessionDetails(selectedSessionId);
        }
    }, [selectedSessionId, isConnected, account, refreshKey, fetchSessionDetails]);

    // Refetch when user returns to tab (e.g. after bind/claim NFT)
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState !== "visible") return;
            setRefreshKey(prev => prev + 1);
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, []);

    // ---------------------------------------------------------
    // REAL-TIME UPDATES VIA SOCKET.IO
    // ---------------------------------------------------------
    useEffect(() => {
        const socket = io(getApiBaseUrl(), {
            withCredentials: true,
        });

        const join = () => {
            if (selectedSessionId != null) {
                socket.emit("join_session", selectedSessionId);
            }
        };

        socket.on("connect", () => {
            console.log("🟢 Terhubung ke pembaruan voting real-time");
            join();
        });
        socket.on("connect_error", (err) => {
            console.error("Socket vote connect error:", err);
        });
        socket.on("error", (err) => {
            console.error("Socket vote error:", err);
        });

        socket.on("vote_update", (data: any) => {
            if (selectedSessionId != null && Number(data.sessionId) !== selectedSessionId) return;
            setRefreshKey((prev) => prev + 1);
        });

        socket.on("session_update", (data: any) => {
            if (selectedSessionId != null && Number(data.sessionId) !== selectedSessionId) return;
            console.log("🔄 Status sesi berubah, menyegarkan...");
            setRefreshKey((prev) => prev + 1);
        });

        socket.on("candidate_added", (data: any) => {
            console.log("🆕 Kandidat baru ditambahkan, menyegarkan...");
            if (selectedSessionId != null && Number(data.sessionId) !== selectedSessionId) return;
            setTimeout(() => {
                setRefreshKey((prev) => prev + 1);
            }, 2000);
        });

        socket.on("session_created", () => {
            console.log("🆕 Sesi baru dibuat, menyegarkan daftar...");
            setRefreshKey((prev) => prev + 1);
        });

        if (socket.connected) join();

        return () => {
            socket.disconnect();
        };
    }, [account, selectedSessionId]);

    const getEligibilityMessage = () =>
        "Anda belum bisa memilih. Silakan tautkan wallet dan klaim Student NFT terlebih dahulu di halaman Tautkan Wallet.";

    const castVote = async (candidateId: number) => {
        if (!provider || !account || !selectedSessionId) return;
        setLoading(true);
        setTxHash(null);
        try {
            const signer = await provider.getSigner();
            const contract = getVotingContract(signer);

            // Cek apakah user punya Student NFT (sudah bind & claim)
            const nftBalance = await contract.balanceOf(account);
            if (Number(nftBalance) === 0) {
                setLoading(false);
                toast.error(getEligibilityMessage() + " Buka: " + window.location.origin + "/bind-wallet", { duration: 6000 });
                return;
            }

            let sessionEligible = true;
            try {
                sessionEligible = await contract.isEligibleForSession(selectedSessionId, account);
            } catch (eligibilityErr) {
                console.warn("isEligibleForSession not available, skip local eligibility pre-check:", eligibilityErr);
            }
            if (!sessionEligible) {
                setLoading(false);
                setIsEligibleForSession(false);
                toast.error("Akun ini tidak terdaftar sebagai pemilih pada sesi yang dipilih.");
                return;
            }

            const tx = await contract.vote(selectedSessionId, candidateId);
            setTxHash(tx.hash);
            await tx.wait();
            toast.success("Vote berhasil dicatat!");
            // Data will be refreshed automatically via socket event "vote_update" 
            // OR we can manually refresh just in case socket is slow
            setHasVotedInSession(true);
            fetchSessionDetails(selectedSessionId);
        } catch (err: any) {
            const msg = String(err?.reason ?? err?.message ?? "");
            const isEligibilityError =
                msg.includes("missing revert data") ||
                msg.includes("CALL EXCEPTION") ||
                msg.includes("hold a Student NFT") ||
                msg.includes("Student NFT");
            const isSessionAllowlistError = msg.includes("not eligible for this session");
            if (isEligibilityError) {
                toast.error(getEligibilityMessage() + " Buka: " + window.location.origin + "/bind-wallet", { duration: 6000 });
            } else if (isSessionAllowlistError) {
                setIsEligibleForSession(false);
                toast.error("Akun ini tidak terdaftar sebagai pemilih pada sesi yang dipilih.");
            } else {
                toast.error(getRpcErrorMessage(err));
            }
        }
        setLoading(false);
    };

    const getExplorerLink = (hash: string) => {
        const base = process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL;
        if (base) return `${base.replace(/\/$/, "")}/tx/${hash}`;
        // Fallback by chain when env not set (restart dev server after changing .env)
        if (chainId === 11155111n) return `https://sepolia.etherscan.io/tx/${hash}`;
        if (chainId === 80002n) return `https://amoy.polygonscan.com/tx/${hash}`;
        return `https://amoy.polygonscan.com/tx/${hash}`;
    };

    const getSessionStatus = (session: Session) => {
        const now = Math.floor(Date.now() / 1000);
        if (!session.isActive) return "Closed";
        if (now < session.startTime) return "Upcoming";
        if (now > session.endTime) return "Ended";
        return "Active";
    };

    if (!isConnected) return <div className="text-center pt-20">Silakan hubungkan wallet</div>;

    // View: Session List
    if (selectedSessionId === null) {
        return (
            <div className="min-h-screen bg-dark-900 pt-20 px-4">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                        Sesi Voting Tersedia
                    </h1>
                    <div className="grid gap-4">
                        {sessions.map((session) => (
                            <div key={session.id} className="glass-panel p-5 rounded-xl hover:bg-white/5 transition border border-white/10">
                                <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg sm:text-xl font-bold text-white truncate">{session.name}</h3>
                                        <p className="text-gray-400 mt-1 text-sm">{session.description}</p>
                                    </div>
                                    <span className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${getSessionStatus(session) === 'Active' ? 'bg-green-500/20 text-green-400' :
                                        getSessionStatus(session) === 'Upcoming' ? 'bg-blue-500/20 text-blue-400' :
                                            'bg-gray-700 text-gray-400'
                                        }`}>
                                        {getSessionStatus(session) === "Active"
                                            ? "Aktif"
                                            : getSessionStatus(session) === "Upcoming"
                                                ? "Akan Datang"
                                                : getSessionStatus(session) === "Ended"
                                                    ? "Berakhir"
                                                    : "Ditutup"}
                                    </span>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 text-sm text-gray-500">
                                    <span>Berakhir: {new Date(session.endTime * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                    <button
                                        onClick={() => setSelectedSessionId(session.id)}
                                        className="w-full sm:w-auto flex-shrink-0 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg transition text-sm font-semibold"
                                    >
                                        Lihat Kandidat →
                                    </button>
                                </div>
                            </div>
                        ))}
                        {sessions.length === 0 && (
                            <p className="text-center text-gray-500">Belum ada sesi yang tersedia.</p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // View: Single Session (Candidates)
    const currentSession = sessions.find(s => s.id === selectedSessionId);
    const currentSessionStatus = currentSession ? getSessionStatus(currentSession) : "Closed";

    return (
        <div className="min-h-screen bg-dark-900 pt-20 px-4">
            <div className="max-w-4xl mx-auto">
                <button
                    onClick={() => {
                        setSelectedSessionId(null);
                        setTxHash(null);
                        setIsEligibleForSession(null);
                    }}
                    className="mb-6 text-gray-400 hover:text-white transition flex items-center gap-2"
                >
                    &larr; Kembali ke Daftar Sesi
                </button>

                <h1 className="text-3xl font-bold mb-2 text-center text-white">
                    {currentSession?.name}
                </h1>
                <p className="text-center text-gray-400 mb-8">{currentSession?.description}</p>

                {hasNft === false && (
                    <div className="text-center p-6 bg-amber-500/10 border border-amber-500/50 rounded-xl mb-8">
                        <p className="text-amber-300 font-semibold mb-2">Anda belum bisa memilih.</p>
                        <p className="text-gray-400 text-sm mb-4">Silakan tautkan wallet dan klaim Student NFT terlebih dahulu.</p>
                        <Link href="/bind-wallet" className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-lg font-semibold transition">
                            Ke halaman Tautkan Wallet →
                        </Link>
                    </div>
                )}

                {hasNft !== false && isEligibleForSession === false && (
                    <div className="text-center p-6 bg-rose-500/10 border border-rose-500/50 rounded-xl mb-8">
                        <p className="text-rose-300 font-semibold mb-2">Akun ini tidak terdaftar pada sesi ini.</p>
                        <p className="text-gray-400 text-sm">
                            Hubungi admin agar akun/wallet Anda dimasukkan ke daftar pemilih sesi yang benar.
                        </p>
                    </div>
                )}

                {txHash && (
                    <div className="text-center p-6 bg-blue-500/10 border border-blue-500/50 rounded-xl mb-8 animate-fade-in">
                        <p className="text-blue-300 font-bold text-xl mb-2">Voting berhasil dikirim!</p>
                        <a
                            href={getExplorerLink(txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-semibold transition"
                        >
                            Lihat di Block Explorer
                        </a>
                    </div>
                )}

                {hasVotedInSession ? (
                    <div className="text-center p-6 bg-green-500/10 border border-green-500/50 rounded-xl mb-8">
                        <p className="text-green-300 font-bold text-xl">Anda sudah voting pada sesi ini!</p>
                    </div>
                ) : isEligibleForSession === false ? (
                    <div className="text-center p-6 bg-rose-500/10 border border-rose-500/50 rounded-xl mb-8">
                        <p className="text-rose-300 font-bold">Anda tidak termasuk daftar pemilih sesi ini.</p>
                    </div>
                ) : currentSessionStatus !== "Active" ? (
                    <div className="text-center p-6 bg-yellow-500/10 border border-yellow-500/50 rounded-xl mb-8">
                        <p className="text-yellow-300 font-bold">
                            Status sesi:{" "}
                            {currentSessionStatus === "Upcoming"
                                ? "Akan Datang"
                                : currentSessionStatus === "Ended"
                                    ? "Berakhir"
                                    : currentSessionStatus === "Closed"
                                        ? "Ditutup"
                                        : "Tidak aktif"}
                        </p>
                    </div>
                ) : (
                    <div className="text-center p-6 bg-blue-500/10 border border-blue-500/50 rounded-xl mb-8">
                        <p className="text-blue-300 font-semibold">Pilih kandidat untuk memberikan suara.</p>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {candidates.map((c) => (
                        <div key={c.id} className="glass-panel p-5 rounded-xl hover:bg-white/5 transition flex flex-col items-center">
                            {c.photoUrl ? (
                                <Image
                                    src={getValidImageUrl(c.photoUrl) || FALLBACK_CANDIDATE_IMAGE}
                                    alt={c.name}
                                    width={96}
                                    height={96}
                                    className="w-24 h-24 rounded-full mb-4 object-cover border-2 border-blue-500"
                                    unoptimized
                                />
                            ) : (
                                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4 flex items-center justify-center text-2xl font-bold text-white">
                                    {c.name[0]}
                                </div>
                            )}
                            <h3 className="text-lg sm:text-xl font-bold mb-2 text-white text-center">{c.name}</h3>

                            <div className="w-full text-left bg-white/5 p-4 rounded-lg mb-4 text-sm text-gray-300 space-y-2">
                                <p><span className="font-bold text-blue-400">Visi:</span> {c.vision || "Belum ada visi."}</p>
                                <p><span className="font-bold text-purple-400">Misi:</span> {c.mission || "Belum ada misi."}</p>
                            </div>

                            <div className="mt-auto w-full">
                                <button
                                    onClick={() => castVote(c.id)}
                                    disabled={hasVotedInSession || currentSessionStatus !== "Active" || loading || hasNft === false || isEligibleForSession === false}
                                    className={`w-full py-2.5 rounded-lg font-semibold transition text-sm ${hasVotedInSession || currentSessionStatus !== "Active" || hasNft === false || isEligibleForSession === false
                                        ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                                        : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25"
                                        }`}
                                >
                                    {loading
                                        ? "Memilih..."
                                        : hasNft === false
                                            ? "Tautkan & Klaim NFT dulu"
                                            : isEligibleForSession === false
                                                ? "Tidak Terdaftar di Sesi Ini"
                                                : "Pilih Kandidat Ini"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
