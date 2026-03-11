import { useState, useCallback, useRef } from 'react';
import { useApp } from '@/hooks/useAppState';
import { api } from '@/lib/api';
import Flex from './Flex';

const COOLDOWN_MS = 60_000;

export default function Header() {
  const { lastSync, loadAlbums, setLastSync, showToast } = useApp();
  const [syncing, setSyncing] = useState(false);
  const [coolingDown, setCoolingDown] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const syncTime = lastSync
    ? new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const handleSync = useCallback(async () => {
    if (syncing || coolingDown) return;
    setSyncing(true);
    try {
      await api.runSync();
      await loadAlbums();
      setLastSync(new Date().toISOString());
      showToast('✓ Synced');
      clearTimeout(cooldownTimer.current);
      setCoolingDown(true);
      cooldownTimer.current = setTimeout(() => setCoolingDown(false), COOLDOWN_MS);
    } catch {
      showToast('Sync failed', 'err');
    } finally {
      setSyncing(false);
    }
  }, [syncing, coolingDown, loadAlbums, setLastSync, showToast]);

  return (
    <header id="header">
      <Flex align="center" gap={9}>
        <span className="hdr-title">un<em>played</em></span>
      </Flex>
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
        disabled={syncing || coolingDown}
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
