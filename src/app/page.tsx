"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

type FeatureItem = {
  icon: string;
  title: string;
  desc: string;
};

type StepItem = {
  num: string;
  icon: string;
  title: string;
  desc: string;
};

type SecurityItem = {
  color: string;
  bg: string;
  icon: string;
  title: string;
  desc: string;
};

const features: FeatureItem[] = [
  {
    icon: "🔗",
    title: "Blockchain Terdesentralisasi",
    desc: "Setiap suara dicatat secara permanen di smart contract Ethereum — tidak bisa diubah atau dihapus.",
  },
  {
    icon: "🪪",
    title: "Identitas Terverifikasi",
    desc: "Pemilih diverifikasi melalui Verifiable Credential (VC) dan Student NFT sebelum bisa memberikan suara.",
  },
  {
    icon: "🔒",
    title: "Privasi & Keamanan",
    desc: "Wallet address digunakan sebagai identitas voting — tidak ada data pribadi yang tersimpan di server pusat.",
  },
  {
    icon: "📊",
    title: "Hasil Real-time",
    desc: "Hasil pemilihan dapat dipantau secara live dengan update otomatis via Socket.IO.",
  },
  {
    icon: "🗂️",
    title: "Multi Sesi Voting",
    desc: "Admin dapat membuat beberapa sesi pemilihan sekaligus dengan kandidat dan periode yang berbeda.",
  },
  {
    icon: "📜",
    title: "Riwayat Transparan",
    desc: "Riwayat voting setiap pengguna bisa diverifikasi lewat block explorer dengan transaction hash.",
  },
];

const steps: StepItem[] = [
  {
    num: "01",
    icon: "🔐",
    title: "Login",
    desc: "Masuk menggunakan NIM dan password yang diberikan oleh admin.",
  },
  {
    num: "02",
    icon: "🔗",
    title: "Tautkan Wallet",
    desc: "Hubungkan dompet MetaMask ke akun mahasiswamu — satu wallet untuk satu Student ID.",
  },
  {
    num: "03",
    icon: "🪙",
    title: "Klaim NFT",
    desc: "Klaim Student NFT sebagai bukti identitas terverifikasi agar bisa ikut voting.",
  },
  {
    num: "04",
    icon: "🗳️",
    title: "Voting",
    desc: "Pilih kandidat di sesi voting aktif, konfirmasi di wallet, dan suaramu tercatat selamanya.",
  },
];

const securityItems: SecurityItem[] = [
  {
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    icon: "🪪",
    title: "Identitas",
    desc: "Binding wallet–Student ID dan penerbitan VC dilakukan melalui backend terautentikasi (JWT). Hanya pemilik kredensial sah yang dapat mengikat dompet dan menerima NFT.",
  },
  {
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
    icon: "🗳️",
    title: "Suara",
    desc: "Suara terhubung ke alamat wallet dan session ID di blockchain. Smart contract memastikan satu suara per pemilih per sesi — tidak bisa vote dua kali.",
  },
  {
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
    icon: "🔒",
    title: "Data",
    desc: "Password di-hash dengan bcrypt. Token JWT digunakan untuk sesi. Jangan bagikan kredensial atau seed phrase wallet ke siapapun.",
  },
  {
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    icon: "🎭",
    title: "Soulbound NFT",
    desc: "Student NFT bersifat Soulbound Token (SBT) — tidak bisa dipindahtangankan, sehingga identitas pemilih tidak bisa diperjualbelikan.",
  },
];

