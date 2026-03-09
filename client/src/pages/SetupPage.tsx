import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/hooks/useAppState';
import { api } from '@/lib/api';

export default function SetupPage() {
  const { loadStatus, loadAlbums, showToast } = useApp();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [userCode, setUserCode] = useState('');
  const [expiryMin, setExpiryMin] = useState(10);
  const [dots, setDots] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { clearInterval(pollRef.current); };
  }, []);

  async function handleStart() {
    setLoading(true);
    try {
      const result = await api.startAuth();
      setUserCode(result.userCode);
      setExpiryMin(Math.round(result.expiresIn / 60));
      setStep(2);
      startPolling(result.interval || 5);
    } catch (e) {
      showToast((e as Error).message, 'err');
    } finally {
      setLoading(false);
    }
  }

  function startPolling(interval: number) {
    let dotCount = 0;
    pollRef.current = setInterval(async () => {
      dotCount = (dotCount + 1) % 4;
      setDots('.'.repeat(dotCount + 1));
      try {
        const result = await api.pollAuth();
        if (result.status === 'approved') {
          clearInterval(pollRef.current);
          showToast('✓ Connected!');
          // loadStatus will set authReady=true, causing App.tsx to redirect to /
          await loadStatus();
          await loadAlbums();
        } else if (result.status === 'expired') {
          clearInterval(pollRef.current);
          showToast('Code expired — try again', 'err');
          setStep(1);
        }
      } catch { /* ignore poll errors */ }
    }, interval * 1000);
  }

  return (
    <div id="app">
      <header id="header">
        <div className="hdr-logo">
          <span className="hdr-title">un<em>played</em></span>
        </div>
      </header>
      <div id="content">
        <div className="page active">
          <div className="setup-wrap">
            <img src="/logo.svg" className="setup-icon" alt="Unplayed" />
            <h1 className="setup-title">Connect YouTube Music</h1>
            <p className="setup-sub">
              Sign in once with Google OAuth.<br />No passwords. No cookie pasting. Ever.
            </p>

            {step === 1 && (
              <div className="setup-card">
                <h3>Get started</h3>
                <ol className="setup-steps">
                  <li>Tap the button below to generate your login code</li>
                  <li>Visit <a href="https://google.com/device" target="_blank" rel="noopener noreferrer">google.com/device</a> on any device</li>
                  <li>Enter the code and sign in with your Google account</li>
                </ol>
                <button className="btn-main" onClick={handleStart} disabled={loading}>
                  {loading ? <><span className="spin"></span> Starting…</> : 'Get login code'}
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="setup-card">
                <h3>
                  Enter this code at{' '}
                  <a href="https://google.com/device" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                    google.com/device
                  </a>
                </h3>
                <div className="code-block">
                  <span className="code-val">{userCode}</span>
                  <span className="code-hint">Waiting for sign-in{dots}</span>
                </div>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--muted)', lineHeight: '1.8' }}>
                  Sign in with the Google account that has your YouTube Music library. Expires in {expiryMin} min.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
