import { useApp } from '@/hooks/useAppState';
import NoticeBar from '@/components/NoticeBar';
import AlbumGrid from '@/components/AlbumGrid';

export default function LibraryPage() {
  const { albums } = useApp();

  return (
    <div className="lib-content">
      <NoticeBar />
      <div className="lib-topbar">
        <div className="lib-count">
          <strong>{albums.length}</strong> albums
        </div>
      </div>
      <AlbumGrid />
    </div>
  );
}
