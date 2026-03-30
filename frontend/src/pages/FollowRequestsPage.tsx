import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { users as usersApi } from "../lib/api";
import { ArrowLeft, Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Avatar from "../components/Avatar";

interface FollowRequest {
  id: number;
  follower: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  created_at: string;
}

export default function FollowRequestsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: requests, isLoading } = useQuery<FollowRequest[]>({
    queryKey: ["follow-requests"],
    queryFn: () => usersApi.getFollowRequests(),
    refetchInterval: 10000,
  });

  const acceptMut = useMutation({
    mutationFn: (id: number) => usersApi.acceptFollowRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["follow-requests"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const declineMut = useMutation({
    mutationFn: (id: number) => usersApi.declineFollowRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["follow-requests"] });
    },
  });

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
        <h1 className="text-xl font-bold">Follow Requests</h1>
      </div>

      {!requests || requests.length === 0 ? (
        <div className="text-center text-zinc-500 py-12">
          <p className="text-sm">No pending follow requests</p>
          <p className="text-xs mt-1">When someone requests to follow you, they'll appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => (
            <div
              key={req.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/50"
            >
              <Avatar
                src={req.follower.avatar_url}
                name={req.follower.display_name || req.follower.username}
                username={req.follower.username}
                size={12}
                linkTo={`/profile/${req.follower.username}`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {req.follower.display_name || req.follower.username}
                </p>
                <p className="text-xs text-zinc-500">@{req.follower.username}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => declineMut.mutate(req.id)}
                  disabled={declineMut.isPending}
                  className="p-2 rounded-lg bg-zinc-800 hover:bg-red-500/20 hover:text-red-500 transition-colors disabled:opacity-50"
                  title="Decline"
                >
                  <X size={18} />
                </button>
                <button
                  onClick={() => acceptMut.mutate(req.id)}
                  disabled={acceptMut.isPending}
                  className="p-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors disabled:opacity-50"
                  title="Accept"
                >
                  <Check size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
