"use client";

import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "../../context/WalletContext";
import VotingArtifact from "../../contracts/VotingSystem.json";

import { useRouter } from "next/navigation";
import io from "socket.io-client"; // Import Socket.io
import toast from "react-hot-toast";
import { authenticatedFetch } from "../../utils/auth";
import { getRpcErrorMessage } from "../../utils/rpcError";
import { getValidImageUrl } from "../../utils/image";
import { getApiBaseUrl } from "../../utils/api";

const SESSION_ALLOWLIST_ABI = [
    "function getSessionAllowedVoters(uint256 _sessionId) view returns (address[] memory)",
    "function setSessionAllowedVoters(uint256 _sessionId, address[] memory _voters)",
] as const;

interface Session {
    id: number;
    name: string;
    description: string;
    startTime: number;
    endTime: number;
    isActive: boolean;
}

interface SessionStats {
    totalNFTHolders: number;
    uniqueVoterCount: number;
    participationRate: string;
    registeredLabel: string;
    loading: boolean;
}

interface ResolvedVoter {
    studentId: string;
    name: string;
    address: string;
}

interface UnresolvedVoter {
    studentId: string;
    name?: string;
    reason: string;
}

interface StudentDirectoryItem {
    studentId: string;
    name: string;
    active: boolean;
    claimedBy: string | null;
}

interface BulkImportFailure {
    line: number;
    studentId: string | null;
    reason: string;
}

interface BulkImportSummary {
    totalRows: number;
    created: number;
    failed: number;
    defaultPassword?: string;
}

// ─── StatCard ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color = "blue", loading = false }: {
    label: string; value: string | number; sub?: string;
    icon: string; color?: "blue" | "green" | "amber"; loading?: boolean;
}) {
    const colorMap = {
        blue: "from-blue-600/20 to-blue-500/10 border-blue-500/30",
        green: "from-emerald-600/20 to-emerald-500/10 border-emerald-500/30",
        amber: "from-amber-600/20 to-amber-500/10 border-amber-500/30",
    };
    return (
        <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-xl p-4 flex flex-col gap-1`}>
            <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{icon}</span>
                <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">{label}</span>
            </div>
            {loading ? <div className="h-8 w-16 bg-white/10 rounded animate-pulse" /> : <p className="text-3xl font-bold text-white">{value}</p>}
            {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
        </div>
    );
}

// ─── ParticipationMeter ───────────────────────────────────────────────────

function ParticipationMeter({ rate, loading, denominatorLabel }: { rate: number; loading: boolean; denominatorLabel: string }) {
    const color = rate >= 70 ? "from-emerald-500 to-emerald-400"
        : rate >= 40 ? "from-blue-500 to-blue-400"
            : "from-amber-500 to-amber-400";
    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-300">Tingkat Partisipasi</span>
                {loading ? <div className="h-5 w-12 bg-white/10 rounded animate-pulse" /> : <span className="text-sm font-bold text-white">{rate.toFixed(1)}%</span>}
            </div>
            <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                <div className={`h-3 rounded-full bg-gradient-to-r ${color} transition-all duration-1000 ease-out`}
                    style={{ width: loading ? "0%" : `${Math.min(rate, 100)}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-2">
                Rasio pemilih aktif terhadap total {denominatorLabel.toLowerCase()}
            </p>
        </div>
    );
}

