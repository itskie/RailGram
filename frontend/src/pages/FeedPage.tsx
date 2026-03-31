import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { posts as postsApi } from "../lib/api";
import UnifiedFeedCard from "../components/UnifiedFeedCard";
import type { UnifiedFeedItem, UnifiedFeedResponse } from "../types";
import { Loader } from "lucide-react";

type FeedType = "for_you" | "following";

export default function FeedPage() {
  const [activeTab, setActiveTab] = useState<FeedType>("for_you");
  const loaderRef = useRef<HTMLDivElement>(null);

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
      {/* Twitter/X Style Tabs */}
      <div className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="flex">
          <button
            onClick={() => setActiveTab("for_you")}
            className="flex-1 relative py-4 text-sm font-semibold transition-colors"
          >
            <span className={activeTab === "for_you" ? "text-white" : "text-zinc-500"}>
              For You
            </span>
            {activeTab === "for_you" && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-orange-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("following")}
            className="flex-1 relative py-4 text-sm font-semibold transition-colors"
          >
            <span className={activeTab === "following" ? "text-white" : "text-zinc-500"}>
              Following
            </span>
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
    </div>
  );
}
