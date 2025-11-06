const RAW = process.env.NEXT_PUBLIC_SITE_URL || '';
let siteUrl = 'https://studywithferuzbek.vercel.app';
try {
  if (RAW) siteUrl = new URL(RAW).toString();
} catch {}

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl,
  generateRobotsTxt: true,
};