export default function AdminPage() {
    const { provider, isConnected } = useWallet();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [allowlistBusy, setAllowlistBusy] = useState(false);
    const [activeTab, setActiveTab] = useState<"monitor" | "manage" | "users">("monitor");

    // Session State
    const [sessionName, setSessionName] = useState("");
    const [sessionDesc, setSessionDesc] = useState("");
    const [sessionDuration, setSessionDuration] = useState(7); // Days

    // Session Monitoring State
    const [sessions, setSessions] = useState<Session[]>([]);

    // Candidate State
    const [candidateName, setCandidateName] = useState("");
    const [candidatePhotoUrl, setCandidatePhotoUrl] = useState("");
    const [candidateVision, setCandidateVision] = useState("");
    const [candidateMission, setCandidateMission] = useState("");
    const [targetSessionId, setTargetSessionId] = useState(1);
    const [allowlistSessionId, setAllowlistSessionId] = useState(1);
    const [draftAllowlist, setDraftAllowlist] = useState<{ value: string, label: string }[]>([]);
    const [allowlistAddresses, setAllowlistAddresses] = useState<string[]>([]);
    const [isStudentPickerOpen, setIsStudentPickerOpen] = useState(false);
    const [studentDirectoryQuery, setStudentDirectoryQuery] = useState("");
    const [studentDirectoryLoading, setStudentDirectoryLoading] = useState(false);
    const [studentDirectory, setStudentDirectory] = useState<StudentDirectoryItem[]>([]);

    // User Management State
    const [newUserName, setNewUserName] = useState("");
    const [newUserStudentId, setNewUserStudentId] = useState("");
    const [newUserPassword, setNewUserPassword] = useState("");
    const [bulkImportFile, setBulkImportFile] = useState<File | null>(null);
    const [bulkImportLoading, setBulkImportLoading] = useState(false);
    const [bulkImportSummary, setBulkImportSummary] = useState<BulkImportSummary | null>(null);
    const [bulkImportFailedRows, setBulkImportFailedRows] = useState<BulkImportFailure[]>([]);
    const [bulkImportInputKey, setBulkImportInputKey] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);
    const [detailSessionId, setDetailSessionId] = useState<number | null>(null);
    const [stats, setStats] = useState<SessionStats>({
        totalNFTHolders: 0,
        uniqueVoterCount: 0,
        participationRate: "0",
        registeredLabel: "Pemegang Student NFT",
        loading: false,
    });

    useEffect(() => {
        // Simple Role Check (Security should be done on backend/contract too)
        const role = localStorage.getItem("role");
        if (role !== 'admin') {
            router.push('/');
        }
    }, [router]);

    useEffect(() => {
        if (provider) fetchSessions();
    }, [provider, refreshKey]);

    // Refetch when user returns to tab so admin list updates without reload
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === "visible" && provider) fetchSessions();
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, [provider]);

    // ---------------------------------------------------------
    // REAL-TIME UPDATES VIA SOCKET.IO
    // ---------------------------------------------------------
    useEffect(() => {
        const socket = io(getApiBaseUrl());

        socket.on("connect", () => {
            console.log("🟢 Admin terhubung ke pembaruan real-time");
        });

        // Listen for new sessions
        socket.on("session_created", () => {
            console.log("🆕 Sesi baru dibuat, menyegarkan daftar admin...");
            setRefreshKey(prev => prev + 1);
        });

        // Listen for session status changes
        socket.on("session_update", () => {
            console.log("🔄 Status sesi diperbarui, menyegarkan daftar admin...");
            setRefreshKey(prev => prev + 1);
        });

        // Cleanup on unmount
        return () => {
            socket.disconnect();
        };
    }, []);

    const getAllowlistContract = (runner: ethers.ContractRunner) => {
        return new ethers.Contract(
            process.env.NEXT_PUBLIC_VOTING_SYSTEM_ADDRESS!,
            [...VotingArtifact.abi, ...SESSION_ALLOWLIST_ABI],
            runner
        );
    };



    const unresolvedReasonLabel = (reason: string): string => {
        if (reason === "not_found") return "akun tidak ditemukan";
        if (reason === "inactive") return "akun nonaktif";
        if (reason === "wallet_not_bound") return "wallet belum di-bind";
        return reason;
    };

    const formatShortAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;



    const fetchStudentDirectory = async (keyword = "", silent = false) => {
        setStudentDirectoryLoading(true);
        try {
            const params = new URLSearchParams();
            params.set("limit", "500");
            if (keyword.trim()) params.set("q", keyword.trim());

            const response = await authenticatedFetch(
                `${getApiBaseUrl()}/api/users/list?${params.toString()}`,
                { method: "GET" }
            );
            const payload = await response.json();

            if (!response.ok || !payload.success) {
                throw new Error(payload.error || "Gagal memuat daftar mahasiswa");
            }

            setStudentDirectory((payload.students || []) as StudentDirectoryItem[]);
        } catch (err: any) {
            if (!silent) {
                toast.error(err?.message || "Gagal memuat daftar mahasiswa");
            }
        }
        setStudentDirectoryLoading(false);
    };

    const openStudentPicker = () => {
        setIsStudentPickerOpen(true);
        fetchStudentDirectory(studentDirectoryQuery, true);
    };

    const resolveAllowlistEntries = async (entries: string[]) => {
        const addresses: string[] = [];
        const seenAddresses = new Set<string>();
        const studentIds: string[] = [];
        const invalidAddresses: string[] = [];

        for (const entry of entries) {
            if (entry.startsWith("0x")) {
                if (!ethers.isAddress(entry)) {
                    invalidAddresses.push(entry);
                    continue;
                }

                const checksum = ethers.getAddress(entry);
                const key = checksum.toLowerCase();
                if (!seenAddresses.has(key)) {
                    seenAddresses.add(key);
                    addresses.push(checksum);
                }
                continue;
            }

            studentIds.push(entry);
        }

        if (invalidAddresses.length > 0) {
            throw new Error(`Alamat wallet tidak valid: ${invalidAddresses.join(", ")}`);
        }

        let unresolved: UnresolvedVoter[] = [];
        if (studentIds.length > 0) {
            const response = await authenticatedFetch(`${getApiBaseUrl()}/api/users/resolve-voter-addresses`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ studentIds }),
            });
            const payload = await response.json();

            if (!response.ok || !payload.success) {
                throw new Error(payload.error || "Gagal me-resolve akun ke wallet");
            }

            const resolvedRows = (payload.resolved || []) as ResolvedVoter[];
            unresolved = (payload.unresolved || []) as UnresolvedVoter[];

            for (const row of resolvedRows) {
                if (!ethers.isAddress(row.address)) continue;
                const checksum = ethers.getAddress(row.address);
                const key = checksum.toLowerCase();
                if (!seenAddresses.has(key)) {
                    seenAddresses.add(key);
                    addresses.push(checksum);
                }
            }
        }

        return { addresses, unresolved };
    };

    const fetchSessions = async () => {
        try {
            const readProvider = provider || new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
            const contract = new ethers.Contract(
                process.env.NEXT_PUBLIC_VOTING_SYSTEM_ADDRESS!,
                VotingArtifact.abi,
                readProvider
            );

            const data = await contract.getAllSessions();

            // Format sessions
            const formattedSessions = data.map((s: any) => ({
                id: Number(s.id),
                name: s.name,
                description: s.description,
                startTime: Number(s.startTime),
                endTime: Number(s.endTime),
                isActive: s.isActive,
            }));

            // Sort by ID asc (oldest first, newest at bottom)
            formattedSessions.sort((a: Session, b: Session) => a.id - b.id);
            setSessions(formattedSessions);
        } catch (err) {
            console.error("Kesalahan saat memuat sesi:", err);
            toast.error(getRpcErrorMessage(err));
        }
    };

    const fetchSessionAllowlist = async (sessionId: number) => {
        try {
            const readProvider = provider || new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
            const contract = getAllowlistContract(readProvider);
            const voters = await contract.getSessionAllowedVoters(sessionId);
            const normalized = voters.map((address: string) => ethers.getAddress(address));
            setAllowlistAddresses(normalized);
            setDraftAllowlist(normalized.map((addr: string) => ({ value: addr, label: formatShortAddress(addr) }))); // Auto-fill the draft
        } catch (err) {
            console.error("Kesalahan saat memuat daftar pemilih sesi:", err);
            setAllowlistAddresses([]);
            setDraftAllowlist([]);
        }
    };

    useEffect(() => {
        if (!provider || allowlistSessionId <= 0) return;
        fetchSessionAllowlist(allowlistSessionId);
    }, [provider, allowlistSessionId, refreshKey]);

    useEffect(() => {
        if (!isConnected) return;
        if (localStorage.getItem("role") !== "admin") return;

        const timer = setTimeout(() => {
            // Saat mengetik di input pencarian (baik di panel utama maupun modal),
            // otomatis memuat dan memfilter daftar mahasiswa.
            if (isStudentPickerOpen) {
                fetchStudentDirectory(studentDirectoryQuery, true);
            } else {
                fetchStudentDirectory(studentDirectoryQuery);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [isConnected, isStudentPickerOpen, studentDirectoryQuery]);

    const fetchSessionStats = async (sessionId: number) => {
        // Toggle: jika session yang sama diklik lagi, tutup panel
        if (detailSessionId === sessionId) {
            setDetailSessionId(null);
            return;
        }
        setDetailSessionId(sessionId);
        setStats(prev => ({ ...prev, loading: true }));

        try {
            const readProvider = provider || new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
            const contract = getAllowlistContract(readProvider);

            let totalNFTHolders = 0;
            let registeredLabel = "Pemegang Student NFT";
            try {
                const restrictedVoters = await contract.getSessionAllowedVoters(sessionId);
                if (restrictedVoters.length > 0) {
                    totalNFTHolders = restrictedVoters.length;
                    registeredLabel = "Daftar pemilih sesi";
                } else {
                    const nextId = await contract.nextTokenId();
                    totalNFTHolders = Number(nextId);
                }
            } catch (e) {
                console.warn("Could not fetch voter denominator:", e);
                try {
                    const nextId = await contract.nextTokenId();
                    totalNFTHolders = Number(nextId);
                } catch (nextIdError) {
                    console.warn("Could not fetch nextTokenId fallback:", nextIdError);
                }
            }

            let uniqueVoterCount = 0;
            try {
                const CHUNK_SIZE = 9000;
                const deployBlock = Number(process.env.NEXT_PUBLIC_CONTRACT_DEPLOY_BLOCK ?? 0);
                const latestBlock = await readProvider.getBlockNumber();
                // Filter hanya untuk sesi yang dipilih
                const filter = contract.filters.Voted(sessionId, null, null);
                const voterAddresses = new Set<string>();
                for (let from = deployBlock; from <= latestBlock; from += CHUNK_SIZE) {
                    const to = Math.min(from + CHUNK_SIZE - 1, latestBlock);
                    const chunk = await contract.queryFilter(filter, from, to);
                    chunk.forEach((event: any) => {
                        if (event.args?.voter) voterAddresses.add(event.args.voter.toLowerCase());
                    });
                }
                uniqueVoterCount = voterAddresses.size;
            } catch (e) { console.warn("Could not fetch voter events:", e); }

            const participationRate = totalNFTHolders > 0
                ? ((uniqueVoterCount / totalNFTHolders) * 100).toFixed(1)
                : "0.0";
            setStats({ totalNFTHolders, uniqueVoterCount, participationRate, registeredLabel, loading: false });
        } catch (err) {
            console.error("Kesalahan saat memuat statistik sesi:", err);
            setStats(prev => ({ ...prev, loading: false }));
        }
    };

    const createSession = async () => {
        if (!provider || !sessionName) return;
        setLoading(true);
        try {
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(
                process.env.NEXT_PUBLIC_VOTING_SYSTEM_ADDRESS!,
                VotingArtifact.abi,
                signer
            );

            const now = Math.floor(Date.now() / 1000);
            const durationSeconds = sessionDuration * 24 * 60 * 60;
            const endTime = now + durationSeconds;

            const tx = await contract.createSession(sessionName, sessionDesc, now, endTime);
            await tx.wait();
            toast.success(`Sesi "${sessionName}" berhasil dibuat`);
            setSessionName("");
            setSessionDesc("");
            fetchSessions(); // Refresh list
        } catch (err: any) {
            toast.error(getRpcErrorMessage(err));
        }
        setLoading(false);
    };

    const toggleSessionStatus = async (sessionId: number, currentStatus: boolean) => {
        if (!provider) return;
        if (!confirm(`Are you sure you want to ${currentStatus ? "STOP" : "START"} this session?`)) return;

        setLoading(true);
        try {
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(
                process.env.NEXT_PUBLIC_VOTING_SYSTEM_ADDRESS!,
                VotingArtifact.abi,
                signer
            );

            const tx = await contract.setSessionStatus(sessionId, !currentStatus);
            await tx.wait();
            toast.success(`Sesi ${sessionId} status diperbarui`);
            fetchSessions(); // Refresh list
        } catch (err: any) {
            toast.error(getRpcErrorMessage(err));
        }
        setLoading(false);
    };

    const addCandidate = async () => {
        if (!provider || !candidateName || !targetSessionId) return;
        setLoading(true);
        try {
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(
                process.env.NEXT_PUBLIC_VOTING_SYSTEM_ADDRESS!,
                VotingArtifact.abi,
                signer
            );

            const tx = await contract.addCandidate(targetSessionId, candidateName, candidatePhotoUrl, candidateVision, candidateMission);
            await tx.wait();
            toast.success(`Kandidat "${candidateName}" ditambahkan ke Sesi ${targetSessionId}`);
            setCandidateName("");
            setCandidatePhotoUrl("");
            setCandidateVision("");
            setCandidateMission("");
        } catch (err: any) {
            toast.error(getRpcErrorMessage(err));
        }
        setLoading(false);
    };

    const saveSessionAllowlist = async () => {
        if (!provider || !allowlistSessionId) return;

        setAllowlistBusy(true);
        try {
            const draftValues = draftAllowlist.map(d => d.value);
            const { addresses, unresolved } = await resolveAllowlistEntries(draftValues);

            const signer = await provider.getSigner();
            const contract = getAllowlistContract(signer);
            const tx = await contract.setSessionAllowedVoters(allowlistSessionId, addresses);
            await tx.wait();

            await fetchSessionAllowlist(allowlistSessionId);
            toast.success(
                addresses.length > 0
                    ? `Daftar pemilih sesi ${allowlistSessionId} diperbarui (${addresses.length} wallet)`
                    : `Batasan pemilih sesi ${allowlistSessionId} dihapus (semua pemegang NFT bisa memilih)`
            );

            if (unresolved.length > 0) {
                const unresolvedText = unresolved
                    .map((item) => `${item.studentId} (${unresolvedReasonLabel(item.reason)})`)
                    .join(", ");
                toast.error(`Akun tidak dimasukkan: ${unresolvedText}`, { duration: 7000 });
            }
        } catch (err: any) {
            toast.error(err?.message || getRpcErrorMessage(err));
        }
        setAllowlistBusy(false);
    };

    const handleAddUser = async () => {
        if (!newUserName || !newUserStudentId || !newUserPassword) {
            toast.error("Isi semua field");
            return;
        }
        setLoading(true);
        try {
            const res = await authenticatedFetch(`${getApiBaseUrl()}/api/users/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: newUserName,
                    studentId: newUserStudentId,
                    password: newUserPassword
                })
            });

            const data = await res.json();
            if (res.ok) {
                toast.success("User berhasil dibuat");
                setNewUserName("");
                setNewUserStudentId("");
                setNewUserPassword("");
                fetchStudentDirectory(studentDirectoryQuery, true);
            } else {
                toast.error("Error: " + data.error);
            }
        } catch (err: any) {
            toast.error("Error: " + err.message);
        }
        setLoading(false);
    };

    const handleBulkImportUsers = async () => {
        if (!bulkImportFile) {
            toast.error("Pilih file CSV/Excel terlebih dahulu");
            return;
        }

        const filename = bulkImportFile.name.toLowerCase();
        if (!filename.endsWith(".csv") && !filename.endsWith(".xls") && !filename.endsWith(".xlsx")) {
            toast.error("Format file harus CSV, XLS, atau XLSX");
            return;
        }

        setBulkImportLoading(true);
        setBulkImportSummary(null);
        setBulkImportFailedRows([]);

        try {
            const formData = new FormData();
            formData.append("file", bulkImportFile);

            const res = await authenticatedFetch(`${getApiBaseUrl()}/api/users/bulk-import`, {
                method: "POST",
                body: formData
            });

            const data = await res.json();

            if (data?.summary) {
                setBulkImportSummary(data.summary as BulkImportSummary);
            }
            if (Array.isArray(data?.failed)) {
                setBulkImportFailedRows(data.failed as BulkImportFailure[]);
            }

            if (!res.ok || !data?.success) {
                throw new Error(data?.error || "Import akun gagal");
            }

            toast.success(data?.message || "Import akun berhasil");
            setBulkImportFile(null);
            setBulkImportInputKey((prev) => prev + 1);
            fetchStudentDirectory(studentDirectoryQuery, true);
        } catch (err: any) {
            toast.error(err?.message || "Import akun gagal");
        }

        setBulkImportLoading(false);
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleString('id-ID', {
            day: 'numeric', month: 'short', year: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const allowlistEntryCount = draftAllowlist.length;

    if (!isConnected) return <div className="text-center pt-20">Silakan hubungkan wallet admin</div>;

    return (
        <div className="min-h-screen bg-dark-900 pt-20 px-4 pb-20">
            <div className="max-w-6xl mx-auto space-y-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                    Dasbor Admin
                </h1>

                {/* Tabs Navigation */}
                <div className="flex justify-center mb-8">
                    <div className="bg-white/5 backdrop-blur-md p-1 rounded-xl border border-white/10 inline-flex shadow-lg overflow-x-auto max-w-full">
                        <button
                            onClick={() => setActiveTab("monitor")}
                            className={`px-4 sm:px-6 py-2 rounded-lg text-sm sm:text-base font-semibold transition-all whitespace-nowrap ${activeTab === "monitor"
                                ? "bg-blue-600 shadow-lg text-white"
                                : "text-gray-400 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            📊 Monitor Sesi
                        </button>
                        <button
                            onClick={() => setActiveTab("manage")}
                            className={`px-4 sm:px-6 py-2 rounded-lg text-sm sm:text-base font-semibold transition-all whitespace-nowrap ${activeTab === "manage"
                                ? "bg-purple-600 shadow-lg text-white"
                                : "text-gray-400 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            ⚙️ Manajemen Sesi
                        </button>
                        <button
                            onClick={() => setActiveTab("users")}
                            className={`px-4 sm:px-6 py-2 rounded-lg text-sm sm:text-base font-semibold transition-all whitespace-nowrap ${activeTab === "users"
                                ? "bg-emerald-600 shadow-lg text-white"
                                : "text-gray-400 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            👥 Pengguna
                        </button>
                    </div>
                </div>

                {/* Monitor Sesi Tab */}
                {activeTab === "monitor" && (
                    <div className="glass-panel p-4 sm:p-6 rounded-xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg sm:text-xl font-bold text-white">Monitor Sesi</h2>
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden sm:block overflow-x-auto -mx-2">
                            <table className="w-full text-left border-collapse min-w-[560px]">
                                <thead>
                                    <tr className="text-gray-400 border-b border-gray-700">
                                        <th className="p-3 text-xs uppercase tracking-wider">ID</th>
                                        <th className="p-3 text-xs uppercase tracking-wider">Nama Sesi</th>
                                        <th className="p-3 text-xs uppercase tracking-wider">Status</th>
                                        <th className="p-3 text-xs uppercase tracking-wider">Waktu</th>
                                        <th className="p-3 text-xs uppercase tracking-wider">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sessions.length === 0 ? (
                                        <tr><td colSpan={5} className="p-4 text-center text-gray-500">Belum ada sesi</td></tr>
                                    ) : (
                                        sessions.map((session) => (
                                            <tr key={session.id} className="border-b border-gray-800 hover:bg-white/5">
                                                <td className="p-3 font-mono text-gray-400 text-sm">#{session.id}</td>
                                                <td className="p-3 font-bold text-white text-sm max-w-[150px]">
                                                    <span className="block truncate" title={session.name}>{session.name}</span>
                                                </td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${session.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                                                        {session.isActive ? "AKTIF" : "SELESAI"}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-xs text-gray-400 whitespace-nowrap">
                                                    <div>▶ {formatTime(session.startTime)}</div>
                                                    <div>⏹ {formatTime(session.endTime)}</div>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => toggleSessionStatus(session.id, session.isActive)}
                                                            className={`px-3 py-1.5 rounded text-xs font-bold transition whitespace-nowrap ${session.isActive
                                                                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                                                : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                                                }`}
                                                        >
                                                            {session.isActive ? "STOP" : "START"}
                                                        </button>
                                                        <button
                                                            onClick={() => fetchSessionStats(session.id)}
                                                            className={`px-3 py-1.5 rounded text-xs font-bold transition whitespace-nowrap ${detailSessionId === session.id
                                                                ? "bg-purple-600 text-white"
                                                                : "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                                                                }`}
                                                        >
                                                            📊 Detail
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="sm:hidden space-y-3">
                            {sessions.length === 0 ? (
                                <p className="text-center text-gray-500 py-4">Belum ada sesi</p>
                            ) : (
                                sessions.map((session) => (
                                    <div key={session.id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                                        <div className="flex items-start justify-between gap-2 mb-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-white text-sm truncate" title={session.name}>{session.name}</p>
                                                <p className="text-gray-500 text-xs font-mono mt-0.5">ID: #{session.id}</p>
                                            </div>
                                            <span className={`flex-shrink-0 px-2 py-1 rounded text-xs font-bold ${session.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                                                {session.isActive ? "AKTIF" : "SELESAI"}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-400 space-y-0.5 mb-3">
                                            <div>▶ Mulai: {formatTime(session.startTime)}</div>
                                            <div>⏹ Akhir: {formatTime(session.endTime)}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => toggleSessionStatus(session.id, session.isActive)}
                                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${session.isActive
                                                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20"
                                                    : "bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/20"
                                                    }`}
                                            >
                                                {session.isActive ? "⏹ Hentikan" : "▶ Aktifkan"}
                                            </button>
                                            <button
                                                onClick={() => fetchSessionStats(session.id)}
                                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition border ${detailSessionId === session.id
                                                    ? "bg-purple-600 text-white border-purple-600"
                                                    : "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border-purple-500/20"
                                                    }`}
                                            >
                                                📊 Detail
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* ── Stats Panel (muncul saat Detail diklik) ── */}
                        {detailSessionId !== null && (
                            <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold text-gray-400">
                                        Statistik Sesi #{detailSessionId}{" — "}
                                        <span className="text-white">{sessions.find(s => s.id === detailSessionId)?.name}</span>
                                    </p>
                                    <button
                                        onClick={() => setDetailSessionId(null)}
                                        className="text-gray-500 hover:text-white text-sm transition"
                                    >✕ Tutup</button>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    <StatCard icon="🏛️" label="Pemilih Terdaftar" value={stats.totalNFTHolders}
                                        sub={stats.registeredLabel} color="blue" loading={stats.loading} />
                                    <StatCard icon="✅" label="Sudah Memilih" value={stats.uniqueVoterCount}
                                        sub="Dari sesi ini" color="green" loading={stats.loading} />
                                    <div className="col-span-2 sm:col-span-1">
                                        <StatCard icon="📊" label="Partisipasi"
                                            value={`${stats.participationRate}%`}
                                            sub="Voter aktif / Terdaftar"
                                            color={Number(stats.participationRate) >= 70 ? "green" : Number(stats.participationRate) >= 40 ? "blue" : "amber"}
                                            loading={stats.loading} />
                                    </div>
                                </div>
                                <ParticipationMeter
                                    rate={Number(stats.participationRate)}
                                    loading={stats.loading}
                                    denominatorLabel={stats.registeredLabel}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Manajemen Sesi Tab */}
                {activeTab === "manage" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in zoom-in-95 duration-200">
                        {/* Create Session */}
                        <div className="glass-panel p-4 sm:p-6 rounded-xl">
                            <h2 className="text-lg sm:text-xl font-bold mb-4 text-white">Buat Sesi Baru</h2>
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    placeholder="Nama Sesi (cth. Pemira BEM 2026)"
                                    value={sessionName}
                                    onChange={(e) => setSessionName(e.target.value)}
                                    className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 text-white text-sm"
                                />
                                <textarea
                                    placeholder="Deskripsi sesi..."
                                    rows={3}
                                    value={sessionDesc}
                                    onChange={(e) => setSessionDesc(e.target.value)}
                                    className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 text-white text-sm resize-none"
                                />
                                <div className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-2.5">
                                    <span className="text-gray-400 text-sm flex-1">Durasi (hari):</span>
                                    <input
                                        type="number"
                                        min={1}
                                        value={sessionDuration}
                                        onChange={(e) => setSessionDuration(Number(e.target.value))}
                                        className="w-20 bg-dark-800 border border-gray-700 rounded-lg px-3 py-1.5 text-center focus:outline-none focus:border-blue-500 text-white text-sm"
                                    />
                                </div>
                                <button
                                    onClick={createSession}
                                    disabled={loading}
                                    className="w-full py-3 rounded-lg font-bold transition bg-green-600 hover:bg-green-500 text-white text-sm disabled:opacity-50"
                                >
                                    {loading ? "Membuat..." : "✓ Buat Sesi"}
                                </button>
                            </div>
                        </div>

                        {/* Add Candidate */}
                        <div className="glass-panel p-4 sm:p-6 rounded-xl">
                            <h2 className="text-lg sm:text-xl font-bold mb-4 text-white">Tambah Kandidat</h2>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-2.5">
                                    <span className="text-gray-400 text-sm flex-shrink-0">ID Sesi:</span>
                                    <input
                                        type="number"
                                        placeholder="1"
                                        value={targetSessionId}
                                        onChange={(e) => setTargetSessionId(Number(e.target.value))}
                                        className="flex-1 bg-transparent focus:outline-none text-white text-sm"
                                    />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Nama Kandidat"
                                    value={candidateName}
                                    onChange={(e) => setCandidateName(e.target.value)}
                                    className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 text-white text-sm"
                                />
                                <div className="space-y-2">
                                    <label className="text-gray-400 text-sm">Foto Kandidat (Upload atau URL)</label>
                                    <div className="flex flex-col gap-2">
                                        {!candidatePhotoUrl ? (
                                            <>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        const formData = new FormData();
                                                        formData.append('image', file);
                                                        setLoading(true);
                                                        try {
                                                            const res = await authenticatedFetch(`${getApiBaseUrl()}/api/upload`, {
                                                                method: 'POST',
                                                                body: formData
                                                            });
                                                            const data = await res.json();
                                                            if (data.success) {
                                                                setCandidatePhotoUrl(data.url);
                                                                toast.success("Foto berhasil diunggah");
                                                            } else {
                                                                toast.error("Upload gagal: " + data.error);
                                                            }
                                                        } catch (err) {
                                                            console.error(err);
                                                            toast.error("Upload gagal");
                                                        }
                                                        setLoading(false);
                                                        // Reset input so we can upload again if needed
                                                        e.target.value = '';
                                                    }}
                                                    className="text-white text-sm bg-white/5 border border-gray-700 rounded-lg px-3 py-2 w-full file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-600/30 file:text-blue-300 hover:file:bg-blue-600/50"
                                                />
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-px bg-gray-700"></div>
                                                    <span className="text-gray-500 text-xs">atau URL</span>
                                                    <div className="flex-1 h-px bg-gray-700"></div>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="https://example.com/photo.jpg"
                                                    value={candidatePhotoUrl}
                                                    onChange={(e) => setCandidatePhotoUrl(e.target.value)}
                                                    className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 text-white text-sm"
                                                />
                                            </>
                                        ) : (
                                            <div className="flex items-center justify-between mt-2 p-3 bg-white/5 rounded-lg border border-gray-700">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <img src={getValidImageUrl(candidatePhotoUrl)} alt="Preview" className="w-14 h-14 object-cover rounded-lg border border-gray-600 flex-shrink-0" />
                                                    <p className="text-gray-400 text-xs truncate">Foto Kandidat Terpilih</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setCandidatePhotoUrl("")}
                                                    className="flex-shrink-0 bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 text-xs font-bold px-3 py-2 rounded-lg transition"
                                                >
                                                    Hapus Foto
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <textarea
                                    placeholder="Visi kandidat..."
                                    rows={2}
                                    value={candidateVision}
                                    onChange={(e) => setCandidateVision(e.target.value)}
                                    className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 text-white text-sm resize-none"
                                />
                                <textarea
                                    placeholder="Misi kandidat..."
                                    rows={2}
                                    value={candidateMission}
                                    onChange={(e) => setCandidateMission(e.target.value)}
                                    className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 text-white text-sm resize-none"
                                />
                                <button
                                    onClick={addCandidate}
                                    disabled={loading}
                                    className="w-full py-3 rounded-lg font-bold transition bg-blue-600 hover:bg-blue-500 text-white text-sm disabled:opacity-50"
                                >
                                    {loading ? "Menambahkan..." : "+ Tambah Kandidat"}
                                </button>
                            </div>
                        </div>

                        {/* Session Voter Allowlist */}
                        <div className="glass-panel p-4 sm:p-6 rounded-xl md:col-span-2">
                            <h2 className="text-lg sm:text-xl font-bold mb-2 text-white">Batas Pemilih per Sesi</h2>
                            <p className="text-sm text-gray-400 mb-4">
                                Cari mahasiswa dan tambahkan ke daftar *draft*. Jika daftar kosong, semua pemegang Student NFT bisa memilih di sesi ini.
                            </p>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Left Side: Search & Add */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-2.5 border border-white/10">
                                        <span className="text-gray-400 text-sm font-semibold">ID Sesi:</span>
                                        <input
                                            type="number"
                                            min={1}
                                            value={allowlistSessionId}
                                            onChange={(e) => setAllowlistSessionId(Number(e.target.value))}
                                            className="flex-1 bg-transparent focus:outline-none text-white text-sm font-mono"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fetchSessionAllowlist(allowlistSessionId)}
                                            className="text-xs px-3 py-1.5 rounded bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 font-bold transition"
                                        >
                                            Muat Ulang Sesi
                                        </button>
                                    </div>

                                    <div className="bg-black/20 border border-white/5 rounded-xl p-4 space-y-3">
                                        <input
                                            type="text"
                                            placeholder="Cari Nama atau NIM Mahasiswa..."
                                            value={studentDirectoryQuery}
                                            onChange={(e) => setStudentDirectoryQuery(e.target.value)}
                                            className="w-full bg-dark-800 border border-gray-700/50 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                        />

                                        <div className="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                            {studentDirectoryLoading ? (
                                                <p className="text-xs text-gray-500 text-center py-4">Mencari...</p>
                                            ) : studentDirectory.length === 0 ? (
                                                <p className="text-xs text-gray-500 text-center py-4">Ketik nama/NIM untuk mencari.</p>
                                            ) : (
                                                studentDirectory.map((student) => {
                                                    const isAdded = !!(draftAllowlist.some(d => d.value === student.studentId) || (student.claimedBy && draftAllowlist.some(d => d.value === student.claimedBy!.toLowerCase())));

                                                    return (
                                                        <div key={student.studentId} className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition group">
                                                            <div className="min-w-0 pr-2">
                                                                <p className="text-sm font-semibold text-white truncate">{student.name}</p>
                                                                <div className="flex gap-2 text-xs font-mono text-gray-400 mt-1">
                                                                    <span>{student.studentId}</span>
                                                                    {student.claimedBy ? (
                                                                        <span className="text-emerald-400/80">({formatShortAddress(student.claimedBy)})</span>
                                                                    ) : (
                                                                        <span className="text-amber-400/80">(No Wallet)</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    const toAdd = student.claimedBy ? student.claimedBy.toLowerCase() : student.studentId;
                                                                    if (!draftAllowlist.some(d => d.value === toAdd)) {
                                                                        setDraftAllowlist([...draftAllowlist, { value: toAdd, label: student.name }]);
                                                                    }
                                                                }}
                                                                disabled={isAdded}
                                                                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition ${isAdded
                                                                    ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                                                                    : 'bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/30'
                                                                    }`}
                                                            >
                                                                {isAdded ? '✓ Ditambahkan' : '+ Tambah'}
                                                            </button>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Draft List & Actions */}
                                <div className="space-y-4 flex flex-col h-full">
                                    <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col min-h-[250px]">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="text-sm font-bold text-white">Draft Pemilih (Sesi #{allowlistSessionId})</h3>
                                                <p className="text-xs text-gray-400 mt-0.5">{allowlistEntryCount} entri dipilih</p>
                                            </div>
                                            {draftAllowlist.length > 0 && (
                                                <button
                                                    onClick={() => setDraftAllowlist([])}
                                                    className="text-xs text-red-400 hover:text-red-300 hover:underline"
                                                >
                                                    Bersihkan Semua
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex-1 overflow-y-auto custom-scrollbar border border-white/5 rounded-lg bg-black/20 p-3">
                                            {draftAllowlist.length === 0 ? (
                                                <div className="h-full flex items-center justify-center">
                                                    <p className="text-sm text-gray-500 text-center px-4">
                                                        Draft kosong. Semua mahasiswa bisa memilih.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap gap-2">
                                                    {draftAllowlist.map((entry, idx) => (
                                                        <div key={idx} className="flex items-center gap-2 bg-blue-900/30 border border-blue-500/30 text-blue-100 px-3 py-1.5 rounded-full text-xs font-semibold group">
                                                            <span className="truncate max-w-[150px]" title={entry.value}>
                                                                {entry.label}
                                                            </span>
                                                            <button
                                                                onClick={() => setDraftAllowlist(draftAllowlist.filter(e => e.value !== entry.value))}
                                                                className="text-white/40 hover:text-red-400 hover:bg-red-500/20 rounded-full w-5 h-5 flex items-center justify-center transition"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-2 relative">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={saveSessionAllowlist}
                                                    disabled={allowlistBusy}
                                                    className="flex-1 py-3 rounded-lg font-bold transition bg-blue-600 hover:bg-blue-500 text-white text-sm disabled:opacity-50 shadow-lg shadow-blue-500/20"
                                                >
                                                    {allowlistBusy ? "Menyimpan ke Blockchain..." : "Simpan ke Blockchain"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDraftAllowlist(allowlistAddresses.map(addr => ({ value: addr, label: formatShortAddress(addr) })))}
                                                    title="Kembalikan draft seperti daftar yang tersimpan di Blockchain."
                                                    className="px-4 py-3 rounded-lg font-semibold transition bg-white/10 hover:bg-white/20 text-gray-300 text-sm whitespace-nowrap border border-white/10"
                                                >
                                                    Reset
                                                </button>
                                            </div>
                                            <div className="text-center mt-1">
                                                {allowlistAddresses.length === 0 && draftAllowlist.length > 0 && (
                                                    <span className="text-[10px] text-amber-400 font-bold bg-amber-400/10 px-2 py-1 rounded inline-block">Membatasi ke {draftAllowlist.length} pemilih.</span>
                                                )}
                                                {allowlistAddresses.length > 0 && draftAllowlist.length === 0 && (
                                                    <span className="text-[10px] text-red-400 font-bold bg-red-400/10 px-2 py-1 rounded inline-block">Menghapus batas! Semua akun bisa memilih.</span>
                                                )}
                                                {allowlistAddresses.length > 0 && draftAllowlist.length > 0 && (
                                                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-400/10 px-2 py-1 rounded inline-block">Update batas ke {draftAllowlist.length} pemilih.</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Pengguna Tab */}
                {activeTab === "users" && (
                    <div className="grid grid-cols-1 gap-6 animate-in fade-in zoom-in-95 duration-200">
                        {/* User Management */}
                        <div className="glass-panel p-6 rounded-xl max-w-3xl mx-auto w-full mt-4">
                            <h2 className="text-xl font-bold mb-4 text-white">Tambah Voter Baru</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <input
                                    type="text"
                                    placeholder="Nama Lengkap"
                                    value={newUserName}
                                    onChange={(e) => setNewUserName(e.target.value)}
                                    className="bg-dark-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 text-white text-sm"
                                />
                                <input
                                    type="text"
                                    placeholder="NIM (Username)"
                                    value={newUserStudentId}
                                    onChange={(e) => setNewUserStudentId(e.target.value)}
                                    className="bg-dark-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 text-white text-sm"
                                />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={newUserPassword}
                                    onChange={(e) => setNewUserPassword(e.target.value)}
                                    className="bg-dark-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 text-white text-sm"
                                />
                            </div>
                            <button
                                onClick={handleAddUser}
                                disabled={loading}
                                className={`w-full mt-4 py-3 rounded-lg font-bold transition bg-purple-600 hover:bg-purple-500 text-white`}
                            >
                                {loading ? "Membuat User..." : "Buat User Baru"}
                            </button>

                            <div className="mt-8 pt-6 border-t border-white/10">
                                <h3 className="text-lg font-bold text-white">Import Massal (CSV / Excel)</h3>
                                <p className="text-sm text-gray-400 mt-1">
                                    Kolom wajib: <span className="font-mono text-gray-300">studentId/nim</span> dan <span className="font-mono text-gray-300">name/nama</span>. Semua akun hasil import akan memakai password default <span className="font-mono text-gray-300">password123</span>.
                                </p>

                                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                                    <input
                                        key={bulkImportInputKey}
                                        type="file"
                                        accept=".csv,.xls,.xlsx"
                                        onChange={(e) => setBulkImportFile(e.target.files?.[0] || null)}
                                        className="flex-1 bg-dark-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleBulkImportUsers}
                                        disabled={bulkImportLoading}
                                        className="px-5 py-2.5 rounded-lg font-bold transition bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                                    >
                                        {bulkImportLoading ? "Mengimpor..." : "Import Akun"}
                                    </button>
                                </div>

                                {bulkImportSummary && (
                                    <div className="mt-4 bg-white/5 border border-white/10 rounded-lg p-3 text-sm">
                                        <p className="text-white font-semibold">Ringkasan Import</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                                            <p className="text-gray-300">Total Baris: <span className="text-white font-bold">{bulkImportSummary.totalRows}</span></p>
                                            <p className="text-emerald-300">Berhasil: <span className="font-bold">{bulkImportSummary.created}</span></p>
                                            <p className="text-red-300">Gagal: <span className="font-bold">{bulkImportSummary.failed}</span></p>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-2">
                                            Password default: <span className="font-mono text-white">{bulkImportSummary.defaultPassword || "password123"}</span>
                                        </p>
                                    </div>
                                )}

                                {bulkImportFailedRows.length > 0 && (
                                    <div className="mt-3 bg-red-950/30 border border-red-500/30 rounded-lg p-3 max-h-56 overflow-y-auto">
                                        <p className="text-sm font-semibold text-red-300 mb-2">Baris Gagal</p>
                                        <div className="space-y-1.5 text-xs">
                                            {bulkImportFailedRows.map((item, index) => (
                                                <p key={`${item.line}-${item.studentId || "empty"}-${index}`} className="text-red-200">
                                                    Baris {item.line}
                                                    {item.studentId ? ` (${item.studentId})` : ""}: {item.reason}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {
                isStudentPickerOpen && (
                    <div
                        className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center"
                        onClick={() => setIsStudentPickerOpen(false)}
                    >
                        <div
                            className="w-full max-w-3xl max-h-[85vh] bg-dark-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                                <div>
                                    <h3 className="text-lg font-bold text-white">Pilih Mahasiswa</h3>
                                    <p className="text-xs text-gray-400">
                                        Klik +NIM atau +Wallet untuk menambah ke input whitelist sesi #{allowlistSessionId}.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsStudentPickerOpen(false)}
                                    className="text-sm px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-gray-300"
                                >
                                    Tutup
                                </button>
                            </div>

                            <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row gap-2">
                                <input
                                    type="text"
                                    placeholder="Cari nama atau NIM..."
                                    value={studentDirectoryQuery}
                                    onChange={(e) => setStudentDirectoryQuery(e.target.value)}
                                    className="flex-1 bg-dark-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => fetchStudentDirectory(studentDirectoryQuery)}
                                    className="text-sm px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-gray-300"
                                >
                                    Muat Ulang
                                </button>
                            </div>

                            <div className="p-4 overflow-y-auto max-h-[56vh]">
                                {studentDirectoryLoading ? (
                                    <p className="text-sm text-gray-500">Memuat daftar mahasiswa...</p>
                                ) : studentDirectory.length === 0 ? (
                                    <p className="text-sm text-gray-500">Mahasiswa tidak ditemukan.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {studentDirectory.map((student) => (
                                            <div key={student.studentId} className="bg-black/20 border border-white/10 rounded-lg p-2.5">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm text-white font-semibold truncate">{student.name}</p>
                                                        <p className="text-xs text-gray-400">NIM: {student.studentId}</p>
                                                        <p className={`text-xs mt-1 ${student.claimedBy ? "text-emerald-400" : "text-amber-400"}`}>
                                                            {student.claimedBy ? `Wallet: ${formatShortAddress(student.claimedBy)}` : "Wallet belum di-bind"}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col gap-1 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (!draftAllowlist.some(d => d.value === student.studentId)) {
                                                                    setDraftAllowlist([...draftAllowlist, { value: student.studentId, label: student.name }]);
                                                                }
                                                            }}
                                                            className="text-xs px-2 py-1 rounded bg-blue-600/30 hover:bg-blue-600/50 text-blue-200"
                                                        >
                                                            + NIM
                                                        </button>
                                                        {student.claimedBy && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const wallet = student.claimedBy!.toLowerCase();
                                                                    if (!draftAllowlist.some(d => d.value === wallet)) {
                                                                        setDraftAllowlist([...draftAllowlist, { value: wallet, label: student.name }]);
                                                                    }
                                                                }}
                                                                className="text-xs px-2 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200"
                                                            >
                                                                + Wallet
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
