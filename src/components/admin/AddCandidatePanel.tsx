"use client";

import Image from "next/image";
import toast from "react-hot-toast";
import { getValidImageUrl } from "../../utils/image";
import { uploadAdminImage } from "../../utils/api";

const FALLBACK_CANDIDATE_IMAGE =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' rx='24' fill='%23111827'/%3E%3Ccircle cx='80' cy='62' r='28' fill='%233b82f6' fill-opacity='0.85'/%3E%3Cpath d='M38 130c8-23 29-36 42-36s34 13 42 36' fill='%233b82f6' fill-opacity='0.55'/%3E%3C/svg%3E";

export function AddCandidatePanel({
    targetSessionId,
    setTargetSessionId,
    candidateName,
    setCandidateName,
    candidatePhotoUrl,
    setCandidatePhotoUrl,
    candidateVision,
    setCandidateVision,
    candidateMission,
    setCandidateMission,
    loading,
    setLoading,
    onAddCandidate,
}: {
    targetSessionId: number;
    setTargetSessionId: (v: number) => void;
    candidateName: string;
    setCandidateName: (v: string) => void;
    candidatePhotoUrl: string;
    setCandidatePhotoUrl: (v: string) => void;
    candidateVision: string;
    setCandidateVision: (v: string) => void;
    candidateMission: string;
    setCandidateMission: (v: string) => void;
    loading: boolean;
    setLoading: (v: boolean) => void;
    onAddCandidate: () => void;
}) {
    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setLoading(true);
        try {
            const result = await uploadAdminImage(file);
            if (result.success) {
                setCandidatePhotoUrl(result.url);
                toast.success("Foto berhasil diunggah");
            } else {
                toast.error(result.error || "Upload gagal");
            }
        } catch (err) {
            console.error(err);
            toast.error("Upload gagal");
        }
        setLoading(false);
    };

    return (
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
                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                    onChange={handleFile}
                                    className="text-white text-sm bg-white/5 border border-gray-700 rounded-lg px-3 py-2 w-full file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-600/30 file:text-blue-300 hover:file:bg-blue-600/50"
                                />
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-px bg-gray-700" />
                                    <span className="text-gray-500 text-xs">atau URL</span>
                                    <div className="flex-1 h-px bg-gray-700" />
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
                                    <Image
                                        src={getValidImageUrl(candidatePhotoUrl) || FALLBACK_CANDIDATE_IMAGE}
                                        alt="Preview"
                                        width={56}
                                        height={56}
                                        className="w-14 h-14 object-cover rounded-lg border border-gray-600 flex-shrink-0"
                                        unoptimized
                                    />
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
                    type="button"
                    onClick={onAddCandidate}
                    disabled={loading}
                    className="w-full py-3 rounded-lg font-bold transition bg-blue-600 hover:bg-blue-500 text-white text-sm disabled:opacity-50"
                >
                    {loading ? "Menambahkan..." : "+ Tambah Kandidat"}
                </button>
            </div>
        </div>
    );
}
