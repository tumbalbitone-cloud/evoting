"use client";

import React from "react";
import Link from "next/link";
import { useWallet } from "@/context/WalletContext";

type NavLink = {
  href: string;
  label: string;
  className?: string;
};

const BRAND_NAME = "E-Voting DID";
const DEFAULT_NAV_LINK_CLASS = "hover:text-blue-400";
const MOBILE_NAV_LINK_CLASS = "text-gray-300 hover:text-blue-400";

const getUserInitial = (username: string | null): string => {
  return username?.charAt(0).toUpperCase() || "U";
};

const getDesktopWalletLabel = (account: string | null, isConnected: boolean): string => {
  if (!isConnected || !account) {
    return "Hubungkan Wallet";
  }

  return `${account.slice(0, 6)}...${account.slice(-4)}`;
};

const getMobileWalletLabel = (account: string | null, isConnected: boolean): string => {
  if (!isConnected || !account) {
    return "🔗 Hubungkan Wallet";
  }

  return `✓ ${account.slice(0, 8)}...${account.slice(-6)}`;
};

const getWalletButtonClassName = (isConnected: boolean, isMobile = false): string => {
  const baseClassName = isMobile
    ? "w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all"
    : "px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-300";

  const stateClassName = isConnected
    ? isMobile
      ? "bg-green-500/10 text-green-400 border border-green-500/20"
      : "bg-green-500/10 text-green-400 border border-green-500/30"
    : "bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 disabled:cursor-not-allowed disabled:opacity-50";

  return `${baseClassName} ${stateClassName}`;
};

const buildNavLinks = (isAdmin: boolean): NavLink[] => {
  const links: NavLink[] = [{ href: "/", label: "Beranda" }];

  if (isAdmin) {
    links.push({
      href: "/admin",
      label: "Dasbor Admin",
      className: "text-purple-300 hover:text-purple-400",
    });
  } else {
    links.push({ href: "/bind-wallet", label: "Tautkan Wallet" });
  }

  links.push({ href: "/vote", label: "Voting" });

  if (!isAdmin) {
    links.push({ href: "/history", label: "Riwayat Voting" });
  }

  links.push({ href: "/results", label: "Hasil" });

  return links;
};

const Navbar = () => {
  const { account, connectWallet, isConnected, walletBlocked } = useWallet();
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [username, setUsername] = React.useState<string | null>(null);

  const syncAuthState = React.useCallback(() => {
    const role = localStorage.getItem("role");
    const storedUsername = localStorage.getItem("username");

    setUsername(storedUsername);
    setIsLoggedIn(Boolean(role && storedUsername));
    setIsAdmin(role === "admin");
  }, []);

  React.useEffect(() => {
    syncAuthState();

    const onAuthChange = () => syncAuthState();
    window.addEventListener("auth-change", onAuthChange);

    return () => window.removeEventListener("auth-change", onAuthChange);
  }, [syncAuthState]);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const navLinks = React.useMemo(() => buildNavLinks(isAdmin), [isAdmin]);
  const userInitial = getUserInitial(username);
  const desktopWalletLabel = getDesktopWalletLabel(account, isConnected);
  const mobileWalletLabel = getMobileWalletLabel(account, isConnected);

  return (
    <nav className="glass-panel fixed top-0 z-50 w-full border-b border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex flex-shrink-0 items-center">
            <Link
              href="/"
              className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-xl font-bold text-transparent"
            >
              {BRAND_NAME}
            </Link>
          </div>

          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition ${link.className ?? DEFAULT_NAV_LINK_CLASS}`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="hidden flex-shrink-0 items-center gap-3 md:flex">
            {isLoggedIn ? (
              <>
                <button
                  onClick={connectWallet}
                  disabled={walletBlocked}
                  className={getWalletButtonClassName(isConnected)}
                >
                  {desktopWalletLabel}
                </button>
                <Link
                  href="/profile"
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 font-bold text-white shadow-lg shadow-purple-500/30 transition-all hover:shadow-purple-500/50"
                >
                  {userInitial}
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-full border border-white/10 px-4 py-2 text-sm transition hover:bg-white/5"
              >
                Login
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            {isLoggedIn && (
              <Link
                href="/profile"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-sm font-bold text-white shadow-lg"
              >
                {userInitial}
              </Link>
            )}
            <button
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="rounded-md p-2 text-gray-300 transition-all hover:bg-white/10 hover:text-white focus:outline-none"
              aria-label="Buka/tutup menu"
            >
              {isMobileMenuOpen ? (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="border-t border-white/10 bg-slate-900/95 backdrop-blur-lg md:hidden">
          <div className="space-y-1 px-4 py-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMobileMenu}
                className={`block rounded-lg px-4 py-3 text-sm font-medium transition-all hover:bg-white/5 ${link.className ?? MOBILE_NAV_LINK_CLASS}`}
              >
                {link.label}
              </Link>
            ))}

            <div className="border-t border-white/10 pt-2">
              {isLoggedIn ? (
                <button
                  onClick={() => {
                    connectWallet();
                    closeMobileMenu();
                  }}
                  disabled={walletBlocked}
                  className={getWalletButtonClassName(isConnected, true)}
                >
                  {mobileWalletLabel}
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={closeMobileMenu}
                  className="block rounded-lg border border-white/10 px-4 py-3 text-center text-sm font-medium transition hover:bg-white/5"
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
