/**
 * Map RPC / ethers / MetaMask errors to user-friendly messages.
 * Always returns a clear fallback so the user never sees raw error objects.
 */
const FALLBACK = "Terjadi kesalahan. Silakan coba lagi atau hubungi admin jika berlanjut.";

export function getRpcErrorMessage(err: unknown): string {
    if (err == null) return FALLBACK;

    const msg = typeof (err as any)?.message === "string" ? (err as any).message : "";
    const reason = typeof (err as any)?.reason === "string" ? (err as any).reason : "";
    const code = (err as any)?.code ?? (err as any)?.error?.code ?? (err as any)?.data?.originalError?.code;
    const shortMessage = typeof (err as any)?.shortMessage === "string" ? (err as any).shortMessage : "";
    const infoErrorMessage = typeof (err as any)?.info?.error?.message === "string" ? (err as any).info.error.message : "";
    const explicitUserMessage = typeof (err as any)?.userMessage === "string" ? (err as any).userMessage : "";
    if (explicitUserMessage) return explicitUserMessage;
    const str = `${msg} ${reason} ${shortMessage} ${infoErrorMessage}`.toLowerCase();

    // User rejected / cancelled in wallet
    if (code === 4001 || code === "ACTION_REJECTED" || str.includes("user rejected") || str.includes("user denied")) {
        if (str.includes("chain") || str.includes("network") || str.includes("wallet_switchethereumchain") || str.includes("wallet_addethereumchain")) {
            return "Pergantian jaringan dibatalkan di wallet.";
        }
        return "Permintaan dibatalkan di wallet.";
    }

    // Network / RPC unreachable
    if (
        code === "NETWORK_ERROR" ||
        code === "ECONNREFUSED" ||
        code === "ENOTFOUND" ||
        str.includes("could not detect network") ||
        str.includes("network error") ||
        str.includes("fetch failed") ||
        str.includes("net::err_")
    ) {
        return "Tidak dapat terhubung ke jaringan blockchain. Periksa koneksi internet dan pastikan node RPC (mis. Hardhat) berjalan.";
    }

    // Timeout
    if (code === "TIMEOUT" || str.includes("timeout") || str.includes("deadline")) {
        return "Waktu tunggu habis. Silakan coba lagi.";
    }

    // Insufficient funds for gas
    if (code === "INSUFFICIENT_FUNDS" || str.includes("insufficient funds") || str.includes("insufficient balance")) {
        return "Saldo tidak cukup untuk biaya gas. Isi wallet dengan sedikit ETH/test ETH.";
    }

    // Contract revert (include reason if short enough)
    if (
        code === "CALL_EXCEPTION" ||
        code === "UNPREDICTABLE_GAS_LIMIT" ||
        str.includes("revert") ||
        str.includes("execution reverted") ||
        str.includes("call exception")
    ) {
        const revertMsg = reason || msg;
        if (revertMsg && revertMsg.length < 120 && !revertMsg.includes("0x")) {
            return "Transaksi ditolak: " + revertMsg;
        }
        return "Transaksi ditolak oleh kontrak. Pastikan syarat terpenuhi (mis. punya Student NFT, belum vote, sesi aktif).";
    }

    // Wrong network
    if (code === 4902 || str.includes("chain") && str.includes("not added") || str.includes("unrecognized chain")) {
        return "Jaringan yang dibutuhkan belum ada di wallet. Setujui penambahan jaringan yang diminta.";
    }

    // Nonce / replacement (user might have sent duplicate)
    if (str.includes("nonce") || str.includes("replacement fee")) {
        return "Nonce tidak sesuai. Coba refresh halaman dan kirim ulang transaksi.";
    }

    // Generic but known structure: show short reason if available
    if (reason && reason.length < 100 && !reason.includes("0x")) return reason;
    if (msg && msg.length < 100 && !msg.includes("0x")) return msg;

    return FALLBACK;
}
