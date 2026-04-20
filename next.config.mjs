/** @type {import('next').NextConfig} */
const nextConfig = {
    /* config options here */
    // Allow dev server access from other devices on LAN (e.g. http://192.168.1.111:3000)
    allowedDevOrigins: [
        'http://localhost:3000',
    ],
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
            {
                protocol: 'http',
                hostname: '**',
            },
        ],
    },
    async rewrites() {
        return [
            {
                source: '/uploads/:path*',
                destination: 'http://localhost:3001/uploads/:path*',
            },
        ];
    },
};

export default nextConfig;
