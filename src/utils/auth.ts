/**
 * Authentication utilities
 * Handles token management and validation
 */

/**
 * Check if token is a valid JWT format
 * JWT tokens have 3 parts separated by dots
 */
export const isValidJWT = (token: string | null): boolean => {
    if (!token) return false;
    const parts = token.split('.');
    return parts.length === 3;
};

/**
 * Check if token is an old mock token
 */
export const isMockToken = (token: string | null): boolean => {
    if (!token) return false;
    return token === 'mock-admin-token' || token === 'mock-user-token' || token === 'mock-jwt-token';
};

/**
 * Clear all auth data from localStorage
 */
export const clearAuth = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
};

/**
 * Get valid token or redirect to login
 */
export const getValidToken = (): string | null => {
    const token = localStorage.getItem('token');
    
    // Check if token exists
    if (!token) {
        return null;
    }
    
    // Check if it's an old mock token
    if (isMockToken(token)) {
        console.warn('Old mock token detected. Please login again.');
        clearAuth();
        return null;
    }
    
    // Check if it's a valid JWT format
    if (!isValidJWT(token)) {
        console.warn('Invalid token format. Please login again.');
        clearAuth();
        return null;
    }
    
    return token;
};

/**
 * Refresh access token using refresh token
 */
export const refreshAccessToken = async (): Promise<string | null> => {
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!refreshToken) {
        return null;
    }
    
    try {
        const res = await fetch('http://localhost:3001/api/auth/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken })
        });
        
        if (!res.ok) {
            throw new Error('Failed to refresh token');
        }
        
        const data = await res.json();
        
        if (data.success && data.token) {
            localStorage.setItem('token', data.token);
            return data.token;
        }
        
        return null;
    } catch (error) {
        console.error('Token refresh failed:', error);
        clearAuth();
        return null;
    }
};

/**
 * Check if token is expired (without verification)
 */
export const isTokenExpired = (token: string | null): boolean => {
    if (!token || !isValidJWT(token)) return true;
    
    try {
        const parts = token.split('.');
        const payload = JSON.parse(atob(parts[1]));
        const exp = payload.exp;
        
        if (!exp) return true;
        
        // Check if token expires in less than 1 minute (buffer time)
        const now = Math.floor(Date.now() / 1000);
        return exp < (now + 60);
    } catch {
        return true;
    }
};

/**
 * Make authenticated fetch request with automatic token refresh
 */
export const authenticatedFetch = async (
    url: string,
    options: RequestInit = {}
): Promise<Response> => {
    let token = getValidToken();
    
    // Check if token is expired or about to expire
    if (!token || isTokenExpired(token)) {
        token = await refreshAccessToken();
    }
    
    // If still no token, throw error
    if (!token) {
        throw new Error('No valid authentication token. Please login again.');
    }
    
    // Add Authorization header
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    
    // Make request
    const response = await fetch(url, {
        ...options,
        headers
    });
    
    // If 401, try to refresh token once more
    if (response.status === 401) {
        const newToken = await refreshAccessToken();
        if (newToken) {
            headers.set('Authorization', `Bearer ${newToken}`);
            return fetch(url, {
                ...options,
                headers
            });
        } else {
            clearAuth();
            throw new Error('Authentication failed. Please login again.');
        }
    }
    
    return response;
};
