/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    }
  },
  // Disable ALL caching to fix stale data issues
  onDemandEntries: {
    maxInactiveAge: 0,
    pagesBufferLength: 0,
  },
  // Force dynamic rendering
  poweredByHeader: false,
  generateEtags: false,
}

module.exports = nextConfig
