import { describe, expect, it } from 'vitest';
import { DISCLAIMER, PLATFORM_LABELS, PLATFORM_ORDER, SOURCE_LINKS } from '../src/config';
import { generate } from '../src/core/generate';
import { buildTxtExport, exportFilename, formatTimestamp } from '../src/export/txt';
import type { BlockInput, ConceptId } from '../src/model/types';

function block(id: ConceptId, enabled: boolean, freeText: string[]): BlockInput {
  return { id, enabled, freeText, mesh: [], emtree: [] };
}

const blocks: BlockInput[] = [
  block('P', true, ['hypertension', '"high blood pressure"']),
  block('I', true, ['exercise', '"physical activity"']),
  block('C', false, []),
  block('O', false, ['"blood pressure"']),
];

const GENERATED_AT = '2026-11-13 15:52 (UTC+08:00)';

function exportOf(input: BlockInput[]): string {
  return buildTxtExport({ blocks: input, generation: generate({ blocks: input }), generatedAt: GENERATED_AT });
}

describe('TXT 匯出（T21）', () => {
  const text = exportOf(blocks);

  it('包含三個平台的名稱與完整 query', () => {
    const { results } = generate({ blocks });
    for (const result of results ?? []) {
      expect(text).toContain(`[${PLATFORM_LABELS[result.platform]}]\n${result.query}\n`);
    }
    expect(results?.map((result) => result.platform)).toEqual(PLATFORM_ORDER);
  });

  it('包含產生時間、聲明、來源連結與驗證狀態', () => {
    expect(text).toContain(`產生時間：${GENERATED_AT}`);
    expect(text).toContain(DISCLAIMER);
    for (const link of SOURCE_LINKS) expect(text).toContain(link.url);
    expect(text.match(/Not live-validated/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('記錄輸入內容，並標明哪些概念未納入', () => {
    expect(text).toContain('P（納入檢索）\n  - hypertension\n  - "high blood pressure"');
    expect(text).toContain('C（未納入檢索）\n  （空白）');
    expect(text).toContain('O（未納入檢索）\n  - "blood pressure"');
    expect(text).toContain('O 有內容但未納入檢索');
  });

  it('T25：除時間外逐位元組可重現，且只用 LF 換行', () => {
    expect(exportOf(blocks)).toBe(text);
    expect(text).not.toContain('\r');
    expect(text.endsWith('\n')).toBe(true);
    const later = buildTxtExport({
      blocks,
      generation: generate({ blocks }),
      generatedAt: '2027-01-01 00:00 (UTC+08:00)',
    });
    expect(later.replace('2027-01-01 00:00', '2026-11-13 15:52')).toBe(text);
  });

  it('可用 UTF-8 來回編碼而不失真', () => {
    const bytes = new TextEncoder().encode(text);
    expect(new TextDecoder('utf-8', { fatal: true }).decode(bytes)).toBe(text);
  });

  it('heading 與其查證狀態一併記錄', () => {
    const withHeading: BlockInput[] = [
      {
        id: 'P',
        enabled: true,
        freeText: ['hypertension'],
        mesh: [{ term: 'Hypertension', explode: false, verification: 'user_confirmed', source: 'user_input' }],
        emtree: [],
      },
    ];
    const output = exportOf(withHeading);
    expect(output).toContain('  - MeSH：Hypertension（不 explode；使用者自述已查證）');
    expect(output).toContain('("Hypertension"[MeSH Terms:noexp] OR hypertension[tiab])');
  });

  it('單一平台無法輸出時，寫明未輸出與原因', () => {
    const meshOnly: BlockInput[] = [
      {
        id: 'P',
        enabled: true,
        freeText: [],
        mesh: [{ term: 'Hypertension', explode: true, verification: 'user_confirmed', source: 'user_input' }],
        emtree: [],
      },
    ];
    const output = exportOf(meshOnly);
    expect(output).toContain('[Embase.com (Elsevier)]\n（未輸出查詢，原因見下方）');
    expect(output).toContain('[錯誤]');
  });

  it('輸入有誤時不含任何 query', () => {
    const output = exportOf([block('P', true, ['cat*'])]);
    expect(output).toContain('輸入有誤，未產生任何平台的查詢。');
    expect(output).not.toContain('[tiab]');
  });
});

describe('時間格式', () => {
  const date = new Date(2026, 10, 3, 9, 5);

  it('formatTimestamp 補零並附 UTC 偏移', () => {
    expect(formatTimestamp(date)).toMatch(/^2026-11-03 09:05 \(UTC[+-]\d{2}:\d{2}\)$/);
  });

  it('exportFilename 只含安全字元', () => {
    expect(exportFilename(date)).toBe('pico-search-20261103-0905.txt');
  });
});
