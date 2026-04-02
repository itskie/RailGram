import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TrainSearchBox from "../components/TrainSearchBox";
import StationAutocomplete from "../components/StationAutocomplete";
import { useRecentSearches } from "../hooks/useRecentSearches";
import {
  ArrowUpDown,
  Train,
  Clock,
  ChevronRight,
  Calendar,
  MapPin,
} from "lucide-react";

const POPULAR_STATIONS = [
  { code: "NDLS", name: "New Delhi" },
  { code: "HWH", name: "Howrah Junction" },
  { code: "CSTM", name: "Mumbai CSMT" },
  { code: "MAS", name: "Chennai Central" },
];


export default function SearchPage() {
  const navigate = useNavigate();

  // ── Trip search ────────────────────────────────────────────────────────────
  const [fromStation, setFromStation] = useState("");
  const [toStation, setToStation] = useState("");
  const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
  const [journeyDate, setJourneyDate] = useState(todayIST);
  const [allDays, setAllDays] = useState(false);

  const handleSwap = () => {
    setFromStation(toStation);
    setToStation(fromStation);
  };

  const handleFindTrains = () => {
    const from = fromStation.trim().toUpperCase();
    const to = toStation.trim().toUpperCase();
    if (!from || !to) return;
    const p = new URLSearchParams({ from, to, date: journeyDate });
    if (allDays) p.set("all_days", "true");
    navigate(`/trains?${p.toString()}`);
  };

  // ── Direct train search ────────────────────────────────────────────────────
  // Handled by TrainSearchBox component (navigates on select/enter)

  // ── Train search history ──────────────────────────────────────────────────
  const { history: trainHistory, clear: clearTrainHistory } = useRecentSearches("rg_trains_recent");

  return (
    <div className="max-w-2xl mx-auto min-h-screen bg-black pb-24">
      {/* ── Page header ── */}
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-md px-4 pt-6 pb-4 border-b border-zinc-900">
        <h1 className="text-xl font-bold text-white">Search</h1>
        <p className="text-zinc-500 text-xs mt-0.5">Trains · Stations</p>
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

            {/* Date picker row */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Calendar size={14} className="text-zinc-500" />
                </div>
                <input
                  type="date"
                  value={journeyDate}
                  min={todayIST}
                  onChange={(e) => { setJourneyDate(e.target.value); setAllDays(false); }}
                  className="w-full bg-zinc-950 border border-zinc-800/70 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50 focus:ring-1 ring-orange-500/20 transition-all"
                  style={{ colorScheme: "dark" }}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer shrink-0 select-none">
                <div
                  onClick={() => setAllDays((v) => !v)}
                  className={`w-8 h-4.5 rounded-full transition-colors flex items-center px-0.5 ${
                    allDays ? "bg-orange-500" : "bg-zinc-700"
                  }`}
                  style={{ minWidth: 32, height: 18 }}
                >
                  <div className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
                    allDays ? "translate-x-3.5" : "translate-x-0"
                  }`} />
                </div>
                <span className="text-[11px] font-semibold text-zinc-400">All dates</span>
              </label>
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
          <TrainSearchBox placeholder="Train number or name (e.g. 12301 Howrah Rajdhani)" />
        </section>

        {/* ── 3. Live Station Board ── */}
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Live Station Board</p>
          <StationAutocomplete
            value=""
            onChange={(code) => { if (code) navigate(`/stations/${code}`); }}
            placeholder="Station code or name (e.g. NDLS)"
            dot="filled"
          />
        </section>

        {/* ── 4. Search History ── */}
        {trainHistory.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-zinc-600" />
                <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Recent Searches</p>
              </div>
              <button
                onClick={clearTrainHistory}
                className="text-[11px] text-orange-500 font-semibold hover:text-orange-400 transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="space-y-2">
              {trainHistory.map((item) => (
                <button
                  key={item.sub}
                  onClick={() => navigate(`/trains/${item.sub}`)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl hover:bg-zinc-900 hover:border-zinc-700/60 transition-all text-left active:scale-[0.99] group"
                >
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                    <Train size={16} className="text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-100 truncate">{item.label}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{item.meta ?? "Train"}</p>
                  </div>
                  <ChevronRight size={15} className="text-zinc-600 group-hover:text-orange-400 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── 5. Station Quick Links ── */}
        {trainHistory.length === 0 && (
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-1.5">
              <MapPin size={11} className="text-zinc-600" /> Popular Stations
            </p>
            <div className="grid grid-cols-2 gap-2">
              {POPULAR_STATIONS.map((s) => (
                <button
                  key={s.code}
                  onClick={() => navigate(`/stations/${s.code}`)}
                  className="flex items-center gap-3 px-4 py-3.5 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl hover:bg-zinc-900 hover:border-zinc-700/60 transition-all text-left group"
                >
                  <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700/50 flex items-center justify-center shrink-0">
                    <MapPin size={14} className="text-zinc-400 group-hover:text-orange-400 transition-colors" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-200 font-mono">{s.code}</p>
                    <p className="text-[10px] text-zinc-500 truncate mt-0.5">{s.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}



      </div>
    </div>
  );
}

