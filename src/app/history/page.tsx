"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import { useWallet } from "../../context/WalletContext";
import VotingArtifact from "../../contracts/VotingSystem.json";
import { getRpcErrorMessage } from "../../utils/rpcError";
import { getBlockExplorerTxUrl } from "../../utils/explorer";
import { publicApiFetch } from "../../utils/api";

interface VoteRecord {
  sessionId: number;
  candidateId: number;
  timestamp: number;
  sessionName: string;
  sessionDescription?: string;
  candidateName: string;
  txHash?: string;
}

type SessionSummary = {
  id: number;
  name?: string;
  description?: string;
};

type SessionResultsCandidate = {
  id: number;
  name?: string;
};

type ContractVoteRecord = {
  sessionId: bigint;
  candidateId: bigint;
  timestamp: bigint;
};

const HISTORY_CHUNK_SIZE = 9000;

function formatDesktopDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMobileDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRecordKey(record: VoteRecord) {
  return `${record.sessionId}-${record.candidateId}-${record.timestamp}`;
}

function isEventLog(event: ethers.Log | ethers.EventLog): event is ethers.EventLog {
  return "args" in event;
}

export default function HistoryPage() {
  const { account, provider, isConnected, connectWallet, isConnecting } = useWallet();
  const [history, setHistory] = useState<VoteRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTx, setLoadingTx] = useState(false);
  const [chainId, setChainId] = useState<bigint | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const enrichHistoryLabels = useCallback(async (records: VoteRecord[]) => {
    if (records.length === 0) {
      return records;
    }

    const sessionResponse = await publicApiFetch("/api/read-model/sessions");
    const sessionPayload = await sessionResponse.json().catch(() => ({}));
    if (!sessionResponse.ok || !sessionPayload.success) {
      return records;
    }

    const sessionMap = new Map<number, { name: string; description: string }>(
      ((sessionPayload.sessions || []) as SessionSummary[]).map((session) => [
        Number(session.id),
        {
          name: String(session.name || `Sesi #${session.id}`),
          description: String(session.description || ""),
        },
      ]),
    );

    const sessionIds = [...new Set(records.map((record) => record.sessionId))];
    const resultsEntries = await Promise.all(
      sessionIds.map(async (sessionId) => {
        try {
          const response = await publicApiFetch(`/api/read-model/sessions/${sessionId}/results`);
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload.success) {
            return [sessionId, new Map<number, string>()] as const;
          }

          const candidateMap = new Map<number, string>(
            ((payload.candidates || []) as SessionResultsCandidate[]).map((candidate) => [
              Number(candidate.id),
              String(candidate.name || `Kandidat #${candidate.id}`),
            ]),
          );

          return [sessionId, candidateMap] as const;
        } catch {
          return [sessionId, new Map<number, string>()] as const;
        }
      }),
    );

    const resultsMap = new Map(resultsEntries);

    return records.map((record) => ({
      ...record,
      sessionName: sessionMap.get(record.sessionId)?.name || `Sesi #${record.sessionId}`,
      sessionDescription: sessionMap.get(record.sessionId)?.description || "",
      candidateName:
        resultsMap.get(record.sessionId)?.get(record.candidateId) ||
        `Kandidat #${record.candidateId}`,
    }));
  }, []);

  const fetchHistory = useCallback(async (options?: { silent?: boolean }) => {
    if (!provider || !account) {
      return;
    }

    const silent = options?.silent === true;

    if (silent) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setHistoryError(null);

    try {
      if (!process.env.NEXT_PUBLIC_VOTING_SYSTEM_ADDRESS) {
        throw new Error("Alamat kontrak voting belum dikonfigurasi di frontend.");
      }

      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        process.env.NEXT_PUBLIC_VOTING_SYSTEM_ADDRESS!,
        VotingArtifact.abi,
        signer,
      );

      const historyRaw = (await contract.getUserHistory(account)) as ContractVoteRecord[];
      const loadedHistory: VoteRecord[] = historyRaw
        .map((record) => ({
          sessionId: Number(record.sessionId),
          candidateId: Number(record.candidateId),
          timestamp: Number(record.timestamp),
          sessionName: "",
          candidateName: "",
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

      const enrichedHistory = await enrichHistoryLabels(loadedHistory);
      setHistory(enrichedHistory);

      if (loadedHistory.length === 0) {
        return;
      }

      setLoadingTx(true);

      try {
        const deployBlock = Number(process.env.NEXT_PUBLIC_CONTRACT_DEPLOY_BLOCK ?? 0);
        const latestBlock = await provider.getBlockNumber();
        const filter = contract.filters.Voted(null, account, null);
        const txHashMap: Record<number, string> = {};

        for (let from = deployBlock; from <= latestBlock; from += HISTORY_CHUNK_SIZE) {
          const to = Math.min(from + HISTORY_CHUNK_SIZE - 1, latestBlock);
          const chunk = await contract.queryFilter(filter, from, to);

          chunk.forEach((event) => {
            if (!isEventLog(event)) {
              return;
            }

            const sessionId = event.args?.sessionId;
            if (sessionId !== undefined) {
              const normalizedSessionId = Number(sessionId);
              if (txHashMap[normalizedSessionId] === undefined) {
                txHashMap[normalizedSessionId] = event.transactionHash;
              }
            }
          });
        }

        setHistory((prev) =>
          prev.map((record) => ({
            ...record,
            txHash: txHashMap[record.sessionId] ?? record.txHash,
          })),
        );
      } catch (txErr) {
        console.warn("Could not fetch tx hashes:", txErr);
      } finally {
        setLoadingTx(false);
      }
    } catch (err) {
      console.error("Error fetching history:", err);
      const message = getRpcErrorMessage(err);
      setHistoryError(message);
      toast.error(message);
    } finally {
      if (silent) {
        setIsRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [account, provider, enrichHistoryLabels]);

  useEffect(() => {
    if (isConnected) {
      fetchHistory();
    }
  }, [isConnected, fetchHistory]);

  useEffect(() => {
    if (!provider) {
      setChainId(null);
      return;
    }

    provider
      .getNetwork()
      .then((network) => setChainId(network.chainId))
      .catch(() => setChainId(null));
  }, [provider]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && isConnected) {
        fetchHistory({ silent: true });
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isConnected, fetchHistory]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-dark-900 px-4 pt-24">
        <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white backdrop-blur-xl">
          <h1 className="text-2xl font-bold">Riwayat Voting Saya</h1>
          <p className="mt-3 text-sm text-gray-300">
            Hubungkan wallet lebih dulu agar riwayat suara Anda bisa dibaca dari blockchain.
          </p>
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isConnecting ? "Menghubungkan Wallet..." : "Hubungkan Wallet"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900 pt-20 px-4 pb-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
          Riwayat Voting Saya
        </h1>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-400">
            {historyError
              ? "Riwayat belum berhasil dimuat penuh. Anda bisa coba lagi."
              : "Riwayat diambil langsung dari kontrak dan diperbarui saat halaman aktif kembali."}
          </p>
          <button
            onClick={() => fetchHistory({ silent: history.length > 0 })}
            disabled={loading || isRefreshing}
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading || isRefreshing ? "Memuat Ulang..." : "Muat Ulang"}
          </button>
        </div>

        {historyError && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {historyError}
          </div>
        )}

        {loadingTx && (
          <p className="text-center text-xs text-gray-500 mb-4 animate-pulse">
            ⏳ Memuat transaksi di latar belakang...
          </p>
        )}

        {isRefreshing && !loadingTx && (
          <p className="text-center text-xs text-gray-500 mb-4 animate-pulse">
            Menyegarkan riwayat terbaru dari blockchain...
          </p>
        )}

        <div className="glass-panel rounded-xl border border-white/10 overflow-hidden">
          {loading ? (
            <p className="text-center text-gray-400 py-10">Memuat riwayat...</p>
          ) : history.length === 0 ? (
            <div className="text-center py-10 px-6">
              <p className="text-gray-400 mb-4">Anda belum memberikan suara di sesi manapun.</p>
              <Link
                href="/vote"
                className="inline-block px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition"
              >
                Ke Halaman Voting
              </Link>
            </div>
          ) : (
            <>
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
                    {history.map((record) => (
                      <tr key={getRecordKey(record)} className="hover:bg-white/5 transition">
                        <td className="px-5 py-4 text-gray-300 text-sm whitespace-nowrap">
                          {formatDesktopDate(record.timestamp)}
                        </td>
                        <td className="px-5 py-4 font-semibold text-white text-sm max-w-[160px]">
                          <span className="block truncate" title={record.sessionName}>
                            {record.sessionName}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap">
                            {record.candidateName}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {record.txHash ? (
                            <a
                              href={getBlockExplorerTxUrl(record.txHash, chainId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 text-sm font-mono"
                            >
                              {record.txHash.substring(0, 8)}...
                              {record.txHash.substring(record.txHash.length - 6)}
                            </a>
                          ) : (
                            <span className="text-gray-600 text-sm">-</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="inline-flex items-center gap-1 text-green-400 text-xs whitespace-nowrap">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                              className="w-4 h-4 shrink-0"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            Terverifikasi
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="sm:hidden divide-y divide-white/10">
                {history.map((record) => (
                  <div key={getRecordKey(record)} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-sm truncate">
                          {record.sessionName}
                        </p>
                        <p className="text-gray-500 text-xs mt-0.5">
                          {formatMobileDate(record.timestamp)}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-green-400 text-xs flex-shrink-0">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                          className="w-3.5 h-3.5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
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
                          href={getBlockExplorerTxUrl(record.txHash, chainId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-xs font-mono underline underline-offset-2"
                        >
                          {record.txHash.substring(0, 10)}...
                          {record.txHash.substring(record.txHash.length - 8)}
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
