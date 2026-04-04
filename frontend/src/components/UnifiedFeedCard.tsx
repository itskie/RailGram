import type { UnifiedFeedItem } from "../types";
import { Heart, MessageCircle, Bookmark, Send, Zap, Hash, Home as HomeIcon, Globe, Train, Play } from "lucide-react";
import { differenceInSeconds, differenceInMinutes, differenceInHours, differenceInDays, differenceInWeeks } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { posts as postsApi, users as usersApi, reels as reelsApi } from "../lib/api";
import MediaCarousel from "./MediaCarousel";
import VerifiedBadge from "./VerifiedBadge";
import Avatar from "./Avatar";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useLoginPrompt } from "../hooks/useLoginPrompt";
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "./ConfirmDialog";
import { ReportModal } from "./ReportModal";
import ThreeDotMenu from "./ThreeDotMenu";
import { CommentsModal } from "./CommentsModal";
import { LikesModal } from "./LikesModal";
import { usePostLike, usePostBookmark, useReelLike, useReelSave } from "../hooks/useEngagement";
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
  const [localViews, setLocalViews] = useState(item.views || 0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [likesOpen, setLikesOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);
  const [localCommentCount, setLocalCommentCount] = useState(
    isReel ? (item.comments_count || 0) : (item.comment_count || 0)
  );
  const reelContainerRef = useRef<HTMLDivElement>(null);
  const [isReelActive, setIsReelActive] = useState(false);
  const captionLimit = 125;

  // Global engagement hooks
  const postLike = usePostLike(item.id, item.viewer_liked ?? false, item.like_count ?? 0, item.author.username);
  const reelLike = useReelLike(item.id, item.viewer_liked ?? false, item.likes_count ?? 0, item.author.username);
  const postBookmark = usePostBookmark(item.id, item.viewer_bookmarked ?? false);
  const reelSave = useReelSave(item.id, item.viewer_saved ?? false);

  const liked = isReel ? reelLike.liked : postLike.liked;
  const likeCount = isReel ? reelLike.count : postLike.count;
  const bookmarked = isReel ? reelSave.saved : postBookmark.bookmarked;
  const toggleLikeAction = isReel ? reelLike.toggle : postLike.toggle;
  const toggleBookmarkAction = isReel ? reelSave.toggle : postBookmark.toggle;

  // Post mutations
  const deletePostMut = useMutation({
    mutationFn: () => postsApi.delete(item.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unified_feed"], refetchType: 'active' });
      qc.invalidateQueries({ queryKey: ["user-posts"], refetchType: 'active' });
    },
  });

  // Reel mutations
  const deleteReelMut = useMutation({
    mutationFn: () => reelsApi.delete(item.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unified_feed"], refetchType: 'active' });
      qc.invalidateQueries({ queryKey: ["user-reels"], refetchType: 'active' });
      qc.invalidateQueries({ queryKey: ["reels"], refetchType: 'active' });
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
    if (!liked) { setLikeAnim(true); setTimeout(() => setLikeAnim(false), 400); }
    toggleLikeAction();
  };

  const handleDelete = useCallback(() => {
    if (isReel) deleteReelMut.mutate();
    else deletePostMut.mutate();
    setConfirmOpen(false);
  }, [isReel, deleteReelMut, deletePostMut]);

  const menuOptions = isOwnItem
    ? [
        { label: `Delete ${isReel ? 'reel' : 'post'}`, danger: true, onClick: () => setConfirmOpen(true) },
        { label: "Copy link", onClick: () => { navigator.clipboard.writeText(`${window.location.origin}/${isReel ? 'reels' : 'posts'}/${item.id}`); setToast("Link copied!"); } },
      ]
    : [
        { label: "Go to profile", onClick: () => nav(`/profile/${item.author.username}`) },
        { label: "Copy link", onClick: () => { navigator.clipboard.writeText(`${window.location.origin}/${isReel ? 'reels' : 'posts'}/${item.id}`); setToast("Link copied!"); } },
        { label: "Report", danger: true, onClick: () => setReportOpen(true) },
      ];

  const hasLocoInfo = !isReel && (item.loco_class || item.loco_number || item.loco_shed || item.loco_zone);
  const longCaption = !isReel && item.caption && item.caption.length > captionLimit;

  useEffect(() => {
    if (!isReel) return;

    const el = reelContainerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Keep one dominant reel active in feed to avoid overlapping audio.
          setIsReelActive(entry.intersectionRatio >= 0.7);
        });
      },
      {
        root: null,
        threshold: [0.7],
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isReel, item.id]);

  return (
    <>
      <article className="rounded-2xl overflow-hidden border border-zinc-800/40 group mb-4 bg-black">
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
                className="font-bold text-[13px] hover:opacity-80 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                {item.author.username}
              </Link>
              {item.author.is_verified && <VerifiedBadge type="blue" size={13} />}
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
            <Link
              to={`/trains/${item.train_no}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[10px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-md hover:bg-orange-500/20 transition-colors"
              style={{ boxShadow: 'var(--glow-orange-sm)' }}
            >
              <Train size={9} />
              {item.train_no}
            </Link>
          )}
          {isReel && item.train_number && (
            <Link
              to={`/trains/${item.train_number}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[10px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-md hover:bg-orange-500/20 transition-colors"
              style={{ boxShadow: 'var(--glow-orange-sm)' }}
            >
              <Train size={9} />
              {item.train_number}
            </Link>
          )}
          {isReel && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md" style={{ boxShadow: '0 0 8px rgba(168,85,247,0.4)' }}>
              <Play size={9} />
              Reel
            </span>
          )}
          <ThreeDotMenu options={menuOptions} />
        </div>

        {/* Content */}
        {isReel ? (
          /* Reel Content */
          <div ref={reelContainerRef} className="relative w-full aspect-[9/16] max-h-[500px] bg-black">
            <ReelPlayer
              hlsUrl={item.hls_url ?? null}
              thumbnailUrl={item.reel_thumbnail_url ?? null}
              isActive={isReelActive}
              onRecordView={(secs) => {
                reelsApi.view(item.id, secs);
                setLocalViews((v) => v + 1);
              }}
              onDoubleTap={handleLike}
            />
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
              <div className={`flex items-center gap-1.5 transition-transform ${likeAnim ? "scale-125" : ""}`}>
                <button
                  onClick={handleLike}
                  className="active:scale-90 transition-transform"
                >
                  <Heart
                    size={24}
                    className={`transition-colors ${liked ? "text-red-500 fill-red-500" : "hover:text-muted"}`}
                    fill={liked ? "currentColor" : "none"}
                  />
                </button>
                {likeCount > 0 && (
                  <span
                    className="text-[13px] font-semibold cursor-pointer hover:underline"
                    onClick={() => setLikesOpen(true)}
                  >
                    {likeCount.toLocaleString()}
                  </span>
                )}
              </div>
              <button
                onClick={() => { if (requireAuth()) setCommentsOpen(true); }}
                className="flex items-center gap-1.5 hover:text-muted transition-colors"
              >
                <MessageCircle size={24} strokeWidth={1.8} />
                <span className="text-[13px] font-semibold">
                  {localCommentCount.toLocaleString()}
                </span>
              </button>
              <button
                onClick={async () => {
                  try {
                    const targetUrl = isReel
                      ? `${window.location.origin}/reels/${item.id}`
                      : `${window.location.origin}/profile/${item.author.username}`;
                    if (navigator.share) {
                      await navigator.share({ url: targetUrl });
                    } else {
                      await navigator.clipboard.writeText(targetUrl);
                    }
                  } catch {}
                }}
                className="flex items-center gap-1.5 hover:text-muted transition-colors"
              >
                <Send size={22} strokeWidth={1.8} />
              </button>
            </div>
            {/* Save/Bookmark — right side */}
            <button
              onClick={() => {
                if (!requireAuth()) return;
                toggleBookmarkAction();
              }}
              className="ml-auto hover:text-muted transition-colors"
            >
              <Bookmark
                size={24}
                strokeWidth={1.8}
                className={bookmarked ? "fill-white text-white" : ""}
              />
            </button>
          </div>

          {/* Caption / Description */}
          {!isReel && item.caption && (
            <p className="text-[13px] text-zinc-100 leading-snug">
              <Link
                to={`/profile/${item.author.username}`}
                className="font-bold text-white mr-1.5 hover:opacity-80"
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
                className="font-bold text-white mr-1.5 hover:opacity-80"
              >
                {item.author.username}
              </Link>
              {item.description}
            </p>
          )}

          {/* Loco info */}
          {!isReel && hasLocoInfo && (
            <div className="mt-2 bg-zinc-950 rounded-xl px-3 py-2.5 border border-zinc-800/50 space-y-2">
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

          {/* Reel Stats - Only visible to owner */}
          {isReel && isOwnItem && (
            <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
              <span className="font-semibold">{localViews.toLocaleString()} views</span>
            </div>
          )}
        </div>
      </article>

      <LikesModal
        type={isReel ? 'reel' : 'post'}
        entityId={item.id}
        isOpen={likesOpen}
        onClose={() => setLikesOpen(false)}
      />
      {/* Comments Modal */}
      <CommentsModal
        type={isReel ? 'reel' : 'post'}
        entityId={item.id}
        isOpen={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        onCommentCountChange={setLocalCommentCount}
      />
      <ConfirmDialog
        isOpen={confirmOpen}
        title={`Delete this ${isReel ? 'reel' : 'post'}?`}
        message="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />

      {reportOpen && (
        <ReportModal
          postId={isReel ? undefined : item.id}
          reelId={isReel ? item.id : undefined}
          onClose={() => setReportOpen(false)}
        />
      )}
      {toast && createPortal(
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-xl z-110 border border-zinc-700 whitespace-nowrap">
          {toast}
        </div>,
        document.body
      )}
    </>
  );
}
