import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { trains as trainsApi } from "../lib/api";
import type { LivePosition, TrainSchedule, ScheduleStop } from "../types";
import {
  Train as TrainIcon, ArrowLeft, ChevronDown, ChevronUp,
  Clock, Gauge, Radio, Loader, MapPin,
} from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/* ── helpers ─────────────────────────────────────────────────────────────── */

function fmtDelay(mins: number) {
  if (mins === 0) return null;
  return mins > 0 ? `+${mins}m` : `${mins}m`;
}

function expectedTime(scheduled: string | null | undefined, delaymins: number): string | null {
  if (!scheduled) return null;
  const [h, m] = scheduled.split(":").map(Number);
  const total = h * 60 + m + delaymins;
  const eh = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const em = ((total % 1440) + 1440) % 1440 % 60;
  return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
}

const SOURCE_BADGE: Record<string, string> = {
  gps:        "bg-green-500/20 text-green-400 border-green-500/30",
  spotter:    "bg-blue-500/20  text-blue-400  border-blue-500/30",
  cell_tower: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  schedule:   "bg-zinc-800 text-zinc-400 border-zinc-700",
  unknown:    "bg-zinc-800 text-zinc-500 border-zinc-700",
};

const TYPE_COLORS: Record<string, string> = {
  RAJDHANI: "bg-blue-500/20  text-blue-300",
  DURONTO:  "bg-purple-500/20 text-purple-300",
  SHATABDI: "bg-yellow-500/20 text-yellow-300",
  VANDE:    "bg-cyan-500/20  text-cyan-300",
  SUF:      "bg-orange-500/20 text-orange-300",
  MAIL:     "bg-zinc-700 text-zinc-300",
};

/* ── component ───────────────────────────────────────────────────────────── */

