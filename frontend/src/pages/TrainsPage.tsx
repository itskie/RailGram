import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowUpDown, Clock, Calendar, Train as TrainIcon, ChevronRight, ArrowLeft } from "lucide-react";

interface TrainResult {
  train_no: string;
  name: string;
  type: string;
  departure: string;
  arrival: string;
  duration: string;
  days: boolean[]; // Sun Mon Tue Wed Thu Fri Sat
}

const DUMMY_TRAINS: TrainResult[] = [
  {
    train_no: "12381",
    name: "Poorva Express",
    type: "SUF",
    departure: "08:00",
    arrival: "20:30",
    duration: "12h 30m",
    days: [true, true, false, true, false, true, true],
  },
  {
    train_no: "12273",
    name: "Howrah Duronto",
    type: "DURONTO",
    departure: "20:05",
    arrival: "08:30",
    duration: "12h 25m",
    days: [false, true, false, false, true, false, true],
  },
  {
    train_no: "12301",
    name: "Howrah Rajdhani",
    type: "RAJDHANI",
    departure: "16:55",
    arrival: "09:55",
    duration: "17h 00m",
    days: [true, true, true, true, true, true, true],
  },
  {
    train_no: "13005",
    name: "Amritsar Mail",
    type: "MAIL",
    departure: "07:30",
    arrival: "21:15",
    duration: "13h 45m",
    days: [true, false, true, false, true, false, false],
  },
];

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const TYPE_BADGE: Record<string, string> = {
  RAJDHANI: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  DURONTO:  "bg-purple-500/15 text-purple-400 border-purple-500/25",
  SUF:      "bg-orange-500/15 text-orange-400 border-orange-500/25",
  MAIL:     "bg-zinc-700/60 text-zinc-400 border-zinc-600/40",
};

export default function TrainsPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const from = params.get("from")?.toUpperCase() ?? "";
  const to   = params.get("to")?.toUpperCase() ?? "";

  const handleSwap = () => {
    if (from && to) navigate(`/trains?from=${to}&to=${from}`);
  };

  return (
    <div className="max-w-2xl mx-auto min-h-screen bg-black pb-24">

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-md border-b border-zinc-900 px-4 pt-5 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={15} />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-white font-bold text-lg">{from || "—"}</span>
            <button
              onClick={handleSwap}
              className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-orange-400 hover:border-orange-500/40 hover:bg-orange-500/10 transition-all"
            >
              <ArrowUpDown size={13} />
            </button>
            <span className="text-white font-bold text-lg">{to || "—"}</span>
          </div>
        </div>
        <p className="text-zinc-500 text-xs ml-11">
          {DUMMY_TRAINS.length} trains found · Dummy data
        </p>
      </div>

      {/* ── Train cards ── */}
      <div className="px-4 py-4 space-y-3">
        {DUMMY_TRAINS.map((train) => {
          const badgeCls = TYPE_BADGE[train.type] ?? TYPE_BADGE.MAIL;
          return (
            <button
              key={train.train_no}
              onClick={() => navigate(`/trains/${train.train_no}`)}
              className="w-full bg-zinc-900/70 border border-zinc-800/60 rounded-2xl p-4 text-left hover:border-orange-500/30 hover:bg-zinc-900 transition-all active:scale-[0.98] group"
            >
              {/* Top row: name + type badge + chevron */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeCls}`}
                    >
                      {train.type}
                    </span>
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
                    {train.departure}
                  </p>
                  <p className="text-zinc-500 text-[10px] mt-0.5">{from || "—"}</p>
                </div>

                <div className="flex-1 flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1 text-zinc-600">
                    <div className="h-px flex-1 bg-zinc-800" />
                    <Clock size={11} className="text-zinc-600" />
                    <div className="h-px flex-1 bg-zinc-800" />
                  </div>
                  <p className="text-zinc-500 text-[10px] font-semibold">{train.duration}</p>
                </div>

                <div className="text-center">
                  <p className="text-white font-bold text-xl tabular-nums leading-none">
                    {train.arrival}
                  </p>
                  <p className="text-zinc-500 text-[10px] mt-0.5">{to || "—"}</p>
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
                        train.days[i]
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

