import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "**",
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), camera=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://js.paystack.co",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.paystack.co",
              "frame-src 'self' https://www.youtube.com https://youtube.com https://youtu.be https://player.vimeo.com https://checkout.paystack.com",
              "child-src 'self' https://www.youtube.com https://youtube.com https://youtu.be https://player.vimeo.com https://checkout.paystack.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
