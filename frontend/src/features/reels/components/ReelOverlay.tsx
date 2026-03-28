import { MapPin } from 'lucide-react';
import type { Reel } from '../types/reel';

interface ReelOverlayProps {
  reel: Reel;
}

export function ReelOverlay({ reel }: ReelOverlayProps) {
  return (
    <div className="absolute bottom-0 left-0 right-16 px-4 pb-6 pt-24 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
      <div className="flex flex-col gap-2 pointer-events-auto">
        <div className="flex items-center gap-2">
          {reel.user.avatar_url ? (
            <img
              src={reel.user.avatar_url}
              alt={reel.user.username}
              className="w-10 h-10 rounded-full border border-white/20 object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/20 flex items-center justify-center text-white/50 text-sm font-medium">
              {reel.user.username.slice(0, 2).toUpperCase()}
            </div>
          )}
          <span className="text-white font-semibold text-[15px]">{reel.user.display_name || reel.user.username}</span>
          <span className="text-white/70 text-sm">@{reel.user.username}</span>
        </div>

        <p className="text-white text-sm line-clamp-2">
          {reel.description || reel.title}
        </p>

        {/* Live Train Tag Overlay */}
        {(reel.train_number || reel.station_tag) && (
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 backdrop-blur-md rounded border border-white/10 w-fit">
              {reel.train_number && (
                <>
                  <span className="text-xs">🚂</span>
                  <span className="text-white text-xs font-medium">
                    {reel.train_number} {reel.train_name && `- ${reel.train_name}`}
                  </span>
                </>
              )}
              {reel.train_number && reel.station_tag && (
                <span className="text-white/40 text-xs px-1">•</span>
              )}
              {reel.station_tag && (
                <>
                  <MapPin className="w-3 h-3 text-white/70" />
                  <span className="text-white/80 text-xs">{reel.station_tag}</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
