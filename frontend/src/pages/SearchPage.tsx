import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { users as usersApi, stations as stationsApi } from "../lib/api";
import TrainSearchBox from "../components/TrainSearchBox";
import StationAutocomplete from "../components/StationAutocomplete";
import { useRecentSearches } from "../hooks/useRecentSearches";
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
  RefreshCw,
  AlertCircle,
} from "lucide-react";

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
  // Handled by TrainSearchBox component (navigates on select/enter)

  // ── Train search history ──────────────────────────────────────────────────
  const { history: trainHistory, clear: clearTrainHistory } = useRecentSearches("rg_trains_recent");

  // ── Live station board ────────────────────────────────────────────────────
  const [boardStation, setBoardStation] = useState("");

  interface BoardEntry {
    train_no: string;
    train_name: string;
    train_type: string | null;
    origin_code: string | null;
    destination_code: string | null;
    arrival_time: string | null;
    departure_time: string | null;
    platform: string | null;
    status: string;
    delay_minutes: number;
  }
  interface BoardResponse {
    station_code: string;
    station_name: string;
    entries: BoardEntry[];
    as_of: string;
  }

  const {
    data: boardData,
    isLoading: boardLoading,
    isError: boardError,
  } = useQuery<BoardResponse>({
    queryKey: ["station-board", boardStation],
    queryFn: () => stationsApi.board(boardStation) as Promise<BoardResponse>,
    enabled: boardStation.length >= 2,
    refetchInterval: 60_000, // auto-refresh every 60 s
    staleTime: 55_000,
  });

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
            <StationAutocomplete
              value={fromStation}
              onChange={setFromStation}
              placeholder="From Station (e.g. New Delhi)"
              dot="filled"
            />

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
            <StationAutocomplete
              value={toStation}
              onChange={setToStation}
              placeholder="To Station (e.g. Howrah)"
              dot="outlined"
            />

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
          <TrainSearchBox placeholder="Train number or name (e.g. 12301 Howrah Rajdhani)" />
        </section>

        {/* ── 3. Live Station Board ── */}
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Live Station Board</p>
          <StationAutocomplete
            value={boardStation}
            onChange={setBoardStation}
            placeholder="Station code or name (e.g. NDLS)"
            dot="filled"
          />

          {/* Board table */}
          {boardStation.length >= 2 && (
            <div className="mt-3 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl overflow-hidden">
              {/* Board header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/60">
                <span className="text-xs font-bold text-white">
                  {boardData?.station_name ?? boardStation}
                </span>
                <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                  {boardLoading && <Loader2 size={11} className="animate-spin text-orange-400" />}
                  {boardData && !boardLoading && (
                    <><RefreshCw size={10} className="text-zinc-600" />
                    {" "}{new Date(boardData.as_of).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>
                  )}
                </span>
              </div>

              {boardError && (
                <div className="flex items-center gap-2 px-4 py-6 text-zinc-500 text-sm">
                  <AlertCircle size={16} className="text-red-500" />
                  Could not load board data.
                </div>
              )}

              {boardLoading && !boardData && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={22} className="animate-spin text-orange-400" />
                </div>
              )}

              {boardData && boardData.entries.length === 0 && (
                <div className="px-4 py-6 text-center text-zinc-500 text-sm">No trains scheduled for this station.</div>
              )}

              {boardData && boardData.entries.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[480px]">
                    <thead>
                      <tr className="border-b border-zinc-800/60">
                        {["Train", "Arrival", "Dep.", "Plat.", "Status"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40">
                      {boardData.entries.map((entry) => (
                        <tr
                          key={entry.train_no}
                          onClick={() => navigate(`/trains/${entry.train_no}`)}
                          className="hover:bg-zinc-800/40 transition-colors cursor-pointer active:bg-zinc-700/40"
                        >
                          <td className="px-3 py-2.5">
                            <p className="text-zinc-100 font-semibold text-[13px] truncate max-w-[160px]">{entry.train_name}</p>
                            <p className="text-[10px] text-zinc-500">{entry.train_no}{entry.train_type ? ` · ${entry.train_type}` : ""}</p>
                          </td>
                          <td className="px-3 py-2.5 text-zinc-300 font-mono text-[13px]">{entry.arrival_time ?? "—"}</td>
                          <td className="px-3 py-2.5 text-zinc-300 font-mono text-[13px]">{entry.departure_time ?? "—"}</td>
                          <td className="px-3 py-2.5">
                            {entry.platform
                              ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-200">{entry.platform}</span>
                              : <span className="text-zinc-600 text-xs">—</span>
                            }
                          </td>
                          <td className="px-3 py-2.5">
                            {entry.status === "On Time" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                On Time
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                                +{entry.delay_minutes}m
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── 4. Search History ── */}
        {trainHistory.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                <Clock size={11} className="text-zinc-600" /> Recent Searches
              </p>
              <button
                onClick={clearTrainHistory}
                className="text-[11px] text-orange-500 font-semibold hover:text-orange-400 transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl overflow-hidden divide-y divide-zinc-800/50">
              {trainHistory.map((item) => (
                <button
                  key={item.sub}
                  onClick={() => navigate(`/trains/${item.sub}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/50 transition-all text-left active:scale-[0.99]"
                >
                  <div className="w-8 h-8 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                    <Train size={14} className="text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-200 truncate">{item.label}</p>
                    <p className="text-[11px] text-zinc-500">{item.meta ?? "Train"}</p>
                  </div>
                  <ChevronRight size={14} className="text-zinc-600 shrink-0" />
                </button>
              ))}
            </div>
          </section>
        )}

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

