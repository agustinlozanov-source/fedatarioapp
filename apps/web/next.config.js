/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@fedatario/shared',
    '@react-pdf/renderer',
    '@react-pdf/font',
    '@react-pdf/pdfkit',
    '@react-pdf/layout',
    '@react-pdf/textkit',
    '@react-pdf/fns',
  ],
};
module.exports = nextConfig;
