"use client";

import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent opacity-50" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-10 sm:py-14">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-blue-300 hover:text-blue-200 text-sm font-medium mb-8 transition"
        >
          ← Back to Home
        </Link>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white to-blue-200 mb-4">
          About E-Voting DID
        </h1>
        <p className="text-blue-100/70 text-lg mb-12">
          Secure, transparent, and immutable voting for student organizations.
        </p>

        {/* Deskripsi Sistem */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-blue-500 rounded-full" />
            Deskripsi Sistem
          </h2>
          <div className="space-y-3 text-blue-100/80 leading-relaxed">
            <p>
              E-Voting DID adalah sistem pemungutan suara elektronik berbasis blockchain yang menggabungkan identitas digital (DID) dan Verifiable Credential (VC). Setiap pemilih harus terdaftar (Student ID), mengikat dompet (wallet) ke akun, dan menerima Student NFT (Soulbound Token) sebagai bukti identitas sebelum dapat memberikan suara.
            </p>
            <p>
              Suara dicatat on-chain di smart contract sehingga transparan dan tidak dapat diubah. Backend menyediakan autentikasi (JWT), penerbitan VC, dan pencatatan metadata off-chain. Pembaruan real-time (Socket.IO) memastikan daftar sesi dan hasil pemilihan selalu sinkron.
            </p>
            <p className="text-blue-200/90">
              Teknologi: Ethereum (Hardhat), Next.js, Express, MongoDB, Socket.IO, Polygon ID (DID/VC).
            </p>
          </div>
        </section>

        {/* Cara Pakai */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-purple-500 rounded-full" />
            Cara Pakai
          </h2>

          <div className="space-y-6">
            {/* <div className="glass-panel rounded-xl p-5 border border-white/10">
              <h3 className="font-semibold text-purple-300 mb-2">Untuk Admin</h3>
              <ul className="list-disc list-inside space-y-1 text-blue-100/80 text-sm sm:text-base">
                <li>Login dengan kredensial admin.</li>
                <li>Hubungkan dompet admin (biasanya akun #1 Hardhat).</li>
                <li>Buat akun pemilih (Student ID + password) lewat <strong>Add New Voter</strong>.</li>
                <li>Buat sesi pemilihan dan tambahkan kandidat di Dashboard.</li>
                <li>Buka/tutup sesi sesuai jadwal; pantau hasil secara real-time.</li>
              </ul>
            </div> */}

            <div className="glass-panel rounded-xl p-5 border border-white/10">
              <h3 className="font-semibold text-blue-300 mb-2">Untuk Pemilih (User)</h3>
              <ul className="list-disc list-inside space-y-1 text-blue-100/80 text-sm sm:text-base">
                <li>Login dengan Student ID dan password yang diberikan admin.</li>
                <li>Di halaman Profile atau Bind Wallet: hubungkan MetaMask dan klik <strong>Bind Wallet</strong> (satu wallet hanya untuk satu Student ID).</li>
                <li>Klik <strong>Verify & Register</strong> untuk mengklaim Student NFT (identitas terverifikasi).</li>
                <li>Buka halaman Vote, pilih sesi dan kandidat, lalu konfirmasi transaksi di wallet.</li>
                <li>Riwayat suara dapat dilihat di History; hasil pemilihan di Results.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Privasi */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-green-500 rounded-full" />
            Privasi & Keamanan
          </h2>
          <div className="space-y-3 text-blue-100/80 leading-relaxed">
            <p>
              <strong>Identitas:</strong> Binding wallet–Student ID dan penerbitan VC dilakukan melalui backend yang terautentikasi. Hanya pemilik kredensial yang sah yang dapat mengikat dompet dan menerima NFT.
            </p>
            <p>
              <strong>Suara:</strong> Di blockchain, suara terhubung ke alamat dompet dan session/candidate ID; backend dapat menyimpan hash transaksi untuk audit. Desain kontrak memastikan satu suara per pemilih per sesi.
            </p>
            <p>
              <strong>Data:</strong> Password di-hash (bcrypt); token JWT digunakan untuk sesi. Jangan membagikan kredensial atau seed phrase dompet. Pastikan Anda mengakses aplikasi melalui URL resmi dan koneksi aman.
            </p>
          </div>
        </section>

        <div className="pt-6 border-t border-white/10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold transition shadow-lg shadow-blue-500/25"
          >
            ← Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
