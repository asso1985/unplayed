import { useState, useRef, useEffect, useCallback } from 'react';
import type { Album, Settings } from '@/types';
import { api } from '@/lib/api';
import { useApp } from '@/hooks/useAppState';
import SnoozePopup from './SnoozePopup';

interface Props {
  album: Album;
  settings: Settings;
}

export default function AlbumCard({ album, settings }: Props) {
  const { setAlbums, showToast } = useApp();
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const isDue = (settings.reminderDays ?? []).some(
    d => album.ageDays >= d && !(album.remindersSent ?? []).includes(d)
  );
  const isSnoozed = (album.snoozedDaysLeft ?? 0) > 0;
  const showType = album.releaseType && album.releaseType !== 'Album' && album.releaseType !== 'Unknown';

  // Close snooze popup on outside click
  useEffect(() => {
    if (!snoozeOpen) return;
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setSnoozeOpen(false);
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [snoozeOpen]);

  const handleSnooze = useCallback(async (days: number) => {
    setSnoozeOpen(false);
    try {
      await api.snoozeAlbum(album.id, days);
      setAlbums(prev => prev.map(a =>
        a.id === album.id ? { ...a, snoozedDaysLeft: days } : a
      ));
      showToast(`⏱ Snoozed ${days} days`);
    } catch {
      showToast('Failed to snooze', 'err');
    }
  }, [album.id, setAlbums, showToast]);

  const handleSilence = useCallback(async () => {
    if (!confirm(`Stop reminders for "${album.title}"? This cannot be undone.`)) {
      return
    };

    setRemoving(true);
    await api.silenceAlbum(album.id);
    setTimeout(() => {
      setAlbums(prev => prev.filter(a => a.id !== album.id));
      showToast('✕ Reminder stopped');
    }, 250);
  }, [album.id, setAlbums, showToast]);

  const toggleSnooze = useCallback(() => setSnoozeOpen(o => !o), []);

  return (
    <div className={`card${removing ? ' removing' : ''}`} id={`card-${album.id}`}>
      {album.thumbnail
        ? <img className="thumb" src={album.thumbnail} alt={album.title} loading="lazy" />
        : <div className="thumb-ph">🎵</div>
      }
      {isDue && <div className="badge badge-due">Due</div>}
      {isSnoozed && !isDue && (
        <div className="badge badge-snooze">+{album.snoozedDaysLeft}d</div>
      )}
      <div className="card-body">
        <div className="card-title">{album.title}</div>
        <div className="card-artist">{album.artist}</div>
        <div className="card-meta">
          {showType && <span className="type-pill">{album.releaseType}</span>}
          {album.ageDays}d
        </div>
      </div>
      <div className="card-actions">
        <a
          className="btn-play"
          href={`https://music.youtube.com/browse/${album.id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg className="yt-icon" viewBox="0 0 18 12">
            <path d="M17.6 1.9a2.3 2.3 0 0 0-1.6-1.6C14.5 0 9 0 9 0S3.5 0 2 .3A2.3 2.3 0 0 0 .4 1.9C0 3.4 0 6 0 6s0 2.6.4 4.1a2.3 2.3 0 0 0 1.6 1.6C3.5 12 9 12 9 12s5.5 0 7-0.3a2.3 2.3 0 0 0 1.6-1.6C18 8.6 18 6 18 6s0-2.6-.4-4.1z" fill="#ff0000" />
            <polygon points="7.2,8.6 11.9,6 7.2,3.4" fill="white" />
          </svg>
          Play
        </a>
        <div className="snooze-wrap" ref={wrapRef}>
          <button className="btn-ic" onClick={toggleSnooze} title="Snooze">⏱</button>
          <SnoozePopup open={snoozeOpen} onSnooze={handleSnooze} />
        </div>
        <button className="btn-ic" onClick={handleSilence} title="Dismiss">✕</button>
      </div>
    </div>
  );
}
