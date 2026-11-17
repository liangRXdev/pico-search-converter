import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import './ui/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('找不到 #root 掛載點，請確認 index.html 未被修改');
}

// PWA：只在 production 註冊（dev server 沒有 sw.js）。註冊失敗不影響工具本身運作。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
