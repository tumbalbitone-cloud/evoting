/**
 * Token storage and validation (no fetch — HTTP lives in api.ts).
 */
import { getApiBaseUrl } from "./apiConfig";

const TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";
const ROLE_KEY = "role";
const USERNAME_KEY = "username";
const REFRESH_PATH = "/api/auth/refresh";
const JWT_SEGMENT_COUNT = 3;
const TOKEN_EXPIRY_BUFFER_SECONDS = 60;

export const isValidJWT = (token: string | null): boolean => {
  if (!token) {
    return false;
  }

  return token.split(".").length === JWT_SEGMENT_COUNT;
};

export const isMockToken = (token: string | null): boolean => {
  if (!token) {
    return false;
  }

  return token === "mock-admin-token" || token === "mock-user-token" || token === "mock-jwt-token";
};

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USERNAME_KEY);
};

export const getValidToken = (): string | null => {
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    return null;
  }

  if (isMockToken(token)) {
    console.warn("Token mock lama terdeteksi. Silakan login kembali.");
    clearAuth();
    return null;
  }

  if (!isValidJWT(token)) {
    console.warn("Format token tidak valid. Silakan login kembali.");
    clearAuth();
    return null;
  }

  return token;
};

let refreshInFlight: Promise<string | null> | null = null;

export const refreshAccessToken = async (): Promise<string | null> => {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async (): Promise<string | null> => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

    if (!refreshToken) {
      return null;
    }

    try {
      const endpoint = `${getApiBaseUrl().replace(/\/$/, "")}${REFRESH_PATH}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.status === 401) {
        clearAuth();
        return null;
      }

      if (!response.ok) {
        throw new Error("Gagal memperbarui token");
      }

      const data = await response.json();

      if (data.success && data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        return data.token;
      }

      return null;
    } catch (error) {
      console.error("Gagal memperbarui token:", error);

      if (error instanceof TypeError) {
        return null;
      }

      clearAuth();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4 || 4)) % 4), "=");
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
  if (!token || !isValidJWT(token)) {
    return true;
  }

  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;

  if (typeof exp !== "number") {
    return true;
  }

  const now = Math.floor(Date.now() / 1000);
  return exp < now + TOKEN_EXPIRY_BUFFER_SECONDS;
};
