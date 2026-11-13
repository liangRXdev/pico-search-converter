import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('找不到 #root 掛載點，請確認 index.html 未被修改');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
