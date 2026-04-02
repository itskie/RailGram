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
  ArrowUpDown,
  Train,
  MapPin,
  Clock,
  ChevronRight,
  X,
} from "lucide-react";

const DUMMY_HISTORY = [
  { type: "train", label: "11001 Nandigram Express", value: "11001" },
  { type: "train", label: "12301 Howrah Rajdhani", value: "12301" },
  { type: "train", label: "12951 Mumbai Rajdhani", value: "12951" },
  { type: "train", label: "22691 Rajdhani Express", value: "22691" },
];

const POPULAR_STATIONS = [
  { code: "NDLS", name: "New Delhi" },
  { code: "HWH", name: "Howrah Junction" },
  { code: "CSTM", name: "Mumbai CSMT" },
  { code: "MAS", name: "Chennai Central" },
];

const INPUT_BASE =
  "w-full bg-zinc-950 border border-zinc-800/70 rounded-xl px-4 py-3.5 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 ring-orange-500/20 transition-all text-sm font-medium";

export default function SearchPage() {
  const navigate = useNavigate();

  // ── User social search ─────────────────────────────────────────────────────
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

  // ── Trip search ────────────────────────────────────────────────────────────
  const [fromStation, setFromStation] = useState("");
  const [toStation, setToStation] = useState("");

  const handleSwap = () => {
    setFromStation(toStation);
    setToStation(fromStation);
  };

  const handleFindTrains = () => {
    const from = fromStation.trim().toUpperCase();
    const to = toStation.trim().toUpperCase();
    if (from && to) navigate(`/trains?from=${from}&to=${to}`);
  };

  // ── Direct train search ────────────────────────────────────────────────────
  const [trainQuery, setTrainQuery] = useState("");
  const handleTrainSearch = (val?: string) => {
    const q = (val ?? trainQuery).trim();
    if (q) navigate(`/trains/${q}`);
  };

  // ── Live station search ────────────────────────────────────────────────────
  const [stationQuery, setStationQuery] = useState("");

  return (
    <div className="max-w-2xl mx-auto min-h-screen bg-black pb-24">
      {/* ── Page header ── */}
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-md px-4 pt-6 pb-4 border-b border-zinc-900">
        <h1 className="text-xl font-bold text-white">Search</h1>
        <p className="text-zinc-500 text-xs mt-0.5">Trains · Stations · Railfans</p>
      </div>

      <div className="px-4 py-5 space-y-5">

        {/* ── 1. Trip Search Card ── */}
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Plan a Journey</p>
          <div className="bg-zinc-900/80 border border-zinc-800/60 rounded-2xl p-4 space-y-3">
            {/* From */}
            <div className="relative">
              <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
              </div>
              <input
                type="text"
                value={fromStation}
                onChange={(e) => setFromStation(e.target.value)}
                placeholder="From Station (e.g. NDLS)"
                className={`${INPUT_BASE} pl-8`}
                onKeyDown={(e) => e.key === "Enter" && handleFindTrains()}
              />
              {fromStation && (
                <button
                  onClick={() => setFromStation("")}
                  className="absolute inset-y-0 right-3 flex items-center text-zinc-600 hover:text-zinc-400"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Swap divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-zinc-800/60" />
              <button
                onClick={handleSwap}
                className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-400 hover:text-orange-400 hover:border-orange-500/40 hover:bg-orange-500/10 transition-all active:scale-90"
              >
                <ArrowUpDown size={14} />
              </button>
              <div className="flex-1 h-px bg-zinc-800/60" />
            </div>

            {/* To */}
            <div className="relative">
              <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                <div className="w-2 h-2 rounded-full border-2 border-orange-500" />
              </div>
              <input
                type="text"
                value={toStation}
                onChange={(e) => setToStation(e.target.value)}
                placeholder="To Station (e.g. HWH)"
                className={`${INPUT_BASE} pl-8`}
                onKeyDown={(e) => e.key === "Enter" && handleFindTrains()}
              />
              {toStation && (
                <button
                  onClick={() => setToStation("")}
                  className="absolute inset-y-0 right-3 flex items-center text-zinc-600 hover:text-zinc-400"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Find Trains button */}
            <button
              onClick={handleFindTrains}
              disabled={!fromStation.trim() || !toStation.trim()}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #ff4500 0%, #e63c00 100%)", boxShadow: fromStation && toStation ? "0 0 16px rgba(255,69,0,0.35)" : "none" }}
            >
              Find Trains →
            </button>

            {/* Popular station shortcuts */}
            <div className="flex gap-2 flex-wrap pt-1">
              {POPULAR_STATIONS.map((s) => (
                <button
                  key={s.code}
                  onClick={() => !fromStation ? setFromStation(s.code) : !toStation ? setToStation(s.code) : null}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/50 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 transition-all"
                >
                  {s.code}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── 2. Direct Train Search ── */}
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Track a Train</p>
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Train size={16} className="text-zinc-600 group-focus-within:text-orange-400 transition-colors" />
            </div>
            <input
              type="text"
              value={trainQuery}
              onChange={(e) => setTrainQuery(e.target.value)}
              placeholder="Train number or name (e.g. 12301)"
              className={`${INPUT_BASE} pl-11 pr-24`}
              onKeyDown={(e) => e.key === "Enter" && handleTrainSearch()}
            />
            <button
              onClick={() => handleTrainSearch()}
              disabled={!trainQuery.trim()}
              className="absolute inset-y-0 right-2 flex items-center my-1.5 px-3.5 rounded-lg text-xs font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #ff4500 0%, #e63c00 100%)" }}
            >
              Track
            </button>
          </div>
        </section>

        {/* ── 3. Live Station Search ── */}
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Live Station Board</p>
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <MapPin size={16} className="text-zinc-600 group-focus-within:text-orange-400 transition-colors" />
            </div>
            <input
              type="text"
              value={stationQuery}
              onChange={(e) => setStationQuery(e.target.value)}
              placeholder="Station code or name (e.g. NDLS)"
              className={`${INPUT_BASE} pl-11 pr-24`}
              onKeyDown={(e) => {
                if (e.key === "Enter" && stationQuery.trim()) {
                  navigate(`/stations/${stationQuery.trim().toUpperCase()}`);
                }
              }}
            />
            <button
              onClick={() => stationQuery.trim() && navigate(`/stations/${stationQuery.trim().toUpperCase()}`)}
              disabled={!stationQuery.trim()}
              className="absolute inset-y-0 right-2 flex items-center my-1.5 px-3.5 rounded-lg text-xs font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #ff4500 0%, #e63c00 100%)" }}
            >
              View
            </button>
          </div>
        </section>

        {/* ── 4. Search History ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
              <Clock size={11} className="text-zinc-600" /> Recent Searches
            </p>
            <button className="text-[11px] text-orange-500 font-semibold hover:text-orange-400 transition-colors">
              Clear
            </button>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl overflow-hidden divide-y divide-zinc-800/50">
            {DUMMY_HISTORY.map((item, i) => (
              <button
                key={i}
                onClick={() => handleTrainSearch(item.value)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/50 transition-all text-left active:scale-[0.99]"
              >
                <div className="w-8 h-8 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                  <Train size={14} className="text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-200 truncate">{item.label}</p>
                  <p className="text-[11px] text-zinc-500">{item.type === "train" ? "Train" : "Station"}</p>
                </div>
                <ChevronRight size={14} className="text-zinc-600 shrink-0" />
              </button>
            ))}
          </div>
        </section>

        {/* ── User / Railfan Search ── */}
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Discover Railfans</p>
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <SearchIcon size={16} className="text-zinc-600 group-focus-within:text-orange-400 transition-colors" />
            </div>
            <input
              type="text"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Search by username or name..."
              className={`${INPUT_BASE} pl-11`}
            />
            {userLoading && userQuery.length > 0 && (
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-orange-400">
                <Loader2 className="animate-spin w-4 h-4" />
              </div>
            )}
          </div>

          {/* User results */}
          {debouncedUserQuery && userResults && userResults.length > 0 && (
            <div className="mt-3 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl overflow-hidden divide-y divide-zinc-800/50">
              {userResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => navigate(`/profile/${user.username}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/50 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0 border border-zinc-700/50">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-500">
                        <UserIcon size={18} />
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
            <div className="mt-6 flex flex-col items-center py-8 text-center">
              <SearchX size={32} className="text-zinc-800 mb-3" />
              <p className="text-zinc-500 text-sm">No railfans found for "{debouncedUserQuery}"</p>
            </div>
          )}

          {userError && (
            <p className="mt-3 text-xs text-red-400 text-center">Something went wrong. Please try again.</p>
          )}
        </section>

      </div>
    </div>
  );
}

