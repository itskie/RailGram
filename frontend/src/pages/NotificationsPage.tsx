import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications as notifApi } from "../lib/api";
import { formatDistanceToNow } from "date-fns";
import {
  Heart, MessageCircle, UserPlus, Zap,
  ArrowLeft, CheckCircle2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Avatar from "../components/Avatar";

interface NotifActor {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Notification {
  id: string;
  notif_type: "follow" | "like_post" | "comment_post" | "like_reel" | "comment_reel" | "mention" | "reply_post" | "reply_reel" | "like_comment";
  actor: NotifActor | null;
  target_id: string | null;
  is_read: boolean;
  created_at: string;
}

const NOTIF_CONFIG: Record<string, { icon: any, color: string, label: string }> = {
  follow: { icon: UserPlus, color: "text-blue-400", label: "started following you" },
  like_post: { icon: Heart, color: "text-red-400", label: "liked your post" },
  comment_post: { icon: MessageCircle, color: "text-teal-400", label: "commented on your post" },
  like_reel: { icon: Heart, color: "text-pink-400", label: "liked your reel" },
  comment_reel: { icon: MessageCircle, color: "text-emerald-400", label: "commented on your reel" },
  mention: { icon: Zap, color: "text-yellow-400", label: "mentioned you" },
  reply_post: { icon: MessageCircle, color: "text-orange-400", label: "replied to your comment" },
  reply_reel: { icon: MessageCircle, color: "text-orange-400", label: "replied to your comment" },
  like_comment: { icon: Heart, color: "text-rose-400", label: "liked your comment" },
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: notifs, isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => notifApi.list(50),
    refetchInterval: 30000,
  });

  const readAll = useMutation({
    mutationFn: () => notifApi.readAll(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-notifs"] });
    },
  });

  const readOne = useMutation({
    mutationFn: (id: string) => notifApi.readOne(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-notifs"] });
    },
  });

  const handleNotifClick = (n: Notification) => {
    if (!n.is_read) readOne.mutate(n.id);

    if (n.notif_type === "follow" && n.actor) {
      navigate(`/profile/${n.actor.username}`);
    } else if (n.target_id) {
      const reelTypes = ["like_reel", "comment_reel", "reply_reel"];
      const postTypes = ["like_post", "comment_post", "mention", "reply_post"];
      if (reelTypes.includes(n.notif_type)) {
        navigate(`/reels`);
      } else if (postTypes.includes(n.notif_type)) {
        navigate(`/posts/${n.target_id}/comments`);
      } else if (n.notif_type === "like_comment") {
        navigate(`/posts/${n.target_id}/comments`);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-6">
        <div className="text-center text-zinc-500 py-12">Loading notifications...</div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/follow-requests')}
            className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1"
          >
            <UserPlus size={14} /> Requests
          </button>
          <span className="text-zinc-700">|</span>
          <button
            onClick={() => navigate('/blocked-users')}
            className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1"
          >
            <Shield size={14} /> Blocked
          </button>
          {notifs && notifs.length > 0 && (
            <button
              onClick={() => readAll.mutate()}
              className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1 ml-2"
            >
              <CheckCircle2 size={14} /> Mark all read
            </button>
          )}
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-4">Notifications</h1>

      {!notifs || notifs.length === 0 ? (
        <div className="text-center text-zinc-500 py-12">
          <Zap size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-sm">No notifications yet</p>
          <p className="text-xs mt-1">When someone likes, comments, or follows you, they'll appear here</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifs.map((n) => {
            const config = NOTIF_CONFIG[n.notif_type] || { icon: Zap, color: "text-zinc-400", label: "notification" };
            const Icon = config.icon;
            const timeAgo = formatDistanceToNow(new Date(n.created_at), { addSuffix: true });

            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => handleNotifClick(n)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  n.is_read
                    ? "bg-transparent border-zinc-800/50 hover:border-zinc-700"
                    : "bg-orange-500/5 border-orange-500/20 hover:border-orange-500/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  {n.actor?.avatar_url ? (
                    <Avatar
                      src={n.actor.avatar_url}
                      name={n.actor.display_name || n.actor.username}
                      username={n.actor.username}
                      size={10}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                      <Icon size={20} className={config.color} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      {n.actor ? (
                        <span className="font-semibold">{n.actor.display_name || n.actor.username}</span>
                      ) : (
                        <span className="font-semibold">Someone</span>
                      )}{" "}
                      <span className="text-zinc-400">{config.label}</span>
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">{timeAgo}</p>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-1" />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
