import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

function wrapWithAnalyzerWhenRequested(config: NextConfig): NextConfig {
  if (process.env.ANALYZE !== "true") {
    return config;
  }
  try {
    // Optional devDependency — omitted on CI when only production deps install (e.g. Cloudflare Pages).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bundleAnalyzer = require("@next/bundle-analyzer") as (
      opts: { enabled: boolean },
    ) => (c: NextConfig) => NextConfig;
    return bundleAnalyzer({ enabled: true })(config);
  } catch {
    return config;
  }
}

export default wrapWithAnalyzerWhenRequested(nextConfig);
