import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

/**
 * 🎯 GLOBAL LIKE HOOK - ONE hook for ALL likes everywhere on the platform
 *
 * Handles:
 *   - Post likes (feed, profile, bookmarks, search - everywhere)
 *   - Reel likes (feed, profile, saved - everywhere)
 *   - Post comment likes
 *   - Reel comment likes
 *   - Reply likes (post and reel replies)
 *
 * Features:
 *   ✅ Instant optimistic UI update
 *   ✅ Automatic rollback on failure
 *   ✅ Cache invalidation (all related pages update)
 *   ✅ Debounce (no double-click spam)
 *   ✅ Works in ALL contexts - same logic everywhere
 */

type LikeType = 'post' | 'reel' | 'post_comment' | 'reel_comment';

interface LikeState {
  liked: boolean;
  count: number;
}

const ENDPOINTS: Record<LikeType, (id: number | string) => string> = {
  post: (id) => `/posts/${id}/like`,
  reel: (id) => `/reels/${id}/like`,
  post_comment: (id) => `/posts/comments/${id}/like`,
  reel_comment: (id) => `/reels/comments/${id}/like`,
};

const CACHE_KEYS_TO_INVALIDATE: Record<LikeType, string[][]> = {
  post: [['feed'], ['unified_feed'], ['userPosts'], ['user-posts'], ['saved-posts'], ['posts']],
  reel: [['reels'], ['unified_feed'], ['user-reels'], ['saved-reels'], ['feed']],
  post_comment: [], // comment state is managed locally in useComments
  reel_comment: [], // comment state is managed locally in useComments
};

/**
 * useLike - Use this hook for post/reel like buttons
 *
 * Example:
 *   const { liked, count, toggle } = useLike('post', post.id, post.viewer_liked, post.like_count);
 *   <button onClick={toggle}><Heart filled={liked} /> {count}</button>
 */
export function useLike(
  type: LikeType,
  id: number | string,
  initialLiked: boolean,
  initialCount: number,
  options?: {
    username?: string; // for profile cache invalidation
    onSuccess?: (liked: boolean, count: number) => void;
  }
) {
  const qc = useQueryClient();
  const [state, setState] = useState<LikeState>({
    liked: initialLiked,
    count: initialCount,
  });
  const isPending = useRef(false);

  // Sync from parent props when they change (e.g. after query refetch)
  const syncFromProps = useCallback((liked: boolean, count: number) => {
    setState({ liked, count });
  }, []);

  const toggle = useCallback(async () => {
    if (isPending.current) return; // debounce
    isPending.current = true;

    // Optimistic update
    const prev = { ...state };
    const newLiked = !state.liked;
    const newCount = state.count + (newLiked ? 1 : -1);
    setState({ liked: newLiked, count: newCount });

    try {
      const res = await apiFetch<{ liked?: boolean; like_count?: number; likes_count?: number }>(
        `/api/v1${ENDPOINTS[type](id)}`,
        { method: 'POST' }
      );

      // Use server's authoritative count
      const serverLiked = res.liked ?? newLiked;
      const serverCount = res.like_count ?? res.likes_count ?? newCount;
      setState({ liked: serverLiked, count: serverCount });

      // Invalidate all related caches
      const keys = CACHE_KEYS_TO_INVALIDATE[type];
      keys.forEach((key) => qc.invalidateQueries({ queryKey: key }));

      // Also invalidate by username if provided (for profile pages)
      if (options?.username) {
        if (type === 'post') {
          qc.invalidateQueries({ queryKey: ['user-posts', options.username] });
        }
        if (type === 'reel') {
          qc.invalidateQueries({ queryKey: ['user-reels', options.username] });
        }
      }

      options?.onSuccess?.(serverLiked, serverCount);
    } catch (err) {
      // Rollback on failure
      console.error('Like failed:', err);
      setState(prev);
    } finally {
      isPending.current = false;
    }
  }, [state, type, id, qc, options]);

  return {
    liked: state.liked,
    count: state.count,
    toggle,
    syncFromProps,
  };
}

/**
 * useCommentLike - Use this in the useComments hook for comment likes
 * Returns a standalone toggle function (not a hook, just a utility)
 */
export async function toggleCommentLike(
  type: 'post_comment' | 'reel_comment',
  commentId: number | string
): Promise<{ liked: boolean; like_count: number }> {
  const res = await apiFetch<{ liked: boolean; like_count: number }>(
    `/api/v1${ENDPOINTS[type](commentId)}`,
    { method: 'POST' }
  );
  return res;
}
