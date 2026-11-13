import { PLATFORM_LABELS, PLATFORM_ORDER } from '../config';

// M1 佔位畫面：只確認鷹架可建置與渲染。正式 UI 於 M5 實作。
export function App() {
  return (
    <main>
      <h1>PICO 檢索語法轉換器</h1>
      <p>建置中：核心轉換邏輯尚未完成。</p>
      <ul aria-label="目標資料庫平台">
        {PLATFORM_ORDER.map((platform) => (
          <li key={platform}>{PLATFORM_LABELS[platform]}</li>
        ))}
      </ul>
    </main>
  );
}
