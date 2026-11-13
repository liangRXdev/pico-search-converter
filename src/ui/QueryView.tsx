import { Fragment } from 'react';
import type { Platform, QueryGroup } from '../model/types';

export interface QueryViewProps {
  platform: Platform;
  groups: readonly QueryGroup[];
}

interface PartPieces {
  prefix: string;
  body: string;
  suffix: string;
  heading: boolean;
}

/** 各平台加在詞後（或詞前）的語法；用來把「使用者的詞」與「平台語法」分開上色。 */
const SYNTAX: Readonly<Record<Platform, RegExp>> = {
  pubmed: /^()(.*?)(\[[^\]]+\])$/,
  'embase-com': /^()(.*?)(:ti,ab,kw|\/exp|\/de)$/,
  'ovid-medline': /^(exp )?(.*?)(\.ti,ab,kf\.|\/)$/,
};

const FREE_TEXT_SUFFIX = new Set(['[tiab]', ':ti,ab,kw', '.ti,ab,kf.']);

function splitPart(platform: Platform, part: string): PartPieces {
  const match = SYNTAX[platform].exec(part);
  if (!match) return { prefix: '', body: part, suffix: '', heading: false };
  const [, prefix = '', body = '', suffix = ''] = match;
  return { prefix, body, suffix, heading: !FREE_TEXT_SUFFIX.has(suffix) };
}

/**
 * 以分色方式顯示 query。DOM 的文字內容與 query 字串逐字相同，
 * 換行與概念標記全由 CSS 產生，不會混入可選取的文字。
 */
export function QueryView({ platform, groups }: QueryViewProps) {
  return (
    <code className="query">
      {groups.map((group, groupIndex) => (
        <Fragment key={group.concept}>
          {groupIndex > 0 ? <span className="query__and"> AND </span> : null}
          <span
            className={`query__group query__group--${group.concept.toLowerCase()}`}
            data-concept={group.concept}
          >
            <span className="query__paren">(</span>
            {group.parts.map((part, partIndex) => {
              const pieces = splitPart(platform, part);
              return (
                <Fragment key={`${partIndex}-${part}`}>
                  {partIndex > 0 ? <span className="query__or"> OR </span> : null}
                  <span className={`query__part${pieces.heading ? ' query__part--heading' : ''}`}>
                    {pieces.prefix ? <span className="query__syntax">{pieces.prefix}</span> : null}
                    <span className="query__term">{pieces.body}</span>
                    {pieces.suffix ? <span className="query__syntax">{pieces.suffix}</span> : null}
                  </span>
                </Fragment>
              );
            })}
            <span className="query__paren">)</span>
          </span>
        </Fragment>
      ))}
    </code>
  );
}
