import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLATFORM_LABELS, PLATFORM_ORDER } from '../src/config';
import type { Platform } from '../src/model/types';
import { App } from '../src/ui/App';

const GOLDEN: Record<Platform, string> = {
  pubmed:
    '(hypertension[tiab] OR "high blood pressure"[tiab]) AND (exercise[tiab] OR "physical activity"[tiab])',
  'embase-com':
    "(hypertension:ti,ab,kw OR 'high blood pressure':ti,ab,kw) AND (exercise:ti,ab,kw OR 'physical activity':ti,ab,kw)",
  'ovid-medline':
    '(hypertension.ti,ab,kf. OR "high blood pressure".ti,ab,kf.) AND (exercise.ti,ab,kf. OR "physical activity".ti,ab,kf.)',
};

function setup() {
  const user = userEvent.setup();
  const writeText = vi.spyOn(navigator.clipboard, 'writeText');
  render(<App debounceMs={0} now={() => new Date(2026, 10, 13, 15, 52)} />);
  return { user, writeText };
}

function card(platform: Platform): HTMLElement {
  return screen.getByRole('region', { name: PLATFORM_LABELS[platform] });
}

function queryText(platform: Platform): string | null {
  return card(platform).querySelector('code')?.textContent ?? null;
}

function terms(id: string): HTMLElement {
  return screen.getByLabelText(`${id} 的關鍵字與同義詞`);
}

