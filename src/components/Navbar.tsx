"use client";

import React from "react";
import Link from "next/link";
import { useWallet } from "../context/WalletContext";

const Navbar = () => {
    const { account, connectWallet, isConnected } = useWallet();
    const [isAdmin, setIsAdmin] = React.useState(false);
    const [isLoggedIn, setIsLoggedIn] = React.useState(false);

    const syncAuthState = React.useCallback(() => {
        const token = localStorage.getItem("token");
        const username = localStorage.getItem("username");
        const role = localStorage.getItem("role");
        setIsLoggedIn(!!token && !!username);
        setIsAdmin(role === "admin");
    }, []);

    React.useEffect(() => {
        syncAuthState();
        const onAuthChange = () => syncAuthState();
        window.addEventListener("auth-change", onAuthChange);
        return () => window.removeEventListener("auth-change", onAuthChange);
    }, [syncAuthState]);

    return (
        <nav className="fixed top-0 w-full z-50 glass-panel border-b border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <Link href="/" className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                            E-Voting DID
                        </Link>
                    </div>
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-4">
                            <Link href="/" className="hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium transition">
                                Home
                            </Link>
                            <Link href="/about" className="hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium transition">
                                About
                            </Link>
                            {isAdmin && (
                                <Link href="/admin" className="hover:text-purple-400 px-3 py-2 rounded-md text-sm font-medium transition text-purple-300">
                                    Admin Dashboard
                                </Link>
                            )}
                            <Link href="/bind-wallet" className="hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium transition">
                                Bind Wallet
                            </Link>
                            <Link href="/vote" className="hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium transition">
                                Vote
                            </Link>
                            <Link href="/history" className="hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium transition">
                                History
                            </Link>
                            <Link href="/results" className="hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium transition">
                                Results
                            </Link>
                        </div>
                    </div>
                    <div>
                        {isLoggedIn ? (
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={connectWallet}
                                    className={`px-4 py-2 rounded-full font-semibold transition-all duration-300 text-sm ${isConnected
                                        ? "bg-green-500/10 text-green-400 border border-green-500/30"
                                        : "bg-blue-600/20 text-blue-300 hover:bg-blue-600/30"
                                        }`}
                                >
                                    {isConnected ? `${account?.slice(0, 6)}...` : "Connect Wallet"}
                                </button>
                                <Link href="/profile" className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all">
                                    {localStorage.getItem("username")?.charAt(0).toUpperCase() || "U"}
                                </Link>
                            </div>
                        ) : (
                            <Link href="/login" className="px-4 py-2 rounded-full border border-white/10 hover:bg-white/5 transition">
                                Login
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
