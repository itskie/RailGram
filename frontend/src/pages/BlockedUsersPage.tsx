import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { users as usersApi } from "../lib/api";
import { ArrowLeft, Shield, UserCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Avatar from "../components/Avatar";

interface BlockedUser {
  id: number;
  blocked_user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  created_at: string;
}

export default function BlockedUsersPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: blocked, isLoading } = useQuery<BlockedUser[]>({
    queryKey: ["blocked-users"],
    queryFn: async () => {
      const data = await usersApi.getBlockedUsers();
      return data as BlockedUser[];
    },
    refetchInterval: 10000,
  });

  const unblockMut = useMutation({
    mutationFn: (username: string) => usersApi.unblock(username),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blocked-users"] });
    },
  });

  const unblockAll = () => {
    if (!blocked || blocked.length === 0) return;
    if (!window.confirm(`Unblock all ${blocked.length} users?`)) return;
    
    blocked.forEach((item) => {
      unblockMut.mutate(item.blocked_user.username);
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-6">
        <div className="text-center text-zinc-500 py-12">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="text-xl font-bold">Blocked Users</h1>
      </div>

      {!blocked || blocked.length === 0 ? (
        <div className="text-center text-zinc-500 py-12">
          <Shield size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-sm">No blocked users</p>
          <p className="text-xs mt-1">Users you block will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {blocked.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/50"
            >
              <Avatar
                src={item.blocked_user.avatar_url}
                name={item.blocked_user.display_name || item.blocked_user.username}
                username={item.blocked_user.username}
                size={12}
                linkTo={`/profile/${item.blocked_user.username}`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {item.blocked_user.display_name || item.blocked_user.username}
                </p>
                <p className="text-xs text-zinc-500">@{item.blocked_user.username}</p>
              </div>
              <button
                onClick={() => unblockMut.mutate(item.blocked_user.username)}
                disabled={unblockMut.isPending}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-green-500/20 hover:text-green-500 text-zinc-300 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm font-semibold"
              >
                <UserCheck size={16} />
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
