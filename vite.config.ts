import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// GitHub Pages 專案頁路徑（D7）。換部署平台時只需改這裡。
const BASE_PATH = '/pico-search-converter/';

export default defineConfig({
  base: BASE_PATH,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
  },
});
