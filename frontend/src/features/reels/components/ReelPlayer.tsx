import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { useReelStore } from '../../../store/reelStore';

interface ReelPlayerProps {
  hlsUrl: string | null;
  thumbnailUrl: string | null;
  isActive: boolean;
  onRecordView?: (watchedSecs: number) => void;
  onDoubleTap?: () => void;
}

export function ReelPlayer({ hlsUrl, thumbnailUrl, isActive, onRecordView, onDoubleTap }: ReelPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const { isMuted, toggleMute } = useReelStore();
  const [heartVisible, setHeartVisible] = useState(false);
  
  // Track continuous watch time for current session
  const watchTimeRef = useRef(0);
  const lastTimeUpdateRef = useRef(0);
  const hasRecordedViewRef = useRef(false);
  
  // Double-tap detection
  const lastClickTimeRef = useRef(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVideoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const now = Date.now();
    
    // Clear any pending single-tap timeout
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
    }
    
    if (now - lastClickTimeRef.current < 300) {
      // Double tap detected - show heart and trigger like
      setHeartVisible(true);
      setTimeout(() => setHeartVisible(false), 800);
      onDoubleTap?.();
      lastClickTimeRef.current = 0; // Reset to prevent triple-tap issues
    } else {
      // Single tap - schedule mute toggle (will be cancelled if double-tap happens within 300ms)
      tapTimeoutRef.current = setTimeout(() => {
        toggleMute();
        tapTimeoutRef.current = null;
      }, 300);
    }
    
    lastClickTimeRef.current = now;
  };

  // Auto-play / Pause logic based on Intersection Observer active state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      // Sync global volume/mute
      video.muted = isMuted;

      // Ensure play promise is handled
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // Auto-play is commonly prevented by browsers if not muted.
          // By default we force `muted=true` initially, so this should rarely hit unless user un-muted elsewhere and browser rejects it here.
          console.warn('Reel playback prevented:', err);
        });
      }
      
      // Reset watch time for this view session
      watchTimeRef.current = 0;
      lastTimeUpdateRef.current = video.currentTime;
      hasRecordedViewRef.current = false;
      
    } else {
      video.pause();
      
      // If we pause (scroll away), check if we watched enough to record
      if (!hasRecordedViewRef.current && watchTimeRef.current > 3 && onRecordView) {
        onRecordView(Math.round(watchTimeRef.current));
        hasRecordedViewRef.current = true;
      }
    }
  }, [isActive, isMuted, onRecordView]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

  // HLS.js Initialization / Direct MP4 fallback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return;

    // Detect if we are serving a raw MP4 (unconverted yet) or a real HLS manifest
    const isHls = hlsUrl.toLowerCase().endsWith('.m3u8');

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        manifestLoadingTimeOut: 10000,
        enableWorker: true
      });
      
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else {
      // Direct MP4 playback or native HLS support (Safari)
      video.src = hlsUrl;
      hlsRef.current = null;
    }
  }, [hlsUrl]);

  // Handle watch time tracking
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const now = video.currentTime;
    const diff = now - lastTimeUpdateRef.current;
    
    // Account for normal playback (diff > 0)
    // Ignore scrubbing/looping jumps (diff < 0)
    if (diff > 0 && diff < 1) {
      watchTimeRef.current += diff;
    }
    lastTimeUpdateRef.current = now;
  };

  const handleEnded = () => {
    // We expect the video to 'loop', so it shouldn't hit 'ended'. But just in case.
    if (!hasRecordedViewRef.current && watchTimeRef.current > 3 && onRecordView) {
      onRecordView(Math.round(watchTimeRef.current));
      hasRecordedViewRef.current = true;
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full bg-black group">
      {!hlsUrl && (
        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center text-zinc-500">
          <p>Video is processing...</p>
        </div>
      )}

      <video
        ref={videoRef}
        poster={thumbnailUrl ?? undefined}
        loop
        playsInline // Required for iOS auto-play
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onClick={handleVideoClick}
        // Force muted initially on the DOM element for strict browser policies
        muted={isMuted} 
        className="w-full h-full object-cover cursor-pointer"
      />

      {/* Double-tap heart animation */}
      {heartVisible && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <svg
            viewBox="0 0 24 24"
            fill="white"
            className="w-24 h-24 drop-shadow-2xl"
            style={{ animation: "heartBurst 0.7s ease-out forwards" }}
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
      )}
    </div>
  );
}
