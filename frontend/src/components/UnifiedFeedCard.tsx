import type { UnifiedFeedItem } from "../types";
import { Heart, MessageCircle, Bookmark, Zap, Hash, Home as HomeIcon, Globe, Train, Play, MessageSquare } from "lucide-react";
import { differenceInSeconds, differenceInMinutes, differenceInHours, differenceInDays, differenceInWeeks } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { posts as postsApi, users as usersApi, reels as reelsApi } from "../lib/api";
import MediaCarousel from "./MediaCarousel";
import VerifiedBadge from "./VerifiedBadge";
import Avatar from "./Avatar";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useLoginPrompt } from "../hooks/useLoginPrompt";
import { useState } from "react";
import ThreeDotMenu from "./ThreeDotMenu";
import { PostComments } from "./PostComments";
import { ReelComments } from "../features/reels/components/ReelComments";
import { ReelPlayer } from "../features/reels/components/ReelPlayer";

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

interface UnifiedFeedCardProps {
  item: UnifiedFeedItem;
}

export default function UnifiedFeedCard({ item }: UnifiedFeedCardProps) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const nav = useNavigate();
  const { requireAuth } = useLoginPrompt();
  const isOwnItem = me?.id === item.author.id;
  const isReel = item.item_type === "reel";
  const [likeAnim, setLikeAnim] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [localLiked, setLocalLiked] = useState(item.viewer_liked ?? false);
  const [localLikeCount, setLocalLikeCount] = useState(isReel ? (item.likes_count || 0) : (item.like_count || 0));
  const [localBookmarked, setLocalBookmarked] = useState(isReel ? (item.viewer_saved ?? false) : (item.viewer_bookmarked ?? false));
  const [localViews, setLocalViews] = useState(item.views || 0);
  const captionLimit = 125;

  // Post mutations with optimistic updates
  const deletePostMut = useMutation({
    mutationFn: () => postsApi.delete(item.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unified_feed"], refetchType: 'none' });
    },
  });

  const likePostMut = useMutation({
    mutationFn: async () => {
      const res = await postsApi.like(item.id);
      return res as { liked: boolean };
    },
    onSuccess: (data) => {
      setLocalLiked(data.liked);
      qc.invalidateQueries({ queryKey: ["unified_feed"], refetchType: 'none' });
    },
    onError: () => {
      setLocalLiked((v) => !v);
      setLocalLikeCount((c) => localLiked ? Math.max(0, c - 1) : c + 1);
    },
  });

  const bookmarkMut = useMutation({
    mutationFn: async () => {
      const res = await postsApi.bookmark(item.id);
      return res as { bookmarked: boolean };
    },
    onSuccess: (data) => {
      setLocalBookmarked(data.bookmarked);
      qc.invalidateQueries({ queryKey: ["unified_feed"], refetchType: 'none' });
      qc.invalidateQueries({ queryKey: ["saved-posts"], refetchType: 'none' });
    },
    onError: () => {
      setLocalBookmarked((v) => !v);
    },
  });

  // Reel mutations with optimistic updates
  const deleteReelMut = useMutation({
    mutationFn: () => reelsApi.delete(item.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unified_feed"], refetchType: 'none' });
    },
  });

  const toggleReelLikeMut = useMutation({
    mutationFn: async (currentlyLiked: boolean) => {
      if (currentlyLiked) {
        await reelsApi.unlike(item.id);
        return { liked: false };
      } else {
        const res = await reelsApi.like(item.id);
        return (res as { liked: boolean }) ?? { liked: true };
      }
    },
    onSuccess: (data) => {
      setLocalLiked(data.liked);
      setLocalLikeCount((c) => data.liked ? c + 1 : Math.max(0, c - 1));
      qc.invalidateQueries({ queryKey: ["unified_feed"], refetchType: 'none' });
    },
    onError: () => {
      setLocalLiked((v) => !v);
      setLocalLikeCount((c) => localLiked ? Math.max(0, c - 1) : c + 1);
    },
  });

  const saveReelMut = useMutation({
    mutationFn: async () => {
      await reelsApi.save(item.id);
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["unified_feed"] });
      const previous = qc.getQueryData(["unified_feed"]);
      
      qc.setQueryData(["unified_feed"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages?.map((page: any) => ({
            ...page,
            items: page.items?.map((i: UnifiedFeedItem) => {
              if (i.id === item.id && i.item_type === "reel") {
                return {
                  ...i,
                  viewer_saved: true,
                  saves_count: i.saves_count || 0 + 1,
                };
              }
              return i;
            }),
          })),
        };
      });
      
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(["unified_feed"], context.previous);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unified_feed"], refetchType: 'none' });
    },
  });

  const unsaveReelMut = useMutation({
    mutationFn: async () => {
      await reelsApi.unsave(item.id);
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["unified_feed"] });
      const previous = qc.getQueryData(["unified_feed"]);
      
      qc.setQueryData(["unified_feed"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages?.map((page: any) => ({
            ...page,
            items: page.items?.map((i: UnifiedFeedItem) => {
              if (i.id === item.id && i.item_type === "reel") {
                return {
                  ...i,
                  viewer_saved: false,
                  saves_count: Math.max(0, i.saves_count || 0 - 1),
                };
              }
              return i;
            }),
          })),
        };
      });
      
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(["unified_feed"], context.previous);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unified_feed"], refetchType: 'none' });
    },
  });

  // Follow mutation
  const followMut = useMutation({
    mutationFn: () => usersApi.follow(item.author.username),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["unified_feed"] });
      const prev = qc.getQueryData(["unified_feed"]);
      qc.setQueriesData({ queryKey: ["unified_feed"] }, (old: any) => {
        if (!old) return old;
        const update = (pages: any[]) =>
          pages.map((page: any) => ({
            ...page,
            items: page.items?.map((i: UnifiedFeedItem) =>
              i.author.id === item.author.id ? { ...i, viewer_followed: !i.viewer_followed } : i
            ),
          }));
        if (old.pages) return { ...old, pages: update(old.pages) };
        if (old.items) return { ...old, items: old.items.map((i: UnifiedFeedItem) => i.author.id === item.author.id ? { ...i, viewer_followed: !i.viewer_followed } : i) };
        return old;
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["unified_feed"], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["unified_feed"] }),
  });

  const handleLike = () => {
    if (!requireAuth()) return;
    if (isReel) {
      if (!localLiked) {
        setLikeAnim(true);
        setTimeout(() => setLikeAnim(false), 400);
      }
      setLocalLiked((v) => !v);
      setLocalLikeCount((c) => localLiked ? Math.max(0, c - 1) : c + 1);
      toggleReelLikeMut.mutate(localLiked);
    } else {
      if (!localLiked) {
        setLikeAnim(true);
        setTimeout(() => setLikeAnim(false), 400);
      }
      setLocalLiked((v) => !v);
      setLocalLikeCount((c) => localLiked ? Math.max(0, c - 1) : c + 1);
      likePostMut.mutate();
    }
  };

  const handleSave = () => {
    if (!requireAuth()) return;
    if (localBookmarked) {
      setLocalBookmarked(false);
      unsaveReelMut.mutate();
    } else {
      setLocalBookmarked(true);
      saveReelMut.mutate();
    }
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete this ${isReel ? 'reel' : 'post'}?`)) return;
    if (isReel) {
      deleteReelMut.mutate();
    } else {
      deletePostMut.mutate();
    }
  };

  const menuOptions = isOwnItem
    ? [
        { label: `Delete ${isReel ? 'reel' : 'post'}`, danger: true, onClick: handleDelete },
        { label: "Copy link", onClick: () => navigator.clipboard.writeText(`${window.location.origin}/${isReel ? 'reels' : 'posts'}/${item.id}`) },
      ]
    : [
        { label: "Go to profile", onClick: () => nav(`/profile/${item.author.username}`) },
        { label: "Copy link", onClick: () => navigator.clipboard.writeText(`${window.location.origin}/${isReel ? 'reels' : 'posts'}/${item.id}`) },
        { label: "Report", danger: true, onClick: () => alert("Thanks for your report. We'll review it.") },
      ];

  const hasLocoInfo = !isReel && (item.loco_class || item.loco_number || item.loco_shed || item.loco_zone);
  const longCaption = !isReel && item.caption && item.caption.length > captionLimit;

  return (
    <>
      <article className="rounded-2xl overflow-hidden border border-zinc-800/60 group mb-4 bg-zinc-900/30">
        {/* Header */}
        <div className="flex items-center gap-3 px-3 py-3">
          <Avatar
            src={item.author.avatar_url}
            name={item.author.display_name}
            username={item.author.username}
            size={10}
            linkTo={`/profile/${item.author.username}`}
            className="ring-2 ring-orange-500/30"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link
                to={`/profile/${item.author.username}`}
                className="font-semibold text-[13px] hover:opacity-80 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                {item.author.username}
              </Link>
              {me?.is_verified && <VerifiedBadge type="blue" size={13} />}
              <span className="text-muted text-[12px]">• {shortTime(new Date(item.created_at))}</span>
              {me && !isOwnItem && (
                <>
                  <span className="text-muted text-xs">•</span>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (requireAuth()) followMut.mutate(); }}
                    className="text-[13px] font-semibold text-orange-400 hover:text-orange-300 transition-colors"
                  >
                    {item.viewer_followed ? "Following" : "Follow"}
                  </button>
                </>
              )}
            </div>
            {!isReel && item.location_name && (
              <p className="text-[11px] text-muted leading-tight">{item.location_name}</p>
            )}
          </div>
          {!isReel && item.train_no && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-md">
              <Train size={9} />
              {item.train_no}
            </span>
          )}
          {isReel && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md">
              <Play size={9} />
              Reel
            </span>
          )}
          <ThreeDotMenu options={menuOptions} />
        </div>

        {/* Content */}
        {isReel ? (
          /* Reel Content */
          <div className="relative w-full aspect-[9/16] max-h-[500px] bg-black">
            <ReelPlayer
              hlsUrl={item.hls_url ?? null}
              thumbnailUrl={item.reel_thumbnail_url ?? null}
              isActive={true}
              onRecordView={(secs) => {
                reelsApi.view(item.id, secs);
                setLocalViews((v) => v + 1);
              }}
            />
            {/* Reel Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
              {item.title && (
                <p className="text-white font-semibold text-sm mb-1">{item.title}</p>
              )}
              {item.description && (
                <p className="text-zinc-300 text-xs line-clamp-2">{item.description}</p>
              )}
            </div>
          </div>
        ) : (
          /* Post Content */
          <MediaCarousel mediaKeys={item.media_keys || []} onDoubleTap={handleLike} />
        )}

        {/* Actions */}
        <div className="px-3 pt-2.5 pb-1">
          <div className="flex items-center mb-2">
            {/* Like + Comment — left side */}
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
                <span className="text-[13px] font-semibold">
                  {localLikeCount.toLocaleString()}
                </span>
              </button>
              <button
                onClick={() => { if (requireAuth()) setCommentsOpen(true); }}
                className="flex items-center gap-1.5 hover:text-muted transition-colors"
              >
                {isReel ? <MessageSquare size={24} strokeWidth={1.8} /> : <MessageCircle size={24} strokeWidth={1.8} />}
                <span className="text-[13px] font-semibold">
                  {isReel ? (item.comments_count || 0).toLocaleString() : (item.comment_count || 0).toLocaleString()}
                </span>
              </button>
            </div>
            {/* Save/Bookmark — right side */}
            <button
              onClick={() => {
                if (!requireAuth()) return;
                if (isReel) {
                  handleSave();
                } else {
                  setLocalBookmarked((v) => !v);
                  bookmarkMut.mutate();
                }
              }}
              className="ml-auto hover:text-muted transition-colors"
            >
              <Bookmark
                size={24}
                strokeWidth={1.8}
                className={localBookmarked ? "fill-white" : ""}
              />
            </button>
          </div>

          {/* Caption / Description */}
          {!isReel && item.caption && (
            <p className="text-[13px] text-zinc-100 leading-snug">
              <Link
                to={`/profile/${item.author.username}`}
                className="font-semibold text-white mr-1.5 hover:opacity-80"
              >
                {item.author.username}
              </Link>
              {captionExpanded || !longCaption
                ? item.caption
                : item.caption.slice(0, captionLimit) + "… "}
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

          {isReel && item.description && (
            <p className="text-[13px] text-zinc-100 leading-snug">
              <Link
                to={`/profile/${item.author.username}`}
                className="font-semibold text-white mr-1.5 hover:opacity-80"
              >
                {item.author.username}
              </Link>
              {item.description}
            </p>
          )}

          {/* Loco info */}
          {!isReel && hasLocoInfo && (
            <div className="mt-2 bg-zinc-900 rounded-xl px-3 py-2.5 border border-zinc-800 space-y-2">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                <p className="text-[9px] font-black uppercase text-zinc-500 tracking-[0.2em]">Loco Spotting Report</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {item.loco_class && (
                  <div className="flex items-center gap-1.5">
                    <Zap size={11} className="text-orange-500 shrink-0" />
                    <div>
                      <p className="text-[9px] font-black text-zinc-600 uppercase">Class</p>
                      <p className="text-[11px] font-bold text-zinc-200">{item.loco_class}</p>
                    </div>
                  </div>
                )}
                {item.loco_number && (
                  <div className="flex items-center gap-1.5">
                    <Hash size={11} className="text-orange-500 shrink-0" />
                    <div>
                      <p className="text-[9px] font-black text-zinc-600 uppercase">Road No</p>
                      <p className="text-[11px] font-bold text-zinc-200">{item.loco_number}</p>
                    </div>
                  </div>
                )}
                {item.loco_shed && (
                  <div className="flex items-center gap-1.5">
                    <HomeIcon size={11} className="text-orange-500 shrink-0" />
                    <div>
                      <p className="text-[9px] font-black text-zinc-600 uppercase">Shed</p>
                      <p className="text-[11px] font-bold text-zinc-200">{item.loco_shed}</p>
                    </div>
                  </div>
                )}
                {item.loco_zone && (
                  <div className="flex items-center gap-1.5">
                    <Globe size={11} className="text-orange-500 shrink-0" />
                    <div>
                      <p className="text-[9px] font-black text-zinc-600 uppercase">Zone</p>
                      <p className="text-[11px] font-bold text-zinc-200">{item.loco_zone}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reel Stats */}
          {isReel && (
            <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
              <span className="font-semibold">{localViews.toLocaleString()} views</span>
            </div>
          )}
        </div>
      </article>

      {/* Comments Modal */}
      {isReel ? (
        <ReelComments
          reelId={item.id}
          isOpen={commentsOpen}
          onClose={() => setCommentsOpen(false)}
        />
      ) : (
        <PostComments
          isOpen={commentsOpen}
          onClose={() => setCommentsOpen(false)}
          postId={item.id}
        />
      )}
    </>
  );
}
