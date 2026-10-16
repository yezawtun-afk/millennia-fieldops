/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfkit reads its built-in font metrics from disk relative to its own
  // module location, so it must run verbatim from node_modules. Bundling it
  // (default) moves those files and breaks the Hazard summary PDF.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
