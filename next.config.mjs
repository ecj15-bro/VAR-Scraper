/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit resolves font files via runtime paths — keep it out of the bundle.
  serverExternalPackages: ["pdfkit"],
  // Silence the webpack-vs-turbopack warning; this app has no custom webpack config.
  turbopack: {},
  // Needed when running inside Electron (file:// protocol or localhost)
  output: "standalone",
};

export default nextConfig;
