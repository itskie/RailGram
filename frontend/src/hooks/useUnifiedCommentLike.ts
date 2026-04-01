/**
 * UNIFIED COMMENT LIKE HOOK - Global solution for all comment likes
 * Handles: Post comments, Reel comments, Replies - everywhere
 * Auto-manages: Optimistic updates, cache invalidation, error handling
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { posts } from '../lib/api';
import { reels } from '../features/reels/lib/api';

interface CommentLikeResponse {
  liked: boolean;
  like_count: number;
}

export interface UseUnifiedCommentLikeParams {
  commentId: string;
  type: 'post' | 'reel'; // What type of parent item
  currentLiked: boolean;
  onSuccess?: (response: CommentLikeResponse) => void;
  onError?: (error: Error) => void;
}

export function useUnifiedCommentLike() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: UseUnifiedCommentLikeParams) => {
      const { commentId, type } = params;

      if (type === 'post') {
        return (await posts.likePostComment(commentId)) as CommentLikeResponse;
      } else if (type === 'reel') {
        return (await reels.likeComment(commentId)) as CommentLikeResponse;
      }

      throw new Error(`Unknown comment like type: ${type}`);
    },

    onMutate: async (params) => {
      const { commentId, type, currentLiked } = params;

      // Cancel ongoing queries for this comment type
      const queryKeys = type === 'post' 
        ? ['posts', 'feed', 'unified_feed', 'user-posts', 'bookmarks', 'post-comments']
        : ['reels', 'feed', 'unified_feed', 'user-reels', 'saved-reels', 'reel-comments'];

      for (const key of queryKeys) {
        await queryClient.cancelQueries({ queryKey: [key] });
      }

      // Store all previous data
      const previousData = new Map();
      queryKeys.forEach((key) => {
        queryClient.getQueriesData({ queryKey: [key] }).forEach(([queryKey, data]) => {
          previousData.set(queryKey, data);
        });
      });

      // Optimistic update
      optimisticUpdateCommentLike(queryClient, commentId, !currentLiked);

      return { previousData, queryKeys };
    },

    onSuccess: (response, params) => {
      const { commentId } = params;

      // Sync server values
      syncCommentLike(queryClient, commentId, response.liked, response.like_count);
    },

    onError: (_error, _params, context) => {
      // Rollback all changes
      if (context?.previousData) {
        context.previousData.forEach((data, queryKey) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    onSettled: (_data, _error, params) => {
      const { type } = params;
      const queryKeys = type === 'post'
        ? ['posts', 'feed', 'unified_feed', 'user-posts', 'bookmarks', 'post-comments']
        : ['reels', 'feed', 'unified_feed', 'user-reels', 'saved-reels', 'reel-comments'];

      // Invalidate all affected queries
      queryKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key], refetchType: 'active' });
      });
    },
  });

  return {
    likeComment: (params: UseUnifiedCommentLikeParams) => mutation.mutate(params),
    likeCommentAsync: (params: UseUnifiedCommentLikeParams) => mutation.mutateAsync(params),
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Optimistic update for comment like across all caches
 */
function optimisticUpdateCommentLike(
  queryClient: ReturnType<typeof useQueryClient>,
  commentId: string,
  liked: boolean
) {
  const queryKeys = [
    'posts',
    'reels',
    'feed',
    'unified_feed',
    'user-posts',
    'user-reels',
    'bookmarks',
    'saved-reels',
    'post-comments',
    'reel-comments',
  ];

  queryKeys.forEach((key) => {
    updateCommentInQueryData(queryClient, key, commentId, { liked });
  });
}

/**
 * Sync server comment like values across all caches
 */
function syncCommentLike(
  queryClient: ReturnType<typeof useQueryClient>,
  commentId: string,
  liked: boolean,
  likeCount: number
) {
  const queryKeys = [
    'posts',
    'reels',
    'feed',
    'unified_feed',
    'user-posts',
    'user-reels',
    'bookmarks',
    'saved-reels',
    'post-comments',
    'reel-comments',
  ];

  queryKeys.forEach((key) => {
    updateCommentInQueryData(queryClient, key, commentId, { liked, like_count: likeCount });
  });
}

/**
 * Helper to find and update a comment in query data (including nested replies)
 */
function updateCommentInQueryData(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: string,
  commentId: string,
  updates: { liked?: boolean; like_count?: number }
) {
  const queries = queryClient.getQueriesData({ queryKey: [queryKey] });

  queries.forEach(([key, data]) => {
    if (!data) return;

    const updateComment = (comment: any): any => {
      if (comment.id === commentId) {
        return { ...comment, ...updates };
      }

      // Check replies
      if (Array.isArray(comment.replies)) {
        return {
          ...comment,
          replies: comment.replies.map((r: any) => updateComment(r)),
        };
      }

      return comment;
    };

    // Handle paginated data (infinite queries)
    if (Array.isArray((data as any).pages)) {
      queryClient.setQueryData(key, {
        ...data,
        pages: (data as any).pages.map((page: any) => ({
          ...page,
          items: (page.items || []).map((item: any) => ({
            ...item,
            comments: (item.comments || []).map((c: any) => updateComment(c)),
          })),
        })),
      });
    } else if (Array.isArray((data as any).items)) {
      // Handle simple array responses
      queryClient.setQueryData(key, {
        ...data,
        items: (data as any).items.map((item: any) => ({
          ...item,
          comments: (item.comments || []).map((c: any) => updateComment(c)),
        })),
      });
    } else if (Array.isArray((data as any).comments)) {
      // Direct comments array
      queryClient.setQueryData(key, {
        ...data,
        comments: (data as any).comments.map((c: any) => updateComment(c)),
      });
    }
  });
}
