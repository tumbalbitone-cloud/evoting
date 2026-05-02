"use client";

import { useEffect, useState } from "react";
import type { AdminAccount } from "./types";

export function AdminManagementTab({
    onCreateAdmin,
    loading,
}: {
    onCreateAdmin: (username: string, name: string, password: string, walletAddress: string) => Promise<void>;
    loading: boolean;
}) {
    const [adminList, setAdminList] = useState<AdminAccount[]>([]);
    const [listLoading, setListLoading] = useState(false);
    const [listError, setListError] = useState<string | null>(null);

    const [username, setUsername] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [walletAddress, setWalletAddress] = useState("");
    const [formError, setFormError] = useState<string | null>(null);
    const [formSuccess, setFormSuccess] = useState<string | null>(null);

    const fetchAdmins = async () => {
        setListLoading(true);
        setListError(null);
        try {
            const { authApiFetch } = await import("../../utils/api");
            const res = await authApiFetch("/api/users/admins", { method: "GET" });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Gagal memuat daftar admin");
            }
            setAdminList(data.admins as AdminAccount[]);
        } catch (err: unknown) {
            setListError(err instanceof Error ? err.message : "Gagal memuat daftar admin");
        }
        setListLoading(false);
    };

    useEffect(() => {
        fetchAdmins();
    }, []);

    const handleSubmit = async () => {
        setFormError(null);
        setFormSuccess(null);

        if (!username.trim() || !name.trim() || !password) {
            setFormError("Semua field wajib diisi");
            return;
        }
        if (password !== confirmPassword) {
            setFormError("Konfirmasi password tidak cocok");
            return;
        }
        if (password.length < 8) {
            setFormError("Password minimal 8 karakter");
            return;
        }

        try {
            await onCreateAdmin(username.trim(), name.trim(), password, walletAddress.trim());
            setFormSuccess(`Admin "${name.trim()}" berhasil ditambahkan`);
            setUsername("");
            setName("");
            setPassword("");
            setConfirmPassword("");
            setWalletAddress("");
            fetchAdmins();
        } catch (err: unknown) {
            setFormError(err instanceof Error ? err.message : "Gagal membuat admin");
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in zoom-in-95 duration-200 mt-4">
            {/* Form Tambah Admin */}
            <div className="glass-panel p-6 rounded-xl">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center text-xl">
                        🛡️
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Tambah Admin Baru</h2>
                        <p className="text-xs text-gray-400">Buat akun dengan hak akses penuh dasbor admin</p>
                    </div>
                </div>

                {formError && (
                    <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-2">
                        <span className="mt-0.5">⚠️</span>
                        <span>{formError}</span>
                    </div>
                )}
                {formSuccess && (
                    <div className="mb-4 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-start gap-2">
                        <span className="mt-0.5">✅</span>
                        <span>{formSuccess}</span>
                    </div>
                )}

                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">
                            Username Admin
                        </label>
                        <input
                            type="text"
                            id="new-admin-username"
                            placeholder="Contoh: admin_budi"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-orange-500 text-white text-sm transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">
                            Nama Lengkap
                        </label>
                        <input
                            type="text"
                            id="new-admin-name"
                            placeholder="Nama Admin"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-orange-500 text-white text-sm transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">
                            Password (min. 8 karakter)
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                id="new-admin-password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:border-orange-500 text-white text-sm transition-colors"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs transition-colors"
                            >
                                {showPassword ? "🙈" : "👁️"}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">
                            Konfirmasi Password
                        </label>
                        <input
                            type={showPassword ? "text" : "password"}
                            id="new-admin-confirm-password"
                            placeholder="Ulangi Password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-orange-500 text-white text-sm transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">
                            Wallet Address (Opsional)
                        </label>
                        <input
                            type="text"
                            id="new-admin-wallet"
                            placeholder="0x..."
                            value={walletAddress}
                            onChange={(e) => setWalletAddress(e.target.value)}
                            className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-orange-500 text-white text-sm transition-colors"
                        />
                        <p className="text-[10px] text-gray-500 mt-1">Dibutuhkan jika admin ini akan membuat sesi pemilihan di blockchain.</p>
                    </div>
                </div>

                <button
                    type="button"
                    id="btn-create-admin"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full mt-5 py-3 rounded-lg font-bold transition-all bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-900/30"
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            Membuat Admin...
                        </span>
                    ) : (
                        "🛡️ Tambah Admin"
                    )}
                </button>

                <p className="text-xs text-gray-500 mt-3 text-center">
                    Admin baru akan dapat mengakses seluruh fitur dasbor admin.
                </p>
            </div>

            {/* Daftar Admin */}
            <div className="glass-panel p-6 rounded-xl">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-xl">
                            👥
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Daftar Admin</h2>
                            <p className="text-xs text-gray-400">{adminList.length} admin terdaftar</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={fetchAdmins}
                        disabled={listLoading}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all border border-white/10"
                    >
                        {listLoading ? "⏳" : "🔄"} Refresh
                    </button>
                </div>

                {listError && (
                    <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                        ⚠️ {listError}
                    </div>
                )}

                {listLoading ? (
                    <div className="flex items-center justify-center py-12 text-gray-500">
                        <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Memuat daftar admin...
                    </div>
                ) : adminList.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <p className="text-3xl mb-2">🔍</p>
                        <p className="text-sm">Belum ada data admin</p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                        {adminList.map((admin, index) => (
                            <div
                                key={admin.id}
                                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                            >
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                                    {index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-semibold text-sm truncate">{admin.name}</p>
                                    <p className="text-gray-400 text-xs font-mono truncate">@{admin.username}</p>
                                </div>
                                <span
                                    className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold ${
                                        admin.active
                                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                            : "bg-red-500/20 text-red-300 border border-red-500/30"
                                    }`}
                                >
                                    {admin.active ? "Aktif" : "Nonaktif"}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
