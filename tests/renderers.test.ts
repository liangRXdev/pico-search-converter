import { describe, expect, it } from 'vitest';
import livePack from '../docs/live-validation.md?raw';
import { LIMITS, PLATFORM_ORDER, PUBMED_SEARCH_URL } from '../src/config';
import { CODES } from '../src/core/codes';
import { generate } from '../src/core/generate';
import type {
  BlockInput,
  ConceptId,
  ControlledTermInput,
  Platform,
  QueryAst,
  Result,
  SearchModel,
} from '../src/model/types';
import { renderAll } from '../src/render';
import { renderEmbaseCom } from '../src/render/embaseCom';
import { renderOvidMedline } from '../src/render/ovidMedline';
import { buildPubmedUrl, renderPubmed } from '../src/render/pubmed';

interface Fixture {
  name: string;
  model: SearchModel;
  expected: Record<Platform, string | null>;
}

const fixtures = Object.entries(
  import.meta.glob<Fixture>('./golden/*.json', { eager: true, import: 'default' }),
).sort(([a], [b]) => a.localeCompare(b));

function heading(term: string, explode: boolean): ControlledTermInput {
  return { term, explode, verification: 'user_confirmed', source: 'user_input' };
}

function block(id: ConceptId, freeText: string[], extra: Partial<BlockInput> = {}): BlockInput {
  return { id, enabled: true, freeText, mesh: [], emtree: [], ...extra };
}

function run(blocks: BlockInput[]): Record<Platform, Result> {
  const { results, issues } = generate({ blocks });
  if (!results) throw new Error(`輸入驗證未通過：${JSON.stringify(issues)}`);
  return Object.fromEntries(results.map((result) => [result.platform, result])) as Record<
    Platform,
    Result
  >;
}

function codesOf(result: Result): string[] {
  return result.warnings.map((warning) => warning.code);
}

describe('golden fixtures（spec §5、T01、T03、T07、T10）', () => {
  it('fixture 檔案都有載入', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(4);
  });

  it.each(fixtures)('%s', (_path, fixture) => {
    const { results } = generate(fixture.model);
    expect(results?.map((result) => result.platform)).toEqual(PLATFORM_ORDER);
    for (const result of results ?? []) {
      expect(result.query, `${fixture.name} / ${result.platform}`).toBe(
        fixture.expected[result.platform],
      );
    }
  });

  it('live 驗證包內的 query 與 fixture 逐字一致（送驗的就是測試比對的字串）', () => {
    for (const [, fixture] of fixtures) {
      for (const query of Object.values(fixture.expected)) {
        if (query !== null) expect(livePack).toContain(`\n${query}\n`);
      }
    }
  });

  it('T25：相同輸入重複產生，輸出逐位元組相同', () => {
    for (const [, fixture] of fixtures) {
      expect(JSON.stringify(generate(fixture.model))).toBe(JSON.stringify(generate(fixture.model)));
    }
  });
});

