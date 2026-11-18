import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ほぼ全画面がログイン必須（cookie を読む動的ページ）なので Cache Components は使わない
  cacheComponents: false,
  // @react-pdf/renderer はバンドルせず Node から直接読み込む
  serverExternalPackages: ["@react-pdf/renderer"],
  // PDF 生成で使う日本語フォントを関数バンドルに含める（Vercel 用）
  outputFileTracingIncludes: {
    "/api/**": ["./public/fonts/**/*"],
  },
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
