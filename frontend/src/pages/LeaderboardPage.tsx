import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { gamification as gamApi } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import type { LeaderboardEntry } from "../types";
import { Trophy, Zap, Flame, Gift, Crown, Medal, User as UserIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import VerifiedBadge from "../components/VerifiedBadge";

interface StreakOut {
  streak_type: string;
  current_count: number;
  best_count: number;
}

interface BadgeOut {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  karma_bonus: number;
  earned_at: string | null;
}

interface UserStatsOut {
  karma: number;
  trains_spotted: number;
  km_traveled: number;
  badges: BadgeOut[];
  streaks: StreakOut[];
  karma_rank: number | null;
}

const RARITY_COLOR: Record<string, string> = {
  common: "border-zinc-600 text-zinc-400",
  rare: "border-blue-500/60 text-blue-400",
  epic: "border-purple-500/60 text-purple-400",
  legendary: "border-yellow-400/60 text-yellow-400",
};

export default function LeaderboardPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);

  const { data: stats } = useQuery<UserStatsOut>({
    queryKey: ["gam-stats"],
    queryFn: () => gamApi.stats(me!.username) as Promise<UserStatsOut>,
    enabled: !!me,
  });

  const { data: lb } = useQuery<LeaderboardEntry[]>({
    queryKey: ["leaderboard"],
    queryFn: () => gamApi.leaderboard() as Promise<LeaderboardEntry[]>,
  });

  const checkin = useMutation({
    mutationFn: () => gamApi.checkin(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gam-stats"] });
      // If a new badge was granted, we could show a modal here
    },
  });

  const top3 = lb?.slice(0, 3) || [];
  const rest = lb?.slice(3) || [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-8 pb-10">
      {/* Upper Stats Card (My Status) */}
      {stats && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800 rounded-3xl p-6 shadow-2xl"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Your Pulse</h2>
            <div className="flex items-center gap-2 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
              <Zap size={14} className="text-orange-400" />
              <span className="text-xs font-bold text-orange-400 uppercase tracking-tighter">
                Level {(Math.floor(stats.karma / 100) + 1)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-6">
            {[
              { label: "Karma", value: stats.karma, color: "text-yellow-400", icon: Zap },
              { label: "Rank", value: `#${stats.karma_rank ?? "—"}`, color: "text-blue-400", icon: Trophy },
              { label: "Streak", value: stats.streaks.find(s => s.streak_type === "daily_login")?.current_count ?? 0, color: "text-red-400", icon: Flame },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="text-center group">
                <div className="inline-flex p-2 bg-zinc-800/50 rounded-xl mb-2 group-hover:scale-110 transition-transform">
                   <Icon size={18} className={color} />
                </div>
                <p className="text-2xl font-black text-white leading-none mb-1">{(value ?? 0).toLocaleString()}</p>
                <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider font-mono">{label}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => checkin.mutate()}
            disabled={checkin.isPending}
            className="w-full relative overflow-hidden group py-3.5 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-2xl font-bold text-sm shadow-xl shadow-orange-950/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <span className="relative z-10 flex items-center justify-center gap-2 text-shadow-sm">
              <Gift size={16} />
              {checkin.isPending ? "Syncing…" : "Daily Check-in (+2 Karma)"}
            </span>
          </button>
          <AnimatePresence>
            {checkin.isSuccess && (
               <motion.p 
                 initial={{ opacity: 0, height: 0 }}
                 animate={{ opacity: 1, height: "auto" }}
                 className="text-center text-green-400 text-[10px] font-bold mt-3 uppercase tracking-wider"
               >
                 Successfully Sycned! Karma Updated.
               </motion.p>
            )}
            {checkin.isError && (
               <motion.p 
                 initial={{ opacity: 0, height: 0 }}
                 animate={{ opacity: 1, height: "auto" }}
                 className="text-center text-zinc-500 text-[10px] font-bold mt-3 uppercase tracking-wider"
               >
                 Already logged in today.
               </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Podium Section */}
      <div className="relative pt-10 pb-4">
        <h2 className="text-xl font-black text-white mb-10 text-center tracking-tight">Railfan Kings 🚂👑</h2>
        <div className="flex justify-center items-end gap-1 sm:gap-4 max-w-sm mx-auto">
          {/* SILVER - Rank 2 */}
          {top3[1] && (
            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               className="flex flex-col items-center flex-1"
               onClick={() => navigate(`/profile/${top3[1].username}`)}
            >
              <div className="relative group cursor-pointer mb-2">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-zinc-800 border-2 border-zinc-500/50 overflow-hidden ring-4 ring-zinc-500/10">
                   {top3[1].avatar_url ? <img src={top3[1].avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-600"><UserIcon size={24} /></div>}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-zinc-400 rounded-full w-6 h-6 flex items-center justify-center border-2 border-black">
                   <Medal size={12} className="text-zinc-800" />
                </div>
              </div>
              <div className="flex items-center gap-1 justify-center w-full">
                <p className="text-[10px] font-black text-zinc-400 uppercase truncate w-16 sm:w-20 text-center">{top3[1].display_name}</p>
                {top3[1].is_verified && <VerifiedBadge type="orange" size={12} />}
              </div>
              <div className="bg-gradient-to-t from-zinc-800/80 to-zinc-800/20 w-full sm:w-24 h-24 sm:h-28 rounded-t-2xl mt-2 flex items-center justify-center border-x border-t border-zinc-700/50 relative">
                 <span className="text-zinc-400 font-black text-3xl opacity-50">2</span>
                 <div className="absolute -bottom-2 text-yellow-400 font-mono text-[10px] font-black">{top3[1].karma} k</div>
              </div>
            </motion.div>
          )}

          {/* GOLD - Rank 1 */}
          {top3[0] && (
            <motion.div 
               initial={{ opacity: 0, scale: 1.1 }}
               animate={{ opacity: 1, scale: 1.2 }}
               className="flex flex-col items-center flex-1 z-10"
               onClick={() => navigate(`/profile/${top3[0].username}`)}
            >
              <div className="relative group cursor-pointer mb-2">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-yellow-400">
                   <Crown size={24} className="drop-shadow-[0_0_8px_rgba(250,204,21,0.5)] animate-bounce" />
                </div>
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-zinc-800 border-2 border-yellow-500 overflow-hidden ring-4 ring-yellow-500/20 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                   {top3[0].avatar_url ? <img src={top3[0].avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-600"><UserIcon size={30} /></div>}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-yellow-500 rounded-full w-8 h-8 flex items-center justify-center border-2 border-black">
                   <Medal size={16} className="text-yellow-900" />
                </div>
              </div>
              <div className="flex items-center gap-1 justify-center w-full">
                <p className="text-[10px] font-black text-white uppercase truncate w-16 sm:w-20 text-center">{top3[0].display_name}</p>
                {top3[0].is_verified && <VerifiedBadge type="orange" size={14} />}
              </div>
              <div className="bg-gradient-to-t from-yellow-500/20 to-yellow-500/5 w-full sm:w-28 h-32 sm:h-40 rounded-t-2xl mt-2 flex items-center justify-center border-x border-t border-yellow-500/30 relative">
                 <span className="text-yellow-500 font-black text-5xl opacity-40">1</span>
                 <div className="absolute -bottom-2 text-yellow-400 font-mono text-[10px] font-black">{top3[0].karma} k</div>
              </div>
            </motion.div>
          )}

          {/* BRONZE - Rank 3 */}
          {top3[2] && (
            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               className="flex flex-col items-center flex-1"
               onClick={() => navigate(`/profile/${top3[2].username}`)}
            >
              <div className="relative group cursor-pointer mb-2">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-zinc-800 border-2 border-amber-800/50 overflow-hidden ring-4 ring-amber-800/10">
                   {top3[2].avatar_url ? <img src={top3[2].avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-600"><UserIcon size={24} /></div>}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-amber-700 rounded-full w-6 h-6 flex items-center justify-center border-2 border-black">
                   <Medal size={12} className="text-amber-200" />
                </div>
              </div>
              <div className="flex items-center gap-1 justify-center w-full">
                <p className="text-[10px] font-black text-amber-700 uppercase truncate w-16 sm:w-20 text-center">{top3[2].display_name}</p>
                {top3[2].is_verified && <VerifiedBadge type="orange" size={12} />}
              </div>
              <div className="bg-gradient-to-t from-amber-900/40 to-amber-900/10 w-full sm:w-24 h-20 sm:h-24 rounded-t-2xl mt-2 flex items-center justify-center border-x border-t border-amber-900/30 relative">
                 <span className="text-amber-700 font-black text-3xl opacity-50">3</span>
                 <div className="absolute -bottom-2 text-yellow-400 font-mono text-[10px] font-black">{top3[2].karma} k</div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Rest of Leaderboard */}
      <div className="flex flex-col gap-2">
        {rest.map((entry, idx) => (
          <motion.div 
            key={entry.user_id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => navigate(`/profile/${entry.username}`)}
            className={`flex items-center gap-4 p-4 rounded-2xl border border-zinc-800/50 cursor-pointer hover:bg-zinc-800/50 transition-all ${
               entry.user_id === me?.id ? "bg-orange-500/10 border-orange-500/30 ring-1 ring-orange-500/20" : "bg-black"
            }`}
          >
            <span className="w-6 text-sm font-black text-zinc-600 font-mono">{entry.rank}</span>
            <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border border-zinc-700">
               {entry.avatar_url ? <img src={entry.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-600"><UserIcon size={18} /></div>}
            </div>
            <div className="flex-1 min-w-0">
               <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold text-white truncate">{entry.display_name}</h4>
                  {entry.is_verified && <VerifiedBadge type="blue" size={12} />}
               </div>
               <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight">@{entry.username}</p>
            </div>
            <div className="text-right">
               <p className="text-sm font-black text-yellow-400 font-mono">{entry.karma.toLocaleString()}</p>
               <p className="text-[8px] font-black text-zinc-600 uppercase">Karma</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Badges Section - Refined */}
      {stats?.badges && stats.badges.length > 0 && (
         <div className="mt-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
               <Medal size={14} className="text-yellow-400" />
               Badge Showcase
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
               {stats.badges.map((b) => (
                  <motion.div 
                     key={b.id}
                     whileHover={{ scale: 1.02 }}
                     className={`relative border rounded-2xl p-4 overflow-hidden group transition-all duration-300 ${
                        RARITY_COLOR[b.rarity]
                     } ${b.earned_at ? "bg-zinc-900/50" : "bg-zinc-950/20 opacity-30 grayscale saturate-0"}`}
                  >
                     <p className="text-2xl mb-1">{b.icon}</p>
                     <p className="text-xs font-black uppercase tracking-tight text-white mb-0.5">{b.name}</p>
                     <p className="text-[9px] font-bold text-zinc-500 leading-tight uppercase font-mono">{b.rarity}</p>
                     {b.earned_at && (
                        <div className="mt-2 text-[8px] font-black text-green-500/80 uppercase">Unlocked ✓</div>
                     )}
                  </motion.div>
               ))}
            </div>
         </div>
      )}
    </div>
  );
}
