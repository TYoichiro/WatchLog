import type { NextConfig } from "next";
import { withAxiom } from "next-axiom";

process.env.TZ = "Asia/Tokyo";

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "static.showroom-live.com",
      },
      {
        protocol: "https",
        hostname: "image.showroom-cdn.com",
      }
    ],
  }
};

export default withAxiom(nextConfig);
