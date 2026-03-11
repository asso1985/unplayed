import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from '@/hooks/useAppState';
import Toast from '@/components/Toast';
import SetupPage from '@/pages/SetupPage';
import AppShell from '@/components/AppShell';
import LibraryPage from '@/pages/LibraryPage';
import SettingsPage from '@/pages/SettingsPage';

export default function App() {
  const { authReady, loadStatus, loadAlbums, showToast } = useApp();

  useEffect(() => {
    loadStatus().then(status => {
      if (status.authReady) loadAlbums();
    });
  }, [loadStatus, loadAlbums]);

  // Register SW eagerly on mount for update detection (push also registers, idempotent)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/service-worker.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            showToast('Update available — tap to refresh', 'ok', () => location.reload());
          }
        });
      });
    }).catch(() => {});
  }, [showToast]);

  if (authReady === null) {
    return (
      <div style={{ display: 'flex', height: '100dvh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <span className="spin" style={{ width: 28, height: 28, margin: 0 }} />
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/setup" element={
          authReady ? <Navigate to="/" replace /> : <SetupPage />
        } />
        <Route element={
          authReady ? <AppShell /> : <Navigate to="/setup" replace />
        }>
          <Route index element={<LibraryPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast />
    </>
  );
}
