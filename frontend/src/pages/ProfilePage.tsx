import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { users as usersApi, gamification as gamApi } from "../lib/api";
import type { Post, UserProfileOut } from "../types";
import PostCard from "../components/PostCard";
import { useAuthStore } from "../store/authStore";
import { 
  ArrowLeft, UserPlus, UserMinus, Loader, User as UserIcon, 
  Settings, MapPin, Milestone, Zap 
} from "lucide-react";
import { Link } from "react-router-dom";
import VerifiedBadge from "../components/VerifiedBadge";

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);

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

  const followMut = useMutation({
    mutationFn: () =>
      profile?.is_following
        ? usersApi.unfollow(username!)
        : usersApi.follow(username!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile", username] }),
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
        <div className="grid grid-cols-3 divide-x divide-zinc-800 mt-4 text-center">
          {[
            { label: "Posts",     value: profile.post_count     },
            { label: "Followers", value: profile.follower_count },
            { label: "Karma",     value: profile.karma          },
          ].map(({ label, value }) => (
            <div key={label} className="px-2 py-1">
              <p className="font-bold text-lg text-zinc-100">{(value ?? 0).toLocaleString()}</p>
              <p className="text-xs text-zinc-500">{label}</p>
            </div>
          ))}
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

      {/* Posts grid */}
      <div className="flex flex-col gap-4">
        {(Array.isArray(userPosts) ? userPosts : []).map((p) => <PostCard key={p.id} post={p} />)}
        {Array.isArray(userPosts) && userPosts.length === 0 && (
          <p className="text-center text-zinc-500 text-sm py-8">No posts yet.</p>
        )}
      </div>
    </div>
  );
}
