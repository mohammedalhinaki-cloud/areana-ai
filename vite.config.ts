import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves project sites from https://<owner>.github.io/<repo>/,
// so the build needs a matching base path. Local dev/build keeps using '/'.
const pagesRepo = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';
const isUserOrOrgSite = pagesRepo.endsWith('.github.io');
const base =
  process.env.GITHUB_PAGES === 'true' && pagesRepo && !isUserOrOrgSite ? `/${pagesRepo}/` : '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['study-tools-icon.svg', 'icon-192.png', 'icon-512.png', 'robots.txt'],
      manifest: {
        id: base,
        name: 'أدوات الدراسة',
        short_name: 'أدوات الدراسة',
        description: 'أدوات عملية للطلاب والطالبات للملفات والمذاكرة والتخطيط والحساب.',
        lang: 'ar-SA',
        dir: 'rtl',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#f5f7fb',
        theme_color: '#346fdf',
        icons: [
          { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: `${base}study-tools-icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2,mjs}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: 'index.html',
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    strictPort: false,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'pdf-vendor': ['pdf-lib', 'pdfjs-dist'],
          'math-vendor': ['mathjs'],
        },
      },
    },
  },
});
