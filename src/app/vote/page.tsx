"use client";

import React, { useEffect, useState } from "react";
import { ethers, Contract } from "ethers";
import { useWallet } from "../../context/WalletContext";
import VotingArtifact from "../../contracts/Voting.json";


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

    // Initial fetch for all sessions
    const fetchSessions = async () => {
        if (!provider) return;
        try {
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(
                process.env.NEXT_PUBLIC_VOTING_CONTRACT_ADDRESS!,
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
        }
    };

    // Fetch details when a session is selected
    const fetchSessionDetails = async (sessionId: number) => {
        if (!provider || !account) return;
        setLoading(true);
        try {
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(
                process.env.NEXT_PUBLIC_VOTING_CONTRACT_ADDRESS!,
                VotingArtifact.abi,
                signer
            );

            // Fetch Candidates for this session
            const candidatesRaw = await contract.getCandidates(sessionId);
            const loadedCandidates = candidatesRaw.map((c: any) => ({
                id: Number(c.id),
                name: c.name,
                voteCount: Number(c.voteCount)
            }));
            setCandidates(loadedCandidates);

            // Check if user voted in this session
            const hasVoted = await contract.hasVotedInSession(sessionId, account);
            setHasVotedInSession(hasVoted);

        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (isConnected) fetchSessions();
    }, [isConnected, provider]);

    useEffect(() => {
        if (selectedSessionId && isConnected) {
            fetchSessionDetails(selectedSessionId);
        }
    }, [selectedSessionId, isConnected]);

    const castVote = async (candidateId: number) => {
        if (!provider || !selectedSessionId) return;
        setLoading(true);
        setTxHash(null);
        try {
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(
                process.env.NEXT_PUBLIC_VOTING_CONTRACT_ADDRESS!,
                VotingArtifact.abi,
                signer
            );

            const tx = await contract.vote(selectedSessionId, candidateId);
            setTxHash(tx.hash);
            await tx.wait();
            alert("Vote Cast Successfully!");
            fetchSessionDetails(selectedSessionId); // Refresh data
        } catch (err: any) {
            alert("Error: " + (err.reason || err.message));
        }
        setLoading(false);
    };

    const getExplorerLink = (hash: string) => {
        if (chainId === 80002n) return `https://amoy.polygonscan.com/tx/${hash}`;
        if (chainId === 11155111n) return `https://sepolia.etherscan.io/tx/${hash}`;
        return `https://sepolia.etherscan.io/tx/${hash}`;
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
                            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4 flex items-center justify-center text-2xl font-bold text-white">
                                {c.name[0]}
                            </div>
                            <h3 className="text-xl font-bold mb-2 text-white">{c.name}</h3>
                            <div className="mt-4 w-full">
                                <button
                                    onClick={() => castVote(c.id)}
                                    disabled={hasVotedInSession || getSessionStatus(currentSession!) !== 'Active' || loading}
                                    className={`w-full py-2 rounded-lg font-semibold transition ${hasVotedInSession || getSessionStatus(currentSession!) !== 'Active'
                                        ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                                        : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25"
                                        }`}
                                >
                                    {loading ? "Voting..." : "Vote"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
