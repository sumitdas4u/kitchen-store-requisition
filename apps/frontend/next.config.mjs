/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable webpack polling for Docker on Windows/macOS — detects file changes via bind mounts
  ...(process.env.WATCHPACK_POLLING && {
    webpack: (config) => {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
      return config;
    },
  }),
}

export default nextConfig
