import { useParams, useNavigate, useSearchParams } from "react-router-dom";
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
  const [searchParams] = useSearchParams();
  /* Journey context from search page (e.g. DHN→HWH) */
  const ctxFrom = searchParams.get("from")?.toUpperCase() ?? null;
  const ctxTo   = searchParams.get("to")?.toUpperCase()   ?? null;
  const [mapOpen, setMapOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [showPreStops, setShowPreStops] = useState(false);
  const [showPostStops, setShowPostStops] = useState(false);
  const mapRef  = useRef<HTMLDivElement>(null);
  const mapIns  = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  /* ── "I AM ON THIS TRAIN" GPS state ── */
  const [onTrain, setOnTrain] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [smoothDistKm, setSmoothDistKm] = useState<number | null>(null); // live km from source
  const [liveSpeedKmh, setLiveSpeedKmh] = useState<number | null>(null); // live speed display
  const gpsWatchId = useRef<number | null>(null);

  /* Smooth interpolation: delta-time rAF loop advances position at GPS speed */
  const smoothDistRef = useRef<number | null>(null);  // authoritative interpolated dist (km)
  const speedKmPerMinRef = useRef<number>(0);         // speed from last GPS fix (km/min)
  const prevTickTimeRef = useRef<number>(0);          // last tick timestamp for delta-time
  const lastRenderTimeRef = useRef<number>(0);        // throttle setState to ~100 ms
  const animFrameRef = useRef<number | null>(null);
  const scheduleRef = useRef<typeof schedule | null>(null); // kept current to avoid stale closure
  const [smoothPct, setSmoothPct] = useState<number | null>(null); // drives the 🚂 bar

  /* Start smooth animation loop — delta-time approach: each tick advances dist by speed×dt */
  function startSmoothLoop() {
    prevTickTimeRef.current = Date.now();
    const tick = () => {
      const now = Date.now();
      const dtMin = (now - prevTickTimeRef.current) / 60000;
      prevTickTimeRef.current = now;

      if (smoothDistRef.current !== null) {
        // Advance position (even at speed 0 it stays still — correct)
        smoothDistRef.current += speedKmPerMinRef.current * dtMin;
        const dist = smoothDistRef.current;

        // Throttle setState calls to ~100 ms to avoid excessive re-renders
        if (now - lastRenderTimeRef.current >= 100) {
          lastRenderTimeRef.current = now;
          setSmoothDistKm(Math.round(dist));
          const stops = scheduleRef.current?.stops;
          if (stops?.length) {
            const totalKm = stops[stops.length - 1].distance_km;
            if (totalKm > 0) {
              setSmoothPct(Math.min(99, Math.max(1, (dist / totalKm) * 100)));
            }
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }

  function startGps() {
    if (!navigator.geolocation) {
      setGpsError("Geolocation not supported by your browser");
      return;
    }
    setGpsError(null);
    setOnTrain(true);
    startSmoothLoop();
    gpsWatchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        // Anchor to fromStop's distance on first GPS fix
        if (smoothDistRef.current === null) {
          smoothDistRef.current = fromStop?.distance_km ?? 0;
        }
        // Speed: m/s → km/min, clamped 0–3 km/min (0–180 km/h)
        const rawSpeedMs = pos.coords.speed ?? 0;
        speedKmPerMinRef.current = Math.min(3, Math.max(0, rawSpeedMs * 0.06));
        setLiveSpeedKmh(Math.round(rawSpeedMs * 3.6));
      },
      (err) => setGpsError(err.message),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
    );
  }

  function stopGps() {
    if (gpsWatchId.current !== null) navigator.geolocation.clearWatch(gpsWatchId.current);
    if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
    setOnTrain(false);
    setSmoothDistKm(null);
    setSmoothPct(null);
    setLiveSpeedKmh(null);
    smoothDistRef.current = null;
    speedKmPerMinRef.current = 0;
  }

  useEffect(() => () => stopGps(), []);

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
  scheduleRef.current = schedule ?? null; // keep ref current (safe to call in render body)

  /* ── Multi-day journey date awareness ─────────────────────────────────────
     If ctxFrom is a Day-N stop (N > 1), the trip that passes through ctxFrom
     "today" actually *departed* from origin (N-1) days earlier.
     Example: DHN is Day 3 on 12312 Kalka→HWH.  "Today" at DHN = trip that
     left Kalka 2 days ago.  We shift the API start-date accordingly so the
     live-position query returns the correct running trip instead of the one
     that hasn't left yet.
  ── */
  const ctxDayOffset = (() => {
    if (!ctxFrom || !schedule) return 0;
    const stop = schedule.stops.find(s => s.station_code === ctxFrom);
    return Math.max(0, (stop?.day ?? 1) - 1);
  })();

  /* Shift user's selected date back by ctxDayOffset to get the journey start date */
  const effectiveJourneyStartDate = (() => {
    const base = selectedDate ?? TODAY;
    if (ctxDayOffset <= 0) return base;
    const d = new Date(base + "T00:00:00");
    d.setDate(d.getDate() - ctxDayOffset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  /* API param: undefined = today (backend default) */
  const effectiveApiStartDate = effectiveJourneyStartDate === TODAY ? undefined : effectiveJourneyStartDate;

  const { data: pos } = useQuery<LivePosition>({
    queryKey: ["live", trainNo, effectiveJourneyStartDate],
    queryFn: () => trainsApi.livePosition(trainNo!, effectiveApiStartDate) as Promise<LivePosition>,
    enabled: !!trainNo,
    refetchInterval: 30_000,
  });

  /* ── Train position state ───────────────────────────────────────────────
     from_station_code = last station the train departed (or is halting at)
     next_station_code = next upcoming station
  ── */
  const fromIdx = schedule?.stops.findIndex(
    (s) => s.station_code === pos?.from_station_code
  ) ?? -1;
  const nextIdx = schedule?.stops.findIndex(
    (s) => s.station_code === pos?.next_station_code
  ) ?? -1;

  /* sub-route context indices when user came from a search */
  const ctxFromIdx = ctxFrom ? (schedule?.stops.findIndex(s => s.station_code === ctxFrom) ?? -1) : -1;
  const ctxToIdx   = ctxTo   ? (schedule?.stops.findIndex(s => s.station_code === ctxTo)   ?? -1) : -1;
  const ctxFromStop = ctxFromIdx >= 0 ? schedule?.stops[ctxFromIdx] : null;
  const ctxToStop   = ctxToIdx   >= 0 ? schedule?.stops[ctxToIdx]   : null;

  /* current IST clock (minutes since midnight) — recomputed each render */
  const istNowMinutes = (() => {
    const n = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    return n.getHours() * 60 + n.getMinutes();
  })();

  /* has the departure time at fromStop passed? */
  const fromStop = fromIdx >= 0 ? schedule?.stops[fromIdx] : undefined;
  const nextStop = nextIdx >= 0 ? schedule?.stops[nextIdx] : undefined;

  const departureTimePassed = (() => {
    if (!fromStop?.departure_time) return fromIdx >= 0 && nextIdx > fromIdx;
    const [h, m] = fromStop.departure_time.split(":").map(Number);
    return istNowMinutes > h * 60 + m;
  })();

  /* effectivelyInTransit: API says different from/next AND departure time has passed */
  const effectivelyInTransit = pos != null && fromIdx >= 0 && nextIdx > fromIdx && departureTimePassed;

  /* for visual purposes: "current" = fromIdx */
  const currentIdx = fromIdx >= 0 ? fromIdx : nextIdx;

  /* segment km */
  const segmentKm = (fromStop && nextStop && nextStop.distance_km > fromStop.distance_km)
    ? nextStop.distance_km - fromStop.distance_km
    : null;

  /* ETA for next station */
  const nextEta = pos?.next_station_eta
    ? (() => { const d = new Date(pos.next_station_eta!); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; })()
    : null;

  /* (progressPct removed — all progress is now pure distance-based) */

  /* Day of journey the train is currently on */
  const currentJourneyDay = currentIdx >= 0 ? schedule!.stops[currentIdx].day : null;

  /* Is this a past-date journey (user selected a date before today)? */
  const isPastJourney = !!selectedDate && selectedDate !== TODAY;

  /* Has the train reached its final destination?
     - Live: currentIdx points to last stop, OR pos.current_station_code === lastStop
     - Past date: journey end date = selectedDate + (lastStop.day - 1) days.
       If that date < TODAY, or (= TODAY and current IST time > lastStop arrival), done. */
  const lastStop = schedule?.stops[schedule.stops.length - 1];

  /* ctx-aware effective destination: user's searched To station, else full-route last stop */
  const effectiveLastStop = ctxToStop ?? lastStop ?? null;

  const hasReachedDestination = !!schedule && schedule.stops.length > 0 && !!effectiveLastStop && (() => {
    // ctx-aware live check: train is at/past ctxTo stop
    if (ctxToStop) {
      if (pos?.from_station_code === ctxTo) return true;
      if (fromStop && fromStop.distance_km >= ctxToStop.distance_km) return true;
    } else {
      // full-route live check
      if (currentIdx === schedule.stops.length - 1) return true;
      if (pos?.current_station_code && pos.current_station_code === lastStop?.station_code) return true;
    }
    // past-date / time-based check against effectiveLastStop
    // Use the shifted journey start date so Day-3 arrivals resolve correctly for "Today"
    const baseDate = effectiveJourneyStartDate;
    const journeyEndDate = (() => {
      const d = new Date(baseDate + "T00:00:00");
      d.setDate(d.getDate() + (effectiveLastStop.day - 1));
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();
    if (journeyEndDate < TODAY) return true;
    if (journeyEndDate === TODAY) {
      const arr = effectiveLastStop.arrival_time ?? effectiveLastStop.departure_time;
      if (!arr) return false;
      const [h, m] = arr.split(":").map(Number);
      return istNowMinutes >= h * 60 + m;
    }
    return false;
  })();

  /* 2-hour stale window: after train arrives, clear live state so next run isn't polluted */
  const isDataStale = hasReachedDestination && !isPastJourney && (() => {
    const arr = effectiveLastStop?.arrival_time ?? effectiveLastStop?.departure_time;
    if (!arr) return false;
    const [h, m] = arr.split(":").map(Number);
    return istNowMinutes > h * 60 + m + 120; // 2 hrs after arrival
  })();

  /* Has the train departed its source TODAY?
     Source departure time is stops[0].departure_time (HH:MM).
     If 'Today' is selected and current IST time < departure time → not started yet. */
  const trainNotStartedYet = (() => {
    if (selectedDate && selectedDate !== TODAY) return false; // past date — always show
    if (effectivelyInTransit) return false;   // train is already en route — never conflict
    if (hasReachedDestination) return false;
    // Use ctxFrom departure if user has journey context, else source stop
    const refStop = ctxFromIdx >= 0 ? schedule?.stops[ctxFromIdx] : schedule?.stops[0];
    const srcDep = refStop?.departure_time ?? refStop?.arrival_time;
    if (!srcDep) return false;
    const [h, m] = srcDep.split(":").map(Number);
    const depMinutes = h * 60 + m;
    // Overnight fix: train departed late-night yesterday — don’t show “not started” at 2 AM
    if (depMinutes >= 22 * 60 && istNowMinutes < 6 * 60) return false;
    return istNowMinutes < depMinutes;
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
  function StationRow({ stop, idx, dimmed }: { stop: ScheduleStop; idx: number; dimmed?: boolean }) {
    /* passed = every station before fromIdx (fully behind the train) */
    const isPassed      = currentIdx > 0 && idx < currentIdx;
    /* atStation = train is halting here (departure hasn't passed yet) */
    const isAtStation   = idx === fromIdx && !effectivelyInTransit;
    /* approaching = in-transit and this is the very next stop */
    const isApproaching = effectivelyInTransit && idx === nextIdx;
    /* is this the segment the train is actively traversing (for dashed line) */
    const isActiveSegmentFrom = effectivelyInTransit && idx === fromIdx;

    const delay      = pos?.delay_minutes ?? 0;
    const schArrival = stop.arrival_time ?? stop.departure_time;
    const expArrival = (isAtStation || isApproaching || (!isPassed && !isAtStation && idx > currentIdx))
      ? expectedTime(schArrival, delay) : null;
    const isLate     = delay > 0;

    /* dot style */
    const dotClass = isAtStation
      ? "bg-orange-500 shadow-[0_0_10px_rgba(255,69,0,0.9)] w-4 h-4"
      : isApproaching
      ? "bg-zinc-900 border-2 border-orange-400 w-3.5 h-3.5"
      : isPassed
      ? "bg-blue-600"
      : "bg-zinc-700 border border-zinc-600";

    return (
      <div className={`flex gap-0 relative transition-opacity ${dimmed ? "opacity-25 pointer-events-none" : ""}`}>
        {/* Timeline spine + dot */}
        <div className="flex flex-col items-center w-10 flex-shrink-0">
          {/* top line */}
          <div className={`w-0.5 flex-1 min-h-[16px] ${
            isPassed || isAtStation ? "bg-blue-600" : "bg-zinc-800"
          }`} />
          {/* dot */}
          <div className={`rounded-full flex-shrink-0 z-10 ${dotClass}`} />
          {/* bottom line — dashed orange when actively leaving this station */}
          {isActiveSegmentFrom ? (
            <div className="flex-1 min-h-[16px] flex justify-center">
              <div className="w-0.5 h-full border-l-2 border-dashed border-orange-500/60" />
            </div>
          ) : (
            <div className={`w-0.5 flex-1 min-h-[16px] ${isPassed ? "bg-blue-600" : "bg-zinc-800"}`} />
          )}
        </div>

        {/* Timing (left) */}
        <div className="w-24 flex-shrink-0 flex flex-col justify-center py-3 pr-2 text-right">
          <span className="text-xs text-zinc-400 font-mono tabular-nums">{schArrival ?? "—"}</span>
          {expArrival && expArrival !== schArrival && (
            <span className={`text-xs font-mono tabular-nums mt-0.5 ${isLate ? "text-red-400" : "text-green-400"}`}>
              {expArrival}
            </span>
          )}
          {isAtStation && isLate && (
            <span className="text-[10px] text-red-400 mt-0.5">{fmtDelay(delay)} late</span>
          )}
        </div>

        {/* Station info (right) */}
        <div
          className={`flex-1 ml-3 my-1.5 rounded-xl px-4 py-3 border transition-colors
            ${isAtStation
              ? "bg-orange-500/10 border-orange-500/40 shadow-[0_0_16px_rgba(255,69,0,0.15)]"
              : isApproaching
              ? "bg-zinc-900 border-orange-500/20"
              : isPassed
              ? "bg-zinc-950 border-zinc-800/40"
              : "bg-[#111111] border-zinc-800/40"
            }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={`font-semibold text-sm leading-tight ${
                isAtStation ? "text-orange-300"
                : isApproaching ? "text-orange-200/80"
                : isPassed ? "text-zinc-500"
                : "text-zinc-100"
              }`}>
                {stop.station_name}
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">{stop.station_code}</p>
            </div>
            {isAtStation && (
              <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0">
                🚂 HERE
              </span>
            )}
            {isApproaching && (
              <span className="text-[10px] bg-zinc-800 text-orange-300/70 border border-zinc-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0">
                NEXT
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

  /* ctx-relative progress %. Returns 100 when reached, null when no data. */
  const journeyPct = (() => {
    if (hasReachedDestination) return 100;
    if (onTrain && smoothPct !== null) return smoothPct;
    if (!effectivelyInTransit || !fromStop || !schedule?.stops.length) return null;
    // ctx-relative: user searched DHN→HWH, show progress within that segment only
    if (ctxFromStop && ctxToStop) {
      const rangeKm = ctxToStop.distance_km - ctxFromStop.distance_km;
      if (rangeKm <= 0) return null;
      const progressKm = Math.max(0, fromStop.distance_km - ctxFromStop.distance_km);
      return Math.min(100, Math.max(0, Math.round((progressKm / rangeKm) * 100)));
    }
    // Full route fallback
    const lastStop = schedule.stops[schedule.stops.length - 1];
    const totalKm = lastStop.distance_km;
    if (!totalKm || totalKm <= 0) return null;
    return Math.min(99, Math.max(1, Math.round((fromStop.distance_km / totalKm) * 100)));
  })();

  /* Pre-segment state: train is live but hasn't reached ctxFrom yet */
  const isApproachingSegment = !!ctxFromStop && effectivelyInTransit && !!fromStop &&
    fromStop.distance_km < ctxFromStop.distance_km;

  /* ETA to ctxFrom station (applying current delay) */
  const ctxFromEta = isApproachingSegment && ctxFromStop
    ? expectedTime(ctxFromStop.arrival_time ?? ctxFromStop.departure_time, pos?.delay_minutes ?? 0)
    : null;

  /* km remaining to next station — GPS-aware: (nextStop.distance_km - userDistKm) */
  const kmToNext = (() => {
    if (onTrain && smoothDistKm !== null && nextStop) {
      return Math.max(0, Math.round(nextStop.distance_km - smoothDistKm));
    }
    return segmentKm !== null ? segmentKm : null;
  })();

  const typeBadge = Object.entries(TYPE_COLORS).find(([k]) =>
    train?.train_type?.toUpperCase().includes(k)
  )?.[1] ?? "bg-zinc-700 text-zinc-300";

  // Is train running today in IST?
  const isRunningToday = (() => {
    const runs = schedule?.runs_on;
    if (!runs || runs.length < 7) return true; // assume daily if unknown
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const jsDay = now.getDay(); // 0=Sun…6=Sat
    // runs_on: idx 0=Mon…6=Sun (Python weekday). Map JS getDay() → runs_on index:
    const dayMap = [6, 0, 1, 2, 3, 4, 5]; // Sun→6, Mon→0, Tue→1, Wed→2, Thu→3, Fri→4, Sat→5
    return runs[dayMap[jsDay]] === "1";
  })();

  // Next day name this train runs (null if running today)
  const nextRunDay = (() => {
    if (isRunningToday || !schedule?.runs_on) return null;
    const runs = schedule.runs_on;
    if (runs.length < 7) return null;
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const jsDay = now.getDay();
    const dayMap = [6, 0, 1, 2, 3, 4, 5];
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    for (let i = 1; i <= 7; i++) {
      const nextJsDay = (jsDay + i) % 7;
      const runsOnIdx = dayMap[nextJsDay];
      if (runs[runsOnIdx] === "1") return dayNames[runsOnIdx];
    }
    return null;
  })();

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
            {hasReachedDestination && !isDataStale ? (
              <div className="flex-shrink-0 text-right">
                <span className="text-[10px] px-2 py-0.5 rounded-full border bg-green-500/20 text-green-400 border-green-500/30 font-medium">
                  🏁 Reached {effectiveLastStop?.station_code ?? "Destination"}
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

      {/* ── Not running today banner ── */}
      {!isRunningToday && (!selectedDate || selectedDate === TODAY) && schedule && (
        <div className="mx-4 mt-4 px-4 py-3 rounded-2xl bg-red-950/40 border border-red-500/30 flex items-start gap-3">
          <span className="text-xl leading-none mt-0.5">🚫</span>
          <div>
            <p className="text-red-400 font-bold text-sm">This train doesn't run today</p>
            <p className="text-zinc-500 text-xs mt-1">
              Showing static schedule only.
              {nextRunDay && (
                <> Next run: <span className="text-zinc-400 font-medium">{nextRunDay}</span>.</>
              )}
            </p>
          </div>
        </div>
      )}

      {/* ── route meta bar ── */}
      {train && (
        <div className="flex items-center gap-4 px-4 py-3 text-xs text-zinc-500 border-b border-zinc-800/30">
          <span className="font-mono text-zinc-300">{train.origin_code}</span>
          <span className="flex-1 border-t border-dashed border-zinc-700" />
          <span className="text-zinc-400">{(() => { const last = schedule?.stops[schedule.stops.length - 1]; return last?.distance_km ? `${last.distance_km} km` : ""; })()}</span>
          <span className="flex-1 border-t border-dashed border-zinc-700" />
          <span className="font-mono text-zinc-300">{train.destination_code}</span>
        </div>
      )}

      {/* ── Live Journey Dashboard ── */}
      {effectivelyInTransit && !hasReachedDestination && !isDataStale && fromStop && nextStop && (
        <div className="mx-4 mt-2 mb-1 rounded-2xl border border-orange-500/30 bg-black/60 backdrop-blur-md px-4 pt-2.5 pb-2.5 shadow-[0_0_20px_rgba(255,100,0,0.12)]">

          {/* Header: A ➞ B (ctx-aware) + delay chip */}
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-white font-mono tracking-wide">
              {(ctxFrom && ctxTo) ? ctxFrom : (train?.origin_code ?? "")}
              <span className="mx-1 text-zinc-700">➞</span>
              {(ctxFrom && ctxTo) ? ctxTo : (train?.destination_code ?? "")}
            </span>
            {pos?.delay_minutes !== 0 && pos?.delay_minutes !== undefined && (
              <span className={`text-[10px] font-bold ${
                (pos.delay_minutes ?? 0) > 0 ? "text-red-400" : "text-green-400"
              }`}>
                {fmtDelay(pos.delay_minutes)}
              </span>
            )}
          </div>

          {/* Pre-segment: train hasn't reached ctxFrom yet */}
          {isApproachingSegment ? (
            <div className="mb-2 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-3 py-2.5">
              <p className="text-xs text-yellow-300 font-semibold mb-0.5">
                ⏳ Train is approaching {ctxFromStop!.station_name}
              </p>
              {ctxFromEta && (
                <p className="text-[11px] text-zinc-400">
                  ETA to <span className="font-mono text-zinc-300">{ctxFromStop!.station_code}</span>:{" "}
                  <span className={`font-mono font-semibold ${
                    (pos?.delay_minutes ?? 0) > 0 ? "text-red-400" : "text-green-400"
                  }`}>
                    {ctxFromEta}
                  </span>
                </p>
              )}
            </div>
          ) : (
            /* In-segment progress bar with moving 🚂 */
            journeyPct !== null && (
              <div className="mb-2">
                <div className="relative w-full">
                  <div className="relative w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-orange-500 transition-all duration-1000"
                      style={{ width: `${journeyPct}%` }}
                    />
                  </div>
                  <span
                    className="pointer-events-none absolute -top-2.5 -translate-x-1/2 text-sm leading-none transition-all duration-1000 drop-shadow-[0_0_6px_rgba(255,100,0,0.8)]"
                    style={{ left: `${journeyPct}%` }}
                  >
                    🚂
                  </span>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] font-bold text-white font-mono">{(ctxFrom && ctxTo) ? ctxFrom : train?.origin_code}</span>
                  <span className="text-[10px] font-bold text-white">{Math.round(journeyPct as number)}% complete{ctxFrom && ctxTo ? " (your segment)" : ""}</span>
                  <span className="text-[10px] font-bold text-white font-mono">{(ctxFrom && ctxTo) ? ctxTo : train?.destination_code}</span>
                </div>
              </div>
            )
          )}

          {/* Next station — always the real next stop, with segment context label */}
          <p className="text-sm font-bold text-white leading-tight mb-1">
            Next:{" "}
            <span className="text-orange-300">{nextStop.station_name}</span>
            <span className="text-zinc-500 font-normal text-xs ml-1">({nextStop.station_code})</span>
            {isApproachingSegment && (
              <span className="text-zinc-600 font-normal text-[10px] ml-1.5">· before your segment</span>
            )}
          </p>

          {/* Metrics: km left · ETA */}
          <div className="flex items-center gap-1.5 text-[11px]">
            {kmToNext !== null && (
              <span className="text-zinc-400">~{kmToNext} km left</span>
            )}
            {kmToNext !== null && nextEta && (
              <span className="text-zinc-700">·</span>
            )}
            {nextEta && (
              <span>
                <span className="text-zinc-500">ETA </span>
                <span
                  className="font-mono font-semibold"
                  style={{ color: (pos?.delay_minutes ?? 0) > 0 ? "#ef4444" : "#22c55e" }}
                >
                  {nextEta}
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── "I AM ON THIS TRAIN" button ── */}
      {isRunningToday && !isPastJourney && !hasReachedDestination && !isDataStale && schedule && (
        <div className="px-4 pt-3 pb-1">
          {!onTrain ? (
            <button
              onClick={startGps}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm text-white transition-all"
              style={{
                background: "linear-gradient(135deg, #ff4500 0%, #ff6a00 100%)",
                boxShadow: "0 0 20px rgba(255, 69, 0, 0.45), 0 0 40px rgba(255, 69, 0, 0.2)",
              }}
            >
              <MapPin size={16} />
              📍 I AM ON THIS TRAIN
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-2xl border border-green-500/40 bg-green-500/5 px-4 py-2.5 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                <span className="text-xs text-green-300 font-medium">
                  Live GPS active
                  {liveSpeedKmh !== null && (
                    <span className="text-green-400/80 ml-1.5">· {liveSpeedKmh} km/h</span>
                  )}
                  {smoothDistKm !== null && (
                    <span className="text-zinc-500 ml-1.5">· {smoothDistKm} km from source</span>
                  )}
                </span>
              </div>
              <button
                onClick={stopGps}
                className="flex-shrink-0 px-3 py-2.5 rounded-2xl border border-zinc-700 bg-zinc-900 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all"
              >
                Stop Sharing
              </button>
            </div>
          )}
          {gpsError && (
            <p className="mt-1.5 text-[10px] text-red-400 text-center">{gpsError}</p>
          )}
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
        {!schedLoading && isRunningToday && trainNotStartedYet && schedule && (
          <div className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-300">
            ⏳ Train yet to start from source
            <span className="block text-xs text-yellow-500/70 mt-0.5">
              Departs {schedule.stops[0]?.departure_time} from {schedule.stops[0]?.station_name} ({schedule.stops[0]?.station_code})
            </span>
          </div>
        )}

        {/* Reached destination summary card */}
        {!schedLoading && hasReachedDestination && !isDataStale && effectiveLastStop && (
          <div className="mb-4 rounded-2xl border border-green-500/30 bg-green-500/5 px-4 py-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🏁</span>
              <p className="text-sm font-bold text-green-400">Reached {effectiveLastStop.station_name}</p>
            </div>
            <p className="text-xs text-zinc-400">
              {ctxFrom && ctxTo
                ? <><span className="font-mono text-zinc-300">{ctxFrom}</span> → <span className="font-mono text-zinc-300">{ctxTo}</span> journey complete</>        
                : <>Full route termination at {effectiveLastStop.station_code}</>}
            </p>
            {effectiveLastStop.arrival_time && (
              <p className="text-xs text-zinc-500 mt-1">
                Arrived at <span className="font-mono text-zinc-300">{effectiveLastStop.arrival_time}</span>
                {pos && pos.delay_minutes !== 0 && (
                  <span className={`ml-1.5 font-semibold ${pos.delay_minutes > 0 ? "text-red-400" : "text-green-400"}`}>
                    ({pos.delay_minutes > 0 ? "+" : ""}{pos.delay_minutes} min)
                  </span>
                )}
              </p>
            )}
            {/* 100% bar */}
            <div className="mt-3 relative w-full">
              <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-full rounded-full bg-green-500 transition-all duration-1000" />
              </div>
              <span className="absolute -top-2.5 right-0 text-sm leading-none">🏁</span>
            </div>
          </div>
        )}

        {/* Past journey banner (no live data for selected past date) */}
        {!schedLoading && isPastJourney && !hasReachedDestination && schedule && (
          <div className="mb-4 rounded-xl border border-zinc-700/50 bg-zinc-900/40 px-4 py-3 text-xs text-zinc-500">
            📅 Showing schedule for <span className="text-zinc-300">{fmtChipLabel(selectedDate)}</span> — live tracking unavailable for past dates
          </div>
        )}

        {schedule?.stops && (() => {
          const stops = schedule.stops;
          const hasCtx = ctxFromIdx >= 0 && ctxToIdx >= 0 && ctxFromIdx <= ctxToIdx;

          // When no ctx, render all stops normally
          if (!hasCtx) {
            return stops.map((stop, idx) => {
              const prevDay = idx > 0 ? stops[idx - 1].day : null;
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
            });
          }

          // Focused A→B view
          const preStops  = stops.slice(0, ctxFromIdx);       // before ctxFrom
          const ctxStops  = stops.slice(ctxFromIdx, ctxToIdx + 1); // ctxFrom..ctxTo inclusive
          const postStops = stops.slice(ctxToIdx + 1);        // after ctxTo

          return (
            <>
              {/* ── Pre-segment collapse ────────────────────────── */}
              {preStops.length > 0 && (
                <button
                  onClick={() => setShowPreStops(v => !v)}
                  className="w-full mb-2 flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900/60 text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all"
                >
                  <span className="flex-1 text-left">
                    {showPreStops ? "▲ Hide" : `▼ Show ${preStops.length} previous station${preStops.length !== 1 ? "s" : ""}`}
                    {!showPreStops && (
                      <span className="ml-1.5 text-zinc-600 font-mono">({stops[0].station_code} → {stops[ctxFromIdx - 1]?.station_code})</span>
                    )}
                  </span>
                </button>
              )}

              {/* Pre-stops (expanded) */}
              {showPreStops && preStops.map((stop, idx) => {
                const prevDay = idx > 0 ? preStops[idx - 1].day : null;
                const showDayDivider = stop.day > 1 && stop.day !== prevDay;
                return (
                  <React.Fragment key={stop.station_code + idx}>
                    {showDayDivider && (
                      <div className="flex items-center gap-3 px-2 py-3">
                        <div className="flex-1 border-t border-dashed border-zinc-800" />
                        <span className="text-[10px] font-semibold text-orange-400/70 bg-orange-500/10 border border-orange-500/20 px-2.5 py-0.5 rounded-full tracking-wide">DAY {stop.day}</span>
                        <div className="flex-1 border-t border-dashed border-zinc-800" />
                      </div>
                    )}
                    <StationRow stop={stop} idx={idx} dimmed />
                  </React.Fragment>
                );
              })}

              {/* ── Ctx segment label ───────────────────────────── */}
              <div className="flex items-center gap-3 px-2 py-2 mb-1">
                <div className="flex-1 border-t border-orange-500/20" />
                <span className="text-[10px] font-semibold text-orange-400/90 bg-orange-500/10 border border-orange-500/20 px-2.5 py-0.5 rounded-full tracking-wide">
                  {ctxFrom} → {ctxTo}
                </span>
                <div className="flex-1 border-t border-orange-500/20" />
              </div>

              {/* Ctx stops (always visible) */}
              {ctxStops.map((stop, i) => {
                const globalIdx = ctxFromIdx + i;
                const prev = i > 0 ? ctxStops[i - 1] : (showPreStops && preStops.length > 0 ? preStops[preStops.length - 1] : null);
                const showDayDivider = stop.day > 1 && stop.day !== (prev?.day ?? null);
                return (
                  <React.Fragment key={stop.station_code + globalIdx}>
                    {showDayDivider && (
                      <div className="flex items-center gap-3 px-2 py-3">
                        <div className="flex-1 border-t border-dashed border-zinc-800" />
                        <span className="text-[10px] font-semibold text-orange-400/70 bg-orange-500/10 border border-orange-500/20 px-2.5 py-0.5 rounded-full tracking-wide">DAY {stop.day}</span>
                        <div className="flex-1 border-t border-dashed border-zinc-800" />
                      </div>
                    )}
                    <StationRow stop={stop} idx={globalIdx} />
                  </React.Fragment>
                );
              })}

              {/* ── Post-segment collapse ────────────────────────── */}
              {postStops.length > 0 && (
                <button
                  onClick={() => setShowPostStops(v => !v)}
                  className="w-full mt-2 flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900/60 text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all"
                >
                  <span className="flex-1 text-left">
                    {showPostStops ? "▲ Hide" : `▼ Show ${postStops.length} more station${postStops.length !== 1 ? "s" : ""}`}
                    {!showPostStops && (
                      <span className="ml-1.5 text-zinc-600 font-mono">({stops[ctxToIdx + 1]?.station_code} → {stops[stops.length - 1].station_code})</span>
                    )}
                  </span>
                </button>
              )}

              {/* Post-stops (expanded) */}
              {showPostStops && postStops.map((stop, i) => {
                const globalIdx = ctxToIdx + 1 + i;
                const prevDay = i > 0 ? postStops[i - 1].day : ctxStops[ctxStops.length - 1]?.day ?? null;
                const showDayDivider = stop.day > 1 && stop.day !== prevDay;
                return (
                  <React.Fragment key={stop.station_code + globalIdx}>
                    {showDayDivider && (
                      <div className="flex items-center gap-3 px-2 py-3">
                        <div className="flex-1 border-t border-dashed border-zinc-800" />
                        <span className="text-[10px] font-semibold text-orange-400/70 bg-orange-500/10 border border-orange-500/20 px-2.5 py-0.5 rounded-full tracking-wide">DAY {stop.day}</span>
                        <div className="flex-1 border-t border-dashed border-zinc-800" />
                      </div>
                    )}
                    <StationRow stop={stop} idx={globalIdx} dimmed />
                  </React.Fragment>
                );
              })}
            </>
          );
        })()}
      </div>
    </div>
  );
}

