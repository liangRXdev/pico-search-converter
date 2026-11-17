import { useMemo, useRef, useState } from 'react';
import {
  APP_NAME,
  CONCEPT_ORDER,
  DISCLAIMER,
  LIVE_PREVIEW_DEBOUNCE_MS,
  PLATFORM_LABELS,
  PLATFORM_ORDER,
  SOURCE_LINKS,
} from '../config';
import { generate } from '../core/generate';
import { buildTxtExport, exportFilename, formatTimestamp } from '../export/txt';
import type { Result, ValidationIssue } from '../model/types';
import { copyText, downloadText } from './browser';
import { ConceptPanel, termsInputId } from './ConceptPanel';
import { emptyForm, exampleForm, isBlank, toModel, type FormState } from './formState';
import { headingInputId } from './HeadingList';
import { IssueList } from './IssueList';
import { OutputCard, type OutputState } from './OutputCard';
import { useDebounced } from './useDebounced';

export interface AppProps {
  /** live preview 的延遲；測試可傳 0。 */
  debounceMs?: number;
  /** 匯出用的時間來源；測試可注入固定時間。 */
  now?: () => Date;
}

/** 第一個錯誤對應的輸入框 id：heading 錯誤定位到該筆 heading，其餘定位到概念的關鍵字欄。 */
function firstErrorInputId(issues: readonly ValidationIssue[]): string {
  const issue = issues.find((item) => item.severity === 'error' && item.concept);
  if (!issue?.concept) return termsInputId('P');
  if ((issue.field === 'mesh' || issue.field === 'emtree') && issue.index !== undefined) {
    return headingInputId(issue.concept, issue.field, issue.index);
  }
  return termsInputId(issue.concept);
}

function copyAllText(results: readonly Result[]): string {
  return results
    .filter((result) => result.query !== null)
    .map((result) => `${PLATFORM_LABELS[result.platform]}\n${result.query}`)
    .join('\n\n');
}

export function App({ debounceMs = LIVE_PREVIEW_DEBOUNCE_MS, now = () => new Date() }: AppProps) {
  const [form, setForm] = useState<FormState>(exampleForm);
  const [settled, flush] = useDebounced(form, debounceMs);
  const [status, setStatus] = useState('');
  const outputRef = useRef<HTMLHeadingElement>(null);

  const blank = isBlank(settled);
  const model = useMemo(() => toModel(settled), [settled]);
  const generation = useMemo(() => (blank ? null : generate(model)), [blank, model]);
  const issues = generation?.issues ?? [];
  const results = generation?.results ?? null;
  const pending = form !== settled;
  const outputState: OutputState = pending ? 'pending' : blank ? 'empty' : results ? 'ready' : 'blocked';
  const copyable = outputState === 'ready' && results ? results.filter((r) => r.query !== null) : [];

  const replaceForm = (next: FormState, message: string) => {
    setForm(next);
    setStatus(message);
  };

  const handleGenerate = () => {
    flush();
    const current = isBlank(form) ? null : generate(toModel(form));
    if (!current || !current.results) {
      const target = current ? firstErrorInputId(current.issues) : termsInputId('P');
      document.getElementById(target)?.focus();
      setStatus(current ? '輸入有需要修正的地方，已移到第一個問題。' : '請先輸入關鍵字。');
      return;
    }
    outputRef.current?.focus();
    setStatus('已產生三個平台的查詢。');
  };

  const handleCopyAll = async () => {
    const ok = await copyText(copyAllText(copyable));
    setStatus(ok ? '已複製全部查詢' : '無法複製，請改用各平台的複製按鈕或手動選取。');
  };

  const handleExport = () => {
    if (!generation) return;
    const date = now();
    const text = buildTxtExport({ blocks: model.blocks, generation, generatedAt: formatTimestamp(date) });
    const ok = downloadText(exportFilename(date), text);
    setStatus(ok ? '已下載 TXT 檔' : '無法下載檔案，請改用複製。');
  };

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">{APP_NAME}</h1>
        <p className="page__lead">
          輸入 PICO 關鍵字，同時得到 PubMed、Embase.com、Ovid MEDLINE 三種寫法。括號與 Boolean
          結構在三個平台相同，欄位代碼與引號各自不同。
        </p>
        <p className="page__privacy">
          所有運算都在你的瀏覽器內完成，不會上傳任何內容。請勿輸入可辨識病人身分的資訊。
        </p>
      </header>

      <main className="page__main">
        <section className="inputs" aria-labelledby="inputs-title">
          <h2 id="inputs-title" className="section-title">
            你的 PICO
          </h2>
          {CONCEPT_ORDER.map((id) => (
            <ConceptPanel
              key={id}
              id={id}
              state={form[id]}
              issues={pending ? [] : issues.filter((issue) => issue.concept === id)}
              onChange={(next) => setForm({ ...form, [id]: next })}
            />
          ))}
          <div className="inputs__actions">
            <button type="button" className="button button--primary" onClick={handleGenerate}>
              產生查詢
            </button>
            <button
              type="button"
              className="button"
              onClick={() => replaceForm(exampleForm(), '已載入範例')}
            >
              載入範例
            </button>
            <button
              type="button"
              className="button"
              onClick={() => replaceForm(emptyForm(), '已清空所有欄位')}
            >
              清空
            </button>
          </div>
        </section>

        <section className="outputs" aria-labelledby="outputs-title">
          <h2 id="outputs-title" className="section-title" tabIndex={-1} ref={outputRef}>
            三個平台的查詢
          </h2>
          <p className="outputs__legend">
            <span className="outputs__swatch outputs__swatch--term">彩色</span>
            是你輸入的詞，依 P、I、C、O 分色；
            <span className="outputs__swatch outputs__swatch--syntax">灰底</span>
            是該平台自動加上的語法。
          </p>
          <p className="outputs__disclaimer">{DISCLAIMER}</p>
          <IssueList items={pending ? [] : issues.filter((issue) => !issue.concept)} />

          {PLATFORM_ORDER.map((platform) => (
            <OutputCard
              key={platform}
              platform={platform}
              state={outputState}
              result={results?.find((result) => result.platform === platform) ?? null}
              onStatus={setStatus}
            />
          ))}

          <div className="outputs__actions">
            <button type="button" className="button" disabled={copyable.length === 0} onClick={handleCopyAll}>
              複製全部查詢
            </button>
            <button
              type="button"
              className="button"
              disabled={outputState !== 'ready'}
              onClick={handleExport}
            >
              下載 TXT 檔
            </button>
          </div>
          <p className="status" role="status" aria-live="polite">
            {status}
          </p>
        </section>
      </main>

      <footer className="page__footer">
        <section aria-labelledby="next-title">
          <h2 id="next-title" className="section-title">
            貼到資料庫之後
          </h2>
          <ol className="steps">
            <li>執行查詢，先確認沒有語法錯誤。</li>
            <li>看 search details 或檢索歷程，確認每個詞與 heading 被解析成你要的意思。</li>
            <li>拿幾篇你已知相關的文獻核對，確認查得到。</li>
            <li>記下檢索日期、資料庫、平台與完整的查詢字串。</li>
          </ol>
        </section>
        <section aria-labelledby="sources-title">
          <h2 id="sources-title" className="section-title">
            語法查證來源
          </h2>
          <ul className="sources">
            {SOURCE_LINKS.map((link) => (
              <li key={link.url}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </footer>
    </div>
  );
}
