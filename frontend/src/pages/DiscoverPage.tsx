import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { users as usersApi } from "../lib/api";
import {
  Search as SearchIcon,
  User as UserIcon,
  Loader2,
  SearchX,
  Zap,
  ChevronRight,
  Compass,
} from "lucide-react";

const INPUT_BASE =
  "w-full bg-zinc-950 border border-zinc-800/70 rounded-xl px-4 py-3.5 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 ring-orange-500/20 transition-all text-sm font-medium";

export default function DiscoverPage() {
  const navigate = useNavigate();

  const [userQuery, setUserQuery] = useState("");
  const [debouncedUserQuery, setDebouncedUserQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedUserQuery(userQuery), 300);
    return () => clearTimeout(t);
  }, [userQuery]);

  const { data: userResults, isLoading: userLoading, isError: userError } = useQuery<any[]>({
    queryKey: ["user-search", debouncedUserQuery],
    queryFn: () => usersApi.search(debouncedUserQuery) as Promise<any[]>,
    enabled: debouncedUserQuery.length > 0,
  });

  return (
    <div className="max-w-2xl mx-auto min-h-screen bg-black pb-24">
      {/* ── Page header ── */}
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-md px-4 pt-6 pb-4 border-b border-zinc-900">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Compass size={18} className="text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Discover</h1>
            <p className="text-zinc-500 text-xs">Find Railfans &amp; Spotters</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 space-y-6">

        {/* ── Search input ── */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <SearchIcon size={16} className="text-zinc-600 group-focus-within:text-orange-400 transition-colors" />
          </div>
          <input
            type="text"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="Search by username or name…"
            autoFocus
            className={`${INPUT_BASE} pl-11`}
          />
          {userLoading && userQuery.length > 0 && (
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-orange-400">
              <Loader2 className="animate-spin w-4 h-4" />
            </div>
          )}
        </div>

        {/* ── Results ── */}
        {debouncedUserQuery && userResults && userResults.length > 0 && (
          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl overflow-hidden divide-y divide-zinc-800/50">
            {userResults.map((user) => (
              <button
                key={user.id}
                onClick={() => navigate(`/profile/${user.username}`)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-800/50 transition-all text-left active:scale-[0.99]"
              >
                <div className="w-11 h-11 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0 border border-zinc-700/50">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500">
                      <UserIcon size={20} />
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-bold text-sm truncate">{user.display_name}</span>
                    {user.karma > 50 && (
                      <div className="flex items-center gap-0.5 bg-yellow-500/10 px-1.5 py-0.5 rounded-full border border-yellow-500/20">
                        <Zap size={9} className="text-yellow-500" />
                        <span className="text-[9px] font-black text-yellow-500">{user.karma}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-zinc-500 text-xs truncate">@{user.username}</p>
                </div>
                <ChevronRight size={14} className="text-zinc-600 shrink-0" />
              </button>
            ))}
          </div>
        )}

        {debouncedUserQuery && userResults && userResults.length === 0 && !userLoading && (
          <div className="flex flex-col items-center py-16 text-center">
            <SearchX size={36} className="text-zinc-800 mb-3" />
            <p className="text-zinc-400 font-semibold text-sm">No railfans found</p>
            <p className="text-zinc-600 text-xs mt-1">for "{debouncedUserQuery}"</p>
          </div>
        )}

        {userError && (
          <p className="text-xs text-red-400 text-center">Something went wrong. Please try again.</p>
        )}

        {/* ── Empty state ── */}
        {!debouncedUserQuery && (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-4">
              <Compass size={28} className="text-orange-400" />
            </div>
            <p className="text-zinc-300 font-semibold text-base mb-1">Find Railfans</p>
            <p className="text-zinc-600 text-sm max-w-xs">
              Search by username or display name to discover spotters, photographers and enthusiasts.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
