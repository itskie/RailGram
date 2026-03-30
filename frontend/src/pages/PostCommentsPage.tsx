import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, Loader2, MessageCircle } from "lucide-react";
import { posts as postsApi } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import Avatar from "../components/Avatar";
import { formatDistanceToNow } from "date-fns";

export default function PostCommentsPage() {
  const { postId } = useParams<{ postId: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [text, setText] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["postComments", postId],
    queryFn: () => postsApi.comments(postId!) as Promise<{ comments: any[]; next_cursor: string | null }>,
    enabled: !!postId,
  });

  const addMut = useMutation({
    mutationFn: () => postsApi.addComment(postId!, text),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["postComments", postId] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const comments = data?.comments ?? [];

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
        <button onClick={() => nav(-1)} className="text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-white font-semibold text-[15px]">Comments</h1>
      </div>

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-orange-400" size={24} />
          </div>
        )}

        {!isLoading && comments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-500">
            <MessageCircle size={36} strokeWidth={1.5} />
            <p className="text-sm">No comments yet. Be the first!</p>
          </div>
        )}

        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar
              src={c.author?.avatar_url}
              name={c.author?.display_name || c.author?.username}
              username={c.author?.username}
              size={8}
              linkTo={`/profile/${c.author?.username}`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-white text-[13px] font-semibold">{c.author?.username}</span>
                <span className="text-zinc-500 text-[11px]">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-zinc-200 text-[13px] mt-0.5 leading-snug">{c.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      {user && (
        <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-950">
          <form
            onSubmit={(e) => { e.preventDefault(); if (text.trim()) addMut.mutate(); }}
            className="flex items-center gap-3 bg-zinc-900 rounded-2xl px-4 py-2 border border-zinc-800 focus-within:border-orange-500/50 transition-colors"
          >
            <Avatar
              src={user.avatar_url}
              name={user.display_name || user.username}
              username={user.username}
              size={7}
            />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a comment…"
              className="flex-1 bg-transparent text-sm text-white focus:outline-none placeholder:text-zinc-500 py-1"
            />
            <button
              type="submit"
              disabled={!text.trim() || addMut.isPending}
              className="text-orange-400 disabled:text-zinc-600 hover:text-orange-300 transition-colors"
            >
              {addMut.isPending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
