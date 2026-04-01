import { useState, useCallback, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { toggleCommentLike } from './useLike';

/**
 * 🎯 GLOBAL COMMENTS HOOK - ONE hook for ALL comments everywhere on the platform
 *
 * Handles BOTH post and reel comments with the same interface:
 *   - Fetch comments
 *   - Post a comment or reply
 *   - Like/unlike a comment or reply
 *   - Load replies
 *   - Optimistic updates everywhere
 *   - Auto-refetch after like to persist state
 *
 * Usage:
 *   // For post comments:
 *   const comments = useComments({ type: 'post', entityId: postId, isOpen });
 *
 *   // For reel comments:
 *   const comments = useComments({ type: 'reel', entityId: reelId, isOpen });
 */

// Unified comment interface that works for both post and reel comments
export interface Comment {
  id: string;
  body: string;
  created_at: string;
  like_count: number;
  liked: boolean;
  reply_count: number;
  parent_id: string | null;
  // Post comments use 'author', reel comments use 'user' - we normalize to 'author'
  author: {
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
}

interface UseCommentsOptions {
  type: 'post' | 'reel';
  entityId: string;
  isOpen: boolean;
}

// Normalize backend response to unified Comment interface
function normalizeComment(raw: any, type: 'post' | 'reel'): Comment {
  const authorData = type === 'reel' ? raw.user : raw.author;
  return {
    id: String(raw.id),
    body: raw.body,
    created_at: raw.created_at,
    like_count: raw.like_count ?? 0,
    liked: raw.liked ?? false,
    reply_count: raw.reply_count ?? 0,
    parent_id: raw.parent_id ? String(raw.parent_id) : null,
    author: {
      username: authorData?.username ?? '',
      display_name: authorData?.display_name,
      avatar_url: authorData?.avatar_url,
    },
  };
}

// Fetch comments from backend
async function fetchCommentsFromAPI(type: 'post' | 'reel', entityId: string): Promise<Comment[]> {
  if (type === 'post') {
    const res = await apiFetch<any>(`/api/v1/posts/${entityId}/comments`);
    const raw = Array.isArray(res) ? res : (res?.comments ?? []);
    return raw.map((c: any) => normalizeComment(c, 'post'));
  } else {
    const res = await apiFetch<any[]>(`/api/v1/reels/${entityId}/comments`);
    return (res ?? []).map((c: any) => normalizeComment(c, 'reel'));
  }
}

// Fetch replies from backend
async function fetchRepliesFromAPI(type: 'post' | 'reel', entityId: string, commentId: string): Promise<Comment[]> {
  if (type === 'post') {
    const res = await apiFetch<any>(`/api/v1/posts/${entityId}/comments/${commentId}/replies`);
    const raw = Array.isArray(res) ? res : (res?.comments ?? []);
    return raw.map((c: any) => normalizeComment(c, 'post'));
  } else {
    const res = await apiFetch<any[]>(`/api/v1/reels/${entityId}/comments/${commentId}/replies`);
    return (res ?? []).map((c: any) => normalizeComment(c, 'reel'));
  }
}

export function useComments({ type, entityId, isOpen }: UseCommentsOptions) {
  const { user } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, Comment[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<Record<string, boolean>>({});

  // Fetch comments when modal opens
  const fetchComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchCommentsFromAPI(type, entityId);
      setComments(data);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [type, entityId]);

  useEffect(() => {
    if (isOpen && entityId) {
      fetchComments();
      setReplyingTo(null);
      setExpandedReplies({});
    }
  }, [isOpen, entityId]);

  // Post a new comment or reply
  const postComment = useCallback(async (text: string) => {
    if (!text.trim() || isPosting || !user) return;

    const parentId = replyingTo?.id ?? undefined;
    const tempId = 'temp-' + Date.now();
    const temp: Comment = {
      id: tempId,
      body: text,
      created_at: new Date().toISOString(),
      like_count: 0,
      liked: false,
      reply_count: 0,
      parent_id: parentId ?? null,
      author: {
        username: user.username,
        display_name: user.display_name ?? undefined,
        avatar_url: user.avatar_url ?? undefined,
      },
    };

    setIsPosting(true);

    if (parentId) {
      setExpandedReplies((prev) => ({
        ...prev,
        [parentId]: [...(prev[parentId] ?? []), temp],
      }));
    } else {
      setComments((prev) => [...prev, temp]);
    }

    setReplyingTo(null);

    try {
      if (type === 'post') {
        await apiFetch(`/api/v1/posts/${entityId}/comments`, {
          method: 'POST',
          body: JSON.stringify({ body: text, parent_id: parentId ?? null }),
        });
      } else {
        await apiFetch(`/api/v1/reels/${entityId}/comments`, {
          method: 'POST',
          body: JSON.stringify({ body: text, parent_id: parentId ?? null }),
        });
      }

      if (parentId) {
        const replies = await fetchRepliesFromAPI(type, entityId, parentId);
        setExpandedReplies((prev) => ({ ...prev, [parentId]: replies }));
        setComments((prev) =>
          prev.map((c) => (c.id === parentId ? { ...c, reply_count: c.reply_count + 1 } : c))
        );
      } else {
        await fetchComments(); // Refetch to get server ID
      }
    } catch (err) {
      console.error('Failed to post comment:', err);
      // Rollback
      if (parentId) {
        setExpandedReplies((prev) => ({
          ...prev,
          [parentId]: (prev[parentId] ?? []).filter((c) => c.id !== tempId),
        }));
      } else {
        setComments((prev) => prev.filter((c) => c.id !== tempId));
      }
    } finally {
      setIsPosting(false);
    }
  }, [type, entityId, replyingTo, isPosting, user, fetchComments]);

  // Like a comment or reply
  const likeComment = useCallback(async (comment: Comment, parentId?: string) => {
    if (!user) return;

    const isReply = !!parentId;
    const commentType: 'post_comment' | 'reel_comment' =
      type === 'post' ? 'post_comment' : 'reel_comment';

    // Optimistic update
    const newLiked = !comment.liked;
    const delta = newLiked ? 1 : -1;

    const updateFn = (c: Comment) =>
      c.id === comment.id
        ? { ...c, liked: newLiked, like_count: Math.max(0, c.like_count + delta) }
        : c;

    if (isReply) {
      setExpandedReplies((prev) => ({
        ...prev,
        [parentId]: (prev[parentId] ?? []).map(updateFn),
      }));
    } else {
      setComments((prev) => prev.map(updateFn));
    }

    try {
      const res = await toggleCommentLike(commentType, comment.id);

      // Apply server's authoritative values
      const serverUpdate = (c: Comment) =>
        c.id === comment.id
          ? { ...c, liked: res.liked, like_count: res.like_count }
          : c;

      if (isReply) {
        setExpandedReplies((prev) => ({
          ...prev,
          [parentId]: (prev[parentId] ?? []).map(serverUpdate),
        }));
      } else {
        setComments((prev) => prev.map(serverUpdate));
      }
    } catch (err) {
      console.error('Comment like failed:', err);
      // Rollback
      const rollback = (c: Comment) =>
        c.id === comment.id ? { ...c, liked: comment.liked, like_count: comment.like_count } : c;

      if (isReply) {
        setExpandedReplies((prev) => ({
          ...prev,
          [parentId]: (prev[parentId] ?? []).map(rollback),
        }));
      } else {
        setComments((prev) => prev.map(rollback));
      }
    }
  }, [type, user]);

  // Load replies for a comment
  const loadReplies = useCallback(async (comment: Comment) => {
    if (expandedReplies[comment.id]) {
      // Toggle off
      setExpandedReplies((prev) => {
        const next = { ...prev };
        delete next[comment.id];
        return next;
      });
      return;
    }

    setLoadingReplies((prev) => ({ ...prev, [comment.id]: true }));
    try {
      const replies = await fetchRepliesFromAPI(type, entityId, comment.id);
      setExpandedReplies((prev) => ({ ...prev, [comment.id]: replies }));
      setComments((prev) =>
        prev.map((c) => (c.id === comment.id ? { ...c, reply_count: replies.length } : c))
      );
    } catch (err) {
      console.error('Failed to load replies:', err);
    } finally {
      setLoadingReplies((prev) => ({ ...prev, [comment.id]: false }));
    }
  }, [type, entityId, expandedReplies]);

  return {
    comments,
    isLoading,
    isPosting,
    replyingTo,
    setReplyingTo,
    expandedReplies,
    loadingReplies,
    postComment,
    likeComment,
    loadReplies,
    refetch: fetchComments,
  };
}
