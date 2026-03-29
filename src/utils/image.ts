export const getValidImageUrl = (url: string | undefined): string => {
    if (!url) return '';

    // If it's a local development URL, strip the host to use the Next.js proxy rewrite
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
        return url.replace(/^https?:\/\/(localhost|127\.0\.0\.1):\d+/, '');
    }

    // If it's a public URL (like Railway), upgrade http:// to https://
    // MetaMask and other mobile dApps strictly block HTTP mixed content on HTTPS frontends.
    // Railway's proxy sets req.protocol to http, so the backend saves it as http:// by mistake.
    if (url.startsWith('http://') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
        return url.replace(/^http:\/\//i, 'https://');
    }

    return url;
};
