import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, Clock, Calendar, Train as TrainIcon, ChevronRight, ArrowLeft, Loader, AlertCircle, CalendarDays } from "lucide-react";
import { trains as trainsApi } from "../lib/api";
import type { TrainBetweenResult } from "../types";

/* ── helpers ─────────────────────────────────────────────────────────────── */

// runs_on is a 7-char binary string: position 0=Mon, 1=Tue, … 5=Sat, 6=Sun
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
function parseRunsOn(runs_on: string | null | undefined): boolean[] {
  const s = (runs_on ?? "").padEnd(7, "0");
  return Array.from({ length: 7 }, (_, i) => s[i] === "1");
}

function fmtDuration(mins: number | null | undefined): string {
  if (!mins || mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const TYPE_BADGE: Record<string, string> = {
  RAJDHANI: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  DURONTO:  "bg-purple-500/15 text-purple-400 border-purple-500/25",
  SHATABDI: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  VANDE:    "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  SUF:      "bg-orange-500/15 text-orange-400 border-orange-500/25",
  MAIL:     "bg-zinc-700/60 text-zinc-400 border-zinc-600/40",
  EXPRESS:  "bg-zinc-700/60 text-zinc-400 border-zinc-600/40",
};

function typeBadge(type: string | null | undefined): string {
  const t = (type ?? "").toUpperCase();
  for (const [k, v] of Object.entries(TYPE_BADGE)) {
    if (t.includes(k)) return v;
  }
  return TYPE_BADGE.MAIL;
}

/* ── component ───────────────────────────────────────────────────────────── */

export default function TrainsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const from    = params.get("from")?.toUpperCase() ?? "";
  const to      = params.get("to")?.toUpperCase()   ?? "";
  const date    = params.get("date") ?? "";
  const allDays = params.get("all_days") === "true";

  const [showPicker, setShowPicker] = useState(false);

  // IST date helpers
  const todayIST    = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const tomorrowIST = (() => {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString("en-CA");
  })();

  // Human-readable date label
  const dateLabel = allDays
    ? "All dates"
    : date === todayIST || !date
    ? "Today"
    : date === tomorrowIST
    ? "Tomorrow"
    : new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  const isCustomDate = !allDays && !!date && date !== todayIST && date !== tomorrowIST;

  // Date update helpers — update URL params without page navigation
  const selectDate = (d: string) => {
    const p = new URLSearchParams(params);
    p.set("date", d);
    p.delete("all_days");
    setParams(p, { replace: true });
    setShowPicker(false);
  };
  const selectAllDays = () => {
    const p = new URLSearchParams(params);
    p.delete("date");
    p.set("all_days", "true");
    setParams(p, { replace: true });
    setShowPicker(false);
  };

  const { data: results, isLoading, isError } = useQuery<TrainBetweenResult[]>({
    queryKey: ["trains-between", from, to, date, allDays],
    queryFn: () => trainsApi.between(from, to, date || undefined, allDays) as Promise<TrainBetweenResult[]>,
    enabled: !!(from && to),
    staleTime: 5 * 60 * 1000,
  });

  const handleSwap = () => {
    if (from && to) {
      const p = new URLSearchParams({ from: to, to: from });
      if (date) p.set("date", date);
      if (allDays) p.set("all_days", "true");
      navigate(`/trains?${p.toString()}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto min-h-screen bg-black pb-24">

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-md border-b border-zinc-900 px-4 pt-5 pb-3">
        {/* Row 1: back + stations + swap */}
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors flex-shrink-0"
          >
            <ArrowLeft size={15} />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-white font-bold text-lg">{from || "—"}</span>
            <button
              onClick={handleSwap}
              className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-orange-400 hover:border-orange-500/40 hover:bg-orange-500/10 transition-all flex-shrink-0"
            >
              <ArrowUpDown size={13} />
            </button>
            <span className="text-white font-bold text-lg">{to || "—"}</span>
          </div>
          {/* All Dates badge — right side */}
          {allDays && (
            <span className="flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-full bg-orange-500/15 border border-orange-500/25 text-orange-400">
              All Days
            </span>
          )}
        </div>

        {/* Row 2: results count */}
        <p className="text-zinc-500 text-xs ml-11 mb-2.5">
          {isLoading
            ? "Searching…"
            : results
            ? `${results.length} train${results.length !== 1 ? "s" : ""} found`
            : from && to
            ? "No results"
            : "Select a route to search"}
        </p>

        {/* Row 3: date quick tabs */}
        <div className="flex gap-1.5 ml-11 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {/* Today */}
          <button
            onClick={() => selectDate(todayIST)}
            className={`flex-shrink-0 text-[11px] font-semibold px-3 py-1 rounded-full border transition-all ${
              !allDays && (date === todayIST || !date)
                ? "bg-orange-500 border-orange-500 text-white shadow-[0_0_8px_rgba(255,69,0,0.4)]"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
            }`}
          >
            Today
          </button>

          {/* Tomorrow */}
          <button
            onClick={() => selectDate(tomorrowIST)}
            className={`flex-shrink-0 text-[11px] font-semibold px-3 py-1 rounded-full border transition-all ${
              !allDays && date === tomorrowIST
                ? "bg-orange-500 border-orange-500 text-white shadow-[0_0_8px_rgba(255,69,0,0.4)]"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
            }`}
          >
            Tomorrow
          </button>

          {/* All Dates */}
          <button
            onClick={selectAllDays}
            className={`flex-shrink-0 text-[11px] font-semibold px-3 py-1 rounded-full border transition-all ${
              allDays
                ? "bg-orange-500 border-orange-500 text-white shadow-[0_0_8px_rgba(255,69,0,0.4)]"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
            }`}
          >
            All Dates
          </button>

          {/* Custom date picker button */}
          <button
            onClick={() => setShowPicker((v) => !v)}
            className={`flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold px-3 py-1 rounded-full border transition-all ${
              isCustomDate
                ? "bg-orange-500 border-orange-500 text-white shadow-[0_0_8px_rgba(255,69,0,0.4)]"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
            }`}
          >
            <CalendarDays size={11} />
            {isCustomDate ? dateLabel : "Pick Date"}
          </button>
        </div>

        {/* Row 4: inline date input (shown when Pick Date is active) */}
        {showPicker && (
          <div className="ml-11 mt-2">
            <input
              type="date"
              max={new Date(new Date().setFullYear(new Date().getFullYear() + 1))
                .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}
              value={isCustomDate ? date : ""}
              onChange={(e) => { if (e.target.value) selectDate(e.target.value); }}
              className="px-3 py-1.5 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs font-medium focus:outline-none focus:border-orange-500/50 [color-scheme:dark]"
            />
          </div>
        )}
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-zinc-500">
          <Loader size={24} className="animate-spin text-orange-400" />
          <p className="text-sm">Finding trains…</p>
        </div>
      )}

      {/* ── Error ── */}
      {isError && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center px-8">
          <AlertCircle size={28} className="text-red-400" />
          <p className="text-zinc-300 font-semibold">Failed to load trains</p>
          <p className="text-zinc-600 text-sm">Check your connection or try again.</p>
        </div>
      )}

      {/* ── Train cards ── */}
      {results && results.length > 0 && (
        <div className="px-4 py-4 space-y-3">
          {results.map((train) => {
            const badgeCls = typeBadge(train.train_type);
            const originDays = parseRunsOn(train.runs_on);
            // Shift days forward by (from_day - 1) so the dot lights up on the day
            // the train actually reaches the user's FROM station, not the origin.
            const dayOffset = Math.max(0, (train.from_day ?? 1) - 1);
            const days = dayOffset === 0
              ? originDays
              : originDays.map((_, i) => originDays[(i - dayOffset + 7) % 7]);
            return (
              <button
                key={train.train_no}
                onClick={() => navigate(`/trains/${train.train_no}?from=${from}&to=${to}`)}
                className="w-full bg-zinc-900/70 border border-zinc-800/60 rounded-2xl p-4 text-left hover:border-orange-500/30 hover:bg-zinc-900 transition-all active:scale-[0.98] group"
              >
                {/* Top row: name + type badge + chevron */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {train.train_type && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeCls}`}>
                          {train.train_type}
                        </span>
                      )}
                      <span className="text-[11px] text-zinc-500 font-semibold">
                        #{train.train_no}
                      </span>
                    </div>
                    <p className="text-white font-bold text-base mt-1 leading-tight truncate">
                      {train.name}
                    </p>
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-zinc-600 group-hover:text-orange-400 transition-colors shrink-0 mt-1"
                  />
                </div>

                {/* Time row */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-center">
                    <p className="text-white font-bold text-xl tabular-nums leading-none">
                      {train.departure_time ?? "—"}
                    </p>
                    <p className="text-zinc-500 text-[10px] mt-0.5">{from}</p>
                  </div>

                  <div className="flex-1 flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1 text-zinc-600">
                      <div className="h-px flex-1 bg-zinc-800" />
                      <Clock size={11} className="text-zinc-600" />
                      <div className="h-px flex-1 bg-zinc-800" />
                    </div>
                    <p className="text-zinc-500 text-[10px] font-semibold">
                      {fmtDuration(train.duration_minutes)}
                    </p>
                  </div>

                  <div className="text-center">
                    <p className="text-white font-bold text-xl tabular-nums leading-none">
                      {train.arrival_time ?? "—"}
                    </p>
                    <p className="text-zinc-500 text-[10px] mt-0.5">
                      {to}{train.to_day > train.from_day ? ` +${train.to_day - train.from_day}d` : ""}
                    </p>
                  </div>
                </div>

                {/* Running days */}
                <div className="flex items-center gap-1.5">
                  <Calendar size={11} className="text-zinc-600 shrink-0" />
                  <div className="flex gap-1">
                    {DAY_LABELS.map((d, i) => (
                      <span
                        key={i}
                        className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors ${
                          days[i]
                            ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                            : "bg-zinc-800/60 text-zinc-600 border border-zinc-800/40"
                        }`}
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── No results ── */}
      {results && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center px-8">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
            <TrainIcon size={28} className="text-zinc-600" />
          </div>
          <p className="text-zinc-300 font-semibold mb-1">No trains found</p>
          <p className="text-zinc-600 text-sm">
            No direct trains run between {from} and {to}.
          </p>
        </div>
      )}

      {/* ── Empty state (when no from/to) ── */}
      {!from && !to && (
        <div className="flex flex-col items-center justify-center py-24 text-center px-8">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
            <TrainIcon size={28} className="text-orange-400" />
          </div>
          <p className="text-zinc-300 font-semibold mb-1">No route selected</p>
          <p className="text-zinc-600 text-sm">
            Use Search to plan a journey and find trains.
          </p>
        </div>
      )}
    </div>
  );
}

