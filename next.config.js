/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true
  },
  experimental: {
    serverComponentsExternalPackages: ["unpdf", "mammoth", "pdfkit", "docx", "tesseract.js", "@napi-rs/canvas"]
  }
};

module.exports = nextConfig;
