import type { ConceptId, ValidationIssue } from '../model/types';
import type { Vocabulary } from '../render/shared';
import { newHeadingRow, type HeadingRow } from './formState';
import { IssueList } from './IssueList';
import { VOCABULARY_HELP } from './labels';

export interface HeadingListProps {
  concept: ConceptId;
  vocabulary: Vocabulary;
  rows: readonly HeadingRow[];
  issues: readonly ValidationIssue[];
  onChange: (rows: HeadingRow[]) => void;
}

/** heading 輸入框的 id；index 與 core 回報的 `ValidationIssue.index` 對齊（同一陣列、不過濾空列）。 */
export function headingInputId(concept: ConceptId, vocabulary: Vocabulary, index: number): string {
  return `heading-${concept}-${vocabulary}-${index}`;
}

export function HeadingList({ concept, vocabulary, rows, issues, onChange }: HeadingListProps) {
  const help = VOCABULARY_HELP[vocabulary];
  const update = (key: number, patch: Partial<HeadingRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <div className="headings">
      <p className="headings__title">
        <strong>{help.label}</strong>
        <span className="headings__scope">{help.platforms}</span>
        <a className="headings__link" href={help.url} target="_blank" rel="noopener noreferrer">
          {help.linkLabel}
        </a>
      </p>
      {rows.map((row, index) => {
        const name = `${concept} 的 ${help.label} heading 第 ${index + 1} 筆`;
        const rowIssues = issues.filter((issue) => issue.index === index);
        const errorId = `heading-${concept}-${vocabulary}-${row.key}-errors`;
        return (
          <div key={row.key} className="headings__row">
            <input
              id={headingInputId(concept, vocabulary, index)}
              className="headings__input"
              type="text"
              aria-label={name}
              aria-invalid={rowIssues.length > 0}
              aria-describedby={rowIssues.length > 0 ? errorId : undefined}
              placeholder={vocabulary === 'mesh' ? 'Hypertension' : 'essential hypertension'}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={row.term}
              // 查證的是「這個名稱」：名稱一改就撤銷確認，否則新名稱會沿用舊的查證直接輸出
              onChange={(event) => update(row.key, { term: event.target.value, confirmed: false })}
            />
            <label className="headings__check">
              <input
                type="checkbox"
                checked={row.explode}
                onChange={(event) => update(row.key, { explode: event.target.checked })}
              />
              含下位詞（explode）
            </label>
            <label className="headings__check">
              <input
                type="checkbox"
                checked={row.confirmed}
                onChange={(event) => update(row.key, { confirmed: event.target.checked })}
              />
              我已查證這個 heading 存在
            </label>
            <button
              type="button"
              className="button button--quiet"
              aria-label={`移除${name}`}
              onClick={() => onChange(rows.filter((item) => item.key !== row.key))}
            >
              移除
            </button>
            <IssueList id={errorId} items={rowIssues} />
          </div>
        );
      })}
      <button
        type="button"
        className="button button--quiet"
        onClick={() => onChange([...rows, newHeadingRow()])}
      >
        新增 {help.label} heading
      </button>
    </div>
  );
}
