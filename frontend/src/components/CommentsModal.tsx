/**
 * CommentsModal - ONE component for BOTH post and reel comments
 *
 * Usage:
 *   <CommentsModal type="post" entityId={post.id} isOpen={open} onClose={() => setOpen(false)} />
 *   <CommentsModal type="reel" entityId={reel.id} isOpen={open} onClose={() => setOpen(false)} />
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, Heart, CornerDownRight, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { apiFetch } from '../lib/api';
import { toggleCommentLike } from '../hooks/useEngagement';
import Avatar from './Avatar';
import { formatDistanceToNow } from 'date-fns';

// ─── Unified comment type (normalizes post + reel comments) ──────────────────

interface Comment {
  id: string;
  body: string;
  created_at: string;
  like_count: number;
  liked: boolean;
  reply_count: number;
  parent_id: string | null;
  author: {
    username: string;
    display_name?: string | null;
    avatar_url?: string | null;
  };
}

// ─── Normalize backend response → unified Comment ────────────────────────────

function normalize(raw: any, type: 'post' | 'reel'): Comment {
  // Post comments have `author`, reel comments have `user`
  const a = type === 'post' ? raw.author : raw.user;
  return {
    id: String(raw.id),
    body: raw.body,
    created_at: raw.created_at,
    like_count: raw.like_count ?? 0,
    liked: raw.liked ?? false,
    reply_count: raw.reply_count ?? 0,
    parent_id: raw.parent_id ? String(raw.parent_id) : null,
    author: {
      username: a?.username ?? '',
      display_name: a?.display_name ?? null,
      avatar_url: a?.avatar_url ?? null,
    },
  };
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchComments(type: 'post' | 'reel', entityId: string): Promise<Comment[]> {
  if (type === 'post') {
    const res = await apiFetch<any>(`/posts/${entityId}/comments`);
    const arr = Array.isArray(res) ? res : (res?.comments ?? []);
    return arr.map((c: any) => normalize(c, 'post'));
  } else {
    const arr = await apiFetch<any[]>(`/reels/${entityId}/comments`);
    return (arr ?? []).map((c: any) => normalize(c, 'reel'));
  }
}

async function fetchReplies(type: 'post' | 'reel', entityId: string, commentId: string): Promise<Comment[]> {
  if (type === 'post') {
    const res = await apiFetch<any>(`/posts/${entityId}/comments/${commentId}/replies`);
    const arr = Array.isArray(res) ? res : (res?.comments ?? []);
    return arr.map((c: any) => normalize(c, 'post'));
  } else {
    const arr = await apiFetch<any[]>(`/reels/${entityId}/comments/${commentId}/replies`);
    return (arr ?? []).map((c: any) => normalize(c, 'reel'));
  }
}

async function postComment(type: 'post' | 'reel', entityId: string, body: string, parentId?: string) {
  if (type === 'post') {
    await apiFetch(`/posts/${entityId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body, parent_id: parentId ?? null }),
    });
  } else {
    await apiFetch(`/reels/${entityId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body, parent_id: parentId ?? null }),
    });
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CommentsModalProps {
  type: 'post' | 'reel';
  entityId: string;
  isOpen: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CommentsModal({ type, entityId, isOpen, onClose }: CommentsModalProps) {
  const { user } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, Comment[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch on open
  useEffect(() => {
    if (!isOpen || !entityId) return;
    setComments([]);
    setReplyingTo(null);
    setExpandedReplies({});
    setIsLoading(true);
    fetchComments(type, entityId)
      .then(setComments)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [isOpen, entityId, type]);

  // Focus input on reply
  useEffect(() => {
    if (replyingTo) inputRef.current?.focus();
  }, [replyingTo]);

  // ── Post comment / reply ──────────────────────────────────────────────────

  const handlePost = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isPosting || !user) return;

    const parentId = replyingTo?.id;
    setIsPosting(true);

    // Optimistic temp comment
    const temp: Comment = {
      id: 'temp-' + Date.now(),
      body: text,
      created_at: new Date().toISOString(),
      like_count: 0,
      liked: false,
      reply_count: 0,
      parent_id: parentId ?? null,
      author: {
        username: user.username,
        display_name: user.display_name ?? null,
        avatar_url: user.avatar_url ?? null,
      },
    };

    if (parentId) {
      setExpandedReplies((prev) => ({ ...prev, [parentId]: [...(prev[parentId] ?? []), temp] }));
    } else {
      setComments((prev) => [...prev, temp]);
    }

    const submittedText = text;
    setText('');
    setReplyingTo(null);

    try {
      await postComment(type, entityId, submittedText, parentId);
      // Refetch to get real ID and data
      if (parentId) {
        const replies = await fetchReplies(type, entityId, parentId);
        setExpandedReplies((prev) => ({ ...prev, [parentId]: replies }));
        setComments((prev) =>
          prev.map((c) => c.id === parentId ? { ...c, reply_count: replies.length } : c)
        );
      } else {
        const updated = await fetchComments(type, entityId);
        setComments(updated);
      }
    } catch {
      // Rollback
      if (parentId) {
        setExpandedReplies((prev) => ({
          ...prev,
          [parentId]: (prev[parentId] ?? []).filter((c) => c.id !== temp.id),
        }));
      } else {
        setComments((prev) => prev.filter((c) => c.id !== temp.id));
      }
    } finally {
      setIsPosting(false);
    }
  }, [text, isPosting, user, replyingTo, type, entityId]);

  // ── Like a comment or reply ───────────────────────────────────────────────

  const handleLikeComment = useCallback(async (comment: Comment, parentId?: string) => {
    if (!user) return;

    const isReply = !!parentId;
    const newLiked = !comment.liked;
    const delta = newLiked ? 1 : -1;

    // Optimistic update
    const applyUpdate = (list: Comment[]) =>
      list.map((c) =>
        c.id === comment.id
          ? { ...c, liked: newLiked, like_count: Math.max(0, c.like_count + delta) }
          : c
      );

    if (isReply) {
      setExpandedReplies((prev) => ({ ...prev, [parentId]: applyUpdate(prev[parentId] ?? []) }));
    } else {
      setComments((prev) => applyUpdate(prev));
    }

    try {
      const res = await toggleCommentLike(type, comment.id);

      // Apply server's real values
      const applyServer = (list: Comment[]) =>
        list.map((c) =>
          c.id === comment.id ? { ...c, liked: res.liked, like_count: res.like_count } : c
        );

      if (isReply) {
        setExpandedReplies((prev) => ({ ...prev, [parentId]: applyServer(prev[parentId] ?? []) }));
      } else {
        setComments((prev) => applyServer(prev));
      }
    } catch {
      // Rollback
      const rollback = (list: Comment[]) =>
        list.map((c) =>
          c.id === comment.id ? { ...c, liked: comment.liked, like_count: comment.like_count } : c
        );
      if (isReply) {
        setExpandedReplies((prev) => ({ ...prev, [parentId]: rollback(prev[parentId] ?? []) }));
      } else {
        setComments((prev) => rollback(prev));
      }
    }
  }, [user, type]);

  // ── Load / collapse replies ───────────────────────────────────────────────

  const handleLoadReplies = useCallback(async (comment: Comment) => {
    if (expandedReplies[comment.id]) {
      setExpandedReplies((prev) => {
        const next = { ...prev };
        delete next[comment.id];
        return next;
      });
      return;
    }
    setLoadingReplies((prev) => ({ ...prev, [comment.id]: true }));
    try {
      const replies = await fetchReplies(type, entityId, comment.id);
      setExpandedReplies((prev) => ({ ...prev, [comment.id]: replies }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingReplies((prev) => ({ ...prev, [comment.id]: false }));
    }
  }, [expandedReplies, type, entityId]);

  // ── Render a single comment (recursive for replies) ───────────────────────

  const renderComment = (c: Comment, depth = 0, parentId?: string) => {
    const isExpanded = !!expandedReplies[c.id];
    const isLoadingR = loadingReplies[c.id];

    return (
      <div key={c.id} className={depth > 0 ? 'ml-8' : ''}>
        <div className="flex gap-3 py-3">
          <Avatar
            src={c.author.avatar_url}
            name={c.author.display_name || c.author.username}
            username={c.author.username}
            size={depth > 0 ? 7 : 8}
            linkTo={`/profile/${c.author.username}`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-white text-[13px] font-bold">{c.author.username}</span>
              <span className="text-zinc-500 text-[11px]">
                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
              </span>
            </div>
            <p className="text-zinc-200 text-[13px] mt-0.5 leading-snug whitespace-pre-wrap break-words">
              {c.body}
            </p>
            <div className="flex items-center gap-4 mt-1.5">
              {/* Reply button (only top-level) */}
              {user && depth === 0 && (
                <button
                  onClick={() => {
                    setReplyingTo(c);
                    setText(`@${c.author.username} `);
                  }}
                  className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Reply
                </button>
              )}
              {/* Like button */}
              <button
                onClick={() => handleLikeComment(c, parentId)}
                className={`flex items-center gap-1 text-[11px] font-semibold transition-colors ${
                  c.liked ? 'text-red-400' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Heart size={11} className={c.liked ? 'fill-red-400' : ''} />
                {c.like_count > 0 && c.like_count}
              </button>
            </div>
            {/* Expand replies button */}
            {c.reply_count > 0 && depth === 0 && (
              <button
                onClick={() => handleLoadReplies(c)}
                className="flex items-center gap-1 mt-1.5 text-[11px] font-bold text-zinc-500 hover:text-orange-400 transition-colors"
              >
                {isLoadingR ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <ChevronDown
                    size={11}
                    className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                )}
                {isExpanded
                  ? 'Hide replies'
                  : `${c.reply_count} ${c.reply_count === 1 ? 'reply' : 'replies'}`}
              </button>
            )}
          </div>
        </div>
        {/* Replies */}
        {isExpanded && expandedReplies[c.id] && (
          <div className="border-l-2 border-zinc-800 ml-4 pl-2">
            {expandedReplies[c.id].map((r) => renderComment(r, depth + 1, c.id))}
          </div>
        )}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />
          {/* Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 md:left-[72px] right-0 w-full max-w-[470px] mx-auto h-[70%] bg-zinc-900 rounded-t-3xl border-t border-zinc-800 z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
              <span className="font-semibold text-zinc-100">Comments</span>
              <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-full text-zinc-400">
                <X size={22} />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4">
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col h-full items-center justify-center text-zinc-500 gap-2">
                  <p className="text-sm">No comments yet.</p>
                  <p className="text-xs">Be the first to share your thoughts!</p>
                </div>
              ) : (
                <div>{comments.map((c) => renderComment(c))}</div>
              )}
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-zinc-800 pb-8 sm:pb-4 flex-shrink-0">
              {replyingTo && (
                <div className="flex items-center gap-2 mb-2 text-xs text-zinc-400">
                  <CornerDownRight size={11} />
                  <span>
                    Replying to{' '}
                    <span className="text-orange-400 font-semibold">
                      @{replyingTo.author.username}
                    </span>
                  </span>
                  <button
                    onClick={() => { setReplyingTo(null); setText(''); }}
                    className="ml-auto text-zinc-600 hover:text-zinc-400"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
              {user ? (
                <form
                  onSubmit={handlePost}
                  className="flex gap-2 items-center bg-zinc-800 rounded-2xl px-3 py-1 border border-zinc-700 focus-within:border-orange-500/60 transition-colors"
                >
                  <input
                    ref={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={
                      replyingTo ? `Reply to @${replyingTo.author.username}...` : 'Add a comment...'
                    }
                    className="flex-1 bg-transparent border-none py-3 text-sm text-white focus:outline-none placeholder:text-zinc-500"
                    disabled={isPosting}
                  />
                  <button
                    type="submit"
                    disabled={!text.trim() || isPosting}
                    className="p-2 text-orange-400 disabled:text-zinc-600 hover:text-orange-300 transition-colors"
                  >
                    {isPosting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                  </button>
                </form>
              ) : (
                <p className="text-center text-zinc-500 text-sm py-2">Log in to comment</p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
