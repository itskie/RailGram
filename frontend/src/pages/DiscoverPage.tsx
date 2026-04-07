import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { users as usersApi, posts as postsApi, reels as reelsApi } from "../lib/api";
import { Search as SearchIcon, Loader2, Play, Heart } from "lucide-react";
import type { UnifiedFeedItem } from "../types";

export default function DiscoverPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  // User autosuggest
  const { data: userResults, isLoading: userLoading } = useQuery<any[]>({
    queryKey: ["user-search", debouncedQuery],
    queryFn: () => usersApi.search(debouncedQuery) as Promise<any[]>,
    enabled: debouncedQuery.length > 0,
  });

  // Explore grid — posts + reels mixed (infinite scroll)
  const {
    data: exploreData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: exploreLoading,
  } = useInfiniteQuery({
    queryKey: ["explore_grid"],
    queryFn: ({ pageParam }) =>
      postsApi.unifiedFeed("for_you", pageParam as string | undefined) as Promise<{
        items: UnifiedFeedItem[];
        next_cursor: string | null;
      }>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  const allItems = exploreData?.pages.flatMap((p) => p.items) ?? [];

  // Infinite scroll sentinel
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

  const isSearching = debouncedQuery.length > 0;

  return (
    <div className="max-w-2xl mx-auto min-h-screen bg-black pb-24">
      {/* Search bar */}
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-md px-3 pt-4 pb-3 border-b border-zinc-900">
        <div className="relative">
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
            <SearchIcon size={16} className="text-zinc-500" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowSuggest(true); }}
            onFocus={() => setShowSuggest(true)}
            onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
            placeholder="Search users, trains, hashtags…"
            className="w-full bg-zinc-900 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-orange-500/40 transition-all"
          />
          {userLoading && query.length > 0 && (
            <div className="absolute inset-y-0 right-3 flex items-center">
              <Loader2 size={14} className="animate-spin text-orange-400" />
            </div>
          )}
        </div>

        {/* Autosuggest dropdown */}
        {showSuggest && isSearching && userResults && userResults.length > 0 && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl z-50">
            {userResults.slice(0, 6).map((u) => (
              <button
                key={u.id}
                onMouseDown={() => navigate(`/profile/${u.username}`)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-zinc-700 overflow-hidden shrink-0">
                  {u.avatar_url
                    ? <img src={u.avatar_url} className="w-full h-full object-cover" alt="" />
                    : <div className="w-full h-full bg-zinc-700" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{u.display_name || u.username}</p>
                  <p className="text-zinc-500 text-xs truncate">@{u.username}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Explore grid */}
      {!isSearching && (
        <>
          {exploreLoading && (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-orange-400" size={24} />
            </div>
          )}

          <div className="grid grid-cols-3 gap-0.5 mt-0.5">
            {allItems.map((item) => (
              <ExploreGridItem key={`${item.item_type}-${item.id}`} item={item} />
            ))}
          </div>

          <div ref={loaderRef} className="flex justify-center py-4">
            {isFetchingNextPage && <Loader2 className="animate-spin text-orange-400" size={18} />}
          </div>
        </>
      )}

      {/* Search results — users full list */}
      {isSearching && userResults && userResults.length > 0 && (
        <div className="px-3 pt-3 space-y-1">
          {userResults.map((u) => (
            <Link
              key={u.id}
              to={`/profile/${u.username}`}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-900 transition-colors"
            >
              <div className="w-11 h-11 rounded-full bg-zinc-800 overflow-hidden shrink-0">
                {u.avatar_url
                  ? <img src={u.avatar_url} className="w-full h-full object-cover" alt="" />
                  : <div className="w-full h-full bg-zinc-800" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{u.display_name || u.username}</p>
                <p className="text-zinc-500 text-xs truncate">@{u.username} · {u.karma ?? 0} karma</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {isSearching && debouncedQuery && (!userResults || userResults.length === 0) && !userLoading && (
        <div className="flex flex-col items-center py-20 text-center">
          <p className="text-zinc-400 font-semibold text-sm">No results for "{debouncedQuery}"</p>
        </div>
      )}
    </div>
  );
}

function ExploreGridItem({ item }: { item: UnifiedFeedItem }) {
  const navigate = useNavigate();
  const isReel = item.item_type === "reel";

  const thumb = isReel
    ? (item as any).thumbnail_url || (item as any).hls_url
    : (item as any).media?.[0]?.url || (item as any).media_url;

  if (!thumb) return null;

  return (
    <button
      onClick={() =>
        isReel ? navigate(`/reels/${item.id}`) : navigate(`/posts/${item.id}`)
      }
      className="relative aspect-square bg-zinc-900 overflow-hidden group"
    >
      <img
        src={thumb}
        alt=""
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        loading="lazy"
      />
      {/* Overlay on hover */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
        <div className="flex items-center gap-3 text-white text-sm font-bold">
          <span className="flex items-center gap-1">
            <Heart size={16} fill="white" /> {(item as any).like_count ?? (item as any).likes_count ?? 0}
          </span>
        </div>
      </div>
      {/* Reel indicator */}
      {isReel && (
        <div className="absolute top-1.5 right-1.5">
          <Play size={14} className="text-white drop-shadow-md" fill="white" />
        </div>
      )}
      {/* Multi-image indicator */}
      {!isReel && (item as any).media?.length > 1 && (
        <div className="absolute top-1.5 right-1.5">
          <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
            {[0,1,2,3].map(i => <div key={i} className="bg-white rounded-[1px]" />)}
          </div>
        </div>
      )}
    </button>
  );
}
