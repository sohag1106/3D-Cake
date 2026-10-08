import { defineConfig } from 'vite';

// https://vite.dev/config/
// No @vitejs/plugin-react here, so esbuild's own JSX transform does the work.
// It must be told to use the automatic runtime — the default is "classic",
// which compiles JSX to React.createElement() and needs a React import in
// every single file.
export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    // Chrome's headless profile writes thousands of files; keep it away from
    // the watcher so Vite doesn't die on EBUSY for a locked .db-shm.
    watch: { ignored: ['**/.smoke/**', '**/dist/**'] },
  },
});
