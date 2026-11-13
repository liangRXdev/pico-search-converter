import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// GitHub Pages 專案頁路徑（D7）。換部署平台時只需改這裡。
const BASE_PATH = '/pico-search-converter/';

export default defineConfig({
  base: BASE_PATH,
  plugins: [react()],
  build: {
    // 關閉 modulepreload polyfill：它會在 bundle 內加入一個 fetch 呼叫。
    // 本專案要求產物完全不含網路 API（scripts/check-offline.mjs、T23）。
    modulePreload: { polyfill: false },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
  },
});
