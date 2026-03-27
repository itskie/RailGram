import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { gamification as gamApi } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import type { LeaderboardEntry } from "../types";
import { Trophy, Zap, Flame, Star, Gift } from "lucide-react";

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
  common:    "border-zinc-600 text-zinc-400",
  rare:      "border-blue-500/60 text-blue-400",
  epic:      "border-purple-500/60 text-purple-400",
  legendary: "border-yellow-400/60 text-yellow-400",
};

export default function LeaderboardPage() {
  const qc = useQueryClient();
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gam-stats"] }),
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
      {/* My stats */}
      {stats && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h2 className="font-semibold text-sm text-zinc-400 mb-4">My Stats</h2>
          <div className="grid grid-cols-3 gap-4 text-center mb-5">
            {[
              { icon: Zap,   label: "Karma",  value: stats.karma,          color: "text-yellow-400" },
              { icon: Trophy,label: "Rank",   value: `#${stats.karma_rank ?? "—"}`, color: "text-orange-400" },
              { icon: Flame, label: "Streak", value: (stats.streaks.find(s => s.streak_type === "daily_login")?.current_count ?? 0), color: "text-red-400" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <Icon size={20} className={color} />
                <p className="font-bold text-xl text-zinc-100">{value.toLocaleString()}</p>
                <p className="text-xs text-zinc-500">{label}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => checkin.mutate()}
            disabled={checkin.isPending}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Gift size={15} />
            {checkin.isPending ? "Checking in…" : "Daily Check-in (+2 karma)"}
          </button>
          {checkin.isSuccess && (
            <p className="text-center text-green-400 text-xs mt-2">
              {(checkin.data as { message?: string })?.message ?? "✓ Checked in!"}
            </p>
          )}
          {checkin.isError && (
            <p className="text-center text-zinc-500 text-xs mt-2">Already checked in today.</p>
          )}
        </div>
      )}

      {/* Badges */}
      {stats?.badges && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h2 className="font-semibold text-sm text-zinc-400 mb-4 flex items-center gap-2">
            <Star size={14} className="text-yellow-400" />
            Badges ({stats.badges.filter((b) => b.earned_at).length}/{stats.badges.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {stats.badges.map((b) => (
              <div
                key={b.id}
                className={`border rounded-xl p-3 flex flex-col gap-1 transition-opacity ${
                  RARITY_COLOR[b.rarity]
                } ${b.earned_at ? "opacity-100" : "opacity-30"}`}
              >
                <span className="text-2xl">{b.icon}</span>
                <p className="text-xs font-semibold text-zinc-100">{b.name}</p>
                <p className="text-xs text-zinc-500 leading-tight">{b.description}</p>
                {b.earned_at && (
                  <span className="text-xs text-green-400 mt-auto">Earned ✓</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h2 className="font-semibold text-sm text-zinc-400 mb-4 flex items-center gap-2">
          <Trophy size={14} className="text-orange-400" />
          Global Leaderboard
        </h2>
        <div className="flex flex-col gap-1">
          {(lb ?? []).map((entry) => (
            <div
              key={entry.user_id}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl ${
                entry.rank <= 3 ? "bg-orange-500/10 border border-orange-500/20" : ""
              }`}
            >
              <span
                className={`w-6 text-center text-sm font-bold ${
                  entry.rank === 1
                    ? "text-yellow-400"
                    : entry.rank === 2
                    ? "text-zinc-300"
                    : entry.rank === 3
                    ? "text-amber-600"
                    : "text-zinc-600"
                }`}
              >
                {entry.rank}
              </span>
              <div className="w-8 h-8 rounded-full bg-zinc-700 overflow-hidden flex-shrink-0">
                {entry.avatar_url && (
                  <img src={entry.avatar_url} className="w-full h-full object-cover" alt="" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-100 truncate">
                  {entry.display_name ?? entry.username}
                </p>
                <p className="text-xs text-zinc-500">@{entry.username}</p>
              </div>
              <span className="text-sm font-bold text-yellow-400">
                {entry.karma.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
