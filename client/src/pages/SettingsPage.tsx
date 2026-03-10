import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/hooks/useAppState';
import { api } from '@/lib/api';
import type { ReleaseType, Settings } from '@/types';
import ReminderSettings from '@/components/ReminderSettings';
import TypeSettings from '@/components/TypeSettings';
import NotifyTimeSettings from '@/components/NotifyTimeSettings';

export default function SettingsPage() {
  const { settings, setSettings, setAuthReady, showToast } = useApp();
  const navigate = useNavigate();

  // Local working copy
  const [reminderDays, setReminderDays] = useState<number[]>(settings.reminderDays);
  const [allowedTypes, setAllowedTypes] = useState<ReleaseType[]>(settings.allowedTypes);
  const [notifyHour, setNotifyHour] = useState(settings.notifyHour);

  // Sync local state when context settings change
  useEffect(() => {
    setReminderDays(settings.reminderDays);
    setAllowedTypes(settings.allowedTypes);
    setNotifyHour(settings.notifyHour);
  }, [settings]);

  const handleSave = useCallback(async () => {
    const days = reminderDays.filter(d => d > 0);
    if (!days.length) { showToast('Add at least one reminder day', 'err'); return; }
    if (!allowedTypes.length) { showToast('Select at least one type', 'err'); return; }

    try {
      const result = await api.saveSettings({ reminderDays: days, allowedTypes, notifyHour });
      setSettings(result.settings);
      showToast('✓ Settings saved');
    } catch (e) {
      showToast((e as Error).message, 'err');
    }
  }, [reminderDays, allowedTypes, notifyHour, showToast, setSettings]);

  const handleDisconnect = useCallback(async () => {
    if (!confirm('Disconnect YouTube Music account?')) return;
    await api.deleteAuth();
    setAuthReady(false);
    navigate('/setup');
  }, [setAuthReady, navigate]);

  return (
    <div className="settings-content">
      <div className="account-card">
        <span className="acct-dot"></span>
        <div className="acct-info">
          <div className="acct-name">YouTube Music</div>
          <div className="acct-sub">Connected · syncs every 6 hours</div>
        </div>
      </div>

      <div className="settings-label">Reminder schedule</div>
      <ReminderSettings days={reminderDays} onChange={setReminderDays} />

      <div className="settings-label">Track types</div>
      <TypeSettings value={allowedTypes} onChange={setAllowedTypes} />

      <div className="settings-label">Notification time</div>
      <NotifyTimeSettings value={notifyHour} onChange={setNotifyHour} />

      <button className="btn-save" onClick={handleSave}>Save settings</button>
      <button className="btn-danger" onClick={handleDisconnect}>Disconnect account</button>
    </div>
  );
}
