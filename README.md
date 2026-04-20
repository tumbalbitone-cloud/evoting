# E-Voting Frontend

Frontend aplikasi E-Voting ini dibangun dengan Next.js App Router, React 18, TypeScript, `ethers.js`, dan `socket.io-client`.

## Fitur yang tersedia

- Login admin dan mahasiswa.
- Bind wallet dengan challenge-signature flow.
- Klaim Student NFT setelah VC diverifikasi backend.
- Voting on-chain melalui MetaMask.
- Hasil dan status sesi real-time via Socket.IO.
- Riwayat transaksi dengan block-range chunking.
- Dashboard admin untuk sesi, kandidat, allowlist, dan user.

## Menjalankan frontend

1. Masuk ke folder `frontend`.
2. Install dependency dengan `npm install`.
3. Salin `frontend/.env.example` menjadi `frontend/.env`.
4. Jalankan `npm run dev`.

Frontend development berjalan di `http://localhost:3000`.

## Environment variables

Variabel yang saat ini dipakai oleh kode frontend:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_VOTING_SYSTEM_ADDRESS=0xYourContractAddress

NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_CHAIN_NAME=Hardhat Localhost
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://amoy.polygonscan.com
NEXT_PUBLIC_CONTRACT_DEPLOY_BLOCK=0
```

Catatan:

- `NEXT_PUBLIC_API_URL` adalah base URL backend.
- `NEXT_PUBLIC_RPC_URL` dipakai untuk pembacaan data blockchain.
- `NEXT_PUBLIC_VOTING_SYSTEM_ADDRESS` wajib untuk interaksi kontrak.
- `NEXT_PUBLIC_CHAIN_ID` dan `NEXT_PUBLIC_CHAIN_NAME` dipakai oleh `WalletContext` untuk sinkronisasi jaringan MetaMask.
- `NEXT_PUBLIC_BLOCK_EXPLORER_URL` opsional untuk membuat link transaksi.
- `NEXT_PUBLIC_CONTRACT_DEPLOY_BLOCK` membantu mempercepat pencarian histori transaksi.

Kode frontend juga masih menerima fallback `NEXT_PUBLIC_API_URI`, tetapi variabel utama yang direkomendasikan tetap `NEXT_PUBLIC_API_URL`.

## Routing utama

- `/` halaman utama.
- `/login` autentikasi.
- `/bind-wallet` flow bind wallet dan klaim NFT.
- `/vote` voting aktif.
- `/results` hasil voting.
- `/history` histori transaksi.
- `/profile` profil user.
- `/admin` dashboard admin.
# evoting