export default function TrainDetailPage() {
  const { trainNo } = useParams<{ trainNo: string }>();
  const nav = useNavigate();
  const [mapOpen, setMapOpen] = useState(false);
  const mapRef  = useRef<HTMLDivElement>(null);
  const mapIns  = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  /* queries */
  const { data: schedule, isLoading: schedLoading } = useQuery<TrainSchedule>({
    queryKey: ["schedule", trainNo],
    queryFn: () => trainsApi.schedule(trainNo!) as Promise<TrainSchedule>,
    enabled: !!trainNo,
  });

  const { data: pos } = useQuery<LivePosition>({
    queryKey: ["live", trainNo],
    queryFn: () => trainsApi.livePosition(trainNo!) as Promise<LivePosition>,
    enabled: !!trainNo,
    refetchInterval: 30_000,
  });

  /* current station index */
  const currentIdx = schedule?.stops.findIndex(
    (s) => s.station_code === (pos?.current_station_code ?? pos?.next_station_code)
  ) ?? -1;

  /* map init */
  useEffect(() => {
    if (!mapOpen || !mapRef.current || mapIns.current) return;
    mapIns.current = new maplibregl.Map({
      container: mapRef.current,
      style: {
        version: 8,
        sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256 } },
        layers:  [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [80.27, 22.09],
      zoom: 4,
      interactive: true,
    });
    return () => { mapIns.current?.remove(); mapIns.current = null; };
  }, [mapOpen]);

  /* place / move marker */
  useEffect(() => {
    if (!pos?.latitude || !pos.longitude || !mapIns.current) return;
    if (markerRef.current) {
      markerRef.current.setLngLat([pos.longitude, pos.latitude]);
    } else {
      const el = document.createElement("div");
      el.style.cssText =
        "width:18px;height:18px;background:#ff4500;border-radius:50%;border:2px solid #fff;box-shadow:0 0 10px rgba(255,69,0,0.8)";
      markerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([pos.longitude, pos.latitude])
        .addTo(mapIns.current);
    }
    mapIns.current.flyTo({ center: [pos.longitude, pos.latitude], zoom: 7 });
  }, [pos, mapOpen]);

  /* ── station row ────────────────────────────────────────────────────────── */
  function StationRow({ stop, idx }: { stop: ScheduleStop; idx: number }) {
    const isCurrent  = idx === currentIdx;
    const isPassed   = currentIdx >= 0 && idx < currentIdx;
    const delay      = pos?.delay_minutes ?? 0;
    const schArrival = stop.arrival_time ?? stop.departure_time;
    const schDep     = stop.departure_time ?? stop.arrival_time;
    const expArrival = isCurrent || (!isPassed && idx > currentIdx) ? expectedTime(schArrival, delay) : null;
    const isLate     = delay > 0;

    /* dot colour */
    const dotClass = isCurrent
      ? "bg-orange-500 shadow-[0_0_10px_rgba(255,69,0,0.9)]"
      : isPassed
      ? "bg-blue-600"
      : "bg-zinc-700 border border-zinc-600";

    return (
      <div className="flex gap-0 relative">
        {/* Timeline spine + dot */}
        <div className="flex flex-col items-center w-10 flex-shrink-0">
          {/* top line */}
          <div className={`w-0.5 flex-1 min-h-[16px] ${isPassed || isCurrent ? "bg-blue-600" : "bg-zinc-800"}`} />
          {/* dot */}
          <div className={`w-3 h-3 rounded-full flex-shrink-0 z-10 ${dotClass}`} />
          {/* bottom line */}
          <div className={`w-0.5 flex-1 min-h-[16px] ${isPassed ? "bg-blue-600" : "bg-zinc-800"}`} />
        </div>

        {/* Timing (left) */}
        <div className="w-24 flex-shrink-0 flex flex-col justify-center py-3 pr-2 text-right">
          <span className="text-xs text-zinc-400 font-mono tabular-nums">{schArrival ?? "—"}</span>
          {expArrival && expArrival !== schArrival && (
            <span className={`text-xs font-mono tabular-nums mt-0.5 ${isLate ? "text-red-400" : "text-green-400"}`}>
              {expArrival}
            </span>
          )}
          {isCurrent && isLate && (
            <span className="text-[10px] text-red-400 mt-0.5">{fmtDelay(delay)} late</span>
          )}
        </div>

        {/* Station info (right) */}
        <div
          className={`flex-1 ml-3 my-1.5 rounded-xl px-4 py-3 border transition-colors
            ${isCurrent
              ? "bg-orange-500/10 border-orange-500/40 shadow-[0_0_16px_rgba(255,69,0,0.15)]"
              : isPassed
              ? "bg-zinc-950 border-zinc-800/40"
              : "bg-[#111111] border-zinc-800/40"
            }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={`font-semibold text-sm leading-tight ${isCurrent ? "text-orange-300" : isPassed ? "text-zinc-500" : "text-zinc-100"}`}>
                {stop.station_name}
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">{stop.station_code}</p>
            </div>
            {isCurrent && (
              <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0">
                🚂 HERE
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2 text-[11px] text-zinc-500">
            {stop.platform && (
              <span className="flex items-center gap-1">
                <MapPin size={9} /> Pf {stop.platform}
              </span>
            )}
            {stop.distance_km > 0 && (
              <span className="flex items-center gap-1">
                <Gauge size={9} /> {stop.distance_km} km
              </span>
            )}
            {stop.halt_minutes > 0 && (
              <span className="flex items-center gap-1">
                <Clock size={9} /> {stop.halt_minutes}m halt
              </span>
            )}
          </div>

          {/* departure time if different from arrival */}
          {stop.departure_time && stop.arrival_time && stop.departure_time !== stop.arrival_time && (
            <p className="text-[11px] text-zinc-600 mt-1">
              Dep: <span className="text-zinc-400 font-mono">{stop.departure_time}</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ── render ─────────────────────────────────────────────────────────────── */

  const train = schedule; /* TrainSchedule extends TrainBrief */
  const typeBadge = Object.entries(TYPE_COLORS).find(([k]) =>
    train?.train_type?.toUpperCase().includes(k)
  )?.[1] ?? "bg-zinc-700 text-zinc-300";

  return (
    <div className="max-w-2xl mx-auto pb-10" style={{ background: "#000" }}>
      {/* ── sticky header ── */}
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-sm border-b border-zinc-800/50 px-4 pt-4 pb-3">
        <button
          onClick={() => nav(-1)}
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 mb-3"
        >
          <ArrowLeft size={15} /> Back
        </button>

        {train ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center flex-shrink-0"
                   style={{ boxShadow: "0 0 12px rgba(255,69,0,0.3)" }}>
                <TrainIcon size={18} className="text-orange-400" />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-base text-zinc-100 truncate">{train.name}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-zinc-500 font-mono">{train.train_no}</span>
                  {train.train_type && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${typeBadge}`}>
                      {train.train_type}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* live badge */}
            {pos && (
              <div className="flex-shrink-0 text-right">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${SOURCE_BADGE[pos.source] ?? SOURCE_BADGE.unknown}`}>
                  <Radio size={8} className="inline mr-1" />
                  {pos.source}
                </span>
                {pos.delay_minutes !== 0 && (
                  <p className={`text-xs font-bold mt-0.5 ${pos.delay_minutes > 0 ? "text-red-400" : "text-green-400"}`}>
                    {fmtDelay(pos.delay_minutes)}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : schedLoading ? (
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <Loader size={14} className="animate-spin" /> Loading…
          </div>
        ) : null}
      </div>

      {/* ── collapsible mini-map ── */}
      <div className="border-b border-zinc-800/50">
        <button
          onClick={() => setMapOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-zinc-400 hover:text-zinc-200"
        >
          <span className="flex items-center gap-1.5">
            <MapPin size={12} className="text-orange-400" />
            Live Map {pos?.latitude ? `(${pos.latitude.toFixed(2)}, ${pos.longitude?.toFixed(2)})` : ""}
          </span>
          {mapOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {mapOpen && (
          <div className="h-52 border-t border-zinc-800/50">
            <div ref={mapRef} className="w-full h-full" />
          </div>
        )}
      </div>

      {/* ── route meta bar ── */}
      {train && (
        <div className="flex items-center gap-4 px-4 py-3 text-xs text-zinc-500 border-b border-zinc-800/30">
          <span className="font-mono text-zinc-300">{train.origin_code}</span>
          <span className="flex-1 border-t border-dashed border-zinc-700" />
          <span className="text-zinc-400">{train.total_distance_km ? `${train.total_distance_km} km` : ""}</span>
          <span className="flex-1 border-t border-dashed border-zinc-700" />
          <span className="font-mono text-zinc-300">{train.destination_code}</span>
        </div>
      )}

      {/* ── timeline ── */}
      <div className="px-4 pt-4">
        {schedLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-500">
            <Loader size={24} className="animate-spin" />
            <p className="text-sm">Loading timetable…</p>
          </div>
        )}

        {!schedLoading && schedule?.stops.length === 0 && (
          <p className="text-zinc-500 text-sm text-center py-10">No schedule data available.</p>
        )}

        {schedule?.stops.map((stop, idx) => (
          <StationRow key={stop.station_code + idx} stop={stop} idx={idx} />
        ))}
      </div>
    </div>
  );
}

