/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfkit reads its built-in font metrics from disk relative to its own
  // module location, so it must run verbatim from node_modules. Bundling it
  // (default) moves those files and breaks the Hazard summary PDF.
  serverExternalPackages: ["pdfkit"],
  // "Add record" can send up to three phone photos with one submit, and the
  // default 1 MB limit would reject them without saying why.
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
