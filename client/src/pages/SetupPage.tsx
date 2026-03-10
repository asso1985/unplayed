import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '@/hooks/useAppState';
import { api } from '@/lib/api';
import Flex from '@/components/Flex';
import LogoMark from '@/components/LogoMark';

type Step = 'choose' | 'ytm' | 'ytm-code' | 'spotify-connecting';

export default function SetupPage() {
  const { loadStatus, loadAlbums, showToast } = useApp();
  const [step, setStep] = useState<Step>('choose');
  const [loading, setLoading] = useState(false);
  const [userCode, setUserCode] = useState('');
  const [expiryMin, setExpiryMin] = useState(10);
  const [dots, setDots] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { clearInterval(pollRef.current); };
  }, []);

  const startPolling = useCallback((interval: number) => {
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
          setStep('choose');
        }
      } catch { /* ignore poll errors */ }
    }, interval * 1000);
  }, [showToast, loadStatus, loadAlbums]);

  const handleYTMStart = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.startAuth();
      setUserCode(result.userCode);
      setExpiryMin(Math.round(result.expiresIn / 60));
      setStep('ytm-code');
      startPolling(result.interval || 5);
    } catch (e) {
      showToast((e as Error).message, 'err');
    } finally {
      setLoading(false);
    }
  }, [showToast, startPolling]);

  const handleSpotify = useCallback(() => {
    window.open('/api/auth/spotify/start', 'spotify_auth', 'width=500,height=750,noopener');
    setStep('spotify-connecting');
    startPolling(5);
  }, [startPolling]);

  return (
    <div id="app">
      <header id="header">
        <Flex align="center" gap={9}>
          <span className="hdr-title">un<em>played</em></span>
        </Flex>
      </header>
      <div id="content">
        <div className="page active">
          <Flex direction="column" align="center" justify="center" className="setup-wrap">
            <LogoMark size={76} className="setup-icon" />
            <h1 className="setup-title">Connect your music</h1>
            <p className="setup-sub">
              Choose the service where you save albums.<br />No passwords stored. Ever.
            </p>

            {step === 'choose' && (
              <div className="setup-card">
                <h3>Get started</h3>
                <Flex direction="column" gap={12} style={{ width: '100%' }}>
                  <button className="btn-main" onClick={() => setStep('ytm')}>
                    YouTube Music
                  </button>
                  <button className="btn-main btn-spotify" onClick={handleSpotify}>
                    Spotify
                  </button>
                </Flex>
              </div>
            )}

            {step === 'ytm' && (
              <div className="setup-card">
                <h3>Connect YouTube Music</h3>
                <ol className="setup-steps">
                  <li>Tap the button below to generate your login code</li>
                  <li>Visit <a href="https://google.com/device" target="_blank" rel="noopener noreferrer">google.com/device</a> on any device</li>
                  <li>Enter the code and sign in with your Google account</li>
                </ol>
                <Flex gap={10}>
                  <button className="btn-main" style={{ flex: 1 }} onClick={handleYTMStart} disabled={loading}>
                    {loading ? <><span className="spin"></span> Starting…</> : 'Get login code'}
                  </button>
                  <button className="btn-back" onClick={() => setStep('choose')}>←</button>
                </Flex>
              </div>
            )}

            {step === 'ytm-code' && (
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

            {step === 'spotify-connecting' && (
              <div className="setup-card">
                <h3>Complete sign-in in the popup</h3>
                <div className="code-block">
                  <span className="code-hint">Waiting for Spotify sign-in{dots}</span>
                </div>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--muted)', lineHeight: '1.8' }}>
                  A Spotify sign-in window should have opened.{' '}
                  If not,{' '}
                  <button
                    onClick={handleSpotify}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline' }}
                  >
                    click here
                  </button>
                  {' '}to try again.
                </p>
              </div>
            )}
          </Flex>
        </div>
      </div>
    </div>
  );
}
