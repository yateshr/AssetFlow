import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // The project's tsconfig keeps JSX untouched for Astro; tests compile it themselves.
  oxc: { jsx: { runtime: 'automatic' } },
  esbuild: { jsx: 'automatic' },
  test: { environment: 'node', include: ['tests/**/*.test.{ts,tsx}'] },
} as any);
