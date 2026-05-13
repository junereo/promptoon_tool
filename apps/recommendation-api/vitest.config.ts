import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@promptoon/recommendation-contract': new URL('../../packages/recommendation-contract/src/index.ts', import.meta.url).pathname
    }
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts']
  }
});
