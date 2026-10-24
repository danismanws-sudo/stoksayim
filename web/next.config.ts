import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "automated-canberra-dow-booth.trycloudflare.com",
    "192.168.1.163",
    "192.168.1.*",
    "localhost",
    "127.0.0.1",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

