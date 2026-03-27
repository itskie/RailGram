import type { Post } from "../types";
import { Heart, MessageCircle, Bookmark, Train } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { posts as postsApi } from "../lib/api";

export default function PostCard({ post }: { post: Post }) {
  const qc = useQueryClient();

  const likeMut = useMutation({
    mutationFn: () =>
      post.liked ? postsApi.unlike(post.id) : postsApi.like(post.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feed"] }),
  });

  return (
    <article className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-zinc-700 overflow-hidden flex-shrink-0">
          {post.author.avatar_url && (
            <img src={post.author.avatar_url} className="w-full h-full object-cover" alt="" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-zinc-100 truncate">
            {post.author.display_name ?? post.author.username}
          </p>
          <p className="text-xs text-zinc-500">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </p>
        </div>
        {post.train_no && (
          <span className="flex items-center gap-1 text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full">
            <Train size={11} />
            {post.train_no}
          </span>
        )}
      </div>

      {/* Images */}
      {post.media_keys.length > 0 && (
        <div className={`grid gap-0.5 ${post.media_keys.length > 1 ? "grid-cols-2" : ""}`}>
          {post.media_keys.map((key) => (
            <img
              key={key}
              src={`/api/v1/media/${key}`}
              className="w-full aspect-square object-cover"
              alt=""
              loading="lazy"
            />
          ))}
        </div>
      )}

      {/* Caption */}
      {post.caption && (
        <p className="px-4 pt-3 text-sm text-zinc-200 whitespace-pre-wrap">{post.caption}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 py-3">
        <button
          onClick={() => likeMut.mutate()}
          className={`flex items-center gap-1.5 text-sm transition-colors ${
            post.liked ? "text-red-400" : "text-zinc-400 hover:text-red-400"
          }`}
        >
          <Heart size={18} fill={post.liked ? "currentColor" : "none"} />
          {post.like_count}
        </button>
        <button className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
          <MessageCircle size={18} />
          {post.comment_count}
        </button>
        <button className="ml-auto flex items-center text-zinc-400 hover:text-orange-400 transition-colors">
          <Bookmark size={18} fill={post.bookmarked ? "currentColor" : "none"} />
        </button>
      </div>
    </article>
  );
}
