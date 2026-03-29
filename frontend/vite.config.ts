import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Temporarily disable PWA to fix image caching issue
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   workbox: {
    //     globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
    //     runtimeCaching: [
    //       {
    //         urlPattern: /^https:\/\/.*\.cloudfront\.net\/.*$/i,
    //         handler: 'CacheFirst',
    //         options: {
    //           cacheName: 'cloudfront-images',
    //           expiration: {
    //             maxEntries: 100,
    //             maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
    //           }
    //         }
    //       },
    //       {
    //         urlPattern: /^https:\/\/.*\/api\/v1\/posts\/feed.*$/i,
    //         handler: 'NetworkFirst',
    //         options: {
    //           cacheName: 'feed-cache',
    //           networkTimeoutSeconds: 3,
    //           expiration: {
    //             maxEntries: 10,
    //             maxAgeSeconds: 60 * 60 * 24 // 24 hours
    //           }
    //         }
    //       }
    //     ]
    //   },
    //   manifest: {
    //     name: 'RailGram',
    //     short_name: 'RailGram',
    //     description: "India's Railway Social Network",
    //     theme_color: '#18181b',
    //     background_color: '#09090b',
    //     display: 'standalone',
    //     orientation: 'portrait',
    //     icons: [
    //       {
    //         src: '/icon-192.png',
    //         sizes: '192x192',
    //         type: 'image/png',
    //         purpose: 'any maskable'
    //       },
    //       {
    //         src: '/icon-512.png',
    //         sizes: '512x512',
    //         type: 'image/png',
    //         purpose: 'any maskable'
    //       }
    //     ]
    //   }
    // })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/ws':  { target: 'ws://localhost:8000',  ws: true, changeOrigin: true },
    },
  },
})
