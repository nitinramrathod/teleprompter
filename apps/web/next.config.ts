import type { NextConfig } from "next";

const config: NextConfig = {
    transpilePackages: ["@tp/shared"],
    allowedDevOrigins: ["10.59.132.170"], // your laptop's LAN IP
};
export default config;