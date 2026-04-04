import { useParams, Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { posts as postsApi } from "../lib/api";
import type { UnifiedFeedResponse } from "../types";
import UnifiedFeedCard from "../components/UnifiedFeedCard";
import { Hash, ArrowLeft } from "lucide-react";

export default function HashtagFeedPage() {
  const { tag } = useParams<{ tag: string }>();
  const cleanTag = (tag ?? "").replace(/^#/, "");

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ["hashtag-feed", cleanTag],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      postsApi.hashtagFeed(cleanTag, pageParam) as Promise<UnifiedFeedResponse>,
    getNextPageParam: (last: UnifiedFeedResponse) => last.next_cursor ?? undefined,
    initialPageParam: undefined,
    enabled: !!cleanTag,
  });

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
        <Link to={-1 as any} className="p-1.5 rounded-full hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-zinc-400" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-orange-500/15 flex items-center justify-center">
            <Hash className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <p className="font-bold text-base leading-tight">#{cleanTag}</p>
            {!isLoading && (
              <p className="text-xs text-zinc-500">{items.length} posts</p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto pt-2 pb-24">
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {isError && (
          <div className="text-center py-16 text-zinc-500">
            <p>Something went wrong. Try again.</p>
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="text-center py-24 text-zinc-500">
            <Hash className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
            <p className="text-lg font-semibold text-zinc-400">#{cleanTag}</p>
            <p className="text-sm mt-1">No posts with this hashtag yet</p>
          </div>
        )}

        {items.map((item) => (
          <UnifiedFeedCard key={`${item.item_type}-${item.id}`} item={item} />
        ))}

        {hasNextPage && (
          <div className="flex justify-center py-6">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="px-6 py-2 rounded-full bg-zinc-800 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              {isFetchingNextPage ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
