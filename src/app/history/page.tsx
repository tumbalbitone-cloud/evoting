"use client";

import React, { useEffect, useState } from "react";
import { ethers, Contract } from "ethers";
import { useWallet } from "../../context/WalletContext";
import VotingArtifact from "../../contracts/Voting.json";


interface VoteRecord {
    sessionId: number;
    candidateId: number;
    timestamp: number;
    sessionName: string;
    sessionDescription?: string;
    candidateName: string;
    txHash?: string;
}

export default function HistoryPage() {
    const { account, provider, isConnected } = useWallet();
    const [history, setHistory] = useState<VoteRecord[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchHistory = async () => {
        if (!provider || !account) return;
        setLoading(true);
        try {
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(
                process.env.NEXT_PUBLIC_VOTING_CONTRACT_ADDRESS!,
                VotingArtifact.abi,
                signer
            );

            // Fetch history from contract
            const historyRaw = await contract.getUserHistory(account);

            // Fetch Voted events to get TxHash
            const filter = contract.filters.Voted(null, account, null);
            const events = await contract.queryFilter(filter);

            // Map SessionID -> TxHash
            const txHashMap: Record<number, string> = {};
            events.forEach((event: any) => {
                if (event.args && event.args.sessionId) {
                    txHashMap[Number(event.args.sessionId)] = event.transactionHash;
                }
            });

            const loadedHistory = historyRaw.map((r: any) => ({
                sessionId: Number(r.sessionId),
                candidateId: Number(r.candidateId),
                timestamp: Number(r.timestamp),
                sessionName: r.sessionName,
                candidateName: r.candidateName,
                txHash: txHashMap[Number(r.sessionId)]
            }));

            // Sort by timestamp descending
            loadedHistory.sort((a: any, b: any) => b.timestamp - a.timestamp);
            setHistory(loadedHistory);

        } catch (err) {
            console.error("Error fetching history:", err);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (isConnected) fetchHistory();
    }, [isConnected, provider, account]);

    if (!isConnected) return <div className="text-center pt-20">Please Connect Wallet</div>;

    return (
        <div className="min-h-screen bg-dark-900 pt-20 px-4">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                    My Voting History
                </h1>

                <div className="glass-panel p-6 rounded-xl border border-white/10">
                    {loading ? (
                        <p className="text-center text-gray-400">Loading history...</p>
                    ) : history.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-gray-400 mb-4">You have not voted in any sessions yet.</p>
                            <a href="/vote" className="text-blue-400 hover:text-blue-300 transition">Go to Voting Page</a>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white/5 text-gray-400 uppercase text-xs tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">Date</th>
                                        <th className="px-6 py-4 font-medium">Session</th>
                                        <th className="px-6 py-4 font-medium">Voted For</th>
                                        <th className="px-6 py-4 font-medium">Tx Hash</th>
                                        <th className="px-6 py-4 font-medium text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10">
                                    {history.map((record, index) => (
                                        <tr key={index} className="hover:bg-white/5 transition">
                                            <td className="px-6 py-4 text-gray-300">
                                                {new Date(record.timestamp * 1000).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 font-semibold text-white">
                                                {record.sessionName}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-xs font-medium">
                                                    {record.candidateName}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {record.txHash ? (
                                                    <a
                                                        href={`https://amoy.polygonscan.com/tx/${record.txHash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-400 hover:text-blue-300 text-sm font-mono"
                                                    >
                                                        {record.txHash.substring(0, 6)}...{record.txHash.substring(record.txHash.length - 4)}
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-600 text-sm">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="inline-flex items-center gap-1 text-green-400 text-sm">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    Confirmed
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
