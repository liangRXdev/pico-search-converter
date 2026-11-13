import { useCallback, useEffect, useState } from 'react';

/**
 * 回傳延遲更新的值，以及可立即同步的 flush。
 * `value !== settled` 期間代表畫面上的輸出尚未跟上輸入。
 */
export function useDebounced<T>(value: T, delayMs: number): [settled: T, flush: () => void] {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  const flush = useCallback(() => setSettled(value), [value]);
  return [settled, flush];
}
