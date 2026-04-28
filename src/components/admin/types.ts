export interface Session {
    id: number;
    name: string;
    description: string;
    startTime: number;
    endTime: number;
    isActive: boolean;
}

export interface SessionStats {
    totalNFTHolders: number;
    uniqueVoterCount: number;
    participationRate: string;
    registeredLabel: string;
    loading: boolean;
}

export interface ResolvedVoter {
    studentId: string;
    name: string;
    address: string;
}

export interface UnresolvedVoter {
    studentId: string;
    name?: string;
    reason: string;
}

export interface StudentDirectoryItem {
    studentId: string;
    name: string;
    active: boolean;
    claimedBy: string | null;
}

export interface BulkImportFailure {
    line: number;
    studentId: string | null;
    reason: string;
}

export interface BulkImportSummary {
    totalRows: number;
    created: number;
    failed: number;
}

export type AdminTab = "monitor" | "manage" | "users" | "admin-management";

export interface AdminAccount {
    id: string;
    username: string;
    name: string;
    active: boolean;
}
