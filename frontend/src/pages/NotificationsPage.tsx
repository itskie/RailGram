import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications as notifApi } from "../lib/api";
import { formatDistanceToNow } from "date-fns";
import {
  Heart, MessageCircle, UserPlus, Zap,
  ArrowLeft, CheckCircle2, User as UserIcon,
  ChevronRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
    refetchInterval: 30000, // Poll every 30s
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
      }
      // like_comment: target_id is post id — go to post comments
      else if (n.notif_type === "like_comment") {
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
        {notifs && notifs.length > 0 && (
          <button
            onClick={() => readAll.mutate()}
            className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1"
          >
            <CheckCircle2 size={14} /> Mark all read
          </button>
        )}
      </div>

      <h1 className="text-2xl font-bold text-zinc-100 mb-4">Notifications</h1>

      {!notifs || notifs.length === 0 ? (
        <div className="text-center text-zinc-500 py-12">
          <Bell size={48} className="mx-auto mb-4 opacity-20" />
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
                    <p className="text-sm text-zinc-100">
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
    <div className="max-w-2xl mx-auto min-h-screen bg-black pb-20">
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-zinc-800/50 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-black tracking-tight text-white">Notifications</h1>
        </div>
        {notifs?.some(n => !n.is_read) && (
          <button 
            onClick={() => readAll.mutate()}
            className="text-[10px] font-black uppercase tracking-widest text-orange-500 hover:text-orange-400 transition-colors flex items-center gap-1.5"
          >
            <CheckCircle2 size={12} />
            Mark all read
          </button>
        )}
      </div>

      <div className="divide-y divide-zinc-800/40">
        <AnimatePresence initial={false}>
          {isLoading ? (
            <div className="flex flex-col gap-4 p-8 items-center justify-center text-zinc-600">
               <div className="w-8 h-8 border-2 border-zinc-800 border-t-orange-500 rounded-full animate-spin" />
               <p className="text-[10px] font-bold uppercase tracking-widest">Scanning Waves...</p>
            </div>
          ) : notifs?.length === 0 ? (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="p-12 text-center flex flex-col items-center gap-4"
            >
               <div className="w-16 h-16 bg-zinc-900 rounded-3xl flex items-center justify-center text-zinc-700">
                  <Zap size={32} />
               </div>
               <p className="text-zinc-500 font-bold">Quiet on the tracks...</p>
               <p className="text-[10px] text-zinc-700 uppercase font-bold tracking-tighter">New alerts will appear here</p>
            </motion.div>
          ) : (
            notifs?.map((n, idx) => {
              const config = NOTIF_CONFIG[n.notif_type] || NOTIF_CONFIG.mention;
              const Icon = config.icon;
              
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => handleNotifClick(n)}
                  className={`group relative flex items-center gap-4 p-4 cursor-pointer transition-all hover:bg-zinc-900/40 ${!n.is_read ? 'bg-orange-500/[0.03]' : ''}`}
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-900 overflow-hidden border border-zinc-800 group-hover:border-zinc-700 transition-colors shadow-xl">
                      {n.actor?.avatar_url ? (
                        <img src={n.actor.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-700"><UserIcon size={20} /></div>
                      )}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 p-1 rounded-lg bg-black border border-zinc-800 shadow-xl ${config.color}`}>
                      <Icon size={10} />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-400 leading-tight">
                      <span className="font-black text-white">@{n.actor?.username || "Someone"}</span>
                      {" "}{config.label}
                    </p>
                    <p className="text-[10px] font-bold text-zinc-600 mt-1 uppercase tracking-tighter">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>

                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                  )}

                  <ChevronRight size={16} className="text-zinc-800 group-hover:text-zinc-600 transition-colors" />
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
