/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@projectflow/shared"],
  // Self-contained server bundle (only the node_modules this app actually needs,
  // copied into .next/standalone) — used by the local/offline deployment package so
  // the target machine never needs its own `npm install`. Harmless for the Docker
  // build too; that Dockerfile still copies the full node_modules tree itself.
  // Not on Vercel: Vercel packages the app its own way.
  output: process.env.VERCEL ? undefined : "standalone",
  // Don't auto-generate apps/web/AGENTS.md on every `next dev` — this app already
  // follows the org's own AGENTS.md/architecture conventions at the repo root.
  agentRules: false,
  experimental: {
    // Request bodies that pass through the /api rewrite below are buffered by Next.js
    // with a 10MB default cap — larger uploads were cut off ("socket hang up" → 500)
    // even though the API itself accepts files up to 25MB. Found by uploading a 12MB
    // file through the web origin. Slightly above the API's own 25MB limit so the API
    // (not this proxy) is what rejects oversize files, with a readable message.
    proxyClientMaxBodySize: "30mb",
  },
  // Server-side proxy for the backend API. Lets the browser always call a relative
  // same-origin "/api/*" path (see NEXT_PUBLIC_API_BASE_URL=/api) instead of an
  // absolute host:port that only resolves correctly from this one machine — needed
  // to make the app work both locally (127.0.0.1:3001) and behind a public tunnel
  // (the tunnel only has to forward this one origin; the backend's raw port never
  // needs to be exposed on the public internet at all). The browser never sees
  // API_INTERNAL_URL; this request is made server-side by the Next.js process,
  // inside the same Docker network as the api container, so it has no CORS
  // implications either.
  async rewrites() {
    const apiInternalUrl = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";
    return [{ source: "/api/:path*", destination: `${apiInternalUrl}/api/:path*` }];
  },
};

module.exports = nextConfig;
