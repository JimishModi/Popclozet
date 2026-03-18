import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    optimizeDeps: {
        include: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'],
        exclude: [
            '@popclozet/api-client',
            '@popclozet/auth',
            '@popclozet/domain-contracts',
            '@popclozet/ui'
        ]
    },

    // Load .env from monorepo root
    envDir: path.resolve(__dirname, '../..'),

    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@popclozet/domain-contracts': path.resolve(__dirname, '../../packages/domain-contracts/src'),
            '@popclozet/api-client': path.resolve(__dirname, '../../packages/api-client/src'),
            '@popclozet/auth': path.resolve(__dirname, '../../packages/auth/src/index.tsx'),
            '@popclozet/ui': path.resolve(__dirname, '../../packages/ui/src/index.tsx'),
        }
    },
    server: {
        port: 5502,
        host: true
    }
})
