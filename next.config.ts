import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't write an AGENTS.md into the project on `next dev`.
  agentRules: false,
};

export default nextConfig;
