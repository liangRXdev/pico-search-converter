// TXT 匯出（spec §2.1 步驟 6、T21）。純函式：時間由呼叫端傳入，其餘內容可重現（T25）。

import {
  APP_NAME,
  APP_VERSION,
  CONCEPT_ORDER,
  DISCLAIMER,
  LIVE_VALIDATED,
  LIVE_VALIDATION_DATE,
  PLATFORM_LABELS,
  SOURCE_LINKS,
} from '../config';
import type { Generation } from '../core/generate';
import { normalizeLine, splitLines } from '../core/normalize';
import type { BlockInput, ControlledTermInput, Message, Result } from '../model/types';

export interface TxtExportInput {
  blocks: readonly BlockInput[];
  generation: Generation;
  /** 已格式化的產生時間，見 formatTimestamp。 */
  generatedAt: string;
}

const SEVERITY_LABELS: Readonly<Record<Message['severity'], string>> = {
  error: '錯誤',
  warning: '警告',
  info: '說明',
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** 本地時間 + UTC 偏移，例如 `2026-11-13 15:52 (UTC+08:00)`。 */
export function formatTimestamp(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset < 0 ? '-' : '+';
  const zone = `${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())} (UTC${zone})`;
}

export function exportFilename(date: Date): string {
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `pico-search-${stamp}.txt`;
}

function messageLines(messages: readonly Message[]): string[] {
  return messages.map((item) => `  - [${SEVERITY_LABELS[item.severity]}] ${item.message}`);
}

function headingLines(label: string, headings: readonly ControlledTermInput[]): string[] {
  return headings
    .filter((heading) => normalizeLine(heading.term) !== '')
    .map((heading) => {
      const scope = heading.explode ? 'explode' : '不 explode';
      const status = heading.verification === 'user_confirmed' ? '使用者自述已查證' : '未確認';
      return `  - ${label}：${normalizeLine(heading.term)}（${scope}；${status}）`;
    });
}

function inputSection(blocks: readonly BlockInput[]): string[] {
  const lines = ['[輸入]'];
  for (const id of CONCEPT_ORDER) {
    const block = blocks.find((candidate) => candidate.id === id);
    if (!block) continue;
    const terms = block.freeText
      .flatMap(splitLines)
      .map(normalizeLine)
      .filter((line) => line !== '')
      .map((line) => `  - ${line}`);
    const entries = [
      ...headingLines('MeSH', block.mesh),
      ...headingLines('Emtree', block.emtree),
      ...terms,
    ];
    lines.push(`${id}（${block.enabled ? '納入檢索' : '未納入檢索'}）`);
    lines.push(...(entries.length > 0 ? entries : ['  （空白）']));
  }
  return lines;
}

function platformSection(result: Result): string[] {
  const lines = [`[${PLATFORM_LABELS[result.platform]}]`];
  lines.push(result.query ?? '（未輸出查詢，原因見下方）');
  lines.push(
    `驗證狀態：${LIVE_VALIDATED[result.platform] ? `輸出格式已實機驗證（${LIVE_VALIDATION_DATE}）` : 'Not live-validated（輸出格式尚未實機驗證）'}`,
  );
  if (result.warnings.length > 0) lines.push('注意事項：', ...messageLines(result.warnings));
  return lines;
}

export function buildTxtExport({ blocks, generation, generatedAt }: TxtExportInput): string {
  const sections: string[][] = [
    [`${APP_NAME} 匯出`, `產生時間：${generatedAt}`, `工具版本：${APP_VERSION}`],
    inputSection(blocks),
  ];
  if (generation.issues.length > 0) {
    sections.push(['[輸入檢查]', ...messageLines(generation.issues)]);
  }
  if (generation.results) {
    sections.push(...generation.results.map(platformSection));
  } else {
    sections.push(['[查詢]', '輸入有誤，未產生任何平台的查詢。']);
  }
  sections.push(['[聲明]', DISCLAIMER]);
  sections.push(['[語法查證來源]', ...SOURCE_LINKS.map((link) => `- ${link.label}：${link.url}`)]);
  return `${sections.map((section) => section.join('\n')).join('\n\n')}\n`;
}
