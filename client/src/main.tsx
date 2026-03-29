import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const isDesktop = typeof window !== 'undefined' && Boolean(window.qbzDesktop?.isDesktop);
const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

if (!isDesktop) {
  createRoot(root).render(
    <StrictMode>
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background:
            'radial-gradient(circle at top, #11253b 0%, #05070c 62%)',
          color: '#e8f1ff',
          fontFamily: 'Sora, "Segoe UI", sans-serif',
          padding: '24px'
        }}
      >
        <section
          style={{
            width: 'min(560px, 92vw)',
            border: '1px solid rgba(255,255,255,0.16)',
            borderRadius: '18px',
            background: 'rgba(3, 9, 17, 0.82)',
            backdropFilter: 'blur(8px)',
            padding: '28px'
          }}
        >
          <h1 style={{ margin: '0 0 10px', fontSize: '24px' }}>
            QBZ Downloader Desktop Only
          </h1>
          <p style={{ margin: 0, lineHeight: 1.7, color: '#bad0ea' }}>
            This project now runs exclusively as a desktop EXE.
            Please open the app from the generated installer or portable build.
          </p>
        </section>
      </div>
    </StrictMode>,
  );
} else {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      )
      .catch(() => undefined);
  }

  if ('caches' in window) {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => undefined);
  }

  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
