import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Eye, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { stories as storiesApi, media } from "../lib/api";
import { useAuthStore } from "../store/authStore";

const CDN = "https://dzdr0nfpn0f2c.cloudfront.net/";
const STORY_DURATION_PHOTO = 5000; // ms
const REACTIONS = ["❤️", "😂", "😮", "😢", "😡", "🔥", "👏", "🚂"];

interface StoryOut {
  id: string;
  media_key: string;
  media_type: string;
  duration_secs?: number;
  thumbnail_key?: string;
  caption?: string;
  expires_at: string;
  view_count: number;
  reaction_count: number;
  viewed: boolean;
  viewer_reaction?: string;
  author: { id: string; username: string; display_name: string; avatar_url?: string };
}

interface StoryFeedItem {
  user: { id: string; username: string; display_name: string; avatar_url?: string };
  stories: StoryOut[];
}

// ── Story Viewer ──────────────────────────────────────────────────────────────

function StoryViewer({
  feedItems,
  startUserIndex,
  onClose,
  currentUsername,
}: {
  feedItems: StoryFeedItem[];
  startUserIndex: number;
  onClose: () => void;
  currentUsername?: string;
}) {
  const qc = useQueryClient();
  const [userIdx, setUserIdx] = useState(startUserIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentFeed = feedItems[userIdx];
  const currentStory = currentFeed?.stories[storyIdx];
  const isOwn = currentFeed?.user.username === currentUsername;
  const isVideo = currentStory?.media_type === "video";
  const duration = isVideo
    ? (currentStory.duration_secs ? currentStory.duration_secs * 1000 : 15000)
    : STORY_DURATION_PHOTO;

  const reactMut = useMutation({
    mutationFn: ({ id, emoji }: { id: string; emoji: string }) => storiesApi.react(id, emoji),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stories-feed"] });
      setShowReactions(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => storiesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stories-feed"] });
      goNext();
    },
  });

  // Mark as viewed
  useEffect(() => {
    if (currentStory && !currentStory.viewed) {
      storiesApi.view(currentStory.id).catch(() => {});
    }
  }, [currentStory?.id]);

  const startedAtRef = useRef<number>(0);

  // When story changes, reset progress
  useEffect(() => {
    setProgress(0);
    startedAtRef.current = Date.now();
    if (!paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [userIdx, storyIdx]);

  // Pause/resume: track elapsed for accurate resume
  useEffect(() => {
    if (paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      videoRef.current?.pause();
    } else {
      videoRef.current?.play().catch(() => {});
    }
  }, [paused]);

  const goNext = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (storyIdx < currentFeed.stories.length - 1) {
      setStoryIdx((i) => i + 1);
      setProgress(0);
    } else if (userIdx < feedItems.length - 1) {
      setUserIdx((i) => i + 1);
      setStoryIdx(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [storyIdx, userIdx, currentFeed, feedItems, onClose]);

  const goPrev = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
      setProgress(0);
    } else if (userIdx > 0) {
      setUserIdx((i) => i - 1);
      setStoryIdx(0);
      setProgress(0);
    }
  }, [storyIdx, userIdx]);

  const loadViewers = async () => {
    if (!isOwn) return;
    try {
      const data = await storiesApi.viewers(currentStory.id) as any[];
      setViewers(data);
      setShowViewers(true);
    } catch {}
  };

  if (!currentStory || !currentFeed) return null;

  const mediaUrl = `${CDN}${currentStory.media_key}`;
  const avatarUrl = currentFeed.user.avatar_url
    ? (currentFeed.user.avatar_url.startsWith("http") ? currentFeed.user.avatar_url : `${CDN}${currentFeed.user.avatar_url}`)
    : null;

  const [replyText, setReplyText] = useState("");
  const [replySent, setReplySent] = useState(false);

  return createPortal(
    <div className="fixed inset-0 bg-black flex items-center justify-center" style={{ zIndex: 99999 }}>
      {/* Dim sides — prev/next user previews like Instagram */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Prev user ghost */}
        {userIdx > 0 && (
          <div
            className="absolute left-0 top-0 bottom-0 w-[12vw] cursor-pointer z-10 flex items-center justify-start pl-2"
            onClick={goPrev}
          >
            <ChevronLeft size={28} className="text-white/60" />
          </div>
        )}
        {/* Next user ghost */}
        {userIdx < feedItems.length - 1 && (
          <div
            className="absolute right-0 top-0 bottom-0 w-[12vw] cursor-pointer z-10 flex items-center justify-end pr-2"
            onClick={goNext}
          >
            <ChevronRight size={28} className="text-white/60" />
          </div>
        )}
      </div>

      {/* Story card — true fullscreen */}
      <div
        className="relative bg-black overflow-hidden w-full h-full"
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        {/* Media */}
        {isVideo ? (
          <video
            ref={videoRef}
            src={mediaUrl}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay playsInline
            onEnded={goNext}
            onLoadedData={() => { if (!paused) videoRef.current?.play().catch(() => {}); }}
          />
        ) : (
          <img src={mediaUrl} className="absolute inset-0 w-full h-full object-cover" alt="" />
        )}

        {/* Top gradient */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
        {/* Bottom gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

        {/* Progress bars */}
        <div className="absolute top-3 left-3 right-3 flex gap-[3px] z-20">
          {currentFeed.stories.map((_, i) => (
            <div key={i} className="flex-1 h-[2.5px] bg-white/35 rounded-full overflow-hidden">
              {i < storyIdx ? (
                <div className="h-full w-full bg-white rounded-full" />
              ) : i === storyIdx ? (
                <div
                  key={`${userIdx}-${storyIdx}-${paused}`}
                  className="h-full bg-white rounded-full"
                  style={{
                    animation: paused ? "none" : `storyProgress ${duration}ms linear forwards`,
                    width: paused ? `${progress}%` : undefined,
                  }}
                  onAnimationEnd={() => { setProgress(0); goNext(); }}
                />
              ) : (
                <div className="h-full w-0 bg-white rounded-full" />
              )}
            </div>
          ))}
        </div>
        <style>{`
          @keyframes storyProgress {
            from { width: 0% }
            to { width: 100% }
          }
        `}</style>

        {/* Header row */}
        <div className="absolute top-8 left-3 right-3 flex items-center justify-between z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full ring-2 ring-white/80 overflow-hidden flex-shrink-0">
              {avatarUrl
                ? <img src={avatarUrl} className="w-full h-full object-cover" alt="" />
                : <div className="w-full h-full bg-orange-500 flex items-center justify-center text-white font-bold text-sm">{currentFeed.user.username[0].toUpperCase()}</div>}
            </div>
            <div>
              <p className="text-white text-[13px] font-semibold leading-none drop-shadow">{currentFeed.user.username}</p>
              <p className="text-white/55 text-[11px] mt-0.5">
                {Math.max(0, Math.round((new Date(currentStory.expires_at).getTime() - Date.now()) / 3600000))}h ago
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isOwn && (
              <>
                <button
                  className="text-white/80 p-1.5 hover:text-white"
                  onMouseDown={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}
                  onClick={loadViewers}
                >
                  <Eye size={19} />
                </button>
                <button
                  className="text-white/70 p-1.5 hover:text-red-400"
                  onMouseDown={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}
                  onClick={() => deleteMut.mutate(currentStory.id)}
                >
                  <Trash2 size={17} />
                </button>
              </>
            )}
            <button
              className="text-white/80 p-1.5 hover:text-white"
              onMouseDown={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}
              onClick={onClose}
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Caption */}
        {currentStory.caption && (
          <div className="absolute bottom-24 left-4 right-4 z-20 pointer-events-none">
            <p className="text-white text-sm text-center drop-shadow-lg">{currentStory.caption}</p>
          </div>
        )}

        {/* Bottom bar */}
        <div className="absolute bottom-5 left-3 right-3 z-20" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          {isOwn ? (
            /* Owner: viewers + reactions count */
            <div className="flex items-center gap-3">
              <button
                className="flex items-center gap-2 text-white/80 text-sm"
                onClick={loadViewers}
              >
                <Eye size={18} className="text-white/70" />
                <span className="font-medium">{currentStory.view_count}</span>
              </button>
              {currentStory.reaction_count > 0 && (
                <span className="text-white/60 text-sm">· {currentStory.reaction_count} ❤️</span>
              )}
            </div>
          ) : (
            /* Viewer: reply input + like/react */
            <div className="flex items-center gap-2">
              {showReactions ? (
                <div className="flex gap-2.5 bg-black/50 backdrop-blur-md rounded-full px-4 py-2.5 border border-white/10 flex-1 justify-center">
                  {REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      className={`text-2xl transition-transform active:scale-125 hover:scale-125 ${currentStory.viewer_reaction === emoji ? "scale-110 drop-shadow" : ""}`}
                      onClick={() => reactMut.mutate({ id: currentStory.id, emoji })}
                    >
                      {emoji}
                    </button>
                  ))}
                  <button onClick={() => setShowReactions(false)} className="text-white/50 text-lg ml-1">✕</button>
                </div>
              ) : (
                <>
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onFocus={() => setPaused(true)}
                    onBlur={() => setPaused(false)}
                    placeholder={replySent ? "Sent ✓" : `Reply to ${currentFeed.user.username}...`}
                    className="flex-1 bg-transparent border border-white/30 rounded-full px-4 py-2.5 text-white text-sm placeholder-white/40 outline-none focus:border-white/60"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && replyText.trim()) {
                        setReplySent(true);
                        setReplyText("");
                        setTimeout(() => setReplySent(false), 2000);
                      }
                    }}
                  />
                  <button
                    className={`text-2xl flex-shrink-0 transition-transform hover:scale-110 active:scale-125 ${currentStory.viewer_reaction ? "opacity-100" : "opacity-70"}`}
                    onClick={() => setShowReactions(true)}
                  >
                    {currentStory.viewer_reaction || "🤍"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Tap zones for prev/next within same user */}
        <div className="absolute inset-0 flex z-10" style={{ pointerEvents: showReactions ? "none" : "auto" }}>
          <div className="w-1/3 h-full cursor-pointer" onClick={goPrev} />
          <div className="flex-1 h-full" />
          <div className="w-1/3 h-full cursor-pointer" onClick={goNext} />
        </div>
      </div>

      {/* Viewers bottom sheet */}
      {showViewers && (
        <div className="absolute inset-0 bg-black/70 z-[110] flex items-end justify-center" onClick={() => setShowViewers(false)}>
          <div
            className="w-full max-w-[420px] bg-zinc-900 rounded-t-2xl p-4 max-h-[55vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-zinc-600 rounded-full mx-auto mb-4" />
            <p className="text-white font-semibold text-sm mb-3">Seen by {viewers.length}</p>
            {viewers.map((v: any, i: number) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-zinc-800/60">
                {v.user.avatar_url ? (
                  <img src={v.user.avatar_url.startsWith("http") ? v.user.avatar_url : `${CDN}${v.user.avatar_url}`} className="w-9 h-9 rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-sm">
                    {v.user.username[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{v.user.display_name || v.user.username}</p>
                  <p className="text-zinc-500 text-xs">@{v.user.username}</p>
                </div>
                {v.reaction && <span className="text-xl">{v.reaction}</span>}
              </div>
            ))}
            {viewers.length === 0 && <p className="text-zinc-500 text-sm text-center py-6">No viewers yet</p>}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

// ── Story Create Modal ────────────────────────────────────────────────────────

function StoryCreateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isVideo = file?.type.startsWith("video/");

  const handleFile = (f: File) => {
    setFile(f);
    setError("");
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    setError("");

    try {
      const ext = file.name.split(".").pop() || "jpg";
      const purpose = isVideo ? "story" : "story";
      const presignData = await media.presign({ filename: `story.${ext}`, content_type: file.type, purpose }) as any;
      const { upload_url, key } = presignData;

      await fetch(upload_url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

      let durationSecs: number | undefined;
      if (isVideo && videoRef.current) {
        durationSecs = Math.round(videoRef.current.duration) || undefined;
      }

      await storiesApi.create({
        media_key: key,
        media_type: isVideo ? "video" : "photo",
        caption: caption.trim() || undefined,
        duration_secs: durationSecs,
      });

      qc.invalidateQueries({ queryKey: ["stories-feed"] });
      onClose();
    } catch (e: any) {
      setError("Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" style={{ zIndex: 99999 }}>
      <div className="bg-zinc-900 rounded-2xl w-full max-w-sm border border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h2 className="text-white font-semibold text-sm">Add to Story</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Preview or Drop zone */}
        <div
          className="relative aspect-[9/16] max-h-[40vh] bg-zinc-950 flex items-center justify-center cursor-pointer overflow-hidden"
          onClick={() => !preview && inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          {preview ? (
            isVideo ? (
              <video
                ref={videoRef}
                src={preview}
                className="w-full h-full object-contain"
                controls
                playsInline
              />
            ) : (
              <img src={preview} className="w-full h-full object-contain" alt="" />
            )
          ) : (
            <div className="text-center text-zinc-500">
              <Plus size={40} className="mx-auto mb-2 text-zinc-600" />
              <p className="text-sm">Tap to add photo or video</p>
              <p className="text-xs mt-1 text-zinc-600">Photos: up to 10s · Videos: up to 60s</p>
            </div>
          )}

          {preview && (
            <button
              className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white hover:bg-black"
              onClick={(e) => { e.stopPropagation(); setPreview(null); setFile(null); }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />

        {/* Caption */}
        <div className="px-4 py-3 border-t border-zinc-800">
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption..."
            maxLength={300}
            className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        {error && <p className="text-red-400 text-xs px-4 pb-2">{error}</p>}

        {/* Actions */}
        <div className="px-4 pb-4 flex gap-3">
          <button
            onClick={() => inputRef.current?.click()}
            className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800"
          >
            Change
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file || uploading}
            className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? "Uploading..." : "Share Story"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Stories Row ───────────────────────────────────────────────────────────────

export default function StoriesRow() {
  const { user } = useAuthStore();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: feedItems = [] } = useQuery<StoryFeedItem[]>({
    queryKey: ["stories-feed"],
    queryFn: () => storiesApi.feed() as Promise<StoryFeedItem[]>,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const myStory = feedItems.find((f) => f.user.username === user?.username);
  const others = feedItems.filter((f) => f.user.username !== user?.username);
  const ordered: StoryFeedItem[] = myStory ? [myStory, ...others] : feedItems;

  const openStory = (feedItem: StoryFeedItem) => {
    const idx = ordered.indexOf(feedItem);
    setViewerStart(idx);
    setViewerOpen(true);
  };

  const avatarLetter = user?.username?.[0]?.toUpperCase() ?? "?";
  const myAllViewed = myStory?.stories.every((s) => s.viewed) ?? false;

  return (
    <>
      <div className="flex gap-3 overflow-x-auto px-1 py-3 scrollbar-hide border-b border-zinc-800/50">
        {/* Your Story bubble */}
        <button
          className="flex flex-col items-center gap-1 flex-shrink-0 w-[72px]"
          onClick={() => myStory ? openStory(myStory) : setCreateOpen(true)}
        >
          <div className="relative">
            {/* Gradient ring */}
            <div className={`w-[62px] h-[62px] rounded-full p-[2px] ${myStory && !myAllViewed ? "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600" : "bg-zinc-700"}`}>
              <div className="w-full h-full rounded-full bg-zinc-950 p-[2px]">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-lg">
                    {avatarLetter}
                  </div>
                )}
              </div>
            </div>
            {/* + badge */}
            <div className="absolute -bottom-0.5 -right-0.5 w-[20px] h-[20px] bg-blue-500 rounded-full flex items-center justify-center border-[2px] border-zinc-950">
              <Plus size={11} className="text-white" strokeWidth={3} />
            </div>
          </div>
          <span className="text-white/90 text-[11px] w-[68px] text-center truncate font-normal">Your story</span>
        </button>

        {/* Others' stories */}
        {others.map((feedItem) => {
          const allViewed = feedItem.stories.every((s) => s.viewed);
          const avatarUrl = feedItem.user.avatar_url
            ? (feedItem.user.avatar_url.startsWith("http") ? feedItem.user.avatar_url : `${CDN}${feedItem.user.avatar_url}`)
            : null;
          const letter = feedItem.user.username[0].toUpperCase();

          return (
            <button
              key={feedItem.user.id}
              className="flex flex-col items-center gap-1 flex-shrink-0 w-[72px]"
              onClick={() => openStory(feedItem)}
            >
              <div className={`w-[62px] h-[62px] rounded-full p-[2px] ${allViewed ? "bg-zinc-600" : "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600"}`}>
                <div className="w-full h-full rounded-full bg-zinc-950 p-[2px]">
                  {avatarUrl ? (
                    <img src={avatarUrl} className="w-full h-full rounded-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-lg">
                      {letter}
                    </div>
                  )}
                </div>
              </div>
              <span className={`text-[11px] w-[68px] text-center truncate font-normal ${allViewed ? "text-zinc-500" : "text-white/90"}`}>
                {feedItem.user.username}
              </span>
            </button>
          );
        })}
      </div>

      {viewerOpen && ordered.length > 0 && (
        <StoryViewer
          feedItems={ordered}
          startUserIndex={viewerStart}
          onClose={() => setViewerOpen(false)}
          currentUsername={user?.username}
        />
      )}

      {createOpen && <StoryCreateModal onClose={() => setCreateOpen(false)} />}
    </>
  );
}
