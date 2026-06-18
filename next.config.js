/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Cho phép load WASM từ @imgly/background-removal
    config.experiments = { ...config.experiments, asyncWebAssembly: true, layers: true }
    return config
  },
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'soaqedkloqyznmqzybgq.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/zalo_verifierGltaCulOJ2XMfi9magn8KKw2tWQYz0jHEJ4t.html",
        destination: "/api/zalo-verify",
      },
    ]
  },
  async headers() {
    return [
      {
        // Đảm bảo trình duyệt luôn fetch sw.js mới nhất, không cache SW
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        // manifest.json cũng không cache lâu
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
    ]
  },
};
module.exports = nextConfig;
