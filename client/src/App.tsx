import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from '@/hooks/useAppState';
import Toast from '@/components/Toast';
import SetupPage from '@/pages/SetupPage';
import AppShell from '@/components/AppShell';
import LibraryPage from '@/pages/LibraryPage';
import SettingsPage from '@/pages/SettingsPage';

export default function App() {
  const { authReady, loadStatus, loadAlbums } = useApp();

  useEffect(() => {
    loadStatus().then(status => {
      if (status.authReady) loadAlbums();
    });
  }, [loadStatus, loadAlbums]);

  if (authReady === null) return null;

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
