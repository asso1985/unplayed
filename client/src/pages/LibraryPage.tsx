import { useState, useMemo } from 'react';
import { useApp } from '@/hooks/useAppState';
import type { Album } from '@/types';
import NoticeBar from '@/components/NoticeBar';
import AlbumGrid from '@/components/AlbumGrid';
import Flex from '@/components/Flex';

type SortOrder = 'newest' | 'oldest' | 'overdue' | 'az';

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'newest',  label: 'Newest' },
  { value: 'oldest',  label: 'Oldest' },
  { value: 'overdue', label: 'Most overdue' },
  { value: 'az',      label: 'A–Z' },
];

function sortAlbums(albums: Album[], order: SortOrder): Album[] {
  const sorted = [...albums];
  switch (order) {
    case 'newest':  return sorted; // already newest-first from API
    case 'oldest':  return sorted.reverse();
    case 'overdue': return sorted.sort((a, b) => b.ageDays - a.ageDays);
    case 'az':      return sorted.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  }
}

export default function LibraryPage() {
  const { albums } = useApp();
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  const sortedAlbums = useMemo(() => sortAlbums(albums, sortOrder), [albums, sortOrder]);

  return (
    <div className="lib-content">
      <NoticeBar />
      <Flex align="center" justify="space-between" style={{ marginBottom: 14 }}>
        <div className="lib-count">
          <strong>{albums.length}</strong> albums
        </div>
        {albums.length > 1 && (
          <select
            className="sort-select"
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value as SortOrder)}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
      </Flex>
      <AlbumGrid albums={sortedAlbums} />
    </div>
  );
}
