import { useApp } from '@/hooks/useAppState';

export default function Toast() {
  const { toast } = useApp();
  return (
    <div
      className={`toast${toast ? ' show' : ''} ${toast?.type ?? ''}`}
      onClick={toast?.onClick}
      style={toast?.onClick ? { cursor: 'pointer' } : undefined}
    >
      {toast?.message}
    </div>
  );
}