async function settle() {
  await waitFor(() => expect(screen.queryByText('更新中…')).not.toBeInTheDocument());
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('起始畫面', () => {
  it('預載範例，三個平台顯示的文字與 golden query 逐字相同', () => {
    setup();
    for (const platform of PLATFORM_ORDER) {
      expect(queryText(platform)).toBe(GOLDEN[platform]);
    }
  });

  it('平台名稱完整標示，Embase 註明不是 Ovid Embase', () => {
    setup();
    expect(card('embase-com')).toHaveTextContent('不是 Ovid Embase');
    expect(screen.getByRole('heading', { name: 'Ovid MEDLINE' })).toBeInTheDocument();
  });

  it('T02：O 有內容但未納入時明示，且內容保留在表單', () => {
    setup();
    expect(screen.getByText('O 有內容但未納入檢索。')).toBeInTheDocument();
    expect(terms('O')).toHaveValue('"blood pressure"');
    expect(queryText('pubmed')).not.toContain('blood pressure"[tiab]) AND ("blood');
  });

  it('每個平台都標示尚未實機驗證，並顯示非等價聲明與隱私提醒', () => {
    setup();
    for (const platform of PLATFORM_ORDER) {
      expect(card(platform)).toHaveTextContent('尚未實機驗證');
    }
    expect(screen.getByText(/不是經過驗證的完整檢索策略/)).toBeInTheDocument();
    expect(screen.getByText(/請勿輸入可辨識病人身分的資訊/)).toBeInTheDocument();
  });
});

describe('live preview 等待期間（D9，正式 debounce 300 ms）', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function setupDebounced() {
    vi.useFakeTimers();
    render(<App debounceMs={300} now={() => new Date(2026, 10, 13, 15, 52)} />);
  }

  /** 以單一 change 事件改寫 P 欄（fake timers 下 user-event 會卡住計時器）。 */
  function appendToP(line: string) {
    const field = terms('P') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: `${field.value}\n${line}` } });
  }

  function controlsDisabled() {
    for (const platform of PLATFORM_ORDER) {
      expect(queryText(platform)).toBeNull();
      expect(within(card(platform)).getByRole('button', { name: /^複製/ })).toBeDisabled();
      expect(card(platform)).toHaveTextContent('更新中…');
    }
    expect(within(card('pubmed')).queryByRole('link', { name: '在 PubMed 開啟這個查詢' })).toBeNull();
    expect(screen.getByRole('button', { name: '複製全部查詢' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下載 TXT 檔' })).toBeDisabled();
  }

  it('修改後到 debounce 結束前不顯示舊輸出、停用所有複製與匯出；結束後顯示新輸出', () => {
    setupDebounced();
    act(() => vi.advanceTimersByTime(300));
    expect(queryText('pubmed')).toBe(GOLDEN.pubmed);

    appendToP('asthma');
    controlsDisabled();
    act(() => vi.advanceTimersByTime(299));
    controlsDisabled();
    act(() => vi.advanceTimersByTime(1));
    expect(queryText('pubmed')).toContain('asthma[tiab]');
    expect(within(card('pubmed')).getByRole('button', { name: /^複製/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: '下載 TXT 檔' })).toBeEnabled();
  });

  it('連續修改：前一次的計時器不會把輸出還原成中間狀態', () => {
    setupDebounced();
    act(() => vi.advanceTimersByTime(300));

    appendToP('asthma');
    act(() => vi.advanceTimersByTime(200));
    appendToP('copd');
    act(() => vi.advanceTimersByTime(200));
    // 第一次修改後已滿 400 ms，但第二次修改只過 200 ms：仍須在等待中
    controlsDisabled();
    act(() => vi.advanceTimersByTime(100));
    expect(queryText('pubmed')).toContain('asthma[tiab] OR copd[tiab]');
  });
});

describe('複製與匯出（T20、T21）', () => {
  it('T20：複製按鈕只寫入 query 本身', async () => {
    const { user, writeText } = setup();
    for (const platform of PLATFORM_ORDER) {
      await user.click(
        within(card(platform)).getByRole('button', { name: `複製 ${PLATFORM_LABELS[platform]} 查詢` }),
      );
      expect(writeText).toHaveBeenLastCalledWith(GOLDEN[platform]);
    }
    expect(screen.getByRole('status')).toHaveTextContent('已複製 Ovid MEDLINE 查詢');
  });

  it('複製後修改輸入：新 query 不沿用「已複製」', async () => {
    const { user } = setup();
    const copyButton = () => within(card('pubmed')).getByRole('button', { name: /複製 PubMed|已複製/ });
    await user.click(copyButton());
    expect(copyButton()).toHaveTextContent('已複製');

    await user.type(terms('P'), '{Enter}asthma');
    await settle();
    expect(queryText('pubmed')).toContain('asthma[tiab]');
    expect(copyButton()).toHaveTextContent('複製 PubMed 查詢');
  });

  it('剪貼簿延遲完成時輸入已變更：不顯示成功，並提示複製到的是先前的查詢', async () => {
    const { user, writeText } = setup();
    let resolveWrite: () => void = () => {};
    writeText.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );
    await user.click(within(card('pubmed')).getByRole('button', { name: /複製 PubMed/ }));
    expect(writeText).toHaveBeenLastCalledWith(GOLDEN.pubmed);

    await user.type(terms('P'), '{Enter}asthma');
    await settle();
    await act(async () => resolveWrite());

    expect(within(card('pubmed')).getByRole('button', { name: /複製 PubMed/ })).toHaveTextContent(
      '複製 PubMed 查詢',
    );
    expect(screen.getByRole('status')).toHaveTextContent('輸入已變更');
  });

  it('剪貼簿失敗時告知使用者，不假裝成功', async () => {
    const { user, writeText } = setup();
    writeText.mockRejectedValue(new Error('denied'));
    document.execCommand = vi.fn(() => false);
    await user.click(within(card('pubmed')).getByRole('button', { name: /複製 PubMed/ }));
    expect(screen.getByRole('status')).toHaveTextContent('無法複製 PubMed 查詢');
  });

  it('複製全部：三個平台各附名稱，不含警告文字', async () => {
    const { user, writeText } = setup();
    await user.click(screen.getByRole('button', { name: '複製全部查詢' }));
    const copied = String(writeText.mock.lastCall?.[0]);
    expect(copied).toBe(
      PLATFORM_ORDER.map((p) => `${PLATFORM_LABELS[p]}\n${GOLDEN[p]}`).join('\n\n'),
    );
  });

  it('T21：下載 TXT 檔，內容含三個 query 與產生時間', async () => {
    const { user } = setup();
    let blob: Blob | undefined;
    URL.createObjectURL = vi.fn((value: Blob | MediaSource) => {
      blob = value as Blob;
      return 'blob:test';
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await user.click(screen.getByRole('button', { name: '下載 TXT 檔' }));
    expect(click).toHaveBeenCalledOnce();
    const text = await blob?.text();
    for (const platform of PLATFORM_ORDER) expect(text).toContain(GOLDEN[platform]);
    expect(text).toContain('產生時間：2026-11-13 15:52');
    expect(screen.getByRole('status')).toHaveTextContent('已下載 TXT 檔');
  });

  it('PubMed 連結解碼後等於 query，且以新分頁開啟', () => {
    setup();
    const link = within(card('pubmed')).getByRole('link', { name: '在 PubMed 開啟這個查詢' });
    const href = link.getAttribute('href') ?? '';
    expect(decodeURIComponent(href.split('?term=')[1] ?? '')).toBe(GOLDEN.pubmed);
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('輸入與即時更新', () => {
  it('修改關鍵字後三個平台同步更新', async () => {
    const { user } = setup();
    await user.clear(terms('P'));
    await user.type(terms('P'), 'diabet*{Enter}beta-blocker');
    await settle();
    expect(queryText('pubmed')).toContain('(diabet*[tiab] OR "beta-blocker"[tiab])');
    expect(queryText('embase-com')).toContain("(diabet*:ti,ab,kw OR 'beta-blocker':ti,ab,kw)");
    expect(queryText('ovid-medline')).toContain('(diabet*.ti,ab,kf. OR "beta-blocker".ti,ab,kf.)');
  });

  it('T03：勾選納入 O 後成為額外的 AND 區塊', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('checkbox', { name: '納入檢索（O）' }));
    await settle();
    expect(queryText('pubmed')).toBe(`${GOLDEN.pubmed} AND ("blood pressure"[tiab])`);
    expect(screen.queryByText('O 有內容但未納入檢索。')).not.toBeInTheDocument();
  });

  it('輸入有誤：指出行號與修正方式，清掉舊輸出並停用複製與匯出', async () => {
    const { user } = setup();
    await user.type(terms('P'), '{Enter}cat*');
    await settle();
    expect(screen.getByText('第 3 行「cat*」')).toBeInTheDocument();
    expect(screen.getByText(/至少需要 4 個字母/)).toBeInTheDocument();
    expect(terms('P')).toHaveAttribute('aria-invalid', 'true');
    for (const platform of PLATFORM_ORDER) {
      expect(queryText(platform)).toBeNull();
      expect(within(card(platform)).getByRole('button', { name: /^複製/ })).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: '複製全部查詢' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下載 TXT 檔' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: /在 PubMed 開啟/ })).not.toBeInTheDocument();
  });

  it('產生查詢按鈕：有錯時把焦點移到出錯的欄位', async () => {
    const { user } = setup();
    await user.type(terms('I'), '{Enter}a AND b');
    await user.click(screen.getByRole('button', { name: '產生查詢' }));
    expect(terms('I')).toHaveFocus();
  });

  it('產生查詢按鈕：成功時把焦點移到輸出區', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: '產生查詢' }));
    expect(screen.getByRole('heading', { name: '三個平台的查詢' })).toHaveFocus();
  });

  it('清空後顯示引導而非錯誤；載入範例可還原', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: '清空' }));
    await settle();
    expect(terms('P')).toHaveValue('');
    expect(screen.getAllByText('輸入關鍵字後，這裡會出現可直接貼上的查詢。')).toHaveLength(3);
    expect(screen.queryByText('需修正')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '載入範例' }));
    await settle();
    expect(queryText('pubmed')).toBe(GOLDEN.pubmed);
  });
});

