/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: 'https://solucenter-api-04bn.onrender.com/:path*',
      },
    ];
  },
};

export default nextConfig;
