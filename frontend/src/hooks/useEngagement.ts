/**
 * useEngagement - ONE hook for ALL likes, saves, bookmarks everywhere
 *
 * Instagram-style behavior:
 *  1. Instant optimistic update (heart red + count +1)
 *  2. API call in background
 *  3. Server count synced (real count, not fake)
 *  4. Error? Rollback automatically
 *  5. Persists after refresh (server returns liked=true next fetch)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

// Cache keys to invalidate after like/save so all pages update
const POST_LIKE_KEYS = [['feed'], ['unified_feed'], ['userPosts'], ['user-posts'], ['saved-posts'], ['search']];
const REEL_LIKE_KEYS = [['reels'], ['unified_feed'], ['user-reels'], ['saved-reels'], ['feed'], ['search']];
const POST_BOOKMARK_KEYS = [['feed'], ['unified_feed'], ['saved-posts'], ['user-posts']];
const REEL_SAVE_KEYS = [['reels'], ['unified_feed'], ['saved-reels'], ['user-reels']];

// ─── POST LIKE ────────────────────────────────────────────────────────────────

export function usePostLike(
  postId: string,
  initialLiked: boolean,
  initialCount: number,
  authorUsername?: string,
) {
  const qc = useQueryClient();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const pending = useRef(false);
  const prevIdRef = useRef(postId);

  // Sync only when the post ID changes (different item), not on every parent refetch
  useEffect(() => {
    if (postId !== prevIdRef.current) {
      setLiked(initialLiked);
      setCount(initialCount);
      prevIdRef.current = postId;
    }
  }, [postId, initialLiked, initialCount]);

  const toggle = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;

    // Optimistic
    const prevLiked = liked;
    const prevCount = count;
    
    setLiked(!prevLiked);
    setCount(prevLiked ? prevCount - 1 : prevCount + 1);

    try {
      const res = await apiFetch<{ liked: boolean; like_count: number }>(
        `/posts/${postId}/like`,
        { method: 'POST' }
      );
      // Use REAL server values
      setLiked(res.liked);
      setCount(res.like_count);

      // Invalidate all pages so they refetch with correct liked state
      POST_LIKE_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: key }));
      if (authorUsername) {
        qc.invalidateQueries({ queryKey: ['user-posts', authorUsername] });
      }
    } catch (err) {
      console.error(`Failed to toggle post like for ${postId}:`, err);
      // Rollback
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      pending.current = false;
    }
  }, [liked, count, postId, qc, authorUsername]);

  return { liked, count, toggle };
}

// ─── REEL LIKE ────────────────────────────────────────────────────────────────

export function useReelLike(
  reelId: string,
  initialLiked: boolean,
  initialCount: number,
  authorUsername?: string,
) {
  const qc = useQueryClient();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const pending = useRef(false);
  const prevIdRef = useRef(reelId);

  useEffect(() => {
    // Only reset if the reelId changed (different reel)
    if (reelId !== prevIdRef.current) {
      setLiked(initialLiked);
      setCount(initialCount);
      prevIdRef.current = reelId;
    }
  }, [reelId, initialLiked, initialCount]);

  const toggle = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;

    const prevLiked = liked;
    const prevCount = count;
    
    setLiked(!prevLiked);
    setCount(prevLiked ? prevCount - 1 : prevCount + 1);

    try {
      const res = await apiFetch<{ liked: boolean; likes_count: number }>(
        `/reels/${reelId}/like`,
        { method: 'POST' }
      );
      setLiked(res.liked);
      setCount(res.likes_count);

      REEL_LIKE_KEYS.forEach((key) => {
        qc.invalidateQueries({ queryKey: key });
      });
      if (authorUsername) {
        qc.invalidateQueries({ queryKey: ['user-reels', authorUsername] });
      }
    } catch (err) {
      console.error(`[useReelLike] API FAILED for ${reelId}:`, err);
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      pending.current = false;
    }
  }, [liked, count, reelId, qc, authorUsername]);

  return { liked, count, toggle };
}

// ─── POST BOOKMARK ────────────────────────────────────────────────────────────

export function usePostBookmark(
  postId: string,
  initialBookmarked: boolean,
) {
  const qc = useQueryClient();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const pending = useRef(false);
  const prevIdRef = useRef(postId);

  useEffect(() => {
    if (postId !== prevIdRef.current) {
      setBookmarked(initialBookmarked);
      prevIdRef.current = postId;
    }
  }, [postId, initialBookmarked]);

  const toggle = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;

    const prev = bookmarked;
    setBookmarked(!prev);

    try {
      const res = await apiFetch<{ bookmarked: boolean }>(
        `/posts/${postId}/bookmark`,
        { method: 'POST' }
      );
      setBookmarked(res.bookmarked);
      POST_BOOKMARK_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: key }));
    } catch {
      setBookmarked(prev);
    } finally {
      pending.current = false;
    }
  }, [bookmarked, postId, qc]);

  return { bookmarked, toggle };
}

// ─── REEL SAVE ────────────────────────────────────────────────────────────────

export function useReelSave(
  reelId: string,
  initialSaved: boolean,
) {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(initialSaved);
  const pending = useRef(false);
  const prevIdRef = useRef(reelId);

  useEffect(() => {
    if (reelId !== prevIdRef.current) {
      setSaved(initialSaved);
      prevIdRef.current = reelId;
    }
  }, [reelId, initialSaved]);

  const toggle = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;

    const prev = saved;
    setSaved(!prev);

    try {
      const res = await apiFetch<{ saved: boolean }>(
        `/reels/${reelId}/save`,
        { method: 'POST' }
      );
      setSaved(res.saved);
      REEL_SAVE_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: key }));
    } catch {
      setSaved(prev);
    } finally {
      pending.current = false;
    }
  }, [saved, reelId, qc]);

  return { saved, toggle };
}

// ─── COMMENT LIKE (posts + reels both) ───────────────────────────────────────

export async function toggleCommentLike(
  type: 'post' | 'reel',
  commentId: string,
): Promise<{ liked: boolean; like_count: number }> {
  const url =
    type === 'post'
      ? `/posts/comments/${commentId}/like`
      : `/reels/comments/${commentId}/like`;

  return apiFetch<{ liked: boolean; like_count: number }>(url, { method: 'POST' });
}
