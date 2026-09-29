/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // Posters/banners uploaded from the admin panel: R2 dev URL, or the media Worker
      { protocol: 'https', hostname: '*.r2.dev' },
      { protocol: 'https', hostname: '*.workers.dev' },
    ],
  },
}
module.exports = nextConfig
