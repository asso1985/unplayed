import { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '@/hooks/useAppState';
import { api } from '@/lib/api';
import Flex from './Flex';

const COOLDOWN_MS = 60_000;

export default function Header() {
  const { lastSync, loadAlbums, setLastSync, showToast } = useApp();
  const [syncing, setSyncing] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0); // seconds remaining
  const cooldownTimer = useRef<ReturnType<typeof setInterval>>(undefined);

  // Cleanup on unmount
  useEffect(() => () => clearInterval(cooldownTimer.current), []);

  const startCooldown = useCallback(() => {
    let left = Math.ceil(COOLDOWN_MS / 1000);
    setCooldownLeft(left);
    clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(cooldownTimer.current);
        setCooldownLeft(0);
      } else {
        setCooldownLeft(left);
      }
    }, 1000);
  }, []);

  const syncTime = lastSync
    ? new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const handleSync = useCallback(async () => {
    if (syncing || cooldownLeft > 0) return;
    setSyncing(true);
    try {
      await api.runSync();
      await loadAlbums();
      setLastSync(new Date().toISOString());
      showToast('✓ Synced');
      startCooldown();
    } catch {
      showToast('Sync failed', 'err');
    } finally {
      setSyncing(false);
    }
  }, [syncing, cooldownLeft, loadAlbums, setLastSync, showToast, startCooldown]);

  const isDisabled = syncing || cooldownLeft > 0;

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
        className={`hdr-sync-btn${syncing ? ' syncing' : ''}${cooldownLeft > 0 ? ' cooldown' : ''}`}
        onClick={handleSync}
        disabled={isDisabled}
        title={cooldownLeft > 0 ? `Wait ${cooldownLeft}s` : 'Sync now'}
      >
        {cooldownLeft > 0 ? (
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, lineHeight: 1 }}>
            {cooldownLeft}s
          </span>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        )}
      </button>
    </header>
  );
}
