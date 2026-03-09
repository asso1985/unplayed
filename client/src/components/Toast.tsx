import { useApp } from '@/hooks/useAppState';

export default function Toast() {
  const { toast } = useApp();
  return (
    <div className={`toast${toast ? ' show' : ''} ${toast?.type ?? ''}`}>
      {toast?.message}
    </div>
  );
}
