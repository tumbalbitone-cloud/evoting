"use client";

import React from "react";
import Link from "next/link";
import { useWallet } from "../context/WalletContext";

const Navbar = () => {
    const { account, connectWallet, isConnected, walletBlocked } = useWallet();
    const [isAdmin, setIsAdmin] = React.useState(false);
    const [isLoggedIn, setIsLoggedIn] = React.useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

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

    const closeMobileMenu = () => setIsMobileMenuOpen(false);

    const navLinks = [
        { href: "/", label: "Beranda" },
        // { href: "/about", label: "About" },
        ...(isAdmin ? [{ href: "/admin", label: "Dasbor Admin", className: "text-purple-300 hover:text-purple-400" }] : []),
        { href: "/bind-wallet", label: "Tautkan Wallet" },
        { href: "/vote", label: "Voting" },
        { href: "/history", label: "Riwayat" },
        { href: "/results", label: "Hasil" },
    ];

    return (
        <nav className="fixed top-0 w-full z-50 glass-panel border-b border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <div className="flex items-center flex-shrink-0">
                        <Link href="/" className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                            E-Voting DID
                        </Link>
                    </div>

                    {/* Desktop Navigation */}
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-1">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`px-3 py-2 rounded-md text-sm font-medium transition ${link.className ?? "hover:text-blue-400"}`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Right side: wallet + profile/login */}
                    <div className="hidden md:flex items-center gap-3 flex-shrink-0">
                        {isLoggedIn ? (
                            <>
                                <button
                                    onClick={connectWallet}
                                    disabled={walletBlocked}
                                    className={`px-4 py-2 rounded-full font-semibold transition-all duration-300 text-sm whitespace-nowrap ${isConnected
                                        ? "bg-green-500/10 text-green-400 border border-green-500/30"
                                        : "bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                        }`}
                                >
                                    {isConnected ? `${account?.slice(0, 6)}...${account?.slice(-4)}` : "Hubungkan Wallet"}
                                </button>
                                <Link
                                    href="/profile"
                                    className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all flex-shrink-0"
                                >
                                    {localStorage.getItem("username")?.charAt(0).toUpperCase() || "U"}
                                </Link>
                            </>
                        ) : (
                            <Link href="/login" className="px-4 py-2 rounded-full border border-white/10 hover:bg-white/5 transition text-sm">
                                Login
                            </Link>
                        )}
                    </div>

                    {/* Mobile: right side */}
                    <div className="flex md:hidden items-center gap-2">
                        {isLoggedIn && (
                            <Link
                                href="/profile"
                                className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-lg flex-shrink-0"
                            >
                                {localStorage.getItem("username")?.charAt(0).toUpperCase() || "U"}
                            </Link>
                        )}
                        {/* Hamburger Button */}
                        <button
                            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                            className="p-2 rounded-md text-gray-300 hover:text-white hover:bg-white/10 transition-all focus:outline-none"
                            aria-label="Buka/tutup menu"
                        >
                            {isMobileMenuOpen ? (
                                // X icon
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            ) : (
                                // Hamburger icon
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Dropdown Menu */}
            {isMobileMenuOpen && (
                <div className="md:hidden border-t border-white/10 bg-slate-900/95 backdrop-blur-lg">
                    <div className="px-4 py-3 space-y-1">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={closeMobileMenu}
                                className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all hover:bg-white/5 ${link.className ?? "text-gray-300 hover:text-blue-400"}`}
                            >
                                {link.label}
                            </Link>
                        ))}

                        {/* Wallet connect in mobile menu */}
                        <div className="pt-2 border-t border-white/10">
                            {isLoggedIn ? (
                                <button
                                    onClick={() => { connectWallet(); closeMobileMenu(); }}
                                    disabled={walletBlocked}
                                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all ${isConnected
                                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                        : "bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                        }`}
                                >
                                    {isConnected
                                        ? `✓ ${account?.slice(0, 8)}...${account?.slice(-6)}`
                                        : "🔗 Hubungkan Wallet"
                                    }
                                </button>
                            ) : (
                                <Link
                                    href="/login"
                                    onClick={closeMobileMenu}
                                    className="block px-4 py-3 rounded-lg border border-white/10 text-sm font-medium text-center hover:bg-white/5 transition"
                                >
                                    Login
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
