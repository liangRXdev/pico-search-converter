import { useEffect, useRef, useState } from 'react';
import { LIVE_VALIDATED, PLATFORM_LABELS } from '../config';
import { CODES } from '../core/codes';
import type { Platform, Result } from '../model/types';
import { buildPubmedUrl } from '../render/pubmed';
import { copyText } from './browser';
import { IssueList } from './IssueList';
import { QueryView } from './QueryView';

export type OutputState = 'empty' | 'pending' | 'blocked' | 'ready';

export interface OutputCardProps {
  platform: Platform;
  state: OutputState;
  /** state 為 ready 時才有值。 */
  result: Result | null;
  onStatus: (message: string) => void;
}

const PLATFORM_NOTES: Readonly<Record<Platform, string>> = {
  pubmed: 'NLM 介面。關鍵字加 [tiab]，heading 用 MeSH。',
  'embase-com': 'Elsevier 介面，不是 Ovid Embase。關鍵字加 :ti,ab,kw，heading 用 Emtree。',
  'ovid-medline': 'Ovid 介面。關鍵字加 .ti,ab,kf.，heading 用 MeSH。',
};

const PLACEHOLDER_TEXT: Readonly<Record<Exclude<OutputState, 'ready'>, string>> = {
  empty: '輸入關鍵字後，這裡會出現可直接貼上的查詢。',
  pending: '更新中…',
  blocked: '輸入有需要修正的地方，修正後才會產生查詢。',
};

/** 已用徽章或頁面固定文字呈現的訊息，不在清單內重複。 */
const SHOWN_ELSEWHERE = new Set<string>([CODES.NOT_LIVE_VALIDATED, CODES.STRUCTURAL_TRANSLATION]);

const COPIED_MS = 2000;

export function OutputCard({ platform, state, result, onStatus }: OutputCardProps) {
  const label = PLATFORM_LABELS[platform];
  const query = state === 'ready' ? (result?.query ?? null) : null;
  // 記錄「實際複製成功的 query」而非布林：輸入變更後，新 query 不得沿用舊的成功回饋（D9）
  const [copiedQuery, setCopiedQuery] = useState<string | null>(null);
  const copied = copiedQuery !== null && copiedQuery === query;
  const latestQuery = useRef(query);
  latestQuery.current = query;

  useEffect(() => {
    if (copiedQuery === null) return undefined;
    const timer = setTimeout(() => setCopiedQuery(null), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copiedQuery]);

  const copy = async () => {
    if (query === null) return;
    const target = query;
    const ok = await copyText(target);
    if (!ok) {
      onStatus(`無法複製 ${label} 查詢，請手動選取查詢文字後複製`);
      return;
    }
    setCopiedQuery(target);
    onStatus(
      latestQuery.current === target
        ? `已複製 ${label} 查詢`
        : `已複製先前的 ${label} 查詢，但輸入已變更，請重新複製`,
    );
  };

  const notes = state === 'ready' && result ? result.warnings : [];
  const pubmedUrl = platform === 'pubmed' && query !== null ? buildPubmedUrl(query) : null;

  return (
    <section className="output" aria-labelledby={`output-${platform}-title`}>
      <div className="output__head">
        <div>
          <h3 id={`output-${platform}-title`} className="output__title">
            {label}
          </h3>
          <p className="output__note">{PLATFORM_NOTES[platform]}</p>
        </div>
        {LIVE_VALIDATED[platform] ? null : (
          <p className="output__badge" title="這個平台的輸出格式還沒有在實際資料庫貼上執行驗證">
            尚未實機驗證
            <span className="visually-hidden">（Not live-validated）</span>
          </p>
        )}
      </div>

      {query !== null && result ? (
        <div className="output__query" tabIndex={0} role="group" aria-label={`${label} 查詢字串`}>
          <QueryView platform={platform} groups={result.groups} />
        </div>
      ) : (
        <p className="output__placeholder">
          {state === 'ready' ? `${label} 無法產生查詢，原因如下。` : PLACEHOLDER_TEXT[state]}
        </p>
      )}

      <div className="output__actions">
        <button type="button" className="button" disabled={query === null} onClick={copy}>
          {copied ? '已複製' : `複製 ${label} 查詢`}
        </button>
        {pubmedUrl ? (
          <a className="button button--link" href={pubmedUrl} target="_blank" rel="noopener noreferrer">
            在 PubMed 開啟這個查詢
          </a>
        ) : null}
      </div>

      <IssueList items={notes.filter((note) => !SHOWN_ELSEWHERE.has(note.code))} />
    </section>
  );
}
