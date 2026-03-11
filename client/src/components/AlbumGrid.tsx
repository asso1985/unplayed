import { useApp } from '@/hooks/useAppState';
import AlbumCard from './AlbumCard';

export default function AlbumGrid() {
  const { albums, settings, provider, syncing } = useApp();

  if (!albums.length) {
    if (syncing) {
      return (
        <div className="grid">
          <div className="empty">
            <span className="spin" style={{ width: 28, height: 28, margin: '0 0 12px' }} />
            <p>Syncing your library…</p>
          </div>
        </div>
      );
    }
    return (
      <div className="grid">
        <div className="empty">
          <div className="empty-ico">🎵</div>
          <h3>No albums yet</h3>
          <p>Save albums in {provider === 'spotify' ? 'Spotify' : 'YouTube Music'}.<br />They'll show up here after the next sync.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid">
      {albums.map(a => (
        <AlbumCard key={a.id} album={a} settings={settings} />
      ))}
    </div>
  );
}
