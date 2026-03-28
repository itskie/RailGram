import { useEffect, useRef } from 'react';
import { useReelFeed } from '../../features/reels/hooks/useReelFeed';
import { ReelCard } from '../../features/reels/components/ReelCard';
import { Loader2 } from 'lucide-react';


export function ReelsPage() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = useReelFeed('feed');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Expose global mute state specifically on mount wrapper to handle mobile browser gesture limits?
  // We leave it at the ReelCard component level for now via the click toggle.

  // Infinite Scroll logic via Intersection Observer on bottom load trigger
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    });

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-64px)] sm:h-[calc(100vh-72px)] bg-black items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-[calc(100vh-64px)] sm:h-[calc(100vh-72px)] bg-black items-center justify-center text-white">
        <p>Failed to load reels. Try refreshing.</p>
      </div>
    );
  }

  const allReels = data?.pages.flatMap((page) => page.items) || [];

  if (allReels.length === 0) {
    return (
      <div className="flex flex-col h-[calc(100vh-64px)] sm:h-[calc(100vh-72px)] bg-black items-center justify-center text-zinc-400 p-6 text-center">
        <h3 className="text-white text-xl font-semibold mb-2">No Reels Yet</h3>
        <p>Follow more railfans or check back later to discover reels.</p>
      </div>
    );
  }

  return (
    <div 
      ref={scrollContainerRef}
      className="flex flex-col w-full h-[calc(100vh-64px)] sm:h-[calc(100vh-72px)] overflow-y-scroll snap-y snap-mandatory bg-black no-scrollbar"
    >
      {allReels.map((reel) => (
        <ReelCard key={reel.id} reel={reel} />
      ))}

      {/* Invisible element at the bottom to trigger next page load */}
      <div ref={loadMoreRef} className="h-4 p-8 flex items-center justify-center snap-center bg-black">
        {isFetchingNextPage && <Loader2 className="w-6 h-6 text-white/50 animate-spin" />}
      </div>
    </div>
  );
}
