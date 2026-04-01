import { useEffect, useRef, useState } from 'react';
import type { Reel } from '../types/reel';
import { ReelPlayer } from './ReelPlayer';
import { ReelOverlay } from './ReelOverlay';
import { ReelActionBar } from './ReelActionBar';
import { HeartAnimation } from './HeartAnimation';
import { CommentsModal } from '../../../components/CommentsModal';
import { useReelActions } from '../hooks/useReelActions';
import { useReelLike } from '../../../hooks/useEngagement';
import { useReelStore } from '../../../store/reelStore';
import { VolumeX, Volume2 } from 'lucide-react';

interface ReelCardProps {
  reel: Reel;
}

export function ReelCard({ reel }: ReelCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);
  const { recordView } = useReelActions();
  const { isMuted, toggleMute } = useReelStore();
  const [showMuteIndicator, setShowMuteIndicator] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const lastTapRef = useRef<number>(0);
  const [, setLocalViews] = useState(reel.views);

  // Like state lives here (parent) and is passed as plain props to ReelActionBar
  const { liked, count: likeCount, toggle: toggleLike } = useReelLike(
    reel.id, reel.viewer_liked ?? false, reel.likes_count ?? 0, reel.user.username
  );

  // Intersection Observer to detect when the reel snaps into full view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // A reel is 'active' if at least 60% of it is visible
          setIsActive(entry.intersectionRatio >= 0.6);
        });
      },
      {
        root: null, // viewport
        threshold: [0.6], 
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [reel.id]);

  const handleRecordView = (secs: number) => {
    recordView({ id: reel.id, watched_secs: secs });
    setLocalViews((v) => v + 1);
  };

  const handleInteraction = (e: React.MouseEvent) => {
    // Don't steal taps from overlay buttons (Follow, links) — Safari can still bubble oddly
    const t = e.target as HTMLElement;
    if (t.closest("button, a, [role='button']")) return;

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected → Always toggle like (works for both like and unlike)
      setShowHeart(true);
      console.log('[DT] typeof toggleLike:', typeof toggleLike, '| liked:', liked, '| count:', likeCount);
      toggleLike();
      console.log('[DT] toggleLike() called');
    } else {
      // Single tap -> Toggle Mute
      toggleMute();
      setShowMuteIndicator(true);
      setTimeout(() => setShowMuteIndicator(false), 1500);
    }
    lastTapRef.current = now;
  };

  return (
    <div 
      ref={containerRef} 
      className="relative flex items-end justify-center w-full shrink-0 h-[calc(100vh-64px)] sm:h-[calc(100vh-72px)] snap-start bg-black overflow-hidden group select-none"
    >
      {/* Video Container (Main vertical frame) */}
      <div 
        className="relative w-full max-w-[420px] h-full bg-zinc-900 overflow-hidden group shadow-2xl border-x border-zinc-800"
        onClick={handleInteraction}
      >
        <ReelPlayer
          hlsUrl={reel.hls_url}
          thumbnailUrl={reel.thumbnail_url}
          isActive={isActive}
          onRecordView={handleRecordView}
        />

        {/* DEBUG: remove after fix */}
        <div className="absolute top-2 left-2 z-50 bg-black/80 text-white text-xs p-2 rounded pointer-events-none">
          liked: {String(liked)} | count: {likeCount}
        </div>

        <HeartAnimation 
          isVisible={showHeart} 
          onComplete={() => setShowHeart(false)} 
        />

        <ReelOverlay reel={reel} />

        {/* Mobile Action Bar (Overlay) */}
        <div className="sm:hidden">
          <ReelActionBar
            reel={reel}
            onCommentClick={() => setIsCommentsOpen(true)}
            variant="overlay"
            liked={liked}
            likeCount={likeCount}
            onLike={toggleLike}
          />
        </div>

        <CommentsModal
          type="reel"
          entityId={reel.id}
          isOpen={isCommentsOpen}
          onClose={() => setIsCommentsOpen(false)}
        />

        {/* Center Screen Mute Indicator */}
        <div 
          className={`absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-none transition-opacity duration-300 ${showMuteIndicator ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
        >
          {isMuted ? <VolumeX className="w-8 h-8 text-white" /> : <Volume2 className="w-8 h-8 text-white" />}
        </div>
      </div>

      {/* Desktop Action Sidebar (Next to video) */}
      <div className="hidden sm:flex ml-4 mb-2">
        <ReelActionBar
          reel={reel}
          onCommentClick={() => setIsCommentsOpen(true)}
          variant="sidebar"
          liked={liked}
          likeCount={likeCount}
          onLike={toggleLike}
        />
      </div>
    </div>
  );
}
