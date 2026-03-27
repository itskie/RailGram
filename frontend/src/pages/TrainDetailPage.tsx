import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { trains as trainsApi } from "../lib/api";
import type { LivePosition } from "../types";
import {
  Train as TrainIcon, MapPin, Navigation, Loader, ArrowLeft, Radio,
} from "lucide-react";

interface TrainDetail {
  train_no: string;
  name: string;
  train_type: string | null;
  zone: string | null;
  origin_code: string | null;
  destination_code: string | null;
  total_distance_km: number | null;
  duration_minutes: number | null;
}
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export default function TrainDetailPage() {
  const { trainNo } = useParams<{ trainNo: string }>();
  const nav = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapIns = useRef<maplibregl.Map | null>(null);

  const { data: train } = useQuery<TrainDetail>({
    queryKey: ["train", trainNo],
    queryFn: () => trainsApi.get(trainNo!) as Promise<TrainDetail>,
    enabled: !!trainNo,
  });

  const { data: pos, isLoading: posLoading } = useQuery<LivePosition>({
    queryKey: ["live", trainNo],
    queryFn: () => trainsApi.livePosition(trainNo!) as Promise<LivePosition>,
    enabled: !!trainNo,
    refetchInterval: 30_000,
  });

  // mini map
  useEffect(() => {
    if (!mapRef.current || mapIns.current) return;
    mapIns.current = new maplibregl.Map({
      container: mapRef.current,
      style: {
        version: 8,
        sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256 } },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [80.27, 22.09],
      zoom: 4,
      interactive: true,
    });
    return () => { mapIns.current?.remove(); mapIns.current = null; };
  }, []);

  useEffect(() => {
    if (!pos?.latitude || !pos.longitude || !mapIns.current) return;
    const el = document.createElement("div");
    el.className = "w-6 h-6 bg-orange-500 rounded-full border-2 border-white shadow-lg";
    new maplibregl.Marker({ element: el })
      .setLngLat([pos.longitude, pos.latitude])
      .addTo(mapIns.current);
    mapIns.current.flyTo({ center: [pos.longitude, pos.latitude], zoom: 7 });
  }, [pos]);

  const sourceBadge: Record<string, string> = {
    gps: "bg-green-500/20 text-green-400",
    spotter: "bg-blue-500/20 text-blue-400",
    schedule: "bg-zinc-700 text-zinc-400",
    unknown: "bg-zinc-700 text-zinc-500",
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button
        onClick={() => nav(-1)}
        className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 mb-4"
      >
        <ArrowLeft size={15} /> Back
      </button>

      {train && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
              <TrainIcon size={22} className="text-orange-400" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-zinc-100">{train.name}</h1>
              <p className="text-sm text-zinc-500">{train.train_no} · {train.train_type}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {[
              { icon: MapPin, label: "From", value: train.origin_code },
              { icon: MapPin, label: "To",   value: train.destination_code },
              { icon: MapPin, label: "Zone", value: train.zone },
              { icon: MapPin, label: "Distance", value: train.total_distance_km ? `${train.total_distance_km} km` : null },
            ].filter(f => f.value).map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon size={14} className="text-zinc-500 flex-shrink-0" />
                <span className="text-zinc-400">{label}:</span>
                <span className="text-zinc-200 font-medium truncate">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live position */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Radio size={16} className="text-orange-400" />
          <h2 className="font-semibold text-sm">Live Position</h2>
          {posLoading && <Loader size={14} className="animate-spin text-zinc-500 ml-auto" />}
        </div>

        {pos ? (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Navigation size={14} className="text-zinc-500" />
              <span className="text-zinc-300">{pos.current_station_name ?? "Unknown"}</span>
              {pos.delay_minutes !== 0 && (
                <span className={`ml-auto text-xs font-medium ${pos.delay_minutes > 0 ? "text-red-400" : "text-green-400"}`}>
                  {pos.delay_minutes > 0 ? `+${pos.delay_minutes}` : pos.delay_minutes} min
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              Next: <span className="text-zinc-400">{pos.next_station_name ?? "—"}</span>
            </p>
            <span className={`self-start text-xs px-2 py-0.5 rounded-full ${sourceBadge[pos.source] ?? sourceBadge.unknown}`}>
              {pos.source} · {Math.round(pos.confidence * 100)}% confidence
            </span>
          </div>
        ) : !posLoading ? (
          <p className="text-zinc-500 text-sm">No live data available for this train.</p>
        ) : null}
      </div>

      {/* Mini map */}
      <div className="rounded-2xl overflow-hidden border border-zinc-800 h-64">
        <div ref={mapRef} className="w-full h-full" />
      </div>
    </div>
  );
}
