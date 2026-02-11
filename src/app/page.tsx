"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check login status on mount
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4 text-center">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent opacity-50 animate-pulse"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto space-y-8">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white to-blue-200">
          Decentralized Voting <br /> with Verifyable Identity
        </h1>

        <p className="text-lg md:text-xl text-blue-100/60 max-w-2xl mx-auto">
          Secure, transparent, and immutable voting for student organizations.
          Powered by Ethereum Blockchain and Polygon ID.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
          {isLoggedIn ? (
            <Link
              href="/profile"
              className="px-8 py-3 rounded-full bg-green-600 hover:bg-green-500 text-white font-semibold transition-all shadow-lg shadow-green-500/25 hover:shadow-green-500/40"
            >
              Go to Profile
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-8 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
            >
              Login / Get Started
            </Link>
          )}

          <a
            href="/about"
            className="px-8 py-3 rounded-full bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold transition-all backdrop-blur-sm"
          >
            Learn More
          </a>
        </div>
      </div>
    </div>
  );
}
