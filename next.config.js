/** @type {import('next').NextConfig} */
const nextConfig = {
    // Strict mode for better React development
    reactStrictMode: true,
    serverExternalPackages: ['apify-client', 'proxy-agent'],
}

module.exports = nextConfig