const stats = [
  { value: "100%", label: "Transparan" },
  { value: "ERC-721", label: "Student NFT" },
  { value: "0", label: "Server Pusat" },
  { value: "∞", label: "Dapat Diverifikasi" },
] as const;

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const role = localStorage.getItem("role");
      const username = localStorage.getItem("username");
      setIsLoggedIn(!!(role && username));
    };

    checkAuth();

    window.addEventListener("auth-change", checkAuth);
    return () => window.removeEventListener("auth-change", checkAuth);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ─── HERO ─────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-20 text-center overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[40%] -left-[30%] w-[80%] h-[80%] rounded-full bg-blue-600/10 blur-3xl" />
          <div className="absolute -bottom-[40%] -right-[30%] w-[80%] h-[80%] rounded-full bg-purple-600/10 blur-3xl" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            Blockchain Ethereum · Verifiable Credential · Soulbound NFT
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white via-blue-100 to-blue-300">
            E-Voting <br className="sm:hidden" />Berbasis{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
              Blockchain
            </span>
          </h1>

          <p className="text-base sm:text-xl text-blue-100/60 max-w-2xl mx-auto leading-relaxed">
            Sistem pemilihan digital yang aman, transparan, dan tidak bisa dimanipulasi —
            dirancang khusus untuk organisasi kemahasiswaan.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            {isLoggedIn ? (
              <Link
                href="/vote"
                className="w-full sm:w-auto px-8 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
              >
                Mulai Voting →
              </Link>
            ) : (
              <Link
                href="/login"
                className="w-full sm:w-auto px-8 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
              >
                Login / Mulai →
              </Link>
            )}
            <Link
              href="/results"
              className="w-full sm:w-auto px-8 py-3 rounded-full bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold transition-all backdrop-blur-sm"
            >
              Lihat Hasil Live
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-gray-600 animate-bounce">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ─── STATS STRIP ─────────────────────────────── */}
      <section className="border-y border-white/5 bg-white/[0.02] py-8 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                {stat.value}
              </p>
              <p className="text-gray-400 text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FITUR ───────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-3">
              Kenapa E-Voting Blockchain?
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto text-sm sm:text-base">
              Sistem pemilihan tradisional rentan manipulasi. Kami membangun solusi yang lebih adil.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 hover:border-blue-500/30 hover:bg-white/5 transition-all group"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="text-base sm:text-lg font-bold text-white mb-2 group-hover:text-blue-300 transition-colors">
                  {f.title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CARA KERJA ──────────────────────────────── */}
      <section className="py-20 px-4 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-3">Cara Penggunaan</h2>
            <p className="text-gray-400 text-sm sm:text-base">4 langkah mudah untuk mulai berpartisipasi</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={step.num} className="relative flex flex-col items-center text-center">
                {/* connector line */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-6 left-[calc(50%+2rem)] right-[-calc(50%-2rem)] h-px bg-gradient-to-r from-blue-500/40 to-transparent" />
                )}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-xl shadow-lg shadow-blue-500/20 mb-4 shrink-0">
                  {step.icon}
                </div>
                <p className="text-xs font-mono text-blue-500/60 mb-1">{step.num}</p>
                <h3 className="font-bold text-white mb-1">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          {/* Detail steps */}
          <div className="mt-12 glass-panel rounded-2xl border border-white/10 p-6">
            <h3 className="font-semibold text-blue-300 mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-blue-500 rounded-full" />
              Panduan Lengkap untuk Pemilih
            </h3>
            <ol className="space-y-2 text-blue-100/80 text-sm sm:text-base list-decimal list-inside">
              <li>Login dengan NIM dan kata sandi yang diberikan admin.</li>
              <li>Buka halaman <strong className="text-white">Tautkan Wallet</strong>, hubungkan MetaMask, lalu klik <strong className="text-white">Tautkan Wallet ke Akun</strong>.</li>
              <li>Klik <strong className="text-white">Klaim Student NFT</strong> untuk menerbitkan identitas terverifikasi ke wallet Anda.</li>
              <li>Buka halaman <strong className="text-white">Voting</strong>, pilih sesi aktif dan kandidat, lalu konfirmasi transaksi di MetaMask.</li>
              <li>Cek <strong className="text-white">Riwayat</strong> untuk melihat hash transaksi sebagai bukti suara Anda tercatat.</li>
            </ol>
          </div>

          <div className="text-center mt-10">
            {isLoggedIn ? (
              <Link
                href="/bind-wallet"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-lg shadow-blue-500/25"
              >
                Lanjutkan ke Tautkan Wallet →
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-lg shadow-blue-500/25"
              >
                Mulai Sekarang →
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ─── TENTANG SISTEM ───────────────────────────── */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-3">Tentang Sistem</h2>
            <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto">
              E-Voting berbasis DID yang menggabungkan teknologi terkini untuk mewujudkan pemilihan yang adil dan transparan.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-panel rounded-2xl border border-white/10 p-6 space-y-3 text-blue-100/80 leading-relaxed text-sm sm:text-base">
              <h3 className="font-semibold text-white text-lg flex items-center gap-2">
                <span className="w-1 h-5 bg-blue-500 rounded-full" />
                Deskripsi Sistem
              </h3>
              <p>
                Sistem E-Voting ini menggabungkan identitas digital (DID) dan Verifiable Credential (VC).
                Setiap pemilih harus terdaftar (Student ID), mengikat wallet, dan menerima{" "}
                <strong className="text-white">Student NFT Soulbound</strong> sebagai bukti identitas sebelum
                dapat memberikan suara.
              </p>
              <p>
                Suara dicatat <em>on-chain</em> di smart contract sehingga transparan dan tidak dapat diubah.
                Pembaruan real-time via Socket.IO memastikan hasil pemilihan selalu sinkron di semua perangkat.
              </p>
              <p className="text-blue-300/70 text-xs font-mono pt-1">
                Stack: Ethereum (Hardhat) · Next.js · Express · MongoDB · Socket.IO
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-white text-lg flex items-center gap-2">
                <span className="w-1 h-5 bg-green-500 rounded-full" />
                Privasi & Keamanan
              </h3>
              {securityItems.map((item) => (
                <div key={item.title} className={`rounded-xl border p-4 ${item.bg}`}>
                  <p className={`font-semibold mb-1 text-sm ${item.color}`}>
                    {item.icon} {item.title}
                  </p>
                  <p className="text-blue-100/70 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER CTA ──────────────────────────────── */}
      <section className="py-16 px-4 text-center border-t border-white/5">
        <div className="max-w-2xl mx-auto space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Siap berpartisipasi?
          </h2>
          <p className="text-gray-400 text-sm sm:text-base">
            Suaramu dicatat selamanya di blockchain — tidak bisa hilang, tidak bisa dimanipulasi.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {isLoggedIn ? (
              <Link
                href="/vote"
                className="w-full sm:w-auto px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-lg shadow-blue-500/25 text-sm"
              >
                🗳️ Mulai Voting
              </Link>
            ) : (
              <Link
                href="/login"
                className="w-full sm:w-auto px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-lg shadow-blue-500/25 text-sm"
              >
                🔐 Login Sekarang
              </Link>
            )}
            <Link
              href="/results"
              className="w-full sm:w-auto px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold transition-all text-sm"
            >
              📊 Lihat Hasil Pemilihan
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
