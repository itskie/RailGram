import type { Post } from "../types";
import { Heart, MessageCircle, Bookmark, Zap, Hash, Home as HomeIcon, Globe, Train } from "lucide-react";
import { differenceInSeconds, differenceInMinutes, differenceInHours, differenceInDays, differenceInWeeks } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { posts as postsApi, users as usersApi } from "../lib/api";
import MediaCarousel from "./MediaCarousel";
import VerifiedBadge from "./VerifiedBadge";
import Avatar from "./Avatar";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useLoginPrompt } from "../hooks/useLoginPrompt";
import { useEngagement } from "../hooks/useEngagement";
import { useState, useEffect } from "react";
import ThreeDotMenu from "./ThreeDotMenu";
import { PostComments } from "./PostComments";

function shortTime(date: Date): string {
  const now = new Date();
  const secs = differenceInSeconds(now, date);
  if (secs < 60) return `${secs}s`;
  const mins = differenceInMinutes(now, date);
  if (mins < 60) return `${mins}m`;
  const hrs = differenceInHours(now, date);
  if (hrs < 24) return `${hrs}h`;
  const days = differenceInDays(now, date);
  if (days < 7) return `${days}d`;
  const weeks = differenceInWeeks(now, date);
  if (weeks < 52) return `${weeks}w`;
  return `${Math.floor(days / 365)}y`;
}

export default function PostCard({ post }: { post: Post }) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const nav = useNavigate();
  const { requireAuth } = useLoginPrompt();
  const { toggleLike, toggleBookmark } = useEngagement();
  const isOwnPost = me?.id === post.author.id;
  const [likeAnim, setLikeAnim] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  // Local state syncs with post prop
  const [localLiked, setLocalLiked] = useState(post.liked ?? false);
  const [localLikeCount, setLocalLikeCount] = useState(post.like_count ?? 0);
  const [localBookmarked, setLocalBookmarked] = useState(post.bookmarked ?? false);

  const captionLimit = 125;

  const deleteMut = useMutation({
    mutationFn: () => postsApi.delete(post.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed"], refetchType: 'active' });
      qc.invalidateQueries({ queryKey: ["userPosts"], refetchType: 'active' });
      qc.invalidateQueries({ queryKey: ["unified_feed"], refetchType: 'active' });
      qc.invalidateQueries({ queryKey: ["user-posts"], refetchType: 'active' });
    },
  });

  // Sync state when post prop updates (after refetch or navigation)
  useEffect(() => {
    setLocalLiked(post.liked ?? false);
    setLocalLikeCount(post.like_count ?? 0);
    setLocalBookmarked(post.bookmarked ?? false);
  }, [post.bookmarked, post.liked, post.like_count]);

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
    onSettled: () => qc.invalidateQueries({ queryKey: ["feed"], refetchType: 'active' }),
  });

  const handleLike = () => {
    if (!requireAuth()) return;
    // Optimistic update
    setLocalLiked((v) => !v);
    setLocalLikeCount((c) => !localLiked ? c + 1 : Math.max(0, c - 1));
    if (!localLiked) {
      setLikeAnim(true);
      setTimeout(() => setLikeAnim(false), 400);
    }
    // Global engagement hook handles the API call + cache invalidation
    // Pass username so profile queries get invalidated too
    toggleLike('post', parseInt(post.id), { username: post.author.username });
  };

  const handleDoubleTap = () => {
    if (!localLiked) handleLike();
  };

  const handleBookmark = () => {
    if (!requireAuth()) return;
    // Optimistic update
    setLocalBookmarked((v) => !v);
    // Global engagement hook handles the API call + cache invalidation
    // Pass username so profile queries get invalidated too
    toggleBookmark(parseInt(post.id), { username: post.author.username });
  };

  const hasLocoInfo = post.loco_class || post.loco_number || post.loco_shed || post.loco_zone;
  const longCaption = post.caption && post.caption.length > captionLimit;

  return (
    <>
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
              className="font-semibold text-[13px] hover:opacity-80 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              {post.author.username}
            </Link>
            {post.author.is_verified && <VerifiedBadge type="blue" size={13} />}
            <span className="text-muted text-[12px]">• {shortTime(new Date(post.created_at))}</span>
            {me && !isOwnPost && (
              <>
                <span className="text-muted text-xs">•</span>
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
            <p className="text-[11px] text-muted leading-tight">{post.location_name}</p>
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
          <div className="flex flex-row items-center gap-4">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 transition-transform active:scale-90 ${likeAnim ? "scale-125" : ""}`}
            >
              <Heart
                size={24}
                className={`transition-colors ${localLiked ? "text-red-500 fill-red-500" : "hover:text-muted"}`}
                fill={localLiked ? "currentColor" : "none"}
              />
              {localLikeCount > 0 && (
                <span className="text-[13px] font-semibold">{localLikeCount.toLocaleString()}</span>
              )}
            </button>
            <button
              onClick={() => { if (requireAuth()) setCommentsOpen(true); }}
              className="flex items-center gap-1.5 hover:text-muted transition-colors"
            >
              <MessageCircle size={24} strokeWidth={1.8} />
              {post.comment_count > 0 && (
                <span className="text-[13px] font-semibold">{post.comment_count.toLocaleString()}</span>
              )}
            </button>
          </div>
          <button
            onClick={handleBookmark}
            className="ml-auto hover:text-muted transition-colors"
          >
            <Bookmark
              size={24}
              strokeWidth={1.8}
              className={localBookmarked ? "fill-white text-white" : ""}
            />
          </button>
        </div>

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
      </div>
    </article>

    <PostComments
      isOpen={commentsOpen}
      onClose={() => setCommentsOpen(false)}
      postId={post.id}
    />
    </>
  );
}
