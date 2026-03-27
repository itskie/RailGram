import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { trains as trainsApi } from "../lib/api";
import { Search, Train as TrainIcon, ChevronRight } from "lucide-react";

interface TrainBrief {
  train_no: string;
  name: string;
  train_type: string | null;
  origin_code: string | null;
  destination_code: string | null;
}

interface TrainSearchResult {
  trains: TrainBrief[];
  total: number;
}

export default function TrainsPage() {
  const [q, setQ] = useState("");
  const nav = useNavigate();

  const { data, isLoading } = useQuery<TrainSearchResult>({
    queryKey: ["train-search", q],
    queryFn: () => trainsApi.search(q) as Promise<TrainSearchResult>,
    enabled: q.length >= 2,
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <TrainIcon size={20} className="text-orange-400" />
        Train Search
      </h1>

      <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 mb-6">
        <Search size={16} className="text-zinc-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Train number or name…"
          className="flex-1 bg-transparent text-sm outline-none text-zinc-200 placeholder:text-zinc-500"
        />
      </div>

      {isLoading && (
        <div className="text-center text-zinc-500 text-sm py-8">Searching…</div>
      )}

      {data && data.trains.length === 0 && (
        <div className="text-center text-zinc-500 text-sm py-8">No trains found.</div>
      )}

      <div className="flex flex-col gap-2">
        {(data?.trains ?? []).map((t) => (
          <button
            key={t.train_no}
            onClick={() => nav(`/trains/${t.train_no}`)}
            className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 hover:border-orange-500/50 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <TrainIcon size={18} className="text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-zinc-100">{t.name}</p>
              <p className="text-xs text-zinc-500">
                {t.train_no} · {t.origin_code} → {t.destination_code}
              </p>
            </div>
            <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{t.train_type}</span>
            <ChevronRight size={16} className="text-zinc-600" />
          </button>
        ))}
      </div>
    </div>
  );
}
