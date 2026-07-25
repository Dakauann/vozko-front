import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const brandCdnHost = process.env.NEXT_PUBLIC_BRAND_CDN_HOST;

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
          exclude: ["error", "warn"],
        }
        : false,
  },
  productionBrowserSourceMaps: false,
  images: {
    localPatterns: [
      {
        pathname: "/images/**",
      },
    ],
    remotePatterns: [
      ...(brandCdnHost
        ? [
          {
            protocol: "https" as const,
            hostname: brandCdnHost,
            port: "",
            pathname: "/**",
          },
        ]
        : []),
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.spcdn.org",
        port: "",
        pathname: "/images/top_clients/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.importsaude.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "static.xx.fbcdn.net",
        port: "",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
    proxyClientMaxBodySize: 100 * 1024 * 1024,
  },
};

export default withNextIntl(nextConfig);
