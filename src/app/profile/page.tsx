"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "../../context/WalletContext";
import { ethers } from "ethers";
import VotingArtifact from "../../contracts/VotingSystem.json";
import Link from "next/link";
import { authApiFetch } from "../../utils/api";
import { getStoredUsername, getStoredRole, clearAuth, isTokenExpired } from "../../utils/auth";
import { publicApiFetch } from "../../utils/api";

export default function ProfilePage() {
    const [username, setUsername] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [hasNft, setHasNft] = useState<boolean | null>(null);
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [passwordSuccess, setPasswordSuccess] = useState("");
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const { account, isConnected, connectWallet, disconnectWallet, provider, walletBlocked, walletBlockedMessage, isConnecting } = useWallet();
    const router = useRouter();

    useEffect(() => {
        const storedUsername = getStoredUsername();
        const storedRole = getStoredRole();

        // If no stored username, user is not logged in — redirect to login.
        // The actual token validity is enforced by the backend (httpOnly cookie).
        if (!storedUsername) {
            router.push("/login");
            return;
        }

        setUsername(storedUsername);
        setRole(storedRole);
    }, [router]);

    // Cek kepemilikan NFT
    useEffect(() => {
        const checkNft = async () => {
            if (!account || !provider) {
                setHasNft(false);
                return;
            }
            try {
                const contract = new ethers.Contract(
                    process.env.NEXT_PUBLIC_VOTING_SYSTEM_ADDRESS!,
                    VotingArtifact.abi,
                    provider
                );
                const balance = await contract.balanceOf(account);
                setHasNft(Number(balance) > 0);
            } catch {
                setHasNft(false);
            }
        };
        checkNft();
    }, [account, provider]);

    const handleLogout = async () => {
        try {
            // Ask the backend to invalidate the refresh token in DB and clear cookies
            await publicApiFetch("/api/auth/logout", { method: "POST" });
        } catch {
            // Even if the request fails, proceed with client-side cleanup
        } finally {
            clearAuth(); // clears role + username from localStorage
            window.dispatchEvent(new Event("auth-change"));
            router.push("/");
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError("");
        setPasswordSuccess("");

        if (newPassword !== confirmPassword) {
            setPasswordError("Password baru dan konfirmasi tidak cocok.");
            return;
        }

        if (newPassword.length < 6) {
            setPasswordError("Password baru minimal 6 karakter.");
            return;
        }

        setIsChangingPassword(true);
        try {
            const response = await authApiFetch("/api/auth/change-password", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setPasswordSuccess("Password berhasil diperbarui!");
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setTimeout(() => {
                    setShowPasswordForm(false);
                    setPasswordSuccess("");
                }, 3000);
            } else {
                setPasswordError(data.error || "Gagal memperbarui password");
            }
        } catch (error: any) {
            setPasswordError(error.message || "Terjadi kesalahan server");
        } finally {
            setIsChangingPassword(false);
        }
    };

    if (!username) return null;

    const isAdmin = role === "admin";

    const quickLinks = [
        { href: "/vote", label: "🗳️ Halaman Voting", color: "bg-blue-600/20 hover:bg-blue-600/30 text-blue-200" },
        { href: "/results", label: "📊 Lihat Hasil", color: "bg-purple-600/20 hover:bg-purple-600/30 text-purple-200" },
        { href: "/history", label: "📜 Riwayat Voting", color: "bg-green-600/20 hover:bg-green-600/30 text-green-200" },
        ...(isAdmin ? [{ href: "/admin", label: "⚙️ Dasbor Admin", color: "bg-orange-600/20 hover:bg-orange-600/30 text-orange-200" }] : []),
    ];

    return (
        <div className="min-h-screen bg-dark-900 pt-20 px-4 pb-12">
            <div className="max-w-2xl mx-auto space-y-5">

                {/* Profile Header */}
                <div className="bg-white/5 p-6 sm:p-8 rounded-2xl backdrop-blur-xl border border-white/10 flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-3xl font-bold text-white mb-4 shadow-lg shadow-purple-500/30">
                        {username.charAt(0).toUpperCase()}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{username}</h1>
                    <span className={`px-3 py-1 rounded-full text-xs uppercase tracking-wider font-semibold mt-1 ${isAdmin
                        ? "bg-orange-500/20 text-orange-300 border border-orange-500/20"
                        : "bg-white/10 text-white/60 border border-white/10"
                        }`}>
                        {isAdmin ? "👑 Admin" : "🎓 Mahasiswa"}
                    </span>
                </div>

                {/* Info NIM & NFT */}
                <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/10">
                        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Informasi Akun</h2>
                    </div>
                    <div className="divide-y divide-white/10">
                        <div className="flex items-center justify-between px-5 py-3.5">
                            <span className="text-gray-400 text-sm">NIM / Username</span>
                            <span className="text-white font-mono text-sm font-semibold">{username}</span>
                        </div>
                        <div className="flex items-center justify-between px-5 py-3.5">
                            <span className="text-gray-400 text-sm">Role</span>
                            <span className="text-white text-sm capitalize">{role}</span>
                        </div>
                        <div className="flex items-center justify-between px-5 py-3.5">
                            <span className="text-gray-400 text-sm">Status NFT</span>
                            {hasNft === null ? (
                                <span className="text-gray-500 text-sm">Mengecek...</span>
                            ) : hasNft ? (
                                <span className="flex items-center gap-1.5 text-green-400 text-sm font-semibold">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Student NFT Aktif
                                </span>
                            ) : (
                                <Link href="/bind-wallet" className="flex items-center gap-1.5 text-yellow-400 hover:text-yellow-300 text-sm font-semibold transition">
                                    ⚠️ Belum Punya NFT →
                                </Link>
                            )}
                        </div>
                    </div>
                </div>

                {/* Wallet Status */}
                <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/10">
                        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Wallet</h2>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                        {isConnected ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                                    <span className="text-green-300 text-xs font-mono break-all">{account}</span>
                                </div>
                                <button
                                    onClick={disconnectWallet}
                                    className="w-full py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition text-sm border border-red-500/20"
                                >
                                    Putuskan Wallet
                                </button>
                            </>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-gray-500 shrink-0" />
                                    <span className="text-gray-400 text-sm">Tidak ada wallet yang terhubung.</span>
                                </div>
                                <button
                                    onClick={connectWallet}
                                    disabled={walletBlocked || isConnecting}
                                    className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition text-sm"
                                >
                                    {isConnecting ? "Menghubungkan..." : "Hubungkan Wallet"}
                                </button>
                                {walletBlockedMessage && (
                                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                        {walletBlockedMessage}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Links */}
                <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/10">
                        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Menu Cepat</h2>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {quickLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`block text-center py-2.5 rounded-xl text-sm font-semibold transition ${link.color}`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Change Password Section */}
                <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                    <div
                        className="px-5 py-4 flex justify-between items-center cursor-pointer hover:bg-white/5 transition"
                        onClick={() => setShowPasswordForm(!showPasswordForm)}
                    >
                        <h2 className="text-sm font-semibold text-gray-400 tracking-wider flex items-center gap-2">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                            Ubah Password
                        </h2>
                        <svg
                            className={`w-5 h-5 text-gray-400 transform transition-transform duration-200 ${showPasswordForm ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>

                    {showPasswordForm && (
                        <div className="p-5 border-t border-white/5 bg-black/20">
                            <form onSubmit={handleChangePassword} className="space-y-4">
                                {passwordError && (
                                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                        {passwordError}
                                    </div>
                                )}
                                {passwordSuccess && (
                                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                                        {passwordSuccess}
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-400">Password Saat Ini</label>
                                    <input
                                        type="password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        className="w-full bg-dark-800/50 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all text-sm"
                                        placeholder="Masukkan password saat ini"
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-400">Password Baru</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full bg-dark-800/50 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all text-sm"
                                        placeholder="Min. 6 karakter"
                                        required
                                        minLength={6}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-400">Konfirmasi Password Baru</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-dark-800/50 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all text-sm"
                                        placeholder="Ulangi password baru"
                                        required
                                        minLength={6}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isChangingPassword}
                                    className="w-full py-2.5 mt-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
                                >
                                    {isChangingPassword ? "Memperbarui..." : "Simpan Password Baru"}
                                </button>
                            </form>
                        </div>
                    )}
                </div>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    className="w-full py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition text-sm font-semibold"
                >
                    Keluar dari Akun
                </button>

            </div>
        </div>
    );
}
