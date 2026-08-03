import { join } from 'node:path'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Traces the files the server actually needs and copies them into
  // `.next/standalone`, so the production image carries a runtime instead of a
  // `node_modules` — for a pnpm monorepo that is the difference between a
  // couple of hundred megabytes and well over a gigabyte.
  //
  // Needs `outputFileTracingRoot` in a workspace: without it Next traces from
  // `apps/web` and leaves behind the hoisted dependencies at the repo root.
  output: 'standalone',
  outputFileTracingRoot: join(import.meta.dirname, '../..'),
}

export default nextConfig
