/** @type {import('next').NextConfig} */
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

const imageDomains = [
  'lh3.googleusercontent.com',
  'avatars.githubusercontent.com',
  'media.licdn.com',
];
if (SUPABASE_HOST) imageDomains.push(SUPABASE_HOST);

const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
  images: {
    // keep your existing remote patterns
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'media.licdn.com' },
    ],
    // add explicit domains so Next/Image is happy everywhere
    domains: imageDomains,
  },
  env: {
    NEXT_PUBLIC_SITE_URL: SITE_URL,
  },
};

module.exports = nextConfig;
