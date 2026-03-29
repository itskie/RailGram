import { MapPin } from 'lucide-react';
import type { Reel } from '../types/reel';
import { useAuthStore } from '../../../store/authStore';
import { useReelActions } from '../hooks/useReelActions';
import { clsx } from 'clsx';

interface ReelOverlayProps {
  reel: Reel;
}
export function ReelOverlay({ reel }: ReelOverlayProps) {
  const { user: currentUser } = useAuthStore();
  const { toggleFollow } = useReelActions();
  
  const isOwnReel = Boolean(
    currentUser &&
      currentUser.id.toLowerCase() === String(reel.user.id).toLowerCase(),
  );
  const isFollowing = Boolean(reel.user.viewer_followed);

  const handleFollow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUser || isOwnReel) return;
    toggleFollow({
      username: reel.user.username,
      id: reel.id,
      isFollowing,
    });
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-32 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none">
      <div className="flex flex-col gap-2.5 pointer-events-auto max-w-full">
        <div className="flex items-start gap-2.5">
          {reel.user.avatar_url ? (
            <img
              src={reel.user.avatar_url}
              alt={reel.user.username}
              className="w-9 h-9 rounded-full border border-white/30 shadow-sm object-cover shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-zinc-800 border border-white/30 flex items-center justify-center text-white/50 text-xs font-bold leading-none ring-1 ring-white/10 shadow-lg shrink-0">
              {reel.user.username.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-bold text-sm tracking-wide truncate max-w-[55%] sm:max-w-none">
                {reel.user.username}
              </span>
              {currentUser && !isOwnReel && (
                <button
                  type="button"
                  onClick={handleFollow}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={clsx(
                    'shrink-0 rounded-full px-3.5 py-1 text-[11px] font-semibold transition-all active:scale-95 border',
                    isFollowing
                      ? 'bg-white/10 text-white border-white/25 hover:bg-white/15'
                      : 'bg-black/35 text-white border-white/35 backdrop-blur-md hover:bg-black/50'
                  )}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
            {(reel.user.display_name &&
              reel.user.display_name.trim() !== '' &&
              reel.user.display_name !== reel.user.username) ? (
              <span className="text-white/75 text-xs font-medium leading-tight truncate">
                {reel.user.display_name}
              </span>
            ) : null}
            <span className="text-white/55 text-[11px] font-medium leading-tight truncate">
              @{reel.user.username}
            </span>
          </div>
        </div>

        {reel.description && (
          <div className="mt-1">
            <p className="text-white text-sm line-clamp-2 leading-relaxed drop-shadow-md">
              {reel.description}
            </p>
          </div>
        )}

        {/* Live Train Tag Overlay */}
        {(reel.train_number || reel.station_tag) && (
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 backdrop-blur-lg rounded-lg border border-white/20 shadow-xl ring-1 ring-black/5">
              {reel.train_number && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] filter drop-shadow-md">🚂</span>
                  <span className="text-white text-[11px] font-extrabold tracking-tight">
                    {reel.train_number} {reel.train_name && `- ${reel.train_name}`}
                  </span>
                </div>
              )}
              {reel.train_number && reel.station_tag && (
                <span className="text-white/40 text-[10px] font-bold px-0.5">•</span>
              )}
              {reel.station_tag && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-teal-400" fill="currentColor" fillOpacity={0.2} />
                  <span className="text-white text-[11px] font-bold tracking-tight">{reel.station_tag}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
