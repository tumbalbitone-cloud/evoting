"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "../../context/WalletContext";
import Link from "next/link";

export default function ProfilePage() {
    const [username, setUsername] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const { account, isConnected, connectWallet, disconnectWallet } = useWallet(); // Assuming disconnectWallet exists or we just clear local state 
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem("token");
        const storedUsername = localStorage.getItem("username");
        const storedRole = localStorage.getItem("role");

        if (!token || !storedUsername) {
            router.push("/login"); // Redirect if not logged in
            return;
        }

        setUsername(storedUsername);
        setRole(storedRole);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("role");
        localStorage.removeItem("username");
        window.dispatchEvent(new Event("auth-change"));
        router.push("/");
    };

    if (!username) return null;

    return (
        <div className="min-h-screen bg-dark-900 pt-20 px-4">
            <div className="max-w-2xl mx-auto space-y-8">

                {/* Profile Header */}
                <div className="bg-white/5 p-8 rounded-2xl backdrop-blur-xl border border-white/10 flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-3xl font-bold text-white mb-4 shadow-lg shadow-purple-500/30">
                        {username.charAt(0).toUpperCase()}
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-1">{username}</h1>
                    <span className="px-3 py-1 rounded-full bg-white/10 text-white/60 text-sm uppercase tracking-wider">{role}</span>
                </div>

                {/* Account Details */}
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Wallet Status */}
                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                        <h2 className="text-xl font-semibold text-white mb-4">Wallet Connection</h2>
                        {isConnected ? (
                            <div className="space-y-4">
                                <div className="p-3 bg-green-500/20 text-green-200 rounded-xl border border-green-500/30 text-sm break-all font-mono">
                                    ● Connected: {account}
                                </div>
                                <Link href="/bind-wallet" className="block w-full text-center py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition text-sm">
                                    Manage Wallet Binding &rarr;
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-white/60 text-sm">No wallet connected.</p>
                                <button
                                    onClick={connectWallet}
                                    className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition text-sm"
                                >
                                    Connect Wallet
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10 flex flex-col justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-white mb-4">Actions</h2>
                            <div className="space-y-3">
                                <Link href="/vote" className="block w-full text-center py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 transition text-sm">
                                    Go to Voting Dashboard
                                </Link>
                                <Link href="/results" className="block w-full text-center py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 transition text-sm">
                                    View Results
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Logout */}
                <div className="text-center pt-8">
                    <button
                        onClick={handleLogout}
                        className="px-6 py-2 rounded-full border border-red-500/30 text-red-400 hover:bg-red-500/10 transition"
                    >
                        Log Out
                    </button>
                </div>

            </div>
        </div>
    );
}
