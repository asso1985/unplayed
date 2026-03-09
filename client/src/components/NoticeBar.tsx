import { useApp } from '@/hooks/useAppState';
import { registerPushSubscription } from '@/lib/push';

export default function NoticeBar() {
  const { vapidKey, deferredInstall, setDeferredInstall, showToast } = useApp();

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  const showInstall = isIOS && !standalone;
  const showPush = 'Notification' in window && Notification.permission === 'default' && !!vapidKey;

  async function handleInstall() {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    const { outcome } = await deferredInstall.userChoice;
    if (outcome === 'accepted') setDeferredInstall(null);
  }

  async function handlePush() {
    if (!vapidKey) { showToast('Push not configured', 'err'); return; }
    try {
      await registerPushSubscription(vapidKey);
      showToast('🔔 Notifications enabled!');
    } catch (e) {
      showToast((e as Error).message, 'err');
    }
  }

  return (
    <>
      {showInstall && (
        <div className="notice add-notice" style={{ display: 'flex' }}>
          <span className="notice-icon">📲</span>
          <span className="notice-body">
            {isIOS
              ? 'Tap Share → "Add to Home Screen" to enable push notifications'
              : 'Add to Home Screen for push notifications'}
          </span>
          {deferredInstall && (
            <button className="notice-btn" onClick={handleInstall}>Add</button>
          )}
        </div>
      )}
      {showPush && (
        <div className="notice push-notice" style={{ display: 'flex' }}>
          <span className="notice-icon">🔔</span>
          <span className="notice-body">Enable notifications to get reminded about unplayed albums</span>
          <button className="notice-btn" onClick={handlePush}>Enable</button>
        </div>
      )}
    </>
  );
}
