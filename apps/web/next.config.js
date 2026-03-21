/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  transpilePackages: ['@fedatario/shared'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Forzar el build browser de @react-pdf/* porque webpack 5 ignora el
      // campo "browser" cuando existe "exports", y toma el CJS con require()
      const browserAlias = (pkg, file) =>
        path.resolve(__dirname, `node_modules/${pkg}/lib/${file}`)

      config.resolve.alias = {
        ...config.resolve.alias,
        '@react-pdf/renderer': browserAlias('@react-pdf/renderer', 'react-pdf.browser.js'),
        '@react-pdf/pdfkit':   browserAlias('@react-pdf/pdfkit',   'pdfkit.browser.js'),
      }

      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
        path: false,
        stream: false,
        zlib: false,
        crypto: false,
      }
    }
    return config
  },
}

module.exports = nextConfig