describe('subject heading（T12、T14）', () => {
  async function addMesh(user: ReturnType<typeof userEvent.setup>, term: string) {
    await user.click(screen.getByText('進階：加入已查證的 subject heading（P）'));
    const panel = screen.getByRole('region', { name: /P：病人或問題/ });
    await user.click(within(panel).getByRole('button', { name: '新增 MeSH heading' }));
    await user.type(screen.getByRole('textbox', { name: 'P 的 MeSH heading 第 1 筆' }), term);
    return panel;
  }

  it('未勾選已查證時擋下；勾選後只出現在 PubMed 與 Ovid，Embase 提出警告', async () => {
    const { user } = setup();
    const panel = await addMesh(user, 'Hypertension');
    await settle();
    expect(screen.getByText(/尚未確認/)).toBeInTheDocument();
    expect(queryText('pubmed')).toBeNull();

    await user.click(within(panel).getByRole('checkbox', { name: '我已查證這個 heading 存在' }));
    await settle();
    expect(queryText('pubmed')).toContain('("Hypertension"[MeSH Terms] OR hypertension[tiab]');
    expect(queryText('ovid-medline')).toContain('(exp Hypertension/ OR hypertension.ti,ab,kf.');
    expect(queryText('embase-com')).toBe(GOLDEN['embase-com']);
    expect(card('embase-com')).toHaveTextContent('Emtree mapping requires verification');
  });

  it('勾選查證後修改 heading 名稱：自動取消勾選並重新擋下，不輸出未查證的新名稱', async () => {
    const { user } = setup();
    const panel = await addMesh(user, 'Hypertension');
    const confirm = within(panel).getByRole('checkbox', { name: '我已查證這個 heading 存在' });
    const explode = within(panel).getByRole('checkbox', { name: '含下位詞（explode）' });
    await user.click(confirm);
    await settle();
    expect(queryText('pubmed')).toContain('"Hypertension"[MeSH Terms]');

    // 切換 explode 不影響查證（heading 名稱沒變）
    await user.click(explode);
    await settle();
    expect(confirm).toBeChecked();
    expect(queryText('pubmed')).toContain('"Hypertension"[MeSH Terms:noexp]');

    await user.type(screen.getByRole('textbox', { name: 'P 的 MeSH heading 第 1 筆' }), 'Invented');
    await settle();
    expect(confirm).not.toBeChecked();
    expect(screen.getByText(/尚未確認/)).toBeInTheDocument();
    expect(queryText('pubmed')).toBeNull();
    expect(queryText('ovid-medline')).toBeNull();
  });

  it('產生查詢按鈕：heading 有錯時焦點移到該筆 heading，而非關鍵字欄', async () => {
    const { user } = setup();
    const panel = await addMesh(user, 'Hypertension');
    await user.click(within(panel).getByRole('checkbox', { name: '我已查證這個 heading 存在' }));
    await user.click(within(panel).getByRole('button', { name: '新增 MeSH heading' }));
    const second = screen.getByRole('textbox', { name: 'P 的 MeSH heading 第 2 筆' });
    await user.type(second, 'Invalid/Heading');
    await user.click(screen.getByRole('button', { name: '產生查詢' }));
    expect(second).toHaveFocus();
    expect(terms('P')).not.toHaveFocus();
  });

  it('T14：P 只剩 MeSH 時 Embase.com 不輸出並說明原因，其他平台照常', async () => {
    const { user } = setup();
    const panel = await addMesh(user, 'Hypertension');
    await user.click(within(panel).getByRole('checkbox', { name: '我已查證這個 heading 存在' }));
    await user.clear(terms('P'));
    await settle();
    expect(queryText('embase-com')).toBeNull();
    expect(card('embase-com')).toHaveTextContent('Embase.com (Elsevier) 無法產生查詢');
    expect(within(card('embase-com')).getByRole('button', { name: /^複製/ })).toBeDisabled();
    expect(queryText('pubmed')).toContain('("Hypertension"[MeSH Terms])');
    expect(within(card('pubmed')).getByRole('button', { name: /^複製/ })).toBeEnabled();
  });
});

