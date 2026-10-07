import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import checker from 'vite-plugin-checker'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    ...(process.env.VITE_CHECKER === 'true'
      ? [
          checker({
            typescript: true,
            overlay: false,
            enableBuild: false,
          }),
        ]
      : []),
    {
      name: 'non-blocking-css',
      enforce: 'post',
      transformIndexHtml(html, ctx) {
        let transformed = html.replace(
          /<link rel="stylesheet" crossorigin href="([^"]+)">/g,
          '<link rel="preload" as="style" href="$1" crossorigin onload="this.onload=null;this.rel=\'stylesheet\'"><noscript><link rel="stylesheet" crossorigin href="$1"></noscript>'
        );
        if (ctx?.bundle) {
          const loginChunk = Object.keys(ctx.bundle).find(k => k.startsWith('assets/Login-') && k.endsWith('.js'));
          if (loginChunk) {
            transformed = transformed.replace('</head>', `  <link rel="modulepreload" crossorigin href="/${loginChunk}">\n  </head>`);
          }
        }
        return transformed;
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/orders': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/static': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  esbuild: {
    legalComments: 'none',
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    modulePreload: {
      resolveDependencies(filename, deps) {
        return deps.filter(dep => !dep.includes('recharts'));
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'icons': ['lucide-react'],
        },
      },
    },
  },
})
