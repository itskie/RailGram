import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { users as usersApi } from "../lib/api";
import type { User, Post } from "../types";
import PostCard from "../components/PostCard";
import { useAuthStore } from "../store/authStore";
import { ArrowLeft, UserPlus, UserMinus, Loader, User as UserIcon } from "lucide-react";

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);

  const { data: profile, isLoading } = useQuery<User & { is_following?: boolean }>({
    queryKey: ["profile", username],
    queryFn: () => usersApi.profile(username!) as Promise<User & { is_following?: boolean }>,
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
          <div className="flex-1">
            <h1 className="font-bold text-lg">{profile.display_name ?? profile.username}</h1>
            <p className="text-sm text-zinc-400">@{profile.username}</p>
            {profile.bio && <p className="text-sm text-zinc-400 mt-1">{profile.bio}</p>}
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

        {/* Follow button */}
        {!isMe && (
          <button
            onClick={() => followMut.mutate()}
            disabled={followMut.isPending}
            className={`mt-4 w-full rounded-lg py-2 text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
              profile.is_following
                ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                : "bg-orange-500 hover:bg-orange-600 text-white"
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
