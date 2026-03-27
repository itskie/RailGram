import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useQuery } from "@tanstack/react-query";
import { trains as trainsApi } from "../lib/api";
import type { LivePosition } from "../types";
import { Train, Loader } from "lucide-react";

const RASTER_TILES =
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Record<string, maplibregl.Marker>>({});
  const [selectedTrain, setSelectedTrain] = useState<string | null>(null);

  // ── Single train position lookup (on click) ───────────────────────────────
  const { data: position, isLoading: posLoading } = useQuery<LivePosition>({
    queryKey: ["live", selectedTrain],
    queryFn: () => trainsApi.livePosition(selectedTrain!) as Promise<LivePosition>,
    enabled: !!selectedTrain,
    refetchInterval: 30_000,
  });

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [RASTER_TILES],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm-tiles", type: "raster", source: "osm" }],
      },
      center: [80.27, 22.09],   // centre of India
      zoom: 4.5,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapInstance.current = map;
    return () => map.remove();
  }, []);

  // ── Place / update marker when live position arrives ──────────────────────
  const placeMarker = useCallback((pos: LivePosition) => {
    if (!mapInstance.current || !pos.latitude || !pos.longitude) return;

    const el = document.createElement("div");
    el.className =
      "w-8 h-8 bg-orange-500 border-2 border-white rounded-full flex items-center justify-center shadow-lg cursor-pointer";
    el.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;

    const popup = new maplibregl.Popup({ offset: 25 }).setHTML(
      `<div style="font-family:sans-serif;font-size:13px;min-width:160px">
        <strong style="color:#f97316">${pos.train_no}</strong> — ${pos.train_name ?? ""}<br/>
        <span style="color:#888">At:</span> ${pos.current_station_name ?? "Unknown"}<br/>
        <span style="color:#888">Next:</span> ${pos.next_station_name ?? "—"}<br/>
        <span style="color:#888">Delay:</span> ${pos.delay_minutes >= 0 ? `+${pos.delay_minutes}` : pos.delay_minutes} min<br/>
        <span style="color:#888">Source:</span> ${pos.source} (${Math.round(pos.confidence * 100)}%)
      </div>`
    );

    const old = markersRef.current[pos.train_no];
    if (old) old.remove();

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([pos.longitude, pos.latitude])
      .setPopup(popup)
      .addTo(mapInstance.current);

    markersRef.current[pos.train_no] = marker;
    mapInstance.current.flyTo({ center: [pos.longitude, pos.latitude], zoom: 7, duration: 1000 });
  }, []);

  useEffect(() => {
    if (position?.latitude && position.longitude) placeMarker(position);
  }, [position, placeMarker]);

  return (
    <div className="flex flex-col h-screen">
      {/* Search bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <Train size={18} className="text-orange-400 flex-shrink-0" />
        <input
          placeholder="Enter train number to track (e.g. 12301)"
          className="flex-1 bg-transparent text-sm outline-none text-zinc-200 placeholder:text-zinc-500"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setSelectedTrain((e.target as HTMLInputElement).value.trim() || null);
            }
          }}
        />
        {posLoading && <Loader size={16} className="animate-spin text-orange-400" />}
      </div>

      {/* Position card */}
      {position && (
        <div className="px-4 py-2 bg-zinc-900/90 border-b border-zinc-800 text-sm flex gap-4 items-center">
          <span className="text-orange-400 font-semibold">{position.train_no}</span>
          <span className="text-zinc-400">
            {position.current_station_name ?? "Unknown"} → {position.next_station_name ?? "—"}
          </span>
          <span className={position.delay_minutes > 0 ? "text-red-400" : "text-green-400"}>
            {position.delay_minutes >= 0 ? `+${position.delay_minutes}` : position.delay_minutes} min
          </span>
          <span className="ml-auto text-xs text-zinc-600 capitalize">{position.source}</span>
        </div>
      )}

      {/* Map */}
      <div ref={mapRef} className="flex-1" />
    </div>
  );
}
