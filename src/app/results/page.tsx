"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import io from "socket.io-client";
import { getValidImageUrl } from "../../utils/image";
import { getApiBaseUrl, publicApiFetch } from "../../utils/api";
import {
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

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


// ─── Chart Colors ─────────────────────────────────────────────────────────────

const CHART_COLORS = [
    "#3b82f6", // blue
    "#8b5cf6", // purple
    "#10b981", // emerald
    "#f59e0b", // amber
    "#ef4444", // red
    "#06b6d4", // cyan
    "#ec4899", // pink
    "#84cc16", // lime
];

const FALLBACK_CANDIDATE_IMAGE =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' rx='80' fill='%23111827'/%3E%3Ccircle cx='80' cy='62' r='28' fill='%233b82f6' fill-opacity='0.85'/%3E%3Cpath d='M38 130c8-23 29-36 42-36s34 13 42 36' fill='%233b82f6' fill-opacity='0.55'/%3E%3C/svg%3E";

// ─── Custom Tooltip for Pie Chart ─────────────────────────────────────────────

const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-gray-900 border border-white/10 rounded-xl px-4 py-3 shadow-xl">
                <p className="font-bold text-white text-sm">{payload[0].name}</p>
                <p className="text-blue-400 text-sm">{payload[0].value} suara</p>
                <p className="text-gray-400 text-xs">{payload[0].payload.percentage}% dari total</p>
            </div>
        );
    }
    return null;
};

// ─── Custom Tooltip for Bar Chart ─────────────────────────────────────────────

const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-gray-900 border border-white/10 rounded-xl px-4 py-3 shadow-xl">
                <p className="font-bold text-white text-sm mb-1">{label}</p>
                <p className="text-blue-400 text-sm">{payload[0].value} suara</p>
            </div>
        );
    }
    return null;
};


// ─── Pie Chart Wrapper ────────────────────────────────────────────────────────

