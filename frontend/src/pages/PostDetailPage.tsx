import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lock } from "lucide-react";
import { posts as postsApi } from "../lib/api";
import PostCard from "../components/PostCard";

export default function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const nav = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["post", postId],
    queryFn: () => postsApi.get(postId!) as Promise<any>,
    enabled: !!postId,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-orange-500" />
      </div>
    );
  }

  // Private account or not found
  if (error || !data) {
    const is403 = (error as any)?.status === 403 || (error as any)?.message?.includes("private");
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 px-6 text-center">
        {is403 ? (
          <>
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
              <Lock size={28} className="text-zinc-400" />
            </div>
            <h2 className="text-white font-semibold text-lg">This account is private</h2>
            <p className="text-zinc-400 text-sm">Follow this account to see their posts.</p>
          </>
        ) : (
          <>
            <h2 className="text-white font-semibold text-lg">Post not found</h2>
            <p className="text-zinc-400 text-sm">This post may have been deleted.</p>
          </>
        )}
        <button
          onClick={() => nav(-1)}
          className="mt-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-xl transition-colors"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => nav(-1)} className="text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <Link to={`/profile/${data.author?.username}`} className="flex items-center gap-2 group">
          {data.author?.avatar_url ? (
            <img src={data.author.avatar_url} className="w-7 h-7 rounded-full object-cover" alt="" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center">
              <span className="text-orange-400 text-xs font-bold uppercase">{data.author?.username?.[0]}</span>
            </div>
          )}
          <span className="text-white text-sm font-medium group-hover:text-orange-400 transition-colors">
            @{data.author?.username}
          </span>
        </Link>
      </div>

      {/* Post */}
      <div className="max-w-lg mx-auto py-4 px-2">
        <PostCard post={data} />
      </div>
    </div>
  );
}
