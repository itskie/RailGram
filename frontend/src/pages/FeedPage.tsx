import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { posts as postsApi } from "../lib/api";
import PostCard from "../components/PostCard";
import type { Post } from "../types";
import { Loader } from "lucide-react";

export default function FeedPage() {
  const loaderRef = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: ["feed"],
    queryFn: ({ pageParam }) => postsApi.feed(pageParam as string | undefined) as Promise<{ posts: Post[]; next_cursor: string | null }>,
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
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allPosts = data?.pages.flatMap((p) => p.posts) ?? [];

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
    <div className="max-w-[470px] mx-auto px-3 pt-3">
      {allPosts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center px-6">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-zinc-500">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <p className="text-white font-semibold text-sm">No posts yet</p>
          <p className="text-zinc-500 text-sm">Follow railfans to see their posts here.</p>
        </div>
      )}

      {allPosts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {/* Sentinel for infinite scroll */}
      <div ref={loaderRef} className="flex justify-center py-6">
        {isFetchingNextPage && <Loader className="animate-spin text-orange-400" size={20} />}
      </div>
    </div>
  );
}
