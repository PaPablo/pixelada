import { defineConfig } from 'vitest/config';

// Entorno Node a propósito: la lógica de model/ y export/ no puede tocar el DOM.
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
