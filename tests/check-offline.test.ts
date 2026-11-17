import { describe, expect, it } from 'vitest';
import { checkFile } from '../scripts/offline-rules.mjs';

// 正向樣本取自目前 production bundle 內實際出現的寫法；必須通過，否則規則會讓 CI 永遠紅。
const BUNDLE_LIKE = [
  'case`img`:n.src?r.src=n.src:n.srcSet&&(r.srcset=n.srcSet)',
  'a=o.createElementNS(`http://www.w3.org/2000/svg`,c)',
  'function r(e){var t=`https://react.dev/errors/`+e}',
  '{label:`NLM PubMed User Guide`,url:`https://pubmed.ncbi.nlm.nih.gov/help/`}',
  'jsx(`a`,{href:`https://pubmed.ncbi.nlm.nih.gov/?term=`+q,target:`_blank`})',
  'var re=/^(?:[a-z]+:)?\/\//i; // comment with // slashes',
].join(';');

describe('T23 離線靜態檢查（scripts/offline-rules.mjs）', () => {
  it('目前 bundle 的寫法通過', () => {
    expect(checkFile('dist/assets/index.js', BUNDLE_LIKE)).toEqual([]);
  });

  it.each([
    ['Codex 反例：new Image + 允許清單主機', 'const i=new Image();i.src="https://pubmed.ncbi.nlm.nih.gov/?term=x"'],
    ['允許清單主機指派給 .src', 'el.src=`https://pubmed.ncbi.nlm.nih.gov/x.png`'],
    ['JSX 的 src 屬性指向允許清單主機', 'jsx(`img`,{src:"https://meshb.nlm.nih.gov/logo.png"})'],
    ['link.href 指向允許清單主機', 'l.href="https://www.ncbi.nlm.nih.gov/a.css"'],
    ['未列入清單的主機（即使只是字串）', 'var u="https://evil.example.com/collect"'],
    ['protocol-relative 未列入清單的主機', 'var u="//cdn.example.com/x.js"'],
    ['動態 import', 'import(`./chunk.js`)'],
    ['fetch', 'fetch("/api")'],
    ['sendBeacon', 'navigator.sendBeacon("/x",d)'],
    ['Worker', 'new Worker("w.js")'],
  ])('JS：%s → 不通過', (_name, code) => {
    expect(checkFile('dist/assets/index.js', code)).not.toEqual([]);
  });

  it.each([
    ['HTML script 外部 src', '<script type="module" src="https://cdn.example.com/a.js"></script>'],
    ['HTML link 外部 href', '<link rel="stylesheet" href="//fonts.example.com/a.css">'],
    ['HTML img 外部 src', '<img src="https://pubmed.ncbi.nlm.nih.gov/x.png">'],
  ])('%s → 不通過', (_name, html) => {
    expect(checkFile('dist/index.html', html)).not.toEqual([]);
  });

  it('HTML 同源資源通過', () => {
    const html =
      '<script type="module" crossorigin src="/pico-search-converter/assets/index.js"></script>' +
      '<link rel="stylesheet" href="/pico-search-converter/assets/index.css">';
    expect(checkFile('dist/index.html', html)).toEqual([]);
  });

  it('CSS：外部 url() 與 @import 不通過，同源字型通過', () => {
    expect(checkFile('a.css', '@font-face{src:url(https://fonts.example.com/a.woff2)}')).not.toEqual([]);
    expect(checkFile('a.css', '@import "x.css";')).not.toEqual([]);
    expect(checkFile('a.css', '@font-face{src:url(/pico-search-converter/assets/a.woff2)}')).toEqual([]);
  });
});
