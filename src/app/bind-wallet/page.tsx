"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "../../context/WalletContext";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { clearAuth, getStoredUsername, getStoredRole } from "../../utils/auth";
import { authApiFetch } from "../../utils/api";
import { getBlockExplorerTxUrl } from "../../utils/explorer";
import { getRpcErrorMessage } from "../../utils/rpcError";
import { clearWalletBindReturn, markWalletBindReturn } from "../../utils/walletBindReturn";

type BindStatusTone = "neutral" | "error";

type BindWalletResponse = {
  success?: boolean;
  error?: string;
  vcJwt?: string;
};

type DidStatusResponse = {
  claimed?: boolean;
  studentId?: string;
  nftClaimed?: boolean;
  txHash?: string;
  vc?: unknown;
  vcJwt?: string;
};

function isAuthExpiredMessage(message: string) {
  return (
    message.includes("Tidak ada token autentikasi yang valid") ||
    message.includes("Autentikasi gagal")
  );
}

export default function BindWallet() {
  const {
    account,
    isConnected,
    connectWallet,
    walletBlocked,
    walletBlockedMessage,
    isConnecting,
    provider,
  } = useWallet();
  const [chainId, setChainId] = useState<bigint | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<BindStatusTone>("neutral");
  const [vc, setVc] = useState<BindWalletResponse | null>(null);
  const [alreadyBound, setAlreadyBound] = useState(false);
  const [usedByOther, setUsedByOther] = useState(false);
  const [nftClaimed, setNftClaimed] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isBinding, setIsBinding] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const router = useRouter();

  const setNeutralStatus = useCallback((message: string) => {
    setStatus(message);
    setStatusTone("neutral");
  }, []);

  const setErrorStatus = useCallback((message: string) => {
    setStatus(`Kesalahan: ${message}`);
    setStatusTone("error");
  }, []);

  const redirectToLogin = useCallback(
    (message?: string) => {
      clearAuth();
      if (message) {
        setErrorStatus(message);
      }
      window.setTimeout(() => router.push("/login"), 2000);
    },
    [router, setErrorStatus],
  );

  useEffect(() => {
    if (!provider) {
      setChainId(null);
      return;
    }

    provider
      .getNetwork()
      .then((network) => setChainId(network.chainId))
      .catch(() => setChainId(null));
  }, [provider]);

  useEffect(() => {
    const storedStudentId = getStoredUsername();
    const role = getStoredRole();

    if (!storedStudentId) {
      router.push("/login");
      return;
    }

    if (role === "admin") {
      toast.error("Akun admin tidak dapat menautkan wallet sebagai mahasiswa.");
      router.push("/admin");
      return;
    }

    setStudentId(storedStudentId);
  }, [router]);

  const resetBindingState = useCallback(() => {
    setAlreadyBound(false);
    setUsedByOther(false);
    setNftClaimed(false);
    setVc(null);
    setTxHash(null);
  }, []);

  const checkStatus = useCallback(async () => {
    if (!account) {
      return;
    }

    setIsCheckingStatus(true);

    try {
      const res = await authApiFetch(`/api/did/status/${account}`);

      if (res.status === 401) {
        redirectToLogin();
        return;
      }

      if (res.status === 403) {
        resetBindingState();
        setUsedByOther(true);
        setErrorStatus("Wallet sudah tertaut ke akun lain.");
        return;
      }

      const data = (await res.json()) as DidStatusResponse;
      if (!data.claimed) {
        resetBindingState();
        setStatus("");
        return;
      }

      if (data.studentId !== studentId) {
        resetBindingState();
        setUsedByOther(true);
        setErrorStatus(`Wallet sudah tertaut ke NIM lain: ${data.studentId}`);
        return;
      }

      setAlreadyBound(true);
      setUsedByOther(false);

      if (data.nftClaimed) {
        setNftClaimed(true);
        setVc(null);
        setTxHash(data.txHash || null);
        setNeutralStatus("Wallet sudah tertaut dan Student NFT sudah diklaim.");
        return;
      }

      setNftClaimed(false);
      setTxHash(null);

      if (data.vc) {
        setVc({ vcJwt: data.vcJwt });
        setNeutralStatus("Wallet sudah tertaut. Silakan klaim NFT Anda.");
        return;
      }

      setVc(null);
      setNeutralStatus("Wallet sudah tertaut ke akun Anda.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (isAuthExpiredMessage(message)) {
        redirectToLogin();
        return;
      }

      setErrorStatus(getRpcErrorMessage(error));
      console.error(error);
    } finally {
      setIsCheckingStatus(false);
    }
  }, [
    account,
    redirectToLogin,
    resetBindingState,
    setErrorStatus,
    setNeutralStatus,
    studentId,
  ]);

  useEffect(() => {
    if (account && studentId) {
      checkStatus();
    }
  }, [account, studentId, checkStatus]);

  const bindWallet = useCallback(async (walletAddress = account, activeProvider = provider) => {
    if (!walletAddress) {
      toast.error("Hubungkan wallet terlebih dahulu");
      return;
    }

    if (usedByOther || walletBlocked) {
      toast.error("Wallet tersebut sudah digunakan oleh akun lain.");
      return;
    }

    if (!studentId) {
      return;
    }

    if (!activeProvider) {
      toast.error("Provider wallet tidak tersedia. Coba hubungkan ulang MetaMask.");
      return;
    }

    setNeutralStatus("Meminta persetujuan tanda tangan wallet...");
    setIsBinding(true);

    try {
      const challengeRes = await authApiFetch("/api/did/bind/challenge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studentId, userAddress: walletAddress }),
      });

      if (!challengeRes.ok) {
        const errorData = (await challengeRes.json().catch(() => ({}))) as {
          error?: string;
        };

        if (challengeRes.status === 401) {
          redirectToLogin("Sesi berakhir. Mengalihkan ke halaman login...");
          return;
        }

        throw new Error(errorData.error || `HTTP error! status: ${challengeRes.status}`);
      }

      const challengeData = (await challengeRes.json()) as {
        success?: boolean;
        challengeToken?: string;
        message?: string;
      };
      if (!challengeData.success || !challengeData.challengeToken || !challengeData.message) {
        throw new Error("Challenge wallet tidak valid. Silakan coba lagi.");
      }

      const signer = await activeProvider.getSigner();
      const signerAddress = await signer.getAddress();
      if (signerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error("Wallet aktif berubah. Silakan hubungkan ulang wallet yang ingin ditautkan.");
      }

      markWalletBindReturn();
      const signature = await signer.signMessage(challengeData.message);
      setNeutralStatus("Memverifikasi tanda tangan wallet...");
      clearWalletBindReturn();

      const res = await authApiFetch("/api/did/bind", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId,
          userAddress: walletAddress,
          signature,
          challengeToken: challengeData.challengeToken,
        }),
      });

      const data = (await res.json()) as BindWalletResponse;
      if (!res.ok) {
        if (res.status === 401) {
          redirectToLogin("Sesi berakhir. Mengalihkan ke halaman login...");
          return;
        }

        throw new Error(data.error || `HTTP error! status: ${res.status}`);
      }

      if (!data.success) {
        throw new Error(data.error || "Gagal menautkan wallet");
      }

      setVc(data);
      setAlreadyBound(true);
      setUsedByOther(false);
      setNeutralStatus("Berhasil! Wallet tertaut ke akun mahasiswa.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menautkan wallet";
      if (isAuthExpiredMessage(message)) {
        redirectToLogin("Silakan login kembali. Sesi Anda sudah berakhir.");
        return;
      }

      setErrorStatus(getRpcErrorMessage(err) || message);
      console.error("Kesalahan saat menautkan wallet:", err);
    } finally {
      clearWalletBindReturn();
      setIsBinding(false);
    }
  }, [
    account,
    provider,
    redirectToLogin,
    setErrorStatus,
    setNeutralStatus,
    studentId,
    usedByOther,
    walletBlocked,
  ]);

  const connectAndBindWallet = async () => {
    const connectedAccount = await connectWallet();
    const walletAddress = connectedAccount || account;
    if (!walletAddress) {
      return;
    }

    await bindWallet(walletAddress, provider);
  };

  const registerForElection = async () => {
    if (!vc?.vcJwt || !account) {
      return;
    }

    setNeutralStatus("Memverifikasi & menerbitkan Student NFT...");
    setIsClaiming(true);

    try {
      const res = await authApiFetch("/api/did/verify-and-register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userAddress: account,
          vcJwt: vc.vcJwt,
        }),
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({
          error: `HTTP ${res.status} error`,
        }))) as { error?: string };
        console.error("Register election error:", errorData, "Status:", res.status);
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }

      const data = (await res.json()) as { success?: boolean; error?: string; txHash?: string };
      if (!data.success) {
        throw new Error(data.error || "Gagal verifikasi dan pendaftaran");
      }

      setTxHash(data.txHash || null);
      setNftClaimed(true);
      setVc(null);
      setNeutralStatus("Berhasil! Student NFT berhasil diklaim.");
      window.setTimeout(() => router.push("/vote"), 4000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal mendaftar";
      if (isAuthExpiredMessage(message)) {
        redirectToLogin("Sesi berakhir. Silakan login kembali.");
        return;
      }

      setErrorStatus(getRpcErrorMessage(err) || message);
      console.error("Kesalahan pendaftaran:", err);
    } finally {
      setIsClaiming(false);
    }
  };

  if (!studentId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white shadow-xl backdrop-blur-xl">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-blue-400" />
          <p className="text-sm text-white/80">Memuat identitas akun dan status wallet...</p>
        </div>
      </div>
    );
  }

  const showBindButton =
    !alreadyBound && !vc && !nftClaimed && !usedByOther && !walletBlocked;
  const showWalletConflict = usedByOther || walletBlocked;

  return (
    <div className="min-h-screen bg-dark-900 pt-20 px-4">
      <div className="max-w-md mx-auto bg-white/5 p-8 rounded-2xl backdrop-blur-xl border border-white/10 text-center">
        <h1 className="text-2xl font-bold mb-6 text-white">Hubungkan Wallet</h1>

        <div className="mb-6 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
          <p className="text-sm text-blue-200 uppercase tracking-wider mb-1">Login sebagai</p>
          <p className="text-xl font-mono text-white">{studentId}</p>
        </div>

        {!isConnected ? (
          <div className="space-y-4">
            <p className="text-white/60">
              Hubungkan wallet Ethereum Anda untuk ditautkan ke akun mahasiswa.
            </p>
            <button
              type="button"
              onClick={connectAndBindWallet}
              disabled={walletBlocked || isConnecting || isBinding || isCheckingStatus}
              className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition"
            >
              {isConnecting || isBinding ? "Memproses Tautan Wallet..." : "Hubungkan & Tautkan Wallet"}
            </button>
            {(walletBlockedMessage || showWalletConflict) && (
              <div className="p-3 rounded-lg text-sm bg-red-500/20 text-red-200 border border-red-500/30">
                {walletBlockedMessage || status}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-black/40 rounded-lg text-sm font-mono text-white/80 break-all border border-white/5">
              {account}
            </div>

            {isCheckingStatus && (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
                Memeriksa apakah wallet ini sudah tertaut dan siap digunakan...
              </div>
            )}

            {showBindButton && (
              <button
                type="button"
                onClick={() => bindWallet()}
                disabled={isBinding || isCheckingStatus}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition shadow-lg shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isBinding ? "Memproses Tautan Wallet..." : "Tautkan Wallet Ini"}
              </button>
            )}

            {showWalletConflict && (
              <div className="p-4 bg-red-500/20 text-red-200 rounded-xl border border-red-500/30">
                {walletBlockedMessage || status || "Wallet tersebut sudah digunakan oleh akun lain."}
              </div>
            )}

            {nftClaimed && (
              <div className="p-4 bg-purple-500/20 text-purple-200 rounded-xl border border-purple-500/30 space-y-2">
                <div className="font-semibold px-2 py-1">✓ NFT Sudah Diklaim</div>
                {txHash && (
                  <div className="text-xs bg-black/40 p-2 rounded-lg border border-purple-500/20 font-mono flex flex-col items-center gap-1.5">
                    <span className="text-purple-300">Hash Transaksi:</span>
                    <a
                      href={getBlockExplorerTxUrl(txHash, chainId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline break-all inline-block px-1"
                    >
                      {txHash}
                    </a>
                  </div>
                )}
              </div>
            )}

            {alreadyBound && !vc && !nftClaimed && (
              <div className="p-4 bg-green-500/20 text-green-200 rounded-xl border border-green-500/30">
                ✓ Wallet Sudah terhubung
              </div>
            )}

            {vc && !nftClaimed && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="p-4 bg-green-500/20 text-green-200 rounded-xl border border-green-500/30">
                  ✓ Wallet Berhasil Dihubungkan
                </div>
                <button
                  type="button"
                  onClick={registerForElection}
                  disabled={isClaiming}
                  className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition shadow-lg shadow-purple-600/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isClaiming ? "Memverifikasi dan Menerbitkan NFT..." : "Klaim NFT (Wajib untuk Voting)"}
                </button>
              </div>
            )}

            {status && (
              <div
                className={`mt-4 rounded-lg border p-3 text-sm ${
                  statusTone === "error"
                    ? "border-red-500/30 bg-red-500/20 text-red-200"
                    : "border-white/10 bg-white/10 text-white"
                }`}
              >
                {status}
              </div>
            )}

            {statusTone === "error" && (
              <button
                type="button"
                onClick={checkStatus}
                disabled={isCheckingStatus}
                className="w-full rounded-xl border border-white/15 bg-white/5 py-3 text-white font-semibold transition hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isCheckingStatus ? "Memeriksa Ulang..." : "Coba Periksa Status Lagi"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
