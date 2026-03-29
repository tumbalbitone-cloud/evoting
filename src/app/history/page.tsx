"use client";

import React, { useEffect, useState } from "react";
import { ethers, Contract } from "ethers";
import toast from "react-hot-toast";
import { useWallet } from "../../context/WalletContext";
import VotingArtifact from "../../contracts/VotingSystem.json";
import { getRpcErrorMessage } from "../../utils/rpcError";


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
    const [loadingTx, setLoadingTx] = useState(false);

    const fetchHistory = async () => {
        if (!provider || !account) return;
        setLoading(true);
        try {
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(
                process.env.NEXT_PUBLIC_VOTING_SYSTEM_ADDRESS!,
                VotingArtifact.abi,
                signer
            );

            // ── Phase 1: immediately show history from contract state ──
            // getUserHistory is a view function — no getLogs, instant result.
            const historyRaw = await contract.getUserHistory(account);
            const loadedHistory: VoteRecord[] = historyRaw.map((r: any) => ({
                sessionId: Number(r.sessionId),
                candidateId: Number(r.candidateId),
                timestamp: Number(r.timestamp),
                sessionName: r.sessionName,
                candidateName: r.candidateName,
                txHash: undefined,
            }));
            loadedHistory.sort((a, b) => b.timestamp - a.timestamp);
            setHistory(loadedHistory);
            setLoading(false);

            if (loadedHistory.length === 0) return;

            // ── Phase 2: enrich with tx hashes in the background ──
            // Only search from the deployment block to avoid huge ranges.
            // Free-tier RPCs cap eth_getLogs at 10,000 blocks per request.
            setLoadingTx(true);
            try {
                const CHUNK_SIZE = 9000;
                const deployBlock = Number(
                    process.env.NEXT_PUBLIC_CONTRACT_DEPLOY_BLOCK ?? 0
                );
                const latestBlock = await provider.getBlockNumber();
                const filter = contract.filters.Voted(null, account, null);

                const txHashMap: Record<number, string> = {};
                for (let from = deployBlock; from <= latestBlock; from += CHUNK_SIZE) {
                    const to = Math.min(from + CHUNK_SIZE - 1, latestBlock);
                    const chunk = await contract.queryFilter(filter, from, to);
                    chunk.forEach((event: any) => {
                        if (event.args?.sessionId !== undefined) {
                            txHashMap[Number(event.args.sessionId)] = event.transactionHash;
                        }
                    });
                }

                // Merge tx hashes into displayed history
                setHistory(prev =>
                    prev.map(r => ({ ...r, txHash: txHashMap[r.sessionId] ?? r.txHash }))
                );
            } catch (txErr) {
                // Tx hash enrichment is best-effort — don't block the UI
                console.warn("Could not fetch tx hashes:", txErr);
            }
            setLoadingTx(false);

        } catch (err) {
            console.error("Error fetching history:", err);
            toast.error(getRpcErrorMessage(err));
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isConnected) fetchHistory();
    }, [isConnected, provider, account]);

    // Refetch when user returns to tab so history updates without reload
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === "visible" && isConnected) fetchHistory();
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, [isConnected, provider, account]);

    if (!isConnected) return <div className="text-center pt-20">Silakan hubungkan wallet</div>;

    return (
        <div className="min-h-screen bg-dark-900 pt-20 px-4 pb-10">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                    Riwayat Voting Saya
                </h1>

                {loadingTx && (
                    <p className="text-center text-xs text-gray-500 mb-4 animate-pulse">
                        ⏳ Memuat Tx Hash di latar belakang...
                    </p>
                )}
                <div className="glass-panel rounded-xl border border-white/10 overflow-hidden">
                    {loading ? (
                        <p className="text-center text-gray-400 py-10">Memuat riwayat...</p>
                    ) : history.length === 0 ? (
                        <div className="text-center py-10 px-6">
                            <p className="text-gray-400 mb-4">Anda belum memberikan suara di sesi manapun.</p>
                            <a href="/vote" className="inline-block px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition">
                                Ke Halaman Voting
                            </a>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table — hidden on mobile */}
                            <div className="hidden sm:block overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[600px]">
                                    <thead className="bg-white/5 text-gray-400 uppercase text-xs tracking-wider">
                                        <tr>
                                            <th className="px-5 py-4 font-medium">Tanggal</th>
                                            <th className="px-5 py-4 font-medium">Sesi</th>
                                            <th className="px-5 py-4 font-medium">Dipilih</th>
                                            <th className="px-5 py-4 font-medium">Tx Hash</th>
                                            <th className="px-5 py-4 font-medium text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/10">
                                        {history.map((record, index) => (
                                            <tr key={index} className="hover:bg-white/5 transition">
                                                <td className="px-5 py-4 text-gray-300 text-sm whitespace-nowrap">
                                                    {new Date(record.timestamp * 1000).toLocaleString('id-ID', {
                                                        day: 'numeric', month: 'short', year: '2-digit',
                                                        hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </td>
                                                <td className="px-5 py-4 font-semibold text-white text-sm max-w-[160px]">
                                                    <span className="block truncate" title={record.sessionName}>{record.sessionName}</span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap">
                                                        {record.candidateName}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    {record.txHash ? (
                                                        <a
                                                            href={`${process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL}/tx/${record.txHash}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-400 hover:text-blue-300 text-sm font-mono"
                                                        >
                                                            {record.txHash.substring(0, 8)}...{record.txHash.substring(record.txHash.length - 6)}
                                                        </a>
                                                    ) : (
                                                        <span className="text-gray-600 text-sm">-</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <span className="inline-flex items-center gap-1 text-green-400 text-xs whitespace-nowrap">
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        Terverifikasi
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards — hidden on desktop */}
                            <div className="sm:hidden divide-y divide-white/10">
                                {history.map((record, index) => (
                                    <div key={index} className="p-4 space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-white text-sm truncate">{record.sessionName}</p>
                                                <p className="text-gray-500 text-xs mt-0.5">
                                                    {new Date(record.timestamp * 1000).toLocaleString('id-ID', {
                                                        day: 'numeric', month: 'long', year: 'numeric',
                                                        hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                            <span className="inline-flex items-center gap-1 text-green-400 text-xs flex-shrink-0">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                Terverifikasi
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-gray-400 text-xs">Dipilih:</span>
                                            <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-xs font-medium">
                                                {record.candidateName}
                                            </span>
                                        </div>
                                        {record.txHash && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-400 text-xs">Tx:</span>
                                                <a
                                                    href={`${process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || "https://amoy.polygonscan.com"}/tx/${record.txHash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-400 hover:text-blue-300 text-xs font-mono underline underline-offset-2"
                                                >
                                                    {record.txHash.substring(0, 10)}...{record.txHash.substring(record.txHash.length - 8)}
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
