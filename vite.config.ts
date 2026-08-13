import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves this repo from /andon/. Override for other hosts.
const base = process.env.ANDON_BASE ?? '/andon/';

export default defineConfig({
  base,
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Andon',
        short_name: 'Andon',
        description: 'The line, on your phone. Issues ride the belt; the cord gets pulled.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#14171c',
        theme_color: '#1b2129',
        categories: ['productivity', 'developer'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: `${base}index.html`,
        // PR previews sit under the live site's scope on the same origin; the
        // live SW must not answer their navigations with the live shell.
        navigateFallbackDenylist: [/\/pr-preview\//],
      },
      devOptions: { enabled: false },
    }),
  ],
});
