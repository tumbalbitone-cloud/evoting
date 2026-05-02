"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { getApiBaseUrl, publicApiFetch } from "../../utils/api";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await publicApiFetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                // Tokens are set as httpOnly cookies by the backend — no localStorage!
                // Only store non-sensitive UI state.
                localStorage.setItem("role", data.role);
                localStorage.setItem("username", data.username || data.studentId || "");
                window.dispatchEvent(new Event("auth-change"));

                if (data.role === "admin") {
                    router.push("/admin");
                } else {
                    router.push("/vote");
                }
            } else {
                const detailsMsg = Array.isArray(data.details)
                    ? data.details.map((d: any) => d.msg).join(", ")
                    : "";
                const errorMessage = data.error || detailsMsg || "Login gagal";
                toast.error(errorMessage);
            }
        } catch (err: any) {
            console.error(err);
            if (err instanceof TypeError) {
                toast.error(`Tidak bisa terhubung ke server (${getApiBaseUrl()}). Pastikan backend aktif.`);
            } else {
                toast.error(err?.message || "Terjadi kesalahan saat login");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4 text-center">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent opacity-50 animate-pulse"></div>
            </div>

            <div className="relative z-10 w-full max-w-sm mx-auto space-y-6">
                <h1 className="text-3xl font-bold text-white">Login</h1>

                <form onSubmit={handleLogin} className="flex flex-col gap-4 w-full bg-white/5 p-6 rounded-2xl backdrop-blur-sm border border-white/10">
                    <input
                        type="text"
                        placeholder="Username / NIM"
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Kata sandi"
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Sedang masuk..." : "Login"}
                    </button>
                </form>
                     <a
                        href="https://dummy-production-9e41.up.railway.app/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full block text-center px-8 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold transition-all shadow-lg shadow-green-500/25 hover:shadow-green-500/40"
                    >
                        Buat Akun Baru
                    </a>
                <p className="text-white/60">
                    <Link href="/" className="hover:text-white transition-colors">
                        &larr; Kembali ke Beranda
                    </Link>
                </p>
            </div>
        </div>
    );
}
