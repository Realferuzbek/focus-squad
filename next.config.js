/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false,
});

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
let SUPABASE_HOST = undefined;
if (SUPABASE_URL) {
  try {
    SUPABASE_HOST = new URL(SUPABASE_URL).host;
  } catch {
    // ignore parse failure; fall back to pattern-only config
  }
}

const RAW = process.env.NEXT_PUBLIC_SITE_URL || '';
let SITE_URL = 'https://studywithferuzbek.vercel.app';
try {
  if (RAW) SITE_URL = new URL(RAW).toString();
} catch {}

// Build remote patterns array
const remotePatterns = [
  { protocol: 'https', hostname: '**.supabase.co' },
  { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
  { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
  { protocol: 'https', hostname: 'media.licdn.com' },
];

// Add Supabase host if available (for specific hostname matching)
if (SUPABASE_HOST) {
  remotePatterns.push({ protocol: 'https', hostname: SUPABASE_HOST });
}

const nextConfig = {
  reactStrictMode: true,
  experimental: { 
    serverActions: { bodySizeLimit: '2mb' },
    // EFFECT: Tree-shakes lucide/date-fns imports to keep bundles lean.
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  images: {
    remotePatterns,
    // EFFECT: Enable modern image formats so hero assets load faster.
    formats: ['image/avif', 'image/webp'],
  },
  env: {
    NEXT_PUBLIC_SITE_URL: SITE_URL,
  },
  // Ensure Next.js uses the correct project root
  // This prevents Turbopack from looking in subdirectories
  typescript: {
    ignoreBuildErrors: false,
  },
};

module.exports = withBundleAnalyzer(nextConfig);