describe('T17：輸入只當文字處理', () => {
  it('HTML 與 script 樣式的輸入不會變成 DOM 節點', async () => {
    const { user } = setup();
    await user.clear(terms('P'));
    await user.click(terms('P'));
    await user.paste('<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>');
    await settle();
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelectorAll('script')).toHaveLength(0);
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
    expect(screen.getByText(/第 1 行「<img src=x/)).toBeInTheDocument();
    expect(queryText('pubmed')).toBeNull();
  });
});

describe('T24：鍵盤與輔助技術', () => {
  it('所有互動控制項都有可辨識的名稱', () => {
    setup();
    const controls = document.querySelectorAll('button, textarea, input, a[href], summary');
    expect(controls.length).toBeGreaterThan(15);
    for (const control of controls) {
      if (control.tagName === 'SUMMARY') expect(control.textContent).not.toBe('');
      else expect(control).toHaveAccessibleName();
    }
  });

  it('控制項都是原生元素，且沒有被移出 Tab 順序', () => {
    setup();
    expect(document.querySelectorAll('[role="button"], [onclick]')).toHaveLength(0);
    for (const control of document.querySelectorAll('button, textarea, input, a[href]')) {
      expect(control).not.toHaveAttribute('tabindex', '-1');
    }
  });

  it('只用鍵盤即可到達並觸發複製', async () => {
    const { user, writeText } = setup();
    const target = within(card('pubmed')).getByRole('button', { name: /複製 PubMed/ });
    for (let i = 0; i < 60 && document.activeElement !== target; i += 1) await user.tab();
    expect(target).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(writeText).toHaveBeenCalledWith(GOLDEN.pubmed);
  });

  it('錯誤訊息透過 aria-describedby 與欄位關聯；狀態訊息在 live region', async () => {
    const { user } = setup();
    await user.type(terms('P'), '{Enter}cat*');
    await settle();
    const ids = (terms('P').getAttribute('aria-describedby') ?? '').split(' ');
    const described = ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
    expect(described).toContain('至少需要 4 個字母');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
