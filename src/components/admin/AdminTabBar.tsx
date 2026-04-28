"use client";

import type { AdminTab } from "./types";

export function AdminTabBar({
    activeTab,
    onTabChange,
}: {
    activeTab: AdminTab;
    onTabChange: (tab: AdminTab) => void;
}) {
    const btn = (tab: AdminTab, label: string, activeClass: string) => (
        <button
            type="button"
            onClick={() => onTabChange(tab)}
            className={`px-4 sm:px-6 py-2 rounded-lg text-sm sm:text-base font-semibold transition-all whitespace-nowrap ${
                activeTab === tab ? `${activeClass} shadow-lg text-white` : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="flex justify-center mb-8">
            <div className="bg-white/5 backdrop-blur-md p-1 rounded-xl border border-white/10 inline-flex shadow-lg overflow-x-auto max-w-full">
                {btn("monitor", "📊 Monitor Sesi", "bg-blue-600")}
                {btn("manage", "⚙️ Manajemen Sesi", "bg-purple-600")}
                {btn("users", "👥 Pengguna", "bg-emerald-600")}
                {btn("admin-management", "🛡️ Kelola Admin", "bg-orange-600")}
            </div>
        </div>
    );
}
