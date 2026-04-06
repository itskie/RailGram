import { useState, useRef, useEffect, useCallback } from "react";
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

  // Progress timer
  const startTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const step = 100;
    const increment = (step / duration) * 100;
    intervalRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(intervalRef.current!);
          goNext();
          return 0;
        }
        return p + increment;
      });
    }, step);
  }, [userIdx, storyIdx, duration]);

  useEffect(() => {
    setProgress(0);
    if (!paused) startTimer();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [userIdx, storyIdx, paused]);

  useEffect(() => {
    if (paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      videoRef.current?.pause();
    } else {
      startTimer();
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

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      onMouseDown={() => setPaused(true)}
      onMouseUp={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      {/* Background */}
      <div className="relative w-full max-w-sm h-full max-h-[100dvh] mx-auto overflow-hidden">
        {/* Media */}
        {isVideo ? (
          <video
            ref={videoRef}
            src={mediaUrl}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            playsInline
            muted={false}
            onEnded={goNext}
            onLoadedData={() => { if (!paused) videoRef.current?.play().catch(() => {}); }}
          />
        ) : (
          <img src={mediaUrl} className="absolute inset-0 w-full h-full object-cover" alt="" />
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60 pointer-events-none" />

        {/* Progress bars */}
        <div className="absolute top-3 left-3 right-3 flex gap-1 z-10">
          {currentFeed.stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-none"
                style={{
                  width: i < storyIdx ? "100%" : i === storyIdx ? `${progress}%` : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-7 left-3 right-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            {avatarUrl ? (
              <img src={avatarUrl} className="w-8 h-8 rounded-full object-cover ring-2 ring-white/60" alt="" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-sm ring-2 ring-white/60">
                {currentFeed.user.username[0].toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-white text-sm font-semibold leading-none">{currentFeed.user.username}</p>
              <p className="text-white/60 text-xs mt-0.5">
                {new Date(currentStory.expires_at).getTime() - Date.now() > 0
                  ? `${Math.round((new Date(currentStory.expires_at).getTime() - Date.now()) / 3600000)}h left`
                  : "Expired"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOwn && (
              <>
                <button
                  className="text-white/80 hover:text-white p-1"
                  onMouseDown={(e) => { e.stopPropagation(); loadViewers(); }}
                  onTouchEnd={(e) => { e.stopPropagation(); loadViewers(); }}
                >
                  <Eye size={18} />
                </button>
                <button
                  className="text-red-400 hover:text-red-300 p-1"
                  onMouseDown={(e) => { e.stopPropagation(); deleteMut.mutate(currentStory.id); }}
                  onTouchEnd={(e) => { e.stopPropagation(); deleteMut.mutate(currentStory.id); }}
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
            <button
              className="text-white/80 hover:text-white p-1"
              onMouseDown={(e) => { e.stopPropagation(); onClose(); }}
              onTouchEnd={(e) => { e.stopPropagation(); onClose(); }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Caption */}
        {currentStory.caption && (
          <div className="absolute bottom-20 left-4 right-4 z-10 pointer-events-none">
            <p className="text-white text-sm text-center drop-shadow-lg bg-black/20 rounded-lg px-3 py-2 backdrop-blur-sm">
              {currentStory.caption}
            </p>
          </div>
        )}

        {/* Bottom bar — reactions + viewer count */}
        <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center gap-3">
          {!isOwn && (
            <>
              {showReactions ? (
                <div
                  className="flex gap-2 bg-zinc-900/90 backdrop-blur-md rounded-full px-4 py-2 border border-zinc-700"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      className={`text-xl transition-transform hover:scale-125 ${currentStory.viewer_reaction === emoji ? "scale-110" : ""}`}
                      onClick={() => reactMut.mutate({ id: currentStory.id, emoji })}
                    >
                      {emoji}
                    </button>
                  ))}
                  <button onClick={() => setShowReactions(false)} className="text-zinc-400 text-sm ml-1">✕</button>
                </div>
              ) : (
                <button
                  className="flex items-center gap-2 bg-zinc-900/70 backdrop-blur-md border border-zinc-700 rounded-full px-4 py-2 text-sm text-white hover:bg-zinc-800"
                  onMouseDown={(e) => { e.stopPropagation(); setPaused(true); }}
                  onMouseUp={(e) => e.stopPropagation()}
                  onClick={() => setShowReactions(true)}
                >
                  {currentStory.viewer_reaction || "😊"} React
                </button>
              )}
            </>
          )}
          {isOwn && (
            <div className="flex items-center gap-1 text-white/70 text-sm">
              <Eye size={14} />
              <span>{currentStory.view_count}</span>
              {currentStory.reaction_count > 0 && (
                <span className="ml-2">· {currentStory.reaction_count} reacts</span>
              )}
            </div>
          )}
        </div>

        {/* Tap zones */}
        <div className="absolute inset-0 flex" style={{ zIndex: 5 }}>
          <div className="w-1/3 h-full cursor-pointer" onClick={goPrev} />
          <div className="flex-1 h-full" />
          <div className="w-1/3 h-full cursor-pointer" onClick={goNext} />
        </div>

        {/* Nav arrows */}
        {userIdx > 0 && (
          <button
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-black/30 rounded-full p-1 text-white"
            onClick={goPrev}
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {userIdx < feedItems.length - 1 && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-black/30 rounded-full p-1 text-white"
            onClick={goNext}
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {/* Viewers sheet */}
      {showViewers && (
        <div
          className="absolute inset-0 bg-black/60 z-30 flex items-end justify-center"
          onClick={() => setShowViewers(false)}
        >
          <div
            className="w-full max-w-sm bg-zinc-900 rounded-t-2xl p-4 max-h-[60vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-white font-semibold text-sm mb-3">Viewers ({viewers.length})</p>
            {viewers.map((v: any, i: number) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-zinc-800">
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
            {viewers.length === 0 && <p className="text-zinc-500 text-sm text-center py-4">No viewers yet</p>}
          </div>
        </div>
      )}
    </div>
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

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
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
    </div>
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
      <div className="flex gap-4 overflow-x-auto px-3 py-3 scrollbar-hide border-b border-zinc-800/60">
        {/* Your Story bubble */}
        <button
          className="flex flex-col items-center gap-1.5 flex-shrink-0"
          onClick={() => myStory ? openStory(myStory) : setCreateOpen(true)}
        >
          <div className={`w-16 h-16 rounded-full p-[2.5px] ${myStory && !myAllViewed ? "bg-gradient-to-tr from-orange-500 to-pink-500" : "bg-zinc-700"}`}>
            <div className="w-full h-full rounded-full bg-zinc-950 p-[2px] relative">
              {user?.avatar_url ? (
                <img src={user.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-xl">
                  {avatarLetter}
                </div>
              )}
              {!myStory && (
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center border-2 border-zinc-950">
                  <Plus size={10} className="text-white" strokeWidth={3} />
                </div>
              )}
            </div>
          </div>
          <span className="text-white text-[10px] w-16 text-center truncate">Your story</span>
        </button>

        {/* Add story button if I have one already */}
        {myStory && (
          <button
            className="flex flex-col items-center gap-1.5 flex-shrink-0"
            onClick={() => setCreateOpen(true)}
          >
            <div className="w-16 h-16 rounded-full bg-zinc-800 border-2 border-dashed border-zinc-600 flex items-center justify-center">
              <Plus size={22} className="text-zinc-400" strokeWidth={2} />
            </div>
            <span className="text-zinc-500 text-[10px] w-16 text-center truncate">Add more</span>
          </button>
        )}

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
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
              onClick={() => openStory(feedItem)}
            >
              <div className={`w-16 h-16 rounded-full p-[2.5px] ${allViewed ? "bg-zinc-700" : "bg-gradient-to-tr from-orange-500 to-pink-500"}`}>
                <div className="w-full h-full rounded-full bg-zinc-950 p-[2px]">
                  {avatarUrl ? (
                    <img src={avatarUrl} className="w-full h-full rounded-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-xl">
                      {letter}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-white text-[10px] w-16 text-center truncate">{feedItem.user.username}</span>
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
