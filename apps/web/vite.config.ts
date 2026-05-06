import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(async ({ mode }) => {
  const tailwindcss = (await import('@tailwindcss/vite')).default;
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@promptoon/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts')
      }
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:4000',
          changeOrigin: true
        },
        '/uploads': {
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:4000',
          changeOrigin: true
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('/node_modules/@xyflow/')) {
              return 'vendor-xyflow';
            }

            if (id.includes('/node_modules/@dnd-kit/')) {
              return 'vendor-dnd-kit';
            }

            if (id.includes('/node_modules/recharts/') || id.includes('/node_modules/d3-')) {
              return 'vendor-charts';
            }

            if (id.includes('/node_modules/framer-motion/')) {
              return 'vendor-motion';
            }

            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/scheduler/')
            ) {
              return 'vendor-react';
            }
          }
        }
      }
    }
  };
});
