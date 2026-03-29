import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-orange-600 text-white text-center py-2 px-4 z-50 text-sm font-medium">
      📵 You're offline. Showing cached content.
    </div>
  );
}
