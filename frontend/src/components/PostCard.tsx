import type { Post } from "../types";
import { Heart, MessageCircle, Bookmark, Zap, Hash, Home as HomeIcon, Globe, Train } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { posts as postsApi, users as usersApi } from "../lib/api";
import MediaCarousel from "./MediaCarousel";
import VerifiedBadge from "./VerifiedBadge";
import Avatar from "./Avatar";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useLoginPrompt } from "../hooks/useLoginPrompt";
import { useState } from "react";
import ThreeDotMenu from "./ThreeDotMenu";

export default function PostCard({ post }: { post: Post }) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const nav = useNavigate();
  const { requireAuth } = useLoginPrompt();
  const isOwnPost = me?.id === post.author.id;
  const [likeAnim, setLikeAnim] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const captionLimit = 125;

  const deleteMut = useMutation({
    mutationFn: () => postsApi.delete(post.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["userPosts"] });
    },
  });

  const menuOptions = isOwnPost
    ? [
        { label: "Delete post", danger: true, onClick: () => { if (window.confirm("Delete this post?")) deleteMut.mutate(); } },
        { label: "Copy link", onClick: () => navigator.clipboard.writeText(`${window.location.origin}/posts/${post.id}`) },
      ]
    : [
        { label: "Go to profile", onClick: () => nav(`/profile/${post.author.username}`) },
        { label: "Copy link", onClick: () => navigator.clipboard.writeText(`${window.location.origin}/posts/${post.id}`) },
        { label: "Report", danger: true, onClick: () => alert("Thanks for your report. We'll review it.") },
      ];

  const likeMut = useMutation({
    mutationFn: () => post.liked ? postsApi.unlike(post.id) : postsApi.like(post.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feed"] }),
  });

  const followMut = useMutation({
    mutationFn: () => usersApi.follow(post.author.username),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["feed"] });
      const prev = qc.getQueryData(["feed"]);
      qc.setQueriesData({ queryKey: ["feed"] }, (old: any) => {
        if (!old) return old;
        const update = (pages: any[]) =>
          pages.map((page: any) => ({
            ...page,
            posts: page.posts?.map((p: Post) =>
              p.author.id === post.author.id ? { ...p, viewer_followed: !p.viewer_followed } : p
            ),
          }));
        if (old.pages) return { ...old, pages: update(old.pages) };
        if (old.posts) return { ...old, posts: old.posts.map((p: Post) => p.author.id === post.author.id ? { ...p, viewer_followed: !p.viewer_followed } : p) };
        return old;
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["feed"], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["feed"] }),
  });

  const bookmarkMut = useMutation({
    mutationFn: () => post.bookmarked ? postsApi.unbookmark(post.id) : postsApi.bookmark(post.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feed"] }),
  });

  const handleLike = () => {
    if (!requireAuth()) return;
    if (!post.liked) { setLikeAnim(true); setTimeout(() => setLikeAnim(false), 400); }
    likeMut.mutate();
  };

  const handleDoubleTap = () => {
    if (!post.liked) handleLike();
  };

  const hasLocoInfo = post.loco_class || post.loco_number || post.loco_shed || post.loco_zone;
  const longCaption = post.caption && post.caption.length > captionLimit;

  return (
    <article className="rounded-2xl overflow-hidden border border-zinc-800/60 group mb-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-3">
        <Avatar
          src={post.author.avatar_url}
          name={post.author.display_name}
          username={post.author.username}
          size={10}
          linkTo={`/profile/${post.author.username}`}
          className="ring-2 ring-orange-500/30"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              to={`/profile/${post.author.username}`}
              className="font-semibold text-[13px] text-white hover:opacity-80 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              {post.author.username}
            </Link>
            {post.author.is_verified && <VerifiedBadge type="blue" size={13} />}
            {me && !isOwnPost && (
              <>
                <span className="text-zinc-600 text-xs">•</span>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (requireAuth()) followMut.mutate(); }}
                  className="text-[13px] font-semibold text-orange-400 hover:text-orange-300 transition-colors"
                >
                  {post.viewer_followed ? "Following" : "Follow"}
                </button>
              </>
            )}
          </div>
          {post.location_name && (
            <p className="text-[11px] text-zinc-500 leading-tight">{post.location_name}</p>
          )}
        </div>
        {post.train_no && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-md">
            <Train size={9} />
            {post.train_no}
          </span>
        )}
        <ThreeDotMenu options={menuOptions} />
      </div>

      {/* Media */}
      <MediaCarousel mediaKeys={post.media_keys} onDoubleTap={handleDoubleTap} />

      {/* Actions */}
      <div className="px-3 pt-2.5 pb-1">
        <div className="flex items-center mb-2">
          {/* Like + Comment — left side */}
          <div className="flex flex-row items-center gap-3">
            <button
              onClick={handleLike}
              className={`flex items-center transition-transform active:scale-90 ${likeAnim ? "scale-125" : ""}`}
            >
              <Heart
                size={24}
                className={`transition-colors ${post.liked ? "text-red-500 fill-red-500" : "text-white hover:text-zinc-400"}`}
                fill={post.liked ? "currentColor" : "none"}
              />
            </button>
            <button
              onClick={() => { if (requireAuth()) nav(`/posts/${post.id}/comments`); }}
              className="flex items-center text-white hover:text-zinc-400 transition-colors"
            >
              <MessageCircle size={24} strokeWidth={1.8} />
            </button>
          </div>
          {/* Bookmark — right side */}
          <button
            onClick={() => { if (requireAuth()) bookmarkMut.mutate(); }}
            className="ml-auto text-white hover:text-zinc-400 transition-colors"
          >
            <Bookmark
              size={24}
              strokeWidth={1.8}
              className={post.bookmarked ? "fill-white" : ""}
            />
          </button>
        </div>

        {/* Like count */}
        {post.like_count > 0 && (
          <p className="text-[13px] font-semibold text-white mb-1">
            {post.like_count.toLocaleString()} {post.like_count === 1 ? "like" : "likes"}
          </p>
        )}

        {/* Caption */}
        {post.caption && (
          <p className="text-[13px] text-zinc-100 leading-snug">
            <Link
              to={`/profile/${post.author.username}`}
              className="font-semibold text-white mr-1.5 hover:opacity-80"
            >
              {post.author.username}
            </Link>
            {captionExpanded || !longCaption
              ? post.caption
              : post.caption.slice(0, captionLimit) + "… "}
            {longCaption && (
              <button
                onClick={() => setCaptionExpanded((v) => !v)}
                className="text-zinc-500 hover:text-zinc-300 text-[13px]"
              >
                {captionExpanded ? "less" : "more"}
              </button>
            )}
          </p>
        )}

        {/* Loco info */}
        {hasLocoInfo && (
          <div className="mt-2 bg-zinc-900 rounded-xl px-3 py-2.5 border border-zinc-800 space-y-2">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              <p className="text-[9px] font-black uppercase text-zinc-500 tracking-[0.2em]">Loco Spotting Report</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {post.loco_class && (
                <div className="flex items-center gap-1.5">
                  <Zap size={11} className="text-orange-500 shrink-0" />
                  <div>
                    <p className="text-[9px] font-black text-zinc-600 uppercase">Class</p>
                    <p className="text-[11px] font-bold text-zinc-200">{post.loco_class}</p>
                  </div>
                </div>
              )}
              {post.loco_number && (
                <div className="flex items-center gap-1.5">
                  <Hash size={11} className="text-orange-500 shrink-0" />
                  <div>
                    <p className="text-[9px] font-black text-zinc-600 uppercase">Road No</p>
                    <p className="text-[11px] font-bold text-zinc-200">{post.loco_number}</p>
                  </div>
                </div>
              )}
              {post.loco_shed && (
                <div className="flex items-center gap-1.5">
                  <HomeIcon size={11} className="text-orange-500 shrink-0" />
                  <div>
                    <p className="text-[9px] font-black text-zinc-600 uppercase">Shed</p>
                    <p className="text-[11px] font-bold text-zinc-200">{post.loco_shed}</p>
                  </div>
                </div>
              )}
              {post.loco_zone && (
                <div className="flex items-center gap-1.5">
                  <Globe size={11} className="text-orange-500 shrink-0" />
                  <div>
                    <p className="text-[9px] font-black text-zinc-600 uppercase">Zone</p>
                    <p className="text-[11px] font-bold text-zinc-200">{post.loco_zone}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Comment count */}
        {post.comment_count > 0 && (
          <button
            onClick={() => { if (requireAuth()) nav(`/posts/${post.id}/comments`); }}
            className="mt-1 text-[12px] text-zinc-500 hover:text-zinc-400 transition-colors"
          >
            View all {post.comment_count} comments
          </button>
        )}

        {/* Timestamp */}
        <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-600">
          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
        </p>
      </div>
    </article>
  );
}
