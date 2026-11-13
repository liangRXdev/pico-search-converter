import type { Message } from '../model/types';

export interface IssueListItem extends Message {
  /** 顯示在訊息前的位置說明，例如「第 3 行「cat*」」。 */
  where?: string;
}

export interface IssueListProps {
  id?: string;
  items: readonly IssueListItem[];
}

const SEVERITY_TEXT: Readonly<Record<Message['severity'], string>> = {
  error: '需修正',
  warning: '注意',
  info: '說明',
};

export function IssueList({ id, items }: IssueListProps) {
  if (items.length === 0) return null;
  return (
    <ul id={id} className="issues">
      {items.map((item, index) => (
        <li key={`${item.code}-${index}`} className={`issues__item issues__item--${item.severity}`}>
          <span className="issues__tag">{SEVERITY_TEXT[item.severity]}</span>
          <span className="issues__text">
            {item.where ? <strong className="issues__where">{item.where}</strong> : null}
            {item.message}
          </span>
        </li>
      ))}
    </ul>
  );
}
