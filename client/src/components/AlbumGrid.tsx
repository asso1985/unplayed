import { useApp } from '@/hooks/useAppState';
import AlbumCard from './AlbumCard';

export default function AlbumGrid() {
  const { albums, settings } = useApp();

  if (!albums.length) {
    return (
      <div className="grid">
        <div className="empty">
          <div className="empty-ico">🎵</div>
          <h3>No albums yet</h3>
          <p>Save albums in YouTube Music.<br />They'll show up here after the next sync.</p>
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
