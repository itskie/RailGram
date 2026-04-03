import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { reports as reportsApi } from "../lib/api";

const REASONS = [
  { value: "spam", label: "Spam" },
  { value: "hate", label: "Hate speech" },
  { value: "violence", label: "Violence" },
  { value: "nudity", label: "Nudity / adult content" },
  { value: "misinformation", label: "Misinformation" },
  { value: "other", label: "Other" },
];

interface Props {
  postId?: string;
  reelId?: string;
  onClose: () => void;
}

export function ReportModal({ postId, reelId, onClose }: Props) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(false);

  const mut = useMutation({
    mutationFn: () =>
      reportsApi.create({
        post_id: postId,
        reel_id: reelId,
        reason,
        details: details.trim() || undefined,
      }),
    onSuccess: () => setDone(true),
  });

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-base">Report content</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-green-400 font-medium">Report submitted</p>
            <p className="text-zinc-400 text-sm">Thanks for helping keep RailGram safe. We'll review it shortly.</p>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-zinc-400 text-sm">Why are you reporting this?</p>
              <div className="grid grid-cols-2 gap-2">
                {REASONS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setReason(r.value)}
                    className={`px-3 py-2 rounded-xl text-sm border transition-colors text-left ${
                      reason === r.value
                        ? "bg-orange-500/20 border-orange-500 text-orange-400"
                        : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Additional details (optional)"
              maxLength={500}
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-zinc-500"
            />

            {mut.isError && (
              <p className="text-red-400 text-sm">
                {(mut.error as any)?.message ?? "Failed to submit report"}
              </p>
            )}

            <button
              disabled={!reason || mut.isPending}
              onClick={() => mut.mutate()}
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {mut.isPending ? "Submitting…" : "Submit report"}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
