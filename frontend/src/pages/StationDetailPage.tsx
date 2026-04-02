import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { stations as stationsApi } from "../lib/api";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  AlertCircle,
  Train,
} from "lucide-react";

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
  as_of: string; // ISO UTC string
}

/** Format ISO UTC timestamp as HH:mm (24-hour, IST) */
function formatAsOf(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return iso.slice(11, 16);
  }
}

export default function StationDetailPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const stationCode = (code ?? "").toUpperCase();

  const {
    data: boardData,
    isLoading,
    isError,
    dataUpdatedAt,
  } = useQuery<BoardResponse>({
    queryKey: ["station-board", stationCode],
    queryFn: () => stationsApi.board(stationCode) as Promise<BoardResponse>,
    enabled: stationCode.length >= 2,
    refetchInterval: 60_000,
    staleTime: 55_000,
  });

  return (
    <div className="max-w-2xl mx-auto min-h-screen bg-black pb-24">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-md px-4 pt-6 pb-4 border-b border-zinc-900">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all active:scale-90"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white truncate">
              {boardData?.station_name ?? stationCode}
            </h1>
            <p className="text-zinc-500 text-xs mt-0.5">
              Live Station Board · {stationCode}
            </p>
          </div>
          {/* Last-refreshed timestamp */}
          {boardData && (
            <span className="text-[11px] text-zinc-500 flex items-center gap-1 shrink-0">
              <RefreshCw size={10} className="text-zinc-600" />
              {formatAsOf(boardData.as_of)}
            </span>
          )}
          {isLoading && (
            <Loader2 size={16} className="animate-spin text-orange-400 shrink-0" />
          )}
        </div>
      </div>

      <div className="px-4 py-4">
        {/* ── Error state ── */}
        {isError && (
          <div className="flex items-center gap-3 px-4 py-6 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl text-zinc-500 text-sm mt-2">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            Could not load station data. Please try again.
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {isLoading && !boardData && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-orange-400" />
          </div>
        )}

        {/* ── Empty ── */}
        {boardData && boardData.entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <Train size={36} className="mb-3 text-zinc-700" />
            <p className="text-sm">No trains scheduled for this station.</p>
          </div>
        )}

        {/* ── Board table ── */}
        {boardData && boardData.entries.length > 0 && (
          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl overflow-hidden">
            {/* Column header */}
            <div className="hidden sm:grid grid-cols-[1fr_80px_80px_52px_100px] border-b border-zinc-800/60">
              {["Train", "Arrival", "Dep.", "Plat.", "Status"].map((h) => (
                <div
                  key={h}
                  className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
                >
                  {h}
                </div>
              ))}
            </div>

            <div className="divide-y divide-zinc-800/40">
              {boardData.entries.map((entry) => (
                <button
                  key={entry.train_no}
                  onClick={() => navigate(`/trains/${entry.train_no}`)}
                  className="w-full text-left transition-colors hover:bg-zinc-800/40 active:bg-zinc-700/40"
                >
                  {/* Mobile: stacked layout */}
                  <div className="sm:hidden px-4 py-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-zinc-100 font-semibold text-sm truncate">
                          {entry.train_name}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {entry.train_no}
                          {entry.train_type ? ` · ${entry.train_type}` : ""}
                        </p>
                      </div>
                      {entry.status === "On Time" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          On Time
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-400 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          +{entry.delay_minutes}m
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 text-[12px] text-zinc-400 font-mono">
                      <span>Arr: {entry.arrival_time ?? "—"}</span>
                      <span>Dep: {entry.departure_time ?? "—"}</span>
                      {entry.platform && (
                        <span className="inline-flex items-center justify-center px-1.5 h-5 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-zinc-200">
                          Plt {entry.platform}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Desktop: grid layout */}
                  <div className="hidden sm:grid grid-cols-[1fr_80px_80px_52px_100px] items-center">
                    <div className="px-3 py-3">
                      <p className="text-zinc-100 font-semibold text-[13px] truncate">
                        {entry.train_name}
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        {entry.train_no}
                        {entry.train_type ? ` · ${entry.train_type}` : ""}
                      </p>
                    </div>
                    <div className="px-3 py-3 text-zinc-300 font-mono text-[13px]">
                      {entry.arrival_time ?? "—"}
                    </div>
                    <div className="px-3 py-3 text-zinc-300 font-mono text-[13px]">
                      {entry.departure_time ?? "—"}
                    </div>
                    <div className="px-3 py-3">
                      {entry.platform ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-200">
                          {entry.platform}
                        </span>
                      ) : (
                        <span className="text-zinc-600 text-xs">—</span>
                      )}
                    </div>
                    <div className="px-3 py-3">
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
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Footer: refresh note */}
            <div className="px-4 py-2.5 border-t border-zinc-800/60 flex items-center gap-1.5 text-[11px] text-zinc-600">
              <RefreshCw size={10} />
              Auto-refreshes every 60 seconds
              {dataUpdatedAt > 0 && (
                <span className="ml-auto">
                  Updated {formatAsOf(new Date(dataUpdatedAt).toISOString())}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