function VotePieChart({ candidates }: { candidates: Candidate[] }) {
    const data = candidates.map((c) => ({
        name: c.name,
        value: c.voteCount,
        percentage: c.percentage,
    }));

    if (candidates.every((c) => c.voteCount === 0)) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
                Belum ada suara masuk
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={280}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                >
                    {data.map((_, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                            stroke="transparent"
                        />
                    ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend
                    formatter={(value) => (
                        <span className="text-gray-300 text-xs">{value}</span>
                    )}
                />
            </PieChart>
        </ResponsiveContainer>
    );
}

// ─── Bar Chart Wrapper ────────────────────────────────────────────────────────

function VoteBarChart({ candidates }: { candidates: Candidate[] }) {
    const data = candidates.map((c, i) => ({
        name: c.name.length > 12 ? c.name.substring(0, 12) + "…" : c.name,
        fullName: c.name,
        suara: c.voteCount,
        fill: CHART_COLORS[i % CHART_COLORS.length],
    }));

    return (
        <ResponsiveContainer width="100%" height={260}>
            <BarChart
                data={data}
                margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                barCategoryGap="30%"
            >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                    dataKey="name"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                    tickLine={false}
                />
                <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="suara" radius={[6, 6, 0, 0]}>
                    {data.map((entry, index) => (
                        <Cell key={`bar-cell-${index}`} fill={entry.fill} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ResultsPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [activeTab, setActiveTab] = useState<"chart" | "ranking">("ranking");
    const fetchResultsSeq = useRef(0);

    // Refetch when tab becomes visible
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === "visible") setRefreshKey((k) => k + 1);
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, []);

    // ── Fetch session list ──────────────────────────────────────────────────
    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const response = await publicApiFetch("/api/read-model/sessions");
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || !payload.success) {
                    throw new Error(payload.error || "Gagal memuat daftar sesi");
                }

                const formattedSessions = (payload.sessions || []) as Session[];
                setSessions(formattedSessions);
                if (formattedSessions.length > 0) {
                    setSelectedSessionId((current) => current ?? formattedSessions[0].id);
                }
            } catch (err) {
                console.error("Error fetching sessions:", err);
                toast.error(err instanceof Error ? err.message : "Gagal memuat daftar sesi");
            }
        };
        fetchSessions();
    }, [refreshKey]);

    const fetchResults = useCallback(async () => {
        if (selectedSessionId === null) return;

        setLoading(true);
        const seq = ++fetchResultsSeq.current;

        try {
            const response = await publicApiFetch(`/api/read-model/sessions/${selectedSessionId}/results`);
            const payload = await response.json().catch(() => ({}));
            if (seq !== fetchResultsSeq.current) return;

            if (!response.ok || !payload.success) {
                throw new Error(payload.error || "Gagal memuat hasil pemilihan");
            }

            const candidatesWithStats = (payload.candidates || []) as Candidate[];
            if (seq !== fetchResultsSeq.current) return;
            setCandidates(candidatesWithStats);
        } catch (err) {
            if (seq !== fetchResultsSeq.current) return;
            console.error("Error fetching results:", err);
            toast.error(err instanceof Error ? err.message : "Gagal memuat hasil pemilihan");
        } finally {
            if (seq === fetchResultsSeq.current) {
                setLoading(false);
            }
        }
    }, [selectedSessionId]);

    // Run when session changes
    useEffect(() => {
        fetchResults();
    }, [fetchResults, refreshKey]);

    // ── Real-time updates via Socket.io ────────────────────────────────────
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
            console.log("🟢 Connected to Real-time Voting Updates");
            join();
        });
        socket.on("connect_error", (err) => {
            console.error("Socket results connect error:", err);
        });
        socket.on("error", (err) => {
            console.error("Socket results error:", err);
        });

        socket.on("vote_update", (data: any) => {
            if (selectedSessionId != null && Number(data.sessionId) !== selectedSessionId) return;
            setTimeout(() => {
                setRefreshKey((prev) => prev + 1);
            }, 1500);
        });

        socket.on("session_update", (data: any) => {
            if (selectedSessionId != null && Number(data.sessionId) !== selectedSessionId) return;
            setRefreshKey((prev) => prev + 1);
        });

        socket.on("candidate_added", (data: any) => {
            if (selectedSessionId != null && Number(data.sessionId) !== selectedSessionId) return;
            fetchResults();
        });

        socket.on("session_created", () => {
            console.log("🚀 Sesi baru dibuat, menyegarkan daftar sesi...");
            setRefreshKey((prev) => prev + 1);
        });

        if (socket.connected) join();

        return () => {
            socket.disconnect();
        };
    }, [selectedSessionId, fetchResults]);

    // ── Helper ─────────────────────────────────────────────────────────────
    const getSessionStatus = (
        startTime: number,
        endTime: number,
        isActive: boolean
    ) => {
        const now = Math.floor(Date.now() / 1000);
        if (!isActive) return { text: "Selesai", color: "text-red-400" };
        if (now < startTime) return { text: "Akan Datang", color: "text-yellow-400" };
        if (now > endTime) return { text: "Berakhir", color: "text-red-400" };
        return { text: "Aktif", color: "text-green-400" };
    };

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-dark-900 pt-20 px-4 pb-12">
            <div className="max-w-6xl mx-auto">

                {/* ── Header ── */}
                <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-400">
                    Hasil Pemilihan{" "}
                    <span className="text-sm font-normal text-gray-500 ml-1">(Live)</span>
                </h1>


                {/* ── Mobile: Session scroll tabs ── */}
                <div className="lg:hidden mb-5">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                        Pilih Sesi
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {sessions.map((session) => (
                            <button
                                key={session.id}
                                onClick={() => setSelectedSessionId(session.id)}
                                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${selectedSessionId === session.id
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                                    }`}
                            >
                                {session.name}
                            </button>
                        ))}
                        {sessions.length === 0 && (
                            <p className="text-gray-500 text-sm py-2">Belum ada sesi.</p>
                        )}
                    </div>
                </div>

                {/* ── Main grid: sidebar + content ── */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                    {/* Desktop Sidebar */}
                    <div className="hidden lg:block lg:col-span-1 space-y-2">
                        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                            Pilih Sesi
                        </h2>
                        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                            {sessions.map((session) => (
                                <button
                                    key={session.id}
                                    onClick={() => setSelectedSessionId(session.id)}
                                    className={`w-full text-left p-3 rounded-xl transition-all ${selectedSessionId === session.id
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                                        : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                                        }`}
                                >
                                    <h3 className="font-bold truncate text-sm">{session.name}</h3>
                                    <div className="flex justify-between items-center mt-1 text-xs">
                                        <span
                                            className={
                                                getSessionStatus(
                                                    session.startTime,
                                                    session.endTime,
                                                    session.isActive
                                                ).color
                                            }
                                        >
                                            {
                                                getSessionStatus(
                                                    session.startTime,
                                                    session.endTime,
                                                    session.isActive
                                                ).text
                                            }
                                        </span>
                                        <span className="opacity-60">ID: {session.id}</span>
                                    </div>
                                </button>
                            ))}
                            {sessions.length === 0 && (
                                <p className="text-gray-500 text-center py-4 text-sm">
                                    Belum ada sesi.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="lg:col-span-3">
                        {selectedSessionId ? (
                            <div className="bg-white/5 rounded-2xl p-4 sm:p-6 border border-white/10 backdrop-blur-sm">

                                {/* Session title + status */}
                                <div className="mb-5">
                                    <h2 className="text-lg sm:text-2xl font-bold text-white">
                                        {sessions.find((s) => s.id === selectedSessionId)?.name}
                                    </h2>
                                    {(() => {
                                        const s = sessions.find((x) => x.id === selectedSessionId);
                                        if (!s) return null;
                                        const status = getSessionStatus(
                                            s.startTime,
                                            s.endTime,
                                            s.isActive
                                        );
                                        return (
                                            <p className={`text-sm mt-0.5 ${status.color}`}>
                                                {status.text}
                                            </p>
                                        );
                                    })()}
                                </div>

                                {/* ── Tab Toggle ── */}
                                <div className="flex gap-2 mb-5">
                                    <button
                                        onClick={() => setActiveTab("ranking")}
                                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "ranking"
                                            ? "bg-blue-600 text-white"
                                            : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                                            }`}
                                    >
                                        🏆 Peringkat
                                    </button>
                                    <button
                                        onClick={() => setActiveTab("chart")}
                                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "chart"
                                            ? "bg-purple-600 text-white"
                                            : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                                            }`}
                                    >
                                        📈 Grafik
                                    </button>
                                </div>

                                {loading && candidates.length === 0 ? (
                                    <p className="text-center text-gray-400 py-10">
                                        Memuat hasil...
                                    </p>
                                ) : candidates.length === 0 ? (
                                    <div className="text-center py-10">
                                        <p className="text-gray-500">
                                            Belum ada kandidat di sesi ini.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {/* ── TAB: Ranking ── */}
                                        {activeTab === "ranking" && (
                                            <div className="space-y-4 animate-fade-in">
                                                {candidates.map((c, index) => (
                                                    <div
                                                        key={c.id}
                                                        className="glass-panel p-4 sm:p-5 rounded-xl relative overflow-hidden group hover:border-blue-500/30 transition-all"
                                                    >
                                                        {/* Background fill */}
                                                        <div
                                                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-600/10 to-blue-400/5 transition-all duration-1000 ease-out"
                                                            style={{ width: `${c.percentage}%` }}
                                                        />
                                                        <div className="relative z-10 flex flex-wrap items-center gap-3">
                                                            {/* Rank badge */}
                                                            <div
                                                                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-base shrink-0 ${index === 0
                                                                    ? "bg-yellow-500/20 text-yellow-400"
                                                                    : index === 1
                                                                        ? "bg-gray-400/20 text-gray-300"
                                                                        : index === 2
                                                                            ? "bg-orange-500/20 text-orange-400"
                                                                            : "bg-white/5 text-gray-600"
                                                                    }`}
                                                            >
                                                                {index === 0
                                                                    ? "🥇"
                                                                    : index === 1
                                                                        ? "🥈"
                                                                        : index === 2
                                                                            ? "🥉"
                                                                            : index + 1}
                                                            </div>

                                                            {/* Photo */}
                                                            {c.photoUrl && (
                                                                <Image
                                                                    src={getValidImageUrl(c.photoUrl) || FALLBACK_CANDIDATE_IMAGE}
                                                                    alt={c.name}
                                                                    width={44}
                                                                    height={44}
                                                                    className="w-11 h-11 rounded-full object-cover border border-white/10 shrink-0"
                                                                    unoptimized
                                                                />
                                                            )}

                                                            {/* Name + votes */}
                                                            <div className="flex-1 min-w-0">
                                                                <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                                                                    {c.name}
                                                                </h3>
                                                                <p className="text-xs text-gray-400">
                                                                    {c.voteCount} suara
                                                                </p>
                                                            </div>

                                                            {/* Percentage */}
                                                            <div className="text-right shrink-0">
                                                                <div className="text-2xl sm:text-3xl font-bold text-blue-400">
                                                                    {c.percentage}%
                                                                </div>
                                                                <div className="text-xs text-gray-500 uppercase tracking-widest">
                                                                    dari total
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Progress bar */}
                                                        <div className="relative z-10 mt-3">
                                                            <div className="w-full bg-white/5 rounded-full h-1.5">
                                                                <div
                                                                    className="bg-gradient-to-r from-blue-500 to-blue-400 h-1.5 rounded-full transition-all duration-1000"
                                                                    style={{ width: `${c.percentage}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* ── TAB: Grafik ── */}
                                        {activeTab === "chart" && (
                                            <div className="space-y-6 animate-fade-in">
                                                {/* Pie Chart */}
                                                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 text-center">
                                                        Distribusi Suara
                                                    </h3>
                                                    <VotePieChart candidates={candidates} />
                                                </div>

                                                {/* Bar Chart */}
                                                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 text-center">
                                                        Perbandingan Suara
                                                    </h3>
                                                    <VoteBarChart candidates={candidates} />
                                                </div>

                                                {/* Legend / Summary table */}
                                                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                                                        Ringkasan
                                                    </h3>
                                                    <div className="space-y-2">
                                                        {candidates.map((c, i) => (
                                                            <div
                                                                key={c.id}
                                                                className="flex items-center gap-3"
                                                            >
                                                                <div
                                                                    className="w-3 h-3 rounded-full shrink-0"
                                                                    style={{
                                                                        backgroundColor:
                                                                            CHART_COLORS[i % CHART_COLORS.length],
                                                                    }}
                                                                />
                                                                <span className="flex-1 text-sm text-gray-300 truncate">
                                                                    {c.name}
                                                                </span>
                                                                <span className="text-sm font-bold text-white">
                                                                    {c.voteCount}
                                                                </span>
                                                                <span className="text-sm text-gray-400 w-14 text-right">
                                                                    {c.percentage}%
                                                                </span>
                                                            </div>
                                                        ))}
                                                        <div className="border-t border-white/10 mt-3 pt-3 flex items-center gap-3">
                                                            <div className="w-3 h-3 shrink-0" />
                                                            <span className="flex-1 text-sm text-gray-400 font-semibold">
                                                                Total
                                                            </span>
                                                            <span className="text-sm font-bold text-white">
                                                                {candidates.reduce((sum, c) => sum + c.voteCount, 0)}
                                                            </span>
                                                            <span className="text-sm text-gray-400 w-14 text-right">
                                                                100%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center min-h-[200px] text-gray-500 bg-white/5 rounded-2xl border border-white/5 p-8 text-center">
                                <p className="text-lg">Pilih sesi untuk melihat hasil.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
