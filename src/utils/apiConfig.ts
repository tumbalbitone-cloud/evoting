/**
 * API base URL only — no auth or fetch (avoids circular imports with auth.ts).
 */
export const getApiBaseUrl = (): string => {
  return process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URI || "http://localhost:3001";
};
