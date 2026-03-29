import type { Post } from "../types";
import { Heart, MessageCircle, Bookmark, Train, Zap, Hash, Home as HomeIcon, Globe } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { posts as postsApi, users as usersApi } from "../lib/api";
import MediaCarousel from "./MediaCarousel";
import VerifiedBadge from "./VerifiedBadge";
import Avatar from "./Avatar";
import ThreeDotMenu from "./ThreeDotMenu";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export default function PostCard({ post }: { post: Post }) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const nav = useNavigate();
  const isOwnPost = me?.id === post.author.id;

  const deleteMut = useMutation({
    mutationFn: () => postsApi.delete(post.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["userPosts"] });
    },
  });

  const menuOptions = isOwnPost
    ? [
        {
          label: "Delete post",
          danger: true,
          onClick: () => {
            if (window.confirm("Delete this post?")) deleteMut.mutate();
          },
        },
        {
          label: "Copy link",
          onClick: () => navigator.clipboard.writeText(`${window.location.origin}/posts/${post.id}`),
        },
      ]
    : [
        {
          label: "Go to profile",
          onClick: () => nav(`/profile/${post.author.username}`),
        },
        {
          label: "Copy link",
          onClick: () => navigator.clipboard.writeText(`${window.location.origin}/posts/${post.id}`),
        },
        {
          label: "Report",
          danger: true,
          onClick: () => alert("Thanks for your report. We'll review it."),
        },
      ];

  const likeMut = useMutation({
    mutationFn: () =>
      post.liked ? postsApi.unlike(post.id) : postsApi.like(post.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feed"] }),
  });

  const followMut = useMutation({
    mutationFn: () => usersApi.follow(post.author.username),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["feed"] });
      const prev = qc.getQueryData(["feed"]);
      qc.setQueriesData({ queryKey: ["feed"] }, (old: any) => {
        if (!old) return old;
        const updatePages = (pages: any[]) =>
          pages.map((page: any) => ({
            ...page,
            posts: page.posts?.map((p: Post) =>
              p.author.id === post.author.id
                ? { ...p, viewer_followed: !p.viewer_followed }
                : p
            ),
          }));
        if (old.pages) return { ...old, pages: updatePages(old.pages) };
        if (old.posts) return { ...old, posts: old.posts.map((p: Post) => p.author.id === post.author.id ? { ...p, viewer_followed: !p.viewer_followed } : p) };
        return old;
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["feed"], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["feed"] }),
  });

  const hasLocoInfo = post.loco_class || post.loco_number || post.loco_shed || post.loco_zone;

  return (
    <article className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 transition-all hover:border-zinc-700">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar
          src={post.author.avatar_url}
          name={post.author.display_name}
          username={post.author.username}
          size={9}
          linkTo={`/profile/${post.author.username}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              to={`/profile/${post.author.username}`}
              className="font-bold text-sm text-zinc-100 truncate tracking-tight hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {post.author.display_name ?? post.author.username}
            </Link>
            {post.author.is_verified && <VerifiedBadge type="blue" size={13} />}
            {me && !isOwnPost && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); followMut.mutate(); }}
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold border transition-all active:scale-95 ${
                  post.viewer_followed
                    ? "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700"
                    : "bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20"
                }`}
              >
                {post.viewer_followed ? "Following" : "Follow"}
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-black text-zinc-600 uppercase tracking-tighter">
            <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
            {post.location_name && (
              <>
                <span>•</span>
                <span className="text-zinc-500">{post.location_name}</span>
              </>
            )}
          </div>
        </div>
        {post.train_no && (
          <span className="flex items-center gap-1.5 text-[10px] font-black bg-orange-500/10 text-orange-500 border border-orange-500/20 px-2 py-1 rounded-lg uppercase tracking-widest shadow-[0_0_15px_rgba(249,115,22,0.1)]">
            <Train size={10} />
            {post.train_no}
          </span>
        )}
        {me && <ThreeDotMenu options={menuOptions} />}
      </div>

      {/* Media Carousel */}
      <MediaCarousel mediaKeys={post.media_keys} />

      {/* Caption & Technical Report */}
      <div className="px-4 pt-3 space-y-3">
        {post.caption && (
          <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">{post.caption}</p>
        )}

        {hasLocoInfo && (
          <div className="bg-zinc-950/50 rounded-2xl p-4 border border-zinc-800/50 space-y-3">
            <div className="flex items-center gap-2 mb-1">
               <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
               <p className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">Locomotive Spotting Report</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               {post.loco_class && (
                 <div className="flex items-center gap-2">
                    <Zap size={14} className="text-orange-500" />
                    <div>
                       <p className="text-[9px] font-black text-zinc-600 uppercase">Class</p>
                       <p className="text-xs font-bold text-zinc-200">{post.loco_class}</p>
                    </div>
                 </div>
               )}
               {post.loco_number && (
                 <div className="flex items-center gap-2">
                    <Hash size={14} className="text-orange-500" />
                    <div>
                       <p className="text-[9px] font-black text-zinc-600 uppercase">Road No</p>
                       <p className="text-xs font-bold text-zinc-200">{post.loco_number}</p>
                    </div>
                 </div>
               )}
               {post.loco_shed && (
                 <div className="flex items-center gap-2">
                    <HomeIcon size={14} className="text-orange-500" />
                    <div>
                       <p className="text-[9px] font-black text-zinc-600 uppercase">Homing Shed</p>
                       <p className="text-xs font-bold text-zinc-200">{post.loco_shed}</p>
                    </div>
                 </div>
               )}
               {post.loco_zone && (
                 <div className="flex items-center gap-2">
                    <Globe size={14} className="text-orange-500" />
                    <div>
                       <p className="text-[9px] font-black text-zinc-600 uppercase">Zone</p>
                       <p className="text-xs font-bold text-zinc-200">{post.loco_zone}</p>
                    </div>
                 </div>
               )}
            </div>
          </div>
        )}
      </div>

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
