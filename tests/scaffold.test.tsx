import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  CONCEPT_ORDER,
  DEFAULT_ENABLED,
  LIMITS,
  LIVE_VALIDATED,
  PLATFORM_LABELS,
  PLATFORM_ORDER,
} from '../src/config';
import { App } from '../src/ui/App';

describe('config', () => {
  it('PICO 順序固定為 P → I → C → O', () => {
    expect(CONCEPT_ORDER).toEqual(['P', 'I', 'C', 'O']);
  });

  it('預設只納入 P 與 I', () => {
    expect(DEFAULT_ENABLED).toEqual({ P: true, I: true, C: false, O: false });
  });

  it('每個平台都有標籤，且 Embase 標明為 Elsevier 介面', () => {
    for (const platform of PLATFORM_ORDER) {
      expect(PLATFORM_LABELS[platform]).toBeTruthy();
    }
    expect(PLATFORM_LABELS['embase-com']).toBe('Embase.com (Elsevier)');
  });

  it('上限為正整數，truncation 至少需 4 個字母', () => {
    for (const value of Object.values(LIMITS)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
    expect(LIMITS.minTruncationStem).toBe(4);
  });

  it('尚無 live 驗證紀錄前，所有平台皆標示為未驗證', () => {
    expect(Object.values(LIVE_VALIDATED)).toEqual([false, false, false]);
  });
});

describe('App 佔位畫面', () => {
  it('可渲染並列出三個平台全名', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('PICO 檢索語法轉換器');
    for (const platform of PLATFORM_ORDER) {
      expect(screen.getByText(PLATFORM_LABELS[platform])).toBeInTheDocument();
    }
  });
});
