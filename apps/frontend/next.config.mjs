import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { version } = require('./package.json')

const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || version
const buildStamp =
  process.env.NEXT_PUBLIC_BUILD_STAMP ||
  new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_BUILD_STAMP: buildStamp
  },
  // Enable webpack polling for Docker on Windows/macOS - detects file changes via bind mounts
  ...(process.env.WATCHPACK_POLLING && {
    webpack: (config) => {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300
      }
      return config
    }
  })
}

export default nextConfig
