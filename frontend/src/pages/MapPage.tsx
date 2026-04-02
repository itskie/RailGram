import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useQuery } from "@tanstack/react-query";
import { trains as trainsApi } from "../lib/api";
import type { LivePosition } from "../types";
import { Train, Loader, RadioTower, Satellite, MapPin, Clock, AlertTriangle } from "lucide-react";

const RASTER_TILES = "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png";

const SOURCE_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  gps:        { label: "Live GPS",       color: "#22c55e", Icon: Satellite },
  cell_tower: { label: "Cell Tower",     color: "#3b82f6", Icon: RadioTower },
  spotter:    { label: "Spotter Report", color: "#f59e0b", Icon: MapPin },
  schedule:   { label: "Schedule Only",  color: "#71717a", Icon: Clock },
  unknown:    { label: "Unknown",        color: "#71717a", Icon: Clock },
};

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Record<string, maplibregl.Marker>>({});
  const circleLayerRef = useRef<string | null>(null);
  const [selectedTrain, setSelectedTrain] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");

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
            attribution: "© Stadia Maps © OpenMapTiles © OpenStreetMap contributors",
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

  // ── Accuracy circle (GeoJSON circle layer) ───────────────────────────────
  const updateAccuracyCircle = useCallback((pos: LivePosition) => {
    const map = mapInstance.current;
    if (!map || !pos.latitude || !pos.longitude || !pos.accuracy_m) return;

    const sourceId = "accuracy-source";
    const layerId = "accuracy-layer";
    const radiusDeg = pos.accuracy_m / 111_320; // metres → rough degrees
    const steps = 64;
    const coords: [number, number][] = Array.from({ length: steps + 1 }, (_, i) => {
      const angle = (i / steps) * 2 * Math.PI;
      return [
        pos.longitude! + radiusDeg * Math.cos(angle) / Math.cos((pos.latitude! * Math.PI) / 180),
        pos.latitude! + radiusDeg * Math.sin(angle),
      ];
    });

    const geojson: GeoJSON.Feature<GeoJSON.Polygon> = {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [coords] },
    };

    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojson);
    } else {
      map.addSource(sourceId, { type: "geojson", data: geojson });
      map.addLayer({
        id: layerId,
        type: "fill",
        source: sourceId,
        paint: { "fill-color": "#3b82f6", "fill-opacity": 0.15 },
      });
      map.addLayer({
        id: `${layerId}-border`,
        type: "line",
        source: sourceId,
        paint: { "line-color": "#3b82f6", "line-width": 1.5, "line-opacity": 0.6 },
      });
      circleLayerRef.current = layerId;
    }
  }, []);

  // ── Place / update marker when live position arrives ──────────────────────
  const placeMarker = useCallback((pos: LivePosition) => {
    if (!mapInstance.current || !pos.latitude || !pos.longitude) return;

    const meta = SOURCE_META[pos.source] ?? SOURCE_META.unknown;
    const inTunnel = pos.tunnel_detected === true;

    const el = document.createElement("div");
    el.style.cssText = `width:36px;height:36px;background:${meta.color};border:2.5px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.45);cursor:pointer;position:relative`;
    el.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;
    if (inTunnel) {
      const badge = document.createElement("div");
      badge.style.cssText = "position:absolute;top:-6px;right:-6px;width:16px;height:16px;background:#f97316;border-radius:50%;display:flex;align-items:center;justify-content:center";
      badge.title = "In tunnel";
      badge.innerHTML = `<svg width='10' height='10' viewBox='0 0 24 24' fill='white'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'/></svg>`;
      el.appendChild(badge);
    }

    const delayStr = pos.delay_minutes > 0
      ? `<span style='color:#f87171'>+${pos.delay_minutes} min late</span>`
      : pos.delay_minutes < 0
      ? `<span style='color:#4ade80'>${pos.delay_minutes} min early</span>`
      : `<span style='color:#4ade80'>On time</span>`;
    const accuracyStr = pos.accuracy_m ? `±${pos.accuracy_m}m` : "";
    const tunnelStr = inTunnel ? `<br/><span style='color:#f97316'>🚇 In Tunnel</span>` : "";

    const popup = new maplibregl.Popup({ offset: 28, maxWidth: "220px" }).setHTML(
      `<div style="font-family:sans-serif;font-size:13px;line-height:1.6">
        <strong style="color:#f97316;font-size:14px">${pos.train_no}</strong><br/>
        <span style="color:#a1a1aa">Next:</span> ${pos.next_station_code ?? "—"}<br/>
        <span style="color:#a1a1aa">Delay:</span> ${delayStr}<br/>
        <span style="color:#a1a1aa">Source:</span>
          <span style="color:${meta.color}">${meta.label}</span>
          <span style="color:#71717a">(${Math.round(pos.confidence * 100)}%)</span><br/>
        ${accuracyStr ? `<span style="color:#a1a1aa">Accuracy:</span> ${accuracyStr}<br/>` : ""}
        ${tunnelStr}
      </div>`
    );

    const old = markersRef.current[pos.train_no];
    if (old) old.remove();

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([pos.longitude, pos.latitude])
      .setPopup(popup)
      .addTo(mapInstance.current);

    markersRef.current[pos.train_no] = marker;
    mapInstance.current.flyTo({ center: [pos.longitude, pos.latitude], zoom: 8, duration: 1000 });
    updateAccuracyCircle(pos);
  }, [updateAccuracyCircle]);

  useEffect(() => {
    if (position?.latitude && position.longitude) placeMarker(position);
  }, [position, placeMarker]);

  const sourceMeta = position ? (SOURCE_META[position.source] ?? SOURCE_META.unknown) : null;
  const SourceIcon = sourceMeta?.Icon;

  return (
    <div className="flex flex-col h-screen">
      {/* Search bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <Train size={18} className="text-orange-400 flex-shrink-0" />
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter train number to track (e.g. 12301)"
          className="flex-1 bg-transparent text-sm outline-none text-zinc-200 placeholder:text-zinc-500"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = inputValue.trim();
              setSelectedTrain(v || null);
            }
          }}
        />
        {posLoading && <Loader size={16} className="animate-spin text-orange-400" />}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div ref={mapRef} className="flex-1" />

        {/* Sidebar */}
        {position && sourceMeta && SourceIcon && (
          <aside className="w-64 bg-zinc-900 border-l border-zinc-800 flex flex-col gap-4 p-4 overflow-y-auto text-sm shrink-0">
            {/* Train header */}
            <div>
              <p className="text-orange-400 font-bold text-base">{position.train_no}</p>
              {position.train_name && (
                <p className="text-zinc-400 text-xs mt-0.5">{position.train_name}</p>
              )}
            </div>

            {/* Tunnel indicator */}
            {position.tunnel_detected && (
              <div className="flex items-center gap-2 rounded-lg bg-orange-500/15 border border-orange-500/40 px-3 py-2">
                <AlertTriangle size={15} className="text-orange-400 shrink-0" />
                <div>
                  <p className="text-orange-300 font-semibold text-xs">In Tunnel</p>
                  {position.tunnel_confidence != null && (
                    <p className="text-zinc-500 text-xs">
                      Confidence: {Math.round(position.tunnel_confidence * 100)}%
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Source badge */}
            <div className="flex items-center gap-2">
              <SourceIcon size={15} style={{ color: sourceMeta.color }} className="shrink-0" />
              <div>
                <p className="font-medium" style={{ color: sourceMeta.color }}>
                  {sourceMeta.label}
                </p>
                <p className="text-zinc-500 text-xs">
                  Confidence: {Math.round(position.confidence * 100)}%
                </p>
              </div>
            </div>

            <hr className="border-zinc-800" />

            {/* Position details */}
            <div className="flex flex-col gap-2 text-zinc-300">
              <Row label="Next stop" value={position.next_station_code ?? "—"} />
              <Row
                label="Delay"
                value={
                  position.delay_minutes > 0
                    ? `+${position.delay_minutes} min`
                    : position.delay_minutes < 0
                    ? `${position.delay_minutes} min early`
                    : "On time"
                }
                valueClass={
                  position.delay_minutes > 0
                    ? "text-red-400"
                    : "text-green-400"
                }
              />
              {position.speed_kmh != null && (
                <Row label="Speed" value={`${Math.round(position.speed_kmh)} km/h`} />
              )}
              {position.accuracy_m != null && (
                <Row label="Accuracy" value={`±${position.accuracy_m} m`} />
              )}
              {position.latitude != null && (
                <Row
                  label="Position"
                  value={`${position.latitude.toFixed(4)}, ${position.longitude?.toFixed(4)}`}
                />
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-zinc-500 shrink-0">{label}</span>
      <span className={`text-right ${valueClass ?? "text-zinc-200"}`}>{value}</span>
    </div>
  );
}
