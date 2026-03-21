/** @type {import('next').NextConfig} */
const path = require('path')

// Localizar el módulo dondequiera que npm workspaces lo haya instalado
function resolveLib(pkg, file) {
  try {
    const pkgDir = path.dirname(require.resolve(`${pkg}/package.json`))
    return path.join(pkgDir, 'lib', file)
  } catch {
    return null
  }
}

const nextConfig = {
  transpilePackages: ['@fedatario/shared'],
  serverExternalPackages: ['@react-pdf/renderer'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      const rendererBrowser = resolveLib('@react-pdf/renderer', 'react-pdf.browser.js')
      const pdfkitBrowser   = resolveLib('@react-pdf/pdfkit',   'pdfkit.browser.js')

      if (rendererBrowser) config.resolve.alias['@react-pdf/renderer'] = rendererBrowser
      if (pdfkitBrowser)   config.resolve.alias['@react-pdf/pdfkit']   = pdfkitBrowser

      config.resolve.alias.canvas = false

      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false, fs: false, path: false,
        stream: false, zlib: false, crypto: false,
      }
    }
    return config
  },
}

module.exports = nextConfig
