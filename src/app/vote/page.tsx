"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ethers, Contract } from "ethers";
import toast from "react-hot-toast";
import { useWallet } from "../../context/WalletContext";
import { getRpcErrorMessage } from "../../utils/rpcError";
import { authenticatedFetch } from "../../utils/auth";
import VotingArtifact from "../../contracts/VotingSystem.json";
import io from "socket.io-client"; // Import Socket.io


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
    const [votingOpen, setVotingOpen] = useState(false); // Deprecated in new contract but used for visual check

    const [txHash, setTxHash] = useState<string | null>(null);
    const [chainId, setChainId] = useState<bigint | null>(null);
    const [hasNft, setHasNft] = useState<boolean | null>(null);
    const [refreshKey, setRefreshKey] = useState(0); // Trigger re-fetch

    // Initial fetch for all sessions
    const fetchSessions = async () => {
        if (!provider) return;
        try {
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(
                process.env.NEXT_PUBLIC_VOTING_SYSTEM_ADDRESS!,
                VotingArtifact.abi,
                signer
            );

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
    };

    // Fetch details when a session is selected
    const fetchSessionDetails = async (sessionId: number) => {
        if (!provider || !account) return;
        setLoading(true);
        try {
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(
                process.env.NEXT_PUBLIC_VOTING_SYSTEM_ADDRESS!,
                VotingArtifact.abi,
                signer
            );

            // Fetch Candidates for this session
            const candidatesRaw = await contract.getCandidates(sessionId);
            const loadedCandidates = candidatesRaw.map((c: any) => ({
                id: Number(c.id),
                name: c.name,
                photoUrl: c.photoUrl,
                vision: c.vision,
                mission: c.mission,
                voteCount: Number(c.voteCount)
            }));
            setCandidates(loadedCandidates);

            // Check if user voted in this session
            const hasVoted = await contract.hasVotedInSession(sessionId, account);
            setHasVotedInSession(hasVoted);

            // Check if user has Student NFT (eligible to vote)
            const balance = await contract.balanceOf(account);
            setHasNft(Number(balance) > 0);
        } catch (err) {
            console.error(err);
            setHasNft(null);
            toast.error(getRpcErrorMessage(err));
        }
        setLoading(false);
    };

    useEffect(() => {
        if (isConnected) fetchSessions();
    }, [isConnected, provider, refreshKey]);

    useEffect(() => {
        if (selectedSessionId && isConnected && account) {
            fetchSessionDetails(selectedSessionId);
        }
    }, [selectedSessionId, isConnected, account, refreshKey]);

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
        const socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001");

        socket.on("connect", () => {
            console.log("🟢 Connected to Real-time Vote Updates");
        });

        // Listen for new votes (check if WE voted from another device/tab)
        socket.on("vote_update", (data: any) => {
            // If current user is the voter, update local state
            if (account && data.voter.toLowerCase() === account.toLowerCase()) {
                console.log("User voted from another source, updating UI...");
                if (Number(data.sessionId) === selectedSessionId) {
                    setHasVotedInSession(true);
                }
            }
        });

        // Listen for session status changes
        socket.on("session_update", (data: any) => {
            console.log("🔄 Session status changed, refreshing...");
            setRefreshKey(prev => prev + 1);
            // If we are viewing this session, force update visual state immediately if needed
            // But fetchSessionDetails triggered by refreshKey will handle it cleanly
        });

        // Listen for new candidates
        socket.on("candidate_added", (data: any) => {
            console.log("🆕 New candidate added, refreshing...");
            // If looking at the session where candidate was added, refresh
            if (Number(data.sessionId) === selectedSessionId) {
                setRefreshKey(prev => prev + 1);
            }
        });

        // Listen for new sessions
        socket.on("session_created", () => {
            console.log("🆕 New session created, refreshing list...");
            setRefreshKey(prev => prev + 1);
        });

        // Cleanup on unmount
        return () => {
            socket.disconnect();
        };
    }, [account, selectedSessionId]);

    const getEligibilityMessage = () =>
        "Anda belum bisa memilih. Silakan bind wallet dan claim Student NFT terlebih dahulu di halaman Bind Wallet.";

    const castVote = async (candidateId: number) => {
        if (!provider || !account || !selectedSessionId) return;
        setLoading(true);
        setTxHash(null);
        try {
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(
                process.env.NEXT_PUBLIC_VOTING_SYSTEM_ADDRESS!,
                VotingArtifact.abi,
                signer
            );

            // Cek apakah user punya Student NFT (sudah bind & claim)
            const nftBalance = await contract.balanceOf(account);
            if (Number(nftBalance) === 0) {
                setLoading(false);
                toast.error(getEligibilityMessage() + " Buka: " + window.location.origin + "/bind-wallet", { duration: 6000 });
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
            if (isEligibilityError) {
                toast.error(getEligibilityMessage() + " Buka: " + window.location.origin + "/bind-wallet", { duration: 6000 });
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

    if (!isConnected) return <div className="text-center pt-20">Please Connect Wallet</div>;

    // View: Session List
    if (selectedSessionId === null) {
        return (
            <div className="min-h-screen bg-dark-900 pt-20 px-4">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                        Available Voting Sessions
                    </h1>
                    <div className="grid gap-6">
                        {sessions.map((session) => (
                            <div key={session.id} className="glass-panel p-6 rounded-xl hover:bg-white/5 transition border border-white/10">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-white">{session.name}</h3>
                                        <p className="text-gray-400 mt-1">{session.description}</p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getSessionStatus(session) === 'Active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
                                        }`}>
                                        {getSessionStatus(session)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm text-gray-500">
                                    <span>End: {new Date(session.endTime * 1000).toLocaleDateString()}</span>
                                    <button
                                        onClick={() => setSelectedSessionId(session.id)}
                                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg transition"
                                    >
                                        View Candidates &rarr;
                                    </button>
                                </div>
                            </div>
                        ))}
                        {sessions.length === 0 && (
                            <p className="text-center text-gray-500">No sessions available.</p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // View: Single Session (Candidates)
    const currentSession = sessions.find(s => s.id === selectedSessionId);

    return (
        <div className="min-h-screen bg-dark-900 pt-20 px-4">
            <div className="max-w-4xl mx-auto">
                <button
                    onClick={() => { setSelectedSessionId(null); setTxHash(null); }}
                    className="mb-6 text-gray-400 hover:text-white transition flex items-center gap-2"
                >
                    &larr; Back to Sessions
                </button>

                <h1 className="text-3xl font-bold mb-2 text-center text-white">
                    {currentSession?.name}
                </h1>
                <p className="text-center text-gray-400 mb-8">{currentSession?.description}</p>

                {hasNft === false && (
                    <div className="text-center p-6 bg-amber-500/10 border border-amber-500/50 rounded-xl mb-8">
                        <p className="text-amber-300 font-semibold mb-2">Anda belum bisa memilih.</p>
                        <p className="text-gray-400 text-sm mb-4">Silakan bind wallet dan claim Student NFT terlebih dahulu.</p>
                        <Link href="/bind-wallet" className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-lg font-semibold transition">
                            Ke halaman Bind Wallet →
                        </Link>
                    </div>
                )}

                {txHash && (
                    <div className="text-center p-6 bg-blue-500/10 border border-blue-500/50 rounded-xl mb-8 animate-fade-in">
                        <p className="text-blue-300 font-bold text-xl mb-2">Vote Submitted!</p>
                        <a
                            href={getExplorerLink(txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-semibold transition"
                        >
                            View on Block Explorer
                        </a>
                    </div>
                )}

                {hasVotedInSession ? (
                    <div className="text-center p-6 bg-green-500/10 border border-green-500/50 rounded-xl mb-8">
                        <p className="text-green-300 font-bold text-xl">You have already voted in this session! 🎉</p>
                    </div>
                ) : getSessionStatus(currentSession!) !== 'Active' ? (
                    <div className="text-center p-6 bg-yellow-500/10 border border-yellow-500/50 rounded-xl mb-8">
                        <p className="text-yellow-300 font-bold">Session is {getSessionStatus(currentSession!)}</p>
                    </div>
                ) : (
                    <div className="text-center p-6 bg-blue-500/10 border border-blue-500/50 rounded-xl mb-8">
                        <p className="text-blue-300 font-semibold">Select a candidate to cast your vote.</p>
                    </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                    {candidates.map((c) => (
                        <div key={c.id} className="glass-panel p-6 rounded-xl hover:bg-white/5 transition flex flex-col items-center">
                            {c.photoUrl ? (
                                <img
                                    src={c.photoUrl}
                                    alt={c.name}
                                    className="w-24 h-24 rounded-full mb-4 object-cover border-2 border-blue-500"
                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150'; }}
                                />
                            ) : (
                                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4 flex items-center justify-center text-2xl font-bold text-white">
                                    {c.name[0]}
                                </div>
                            )}
                            <h3 className="text-xl font-bold mb-2 text-white">{c.name}</h3>

                            <div className="w-full text-left bg-dark-800/50 p-4 rounded-lg mb-4 text-sm text-gray-300">
                                <p><span className="font-bold text-blue-400">Vision:</span> {c.vision || "No vision provided."}</p>
                                <p className="mt-2"><span className="font-bold text-purple-400">Mission:</span> {c.mission || "No mission provided."}</p>
                            </div>

                            <div className="mt-auto w-full">
                                <button
                                    onClick={() => castVote(c.id)}
                                    disabled={hasVotedInSession || getSessionStatus(currentSession!) !== "Active" || loading || hasNft === false}
                                    className={`w-full py-2 rounded-lg font-semibold transition ${hasVotedInSession || getSessionStatus(currentSession!) !== "Active" || hasNft === false
                                        ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                                        : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25"
                                        }`}
                                >
                                    {loading ? "Voting..." : hasNft === false ? "Bind & claim NFT dulu" : "Vote"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}