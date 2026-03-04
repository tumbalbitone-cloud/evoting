"use client";

import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "../../context/WalletContext";
import VotingArtifact from "../../contracts/VotingSystem.json";

import { useRouter } from "next/navigation";
import io from "socket.io-client"; // Import Socket.io
import toast from "react-hot-toast";
import { getValidToken, authenticatedFetch } from "../../utils/auth";
import { getRpcErrorMessage } from "../../utils/rpcError";

interface Session {
    id: number;
    name: string;
    description: string;
    startTime: number;
    endTime: number;
    isActive: boolean;
}

interface SessionStats {
    totalNFTHolders: number;
    uniqueVoterCount: number;
    participationRate: string;
    loading: boolean;
}

// ─── StatCard ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color = "blue", loading = false }: {
    label: string; value: string | number; sub?: string;
    icon: string; color?: "blue" | "green" | "amber"; loading?: boolean;
}) {
    const colorMap = {
        blue: "from-blue-600/20 to-blue-500/10 border-blue-500/30",
        green: "from-emerald-600/20 to-emerald-500/10 border-emerald-500/30",
        amber: "from-amber-600/20 to-amber-500/10 border-amber-500/30",
    };
    return (
        <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-xl p-4 flex flex-col gap-1`}>
            <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{icon}</span>
                <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">{label}</span>
            </div>
            {loading ? <div className="h-8 w-16 bg-white/10 rounded animate-pulse" /> : <p className="text-3xl font-bold text-white">{value}</p>}
            {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
        </div>
    );
}

// ─── ParticipationMeter ───────────────────────────────────────────────────

function ParticipationMeter({ rate, loading }: { rate: number; loading: boolean }) {
    const color = rate >= 70 ? "from-emerald-500 to-emerald-400"
        : rate >= 40 ? "from-blue-500 to-blue-400"
            : "from-amber-500 to-amber-400";
    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-300">Tingkat Partisipasi</span>
                {loading ? <div className="h-5 w-12 bg-white/10 rounded animate-pulse" /> : <span className="text-sm font-bold text-white">{rate.toFixed(1)}%</span>}
            </div>
            <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                <div className={`h-3 rounded-full bg-gradient-to-r ${color} transition-all duration-1000 ease-out`}
                    style={{ width: loading ? "0%" : `${Math.min(rate, 100)}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-2">Rasio pemilih aktif terhadap total pemegang Student NFT</p>
        </div>
    );
}

