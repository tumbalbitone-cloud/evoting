"use client";

import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "../../context/WalletContext";
import VotingArtifact from "../../contracts/Voting.json";

import { useRouter } from "next/navigation";

interface Session {
    id: number;
    name: string;
    description: string;
    startTime: number;
    endTime: number;
    isActive: boolean;
}

export default function AdminPage() {
    const { account, provider, isConnected } = useWallet();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Session State
    const [sessionName, setSessionName] = useState("");
    const [sessionDesc, setSessionDesc] = useState("");
    const [sessionDuration, setSessionDuration] = useState(7); // Days

    // Session Monitoring State
    const [sessions, setSessions] = useState<Session[]>([]);

    // Candidate State
    const [candidateName, setCandidateName] = useState("");
    const [targetSessionId, setTargetSessionId] = useState(1);

    // User Management State
    const [newUserName, setNewUserName] = useState("");
    const [newUserStudentId, setNewUserStudentId] = useState("");
    const [newUserPassword, setNewUserPassword] = useState("");

    useEffect(() => {
        // Simple Role Check (Security should be done on backend/contract too)
        const role = localStorage.getItem("role");
        if (role !== 'admin') {
            router.push('/');
        }
    }, [router]);

    useEffect(() => {
        if (provider) {
            fetchSessions();
        }
    }, [provider]);

    const fetchSessions = async () => {
        try {
            const readProvider = provider || new ethers.JsonRpcProvider("http://localhost:8545");
            const contract = new ethers.Contract(
                process.env.NEXT_PUBLIC_VOTING_CONTRACT_ADDRESS!,
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

            // Sort by ID desc (newest first)
            formattedSessions.sort((a: Session, b: Session) => b.id - a.id);
            setSessions(formattedSessions);
        } catch (err) {
            console.error("Error fetching sessions:", err);
        }
    };

    const createSession = async () => {
        if (!provider || !sessionName) return;
        setLoading(true);
        try {
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(
                process.env.NEXT_PUBLIC_VOTING_CONTRACT_ADDRESS!,
                VotingArtifact.abi,
                signer
            );

            const now = Math.floor(Date.now() / 1000);
            const durationSeconds = sessionDuration * 24 * 60 * 60;
            const endTime = now + durationSeconds;

            const tx = await contract.createSession(sessionName, sessionDesc, now, endTime);
            await tx.wait();
            alert(`Session "${sessionName}" Created!`);
            setSessionName("");
            setSessionDesc("");
            fetchSessions(); // Refresh list
        } catch (err: any) {
            alert("Error: " + (err.reason || err.message));
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
                process.env.NEXT_PUBLIC_VOTING_CONTRACT_ADDRESS!,
                VotingArtifact.abi,
                signer
            );

            const tx = await contract.setSessionStatus(sessionId, !currentStatus);
            await tx.wait();
            alert(`Session ${sessionId} status updated!`);
            fetchSessions(); // Refresh list
        } catch (err: any) {
            alert("Error: " + (err.reason || err.message));
        }
        setLoading(false);
    };

    const addCandidate = async () => {
        if (!provider || !candidateName || !targetSessionId) return;
        setLoading(true);
        try {
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(
                process.env.NEXT_PUBLIC_VOTING_CONTRACT_ADDRESS!,
                VotingArtifact.abi,
                signer
            );

            const tx = await contract.addCandidate(targetSessionId, candidateName);
            await tx.wait();
            alert(`Candidate "${candidateName}" Added to Session ${targetSessionId}!`);
            setCandidateName("");
        } catch (err: any) {
            alert("Error: " + (err.reason || err.message));
        }
        setLoading(false);
    };

    const handleAddUser = async () => {
        if (!newUserName || !newUserStudentId || !newUserPassword) {
            alert("Please fill all fields");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('http://localhost:3001/api/users/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-role': 'admin' // Mock admin check
                },
                body: JSON.stringify({
                    name: newUserName,
                    studentId: newUserStudentId,
                    password: newUserPassword
                })
            });

            const data = await res.json();
            if (res.ok) {
                alert("User Created Successfully!");
                setNewUserName("");
                setNewUserStudentId("");
                setNewUserPassword("");
            } else {
                alert("Error: " + data.error);
            }
        } catch (err: any) {
            alert("Error: " + err.message);
        }
        setLoading(false);
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleString();
    };

    if (!isConnected) return <div className="text-center pt-20">Please Connect Admin Wallet</div>;

    return (
        <div className="min-h-screen bg-dark-900 pt-20 px-4 pb-20">
            <div className="max-w-6xl mx-auto space-y-8">
                <h1 className="text-3xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                    Admin Dashboard
                </h1>

                {/* Session Monitoring Table */}
                <div className="glass-panel p-6 rounded-xl">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-white">Monitor Active Sessions</h2>
                        <button onClick={fetchSessions} className="text-sm text-blue-400 hover:text-blue-300">Refresh</button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-gray-400 border-b border-gray-700">
                                    <th className="p-3">ID</th>
                                    <th className="p-3">Name</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3">Duration</th>
                                    <th className="p-3">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.length === 0 ? (
                                    <tr><td colSpan={5} className="p-4 text-center text-gray-500">No sessions found</td></tr>
                                ) : (
                                    sessions.map((session) => (
                                        <tr key={session.id} className="border-b border-gray-800 hover:bg-white/5">
                                            <td className="p-3 font-mono text-gray-400">#{session.id}</td>
                                            <td className="p-3 font-bold text-white">{session.name}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${session.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                                                    {session.isActive ? "ACTIVE" : "ENDED"}
                                                </span>
                                            </td>
                                            <td className="p-3 text-sm text-gray-400">
                                                <div>Start: {formatTime(session.startTime)}</div>
                                                <div>End: {formatTime(session.endTime)}</div>
                                            </td>
                                            <td className="p-3">
                                                <button
                                                    onClick={() => toggleSessionStatus(session.id, session.isActive)}
                                                    className={`px-3 py-1 rounded text-sm font-bold transition ${session.isActive
                                                        ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                                        : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                                        }`}
                                                >
                                                    {session.isActive ? "STOP" : "START"}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Create Session */}
                    <div className="glass-panel p-6 rounded-xl">
                        <h2 className="text-xl font-bold mb-4 text-white">Create New Session</h2>
                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="Session Name (e.g. Student Council 2026)"
                                value={sessionName}
                                onChange={(e) => setSessionName(e.target.value)}
                                className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 text-white"
                            />
                            <textarea
                                placeholder="Description"
                                value={sessionDesc}
                                onChange={(e) => setSessionDesc(e.target.value)}
                                className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 text-white"
                            />
                            <div className="flex items-center gap-2">
                                <span className="text-gray-400 text-sm">Duration (Days):</span>
                                <input
                                    type="number"
                                    value={sessionDuration}
                                    onChange={(e) => setSessionDuration(Number(e.target.value))}
                                    className="w-20 bg-dark-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 text-white"
                                />
                            </div>
                            <button
                                onClick={createSession}
                                disabled={loading}
                                className="w-full py-3 rounded-lg font-bold transition bg-green-600 hover:bg-green-500 text-white"
                            >
                                {loading ? "Creating..." : "Create Session"}
                            </button>
                        </div>
                    </div>

                    {/* Add Candidate */}
                    <div className="glass-panel p-6 rounded-xl">
                        <h2 className="text-xl font-bold mb-4 text-white">Add Candidate to Session</h2>
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <span className="text-gray-400 text-sm">Session ID:</span>
                                <input
                                    type="number"
                                    placeholder="ID"
                                    value={targetSessionId}
                                    onChange={(e) => setTargetSessionId(Number(e.target.value))}
                                    className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 text-white"
                                />
                            </div>
                            <input
                                type="text"
                                placeholder="Candidate Name"
                                value={candidateName}
                                onChange={(e) => setCandidateName(e.target.value)}
                                className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 text-white"
                            />
                            <button
                                onClick={addCandidate}
                                disabled={loading}
                                className="w-full py-3 rounded-lg font-bold transition bg-blue-600 hover:bg-blue-500 text-white"
                            >
                                {loading ? "Adding..." : "Add Candidate"}
                            </button>
                        </div>
                    </div>

                    {/* User Management */}
                    <div className="glass-panel p-6 rounded-xl md:col-span-2">
                        <h2 className="text-xl font-bold mb-4 text-white">Add New Voter</h2>
                        <div className="grid md:grid-cols-3 gap-4">
                            <input
                                type="text"
                                placeholder="Full Name"
                                value={newUserName}
                                onChange={(e) => setNewUserName(e.target.value)}
                                className="bg-dark-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 text-white"
                            />
                            <input
                                type="text"
                                placeholder="Student ID (Username)"
                                value={newUserStudentId}
                                onChange={(e) => setNewUserStudentId(e.target.value)}
                                className="bg-dark-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 text-white"
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                value={newUserPassword}
                                onChange={(e) => setNewUserPassword(e.target.value)}
                                className="bg-dark-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 text-white"
                            />
                        </div>
                        <button
                            onClick={handleAddUser}
                            disabled={loading}
                            className={`w-full mt-4 py-3 rounded-lg font-bold transition bg-purple-600 hover:bg-purple-500 text-white`}
                        >
                            {loading ? "Creating User..." : "Create User"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
