/**
 * Auth state helpers.
 *
 * SECURITY NOTE:
 * Access tokens and refresh tokens are now stored exclusively in httpOnly cookies
 * set by the backend. They are never accessible from JavaScript, which mitigates XSS.
 *
 * Only non-sensitive UI state (role, username) is kept in localStorage so the
 * Navbar and other components can display user info without a network round-trip.
 */
import { getApiBaseUrl } from "./apiConfig";

const ROLE_KEY = "role";
const USERNAME_KEY = "username";
const REFRESH_PATH = "/api/auth/refresh";

// ─── localStorage helpers (UI state only — NOT tokens) ───────────────────────

export const clearAuth = () => {
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USERNAME_KEY);
};

export const getStoredRole = (): string | null =>
  typeof window !== "undefined" ? localStorage.getItem(ROLE_KEY) : null;

export const getStoredUsername = (): string | null =>
  typeof window !== "undefined" ? localStorage.getItem(USERNAME_KEY) : null;

// ─── Token validation helpers (operate on a raw JWT string) ──────────────────

const JWT_SEGMENT_COUNT = 3;
const TOKEN_EXPIRY_BUFFER_SECONDS = 60;

export const isValidJWT = (token: string | null): boolean => {
  if (!token) return false;
  return token.split(".").length === JWT_SEGMENT_COUNT;
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4 || 4)) % 4),
      "="
    );
    const decoded =
      typeof globalThis.atob === "function"
        ? globalThis.atob(padded)
        : Buffer.from(padded, "base64").toString("utf-8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const isTokenExpired = (token: string | null): boolean => {
  if (!token || !isValidJWT(token)) return true;
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== "number") return true;
  const now = Math.floor(Date.now() / 1000);
  return exp < now + TOKEN_EXPIRY_BUFFER_SECONDS;
};

// ─── Stub kept for backward-compatibility (used by WalletContext) ─────────────
/**
 * @deprecated Tokens live in httpOnly cookies — there is no valid token in JS.
 * Returns null always. Use `getStoredUsername()` to check login state instead.
 */
export const getValidToken = (): string | null => null;

// ─── Refresh access token via httpOnly cookie ─────────────────────────────────

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Ask the backend to rotate the refresh token cookie and issue a new access
 * token cookie. Uses `credentials: 'include'` so the browser automatically
 * sends and receives the httpOnly cookies.
 *
 * Returns true if the refresh succeeded, false otherwise.
 */
export const refreshAccessToken = async (): Promise<boolean> => {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async (): Promise<boolean> => {
    try {
      const endpoint = `${getApiBaseUrl().replace(/\/$/, "")}${REFRESH_PATH}`;
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include", // send & receive httpOnly cookies
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        // 401 = refresh token expired / revoked — clear UI state
        if (response.status === 401) {
          clearAuth();
          window.dispatchEvent(new Event("auth-change"));
        }
        return false;
      }

      return true;
    } catch (error) {
      console.error("Gagal memperbarui token:", error);
      if (error instanceof TypeError) {
        // Network error — don't clear auth; might be transient
        return false;
      }
      clearAuth();
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
};
