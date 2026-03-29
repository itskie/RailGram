import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { users as usersApi } from "../lib/api";
import { Search as SearchIcon, User as UserIcon, Loader2, SearchX, Zap } from "lucide-react";

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debouncing to avoid hitting the API too frequently
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading, isError } = useQuery<any[]>({
    queryKey: ["user-search", debouncedQuery],
    queryFn: () => usersApi.search(debouncedQuery) as Promise<any[]>,
    enabled: debouncedQuery.length > 0,
  });

  return (
    <div className="max-w-2xl mx-auto min-h-screen bg-black">
      {/* Header Search Bar */}
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md px-4 py-6 border-b border-zinc-900">
        <h1 className="text-xl font-bold text-white mb-6">Discover Railfans</h1>
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-teal-500 transition-colors">
            <SearchIcon size={18} />
          </div>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username or name..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder-zinc-500 focus:outline-none focus:border-teal-500/50 focus:ring-1 ring-teal-500/20 transition-all font-medium"
          />
          {isLoading && query.length > 0 && (
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-teal-500">
              <Loader2 className="animate-spin w-5 h-5" />
            </div>
          )}
        </div>
      </div>

      {/* Results Section */}
      <div className="px-4 py-8">
        {!debouncedQuery && (
          <div className="flex flex-col items-center justify-center text-center py-20 px-6">
            <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6 text-zinc-700">
              <SearchIcon size={32} />
            </div>
            <h2 className="text-xl font-semibold text-zinc-200 mb-2">Social Discovery</h2>
            <p className="text-zinc-500 text-sm max-w-xs">
              Type a name or username to find other railfans and explore their spots.
            </p>
          </div>
        )}

        {debouncedQuery && results && results.length > 0 && (
          <div className="space-y-4">
            {results.map((user) => (
              <div
                key={user.id}
                onClick={() => navigate(`/profile/${user.username}`)}
                className="flex items-center gap-4 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800/50 p-4 rounded-2xl cursor-pointer transition-all active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0 border border-zinc-800">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500">
                      <UserIcon size={20} />
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-bold truncate leading-tight">{user.display_name}</h3>
                    {user.karma > 50 && (
                      <div className="flex items-center gap-0.5 bg-yellow-500/10 px-1.5 py-0.5 rounded-full border border-yellow-500/20">
                         <Zap size={10} className="text-yellow-500" />
                         <span className="text-[8px] font-black text-yellow-500">{user.karma}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-zinc-500 text-sm font-medium truncate">@{user.username}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-zinc-800/50 flex items-center justify-center text-zinc-500 group-hover:text-teal-500">
                   <SearchIcon size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
          </div>
        )}

        {debouncedQuery && results && results.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <SearchX size={48} className="text-zinc-800 mb-4" />
            <p className="text-zinc-500 font-medium">No railfans found for "{debouncedQuery}"</p>
          </div>
        )}

        {isError && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-center">
             Something went wrong while searching. Please try again.
          </div>
        )}
      </div>
    </div>
  );
}
