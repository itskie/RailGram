import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Train, Loader2, Clock, X } from "lucide-react";
import { trains as trainsApi } from "../lib/api";
import { useRecentSearches } from "../hooks/useRecentSearches";

interface TrainSuggestion {
  train_no: string;
  name: string;
  train_type?: string | null;
  origin_code?: string | null;
  destination_code?: string | null;
}

interface Props {
  placeholder?: string;
  className?: string;
}

const TYPE_COLORS: Record<string, string> = {
  RAJDHANI: "text-blue-400",
  DURONTO:  "text-purple-400",
  SHATABDI: "text-yellow-400",
  VANDE:    "text-cyan-400",
  SUF:      "text-orange-400",
  MAIL:     "text-zinc-500",
  EXPRESS:  "text-zinc-500",
};

function typeColor(type: string | null | undefined): string {
  const t = (type ?? "").toUpperCase();
  for (const [k, v] of Object.entries(TYPE_COLORS)) {
    if (t.includes(k)) return v;
  }
  return "text-zinc-500";
}

export default function TrainSearchBox({ placeholder = "Train number or name…", className = "" }: Props) {
  const navigate = useNavigate();
  const { history, push, remove, clear } = useRecentSearches("rg_trains_recent");

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<TrainSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [focused, setFocused] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const showingHistory = debounced.length === 0;

  /* Debounce */
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  /* Fetch */
  useEffect(() => {
    if (debounced.length < 1) {
      setResults([]);
      setOpen(focused && history.length > 0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (trainsApi.search(debounced) as Promise<{ trains: TrainSuggestion[] }>)
      .then((res) => {
        if (cancelled) return;
        setResults(res.trains?.slice(0, 8) ?? []);
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

  const select = useCallback((item: TrainSuggestion) => {
    push({ type: "train", label: item.name, sub: item.train_no, meta: item.train_type });
    setQuery("");
    setOpen(false);
    navigate(`/trains/${item.train_no}`);
  }, [navigate, push]);

  const selectHistory = useCallback((sub: string) => {
    setQuery("");
    setOpen(false);
    navigate(`/trains/${sub}`);
  }, [navigate]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const totalItems = showingHistory ? history.length : results.length;
    if (!open || totalItems === 0) {
      if (e.key === "Enter" && query.trim()) navigate(`/trains/${query.trim()}`);
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
        if (showingHistory) selectHistory(history[activeIdx].sub);
        else select(results[activeIdx]);
      } else if (query.trim()) {
        navigate(`/trains/${query.trim()}`);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIdx(-1);
    }
  };

  /* Scroll active item into view */
  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      const el = listRef.current.children[activeIdx] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIdx]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          {loading
            ? <Loader2 size={16} className="text-orange-400 animate-spin" />
            : <Train size={16} className="text-zinc-600 group-focus-within:text-orange-400 transition-colors" />
          }
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setFocused(true);
            if (query.trim() === "" && history.length > 0) setOpen(true);
            else if (results.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full bg-zinc-950 border border-zinc-800/70 rounded-xl px-4 py-3.5 pl-11 pr-4 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 ring-orange-500/20 transition-all text-sm font-medium"
        />
      </div>

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
                <Clock size={11} /> Recent Searches
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
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      i === activeIdx ? "bg-orange-500/10" : "hover:bg-white/5"
                    }`}
                    onMouseEnter={() => setActiveIdx(i)}
                  >
                    <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                      <Clock size={13} className="text-zinc-500" />
                    </div>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); selectHistory(item.sub); }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-sm font-semibold text-white truncate">{item.label}</p>
                      <p className="text-[11px] text-zinc-500 flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono">{item.sub}</span>
                        {item.meta && (
                          <>
                            <span className="text-zinc-700">·</span>
                            <span className={typeColor(item.meta)}>{item.meta}</span>
                          </>
                        )}
                      </p>
                    </button>
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
                <li key={item.train_no} className={i !== 0 ? "border-t border-white/5" : ""}>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); select(item); }}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      i === activeIdx ? "bg-orange-500/10" : "hover:bg-white/5"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                      <Train size={14} className="text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                      <p className="text-[11px] text-zinc-500 flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono">{item.train_no}</span>
                        {item.train_type && (
                          <>
                            <span className="text-zinc-700">·</span>
                            <span className={typeColor(item.train_type)}>{item.train_type}</span>
                          </>
                        )}
                        {item.origin_code && item.destination_code && (
                          <>
                            <span className="text-zinc-700">·</span>
                            <span>{item.origin_code} → {item.destination_code}</span>
                          </>
                        )}
                      </p>
                    </div>
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
