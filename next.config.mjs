/** @type {import('next').NextConfig} */

const nextConfig = {
  serverExternalPackages: [
    'puppeteer-extra',
    'puppeteer-extra-plugin-stealth',
    'puppeteer-core',
    'playwright',
    'playwright-extra',
    'clone-deep',
    'merge-deep'
  ]
};

export default nextConfig;
