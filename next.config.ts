import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The approval PATCH reads public/logo-header.png to attach it inline
  // (CID) in resolution emails — it must be traced into the function.
  outputFileTracingIncludes: {
    "/api/admin/trips/[id]": ["./public/logo-header.png"],
  },
};

export default nextConfig;
