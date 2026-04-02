import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import React, { useState, useEffect, useRef } from "react";
import { trains as trainsApi } from "../lib/api";
import type { LivePosition, TrainSchedule, ScheduleStop } from "../types";
import {
  Train as TrainIcon, ArrowLeft, ChevronDown, ChevronUp,
  Clock, Gauge, Radio, Loader, MapPin, CalendarDays, X,
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
  const [calOpen, setCalOpen] = useState(false);
  const mapRef  = useRef<HTMLDivElement>(null);
  const mapIns  = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  /* IST today as YYYY-MM-DD */
  function istToday(): string {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function istOffset(daysAgo: number): string {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    d.setDate(d.getDate() - daysAgo);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const TODAY = istToday();
  const YESTERDAY = istOffset(1);
  const DAY_BEFORE = istOffset(2);

  /* selectedDate: YYYY-MM-DD (IST). undefined = today (no param sent) */
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);

  /* resolved start date: undefined means today → no query param */
  const startDate = selectedDate === TODAY ? undefined : selectedDate;

  /* Calendar state */
  const [calYear, setCalYear]   = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth()); // 0-based

  function fmtChipLabel(d: string | undefined): string {
    if (!d || d === TODAY) return "Today";
    if (d === YESTERDAY) return "Yesterday";
    if (d === DAY_BEFORE) return "Day Before";
    const [, m, day] = d.split("-");
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${parseInt(day)} ${MONTHS[parseInt(m) - 1]}`;
  }

  /* queries */
  const { data: schedule, isLoading: schedLoading } = useQuery<TrainSchedule>({
    queryKey: ["schedule", trainNo],
    queryFn: () => trainsApi.schedule(trainNo!) as Promise<TrainSchedule>,
    enabled: !!trainNo,
  });

  const { data: pos } = useQuery<LivePosition>({
    queryKey: ["live", trainNo, selectedDate],
    queryFn: () => trainsApi.livePosition(trainNo!, startDate) as Promise<LivePosition>,
    enabled: !!trainNo,
    refetchInterval: 30_000,
  });

  /* current station index */
  const currentIdx = schedule?.stops.findIndex(
    (s) => s.station_code === (pos?.current_station_code ?? pos?.next_station_code)
  ) ?? -1;

  /* Day of journey the train is currently on */
  const currentJourneyDay = currentIdx >= 0 ? schedule!.stops[currentIdx].day : null;

  /* Has the train reached its final destination? */
  const lastStop = schedule?.stops[schedule.stops.length - 1];
  const hasReachedDestination = !!schedule && schedule.stops.length > 0 && (
    currentIdx === schedule.stops.length - 1 ||
    (!!pos?.current_station_code && pos.current_station_code === lastStop?.station_code)
  );

  /* Is this a past-date journey (user selected a date before today)? */
  const isPastJourney = !!selectedDate && selectedDate !== TODAY;

  /* Has the train departed its source TODAY?
     Source departure time is stops[0].departure_time (HH:MM).
     If 'Today' is selected and current IST time < departure time → not started yet. */
  const trainNotStartedYet = (() => {
    if (selectedDate && selectedDate !== TODAY) return false; // past date — always show
    const srcDep = schedule?.stops[0]?.departure_time ?? schedule?.stops[0]?.arrival_time;
    if (!srcDep) return false;
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const [h, m] = srcDep.split(":").map(Number);
    const depMinutes = h * 60 + m;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return nowMinutes < depMinutes;
  })();

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

          {/* Day indicator */}
          {stop.day > 0 && (
            <p className="text-[10px] text-zinc-600 mt-1.5">
              Day {stop.day}{stop.distance_km > 0 ? ` · ${stop.distance_km} km from source` : ""}
            </p>
          )}

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

            {/* live badge + journey day */}
            {hasReachedDestination ? (
              <div className="flex-shrink-0 text-right">
                <span className="text-[10px] px-2 py-0.5 rounded-full border bg-green-500/20 text-green-400 border-green-500/30 font-medium">
                  🏁 Reached Destination
                </span>
                {pos && pos.delay_minutes !== 0 && (
                  <p className={`text-xs font-bold mt-0.5 ${pos.delay_minutes > 0 ? "text-red-400" : "text-green-400"}`}>
                    {fmtDelay(pos.delay_minutes)}
                  </p>
                )}
              </div>
            ) : pos ? (
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
                {currentJourneyDay !== null && (
                  <p className="text-[10px] text-orange-400/80 mt-0.5 font-medium">
                    Journey Day {currentJourneyDay}
                  </p>
                )}
              </div>
            ) : null}
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

      {/* ── Journey date picker ── */}
      <div className="px-4 py-3 border-b border-zinc-800/40">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-zinc-500 flex-shrink-0">Started:</span>

          {/* Today chip */}
          <button
            onClick={() => setSelectedDate(undefined)}
            className={`text-xs px-3 py-1 rounded-full border transition-all ${
              !selectedDate || selectedDate === TODAY
                ? "bg-orange-500/20 border-orange-500/40 text-orange-300 font-medium"
                : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700"
            }`}
          >
            Today
          </button>

          {/* Yesterday chip */}
          <button
            onClick={() => setSelectedDate(YESTERDAY)}
            className={`text-xs px-3 py-1 rounded-full border transition-all ${
              selectedDate === YESTERDAY
                ? "bg-orange-500/20 border-orange-500/40 text-orange-300 font-medium"
                : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700"
            }`}
          >
            Yesterday
          </button>

          {/* Day Before chip */}
          <button
            onClick={() => setSelectedDate(DAY_BEFORE)}
            className={`text-xs px-3 py-1 rounded-full border transition-all ${
              selectedDate === DAY_BEFORE
                ? "bg-orange-500/20 border-orange-500/40 text-orange-300 font-medium"
                : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700"
            }`}
          >
            Day Before
          </button>

          {/* Custom date chip (calendar-picked, not one of the 3 above) */}
          {selectedDate && selectedDate !== TODAY && selectedDate !== YESTERDAY && selectedDate !== DAY_BEFORE && (
            <span className="text-xs px-3 py-1 rounded-full border bg-orange-500/20 border-orange-500/40 text-orange-300 font-medium">
              {fmtChipLabel(selectedDate)}
            </span>
          )}

          {/* Calendar pick button — always visible, orange */}
          <button
            onClick={() => {
              const d = selectedDate ? new Date(selectedDate + "T00:00:00") : new Date();
              setCalYear(d.getFullYear());
              setCalMonth(d.getMonth());
              setCalOpen(true);
            }}
            className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border border-orange-500/50 text-orange-400 hover:bg-orange-500/10 transition-all"
            title="Pick any past date"
          >
            <CalendarDays size={12} style={{ color: "#ff4500" }} />
            <span>Select Date</span>
          </button>
        </div>
      </div>

      {/* ── OLED Calendar Modal ── */}
      {calOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
          onClick={() => setCalOpen(false)}
        >
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          <div
            className="relative z-10 w-full max-w-sm mx-4 mb-4 sm:mb-0 rounded-2xl border border-zinc-800 shadow-2xl"
            style={{ background: "#111111" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-800/60">
              <p className="text-sm font-semibold text-zinc-100">Select journey start date</p>
              <button onClick={() => setCalOpen(false)} className="text-zinc-500 hover:text-zinc-200">
                <X size={16} />
              </button>
            </div>

            {/* Month navigator */}
            <div className="flex items-center justify-between px-5 py-3">
              <button
                onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}
                className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                ‹
              </button>
              <span className="text-sm font-medium text-zinc-200">
                {["January","February","March","April","May","June","July","August","September","October","November","December"][calMonth]} {calYear}
              </span>
              <button
                onClick={() => {
                  const nextIsAfterToday = calYear > new Date().getFullYear() ||
                    (calYear === new Date().getFullYear() && calMonth >= new Date().getMonth());
                  if (nextIsAfterToday) return;
                  if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1);
                }}
                className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-30"
              >
                ›
              </button>
            </div>

            {/* Day-of-week header */}
            <div className="grid grid-cols-7 px-5 mb-1">
              {["M","T","W","T","F","S","S"].map((d, i) => (
                <div key={i} className="text-center text-[10px] text-zinc-600 font-medium py-1">{d}</div>
              ))}
            </div>

            {/* Day grid */}
            {(() => {
              const firstDay = new Date(calYear, calMonth, 1);
              // weeks start Monday: 0=Mon…6=Sun
              const startOffset = (firstDay.getDay() + 6) % 7;
              const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
              const todayIST = TODAY;
              const cells: React.ReactElement[] = [];

              for (let i = 0; i < startOffset; i++) {
                cells.push(<div key={`e${i}`} />);
              }
              for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isFuture = dateStr > todayIST;
                const isSelected = dateStr === (selectedDate ?? todayIST);
                const isToday = dateStr === todayIST;
                cells.push(
                  <button
                    key={day}
                    disabled={isFuture}
                    onClick={() => { setSelectedDate(dateStr === todayIST ? undefined : dateStr); setCalOpen(false); }}
                    className={`mx-auto flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-all
                      ${ isFuture
                          ? "text-zinc-700 cursor-not-allowed"
                          : isSelected
                          ? "bg-orange-500 text-white shadow-[0_0_10px_rgba(255,69,0,0.5)]"
                          : isToday
                          ? "border border-orange-500/40 text-orange-300"
                          : "text-zinc-300 hover:bg-zinc-800"
                      }`}
                  >
                    {day}
                  </button>
                );
              }
              return <div className="grid grid-cols-7 gap-y-1 px-5 pb-5">{cells}</div>;
            })()}
          </div>
        </div>
      )}

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

        {/* Train hasn't departed from source yet today */}
        {!schedLoading && trainNotStartedYet && schedule && (
          <div className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-300">
            ⏳ Train yet to start from source
            <span className="block text-xs text-yellow-500/70 mt-0.5">
              Departs {schedule.stops[0]?.departure_time} from {schedule.stops[0]?.station_name} ({schedule.stops[0]?.station_code})
            </span>
          </div>
        )}

        {/* Reached destination summary card */}
        {!schedLoading && hasReachedDestination && lastStop && (
          <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-3">
            <p className="text-sm font-semibold text-green-400">🏁 Journey Complete</p>
            <p className="text-xs text-zinc-400 mt-1">
              Reached <span className="text-zinc-200 font-medium">{lastStop.station_name}</span>
              {lastStop.arrival_time && (
                <> at <span className="font-mono text-zinc-200">{lastStop.arrival_time}</span></>
              )}
              {pos && pos.delay_minutes !== 0 && (
                <span className={`ml-1 font-medium ${pos.delay_minutes > 0 ? "text-red-400" : "text-green-400"}`}>
                  ({pos.delay_minutes > 0 ? "+" : ""}{pos.delay_minutes} min)
                </span>
              )}
            </p>
          </div>
        )}

        {/* Past journey banner (no live data for selected past date) */}
        {!schedLoading && isPastJourney && !hasReachedDestination && schedule && (
          <div className="mb-4 rounded-xl border border-zinc-700/50 bg-zinc-900/40 px-4 py-3 text-xs text-zinc-500">
            📅 Showing schedule for <span className="text-zinc-300">{fmtChipLabel(selectedDate)}</span> — live tracking unavailable for past dates
          </div>
        )}

        {schedule?.stops.map((stop, idx) => {
          const prevDay = idx > 0 ? schedule.stops[idx - 1].day : null;
          const showDayDivider = stop.day > 1 && stop.day !== prevDay;
          return (
            <React.Fragment key={stop.station_code + idx}>
              {showDayDivider && (
                <div className="flex items-center gap-3 px-2 py-3">
                  <div className="flex-1 border-t border-dashed border-zinc-800" />
                  <span className="text-[10px] font-semibold text-orange-400/70 bg-orange-500/10 border border-orange-500/20 px-2.5 py-0.5 rounded-full tracking-wide">
                    DAY {stop.day}
                  </span>
                  <div className="flex-1 border-t border-dashed border-zinc-800" />
                </div>
              )}
              <StationRow stop={stop} idx={idx} />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

