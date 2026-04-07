/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // pdfkit resolves font files using relative paths from node_modules at runtime.
      // Bundling it breaks those paths — keep it as a runtime require instead.
      config.externals = [...(config.externals ?? []), "pdfkit"];
    }
    return config;
  },
  // Needed when running inside Electron (file:// protocol or localhost)
  output: "standalone",
};

export default nextConfig;
