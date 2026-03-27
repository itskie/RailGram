import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { chat as chatApi } from "../lib/api";
import type { Conversation } from "../types";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Loader } from "lucide-react";

export default function ChatListPage() {
  const nav = useNavigate();

  const { data: convs, isLoading } = useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: () => chatApi.list() as Promise<Conversation[]>,
    refetchInterval: 15_000,
  });

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader className="animate-spin text-orange-400" /></div>;
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h1 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <MessageSquare size={20} className="text-orange-400" />
        Messages
      </h1>

      {(convs ?? []).length === 0 && (
        <p className="text-zinc-500 text-sm text-center py-12">
          No conversations yet. Visit a user's profile to start a DM.
        </p>
      )}

      <div className="flex flex-col gap-1">
        {(convs ?? []).map((c) => (
          <button
            key={c.id}
            onClick={() => nav(`/chat/${c.id}`)}
            className="flex items-center gap-3 bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 rounded-xl px-4 py-3 text-left transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-zinc-700 flex-shrink-0 overflow-hidden">
              {c.other_avatar_url && (
                <img src={c.other_avatar_url} className="w-full h-full object-cover" alt="" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-zinc-100 truncate">
                {c.other_display_name ?? c.other_username ?? "Unknown"}
              </p>
              <p className="text-xs text-zinc-500 truncate">{c.last_message ?? "No messages yet"}</p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              {c.last_message_at && (
                <span className="text-xs text-zinc-600">
                  {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })}
                </span>
              )}
              {c.unread_count > 0 && (
                <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                  {c.unread_count > 9 ? "9+" : c.unread_count}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
