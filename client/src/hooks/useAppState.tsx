import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { Album, Settings, StatusResponse, Provider, BeforeInstallPromptEvent } from '@/types';
import { api } from '@/lib/api';
import { ensurePushSubscription } from '@/lib/push';

interface Toast { message: string; type: 'ok' | 'err'; onClick?: () => void }

interface AppState {
  authReady: boolean | null;
  lastSync: string | null;
  vapidKey: string;
  provider: Provider | null;
  albums: Album[];
  settings: Settings;
  syncing: boolean;
  toast: Toast | null;
  deferredInstall: BeforeInstallPromptEvent | null;

  showToast: (message: string, type?: 'ok' | 'err', onClick?: () => void) => void;
  loadStatus: () => Promise<StatusResponse>;
  loadAlbums: () => Promise<void>;
  setAlbums: React.Dispatch<React.SetStateAction<Album[]>>;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  setAuthReady: (v: boolean) => void;
  setLastSync: (v: string | null) => void;
  setSyncing: (v: boolean) => void;
  setDeferredInstall: (e: BeforeInstallPromptEvent | null) => void;
}

const DEFAULT_SETTINGS: Settings = {
  reminderDays:   [1, 3, 7, 30],
  allowedTypes:   ['Album'],
  notifyHour:     19,
  timezoneOffset: 0,
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [authReady, setAuthReady] = useState<boolean | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [vapidKey, setVapidKey] = useState('');
  const [provider, setProvider] = useState<Provider | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [deferredInstall, setDeferredInstall] = useState<BeforeInstallPromptEvent | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((message: string, type: 'ok' | 'err' = 'ok', onClick?: () => void) => {
    setToast({ message, type, onClick });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), onClick ? 8000 : 3000);
  }, []);

  const loadStatus = useCallback(async () => {
    const status = await api.getStatus();
    
    setProvider(status.provider);
    setAuthReady(status.authReady);
    setLastSync(status.lastSync);
    setVapidKey(status.pushKey);
    return status;
  }, []);

  const loadAlbums = useCallback(async () => {
    const data = await api.getAlbums();
    setAlbums(data.albums);
    setSettings(data.settings);
  }, []);

  useEffect(() => {
    if (authReady && vapidKey) ensurePushSubscription(vapidKey);
  }, [authReady, vapidKey]);

  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredInstall(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  return (
    <AppContext.Provider value={{
      authReady, lastSync, vapidKey, provider,
      albums, settings, syncing, toast, deferredInstall,
      showToast, loadStatus, loadAlbums,
      setAlbums, setSettings, setAuthReady, setLastSync, setSyncing, setDeferredInstall,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
