import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// O GitHub Pages serve o app em /despedida-casamento/
const base = process.env.BASE_PATH ?? '/despedida-casamento/';

export default defineConfig({
  base,
  build: {
    // duas páginas: o app das madrinhas (/) e a página do noivo (/noivo/)
    rolldownOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html'), noivo: resolve(import.meta.dirname, 'noivo/index.html') },
    },
  },
  plugins: [
    VitePWA({
      // uma noite só: sem aviso de atualização (o código congela antes da festa)
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Fita da despedida',
        short_name: 'Fita',
        description: 'A noiva responde e só depois ouve a fita do noivo',
        lang: 'pt-BR',
        id: base + 'app',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#EFE6D3',
        theme_color: '#EFE6D3',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // o decodificador de .ogg (wasm embutido no js) também fica guardado para funcionar sem internet;
        // o módulo opcional de "melhoria de voz" dele (4 MB) não é usado e fica de fora
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/opus-ml-*.js'],
        navigateFallback: base + 'index.html',
        // a página do noivo é outra página: nunca cair no app das madrinhas
        navigateFallbackDenylist: [/\/noivo\/?/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