describe('Boolean 結構（spec §4.2）', () => {
  it('單一概念、單一詞仍保留括號', () => {
    const results = run([block('P', ['hypertension'])]);
    expect(results.pubmed.query).toBe('(hypertension[tiab])');
    expect(results['embase-com'].query).toBe('(hypertension:ti,ab,kw)');
    expect(results['ovid-medline'].query).toBe('(hypertension.ti,ab,kf.)');
  });

  it('括號成對，且概念之間只用 AND、概念之內只用 OR', () => {
    const results = run([block('P', ['a1', 'a2', 'a3']), block('I', ['b1', 'b2']), block('O', ['c1'])]);
    for (const platform of PLATFORM_ORDER) {
      const query = results[platform].query ?? '';
      const groups = query.split(' AND ');
      expect(groups).toHaveLength(3);
      for (const group of groups) {
        expect(group.startsWith('(') && group.endsWith(')')).toBe(true);
        expect(group.slice(1, -1)).not.toMatch(/[()]/);
      }
      expect(query).not.toMatch(/\bNOT\b/);
    }
  });

  it('各平台只使用自己的欄位代碼', () => {
    const results = run([block('P', ['hypertension', 'high blood pressure', 'diabet*'])]);
    expect(results.pubmed.query).not.toMatch(/:ti,ab,kw|\.ti,ab,kf\.|'/);
    expect(results['embase-com'].query).not.toMatch(/\[tiab\]|\.ti,ab,kf\.|"/);
    expect(results['ovid-medline'].query).not.toMatch(/\[tiab\]|:ti,ab,kw|'/);
  });
});

describe('subject heading（spec §4.3）', () => {
  const meshBlock = (explode: boolean) =>
    block('P', ['hypertension'], { mesh: [heading('Hypertension', explode)] });
  const emtreeBlock = (explode: boolean) =>
    block('P', ['hypertension'], { emtree: [heading('essential hypertension', explode)] });

  it('T12：MeSH explode／noexp 在 PubMed 與 Ovid 的寫法', () => {
    const exploded = run([meshBlock(true)]);
    expect(exploded.pubmed.query).toBe('("Hypertension"[MeSH Terms] OR hypertension[tiab])');
    expect(exploded['ovid-medline'].query).toBe('(exp Hypertension/ OR hypertension.ti,ab,kf.)');
    const flat = run([meshBlock(false)]);
    expect(flat.pubmed.query).toBe('("Hypertension"[MeSH Terms:noexp] OR hypertension[tiab])');
    expect(flat['ovid-medline'].query).toBe('(Hypertension/ OR hypertension.ti,ab,kf.)');
  });

  it('T12：MeSH 不會被當成 Emtree 輸出到 Embase.com，並提出警告', () => {
    const { 'embase-com': embase } = run([meshBlock(true)]);
    expect(embase.query).toBe('(hypertension:ti,ab,kw)');
    expect(embase.query).not.toMatch(/\/exp|\/de/);
    expect(embase.warnings).toContainEqual(
      expect.objectContaining({ code: CODES.NATIVE_HEADING_MISSING, severity: 'warning' }),
    );
    const warning = embase.warnings.find((w) => w.code === CODES.NATIVE_HEADING_MISSING);
    expect(warning?.message).toContain('Emtree mapping requires verification');
  });

  it('T13：Emtree explode／de 在 Embase.com 的寫法', () => {
    expect(run([emtreeBlock(true)])['embase-com'].query).toBe(
      "('essential hypertension'/exp OR hypertension:ti,ab,kw)",
    );
    expect(run([emtreeBlock(false)])['embase-com'].query).toBe(
      "('essential hypertension'/de OR hypertension:ti,ab,kw)",
    );
  });

  it('T13：Emtree 不會被當成 MeSH 輸出到 PubMed 或 Ovid，並提出警告', () => {
    const results = run([emtreeBlock(true)]);
    expect(results.pubmed.query).toBe('(hypertension[tiab])');
    expect(results['ovid-medline'].query).toBe('(hypertension.ti,ab,kf.)');
    for (const platform of ['pubmed', 'ovid-medline'] as const) {
      expect(codesOf(results[platform])).toContain(CODES.NATIVE_HEADING_MISSING);
    }
    expect(codesOf(results['embase-com'])).not.toContain(CODES.NATIVE_HEADING_MISSING);
  });

  it('兩種 heading 都有提供時不警告', () => {
    const results = run([
      block('P', ['hypertension'], {
        mesh: [heading('Hypertension', true)],
        emtree: [heading('hypertension', true)],
      }),
    ]);
    for (const platform of PLATFORM_ORDER) {
      expect(codesOf(results[platform])).not.toContain(CODES.NATIVE_HEADING_MISSING);
    }
  });

  it('T14：只有 MeSH 的概念 → Embase.com 為 blocking error，其他平台照常', () => {
    const results = run([
      block('P', [], { mesh: [heading('Hypertension', true)] }),
      block('I', ['exercise']),
    ]);
    expect(results['embase-com'].query).toBeNull();
    expect(results['embase-com'].warnings).toContainEqual(
      expect.objectContaining({ code: CODES.NO_TERMS_FOR_PLATFORM, severity: 'error' }),
    );
    expect(results.pubmed.query).not.toBeNull();
    expect(results['ovid-medline'].query).not.toBeNull();
  });

  it('只有 Emtree 的概念 → PubMed 與 Ovid 為 blocking error，Embase.com 照常', () => {
    const results = run([block('P', [], { emtree: [heading('hypertension', true)] })]);
    expect(results.pubmed.query).toBeNull();
    expect(results['ovid-medline'].query).toBeNull();
    expect(results['embase-com'].query).toBe("('hypertension'/exp)");
  });

  it('有 MeSH 時 Ovid 提醒到 heading 畫面確認', () => {
    expect(codesOf(run([meshBlock(true)])['ovid-medline'])).toContain(CODES.OVID_MESH_VERIFY);
    expect(codesOf(run([block('P', ['x1'])])['ovid-medline'])).not.toContain(CODES.OVID_MESH_VERIFY);
  });
});

describe('Ovid 保留字', () => {
  it('heading 含 and 時加引號', () => {
    const results = run([block('P', [], { mesh: [heading('Wounds and Injuries', true)] })]);
    expect(results['ovid-medline'].query).toBe('(exp "Wounds and Injuries"/)');
  });

  it('單一詞恰為保留字時加引號，其他平台不受影響', () => {
    const results = run([block('P', ['use', 'usage'])]);
    expect(results['ovid-medline'].query).toBe('("use".ti,ab,kf. OR usage.ti,ab,kf.)');
    expect(results.pubmed.query).toBe('(use[tiab] OR usage[tiab])');
  });
});

describe('各平台固定提示', () => {
  it('每個平台都標示結構轉譯與未經 live 驗證', () => {
    const results = run([block('P', ['hypertension'])]);
    for (const platform of PLATFORM_ORDER) {
      expect(codesOf(results[platform])).toEqual(
        expect.arrayContaining([CODES.STRUCTURAL_TRANSLATION, CODES.NOT_LIVE_VALIDATED]),
      );
    }
    expect(codesOf(results.pubmed)).toContain(CODES.PUBMED_EXPLICIT_FIELDS);
  });

  it('有 truncation 時才提示各平台展開規則不同', () => {
    expect(codesOf(run([block('P', ['diabet*'])]).pubmed)).toContain(CODES.TRUNCATION_DIFFERS);
    expect(codesOf(run([block('P', ['diabetes'])]).pubmed)).not.toContain(CODES.TRUNCATION_DIFFERS);
  });

  it('query 字串本身不含任何警告文字', () => {
    const results = run([block('P', ['hypertension'], { mesh: [heading('Hypertension', true)] })]);
    for (const platform of PLATFORM_ORDER) {
      expect(results[platform].query).toMatch(/^[\x20-\x7E]+$/);
    }
  });
});

describe('上限與防線', () => {
  it('輸入驗證未通過時不輸出任何平台', () => {
    expect(generate({ blocks: [block('P', ['cat*'])] }).results).toBeNull();
  });

  it('最終 query 超過長度上限 → 該平台 blocking error', () => {
    const long = (prefix: string) =>
      Array.from({ length: LIMITS.maxTermsPerConcept }, (_, i) => `${prefix}${i}`.padEnd(190, 'x'));
    const results = run([block('P', long('p')), block('I', long('i'))]);
    for (const platform of PLATFORM_ORDER) {
      expect(results[platform].query).toBeNull();
      expect(codesOf(results[platform])).toEqual([CODES.QUERY_TOO_LONG]);
    }
  });

  it('未經 core 驗證的 AST 值不會被拼進查詢', () => {
    const unsafe = (value: string): QueryAst => ({
      concepts: [
        {
          id: 'P',
          terms: [{ kind: 'freeText', value, phrase: true, trailingTruncation: false }],
        },
      ],
    });
    for (const value of ["crohn's disease", 'a" OR b', 'x[tiab]', '<script>']) {
      expect(() => renderPubmed(unsafe(value))).toThrow();
      expect(() => renderEmbaseCom(unsafe(value))).toThrow();
      expect(() => renderOvidMedline(unsafe(value))).toThrow();
      expect(() => renderAll(unsafe(value))).toThrow();
    }
  });
});

describe('PubMed 連結（T22）', () => {
  it('encodeURIComponent 來回後與 query 完全相同', () => {
    for (const [, fixture] of fixtures) {
      const query = fixture.expected.pubmed;
      if (query === null) continue;
      const url = buildPubmedUrl(query);
      expect(url?.startsWith(PUBMED_SEARCH_URL)).toBe(true);
      expect(decodeURIComponent((url ?? '').slice(PUBMED_SEARCH_URL.length))).toBe(query);
    }
  });

  it('連結的 query 部分不含未編碼的特殊字元', () => {
    const url = buildPubmedUrl('("Diabetes Mellitus, Type 2"[MeSH Terms] OR diabet*[tiab])') ?? '';
    expect(url.slice(PUBMED_SEARCH_URL.length)).not.toMatch(/[\s"[\]&#,]/);
  });

  it('過長時不產生連結，並在 PubMed 結果中說明', () => {
    expect(buildPubmedUrl('x'.repeat(LIMITS.maxPubmedUrlLength))).toBeNull();
    const terms = Array.from({ length: 30 }, (_, i) => `hypertension term number ${i} padding text`);
    const { pubmed } = run([block('P', terms), block('I', terms)]);
    expect(pubmed.query).not.toBeNull();
    expect(codesOf(pubmed)).toContain(CODES.PUBMED_LINK_DISABLED);
  });
});
