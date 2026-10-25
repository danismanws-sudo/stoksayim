import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

// Versiyon: package.json sürümü + Vercel'in her dağıtımda verdiği commit kodu (her değişiklikte değişir)
const pkgVersion = (JSON.parse(readFileSync("./package.json", "utf8")) as { version: string }).version;
const commitSha = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: commitSha ? `v${pkgVersion} · ${commitSha}` : `v${pkgVersion}`,
  },
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

