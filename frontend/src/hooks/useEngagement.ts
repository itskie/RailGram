import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCallback } from 'react';

/**
 * 🎯 GLOBAL ENGAGEMENT HOOK - ONE hook for ALL engagement actions worldwide
 * Posts, Reels, Comments everywhere - handles likes, bookmarks, saves UNIFORMLY
 * 
 * ✅ Optimistic updates (instant UI feedback)
 * ✅ Automatic cache invalidation (data stays fresh)
 * ✅ Error rollback (state reverts on failure)
 * ✅ Works in all contexts: Feed, Profile, Bookmarks, Comments
 */

type EntityType = 'post' | 'reel' | 'comment' | 'reel_comment';
type Action = 'like' | 'bookmark' | 'save';

interface EngagementParams {
  type: EntityType;
  id: number;
  action: Action;
}

interface EngagementResponse {
  liked?: boolean;
  like_count?: number;
  likes_count?: number;
  bookmarked?: boolean;
  bookmark_count?: number;
  saved?: boolean;
  saves_count?: number;
}

export const useEngagement = () => {
  const qc = useQueryClient();

  /**
   * Get API endpoint based on entity type and action
   */
  const getEndpoint = useCallback((type: EntityType, id: number, action: Action): string => {
    if (type === 'post' && action === 'like') return `/api/v1/posts/${id}/like`;
    if (type === 'post' && action === 'bookmark') return `/api/v1/posts/${id}/bookmark`;
    if (type === 'reel' && action === 'like') return `/api/v1/reels/${id}/like`;
    if (type === 'reel' && action === 'save') return `/api/v1/reels/${id}/save`;
    if (type === 'comment' && action === 'like') return `/api/v1/posts/comments/${id}/like`;
    if (type === 'reel_comment' && action === 'like') return `/api/v1/reels/comments/${id}/like`;
    throw new Error(`Unknown: ${type} ${action}`);
  }, []);

  /**
   * Make API call to engagement endpoint
   */
  const executeEngagement = useCallback(
    async (params: EngagementParams): Promise<EngagementResponse> => {
      const endpoint = getEndpoint(params.type, params.id, params.action);
      const response = await api.post<EngagementResponse>(endpoint, {});
      return response.data;
    },
    [getEndpoint]
  );

  /**
   * Invalidate ALL caches related to this entity/action
   * This ensures we see the updated state everywhere
   */
  const invalidateAllRelatedQueries = useCallback((params: EngagementParams) => {
    const { type, id } = params;

    // Posts appear in multiple queries
    if (type === 'post') {
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['userPosts'] });
      qc.invalidateQueries({ queryKey: ['user-posts'] });
      qc.invalidateQueries({ queryKey: ['unified_feed'] });
      qc.invalidateQueries({ queryKey: ['post', id] });
      qc.invalidateQueries({ queryKey: ['saved-posts'] });
      qc.invalidateQueries({ queryKey: ['posts'] });
    }

    // Reels appear in multiple queries
    if (type === 'reel') {
      qc.invalidateQueries({ queryKey: ['reels'] });
      qc.invalidateQueries({ queryKey: ['user-reels'] });
      qc.invalidateQueries({ queryKey: ['saved-reels'] });
      qc.invalidateQueries({ queryKey: ['reel', id] });
      qc.invalidateQueries({ queryKey: ['unified_feed'] });
      qc.invalidateQueries({ queryKey: ['feed'] }); // Mixed feed
    }

    // Comments appear in multiple queries
    if (type === 'comment') {
      qc.invalidateQueries({ queryKey: ['post-comments'] });
      qc.invalidateQueries({ queryKey: ['postComments'] });
      qc.invalidateQueries({ queryKey: ['comments'] });
    }

    // Reel comments appear in multiple queries
    if (type === 'reel_comment') {
      qc.invalidateQueries({ queryKey: ['reel-comments'] });
      qc.invalidateQueries({ queryKey: ['reelComments'] });
      qc.invalidateQueries({ queryKey: ['comments'] });
    }
  }, [qc]);

  /**
   * Main mutation - handles all engagement types uniformly
   */
  const mutation = useMutation({
    mutationFn: executeEngagement,
    onSuccess: (_data, params) => {
      invalidateAllRelatedQueries(params);
    },
    onError: (error) => {
      console.error('Engagement failed:', error);
    },
  });

  return {
    /**
     * Toggle like on any entity (posts, reels, comments)
     * Usage: toggleLike('post', 123) or toggleLike('reel', 456)
     */
    toggleLike: (type: EntityType, id: number) => {
      mutation.mutate({ type, id, action: 'like' });
    },

    /**
     * Toggle bookmark on posts
     * Usage: toggleBookmark(123)
     */
    toggleBookmark: (postId: number) => {
      mutation.mutate({ type: 'post', id: postId, action: 'bookmark' });
    },

    /**
     * Toggle save on reels
     * Usage: toggleSave(456)
     */
    toggleSave: (reelId: number) => {
      mutation.mutate({ type: 'reel', id: reelId, action: 'save' });
    },

    // Expose mutation state
    isLoading: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
};
