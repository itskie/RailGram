import { useInfiniteQuery } from "@tanstack/react-query";
import { posts as postsApi } from "../lib/api";
import PostCard from "../components/PostCard";
import type { Post } from "../types";
import { Loader } from "lucide-react";

export default function FeedPage() {
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

  const allPosts = data?.pages.flatMap((p) => p.posts) ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="animate-spin text-orange-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-400 text-sm">
        Failed to load feed: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-zinc-100">Feed</h1>

      {allPosts.length === 0 && (
        <p className="text-zinc-500 text-sm text-center py-12">
          No posts yet. Follow some railfans to see their posts here!
        </p>
      )}

      {allPosts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mt-2 text-sm text-orange-400 hover:underline self-center disabled:opacity-50"
        >
          {isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
