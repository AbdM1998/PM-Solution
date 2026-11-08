/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@projectflow/shared"],
  // Don't auto-generate apps/web/AGENTS.md on every `next dev` — this app already
  // follows the org's own AGENTS.md/architecture conventions at the repo root.
  agentRules: false,
};

module.exports = nextConfig;
