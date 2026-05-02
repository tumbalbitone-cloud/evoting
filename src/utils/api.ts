import { getApiBaseUrl } from "./apiConfig";
import { refreshAccessToken, clearAuth } from "./auth";

export { getApiBaseUrl } from "./apiConfig";

type UploadAdminImageResult =
  | { success: true; url: string; filename: string }
  | { success: false; error: string };

const isAbsoluteUrl = (value: string): boolean =>
  value.startsWith("http://") || value.startsWith("https://");

/** Join base URL with path. */
export const apiUrl = (path: string): string => {
  const base = getApiBaseUrl().replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};

const resolveUrl = (pathOrUrl: string): string =>
  isAbsoluteUrl(pathOrUrl) ? pathOrUrl : apiUrl(pathOrUrl);

/**
 * Unauthenticated requests (e.g. login).
 * credentials: 'include' ensures cookies are sent/received even on cross-origin.
 */
export const publicApiFetch = async (
  path: string,
  options: RequestInit = {}
): Promise<Response> => {
  return fetch(apiUrl(path), {
    ...options,
    credentials: "include",
  });
};

/**
 * Authenticated requests.
 *
 * SECURITY: Tokens live exclusively in httpOnly cookies — we no longer set
 * an Authorization header from JavaScript. The browser sends the cookie
 * automatically via `credentials: 'include'`.
 *
 * On 401:
 *   1. Attempt cookie-based token rotation via /api/auth/refresh
 *   2. Retry the original request once
 *   3. If refresh fails, clear UI auth state and throw
 */
export const authApiFetch = async (
  pathOrUrl: string,
  options: RequestInit = {}
): Promise<Response> => {
  const url = resolveUrl(pathOrUrl);

  const fetchOptions: RequestInit = {
    ...options,
    credentials: "include", // always send httpOnly cookies
  };

  // Remove Content-Type for FormData so the browser sets the correct boundary
  const headers = new Headers(options.headers);
  if (
    typeof FormData !== "undefined" &&
    options.body instanceof FormData
  ) {
    headers.delete("Content-Type");
  }
  fetchOptions.headers = headers;

  const response = await fetch(url, fetchOptions);

  if (response.status === 401) {
    // Try to rotate the token via the refresh cookie
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      // Retry the original request — browser will send the new access cookie
      return fetch(url, fetchOptions);
    }

    clearAuth();
    window.dispatchEvent(new Event("auth-change"));
    throw new Error("Sesi berakhir. Silakan login kembali.");
  }

  return response;
};

/** @deprecated Prefer authApiFetch — alias for compatibility */
export const authenticatedFetch = authApiFetch;

/**
 * Admin candidate photo upload.
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
      error:
        typeof data.error === "string"
          ? data.error
          : `Upload gagal (${response.status})`,
    };
  }

  return { success: true, url: data.url, filename: data.filename };
};
