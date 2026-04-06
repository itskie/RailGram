import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Loader2, X, Clock } from "lucide-react";
import { stations as stationsApi } from "../lib/api";
import { useRecentSearches } from "../hooks/useRecentSearches";

interface StationSuggestion {
  station_code: string;
  station_name: string;
  city?: string | null;
  is_major?: boolean;
}

interface Props {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  dot?: "filled" | "outlined";
}

export default function StationAutocomplete({ value, onChange, placeholder = "Station…", dot = "filled" }: Props) {
  const { history, push, remove, clear } = useRecentSearches("rg_stations_recent");

  const [inputVal, setInputVal] = useState(value);
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<StationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const showingHistory = debounced.length === 0;

  /* Sync external value resets (e.g. swap button clears) */
  useEffect(() => { if (!value) setInputVal(""); }, [value]);

  /* Debounce */
  useEffect(() => {
    const t = setTimeout(() => setDebounced(inputVal.trim()), 300);
    return () => clearTimeout(t);
  }, [inputVal]);

  /* Fetch */
  useEffect(() => {
    if (debounced.length < 1) {
      setResults([]);
      setOpen(focused && history.length > 0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (stationsApi.search(debounced) as Promise<{ stations: StationSuggestion[] }>)
      .then((res) => {
        if (cancelled) return;
        setResults(res.stations?.slice(0, 7) ?? []);
        setOpen(true);
        setActiveIdx(-1);
      })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debounced, focused, history.length]);

  /* Close on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = useCallback((item: StationSuggestion) => {
    push({ type: "station", label: item.station_name, sub: item.station_code, meta: item.city });
    setInputVal(item.station_name);
    onChange(item.station_code);
    setOpen(false);
    setResults([]);
  }, [onChange, push]);

  const selectHistory = useCallback((item: { sub: string; label: string; meta?: string | null }) => {
    setInputVal(item.label);
    onChange(item.sub);
    setOpen(false);
  }, [onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const totalItems = showingHistory ? history.length : results.length;
    if (!open || totalItems === 0) {
      if (e.key === "Enter") { onChange(inputVal.trim().toUpperCase()); setOpen(false); }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0) {
        if (showingHistory) selectHistory(history[activeIdx]);
        else select(results[activeIdx]);
      } else {
        onChange(inputVal.trim().toUpperCase());
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIdx(-1);
    }
  };

  /* Scroll active into view */
  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      const el = listRef.current.children[activeIdx] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIdx]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputVal(e.target.value);
    onChange(e.target.value); // keep parent state in sync for manual typing
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Dot indicator */}
      <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none z-10">
        {loading
          ? <Loader2 size={13} className="text-orange-400 animate-spin" />
          : dot === "filled"
            ? <div className="w-2 h-2 rounded-full bg-orange-500" />
            : <div className="w-2 h-2 rounded-full border-2 border-orange-500" />
        }
      </div>

      <input
        type="text"
        value={inputVal}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
            setFocused(true);
            if (inputVal.trim() === "" && history.length > 0) setOpen(true);
            else if (results.length > 0) setOpen(true);
          }}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full bg-zinc-950 border border-zinc-800/70 rounded-xl px-4 py-3.5 pl-8 pr-8 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 ring-orange-500/20 transition-all text-sm font-medium"
      />

      {/* Clear button */}
      {inputVal && (
        <button
          onMouseDown={(e) => { e.preventDefault(); setInputVal(""); onChange(""); setResults([]); setOpen(false); }}
          className="absolute inset-y-0 right-3 flex items-center text-zinc-600 hover:text-zinc-400"
        >
          <X size={14} />
        </button>
      )}

      {/* Dropdown */}
      {open && (showingHistory ? history.length > 0 : results.length > 0) && (
        <div
          className="absolute z-50 mt-1.5 w-full rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
          style={{
            background: "rgba(15,15,15,0.92)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
          }}
        >
          {/* History header */}
          {showingHistory && (
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                <Clock size={11} /> Recent Stations
              </span>
              <button
                onMouseDown={(e) => { e.preventDefault(); clear(); setOpen(false); }}
                className="text-[11px] text-orange-500 hover:text-orange-400 font-semibold transition-colors"
              >
                Clear All
              </button>
            </div>
          )}

          <ul ref={listRef}>
            {showingHistory
              ? history.map((item, i) => (
                <li key={item.sub} className={i !== 0 ? "border-t border-white/5" : ""}>
                  <div
                    className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                      i === activeIdx ? "bg-orange-500/10" : "hover:bg-white/5"
                    }`}
                    onMouseEnter={() => setActiveIdx(i)}
                  >
                    <Clock size={13} className="text-zinc-600 shrink-0" />
                    <button
                      onMouseDown={(e) => { e.preventDefault(); selectHistory(item); }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-sm font-semibold text-white truncate">{item.label}</p>
                      {item.meta && <p className="text-[11px] text-zinc-500 truncate">{item.meta}</p>}
                    </button>
                    <span className="font-mono text-[11px] font-bold text-orange-400 shrink-0 mr-2">{item.sub}</span>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); remove(item.sub); }}
                      className="p-1 text-zinc-700 hover:text-zinc-400 transition-colors shrink-0"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </li>
              ))
              : results.map((item, i) => (
                <li key={item.station_code} className={i !== 0 ? "border-t border-white/5" : ""}>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); select(item); }}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === activeIdx ? "bg-orange-500/10" : "hover:bg-white/5"
                    }`}
                  >
                    <MapPin size={13} className={item.is_major ? "text-orange-400 shrink-0" : "text-zinc-600 shrink-0"} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{item.station_name}</p>
                      {item.city && item.city !== item.station_name && (
                        <p className="text-[11px] text-zinc-500 truncate">{item.city}</p>
                      )}
                    </div>
                    <span className="font-mono text-[11px] font-bold text-orange-400 shrink-0">{item.station_code}</span>
                  </button>
                </li>
              ))
            }
          </ul>
        </div>
      )}
    </div>
  );
}
