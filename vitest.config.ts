import { defineConfig } from 'vitest/config';

// Backend tests use Node's built-in `node:test` runner (npm run test:core).
// Vitest runs only the frontend Vitest suites under src/.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
