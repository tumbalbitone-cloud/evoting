import { getApiBaseUrl } from "./apiConfig";
import { getValidToken, isTokenExpired, refreshAccessToken, clearAuth } from "./auth";

export { getApiBaseUrl } from "./apiConfig";

type UploadAdminImageResult =
  | { success: true; url: string; filename: string }
  | { success: false; error: string };

const isAbsoluteUrl = (value: string): boolean => {
  return value.startsWith("http://") || value.startsWith("https://");
};

/** Join base URL with path (leading slash optional). Resolved on each call. */
export const apiUrl = (path: string): string => {
  const base = getApiBaseUrl().replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${base}${normalizedPath}`;
};

const resolveUrl = (pathOrUrl: string): string => {
  return isAbsoluteUrl(pathOrUrl) ? pathOrUrl : apiUrl(pathOrUrl);
};

/**
 * Unauthenticated requests (e.g. login). Base URL resolved on each call.
 */
export const publicApiFetch = async (path: string, options: RequestInit = {}): Promise<Response> => {
  return fetch(apiUrl(path), options);
};

/**
 * Bearer + access-token refresh (and one retry on 401). Base URL resolved on each call.
 * Pass a path like `/api/did/bind` or a full URL if needed.
 */
export const authApiFetch = async (pathOrUrl: string, options: RequestInit = {}): Promise<Response> => {
  const url = resolveUrl(pathOrUrl);
  let token = getValidToken();

  if (!token || isTokenExpired(token)) {
    token = await refreshAccessToken();
  }

  if (!token) {
    throw new Error("Tidak ada token autentikasi yang valid. Silakan login kembali.");
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);

  if (typeof FormData !== "undefined" && options.body instanceof FormData) {
    headers.delete("Content-Type");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    const newToken = await refreshAccessToken();

    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);

      return fetch(url, {
        ...options,
        headers,
      });
    }

    clearAuth();
    throw new Error("Autentikasi gagal. Silakan login kembali.");
  }

  return response;
};

/** @deprecated Prefer `authApiFetch` — alias for compatibility */
export const authenticatedFetch = authApiFetch;

/**
 * Admin candidate photo upload — uses authApiFetch (refresh + Bearer).
 */
export const uploadAdminImage = async (
  file: File
): Promise<UploadAdminImageResult> => {
  const formData = new FormData();
  formData.append("image", file);

  const response = await authApiFetch("/api/upload", {
    method: "POST",
    body: formData,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    return {
      success: false,
      error: typeof data.error === "string" ? data.error : `Upload gagal (${response.status})`,
    };
  }

  return { success: true, url: data.url, filename: data.filename };
};
