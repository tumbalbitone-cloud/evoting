"use client";

import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import { useWallet } from "../../context/WalletContext";
import VotingArtifact from "../../contracts/VotingSystem.json";
import { getRpcErrorMessage } from "../../utils/rpcError";
import io from "socket.io-client"; // Import Socket.io client

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
    percentage?: string;
}

export default function ResultsPage() {
    const { provider } = useWallet();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // Refetch when user returns to tab so results update without reload
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === "visible") setRefreshKey((k) => k + 1);
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, []);

    // Fetch Sessions on Load (and when refreshKey changes)
    useEffect(() => {
        const fetchSessions = async () => {
            const readProvider = provider || new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
            try {
                const contract = new ethers.Contract(
                    process.env.NEXT_PUBLIC_VOTING_SYSTEM_ADDRESS!,
                    VotingArtifact.abi,
                    readProvider
                );

                const data = await contract.getAllSessions();

                // Format sessions
                const formattedSessions = data.map((s: any) => ({
                    id: Number(s.id),
                    name: s.name,
                    description: s.description,
                    startTime: Number(s.startTime),
                    endTime: Number(s.endTime),
                    isActive: s.isActive,
                }));

                // Sort by ID desc (newest first)
                formattedSessions.sort((a: Session, b: Session) => b.id - a.id);
                setSessions(formattedSessions);

                // Select first session by default if available
                if (formattedSessions.length > 0 && selectedSessionId === null) {
                    setSelectedSessionId(formattedSessions[0].id);
                }

            } catch (err) {
                console.error("Error fetching sessions:", err);
                toast.error(getRpcErrorMessage(err));
            }
        };

        fetchSessions();
    }, [provider, refreshKey]);

    // Fetch Results when Session Changes + Real-time Updates
    useEffect(() => {
        if (selectedSessionId === null) return;

        const fetchResults = async () => {
            // Only set loading on initial fetch or major change, not every update to avoid flicker
            if (candidates.length === 0) setLoading(true);

            const readProvider = provider || new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
            try {
                const contract = new ethers.Contract(
                    process.env.NEXT_PUBLIC_VOTING_SYSTEM_ADDRESS!,
                    VotingArtifact.abi,
                    readProvider
                );

                const data = await contract.getCandidates(selectedSessionId);
                let totalVotes = 0;

                // Process candidates
                const loadedCandidates: Candidate[] = data.map((c: any) => {
                    const votes = Number(c.voteCount);
                    totalVotes += votes;
                    return {
                        id: Number(c.id),
                        name: c.name,
                        photoUrl: c.photoUrl,
                        vision: c.vision,
                        mission: c.mission,
                        voteCount: votes
                    };
                });

                // Calculate percentages
                const candidatesWithStats = loadedCandidates.map(c => ({
                    ...c,
                    percentage: totalVotes === 0 ? "0.0" : ((c.voteCount / totalVotes) * 100).toFixed(1)
                }));

                // Sort by votes
                candidatesWithStats.sort((a, b) => b.voteCount - a.voteCount);

                setCandidates(candidatesWithStats);
            } catch (err) {
                console.error("Error fetching results:", err);
                toast.error(getRpcErrorMessage(err));
            } finally {
                setLoading(false);
            }
        };

        // Initial fetch
        fetchResults();

        // ---------------------------------------------------------
        // REAL-TIME UPDATES VIA SOCKET.IO
        // ---------------------------------------------------------
        const socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001");

        socket.on("connect", () => {
            console.log("🟢 Connected to Real-time Voting Updates");
        });

        // Listen for new votes
        socket.on("vote_update", (data: any) => {
            // Check if the update is for the current session
            if (Number(data.sessionId) === selectedSessionId) {
                console.log("🚀 New vote received, updating results...");
                fetchResults();
            }
        });

        // Listen for session status changes
        socket.on("session_update", (data: any) => {
            if (Number(data.sessionId) === selectedSessionId) {
                console.log("🔄 Session status changed, refreshing...");
                setRefreshKey(prev => prev + 1); // Trigger session list refresh
            }
        });

        // Listen for new candidates
        socket.on("candidate_added", (data: any) => {
            if (Number(data.sessionId) === selectedSessionId) {
                console.log("🆕 New candidate added, updating results...");
                fetchResults();
            }
        });

        // Cleanup on unmount or session change
        return () => {
            socket.disconnect();
        };

    }, [selectedSessionId, provider, refreshKey]);


    const getSessionStatus = (startTime: number, endTime: number, isActive: boolean) => {
        const now = Math.floor(Date.now() / 1000);
        if (!isActive) return { text: "Closed", color: "text-red-400" };
        if (now < startTime) return { text: "Upcoming", color: "text-yellow-400" };
        if (now > endTime) return { text: "Ended", color: "text-red-400" };
        return { text: "Active", color: "text-green-400" };
    };

    return (
        <div className="min-h-screen bg-dark-900 pt-20 px-4">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-400">
                    Election Results <span className="text-sm font-normal text-gray-500 ml-2">(Live Updates)</span>
                </h1>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Sidebar: Session List */}
                    <div className="lg:col-span-1 space-y-4">
                        <h2 className="text-xl font-semibold text-white mb-4">Select Session</h2>
                        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            {sessions.map((session) => (
                                <button
                                    key={session.id}
                                    onClick={() => setSelectedSessionId(session.id)}
                                    className={`w-full text-left p-4 rounded-xl transition-all ${selectedSessionId === session.id
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                                        : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                                        }`}
                                >
                                    <h3 className="font-bold truncate">{session.name}</h3>
                                    <div className="flex justify-between items-center mt-2 text-xs">
                                        <span className={getSessionStatus(session.startTime, session.endTime, session.isActive).color}>
                                            {getSessionStatus(session.startTime, session.endTime, session.isActive).text}
                                        </span>
                                        <span className="opacity-60">ID: {session.id}</span>
                                    </div>
                                </button>
                            ))}
                            {sessions.length === 0 && (
                                <p className="text-gray-500 text-center py-4">No sessions found.</p>
                            )}
                        </div>
                    </div>

                    {/* Main Content: Results */}
                    <div className="lg:col-span-3">
                        {selectedSessionId ? (
                            <div className="bg-white/5 rounded-2xl p-6 border border-white/10 backdrop-blur-sm">
                                <h2 className="text-2xl font-bold text-white mb-6">
                                    {sessions.find(s => s.id === selectedSessionId)?.name} <span className="text-gray-500 text-lg font-normal">Results</span>
                                </h2>

                                {loading && candidates.length === 0 ? (
                                    <p className="text-center text-gray-400 py-10">Loading results...</p>
                                ) : (
                                    <div className="space-y-6">
                                        {candidates.map((c, index) => (
                                            <div key={c.id} className="glass-panel p-6 rounded-xl relative overflow-hidden group hover:border-blue-500/30 transition-all">
                                                {/* Background Bar */}
                                                <div
                                                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-600/10 to-blue-400/10 transition-all duration-1000 ease-out"
                                                    style={{ width: `${c.percentage}%` }}
                                                ></div>

                                                <div className="relative z-10 flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`
                                                            w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0
                                                            ${index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                                                                index === 1 ? 'bg-gray-400/20 text-gray-400' :
                                                                    index === 2 ? 'bg-orange-500/20 text-orange-500' : 'bg-white/5 text-gray-600'}
                                                        `}>
                                                            {index + 1}
                                                        </div>

                                                        <div className="flex items-center gap-4">
                                                            {c.photoUrl && (
                                                                <img
                                                                    src={c.photoUrl}
                                                                    alt={c.name}
                                                                    className="w-12 h-12 rounded-full object-cover border border-white/10"
                                                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150'; }}
                                                                />
                                                            )}
                                                            <div>
                                                                <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">{c.name}</h3>
                                                                <p className="text-sm text-gray-400">{c.voteCount} Votes</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-3xl font-bold text-blue-400">
                                                            {c.percentage}%
                                                        </div>
                                                        <div className="text-xs text-gray-500 uppercase tracking-widest mt-1">
                                                            of Total
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {candidates.length === 0 && (
                                            <div className="text-center py-10">
                                                <p className="text-gray-500">No candidates found for this session.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-white/5 rounded-2xl border border-white/5 p-10">
                                <p className="text-xl">Select a session to view results.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
