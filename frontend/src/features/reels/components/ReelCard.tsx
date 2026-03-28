import { useEffect, useRef, useState } from 'react';
import type { Reel } from '../types/reel';
import { ReelPlayer } from './ReelPlayer';
import { ReelOverlay } from './ReelOverlay';
import { ReelActionBar } from './ReelActionBar';
import { useReelActions } from '../hooks/useReelActions';
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
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    // Prevent triggering background clicks, etc.
    e.stopPropagation();
    toggleMute();
    
    // Briefly show the mute state overlay
    setShowMuteIndicator(true);
    setTimeout(() => setShowMuteIndicator(false), 1500);
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-[calc(100vh-64px)] sm:h-[calc(100vh-72px)] snap-center bg-black overflow-hidden group select-none"
      onClick={handleToggleMute}
    >
      <ReelPlayer
        hlsUrl={reel.hls_url}
        thumbnailUrl={reel.thumbnail_url}
        isActive={isActive}
        onRecordView={handleRecordView}
      />

      <ReelOverlay reel={reel} />

      <ReelActionBar 
        reel={reel}
        onCommentClick={() => alert("Comments slide-up UI to be implemented")}
      />

      {/* Center Screen Mute Indicator */}
      <div 
        className={`absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-none transition-opacity duration-300 ${showMuteIndicator ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
      >
        {isMuted ? <VolumeX className="w-8 h-8 text-white" /> : <Volume2 className="w-8 h-8 text-white" />}
      </div>
    </div>
  );
}
