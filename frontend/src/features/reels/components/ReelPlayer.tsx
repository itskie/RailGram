import { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { useReelStore } from '../../../store/reelStore';
import { Volume2, VolumeX } from 'lucide-react';

interface ReelPlayerProps {
  hlsUrl: string | null;
  thumbnailUrl: string | null;
  isActive: boolean;
  onRecordView?: (watchedSecs: number) => void;
}

export function ReelPlayer({ hlsUrl, thumbnailUrl, isActive, onRecordView }: ReelPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const { isMuted, globalVolume } = useReelStore();
  
  // Track continuous watch time for current session
  const watchTimeRef = useRef(0);
  const lastTimeUpdateRef = useRef(0);
  const hasRecordedViewRef = useRef(false);

  // Auto-play / Pause logic based on Intersection Observer active state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      // Sync global volume/mute
      video.muted = isMuted;
      video.volume = globalVolume;

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
  }, [isActive, isMuted, globalVolume, onRecordView]);

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
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        // Force muted initially on the DOM element for strict browser policies
        muted={isMuted} 
        className="w-full h-full object-cover"
      />

      {/* Mute/Unmute Button */}
      <button
        onClick={() => useReelStore.setState((state) => ({ isMuted: !state.isMuted }))}
        className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-all active:scale-90 backdrop-blur-sm"
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? (
          <VolumeX size={20} strokeWidth={2} className="text-white" />
        ) : (
          <Volume2 size={20} strokeWidth={2} className="text-white" />
        )}
      </button>
    </div>
  );
}
