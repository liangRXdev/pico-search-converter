import { useState } from 'react';
import { LIMITS } from '../config';
import { splitLines } from '../core/normalize';
import type { ConceptId, ValidationIssue } from '../model/types';
import type { ConceptState } from './formState';
import { HeadingList } from './HeadingList';
import { IssueList, type IssueListItem } from './IssueList';
import { CONCEPT_LABELS } from './labels';

export interface ConceptPanelProps {
  id: ConceptId;
  state: ConceptState;
  /** 屬於這個概念的驗證訊息。 */
  issues: readonly ValidationIssue[];
  onChange: (next: ConceptState) => void;
}

const PLACEHOLDERS: Readonly<Record<ConceptId, string>> = {
  P: 'hypertension\n"high blood pressure"',
  I: 'exercise\n"physical activity"',
  C: 'usual care',
  O: 'mortality',
};

export function termsInputId(id: ConceptId): string {
  return `terms-${id}`;
}

function describeLine(lines: readonly string[], issue: ValidationIssue): IssueListItem {
  if (issue.index === undefined) return issue;
  const raw = (lines[issue.index] ?? '').trim();
  const shown = raw.length > 40 ? `${raw.slice(0, 40)}…` : raw;
  return { ...issue, where: `第 ${issue.index + 1} 行「${shown}」` };
}

export function ConceptPanel({ id, state, issues, onChange }: ConceptPanelProps) {
  const label = CONCEPT_LABELS[id];
  const hasHeadings = state.mesh.length + state.emtree.length > 0;
  const [advancedOpen, setAdvancedOpen] = useState(hasHeadings);
  const lines = splitLines(state.text);
  const textIssues = issues
    .filter((issue) => issue.field === 'freeText' || issue.field === undefined)
    .map((issue) => describeLine(lines, issue));
  const hasError = textIssues.some((issue) => issue.severity === 'error');
  const hintId = `${termsInputId(id)}-hint`;
  const issuesId = `${termsInputId(id)}-issues`;

  return (
    <section
      className={`concept concept--${id.toLowerCase()}${state.enabled ? '' : ' concept--off'}`}
      aria-labelledby={`concept-${id}-title`}
    >
      <div className="concept__head">
        <h3 id={`concept-${id}-title`} className="concept__title">
          <span className="concept__letter" aria-hidden="true">
            {id}
          </span>
          <span>
            <span className="visually-hidden">{id}：</span>
            {label.name}
            <span className="concept__english">{label.english}</span>
          </span>
        </h3>
        <label className="concept__include">
          <input
            type="checkbox"
            checked={state.enabled}
            onChange={(event) => onChange({ ...state, enabled: event.target.checked })}
          />
          <span>
            納入檢索<span className="visually-hidden">（{id}）</span>
          </span>
        </label>
      </div>

      <label className="concept__label" htmlFor={termsInputId(id)}>
        {id} 的關鍵字與同義詞
      </label>
      <textarea
        id={termsInputId(id)}
        className="concept__terms"
        rows={Math.min(Math.max(lines.length + 1, 3), 10)}
        placeholder={PLACEHOLDERS[id]}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={hasError}
        aria-describedby={textIssues.length > 0 ? `${hintId} ${issuesId}` : hintId}
        value={state.text}
        onChange={(event) => onChange({ ...state, text: event.target.value })}
      />
      <p id={hintId} className="concept__hint">
        一行一個英文詞或片語，最多 {LIMITS.maxTermsPerConcept} 筆。同一格內的詞會用 OR 連接。
      </p>
      <IssueList id={issuesId} items={textIssues} />

      <details
        className="concept__advanced"
        open={advancedOpen || hasHeadings}
        onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
      >
        <summary>進階：加入已查證的 subject heading（{id}）</summary>
        <p className="concept__hint">
          MeSH 與 Emtree 是不同的詞彙庫，這個工具不會幫你互相轉換；請分別查證後各自輸入。
        </p>
        <HeadingList
          concept={id}
          vocabulary="mesh"
          rows={state.mesh}
          issues={issues.filter((issue) => issue.field === 'mesh')}
          onChange={(mesh) => onChange({ ...state, mesh })}
        />
        <HeadingList
          concept={id}
          vocabulary="emtree"
          rows={state.emtree}
          issues={issues.filter((issue) => issue.field === 'emtree')}
          onChange={(emtree) => onChange({ ...state, emtree })}
        />
      </details>
    </section>
  );
}
