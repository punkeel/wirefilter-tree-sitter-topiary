import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        engine: fileURLToPath(new URL('./src/engine.js', import.meta.url)),
      },
      preserveEntrySignatures: 'strict',
      output: { entryFileNames: 'assets/[name].js' },
    },
  },
});
