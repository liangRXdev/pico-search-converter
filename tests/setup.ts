import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// 未啟用 vitest globals，React Testing Library 不會自動清理，需手動註冊。
afterEach(() => {
  cleanup();
});
