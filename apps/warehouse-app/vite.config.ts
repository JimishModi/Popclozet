import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    plugins: [
        react(),

        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'auto',

            includeAssets: [
                'favicon.ico',
                'robots.txt',
                'icons/icon-192x192.png',
                'icons/icon-512x512.png',
                'icons/icon-maskable-192x192.png',
                'icons/icon-maskable-512x512.png',
            ],

            manifest: {
                name: 'Popclozet Warehouse - Operations Hub',
                short_name: 'PC Warehouse',
                description: 'Inventory management, order processing, and warehouse operations.',
                start_url: '/',
                scope: '/',
                display: 'standalone',
                orientation: 'portrait-primary',
                background_color: '#0b0b0c',
                theme_color: '#6C3AE0',
                categories: ['business', 'productivity'],

                icons: [
                    {
                        src: '/icons/icon-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: '/icons/icon-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: '/icons/icon-maskable-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                    {
                        src: '/icons/icon-maskable-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
            },

            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.ts',

            injectManifest: {
                globPatterns: ['**/*.{js,css,html,ico,svg,woff,woff2}'],
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
            },

            devOptions: {
                enabled: true,
                type: 'module',
            },
        }),
    ],
    optimizeDeps: {
        include: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'],
        exclude: [
            '@popclozet/api-client',
            '@popclozet/auth',
            '@popclozet/domain-contracts',
            '@popclozet/map-core',
            '@popclozet/ui'
        ]
    },

    // Load .env from monorepo root
    envDir: path.resolve(__dirname, '../..'),

    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@popclozet/domain-contracts': path.resolve(__dirname, '../../packages/domain-contracts/src/index.ts'),
            '@popclozet/api-client': path.resolve(__dirname, '../../packages/api-client/src/index.ts'),
            '@popclozet/auth': path.resolve(__dirname, '../../packages/auth/src/index.tsx'),
            '@popclozet/map-core': path.resolve(__dirname, '../../packages/map-core/src/index.ts'),
            '@popclozet/ui': path.resolve(__dirname, '../../packages/ui/src/index.tsx'),
        }
    },
    server: {
        port: 5502,
        host: true
    }
})
