import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { users as usersApi, gamification as gamApi, posts as postsApi, reels as reelsApi, stories as storiesApi, chat as chatApi } from "../lib/api";
import type { Post, UserProfileOut, UserBrief } from "../types";
import type { ReelFeedResponse } from "../features/reels/types/reel";
import PostCard from "../components/PostCard";
import { ReelCard } from "../features/reels/components/ReelCard";
import { useAuthStore } from "../store/authStore";
import { useState, useEffect, useRef } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  ArrowLeft, UserPlus, UserMinus, Loader, User as UserIcon,
  Settings, MapPin, Milestone, Zap, X, Grid3X3, Bookmark, Clapperboard,
  Lock, MoreHorizontal, Shield, Plus, MessageCircle
} from "lucide-react";
import { createPortal } from "react-dom";
import VerifiedBadge from "../components/VerifiedBadge";

const CDN = "https://dzdr0nfpn0f2c.cloudfront.net/";

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [listModal, setListModal] = useState<"followers" | "following" | null>(null);
  const [activeTab, setActiveTab] = useState<"posts" | "reels" | "saved">("posts");
  const [toast, setToast] = useState("");
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [highlightViewer, setHighlightViewer] = useState<any | null>(null);
  const [highlightStoryIdx, setHighlightStoryIdx] = useState(0);
  const [createHighlightOpen, setCreateHighlightOpen] = useState(false);
  const [newHighlightTitle, setNewHighlightTitle] = useState("");
  const [creatingHighlight, setCreatingHighlight] = useState(false);
  const [createStep, setCreateStep] = useState<"select" | "name">("select");
  const [selectedStoryIds, setSelectedStoryIds] = useState<string[]>([]);
  const [deleteHighlightTarget, setDeleteHighlightTarget] = useState<any | null>(null);
  const [editHighlightTarget, setEditHighlightTarget] = useState<any | null>(null);
  const [editHighlightTitle, setEditHighlightTitle] = useState("");
  const [editHighlightCoverKey, setEditHighlightCoverKey] = useState<string | undefined>(undefined);
  const [savingEdit, setSavingEdit] = useState(false);
  const [addToHighlightTarget, setAddToHighlightTarget] = useState<any | null>(null);
  const [addStoryIds, setAddStoryIds] = useState<string[]>([]);
  const [addingToHighlight, setAddingToHighlight] = useState(false);
  // Long press on highlight bubble
  const highlightPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const { data: profile, isLoading } = useQuery<UserProfileOut>({
    queryKey: ["profile", username],
    queryFn: () => usersApi.profile(username!) as Promise<UserProfileOut>,
    enabled: !!username,
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["user-stats", username],
    queryFn: () => gamApi.stats(username!) as Promise<any>,
    enabled: !!username,
  });

  const isMe = me?.username === username;
  const isPrivateAndNotFollowing = profile?.is_private && !isMe && !profile?.is_following;

  const { data: highlights = [] } = useQuery<any[]>({
    queryKey: ["highlights", username],
    queryFn: () => storiesApi.userHighlights(username!) as Promise<any[]>,
    enabled: !!username && !isPrivateAndNotFollowing,
  });

  const { data: myArchive = [], isLoading: archiveLoading } = useQuery<any[]>({
    queryKey: ["my-story-archive", createHighlightOpen || !!addToHighlightTarget],
    queryFn: () => storiesApi.archive() as Promise<any[]>,
    enabled: isMe && (createHighlightOpen || !!addToHighlightTarget),
    staleTime: 0,
    gcTime: 0,
  });

  const { data: userPosts } = useQuery<Post[]>({
    queryKey: ["user-posts", username],
    queryFn: async () => {
      const r = await usersApi.posts(username!) as { posts?: Post[] } | Post[];
      if (Array.isArray(r)) return r;
      return r.posts ?? [];
    },
    enabled: !!username && !isPrivateAndNotFollowing,
  });

  const { data: userReels } = useQuery<ReelFeedResponse | null>({
    queryKey: ["user-reels", username],
    queryFn: async () => {
      if (!profile?.id) return null;
      return await reelsApi.user(profile.id) as ReelFeedResponse;
    },
    enabled: !!profile?.id && !isPrivateAndNotFollowing,
  });

  const { data: savedPosts } = useQuery<Post[]>({
    queryKey: ["saved-posts"],
    queryFn: async () => {
      const r = await postsApi.bookmarked() as { posts?: Post[] };
      return r.posts ?? [];
    },
    enabled: me?.username === username && activeTab === "saved",
  });

  const { data: savedReels } = useQuery<ReelFeedResponse | null>({
    queryKey: ["saved-reels"],
    queryFn: async () => {
      return await reelsApi.saved() as ReelFeedResponse;
    },
    enabled: me?.username === username && activeTab === "saved",
  });

  // Check if we have a pending follow request to this user
  const { data: sentRequests } = useQuery<any[]>({
    queryKey: ["sent-follow-requests"],
    queryFn: async () => {
      const data = await usersApi.getSentRequests();
      return data as any[];
    },
    enabled: !isMe && profile?.is_private,
  });
  const hasPendingRequest = sentRequests?.some((r: any) => r.followed.username === username);

  const followMut = useMutation({
    mutationFn: () =>
      profile?.is_following
        ? usersApi.unfollow(username!)
        : usersApi.follow(username!),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["profile", username] });
      qc.invalidateQueries({ queryKey: ["sent-follow-requests"] });
      // If pending request, show alert
      if (data?.pending) {
        setToast(`Follow request sent to @${username}!`);
      }
    },
    onError: (error: any) => {
      setToast(error.message || 'Failed to send follow request');
    },
  });

  const cancelRequestMut = useMutation({
    mutationFn: (requestId: number) => usersApi.cancelFollowRequest(requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", username] });
      qc.invalidateQueries({ queryKey: ["sent-follow-requests"] });
    },
    onError: (error: any) => {
      setToast(error.message || 'Failed to cancel request');
    },
  });

  const blockMut = useMutation({
    mutationFn: () =>
      profile?.is_blocked
        ? usersApi.unblock(username!)
        : usersApi.block(username!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", username] });
      setShowMenu(false);
      nav(0); // Refresh page to apply block/unblock
    },
  });

  const [showMenu, setShowMenu] = useState(false);

  const { data: modalList, isLoading: modalLoading } = useQuery<UserBrief[]>({
    queryKey: ["user-list", username, listModal],
    queryFn: () =>
      listModal === "followers"
        ? usersApi.followers(username!) as Promise<UserBrief[]>
        : usersApi.following(username!) as Promise<UserBrief[]>,
    enabled: !!listModal && !!username,
  });

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader className="animate-spin text-orange-400" /></div>;
  }

  if (!profile) {
    return <div className="p-4 text-zinc-400">User not found.</div>;
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 mb-4">
        <ArrowLeft size={15} /> Back
      </button>

      {/* Profile header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-zinc-700 overflow-hidden flex-shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} className="w-full h-full object-cover" alt={profile.username} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">
                <UserIcon size={28} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg leading-none truncate">
                  {profile.display_name ?? profile.username}
                </h1>
                {profile.is_verified && <VerifiedBadge type="blue" size={14} />}
                {profile.is_private && (
                  <div className="w-5 h-5 bg-zinc-700 rounded-full flex items-center justify-center" title="Private Account">
                    <Lock size={12} className="text-zinc-300" />
                  </div>
                )}
              </div>
              {!isMe && (
                <button
                  onClick={() => setShowMenu(true)}
                  className="text-zinc-400 hover:text-zinc-200 transition-colors p-2"
                >
                  <MoreHorizontal size={20} />
                </button>
              )}
            </div>
            <p className="text-sm text-zinc-400 mt-1">@{profile.username}</p>
            {profile.bio && <p className="text-sm text-zinc-300 mt-2 leading-relaxed">{profile.bio}</p>}
            
            <div className="flex flex-wrap gap-2 mt-3">
              {profile.favourite_train && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-teal-500/10 border border-teal-500/20 rounded-full text-[10px] font-bold text-teal-500 uppercase tracking-tight">
                  <Milestone size={10} /> {profile.favourite_train}
                </div>
              )}
              {profile.home_station && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded-full text-[10px] font-bold text-orange-500 uppercase tracking-tight">
                  <MapPin size={10} /> {profile.home_station}
                </div>
              )}
              {stats && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-[10px] font-bold text-yellow-500 uppercase tracking-tight">
                  <Zap size={10} /> {stats.karma} Karma
                </div>
              )}
            </div>

            {/* Badges Ribbon */}
            {stats?.badges && stats.badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {stats.badges.filter((b: any) => b.earned_at).map((b: any) => (
                  <div 
                    key={b.id} 
                    title={b.name}
                    className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-lg hover:scale-110 transition-transform cursor-help shadow-lg shadow-black"
                  >
                    {b.icon}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 divide-x divide-zinc-800 mt-4 text-center">
          <div className="px-2 py-1">
            <p className="font-bold text-lg text-zinc-100">{(profile.post_count ?? 0).toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Posts</p>
          </div>
          <button
            onClick={() => { if (!isPrivateAndNotFollowing) setListModal("followers"); }}
            className={`px-2 py-1 transition-colors ${isPrivateAndNotFollowing ? 'cursor-default' : 'hover:bg-zinc-800/50 cursor-pointer'}`}
          >
            <p className="font-bold text-lg text-zinc-100">{(profile.follower_count ?? 0).toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Followers</p>
          </button>
          <button
            onClick={() => { if (!isPrivateAndNotFollowing) setListModal("following"); }}
            className={`px-2 py-1 transition-colors ${isPrivateAndNotFollowing ? 'cursor-default' : 'hover:bg-zinc-800/50 cursor-pointer'}`}
          >
            <p className="font-bold text-lg text-zinc-100">{(profile.following_count ?? 0).toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Following</p>
          </button>
          <div className="px-2 py-1">
            <p className="font-bold text-lg text-zinc-100">{(profile.karma ?? 0).toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Karma</p>
          </div>
        </div>

        {/* Action button */}
        {isMe ? (
          <Link
            to="/profile/edit"
            className="mt-5 w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-all border border-zinc-700 shadow-lg active:scale-[0.98]"
          >
            <Settings size={15} /> Edit Profile
          </Link>
        ) : (
          <button
            onClick={() => {
              if (hasPendingRequest) {
                setCancelConfirmOpen(true);
              } else {
                followMut.mutate();
              }
            }}
            disabled={followMut.isPending || cancelRequestMut.isPending}
            className={`mt-5 w-full rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-all border shadow-lg active:scale-[0.98] disabled:opacity-50 ${
              profile.is_following
                ? "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                : hasPendingRequest
                ? "bg-zinc-700 text-zinc-300 border-zinc-600 hover:bg-zinc-600"
                : profile.is_private
                ? "bg-orange-500/50 text-orange-200 border-orange-500/30 hover:bg-orange-500/60"
                : "bg-orange-500 hover:bg-orange-600 text-white border-orange-400"
            }`}
          >
            {profile.is_following ? (
              <><UserMinus size={15} /> Unfollow</>
            ) : hasPendingRequest ? (
              <><UserMinus size={15} /> Cancel Request</>
            ) : profile.is_private ? (
              <><UserPlus size={15} /> Request to Follow</>
            ) : (
              <><UserPlus size={15} /> Follow</>
            )}
          </button>
        )}

        {/* Message button — only for other users */}
        {!isMe && (
          <button
            onClick={async () => {
              const conv = await chatApi.start(profile.username) as any;
              qc.invalidateQueries({ queryKey: ["conversations"] });
              nav(`/chat/${conv.id}`);
            }}
            className="mt-2 w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-all border border-zinc-700 active:scale-[0.98]"
          >
            <MessageCircle size={15} /> Message
          </button>
        )}
      </div>

      {/* Highlights Row */}
      {(highlights.length > 0 || isMe) && (
        <div className="flex gap-4 overflow-x-auto px-1 py-4 scrollbar-hide border-b border-zinc-800/50 mb-2">
          {/* New highlight button — only on own profile */}
          {isMe && (
            <button
              className="flex flex-col items-center gap-1 shrink-0 w-[68px]"
              onClick={() => setCreateHighlightOpen(true)}
            >
              <div className="w-[58px] h-[58px] rounded-full bg-zinc-800 border-2 border-dashed border-zinc-600 flex items-center justify-center hover:border-zinc-400 transition-colors">
                <Plus size={20} className="text-zinc-400" />
              </div>
              <span className="text-zinc-500 text-[11px] w-[68px] text-center truncate">New</span>
            </button>
          )}
          {highlights.map((h: any) => (
            <div key={h.id} className="flex flex-col items-center gap-1 shrink-0 w-[68px] relative group">
              <button
                className="flex flex-col items-center gap-1 w-full"
                onClick={async () => {
                  try {
                    const detail = await storiesApi.getHighlight(h.id) as any;
                    setHighlightViewer(detail);
                    setHighlightStoryIdx(0);
                  } catch {}
                }}
                onContextMenu={(e) => {
                  if (!isMe) return;
                  e.preventDefault();
                  setEditHighlightTarget(h);
                  setEditHighlightTitle(h.title);
                  setEditHighlightCoverKey(h.cover_key);
                }}
                onTouchStart={() => {
                  if (!isMe) return;
                  highlightPressTimer.current = setTimeout(() => {
                    setEditHighlightTarget(h);
                    setEditHighlightTitle(h.title);
                    setEditHighlightCoverKey(h.cover_key);
                  }, 600);
                }}
                onTouchEnd={() => { if (highlightPressTimer.current) clearTimeout(highlightPressTimer.current); }}
              >
                <div className="w-[58px] h-[58px] rounded-full bg-zinc-800 border-2 border-zinc-600 overflow-hidden flex items-center justify-center hover:border-orange-500 transition-colors">
                  {h.cover_key ? (
                    <img src={`${CDN}${h.cover_key}`} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <span className="text-xl">🔖</span>
                  )}
                </div>
                <span className="text-zinc-300 text-[11px] w-[68px] text-center truncate">{h.title}</span>
              </button>
              {/* Options on hover — only own profile */}
              {isMe && (
                <button
                  className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-zinc-600 hover:bg-zinc-600"
                  onClick={(e) => { e.stopPropagation(); setEditHighlightTarget(h); setEditHighlightTitle(h.title); setEditHighlightCoverKey(h.cover_key); }}
                >
                  <MoreHorizontal size={10} className="text-white" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Highlight Modal — 2 step: select stories → name */}
      {createHighlightOpen && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center" style={{ zIndex: 99999 }}>
          <div className="bg-zinc-900 rounded-t-2xl sm:rounded-2xl w-full max-w-sm border border-zinc-800 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
              {createStep === "name" && (
                <button onClick={() => setCreateStep("select")} className="text-zinc-400 hover:text-white text-sm">← Back</button>
              )}
              {createStep === "select" && <div />}
              <h2 className="text-white font-semibold text-sm absolute left-1/2 -translate-x-1/2">
                {createStep === "select" ? "Select Stories" : "New Highlight"}
              </h2>
              <button onClick={() => { setCreateHighlightOpen(false); setCreateStep("select"); setSelectedStoryIds([]); setNewHighlightTitle(""); }} className="text-zinc-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {createStep === "select" ? (
              <>
                <p className="text-zinc-500 text-xs px-4 pt-3 pb-1 shrink-0">Choose stories to add to your highlight (active + archived)</p>
                <div className="overflow-y-auto flex-1 px-4 py-2">
                  {archiveLoading && (
                    <div className="flex justify-center py-8">
                      <Loader className="animate-spin text-orange-400" size={24} />
                    </div>
                  )}
                  {!archiveLoading && myArchive.length === 0 && (
                    <p className="text-zinc-500 text-sm text-center py-8">No stories yet. Post a story first!</p>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    {myArchive.map((story: any) => {
                      const selected = selectedStoryIds.includes(story.id);
                      const isExpired = new Date(story.expires_at) < new Date();
                      const url = `https://dzdr0nfpn0f2c.cloudfront.net/${story.media_key}`;
                      return (
                        <button
                          key={story.id}
                          onClick={() => setSelectedStoryIds(prev =>
                            prev.includes(story.id) ? prev.filter(id => id !== story.id) : [...prev, story.id]
                          )}
                          className="relative aspect-[9/16] rounded-lg overflow-hidden border-2 transition-all"
                          style={{ borderColor: selected ? "#f97316" : "transparent" }}
                        >
                          {story.media_type === "video" ? (
                            <video src={url} className="w-full h-full object-cover" muted />
                          ) : (
                            <img src={url} className="w-full h-full object-cover" alt="" />
                          )}
                          {isExpired && (
                            <div className="absolute top-1 left-1 bg-black/60 rounded px-1 py-0.5">
                              <span className="text-white/70 text-[9px]">Archived</span>
                            </div>
                          )}
                          {selected && (
                            <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center">
                              <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
                                <span className="text-white text-xs font-bold">✓</span>
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="px-4 py-3 border-t border-zinc-800 shrink-0">
                  <button
                    disabled={selectedStoryIds.length === 0}
                    onClick={() => setCreateStep("name")}
                    className="w-full py-3 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next ({selectedStoryIds.length} selected)
                  </button>
                </div>
              </>
            ) : (
              <div className="p-4 flex flex-col gap-3">
                {/* Cover preview — first selected story */}
                {selectedStoryIds[0] && (() => {
                  const s = myArchive.find((x: any) => x.id === selectedStoryIds[0]);
                  const url = s ? `https://dzdr0nfpn0f2c.cloudfront.net/${s.media_key}` : null;
                  return url ? (
                    <div className="w-20 h-20 rounded-full overflow-hidden mx-auto border-2 border-orange-500">
                      <img src={url} className="w-full h-full object-cover" alt="" />
                    </div>
                  ) : null;
                })()}
                <input
                  value={newHighlightTitle}
                  onChange={(e) => setNewHighlightTitle(e.target.value)}
                  placeholder="Highlight name (e.g. Trains, Travel...)"
                  maxLength={60}
                  className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-orange-500 text-center"
                  autoFocus
                />
                <button
                  disabled={!newHighlightTitle.trim() || creatingHighlight}
                  onClick={async () => {
                    if (!newHighlightTitle.trim()) return;
                    setCreatingHighlight(true);
                    try {
                      const h = await storiesApi.createHighlight({ title: newHighlightTitle.trim() }) as any;
                      // Add all selected stories
                      for (const storyId of selectedStoryIds) {
                        try { await storiesApi.addToHighlight(h.id, storyId); } catch {}
                      }
                      qc.invalidateQueries({ queryKey: ["highlights", username] });
                      setCreateHighlightOpen(false);
                      setCreateStep("select");
                      setSelectedStoryIds([]);
                      setNewHighlightTitle("");
                    } catch {}
                    setCreatingHighlight(false);
                  }}
                  className="w-full py-3 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingHighlight ? "Creating..." : "Add Highlight"}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Highlight Viewer */}
      {highlightViewer && highlightViewer.items?.length > 0 && createPortal(
        <div className="fixed inset-0 bg-black flex items-center justify-center" style={{ zIndex: 99999 }}>
          <div
            className="relative bg-black overflow-hidden"
            style={{ width: "min(56vh, 420px)", height: "min(100dvh, 746px)", borderRadius: 12 }}
          >
            <img src={`${CDN}${highlightViewer.items[highlightStoryIdx]?.media_key}`} className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-60" alt="" aria-hidden />
            <img src={`${CDN}${highlightViewer.items[highlightStoryIdx]?.media_key}`} className="absolute inset-0 w-full h-full object-contain" alt="" />
            <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

            {/* Progress bars */}
            <div className="absolute top-3 left-3 right-3 flex gap-[3px] z-10">
              {highlightViewer.items.map((_: any, i: number) => (
                <div key={i} className="flex-1 h-[2.5px] rounded-full overflow-hidden bg-white/35">
                  <div
                    className="h-full bg-white rounded-full"
                    style={{ width: i <= highlightStoryIdx ? "100%" : "0%" }}
                  />
                </div>
              ))}
            </div>

            {/* Header */}
            <div className="absolute top-8 left-3 right-3 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-zinc-700 border border-white/30 overflow-hidden">
                  {highlightViewer.cover_key
                    ? <img src={`${CDN}${highlightViewer.cover_key}`} className="w-full h-full object-cover" alt="" />
                    : <span className="flex items-center justify-center w-full h-full text-sm">🔖</span>}
                </div>
                <span className="text-white font-semibold text-[13px] drop-shadow">{highlightViewer.title}</span>
              </div>
              <button onClick={() => setHighlightViewer(null)} className="text-white/80 hover:text-white p-1">
                <X size={22} />
              </button>
            </div>

            {/* Caption */}
            {highlightViewer.items[highlightStoryIdx]?.caption && (
              <div className="absolute bottom-8 left-4 right-4 z-10 text-center pointer-events-none">
                <p className="text-white text-sm drop-shadow-lg">{highlightViewer.items[highlightStoryIdx].caption}</p>
              </div>
            )}

            {/* Tap zones */}
            <div className="absolute inset-0 flex z-10">
              <div className="w-1/2 h-full cursor-pointer" onClick={() => setHighlightStoryIdx(i => Math.max(0, i - 1))} />
              <div className="w-1/2 h-full cursor-pointer" onClick={() => {
                if (highlightStoryIdx < highlightViewer.items.length - 1) setHighlightStoryIdx(i => i + 1);
                else setHighlightViewer(null);
              }} />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Highlight Options Modal — Edit / Add Stories / Delete */}
      {editHighlightTarget && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center" style={{ zIndex: 99999 }} onClick={() => setEditHighlightTarget(null)}>
          <div className="w-full max-w-sm bg-zinc-900 rounded-t-2xl border border-zinc-800 overflow-hidden pb-6 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-zinc-600 rounded-full mx-auto mt-3 mb-3 shrink-0" />
            <p className="text-white font-semibold text-sm text-center mb-3 px-4 truncate shrink-0">Edit Highlight</p>

            <div className="overflow-y-auto flex-1 px-4">
              {/* Cover preview + change */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-orange-500 shrink-0">
                  {editHighlightCoverKey ? (
                    <img src={`${CDN}${editHighlightCoverKey}`} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full bg-zinc-700 flex items-center justify-center text-xl">🔖</div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-zinc-400 text-xs mb-1">Cover photo — tap a story below to change</p>
                </div>
              </div>

              {/* Story grid for cover selection */}
              {myArchive.length > 0 && (
                <>
                  <p className="text-zinc-500 text-xs mb-2">Select cover</p>
                  <div className="grid grid-cols-4 gap-1.5 mb-4">
                    {myArchive.slice(0, 12).map((story: any) => {
                      const url = `${CDN}${story.media_key}`;
                      const selected = editHighlightCoverKey === story.media_key;
                      return (
                        <button
                          key={story.id}
                          onClick={() => setEditHighlightCoverKey(story.media_key)}
                          className="relative aspect-square rounded-lg overflow-hidden border-2 transition-all"
                          style={{ borderColor: selected ? "#f97316" : "transparent" }}
                        >
                          {story.media_type === "video" ? (
                            <video src={url} className="w-full h-full object-cover" muted />
                          ) : (
                            <img src={url} className="w-full h-full object-cover" alt="" />
                          )}
                          {selected && (
                            <div className="absolute inset-0 bg-orange-500/30 flex items-center justify-center">
                              <span className="text-white text-xs font-bold">✓</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Rename */}
              <input
                value={editHighlightTitle}
                onChange={(e) => setEditHighlightTitle(e.target.value)}
                placeholder="Highlight name"
                maxLength={60}
                className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-orange-500 mb-3"
              />
            </div>

            <div className="px-4 shrink-0 flex flex-col gap-2 pt-2">
              {/* Save */}
              <button
                disabled={savingEdit || !editHighlightTitle.trim()}
                onClick={async () => {
                  setSavingEdit(true);
                  try {
                    await storiesApi.updateHighlight(editHighlightTarget.id, { title: editHighlightTitle.trim(), cover_key: editHighlightCoverKey });
                    qc.invalidateQueries({ queryKey: ["highlights", username] });
                    setEditHighlightTarget(null);
                  } catch {}
                  setSavingEdit(false);
                }}
                className="w-full py-3 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-400 disabled:opacity-40"
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
              {/* Add stories */}
              <button
                onClick={() => { setAddToHighlightTarget(editHighlightTarget); setAddStoryIds([]); setEditHighlightTarget(null); }}
                className="w-full py-3 rounded-xl bg-zinc-800 text-white text-sm font-semibold hover:bg-zinc-700"
              >
                Add Stories
              </button>
              {/* Delete */}
              <button
                onClick={() => { setDeleteHighlightTarget(editHighlightTarget); setEditHighlightTarget(null); }}
                className="w-full py-3 rounded-xl bg-red-600/20 text-red-400 text-sm font-semibold hover:bg-red-600/30"
              >
                Delete Highlight
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Stories to Existing Highlight Modal */}
      {addToHighlightTarget && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center" style={{ zIndex: 99999 }}>
          <div className="bg-zinc-900 rounded-t-2xl sm:rounded-2xl w-full max-w-sm border border-zinc-800 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
              <button onClick={() => setAddToHighlightTarget(null)} className="text-zinc-400 hover:text-white text-sm">Cancel</button>
              <h2 className="text-white font-semibold text-sm">Add to "{addToHighlightTarget.title}"</h2>
              <div className="w-12" />
            </div>
            <p className="text-zinc-500 text-xs px-4 pt-3 pb-1 shrink-0">Select stories to add</p>
            <div className="overflow-y-auto flex-1 px-4 py-2">
              {archiveLoading && <div className="flex justify-center py-8"><Loader className="animate-spin text-orange-400" size={24} /></div>}
              {!archiveLoading && myArchive.length === 0 && (
                <p className="text-zinc-500 text-sm text-center py-8">No stories yet.</p>
              )}
              <div className="grid grid-cols-3 gap-2">
                {myArchive.map((story: any) => {
                  const selected = addStoryIds.includes(story.id);
                  const isExpired = new Date(story.expires_at) < new Date();
                  const url = `${CDN}${story.media_key}`;
                  return (
                    <button
                      key={story.id}
                      onClick={() => setAddStoryIds(prev => prev.includes(story.id) ? prev.filter(id => id !== story.id) : [...prev, story.id])}
                      className="relative aspect-[9/16] rounded-lg overflow-hidden border-2 transition-all"
                      style={{ borderColor: selected ? "#f97316" : "transparent" }}
                    >
                      {story.media_type === "video" ? (
                        <video src={url} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={url} className="w-full h-full object-cover" alt="" />
                      )}
                      {isExpired && (
                        <div className="absolute top-1 left-1 bg-black/60 rounded px-1 py-0.5">
                          <span className="text-white/70 text-[9px]">Archived</span>
                        </div>
                      )}
                      {selected && (
                        <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center">
                          <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">✓</span>
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-zinc-800 shrink-0">
              <button
                disabled={addStoryIds.length === 0 || addingToHighlight}
                onClick={async () => {
                  setAddingToHighlight(true);
                  try {
                    for (const storyId of addStoryIds) {
                      try { await storiesApi.addToHighlight(addToHighlightTarget.id, storyId); } catch {}
                    }
                    qc.invalidateQueries({ queryKey: ["highlights", username] });
                    setAddToHighlightTarget(null);
                    setAddStoryIds([]);
                  } catch {}
                  setAddingToHighlight(false);
                }}
                className="w-full py-3 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {addingToHighlight ? "Adding..." : `Add (${addStoryIds.length} selected)`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Tabs — Saved only on own profile, hidden for private accounts */}
      <div className={`flex border-b border-zinc-800 mb-4 ${isPrivateAndNotFollowing ? 'hidden' : ''}`}>
        <button
          onClick={() => setActiveTab("posts")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
            activeTab === "posts" ? "text-white border-b-2 border-orange-500" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Grid3X3 size={16} /> Posts
        </button>
        <button
          onClick={() => setActiveTab("reels")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
            activeTab === "reels" ? "text-white border-b-2 border-orange-500" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Clapperboard size={16} /> Reels
        </button>
        {isMe && (
          <button
            onClick={() => setActiveTab("saved")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
              activeTab === "saved" ? "text-white border-b-2 border-orange-500" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Bookmark size={16} /> Saved
          </button>
        )}
      </div>

      {/* Posts / Reels / Saved grid */}
      <div className="flex flex-col gap-4">
        {/* Private account wall */}
        {isPrivateAndNotFollowing ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-6">
            <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="text-zinc-400" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-lg">This account is private</p>
              <p className="text-zinc-500 text-sm mt-1">Follow this account to see their photos and videos.</p>
            </div>
          </div>
        ) : (
          <>
        {activeTab === "posts" && (
          <>
            {(Array.isArray(userPosts) ? userPosts : []).map((p) => <PostCard key={p.id} post={p} />)}
            {Array.isArray(userPosts) && userPosts.length === 0 && (
              <p className="text-center text-zinc-500 text-sm py-8">No posts yet.</p>
            )}
          </>
        )}
        {activeTab === "reels" && (
          <>
            {(userReels?.items ?? []).map((r) => <ReelCard key={r.id} reel={r} />)}
            {(!userReels?.items || userReels.items.length === 0) && (
              <p className="text-center text-zinc-500 text-sm py-8">No reels yet.</p>
            )}
          </>
        )}
        {activeTab === "saved" && (
          <>
            {/* Saved Posts */}
            {(Array.isArray(savedPosts) ? savedPosts : []).map((p) => <PostCard key={p.id} post={p} />)}
            {Array.isArray(savedPosts) && savedPosts.length === 0 && (
              <p className="text-center text-zinc-500 text-sm py-8">No saved posts yet.</p>
            )}
            {/* Saved Reels */}
            {(savedReels?.items ?? []).map((r) => <ReelCard key={r.id} reel={r} />)}
            {(!savedReels?.items || savedReels.items.length === 0) && (
              <p className="text-center text-zinc-500 text-sm py-8">No saved reels yet.</p>
            )}
          </>
        )}
          </>
        )}
      </div>

      {/* Followers / Following Modal */}
      {listModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setListModal(null)}
        >
          <div
            className="w-full sm:max-w-sm bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h2 className="font-bold text-sm text-zinc-100 capitalize">{listModal}</h2>
              <button onClick={() => setListModal(null)} className="text-zinc-400 hover:text-zinc-200">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 py-2">
              {modalLoading && (
                <div className="flex justify-center py-8"><Loader className="animate-spin text-orange-400" /></div>
              )}
              {!modalLoading && (!modalList || modalList.length === 0) && (
                <p className="text-center text-zinc-500 text-sm py-8">No {listModal} yet.</p>
              )}
              {modalList?.map((u) => (
                <Link
                  key={u.id}
                  to={`/profile/${u.username}`}
                  onClick={() => setListModal(null)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-zinc-700 overflow-hidden shrink-0">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-400">
                        {u.display_name?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-100 truncate">{u.display_name ?? u.username}</p>
                    <p className="text-xs text-zinc-500">@{u.username}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3-Dots Menu Modal */}
      {showMenu && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowMenu(false)}
        >
          <div
            className="w-full max-w-xs bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-zinc-800">
              <h3 className="font-bold text-sm text-zinc-100">@{profile.username}</h3>
            </div>
            <div className="py-2">
              <button
                onClick={() => blockMut.mutate()}
                className="w-full px-4 py-3 text-left text-red-500 hover:bg-zinc-800 transition-colors flex items-center gap-3"
              >
                <Shield size={18} />
                <span className="text-sm font-semibold">
                  {profile.is_blocked ? "Unblock" : "Block"} @{profile.username}
                </span>
              </button>
              <button
                onClick={() => setShowMenu(false)}
                className="w-full px-4 py-3 text-left text-zinc-400 hover:bg-zinc-800 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Highlight Confirm */}
      {deleteHighlightTarget && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div className="bg-zinc-900 rounded-2xl w-full max-w-xs border border-zinc-800 overflow-hidden">
            <div className="px-5 pt-5 pb-4 text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
                <X size={22} className="text-red-500" />
              </div>
              <p className="text-white font-bold text-base">Delete Highlight?</p>
              <p className="text-zinc-400 text-sm mt-1">
                "<span className="text-zinc-200">{deleteHighlightTarget.title}</span>" will be permanently deleted. Stories in your archive won't be affected.
              </p>
            </div>
            <div className="flex border-t border-zinc-800">
              <button
                className="flex-1 py-3 text-zinc-400 text-sm font-medium hover:bg-zinc-800 transition-colors"
                onClick={() => setDeleteHighlightTarget(null)}
              >
                Cancel
              </button>
              <div className="w-px bg-zinc-800" />
              <button
                className="flex-1 py-3 text-red-500 text-sm font-bold hover:bg-zinc-800 transition-colors"
                onClick={async () => {
                  try {
                    await storiesApi.deleteHighlight(deleteHighlightTarget.id);
                    qc.invalidateQueries({ queryKey: ["highlights", username] });
                  } catch {}
                  setDeleteHighlightTarget(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-xl z-[110] border border-zinc-700">
          {toast}
        </div>
      )}

      <ConfirmDialog
        isOpen={cancelConfirmOpen}
        title="Cancel follow request?"
        confirmLabel="Cancel Request"
        onConfirm={() => {
          const req = sentRequests?.find((r: any) => r.followed.username === username);
          if (req) cancelRequestMut.mutate(req.id);
          setCancelConfirmOpen(false);
        }}
        onCancel={() => setCancelConfirmOpen(false)}
      />
    </div>
  );
}
