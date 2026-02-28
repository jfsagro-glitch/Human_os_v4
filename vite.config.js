import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Human OS v5',
        short_name: 'HumanOS',
        description: 'Биохакинг · Дыхание · Бинауральные биты',
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/Human_os_v4/',
        scope: '/Human_os_v4/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon.svg',     sizes: 'any',     type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  base: '/Human_os_v4/',
})
