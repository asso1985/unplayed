import { useState, useCallback } from 'react';
import { useApp } from '@/hooks/useAppState';
import { api } from '@/lib/api';

export default function Header() {
  const { lastSync, loadAlbums, setLastSync, showToast } = useApp();
  const [syncing, setSyncing] = useState(false);

  const syncTime = lastSync
    ? new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const handleSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await api.runSync();
      await loadAlbums();
      setLastSync(new Date().toISOString());
      showToast('✓ Synced');
    } catch {
      showToast('Sync failed', 'err');
    } finally {
      setSyncing(false);
    }
  }, [syncing, loadAlbums, setLastSync, showToast]);

  return (
    <header id="header">
      <div className="hdr-logo">
        <span className="hdr-title">un<em>played</em></span>
      </div>
      <div className="hdr-spacer"></div>
      {syncTime && (
        <div className="hdr-status">
          <span className="status-dot"></span>
          <span>{syncTime}</span>
        </div>
      )}
      <button
        className={`hdr-sync-btn${syncing ? ' syncing' : ''}`}
        onClick={handleSync}
        title="Sync now"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M23 4v6h-6" />
          <path d="M1 20v-6h6" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      </button>
    </header>
  );
}
