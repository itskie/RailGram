import { useState, useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { posts as postsApi } from "../lib/api";
import UnifiedFeedCard from "../components/UnifiedFeedCard";
import type { UnifiedFeedItem } from "../types";
import { Loader, Train, Plus } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import CreatePostModal from "../components/CreatePostModal";
import CreateReelModal from "../features/reels/components/CreateReelModal";

type FeedType = "for_you" | "following";

export default function FeedPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<FeedType>("for_you");
  const [createOpen, setCreateOpen] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isReelModalOpen, setIsReelModalOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Listen to the parent scrollable container (main element)
    const scrollEl = document.querySelector("main") as HTMLElement | null;
    if (!scrollEl) return;
    const handleScroll = () => {
      const currentY = scrollEl.scrollTop;
      if (currentY < 10) setHeaderVisible(true);
      else if (currentY > lastScrollY.current + 6) setHeaderVisible(false);
      else if (currentY < lastScrollY.current - 6) setHeaderVisible(true);
      lastScrollY.current = currentY;
    };
    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, []);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: ["unified_feed", activeTab],
    queryFn: ({ pageParam }) => 
      postsApi.unifiedFeed(activeTab, pageParam as string | undefined) as Promise<{ items: UnifiedFeedItem[]; next_cursor: string | null }>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  // Infinite scroll — auto-load next page when bottom sentinel is visible
  useEffect(() => {
    if (!loaderRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, activeTab]);

  const allItems = data?.pages.flatMap((p) => p.items) ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="animate-spin text-orange-400" size={28} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-zinc-500 text-sm">
        Failed to load feed.
      </div>
    );
  }

  return (
    <div className="max-w-[470px] mx-auto px-3">
      {/* Twitter-style top header */}
      <div
        className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 transition-transform duration-300"
        style={{ transform: headerVisible ? "translateY(0)" : "translateY(-110%)" }}
      >
        <div className="flex items-center justify-between px-1 pt-3 pb-1">
          {/* Left: Avatar */}
          <div className="w-10 flex justify-start">
            {user?.avatar_url ? (
              <img src={user.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-800" />
            )}
          </div>
          {/* Center: RailGram logo */}
          <div className="flex items-center gap-1.5">
            <Train size={22} className="text-orange-500" strokeWidth={2} />
            <span className="font-black text-white text-lg tracking-tight">RailGram</span>
          </div>
          {/* Right: Create button */}
          <div className="w-10 flex justify-end relative">
            <button
              onClick={() => setCreateOpen(!createOpen)}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <Plus size={22} strokeWidth={2} />
            </button>
            {createOpen && (
              <div className="absolute top-full right-0 mt-1 bg-zinc-950 rounded-xl border border-zinc-800/50 overflow-hidden z-50 w-max">
                <button
                  onClick={() => { setIsPostModalOpen(true); setCreateOpen(false); }}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white transition-all w-full"
                >
                  Post
                </button>
                <button
                  onClick={() => { setIsReelModalOpen(true); setCreateOpen(false); }}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white transition-all border-t border-zinc-800/50 w-full"
                >
                  Reel
                </button>
              </div>
            )}
          </div>
        </div>
        {/* For You / Following tabs */}
        <div className="flex">
          <button
            onClick={() => setActiveTab("for_you")}
            className="flex-1 relative py-3 text-sm font-semibold transition-colors"
          >
            <span className={activeTab === "for_you" ? "text-white" : "text-zinc-500"}>For You</span>
            {activeTab === "for_you" && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-orange-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("following")}
            className="flex-1 relative py-3 text-sm font-semibold transition-colors"
          >
            <span className={activeTab === "following" ? "text-white" : "text-zinc-500"}>Following</span>
            {activeTab === "following" && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-orange-500 rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Feed Content */}
      <div className="pt-3">
        {allItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center px-6">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
              {activeTab === "following" ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-zinc-500">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-zinc-500">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              )}
            </div>
            <p className="text-white font-semibold text-sm">
              {activeTab === "following" ? "Not following anyone yet" : "No posts yet"}
            </p>
            <p className="text-zinc-500 text-sm">
              {activeTab === "following" 
                ? "Follow railfans to see their posts and reels here."
                : "Follow railfans to see their posts and reels here."}
            </p>
          </div>
        )}

        {allItems.map((item) => (
          <UnifiedFeedCard key={`${item.item_type}-${item.id}`} item={item} />
        ))}

        {/* Sentinel for infinite scroll */}
        <div ref={loaderRef} className="flex justify-center py-6">
          {isFetchingNextPage && <Loader className="animate-spin text-orange-400" size={20} />}
        </div>
      </div>

      {isPostModalOpen && <CreatePostModal isOpen={isPostModalOpen} onClose={() => setIsPostModalOpen(false)} />}
      {isReelModalOpen && <CreateReelModal isOpen={isReelModalOpen} onClose={() => setIsReelModalOpen(false)} />}
    </div>
  );
}
