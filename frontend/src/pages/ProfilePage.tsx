import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { users as usersApi, gamification as gamApi, posts as postsApi, reels as reelsApi } from "../lib/api";
import type { Post, UserProfileOut, UserBrief } from "../types";
import type { ReelFeedResponse } from "../features/reels/types/reel";
import PostCard from "../components/PostCard";
import { ReelCard } from "../features/reels/components/ReelCard";
import { useAuthStore } from "../store/authStore";
import { useState } from "react";
import {
  ArrowLeft, UserPlus, UserMinus, Loader, User as UserIcon,
  Settings, MapPin, Milestone, Zap, X, Grid3X3, Bookmark, Clapperboard,
  Lock
} from "lucide-react";
import VerifiedBadge from "../components/VerifiedBadge";

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [listModal, setListModal] = useState<"followers" | "following" | null>(null);
  const [activeTab, setActiveTab] = useState<"posts" | "reels" | "saved">("posts");

  const { data: profile, isLoading } = useQuery<UserProfileOut>({
    queryKey: ["profile", username],
    queryFn: () => usersApi.profile(username!) as Promise<UserProfileOut>,
    enabled: !!username,
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["user-stats", username],
    queryFn: () => gamApi.stats(username!) as Promise<any>,
    enabled: !!username,
  });

  const { data: userPosts } = useQuery<Post[]>({
    queryKey: ["user-posts", username],
    queryFn: async () => {
      const r = await usersApi.posts(username!) as { posts?: Post[] } | Post[];
      if (Array.isArray(r)) return r;
      return r.posts ?? [];
    },
    enabled: !!username,
  });

  const { data: userReels } = useQuery<ReelFeedResponse | null>({
    queryKey: ["user-reels", username],
    queryFn: async () => {
      if (!profile?.id) return null;
      return await reelsApi.user(profile.id) as ReelFeedResponse;
    },
    enabled: !!profile?.id,
  });

  const { data: savedPosts } = useQuery<Post[]>({
    queryKey: ["saved-posts"],
    queryFn: async () => {
      const r = await postsApi.bookmarked() as { posts?: Post[] };
      return r.posts ?? [];
    },
    enabled: me?.username === username && activeTab === "saved",
  });

  const { data: savedReels } = useQuery<ReelFeedResponse | null>({
    queryKey: ["saved-reels"],
    queryFn: async () => {
      return await reelsApi.saved() as ReelFeedResponse;
    },
    enabled: me?.username === username && activeTab === "saved",
  });

  const followMut = useMutation({
    mutationFn: () =>
      profile?.is_following
        ? usersApi.unfollow(username!)
        : usersApi.follow(username!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile", username] }),
  });

  const { data: modalList, isLoading: modalLoading } = useQuery<UserBrief[]>({
    queryKey: ["user-list", username, listModal],
    queryFn: () =>
      listModal === "followers"
        ? usersApi.followers(username!) as Promise<UserBrief[]>
        : usersApi.following(username!) as Promise<UserBrief[]>,
    enabled: !!listModal && !!username,
  });

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader className="animate-spin text-orange-400" /></div>;
  }

  if (!profile) {
    return <div className="p-4 text-zinc-400">User not found.</div>;
  }

  const isMe = me?.username === username;

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 mb-4">
        <ArrowLeft size={15} /> Back
      </button>

      {/* Profile header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-zinc-700 overflow-hidden flex-shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} className="w-full h-full object-cover" alt={profile.username} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">
                <UserIcon size={28} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg leading-none truncate">
                {profile.display_name ?? profile.username}
              </h1>
              {profile.is_verified && <VerifiedBadge type="blue" size={14} />}
              {profile.is_private && (
                <div className="w-5 h-5 bg-zinc-700 rounded-full flex items-center justify-center" title="Private Account">
                  <Lock size={12} className="text-zinc-300" />
                </div>
              )}
            </div>
            <p className="text-sm text-zinc-400 mt-1">@{profile.username}</p>
            {profile.bio && <p className="text-sm text-zinc-300 mt-2 leading-relaxed">{profile.bio}</p>}
            
            <div className="flex flex-wrap gap-2 mt-3">
              {profile.favourite_train && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-teal-500/10 border border-teal-500/20 rounded-full text-[10px] font-bold text-teal-500 uppercase tracking-tight">
                  <Milestone size={10} /> {profile.favourite_train}
                </div>
              )}
              {profile.home_station && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded-full text-[10px] font-bold text-orange-500 uppercase tracking-tight">
                  <MapPin size={10} /> {profile.home_station}
                </div>
              )}
              {stats && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-[10px] font-bold text-yellow-500 uppercase tracking-tight">
                  <Zap size={10} /> {stats.karma} Karma
                </div>
              )}
            </div>

            {/* Badges Ribbon */}
            {stats?.badges && stats.badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {stats.badges.filter((b: any) => b.earned_at).map((b: any) => (
                  <div 
                    key={b.id} 
                    title={b.name}
                    className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-lg hover:scale-110 transition-transform cursor-help shadow-lg shadow-black"
                  >
                    {b.icon}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 divide-x divide-zinc-800 mt-4 text-center">
          <div className="px-2 py-1">
            <p className="font-bold text-lg text-zinc-100">{(profile.post_count ?? 0).toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Posts</p>
          </div>
          <button
            onClick={() => setListModal("followers")}
            className="px-2 py-1 hover:bg-zinc-800/50 transition-colors cursor-pointer"
          >
            <p className="font-bold text-lg text-zinc-100">{(profile.follower_count ?? 0).toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Followers</p>
          </button>
          <button
            onClick={() => setListModal("following")}
            className="px-2 py-1 hover:bg-zinc-800/50 transition-colors cursor-pointer"
          >
            <p className="font-bold text-lg text-zinc-100">{(profile.following_count ?? 0).toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Following</p>
          </button>
          <div className="px-2 py-1">
            <p className="font-bold text-lg text-zinc-100">{(profile.karma ?? 0).toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Karma</p>
          </div>
        </div>

        {/* Action button */}
        {isMe ? (
          <Link
            to="/profile/edit"
            className="mt-5 w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-all border border-zinc-700 shadow-lg active:scale-[0.98]"
          >
            <Settings size={15} /> Edit Profile
          </Link>
        ) : (
          <button
            onClick={() => followMut.mutate()}
            disabled={followMut.isPending}
            className={`mt-5 w-full rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-all border shadow-lg active:scale-[0.98] disabled:opacity-50 ${
              profile.is_following
                ? "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                : "bg-orange-500 hover:bg-orange-600 text-white border-orange-400"
            }`}
          >
            {profile.is_following ? <><UserMinus size={15} /> Unfollow</> : <><UserPlus size={15} /> Follow</>}
          </button>
        )}
      </div>

      {/* Tabs — only show Saved on own profile */}
      {isMe && (
        <div className="flex border-b border-zinc-800 mb-4">
          <button
            onClick={() => setActiveTab("posts")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
              activeTab === "posts" ? "text-white border-b-2 border-orange-500" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Grid3X3 size={16} /> Posts
          </button>
          <button
            onClick={() => setActiveTab("reels")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
              activeTab === "reels" ? "text-white border-b-2 border-orange-500" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Clapperboard size={16} /> Reels
          </button>
          <button
            onClick={() => setActiveTab("saved")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
              activeTab === "saved" ? "text-white border-b-2 border-orange-500" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Bookmark size={16} /> Saved
          </button>
        </div>
      )}

      {/* Posts / Reels / Saved grid */}
      <div className="flex flex-col gap-4">
        {activeTab === "posts" && (
          <>
            {(Array.isArray(userPosts) ? userPosts : []).map((p) => <PostCard key={p.id} post={p} />)}
            {Array.isArray(userPosts) && userPosts.length === 0 && (
              <p className="text-center text-zinc-500 text-sm py-8">No posts yet.</p>
            )}
          </>
        )}
        {activeTab === "reels" && (
          <>
            {(userReels?.items ?? []).map((r) => <ReelCard key={r.id} reel={r} />)}
            {(!userReels?.items || userReels.items.length === 0) && (
              <p className="text-center text-zinc-500 text-sm py-8">No reels yet.</p>
            )}
          </>
        )}
        {activeTab === "saved" && (
          <>
            {/* Saved Posts */}
            {(Array.isArray(savedPosts) ? savedPosts : []).map((p) => <PostCard key={p.id} post={p} />)}
            {Array.isArray(savedPosts) && savedPosts.length === 0 && (
              <p className="text-center text-zinc-500 text-sm py-8">No saved posts yet.</p>
            )}
            {/* Saved Reels */}
            {(savedReels?.items ?? []).map((r) => <ReelCard key={r.id} reel={r} />)}
            {(!savedReels?.items || savedReels.items.length === 0) && (
              <p className="text-center text-zinc-500 text-sm py-8">No saved reels yet.</p>
            )}
          </>
        )}
      </div>

      {/* Followers / Following Modal */}
      {listModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setListModal(null)}
        >
          <div
            className="w-full sm:max-w-sm bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h2 className="font-bold text-sm text-zinc-100 capitalize">{listModal}</h2>
              <button onClick={() => setListModal(null)} className="text-zinc-400 hover:text-zinc-200">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 py-2">
              {modalLoading && (
                <div className="flex justify-center py-8"><Loader className="animate-spin text-orange-400" /></div>
              )}
              {!modalLoading && (!modalList || modalList.length === 0) && (
                <p className="text-center text-zinc-500 text-sm py-8">No {listModal} yet.</p>
              )}
              {modalList?.map((u) => (
                <Link
                  key={u.id}
                  to={`/profile/${u.username}`}
                  onClick={() => setListModal(null)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-zinc-700 overflow-hidden shrink-0">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-400">
                        {u.display_name?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-100 truncate">{u.display_name ?? u.username}</p>
                    <p className="text-xs text-zinc-500">@{u.username}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
