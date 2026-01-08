/** @type {import('next-sitemap').IConfig} */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://thestudymate.vercel.app";

module.exports = {
  siteUrl,
  generateRobotsTxt: true,
  outDir: "public",
  changefreq: "weekly",
  priority: 0.7,
  sitemapSize: 7000,
  exclude: [
    "/admin*",
    "/account*",
    "/auth*",
    "/checkout*",
    "/cart*",
    "/orders*",
    "/api/*",
    "/_next/*",
  ],
  robotsTxtOptions: {
    policies: [
      { userAgent: "*", allow: "/" },
      {
        userAgent: "*",
        disallow: [
          "/admin",
          "/account",
          "/auth",
          "/checkout",
          "/cart",
          "/orders",
          "/api",
        ],
      },
    ],
  },
  transform: async (config, path) => ({
    loc: path,
    changefreq: "weekly",
    priority: path === "/" ? 1.0 : 0.7,
    lastmod: new Date().toISOString(),
  }),
};
