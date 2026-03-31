import { MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Reel } from '../types/reel';
import { useAuthStore } from '../../../store/authStore';
import { useReelActions } from '../hooks/useReelActions';
import { clsx } from 'clsx';
import Avatar from '../../../components/Avatar';
import { useLoginPrompt } from '../../../hooks/useLoginPrompt';

interface ReelOverlayProps {
  reel: Reel;
}
export function ReelOverlay({ reel }: ReelOverlayProps) {
  const { user: currentUser } = useAuthStore();
  const { toggleFollow } = useReelActions();
  const { requireAuth } = useLoginPrompt();
  
  const isOwnReel = Boolean(
    currentUser &&
      currentUser.id.toLowerCase() === String(reel.user.id).toLowerCase(),
  );
  const isFollowing = Boolean(reel.user.viewer_followed);

  const handleFollow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!requireAuth()) return;
    if (isOwnReel) return;
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
          <Avatar
            src={reel.user.avatar_url}
            name={reel.user.display_name}
            username={reel.user.username}
            size={9}
            linkTo={`/profile/${reel.user.username}`}
            className="border border-white/30 ring-1 ring-white/10 shadow-lg"
          />
          <div className="flex items-center gap-2 flex-wrap">
              <Link
                to={`/profile/${reel.user.username}`}
                onClick={(e) => e.stopPropagation()}
                className="text-white font-bold text-sm tracking-wide truncate max-w-[55%] sm:max-w-none hover:underline"
              >
                {reel.user.username}
              </Link>
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

        {/* Views Count */}
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-white/70 text-xs font-semibold drop-shadow-md">
            {reel.views.toLocaleString('en-IN')} views
          </span>
        </div>
      </div>
    </div>
  );
}
