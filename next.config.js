/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // Posters/banners uploaded from the admin panel (R2 public dev URL)
      { protocol: 'https', hostname: '*.r2.dev' },
    ],
  },
}
module.exports = nextConfig
