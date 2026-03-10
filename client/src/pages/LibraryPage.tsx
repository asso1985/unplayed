import { useApp } from '@/hooks/useAppState';
import NoticeBar from '@/components/NoticeBar';
import AlbumGrid from '@/components/AlbumGrid';
import Flex from '@/components/Flex';

export default function LibraryPage() {
  const { albums } = useApp();

  return (
    <div className="lib-content">
      <NoticeBar />
      <Flex align="center" justify="space-between" style={{ marginBottom: 14 }}>
        <div className="lib-count">
          <strong>{albums.length}</strong> albums
        </div>
      </Flex>
      <AlbumGrid />
    </div>
  );
}
