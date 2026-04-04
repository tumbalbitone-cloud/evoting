"use client";

import type { Session, SessionStats } from "./types";
import { formatTime, getAdminSessionStatus, getAdminSessionStatusColor } from "./adminFormat";
import { StatCard } from "./StatCard";
import { ParticipationMeter } from "./ParticipationMeter";

export function MonitorSessionsTab({
    sessions,
    detailSessionId,
    stats,
    onToggleSessionStatus,
    onFetchSessionStats,
    onCloseDetail,
}: {
    sessions: Session[];
    detailSessionId: number | null;
    stats: SessionStats;
    onToggleSessionStatus: (sessionId: number, currentStatus: boolean) => void;
    onFetchSessionStats: (sessionId: number) => void;
    onCloseDetail: () => void;
}) {
    return (
        <div className="glass-panel p-4 sm:p-6 rounded-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-white">Monitor Sesi</h2>
            </div>

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
                            <tr>
                                <td colSpan={5} className="p-4 text-center text-gray-500">
                                    Belum ada sesi
                                </td>
                            </tr>
                        ) : (
                            sessions.map((session) => (
                                <tr key={session.id} className="border-b border-gray-800 hover:bg-white/5">
                                    <td className="p-3 font-mono text-gray-400 text-sm">#{session.id}</td>
                                    <td className="p-3 font-bold text-white text-sm max-w-[150px]">
                                        <span className="block truncate" title={session.name}>
                                            {session.name}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <span
                                            className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${
                                                getAdminSessionStatusColor(getAdminSessionStatus(session))
                                            }`}
                                        >
                                            {getAdminSessionStatus(session)}
                                        </span>
                                    </td>
                                    <td className="p-3 text-xs text-gray-400 whitespace-nowrap">
                                        <div>▶ {formatTime(session.startTime)}</div>
                                        <div>⏹ {formatTime(session.endTime)}</div>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center gap-2">
                                            {getAdminSessionStatus(session) !== "BERAKHIR" && (
                                                <button
                                                    type="button"
                                                    onClick={() => onToggleSessionStatus(session.id, session.isActive)}
                                                    className={`px-3 py-1.5 rounded text-xs font-bold transition whitespace-nowrap ${
                                                        session.isActive
                                                            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                                            : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                                    }`}
                                                >
                                                    {session.isActive ? "STOP" : "START"}
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => onFetchSessionStats(session.id)}
                                                className={`px-3 py-1.5 rounded text-xs font-bold transition whitespace-nowrap ${
                                                    detailSessionId === session.id
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

            <div className="sm:hidden space-y-3">
                {sessions.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">Belum ada sesi</p>
                ) : (
                    sessions.map((session) => (
                        <div key={session.id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                            <div className="flex items-start justify-between gap-2 mb-3">
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-white text-sm truncate" title={session.name}>
                                        {session.name}
                                    </p>
                                    <p className="text-gray-500 text-xs font-mono mt-0.5">ID: #{session.id}</p>
                                </div>
                                <span
                                    className={`flex-shrink-0 px-2 py-1 rounded text-xs font-bold ${
                                        getAdminSessionStatusColor(getAdminSessionStatus(session))
                                    }`}
                                >
                                    {getAdminSessionStatus(session)}
                                </span>
                            </div>
                            <div className="text-xs text-gray-400 space-y-0.5 mb-3">
                                <div>▶ Mulai: {formatTime(session.startTime)}</div>
                                <div>⏹ Akhir: {formatTime(session.endTime)}</div>
                            </div>
                            <div className="flex gap-2">
                                {getAdminSessionStatus(session) !== "BERAKHIR" && (
                                    <button
                                        type="button"
                                        onClick={() => onToggleSessionStatus(session.id, session.isActive)}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                                            session.isActive
                                                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20"
                                                : "bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/20"
                                        }`}
                                    >
                                        {session.isActive ? "⏹ Hentikan" : "▶ Aktifkan"}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => onFetchSessionStats(session.id)}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition border ${
                                        detailSessionId === session.id
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

            {detailSessionId !== null && (
                <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-400">
                            Statistik Sesi #{detailSessionId}
                            {" — "}
                            <span className="text-white">
                                {sessions.find((s) => s.id === detailSessionId)?.name}
                            </span>
                        </p>
                        <button
                            type="button"
                            onClick={onCloseDetail}
                            className="text-gray-500 hover:text-white text-sm transition"
                        >
                            ✕ Tutup
                        </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <StatCard
                            icon="🏛️"
                            label="Pemilih Terdaftar"
                            value={stats.totalNFTHolders}
                            sub={stats.registeredLabel}
                            color="blue"
                            loading={stats.loading}
                        />
                        <StatCard
                            icon="✅"
                            label="Sudah Memilih"
                            value={stats.uniqueVoterCount}
                            sub="Dari sesi ini"
                            color="green"
                            loading={stats.loading}
                        />
                        <div className="col-span-2 sm:col-span-1">
                            <StatCard
                                icon="📊"
                                label="Partisipasi"
                                value={`${stats.participationRate}%`}
                                sub="Voter aktif / Terdaftar"
                                color={
                                    Number(stats.participationRate) >= 70
                                        ? "green"
                                        : Number(stats.participationRate) >= 40
                                          ? "blue"
                                          : "amber"
                                }
                                loading={stats.loading}
                            />
                        </div>
                    </div>
                    <ParticipationMeter
                        rate={Number(stats.participationRate)}
                        loading={stats.loading}
                        denominatorLabel={stats.registeredLabel}
                    />
                </div>
            )}
        </div>
    );
}
