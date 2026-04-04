import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lock } from "lucide-react";
import { reels as reelsApi } from "../lib/api";
import { ReelCard } from "../features/reels/components/ReelCard";

export default function ReelDetailPage() {
  const { reelId } = useParams<{ reelId: string }>();
  const nav = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["reel", reelId],
    queryFn: () => reelsApi.get(reelId!),
    enabled: !!reelId,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-orange-500" />
      </div>
    );
  }

  if (error || !data) {
    const is403 = (error as any)?.message?.includes("private");
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 px-6 text-center">
        {is403 ? (
          <>
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
              <Lock size={28} className="text-zinc-400" />
            </div>
            <h2 className="text-white font-semibold text-lg">This account is private</h2>
            <p className="text-zinc-400 text-sm">Follow this account to see their reels.</p>
          </>
        ) : (
          <>
            <h2 className="text-white font-semibold text-lg">Reel not found</h2>
            <p className="text-zinc-400 text-sm">This reel may have been deleted.</p>
          </>
        )}
        <button
          onClick={() => nav(-1)}
          className="mt-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-xl transition-colors"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 px-4 py-3 flex items-center gap-3 bg-gradient-to-b from-black/60 to-transparent">
        <button onClick={() => nav(-1)} className="text-white/80 hover:text-white transition-colors">
          <ArrowLeft size={22} />
        </button>
        <span className="text-white font-medium text-sm">Reel</span>
      </div>

      {/* Reel */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-sm h-screen">
          <ReelCard reel={data} />
        </div>
      </div>
    </div>
  );
}
