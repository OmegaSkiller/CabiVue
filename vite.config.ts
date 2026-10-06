import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig(({ mode }) => {
  const base = mode === 'pages' ? '/CabiVue/' : '/';
  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['brand/*.svg', 'brand/*.png', 'fonts/*.ttf'],
        manifest: {
          name: 'Cabivue',
          short_name: 'Cabivue',
          description: 'Know what you have.',
          theme_color: '#125B57',
          background_color: '#F7F6F2',
          display: 'standalone',
          start_url: base,
          scope: base,
          icons: [
            { src: `${base}brand/cabivue-app-icon-192.png`, sizes: '192x192', type: 'image/png' },
            {
              src: `${base}brand/cabivue-app-icon-512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,svg,ttf}'],
          navigateFallbackDenylist: [/^\/api(?:\/|$)/],
          runtimeCaching: [],
          cleanupOutdatedCaches: true,
          skipWaiting: false,
          clientsClaim: false,
        },
      }),
    ],
    server: {
      port: Number(process.env.WEB_PORT || 5173),
      strictPort: true,
      proxy: { '/api': `http://127.0.0.1:${process.env.PORT || 3210}` },
    },
    build: { outDir: mode === 'pages' ? 'dist/pages' : 'dist/web', emptyOutDir: true },
  };
});