export default function AdminPage() {
    const { account, provider, isConnected } = useWallet();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Session State
    const [sessionName, setSessionName] = useState("");
    const [sessionDesc, setSessionDesc] = useState("");
    const [sessionDuration, setSessionDuration] = useState(7); // Days

    // Session Monitoring State
    const [sessions, setSessions] = useState<Session[]>([]);

    // Candidate State
    const [candidateName, setCandidateName] = useState("");
    const [candidatePhotoUrl, setCandidatePhotoUrl] = useState("");
    const [candidateVision, setCandidateVision] = useState("");
    const [candidateMission, setCandidateMission] = useState("");
    const [targetSessionId, setTargetSessionId] = useState(1);

    // User Management State
    const [newUserName, setNewUserName] = useState("");
    const [newUserStudentId, setNewUserStudentId] = useState("");
    const [newUserPassword, setNewUserPassword] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [detailSessionId, setDetailSessionId] = useState<number | null>(null);
    const [stats, setStats] = useState<SessionStats>({
        totalNFTHolders: 0,
        uniqueVoterCount: 0,
        participationRate: "0",
        loading: false,
    });

    useEffect(() => {
        // Simple Role Check (Security should be done on backend/contract too)
        const role = localStorage.getItem("role");
        if (role !== 'admin') {
            router.push('/');
        }
    }, [router]);

    useEffect(() => {
        if (provider) fetchSessions();
    }, [provider, refreshKey]);

    // Refetch when user returns to tab so admin list updates without reload
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === "visible" && provider) fetchSessions();
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, [provider]);

    // ---------------------------------------------------------
    // REAL-TIME UPDATES VIA SOCKET.IO
    // ---------------------------------------------------------
    useEffect(() => {
        const socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001");

        socket.on("connect", () => {
            console.log("🟢 Admin Connected to Real-time Updates");
        });

        // Listen for new sessions
        socket.on("session_created", () => {
            console.log("🆕 New session created, refreshing admin list...");
            setRefreshKey(prev => prev + 1);
        });

        // Listen for session status changes
        socket.on("session_update", () => {
            console.log("🔄 Session status updated, refreshing admin list...");
            setRefreshKey(prev => prev + 1);
        });

        // Cleanup on unmount
        return () => {
            socket.disconnect();
        };
    }, []);

    const fetchSessions = async () => {
        try {
            const readProvider = provider || new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
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

            // Sort by ID asc (oldest first, newest at bottom)
            formattedSessions.sort((a: Session, b: Session) => a.id - b.id);
            setSessions(formattedSessions);
        } catch (err) {
            console.error("Error fetching sessions:", err);
            toast.error(getRpcErrorMessage(err));
        }
    };

    const fetchSessionStats = async (sessionId: number) => {
        // Toggle: jika session yang sama diklik lagi, tutup panel
        if (detailSessionId === sessionId) {
            setDetailSessionId(null);
            return;
        }
        setDetailSessionId(sessionId);
        setStats(prev => ({ ...prev, loading: true }));

        try {
            const readProvider = provider || new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
            const contract = new ethers.Contract(
                process.env.NEXT_PUBLIC_VOTING_SYSTEM_ADDRESS!,
                VotingArtifact.abi,
                readProvider
            );

            let totalNFTHolders = 0;
            try {
                const nextId = await contract.nextTokenId();
                totalNFTHolders = Number(nextId);
            } catch (e) { console.warn("Could not fetch nextTokenId:", e); }

            let uniqueVoterCount = 0;
            try {
                const CHUNK_SIZE = 9000;
                const deployBlock = Number(process.env.NEXT_PUBLIC_CONTRACT_DEPLOY_BLOCK ?? 0);
                const latestBlock = await readProvider.getBlockNumber();
                // Filter hanya untuk sesi yang dipilih
                const filter = contract.filters.Voted(sessionId, null, null);
                const voterAddresses = new Set<string>();
                for (let from = deployBlock; from <= latestBlock; from += CHUNK_SIZE) {
                    const to = Math.min(from + CHUNK_SIZE - 1, latestBlock);
                    const chunk = await contract.queryFilter(filter, from, to);
                    chunk.forEach((event: any) => {
                        if (event.args?.voter) voterAddresses.add(event.args.voter.toLowerCase());
                    });
                }
                uniqueVoterCount = voterAddresses.size;
            } catch (e) { console.warn("Could not fetch voter events:", e); }

            const participationRate = totalNFTHolders > 0
                ? ((uniqueVoterCount / totalNFTHolders) * 100).toFixed(1)
                : "0.0";
            setStats({ totalNFTHolders, uniqueVoterCount, participationRate, loading: false });
        } catch (err) {
            console.error("Error fetching session stats:", err);
            setStats(prev => ({ ...prev, loading: false }));
        }
    };

    const createSession = async () => {
        if (!provider || !sessionName) return;
        setLoading(true);
        try {
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(
                process.env.NEXT_PUBLIC_VOTING_SYSTEM_ADDRESS!,
                VotingArtifact.abi,
                signer
            );

            const now = Math.floor(Date.now() / 1000);
            const durationSeconds = sessionDuration * 24 * 60 * 60;
            const endTime = now + durationSeconds;

            const tx = await contract.createSession(sessionName, sessionDesc, now, endTime);
            await tx.wait();
            toast.success(`Sesi "${sessionName}" berhasil dibuat`);
            setSessionName("");
            setSessionDesc("");
            fetchSessions(); // Refresh list
        } catch (err: any) {
            toast.error(getRpcErrorMessage(err));
        }
        setLoading(false);
    };

    const toggleSessionStatus = async (sessionId: number, currentStatus: boolean) => {
        if (!provider) return;
        if (!confirm(`Are you sure you want to ${currentStatus ? "STOP" : "START"} this session?`)) return;

        setLoading(true);
        try {
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(
                process.env.NEXT_PUBLIC_VOTING_SYSTEM_ADDRESS!,
                VotingArtifact.abi,
                signer
            );

            const tx = await contract.setSessionStatus(sessionId, !currentStatus);
            await tx.wait();
            toast.success(`Sesi ${sessionId} status diperbarui`);
            fetchSessions(); // Refresh list
        } catch (err: any) {
            toast.error(getRpcErrorMessage(err));
        }
        setLoading(false);
    };

    const addCandidate = async () => {
        if (!provider || !candidateName || !targetSessionId) return;
        setLoading(true);
        try {
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(
                process.env.NEXT_PUBLIC_VOTING_SYSTEM_ADDRESS!,
                VotingArtifact.abi,
                signer
            );

            const tx = await contract.addCandidate(targetSessionId, candidateName, candidatePhotoUrl, candidateVision, candidateMission);
            await tx.wait();
            toast.success(`Kandidat "${candidateName}" ditambahkan ke Sesi ${targetSessionId}`);
            setCandidateName("");
            setCandidatePhotoUrl("");
            setCandidateVision("");
            setCandidateMission("");
        } catch (err: any) {
            toast.error(getRpcErrorMessage(err));
        }
        setLoading(false);
    };

    const handleAddUser = async () => {
        if (!newUserName || !newUserStudentId || !newUserPassword) {
            toast.error("Isi semua field");
            return;
        }
        setLoading(true);
        try {
            const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: newUserName,
                    studentId: newUserStudentId,
                    password: newUserPassword
                })
            });

            const data = await res.json();
            if (res.ok) {
                toast.success("User berhasil dibuat");
                setNewUserName("");
                setNewUserStudentId("");
                setNewUserPassword("");
            } else {
                toast.error("Error: " + data.error);
            }
        } catch (err: any) {
            toast.error("Error: " + err.message);
        }
        setLoading(false);
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleString('id-ID', {
            day: 'numeric', month: 'short', year: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    };

    if (!isConnected) return <div className="text-center pt-20">Please Connect Admin Wallet</div>;

    return (
        <div className="min-h-screen bg-dark-900 pt-20 px-4 pb-20">
            <div className="max-w-6xl mx-auto space-y-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                    Admin Dashboard
                </h1>


                {/* Session Monitoring */}
                <div className="glass-panel p-4 sm:p-6 rounded-xl">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg sm:text-xl font-bold text-white">Monitor Sesi</h2>
                        <button onClick={fetchSessions} className="text-sm text-blue-400 hover:text-blue-300 transition">↻ Refresh</button>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden sm:block overflow-x-auto -mx-2">
                        <table className="w-full text-left border-collapse min-w-[560px]">
                            <thead>
                                <tr className="text-gray-400 border-b border-gray-700">
                                    <th className="p-3 text-xs uppercase tracking-wider">ID</th>
                                    <th className="p-3 text-xs uppercase tracking-wider">Nama Sesi</th>
                                    <th className="p-3 text-xs uppercase tracking-wider">Status</th>
                                    <th className="p-3 text-xs uppercase tracking-wider">Waktu</th>
                                    <th className="p-3 text-xs uppercase tracking-wider">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.length === 0 ? (
                                    <tr><td colSpan={5} className="p-4 text-center text-gray-500">Belum ada sesi</td></tr>
                                ) : (
                                    sessions.map((session) => (
                                        <tr key={session.id} className="border-b border-gray-800 hover:bg-white/5">
                                            <td className="p-3 font-mono text-gray-400 text-sm">#{session.id}</td>
                                            <td className="p-3 font-bold text-white text-sm max-w-[150px]">
                                                <span className="block truncate" title={session.name}>{session.name}</span>
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${session.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                                                    {session.isActive ? "AKTIF" : "SELESAI"}
                                                </span>
                                            </td>
                                            <td className="p-3 text-xs text-gray-400 whitespace-nowrap">
                                                <div>▶ {formatTime(session.startTime)}</div>
                                                <div>⏹ {formatTime(session.endTime)}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => toggleSessionStatus(session.id, session.isActive)}
                                                        className={`px-3 py-1.5 rounded text-xs font-bold transition whitespace-nowrap ${session.isActive
                                                            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                                            : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                                            }`}
                                                    >
                                                        {session.isActive ? "STOP" : "START"}
                                                    </button>
                                                    <button
                                                        onClick={() => fetchSessionStats(session.id)}
                                                        className={`px-3 py-1.5 rounded text-xs font-bold transition whitespace-nowrap ${detailSessionId === session.id
                                                            ? "bg-purple-600 text-white"
                                                            : "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                                                            }`}
                                                    >
                                                        📊 Detail
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="sm:hidden space-y-3">
                        {sessions.length === 0 ? (
                            <p className="text-center text-gray-500 py-4">Belum ada sesi</p>
                        ) : (
                            sessions.map((session) => (
                                <div key={session.id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-white text-sm truncate" title={session.name}>{session.name}</p>
                                            <p className="text-gray-500 text-xs font-mono mt-0.5">ID: #{session.id}</p>
                                        </div>
                                        <span className={`flex-shrink-0 px-2 py-1 rounded text-xs font-bold ${session.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                                            {session.isActive ? "AKTIF" : "SELESAI"}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-400 space-y-0.5 mb-3">
                                        <div>▶ Mulai: {formatTime(session.startTime)}</div>
                                        <div>⏹ Akhir: {formatTime(session.endTime)}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => toggleSessionStatus(session.id, session.isActive)}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${session.isActive
                                                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20"
                                                : "bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/20"
                                                }`}
                                        >
                                            {session.isActive ? "⏹ Hentikan" : "▶ Aktifkan"}
                                        </button>
                                        <button
                                            onClick={() => fetchSessionStats(session.id)}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition border ${detailSessionId === session.id
                                                ? "bg-purple-600 text-white border-purple-600"
                                                : "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border-purple-500/20"
                                                }`}
                                        >
                                            📊 Detail
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* ── Stats Panel (muncul saat Detail diklik) ── */}
                    {detailSessionId !== null && (
                        <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-gray-400">
                                    Statistik Sesi #{detailSessionId}{" — "}
                                    <span className="text-white">{sessions.find(s => s.id === detailSessionId)?.name}</span>
                                </p>
                                <button
                                    onClick={() => setDetailSessionId(null)}
                                    className="text-gray-500 hover:text-white text-sm transition"
                                >✕ Tutup</button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <StatCard icon="🏛️" label="Pemilih Terdaftar" value={stats.totalNFTHolders}
                                    sub="Pemegang Student NFT" color="blue" loading={stats.loading} />
                                <StatCard icon="✅" label="Sudah Memilih" value={stats.uniqueVoterCount}
                                    sub="Dari sesi ini" color="green" loading={stats.loading} />
                                <div className="col-span-2 sm:col-span-1">
                                    <StatCard icon="📊" label="Partisipasi"
                                        value={`${stats.participationRate}%`}
                                        sub="Voter aktif / Terdaftar"
                                        color={Number(stats.participationRate) >= 70 ? "green" : Number(stats.participationRate) >= 40 ? "blue" : "amber"}
                                        loading={stats.loading} />
                                </div>
                            </div>
                            <ParticipationMeter rate={Number(stats.participationRate)} loading={stats.loading} />
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Create Session */}
                    <div className="glass-panel p-4 sm:p-6 rounded-xl">
                        <h2 className="text-lg sm:text-xl font-bold mb-4 text-white">Buat Sesi Baru</h2>
                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder="Nama Sesi (cth. Pemira BEM 2026)"
                                value={sessionName}
                                onChange={(e) => setSessionName(e.target.value)}
                                className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 text-white text-sm"
                            />
                            <textarea
                                placeholder="Deskripsi sesi..."
                                rows={3}
                                value={sessionDesc}
                                onChange={(e) => setSessionDesc(e.target.value)}
                                className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 text-white text-sm resize-none"
                            />
                            <div className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-2.5">
                                <span className="text-gray-400 text-sm flex-1">Durasi (hari):</span>
                                <input
                                    type="number"
                                    min={1}
                                    value={sessionDuration}
                                    onChange={(e) => setSessionDuration(Number(e.target.value))}
                                    className="w-20 bg-dark-800 border border-gray-700 rounded-lg px-3 py-1.5 text-center focus:outline-none focus:border-blue-500 text-white text-sm"
                                />
                            </div>
                            <button
                                onClick={createSession}
                                disabled={loading}
                                className="w-full py-3 rounded-lg font-bold transition bg-green-600 hover:bg-green-500 text-white text-sm disabled:opacity-50"
                            >
                                {loading ? "Membuat..." : "✓ Buat Sesi"}
                            </button>
                        </div>
                    </div>

                    {/* Add Candidate */}
                    <div className="glass-panel p-4 sm:p-6 rounded-xl">
                        <h2 className="text-lg sm:text-xl font-bold mb-4 text-white">Tambah Kandidat</h2>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-2.5">
                                <span className="text-gray-400 text-sm flex-shrink-0">ID Sesi:</span>
                                <input
                                    type="number"
                                    placeholder="1"
                                    value={targetSessionId}
                                    onChange={(e) => setTargetSessionId(Number(e.target.value))}
                                    className="flex-1 bg-transparent focus:outline-none text-white text-sm"
                                />
                            </div>
                            <input
                                type="text"
                                placeholder="Nama Kandidat"
                                value={candidateName}
                                onChange={(e) => setCandidateName(e.target.value)}
                                className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 text-white text-sm"
                            />
                            <div className="space-y-2">
                                <label className="text-gray-400 text-sm">Foto Kandidat (Upload atau URL)</label>
                                <div className="flex flex-col gap-2">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            const formData = new FormData();
                                            formData.append('image', file);
                                            setLoading(true);
                                            try {
                                                const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, {
                                                    method: 'POST',
                                                    body: formData
                                                });
                                                const data = await res.json();
                                                if (data.success) {
                                                    setCandidatePhotoUrl(data.url);
                                                    toast.success("Foto berhasil diunggah");
                                                } else {
                                                    toast.error("Upload gagal: " + data.error);
                                                }
                                            } catch (err) {
                                                console.error(err);
                                                toast.error("Upload gagal");
                                            }
                                            setLoading(false);
                                        }}
                                        className="text-white text-sm bg-white/5 border border-gray-700 rounded-lg px-3 py-2 w-full file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-600/30 file:text-blue-300 hover:file:bg-blue-600/50"
                                    />
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-px bg-gray-700"></div>
                                        <span className="text-gray-500 text-xs">atau URL</span>
                                        <div className="flex-1 h-px bg-gray-700"></div>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="https://example.com/photo.jpg"
                                        value={candidatePhotoUrl}
                                        onChange={(e) => setCandidatePhotoUrl(e.target.value)}
                                        className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 text-white text-sm"
                                    />
                                </div>
                                {candidatePhotoUrl && (
                                    <div className="flex items-center gap-3 mt-2 p-3 bg-white/5 rounded-lg">
                                        <img src={candidatePhotoUrl} alt="Preview" className="w-14 h-14 object-cover rounded-lg border border-gray-600 flex-shrink-0" />
                                        <p className="text-gray-400 text-xs">Preview foto kandidat</p>
                                    </div>
                                )}
                            </div>
                            <textarea
                                placeholder="Visi kandidat..."
                                rows={2}
                                value={candidateVision}
                                onChange={(e) => setCandidateVision(e.target.value)}
                                className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 text-white text-sm resize-none"
                            />
                            <textarea
                                placeholder="Misi kandidat..."
                                rows={2}
                                value={candidateMission}
                                onChange={(e) => setCandidateMission(e.target.value)}
                                className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 text-white text-sm resize-none"
                            />
                            <button
                                onClick={addCandidate}
                                disabled={loading}
                                className="w-full py-3 rounded-lg font-bold transition bg-blue-600 hover:bg-blue-500 text-white text-sm disabled:opacity-50"
                            >
                                {loading ? "Menambahkan..." : "+ Tambah Kandidat"}
                            </button>
                        </div>
                    </div>

                    {/* User Management */}
                    <div className="glass-panel p-6 rounded-xl md:col-span-2">
                        <h2 className="text-xl font-bold mb-4 text-white">Tambah Voter Baru</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <input
                                type="text"
                                placeholder="Nama Lengkap"
                                value={newUserName}
                                onChange={(e) => setNewUserName(e.target.value)}
                                className="bg-dark-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 text-white text-sm"
                            />
                            <input
                                type="text"
                                placeholder="NIM (Username)"
                                value={newUserStudentId}
                                onChange={(e) => setNewUserStudentId(e.target.value)}
                                className="bg-dark-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 text-white text-sm"
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                value={newUserPassword}
                                onChange={(e) => setNewUserPassword(e.target.value)}
                                className="bg-dark-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 text-white text-sm"
                            />
                        </div>
                        <button
                            onClick={handleAddUser}
                            disabled={loading}
                            className={`w-full mt-4 py-3 rounded-lg font-bold transition bg-purple-600 hover:bg-purple-500 text-white`}
                        >
                            {loading ? "Membuat User..." : "Buat User Baru"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
